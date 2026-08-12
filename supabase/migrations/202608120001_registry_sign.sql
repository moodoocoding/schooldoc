create extension if not exists pgcrypto;

create table if not exists public.registries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_token uuid not null default gen_random_uuid() unique,
  mode text not null check (mode in ('fixed', 'custom')),
  title text not null check (char_length(title) between 1 and 200),
  left_header text not null default '',
  right_header text not null default '',
  layout smallint not null default 10 check (layout in (10, 15, 20, 30)),
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  allow_walk_in boolean not null default false,
  password_digest text,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registry_columns (
  id uuid primary key default gen_random_uuid(),
  registry_id uuid not null references public.registries(id) on delete cascade,
  key text not null,
  label text not null check (char_length(label) between 1 and 50),
  type text not null default 'text' check (type = 'text'),
  required boolean not null default false,
  position smallint not null check (position between 0 and 3),
  unique (registry_id, key),
  unique (registry_id, position)
);

create table if not exists public.registry_participants (
  id uuid primary key default gen_random_uuid(),
  registry_id uuid not null references public.registries(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  name text not null check (char_length(name) between 1 and 100),
  field_values jsonb not null default '{}'::jsonb,
  verification_digest text,
  status text not null default 'pending' check (status in ('pending', 'signed')),
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registry_id, row_number)
);

create table if not exists public.registry_signatures (
  id uuid primary key default gen_random_uuid(),
  registry_id uuid not null references public.registries(id) on delete cascade,
  participant_id uuid not null references public.registry_participants(id) on delete cascade unique,
  source text not null check (source in ('draw', 'photo')),
  storage_path text not null unique,
  content_hash text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  consent_version text not null default 'v1',
  created_at timestamptz not null default now()
);

create index if not exists registries_owner_updated_idx on public.registries(owner_id, updated_at desc);
create index if not exists registry_participants_registry_name_idx on public.registry_participants(registry_id, name);
create index if not exists registry_signatures_registry_idx on public.registry_signatures(registry_id);

create or replace function public.set_registry_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists registries_set_updated_at on public.registries;
create trigger registries_set_updated_at
before update on public.registries
for each row execute function public.set_registry_updated_at();

drop trigger if exists registry_participants_set_updated_at on public.registry_participants;
create trigger registry_participants_set_updated_at
before update on public.registry_participants
for each row execute function public.set_registry_updated_at();

alter table public.registries enable row level security;
alter table public.registry_columns enable row level security;
alter table public.registry_participants enable row level security;
alter table public.registry_signatures enable row level security;

create policy "owners manage registries"
on public.registries for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners manage registry columns"
on public.registry_columns for all
to authenticated
using (exists (
  select 1 from public.registries
  where registries.id = registry_columns.registry_id
    and registries.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.registries
  where registries.id = registry_columns.registry_id
    and registries.owner_id = auth.uid()
));

create policy "owners manage registry participants"
on public.registry_participants for all
to authenticated
using (exists (
  select 1 from public.registries
  where registries.id = registry_participants.registry_id
    and registries.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.registries
  where registries.id = registry_participants.registry_id
    and registries.owner_id = auth.uid()
));

create policy "owners manage registry signatures"
on public.registry_signatures for all
to authenticated
using (exists (
  select 1 from public.registries
  where registries.id = registry_signatures.registry_id
    and registries.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.registries
  where registries.id = registry_signatures.registry_id
    and registries.owner_id = auth.uid()
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'registry-signatures',
  'registry-signatures',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "owners read registry signature files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'registry-signatures'
  and exists (
    select 1 from public.registries
    where registries.id::text = (storage.foldername(name))[1]
      and registries.owner_id = auth.uid()
  )
);

create policy "owners upload registry signature files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'registry-signatures'
  and exists (
    select 1 from public.registries
    where registries.id::text = (storage.foldername(name))[1]
      and registries.owner_id = auth.uid()
  )
);

create policy "owners delete registry signature files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'registry-signatures'
  and exists (
    select 1 from public.registries
    where registries.id::text = (storage.foldername(name))[1]
      and registries.owner_id = auth.uid()
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'registry_participants'
  ) then
    alter publication supabase_realtime add table public.registry_participants;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'registry_signatures'
  ) then
    alter publication supabase_realtime add table public.registry_signatures;
  end if;
end;
$$;
