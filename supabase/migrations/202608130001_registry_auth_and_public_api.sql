create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_student_id text := nullif(trim(new.raw_user_meta_data->>'student_id'), '');
  new_student_name text := nullif(trim(new.raw_user_meta_data->>'name'), '');
begin
  if new_student_id is not null and new_student_name is not null then
    insert into public.students (id, student_id, name)
    values (new.id, new_student_id, new_student_name)
    on conflict (id) do update set
      student_id = excluded.student_id,
      name = excluded.name;
  end if;

  return new;
end;
$$;

create or replace function public.set_registry_password(
  p_registry_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.registries
  set password_digest = case
    when nullif(trim(p_password), '') is null then null
    else crypt(p_password, gen_salt('bf'))
  end
  where id = p_registry_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'Registry not found or access denied';
  end if;
end;
$$;

revoke all on function public.set_registry_password(uuid, text) from public;
grant execute on function public.set_registry_password(uuid, text) to authenticated;

create or replace function public.verify_registry_password(
  p_registry_id uuid,
  p_password text
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (
      select password_digest is null
        or (
          p_password is not null
          and password_digest = crypt(p_password, password_digest)
        )
      from public.registries
      where id = p_registry_id
    ),
    false
  );
$$;

revoke all on function public.verify_registry_password(uuid, text) from public;
grant execute on function public.verify_registry_password(uuid, text) to service_role;

create or replace function public.validate_registry_signature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_registry_id uuid;
begin
  select registry_id
  into participant_registry_id
  from public.registry_participants
  where id = new.participant_id;

  if participant_registry_id is null or participant_registry_id <> new.registry_id then
    raise exception 'Signature participant does not belong to registry';
  end if;

  return new;
end;
$$;

drop trigger if exists registry_signatures_validate_participant on public.registry_signatures;
create trigger registry_signatures_validate_participant
before insert or update on public.registry_signatures
for each row execute function public.validate_registry_signature();

create or replace function public.sync_registry_signature_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.registry_participants
    set status = 'pending', signed_at = null
    where id = old.participant_id;
    return old;
  end if;

  update public.registry_participants
  set status = 'signed', signed_at = new.created_at
  where id = new.participant_id;
  return new;
end;
$$;

drop trigger if exists registry_signatures_sync_status on public.registry_signatures;
create trigger registry_signatures_sync_status
after insert or delete on public.registry_signatures
for each row execute function public.sync_registry_signature_status();

create or replace function public.create_registry_walk_in(
  p_registry_id uuid,
  p_name text,
  p_field_values jsonb default '{}'::jsonb
)
returns public.registry_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  created_participant public.registry_participants;
  next_row_number integer;
begin
  if nullif(trim(p_name), '') is null then
    raise exception 'Participant name is required';
  end if;

  if not exists (
    select 1
    from public.registries
    where id = p_registry_id
      and status = 'open'
      and allow_walk_in = true
  ) then
    raise exception 'Registry is not accepting walk-in participants';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_registry_id::text, 0));

  select coalesce(max(row_number), 0) + 1
  into next_row_number
  from public.registry_participants
  where registry_id = p_registry_id;

  insert into public.registry_participants (
    registry_id,
    row_number,
    name,
    field_values
  )
  values (
    p_registry_id,
    next_row_number,
    trim(p_name),
    coalesce(p_field_values, '{}'::jsonb)
  )
  returning * into created_participant;

  return created_participant;
end;
$$;

revoke all on function public.create_registry_walk_in(uuid, text, jsonb) from public;
grant execute on function public.create_registry_walk_in(uuid, text, jsonb) to service_role;

create or replace function public.search_registry_participants(
  p_registry_id uuid,
  p_query text,
  p_limit integer default 10
)
returns table (
  id uuid,
  row_number integer,
  name text,
  field_values jsonb,
  status text,
  signed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    participant.id,
    participant.row_number,
    participant.name,
    participant.field_values,
    participant.status,
    participant.signed_at
  from public.registry_participants as participant
  where participant.registry_id = p_registry_id
    and (
      participant.name ilike '%' || replace(replace(replace(p_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
      or participant.field_values::text ilike '%' || replace(replace(replace(p_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
    )
  order by participant.row_number
  limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.search_registry_participants(uuid, text, integer) from public;
grant execute on function public.search_registry_participants(uuid, text, integer) to service_role;

create table if not exists public.registry_public_rate_limits (
  request_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.registry_public_rate_limits enable row level security;

create or replace function public.consume_registry_rate_limit(
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
  current_count integer;
begin
  if p_window_seconds < 1 or p_max_requests < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;

  insert into public.registry_public_rate_limits (
    request_key,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_request_key, now(), 1, now())
  on conflict (request_key) do update set
    window_started_at = case
      when registry_public_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then now()
      else registry_public_rate_limits.window_started_at
    end,
    request_count = case
      when registry_public_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then 1
      else registry_public_rate_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count into current_count;

  return current_count <= p_max_requests;
end;
$$;

revoke all on table public.registry_public_rate_limits from anon, authenticated;
revoke all on function public.consume_registry_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_registry_rate_limit(text, integer, integer) to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['registries', 'registry_columns']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end;
$$;
