-- Keep period edits and deletions atomic with student/teacher record writes.
-- A changed range may not leave existing records outside that period; deleting
-- a period is allowed only while it has no records. The Edge Function validates
-- and encrypts the complete next state before calling this service-only RPC.
create function public.update_classroom_role_period(
  p_board_id uuid,
  p_owner_id uuid,
  p_version integer,
  p_encrypted_payload text,
  p_period_id uuid,
  p_start date,
  p_end date
)
returns text language plpgsql security definer set search_path = public as $$
declare current_version integer;
begin
  select version into current_version
    from public.classroom_role_boards
    where id = p_board_id and owner_id = p_owner_id
    for update;
  if current_version is null or current_version <> p_version then
    return 'conflict';
  end if;
  if (p_start is null) <> (p_end is null) or
     (p_start is not null and p_start > p_end) then
    return 'invalid';
  end if;
  if exists (
    select 1 from public.classroom_role_records
    where board_id = p_board_id and period_id = p_period_id
      and (p_start is null or record_date < p_start or record_date > p_end)
  ) then
    return 'record_conflict';
  end if;
  update public.classroom_role_boards
    set encrypted_payload = p_encrypted_payload,
        version = version + 1,
        updated_at = now()
    where id = p_board_id and owner_id = p_owner_id;
  return 'updated';
end;
$$;

revoke all on function public.update_classroom_role_period(uuid, uuid, integer, text, uuid, date, date) from public, anon, authenticated;
grant execute on function public.update_classroom_role_period(uuid, uuid, integer, text, uuid, date, date) to service_role;
