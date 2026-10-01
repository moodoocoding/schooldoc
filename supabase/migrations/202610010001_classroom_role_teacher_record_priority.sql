-- Student self-reports cannot overwrite a teacher's corrected result.
-- The board lock serializes concurrent student and teacher writes. A teacher
-- can set the value back to missing to reopen student input for that day.
create or replace function public.write_classroom_role_record(
  p_board_id uuid, p_version integer, p_period_id uuid, p_student_id uuid,
  p_date date, p_status text, p_source text
)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_version integer;
begin
  select version into current_version
    from public.classroom_role_boards where id = p_board_id for update;
  if current_version is null or current_version <> p_version then return false; end if;
  if p_source = 'student' and exists (
    select 1 from public.classroom_role_records
    where board_id = p_board_id and period_id = p_period_id
      and student_id = p_student_id and record_date = p_date
      and source = 'teacher'
  ) then
    return false;
  end if;
  if p_status = 'missing' and p_source = 'teacher' then
    delete from public.classroom_role_records
      where board_id = p_board_id and period_id = p_period_id
        and student_id = p_student_id and record_date = p_date;
  else
    insert into public.classroom_role_records(board_id, period_id, student_id, record_date, status, source)
    values(p_board_id, p_period_id, p_student_id, p_date, p_status, p_source)
    on conflict(board_id, period_id, student_id, record_date)
    do update set status = excluded.status, source = excluded.source, updated_at = now();
  end if;
  return true;
end;
$$;
revoke all on function public.write_classroom_role_record(uuid, integer, uuid, uuid, date, text, text)
  from public, anon, authenticated;
grant execute on function public.write_classroom_role_record(uuid, integer, uuid, uuid, date, text, text)
  to service_role;
