-- Supabase/Postgres schema for authenticated AI quiz generation and billing.
-- Run this in Supabase SQL editor before enabling paid GPT generation.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null,
  source_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_id, reason)
);

create table if not exists public.quiz_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  ip_address text,
  topic text not null,
  language text not null,
  model text not null,
  source text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  status text not null check (status in ('reserved', 'succeeded', 'failed', 'refunded')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  tier text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  stripe_object_id text,
  user_id uuid references public.profiles(id) on delete set null,
  amount_total integer,
  currency text,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_cache (
  cache_key text primary key,
  topic text not null,
  language text not null,
  model text not null,
  quiz jsonb not null,
  source text not null default 'openai',
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_ledger_user_created_idx on public.usage_ledger(user_id, created_at desc);
create index if not exists quiz_generations_user_created_idx on public.quiz_generations(user_id, created_at desc);
create index if not exists quiz_generations_user_status_created_idx on public.quiz_generations(user_id, status, created_at desc);
create index if not exists quiz_cache_expires_idx on public.quiz_cache(expires_at);

alter table public.quiz_generations
  add column if not exists ip_address text;

create index if not exists quiz_generations_ip_status_created_idx on public.quiz_generations(ip_address, status, created_at desc);

alter table public.profiles enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.quiz_generations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.quiz_cache enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "usage_ledger_select_own" on public.usage_ledger
  for select using (auth.uid() = user_id);

create policy "quiz_generations_select_own" on public.quiz_generations
  for select using (auth.uid() = user_id);

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);
