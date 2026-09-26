-- Names and role/period snapshots are encrypted by the Edge Function.
create table public.classroom_role_boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  encrypted_payload text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.classroom_role_records (
  board_id uuid not null references public.classroom_role_boards(id) on delete cascade,
  period_id uuid not null,
  student_id uuid not null,
  record_date date not null,
  status text not null check (status in ('done', 'not_done', 'exempt')),
  source text not null check (source in ('student', 'teacher')),
  updated_at timestamptz not null default now(),
  primary key (board_id, period_id, student_id, record_date)
);
create index classroom_role_records_date on public.classroom_role_records(board_id, record_date);
alter table public.classroom_role_boards enable row level security;
alter table public.classroom_role_records enable row level security;
revoke all on public.classroom_role_boards, public.classroom_role_records from anon, authenticated;
grant select on public.classroom_role_boards, public.classroom_role_records to authenticated;
grant all on public.classroom_role_boards, public.classroom_role_records to service_role;
create policy classroom_role_owner_read on public.classroom_role_boards for select to authenticated using (owner_id = (select auth.uid()));
create policy classroom_role_record_owner_read on public.classroom_role_records for select to authenticated using (exists (select 1 from public.classroom_role_boards b where b.id = board_id and b.owner_id = (select auth.uid())));

-- Service-only, after endpoint validation. A row lock prevents a config/token change
-- between authorization and the record write. Duplicate submissions update one row.
create function public.write_classroom_role_record(p_board_id uuid, p_version integer, p_period_id uuid, p_student_id uuid, p_date date, p_status text, p_source text)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_version integer;
begin
  select version into current_version from public.classroom_role_boards where id = p_board_id for update;
  if current_version is null or current_version <> p_version then return false; end if;
  if p_status = 'missing' and p_source = 'teacher' then
    delete from public.classroom_role_records where board_id = p_board_id and period_id = p_period_id and student_id = p_student_id and record_date = p_date;
  else
    insert into public.classroom_role_records(board_id, period_id, student_id, record_date, status, source)
    values(p_board_id, p_period_id, p_student_id, p_date, p_status, p_source)
    on conflict(board_id, period_id, student_id, record_date) do update set status = excluded.status, source = excluded.source, updated_at = now();
  end if;
  return true;
end;
$$;
revoke all on function public.write_classroom_role_record(uuid, integer, uuid, uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.write_classroom_role_record(uuid, integer, uuid, uuid, date, text, text) to service_role;
