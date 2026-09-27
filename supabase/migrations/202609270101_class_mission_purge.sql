-- Audit contains only opaque identifiers, counts and a retry reason code.
-- Student names, mission titles, access codes and encrypted payloads never enter this table.
create table public.class_mission_purge_audit (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null,
  mission_id uuid not null,
  status text not null check (status in ('completed', 'retry', 'resolved')),
  target_count integer not null check (target_count >= 0),
  check_count integer not null check (check_count >= 0),
  event_count integer not null check (event_count >= 0),
  reason_code text check (reason_code in ('commit_failed')),
  created_at timestamptz not null default now()
);
create index class_mission_purge_audit_retry on public.class_mission_purge_audit(status, created_at)
  where status = 'retry';
alter table public.class_mission_purge_audit enable row level security;
revoke all on public.class_mission_purge_audit from anon, authenticated;
grant all on public.class_mission_purge_audit to service_role;

-- The encrypted state replacement and completed audit are one database transaction.
-- Eligibility and count checks happen in the authenticated Edge Function before this call.
create function public.commit_class_mission_purge(
  p_board_id uuid,
  p_owner_id uuid,
  p_expected_version integer,
  p_mission_id uuid,
  p_encrypted_payload text,
  p_target_count integer,
  p_check_count integer,
  p_event_count integer,
  p_clear_roster boolean
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_target_count < 0 or p_check_count < 0 or p_event_count < 0 or
     p_encrypted_payload is null or p_encrypted_payload = '' then
    raise exception 'invalid purge request';
  end if;

  update public.class_mission_boards
     set encrypted_payload = p_encrypted_payload,
         version = version + 1,
         updated_at = now(),
         public_token = case when p_clear_roster then gen_random_uuid() else public_token end,
         public_enabled = case when p_clear_roster then false else public_enabled end
   where id = p_board_id and owner_id = p_owner_id and version = p_expected_version;
  if not found then return false; end if;

  update public.class_mission_purge_audit
     set status = 'resolved'
   where board_id = p_board_id and mission_id = p_mission_id and status = 'retry';

  insert into public.class_mission_purge_audit
    (board_id, mission_id, status, target_count, check_count, event_count)
  values (p_board_id, p_mission_id, 'completed', p_target_count, p_check_count, p_event_count);
  return true;
end;
$$;
revoke all on function public.commit_class_mission_purge(uuid, uuid, integer, uuid, text, integer, integer, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.commit_class_mission_purge(uuid, uuid, integer, uuid, text, integer, integer, integer, boolean)
  to service_role;
