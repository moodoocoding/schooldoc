-- 진행 중인 업무 화면용 경량 요약.
--
-- 각 기능의 기존 목록 API는 관리 화면을 위해 학생 결과 암호문을 복호화하고 파일의
-- signed URL까지 만든다. 진행 업무에는 제목·상태·건수만 필요하므로 그 경로를 재사용하지
-- 않는다. 한 RPC 안에서 소유자의 열린 업무만 집계해 개인정보나 파일 경로를 반환하지 않는다.

create or replace function public.get_active_work_summary()
returns table (
  tool_id text,
  item_id uuid,
  title text,
  mode text,
  done_count bigint,
  total_count bigint,
  issue_count bigint,
  due_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    'registry-sign'::text as tool_id,
    registry.id as item_id,
    registry.title,
    null::text as mode,
    (select count(*) from public.registry_signatures as signature where signature.registry_id = registry.id) as done_count,
    (select count(*) from public.registry_participants as participant where participant.registry_id = registry.id) as total_count,
    0::bigint as issue_count,
    null::timestamptz as due_at,
    registry.updated_at
  from public.registries as registry
  where registry.owner_id = auth.uid()
    and registry.status = 'open'

  union all

  select
    'student-lookup'::text,
    event.id,
    event.title,
    null::text,
    (select count(*) from public.student_result_recipients as recipient where recipient.event_id = event.id and recipient.status = 'confirmed'),
    (select count(*) from public.student_result_recipients as recipient where recipient.event_id = event.id),
    (select count(*) from public.student_result_recipients as recipient where recipient.event_id = event.id and recipient.status = 'disputed'),
    null::timestamptz,
    event.updated_at
  from public.student_result_events as event
  where event.owner_id = auth.uid()
    and event.status = 'open'

  union all

  select
    'notice-collect'::text,
    form.id,
    form.title,
    form.recipient_mode,
    form.response_count::bigint,
    form.recipient_count::bigint,
    0::bigint,
    form.deadline::timestamptz,
    form.updated_at
  from public.consent_forms as form
  where form.owner_id = auth.uid()
    and form.status = 'open'

  union all

  select
    'data-collect'::text,
    collection.id,
    collection.title,
    collection.mode,
    (
      select case
        when collection.mode = 'fixed' then count(distinct file.target_id)
        else count(*) filter (where file.is_current)
      end
      from public.data_collection_files as file
      where file.collection_id = collection.id
    ) as done_count,
    (select count(*) from public.data_collection_targets as target where target.collection_id = collection.id) as total_count,
    0::bigint,
    collection.due_at,
    collection.updated_at
  from public.data_collections as collection
  where collection.owner_id = auth.uid()
    and collection.status = 'open'

  union all

  select
    'special-room'::text,
    board.id,
    board.title,
    null::text,
    (select count(*) from public.special_room_bookings as booking where booking.board_id = board.id),
    (select count(*) from public.special_rooms as room where room.board_id = board.id),
    0::bigint,
    null::timestamptz,
    board.updated_at
  from public.special_room_boards as board
  where board.owner_id = auth.uid()
    and board.status = 'open';
$$;

revoke all on function public.get_active_work_summary() from public;
revoke all on function public.get_active_work_summary() from anon;
grant execute on function public.get_active_work_summary() to authenticated;
