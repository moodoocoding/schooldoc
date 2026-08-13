create extension if not exists pgcrypto;

create table if not exists public.student_result_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_token uuid not null default gen_random_uuid() unique,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'open' check (status in ('open', 'closed')),
  allow_confirmation boolean not null default true,
  allow_dispute boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_result_columns (
  event_id uuid not null references public.student_result_events(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  position integer not null check (position >= 0),
  label text not null check (char_length(label) between 1 and 100),
  max_score numeric not null check (max_score >= 0 and max_score <= 1000000),
  description text not null default '' check (char_length(description) <= 1000),
  primary key (event_id, id),
  unique (event_id, position)
);

create table if not exists public.student_result_recipients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.student_result_events(id) on delete cascade,
  student_key text not null check (char_length(student_key) between 1 and 100),
  name text not null check (char_length(name) between 1 and 100),
  verification_code text not null check (char_length(verification_code) between 1 and 100),
  verification_digest text not null default '',
  personal_token uuid not null default gen_random_uuid(),
  result_values jsonb not null default '{}'::jsonb check (jsonb_typeof(result_values) = 'object'),
  feedback text not null default '' check (char_length(feedback) <= 10000),
  status text not null default 'unviewed' check (status in ('unviewed', 'viewed', 'confirmed', 'disputed', 'reconfirm')),
  viewed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, student_key),
  unique (event_id, personal_token)
);

create index if not exists student_result_recipients_name_idx
  on public.student_result_recipients (event_id, lower(btrim(name)));

create table if not exists public.student_result_disputes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.student_result_events(id) on delete cascade,
  recipient_id uuid not null references public.student_result_recipients(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  submitted_at timestamptz not null default now(),
  teacher_reply text check (teacher_reply is null or char_length(teacher_reply) between 1 and 4000),
  replied_at timestamptz,
  unique (recipient_id)
);

create table if not exists public.student_result_public_sessions (
  token uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.student_result_events(id) on delete cascade,
  recipient_id uuid not null references public.student_result_recipients(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '12 hours'),
  created_at timestamptz not null default now()
);

create index if not exists student_result_public_sessions_expiry_idx
  on public.student_result_public_sessions (expires_at);

create table if not exists public.student_result_rate_limits (
  request_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (request_key, window_started_at)
);

create or replace function public.touch_student_result_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.hash_student_result_verification_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' or new.verification_code is distinct from old.verification_code then
    new.verification_digest = crypt(new.verification_code, gen_salt('bf', 10));
  end if;
  return new;
end;
$$;

drop trigger if exists student_result_events_touch_updated_at on public.student_result_events;
create trigger student_result_events_touch_updated_at
before update on public.student_result_events
for each row execute function public.touch_student_result_updated_at();

drop trigger if exists student_result_recipients_touch_updated_at on public.student_result_recipients;
create trigger student_result_recipients_touch_updated_at
before update on public.student_result_recipients
for each row execute function public.touch_student_result_updated_at();

drop trigger if exists student_result_recipients_hash_code on public.student_result_recipients;
create trigger student_result_recipients_hash_code
before insert or update of verification_code on public.student_result_recipients
for each row execute function public.hash_student_result_verification_code();

create or replace function public.verify_student_result_recipient(
  p_event_id uuid,
  p_name text,
  p_verification_code text
)
returns uuid
language sql
security definer
set search_path = public, extensions
as $$
  select id
  from public.student_result_recipients
  where event_id = p_event_id
    and lower(btrim(name)) = lower(btrim(p_name))
    and verification_digest = crypt(p_verification_code, verification_digest)
  limit 1;
$$;

create or replace function public.consume_student_result_rate_limit(
  p_request_key text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1)
  );
  v_count integer;
begin
  insert into public.student_result_rate_limits (request_key, window_started_at, request_count)
  values (p_request_key, v_window, 1)
  on conflict (request_key, window_started_at)
  do update set request_count = public.student_result_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= greatest(p_max_requests, 1);
end;
$$;

revoke all on function public.verify_student_result_recipient(uuid, text, text) from public, anon, authenticated;
revoke all on function public.consume_student_result_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.verify_student_result_recipient(uuid, text, text) to service_role;
grant execute on function public.consume_student_result_rate_limit(text, integer, integer) to service_role;

alter table public.student_result_events enable row level security;
alter table public.student_result_columns enable row level security;
alter table public.student_result_recipients enable row level security;
alter table public.student_result_disputes enable row level security;
alter table public.student_result_public_sessions enable row level security;
alter table public.student_result_rate_limits enable row level security;

create policy "Teachers manage their student result events"
on public.student_result_events for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Teachers manage their student result columns"
on public.student_result_columns for all to authenticated
using (exists (
  select 1 from public.student_result_events e where e.id = event_id and e.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.student_result_events e where e.id = event_id and e.owner_id = auth.uid()
));

create policy "Teachers manage their student result recipients"
on public.student_result_recipients for all to authenticated
using (exists (
  select 1 from public.student_result_events e where e.id = event_id and e.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.student_result_events e where e.id = event_id and e.owner_id = auth.uid()
));

create policy "Teachers manage their student result disputes"
on public.student_result_disputes for all to authenticated
using (exists (
  select 1 from public.student_result_events e where e.id = event_id and e.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.student_result_events e where e.id = event_id and e.owner_id = auth.uid()
));

do $$
begin
  alter publication supabase_realtime add table public.student_result_events;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.student_result_recipients;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.student_result_disputes;
exception when duplicate_object then null;
end $$;
