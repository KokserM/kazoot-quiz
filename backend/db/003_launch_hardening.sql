-- 003: launch hardening.
--
-- Additive and idempotent. Safe to run while the previous app version is live:
-- the old code ignores the new columns and functions.
--
-- What it does:
--   1. Removes the client-side UPDATE policy on profiles (users could rewrite their
--      own stripe_customer_id). The backend writes profiles with the service role.
--   2. Adds charge tracking to quiz_generations so a reservation can be released
--      exactly once, from any process, even after a crash.
--   3. Adds atomic credit functions (reserve / complete / release / grant / revoke).
--      Only the service role may execute them.
--   4. Adds subscription detail columns and a small, anonymous product_events table.

-- 1. RLS: profiles are read-only for their owner.
drop policy if exists "profiles_update_own" on public.profiles;

-- 2. Generation charge tracking.
alter table public.quiz_generations
  add column if not exists charge_mode text,
  add column if not exists consumed_grants jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quiz_generations_charge_mode_check'
  ) then
    alter table public.quiz_generations
      add constraint quiz_generations_charge_mode_check
      check (charge_mode is null or charge_mode in ('free_quota', 'paid_credit'));
  end if;
end $$;

create index if not exists quiz_generations_status_created_idx
  on public.quiz_generations(status, created_at);

-- 4a. Subscription details shown to the customer.
alter table public.subscriptions
  add column if not exists plan_id text,
  add column if not exists cancel_at_period_end boolean not null default false;

-- 4b. Payments: look up by payment intent for refunds and disputes.
create index if not exists payments_payment_intent_idx
  on public.payments((metadata->>'paymentIntentId'));

-- 4c. Anonymous product funnel events. No user id, no IP, no free text.
create table if not exists public.product_events (
  id bigserial primary key,
  name text not null check (name ~ '^[a-z_]{2,48}$'),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists product_events_name_created_idx on public.product_events(name, created_at desc);
alter table public.product_events enable row level security;

-- 3. Credit functions.

create or replace function public.kz_reserve_generation(
  p_generation_id uuid,
  p_user_id uuid,
  p_topic text,
  p_language text,
  p_model text,
  p_ip text,
  p_free_limit integer,
  p_cost integer,
  p_period_start timestamptz
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_free_used integer;
  v_mode text;
  v_remaining integer := p_cost;
  v_consumed jsonb := '[]'::jsonb;
  v_take integer;
  g record;
begin
  -- Serialises reservations per user across every app process.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  -- Rows written before 003 have no charge_mode; they were counted as free usage then too.
  select count(*) into v_free_used
  from public.quiz_generations
  where user_id = p_user_id
    and source = 'openai'
    and created_at >= p_period_start
    and status in ('reserved', 'succeeded')
    and coalesce(charge_mode, 'free_quota') = 'free_quota';

  if v_free_used < p_free_limit then
    v_mode := 'free_quota';
  else
    v_mode := 'paid_credit';
    -- Spend the credits that expire first; non-expiring credits last.
    for g in
      select id, remaining_credits
      from public.credit_grants
      where user_id = p_user_id
        and remaining_credits > 0
        and (expires_at is null or expires_at > now())
      order by expires_at asc nulls last, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(g.remaining_credits, v_remaining);
      update public.credit_grants set remaining_credits = remaining_credits - v_take where id = g.id;
      v_consumed := v_consumed || jsonb_build_array(jsonb_build_object('grantId', g.id, 'amount', v_take));
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'insufficient_credits' using errcode = 'P0001';
    end if;
  end if;

  insert into public.quiz_generations (
    id, user_id, ip_address, topic, language, model, source, status, charge_mode, consumed_grants
  ) values (
    p_generation_id, p_user_id, p_ip, p_topic, p_language, p_model, 'openai', 'reserved', v_mode, v_consumed
  );

  if v_mode = 'paid_credit' then
    insert into public.usage_ledger (user_id, delta, reason, source_id, metadata)
    values (p_user_id, -p_cost, 'ai_quiz_reserved', p_generation_id::text,
            jsonb_build_object('consumedGrants', v_consumed, 'topic', p_topic));
  end if;

  return jsonb_build_object(
    'mode', v_mode,
    'consumedGrants', v_consumed,
    'creditCost', case when v_mode = 'paid_credit' then p_cost else 0 end
  );
end;
$$;

create or replace function public.kz_complete_generation(
  p_generation_id uuid,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_usd numeric
) returns boolean
language plpgsql
set search_path = public
as $$
begin
  update public.quiz_generations
  set status = 'succeeded',
      input_tokens = coalesce(p_input_tokens, 0),
      output_tokens = coalesce(p_output_tokens, 0),
      estimated_cost_usd = coalesce(p_estimated_cost_usd, 0),
      completed_at = now()
  where id = p_generation_id and status = 'reserved';
  return found;
end;
$$;

-- Releases a reservation exactly once. Returns false if it was already settled.
create or replace function public.kz_release_generation(
  p_generation_id uuid,
  p_error text,
  p_input_tokens integer default 0,
  p_output_tokens integer default 0,
  p_estimated_cost_usd numeric default 0
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_cost integer;
begin
  select * into r from public.quiz_generations where id = p_generation_id for update;
  if not found or r.status <> 'reserved' then
    return false;
  end if;

  update public.quiz_generations
  set status = case when r.charge_mode = 'paid_credit' then 'refunded' else 'failed' end,
      error = left(coalesce(p_error, 'Generation failed'), 500),
      input_tokens = coalesce(p_input_tokens, 0),
      output_tokens = coalesce(p_output_tokens, 0),
      estimated_cost_usd = coalesce(p_estimated_cost_usd, 0),
      completed_at = now()
  where id = p_generation_id;

  if r.charge_mode = 'paid_credit' then
    update public.credit_grants cg
    set remaining_credits = cg.remaining_credits + (c->>'amount')::integer
    from jsonb_array_elements(r.consumed_grants) c
    where cg.id = (c->>'grantId')::uuid;

    select coalesce(sum((c->>'amount')::integer), 0) into v_cost
    from jsonb_array_elements(r.consumed_grants) c;

    insert into public.usage_ledger (user_id, delta, reason, source_id, metadata)
    values (r.user_id, v_cost, 'ai_quiz_refunded', p_generation_id::text,
            jsonb_build_object('reason', left(coalesce(p_error, 'Generation failed'), 200)))
    on conflict (user_id, source_id, reason) do nothing;
  end if;

  return true;
end;
$$;

-- Crash recovery: releases reservations that never settled.
create or replace function public.kz_release_stale_generations(p_older_than_seconds integer)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.quiz_generations
    where status = 'reserved'
      and created_at < now() - make_interval(secs => p_older_than_seconds)
  loop
    if public.kz_release_generation(v_id, 'Reservation expired before completion') then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Grants credits once per (user, source, type). Returns true if newly granted.
create or replace function public.kz_grant_credits(
  p_user_id uuid,
  p_source_id text,
  p_grant_type text,
  p_credits integer,
  p_expires_at timestamptz,
  p_reason text,
  p_metadata jsonb
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_inserted boolean;
begin
  insert into public.credit_grants (user_id, source_id, grant_type, original_credits, remaining_credits, expires_at, metadata)
  values (p_user_id, p_source_id, p_grant_type, p_credits, p_credits, p_expires_at,
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('reason', p_reason))
  on conflict (user_id, source_id, grant_type) do nothing;
  v_inserted := found;

  if v_inserted then
    insert into public.usage_ledger (user_id, delta, reason, source_id, metadata)
    values (p_user_id, p_credits, p_reason, p_source_id, coalesce(p_metadata, '{}'::jsonb))
    on conflict (user_id, source_id, reason) do nothing;
  end if;

  return v_inserted;
end;
$$;

-- Removes unused credits from a grant after a refund or dispute.
-- p_credits null = remove everything left. Returns the number of credits removed.
-- p_reason must be unique per refund/dispute (e.g. 'refund:re_123'); replaying the
-- same reason removes nothing.
create or replace function public.kz_revoke_grant(
  p_source_id text,
  p_credits integer,
  p_reason text
) returns integer
language plpgsql
set search_path = public
as $$
declare
  g record;
  v_take integer;
  v_total integer := 0;
begin
  for g in
    select id, user_id, remaining_credits from public.credit_grants
    where source_id = p_source_id
    for update
  loop
    v_take := case when p_credits is null then g.remaining_credits else least(g.remaining_credits, greatest(p_credits - v_total, 0)) end;

    -- The ledger row is the idempotency key for this revocation.
    insert into public.usage_ledger (user_id, delta, reason, source_id, metadata)
    values (g.user_id, -v_take, 'grant_revoked', p_source_id || ':' || p_reason || ':' || g.id::text,
            jsonb_build_object('reason', p_reason))
    on conflict (user_id, source_id, reason) do nothing;

    if found and v_take > 0 then
      update public.credit_grants
      set remaining_credits = remaining_credits - v_take,
          metadata = metadata || jsonb_build_object('revokedCredits', coalesce((metadata->>'revokedCredits')::integer, 0) + v_take,
                                                    'revokedReason', p_reason, 'revokedAt', now())
      where id = g.id;
      v_total := v_total + v_take;
    end if;
  end loop;
  return v_total;
end;
$$;

-- Data retention promised in the privacy notice. Returns rows touched.
create or replace function public.kz_apply_retention()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_ips integer;
  v_topics integer;
  v_events integer;
begin
  update public.quiz_generations set ip_address = null
  where ip_address is not null and created_at < now() - interval '30 days';
  get diagnostics v_ips = row_count;

  update public.quiz_generations set topic = '[removed]', error = null
  where topic <> '[removed]' and created_at < now() - interval '12 months';
  get diagnostics v_topics = row_count;

  delete from public.product_events where created_at < now() - interval '13 months';
  get diagnostics v_events = row_count;

  delete from public.quiz_cache where expires_at < now();

  return jsonb_build_object('ipsCleared', v_ips, 'topicsRemoved', v_topics, 'eventsDeleted', v_events);
end;
$$;

-- Only the backend (service role) may call these. Postgres grants EXECUTE to PUBLIC
-- by default, which would expose them through the Supabase REST API.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.kz_reserve_generation(uuid, uuid, text, text, text, text, integer, integer, timestamptz)',
    'public.kz_complete_generation(uuid, integer, integer, numeric)',
    'public.kz_release_generation(uuid, text, integer, integer, numeric)',
    'public.kz_release_stale_generations(integer)',
    'public.kz_grant_credits(uuid, text, text, integer, timestamptz, text, jsonb)',
    'public.kz_revoke_grant(text, integer, text)',
    'public.kz_apply_retention()'
  ] loop
    execute format('revoke all on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;
