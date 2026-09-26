-- Operational queries for the Supabase SQL editor. Read-only unless noted.

-- 1. Funnel, last 30 days (anonymous events; see backend/src/observability/metrics.js)
select name, props->>'kind' as kind, count(*)
from product_events
where created_at > now() - interval '30 days'
  and name in ('landing_view', 'demo_opened', 'game_created', 'game_started', 'game_completed',
               'create_opened', 'pricing_viewed', 'checkout_started', 'checkout_created', 'end_cta_clicked',
               'generation_failed')
group by 1, 2
order by 1, 2;

-- 2. High-volume counters (reconnects, join failures), last 7 days
select key as counter, sum(value::int) as total
from product_events, jsonb_each_text(props)
where name = 'metrics_rollup' and created_at > now() - interval '7 days'
group by 1 order by 2 desc;

-- 3. Purchases and repeat hosting
select date_trunc('month', created_at) as month,
       count(*) filter (where status = 'paid') as paid_events,
       sum(amount_total) filter (where status = 'paid') / 100.0 as gross_eur
from payments group by 1 order by 1 desc;

select hosts_with_n_games, count(*) as hosts from (
  select user_id, count(*) as hosts_with_n_games
  from quiz_generations
  where status = 'succeeded' and created_at > now() - interval '90 days' and user_id is not null
  group by user_id
) t group by 1 order by 1;

-- 4. AI cost per game (actual token usage recorded per generation)
select date_trunc('week', created_at) as week, status, count(*),
       round(avg(input_tokens)) as avg_in, round(avg(output_tokens)) as avg_out,
       round(avg(estimated_cost_usd)::numeric, 4) as avg_usd, round(sum(estimated_cost_usd)::numeric, 2) as total_usd
from quiz_generations
where source = 'openai' and created_at > now() - interval '90 days'
group by 1, 2 order by 1 desc, 2;

-- 5. AUDIT: subscribers who may have been charged without receiving AI games.
-- Before this release, invoice.paid webhooks under Stripe API 2025-03-31+ could not
-- find the subscription and granted nothing. Compare with invoices in Stripe.
select s.user_id, p.email, s.tier, s.status, s.stripe_customer_id, s.stripe_subscription_id,
       (select count(*) from credit_grants g where g.user_id = s.user_id and g.grant_type = 'subscription') as subscription_grants
from subscriptions s join profiles p on p.id = s.user_id
where s.stripe_subscription_id is not null
order by subscription_grants asc, s.updated_at desc;

-- 6. Reservations that never settled (should be empty; the server releases them after 10 minutes)
select id, user_id, charge_mode, created_at from quiz_generations
where status = 'reserved' and created_at < now() - interval '15 minutes';

-- 7. MANUAL FIX (writes): grant AI games for a missed invoice. Idempotent per source id,
-- so a later webhook replay for the same invoice will not double-grant.
-- select public.kz_grant_credits('<user uuid>', '<in_... invoice id>', 'subscription', 30,
--        '<expiry: period end + 1 month>'::timestamptz, 'manual_reconciliation', '{"planId":"plus_monthly"}'::jsonb);
