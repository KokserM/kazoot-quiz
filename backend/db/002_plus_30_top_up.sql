-- Optional one-time backfill for the Plus plan change to 30 AI games/month.
--
-- Run this only if production users already received a current Plus subscription
-- grant with fewer than 30 original credits and reliable metadata.planId = 'plus_monthly'.
-- The script is idempotent and tops each eligible grant up to exactly 30 original credits.

update public.credit_grants
set
  remaining_credits = coalesce(remaining_credits, 0) + (30 - original_credits),
  original_credits = 30,
  metadata = metadata || jsonb_build_object(
    'plus_30_top_up_applied', true,
    'plus_30_top_up_credits', 30 - original_credits,
    'plus_30_top_up_applied_at', now()
  )
where grant_type = 'subscription'
  and original_credits < 30
  and coalesce(remaining_credits, 0) >= 0
  and (expires_at is null or expires_at > now())
  and metadata->>'planId' = 'plus_monthly'
  and coalesce((metadata->>'plus_30_top_up_applied')::boolean, false) = false;
