create extension if not exists "pgcrypto";

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  units int not null,
  market text not null,
  city text,
  state text not null,
  hopa_qualified boolean not null default false,
  cohort text not null default 'pilot' check (cohort in ('pilot', 'control')),
  avg_rent int,
  vacant_units int,
  baseline jsonb not null default '{}'::jsonb,
  current jsonb not null default '{}'::jsonb
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  agent_name text not null,
  platform text not null check (platform in ('instagram', 'tiktok', 'facebook')),
  body text not null,
  score int not null check (score >= 0 and score <= 100),
  status text not null check (status in ('cleared', 'needs_review', 'blocked')),
  published boolean not null default false,
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  prospect_name text not null,
  source text not null check (source in ('instagram', 'tiktok', 'facebook')),
  interaction_type text not null check (interaction_type in ('dm', 'comment', 'click', 'form_fill')),
  message text not null,
  stage text not null check (stage in ('new', 'contacted', 'toured', 'leased', 'lost')) default 'new',
  stage_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table properties enable row level security;
alter table posts enable row level security;
alter table leads enable row level security;

create policy "prototype properties read" on properties for select using (true);
create policy "prototype properties insert" on properties for insert with check (true);

create policy "prototype posts read" on posts for select using (true);
create policy "prototype posts insert" on posts for insert with check (true);

create policy "prototype leads read" on leads for select using (true);
create policy "prototype leads insert" on leads for insert with check (true);
create policy "prototype leads update" on leads for update using (true) with check (true);
