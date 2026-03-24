create extension if not exists pgcrypto;

create table if not exists public.driver_licenses (
  license_id text primary key,
  driver_name text not null,
  business_name text,
  status text not null default 'active' check (status in ('active', 'grace', 'expired', 'suspended')),
  paid_until date,
  grace_until date,
  bound_install_id text,
  device_fingerprint text,
  notes text,
  last_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.license_verification_log (
  id uuid primary key default gen_random_uuid(),
  license_id text not null references public.driver_licenses(license_id) on delete cascade,
  install_id text,
  device_fingerprint text,
  result_status text not null,
  verified_at timestamptz not null default timezone('utc', now()),
  notes text
);

create index if not exists driver_licenses_paid_until_idx
  on public.driver_licenses (paid_until);

create index if not exists driver_licenses_bound_install_id_idx
  on public.driver_licenses (bound_install_id);

create index if not exists license_verification_log_license_id_idx
  on public.license_verification_log (license_id, verified_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists driver_licenses_touch_updated_at on public.driver_licenses;

create trigger driver_licenses_touch_updated_at
before update on public.driver_licenses
for each row
execute function public.touch_updated_at();

alter table public.driver_licenses enable row level security;
alter table public.license_verification_log enable row level security;
