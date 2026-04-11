-- ============================================================
-- Household Finance App — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Households table
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text default 'Our Household',
  join_code text unique not null,
  created_at timestamptz default now()
);

-- 2. Profiles (one per user, linked to household)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references households(id) on delete set null,
  display_name text,
  created_at timestamptz default now()
);

-- 3. Transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  date date not null,
  description text not null,
  amount numeric(10,2) not null,
  account text,
  category text,
  created_at timestamptz default now()
);
create index if not exists idx_txn_household on transactions(household_id);
create index if not exists idx_txn_date on transactions(date);

-- 4. Baseline targets (one row per category per household)
create table if not exists baseline (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  category text not null,
  amount numeric(10,2) not null,
  updated_at timestamptz default now(),
  unique(household_id, category)
);

-- 5. Bills planner
create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  name text not null,
  amount numeric(10,2) not null,
  expected_month text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table households enable row level security;
alter table profiles enable row level security;
alter table transactions enable row level security;
alter table baseline enable row level security;
alter table bills enable row level security;

-- Households: users can only see their own household
create policy "users see own household" on households
  for all using (
    id in (select household_id from profiles where id = auth.uid())
  );

-- Profiles: users can see/edit their own profile
create policy "users manage own profile" on profiles
  for all using (id = auth.uid());

-- Also allow users to see other profiles in same household (for display)
create policy "users see household members" on profiles
  for select using (
    household_id in (select household_id from profiles where id = auth.uid())
  );

-- Transactions: users can only access their household's data
create policy "household transactions" on transactions
  for all using (
    household_id in (select household_id from profiles where id = auth.uid())
  );

-- Baseline: same
create policy "household baseline" on baseline
  for all using (
    household_id in (select household_id from profiles where id = auth.uid())
  );

-- Bills: same
create policy "household bills" on bills
  for all using (
    household_id in (select household_id from profiles where id = auth.uid())
  );

-- ============================================================
-- Helper function: create household + profile for new user
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
