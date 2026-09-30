-- A mission lives inside one encrypted board payload. Delete the old board row
-- and insert the scrubbed state under the same ID so the removed ciphertext is
-- not kept in the current table row. Both steps and the audit commit atomically.
create or replace function public.commit_class_mission_purge(
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
declare
  old_board public.class_mission_boards%rowtype;
begin
  if p_target_count < 0 or p_check_count < 0 or p_event_count < 0 or
     p_encrypted_payload is null or p_encrypted_payload = '' then
    raise exception 'invalid purge request';
  end if;

  delete from public.class_mission_boards
   where id = p_board_id and owner_id = p_owner_id and version = p_expected_version
   returning * into old_board;
  if not found then return false; end if;

  insert into public.class_mission_boards
    (id, owner_id, public_token, public_enabled, encrypted_payload, version, created_at, updated_at)
  values
    (old_board.id, old_board.owner_id,
     case when p_clear_roster then gen_random_uuid() else old_board.public_token end,
     case when p_clear_roster then false else old_board.public_enabled end,
     p_encrypted_payload, old_board.version + 1, old_board.created_at, now());

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
