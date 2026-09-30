-- Names, access-code hashes, mission target snapshots and check history are
-- encrypted together by the Edge Function. No browser role can read the row.
create table public.class_mission_boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  public_enabled boolean not null default true,
  encrypted_payload text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index class_mission_boards_owner on public.class_mission_boards(owner_id);
alter table public.class_mission_boards enable row level security;
revoke all on public.class_mission_boards from anon, authenticated;
grant all on public.class_mission_boards to service_role;

-- All reads/writes go through class-missions-admin/public, which authenticate
-- the teacher or verify the public token and individual student code.
