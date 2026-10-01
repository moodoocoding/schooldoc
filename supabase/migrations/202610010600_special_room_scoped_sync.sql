-- 선택 실/주 조회, 버전 충돌 검사, 최소 변경 Broadcast.
-- 기존 예약·숨겨진 교시·토요일 자료는 삭제하지 않는다.
alter table public.special_room_boards
  add column metadata_revision bigint not null default 1,
  add column calendar_revision bigint not null default 1,
  add column access_epoch bigint not null default 1;
alter table public.special_room_bookings add column revision bigint not null default 1, add column last_operation_id uuid;
alter table public.special_room_school_days add column source_office text, add column source_school text;
update public.special_room_school_days d set source_office=b.neis_office_code,source_school=b.neis_school_code from public.special_room_boards b where b.id=d.board_id;
create table public.special_room_week_state (
  room_id uuid not null references public.special_rooms(id) on delete cascade,
  week_start date not null, revision bigint not null default 0,
  primary key(room_id, week_start), check(extract(isodow from week_start)=1)
);
alter table public.special_room_week_state enable row level security;
create table public.special_room_repeat_operations (
  board_id uuid not null references public.special_room_boards(id) on delete cascade,
  operation_id uuid not null, fingerprint jsonb not null, result jsonb not null,
  expires_at timestamptz not null default now()+interval '1 day',
  primary key(board_id, operation_id)
);
alter table public.special_room_repeat_operations enable row level security;
revoke all on public.special_room_week_state, public.special_room_repeat_operations from anon, authenticated;

create function public.special_room_booking_dto(b public.special_room_bookings) returns jsonb
language sql immutable set search_path=public as $$
  select jsonb_build_object('id',b.id,'roomId',b.room_id,'date',b.booking_date,
    'period',b.period,'label',b.label,'updatedAt',b.updated_at,'revision',b.revision)
$$;

create function public.special_room_snapshot(p_board uuid, p_room uuid, p_week date, p_known jsonb default '{}', p_owner boolean default false)
returns jsonb language sql stable security definer set search_path=public as $$
with b as (select * from special_room_boards where id=p_board),
r as (select * from special_rooms where board_id=p_board and (id=p_room or p_room is null) order by position limit 1),
v as (select coalesce((select revision from special_room_week_state where room_id=(select id from r) and week_start=p_week),0) as rev),
s as (select coalesce((p_known->>'scopeRevision')::bigint=-1,false)
  or not (coalesce((p_known->>'scopeRevision')::bigint,-1)=v.rev
    and coalesce((p_known->>'metadataRevision')::bigint,-1)=b.metadata_revision
    and coalesce((p_known->>'calendarRevision')::bigint,-1)=b.calendar_revision) as changed from b,v)
select jsonb_build_object('unchanged', not s.changed, 'board', jsonb_build_object(
  'id',b.id,'publicToken',b.public_token,'title',b.title,'description',b.description,
  'periodCount',b.period_count,'includeSaturday',b.include_saturday,'schoolName',coalesce(b.school_name,''),
  'status',b.status,'isPasswordProtected',b.password_digest is not null,
  'metadataRevision',b.metadata_revision,'calendarRevision',b.calendar_revision,'accessEpoch',b.access_epoch,
  'scopeRevision',v.rev,'selectedRoomId',(select id from r),'weekStart',p_week,
  'createdAt',b.created_at,'updatedAt',b.updated_at,
  'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',id,'position',position,'name',name,'location',location) order by position) from special_rooms where board_id=b.id),'[]'),
  'termEndDate',coalesce((select (min(day)-1)::text from special_room_school_days where board_id=b.id and source_office=b.neis_office_code and source_school=b.neis_school_code and day>(now() at time zone 'Asia/Seoul')::date and event_name like '%방학%'),''),
  'bookings',case when s.changed then coalesce((select jsonb_agg(special_room_booking_dto(x) order by booking_date,period) from special_room_bookings x where room_id=(select id from r) and booking_date between p_week and p_week+5),'[]') else null end,
  'schoolDays',case when s.changed then coalesce((select jsonb_agg(jsonb_build_object('date',day,'eventName',event_name,'isOffDay',is_off_day)) from special_room_school_days where board_id=b.id and source_office=b.neis_office_code and source_school=b.neis_school_code and day between p_week and p_week+5),'[]') else null end,
  'closures',case when s.changed then coalesce((select jsonb_agg(jsonb_build_object('id',id,'roomId',coalesce(room_id::text,''),'startDate',start_date,'endDate',end_date,'reason',reason)) from special_room_closures where board_id=b.id and (room_id is null or room_id=(select id from r)) and start_date<=p_week+5 and end_date>=p_week),'[]') else null end,
  'closureCount',case when p_owner then (select count(*) from special_room_closures where board_id=b.id) else null end,
  'thisWeekBookingCount',case when p_owner then (select count(*) from special_room_bookings where board_id=b.id and booking_date between date_trunc('week',(now() at time zone 'Asia/Seoul')+case when extract(isodow from now() at time zone 'Asia/Seoul')=7 then interval '1 day' else interval '0 day' end)::date and date_trunc('week',(now() at time zone 'Asia/Seoul')+case when extract(isodow from now() at time zone 'Asia/Seoul')=7 then interval '1 day' else interval '0 day' end)::date+case when b.include_saturday then 5 else 4 end) else null end
)) from b,v,s
$$;
revoke all on function public.special_room_snapshot(uuid,uuid,date,jsonb,boolean) from public,anon,authenticated;

-- 공개 쓰기와 기존 service 경로 모두 같은 부모→셀 잠금 순서를 따른다.
create function public.guard_special_room_booking() returns trigger language plpgsql security definer set search_path=public as $$
declare b special_room_boards;
begin
  if current_setting('role',true)='service_role' and coalesce(current_setting('special_rooms.operation_id',true),'')='' then raise exception 'client update required'; end if;
  if TG_OP='UPDATE' and (new.board_id,new.room_id,new.booking_date,new.period) is distinct from (old.board_id,old.room_id,old.booking_date,old.period) then
    raise exception 'booking coordinates are immutable';
  end if;
  select * into b from special_room_boards where id=coalesce(new.board_id,old.board_id) for share;
  if not found then return coalesce(new,old); end if; -- parent cascade
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.room_id,old.room_id)::text||coalesce(new.booking_date,old.booking_date)::text||coalesce(new.period,old.period)::text,0));
  if TG_OP='DELETE' then return old; end if;
  if not exists(select 1 from special_rooms where id=new.room_id and board_id=new.board_id) then raise exception 'room board mismatch'; end if;
  if TG_OP='UPDATE' and new.label=old.label then return null; end if;
  new.last_operation_id:=nullif(current_setting('special_rooms.operation_id',true),'')::uuid;
  new.revision:=case when TG_OP='UPDATE' then old.revision+1 else 1 end;
  return new;
end $$;
create trigger special_room_booking_guard before insert or update or delete on public.special_room_bookings
for each row execute function public.guard_special_room_booking();

create function public.publish_special_room_booking_changes() returns trigger language plpgsql security definer set search_path=public,realtime as $$
declare g record; q text; rev bigint; epoch bigint;
begin
  q:=case TG_OP when 'INSERT' then 'select board_id, room_id, date_trunc(''week'',booking_date)::date w from new_rows'
    when 'DELETE' then 'select board_id, room_id, date_trunc(''week'',booking_date)::date w from old_rows'
    else 'select board_id,room_id,date_trunc(''week'',booking_date)::date w from new_rows union select board_id,room_id,date_trunc(''week'',booking_date)::date w from old_rows' end;
  for g in execute 'select distinct board_id,room_id,w from ('||q||') a order by room_id,w' loop
    -- cascade 삭제는 이미 사라진 부모의 알림·상태를 만들지 않는다.
    select access_epoch into epoch from special_room_boards where id=g.board_id;
    if not found or not exists(select 1 from special_rooms where id=g.room_id) then continue; end if;
    insert into special_room_week_state(room_id,week_start,revision) values(g.room_id,g.w,1)
    on conflict(room_id,week_start) do update set revision=special_room_week_state.revision+1 returning revision into rev;
    if TG_OP='DELETE' then
      execute 'select coalesce(jsonb_agg(id),''[]'') from old_rows where room_id=$1 and booking_date between $2 and $2+5' into q using g.room_id,g.w;
      perform realtime.send(jsonb_build_object('eventId',gen_random_uuid(),'operationId',current_setting('special_rooms.operation_id',true),'scopeRevision',rev,'roomId',g.room_id,'weekStart',g.w,'upserts','[]'::jsonb,'deletedIds',q::jsonb),'cells','sr:'||g.board_id||':'||epoch||':week:'||g.room_id||':'||g.w,true);
    else
      execute 'select coalesce(jsonb_agg(public.special_room_booking_dto(n)),''[]'') from new_rows n where room_id=$1 and booking_date between $2 and $2+5' into q using g.room_id,g.w;
      perform realtime.send(jsonb_build_object('eventId',gen_random_uuid(),'operationId',current_setting('special_rooms.operation_id',true),'scopeRevision',rev,'roomId',g.room_id,'weekStart',g.w,'upserts',q::jsonb,'deletedIds','[]'::jsonb),'cells','sr:'||g.board_id||':'||epoch||':week:'||g.room_id||':'||g.w,true);
    end if;
  end loop;
  return null;
end $$;
create trigger special_room_booking_insert_broadcast after insert on public.special_room_bookings referencing new table as new_rows for each statement execute function public.publish_special_room_booking_changes();
create trigger special_room_booking_update_broadcast after update on public.special_room_bookings referencing new table as new_rows old table as old_rows for each statement execute function public.publish_special_room_booking_changes();
create trigger special_room_booking_delete_broadcast after delete on public.special_room_bookings referencing old table as old_rows for each statement execute function public.publish_special_room_booking_changes();

create function public.version_special_room_board() returns trigger language plpgsql set search_path=public as $$
begin
  if (new.title,new.description,new.period_count,new.include_saturday,new.status,new.school_name,new.neis_office_code,new.neis_school_code,new.password_digest,new.public_token) is distinct from (old.title,old.description,old.period_count,old.include_saturday,old.status,old.school_name,old.neis_office_code,old.neis_school_code,old.password_digest,old.public_token) then
    new.metadata_revision:=old.metadata_revision+1;
  end if;
  if (new.password_digest,new.public_token) is distinct from (old.password_digest,old.public_token) then new.access_epoch:=old.access_epoch+1; end if;
  return new;
end $$;
create trigger special_room_board_version before update on public.special_room_boards for each row execute function public.version_special_room_board();
create function public.publish_special_room_metadata() returns trigger language plpgsql security definer set search_path=public,realtime as $$
begin
  if TG_OP='DELETE' then
    perform realtime.send(jsonb_build_object('kind','access-changed'),'metadata','sr:'||old.id||':'||old.access_epoch||':meta',true); return old;
  end if;
  if new.access_epoch<>old.access_epoch then
    perform realtime.send(jsonb_build_object('kind','access-changed'),'metadata','sr:'||old.id||':'||old.access_epoch||':meta',true);
  end if;
  if (new.metadata_revision,new.calendar_revision) is distinct from (old.metadata_revision,old.calendar_revision) then
    perform realtime.send(jsonb_build_object('kind','metadata','metadataRevision',new.metadata_revision,'calendarRevision',new.calendar_revision),'metadata','sr:'||new.id||':'||new.access_epoch||':meta',true);
  end if;
  return new;
end $$;
create trigger special_room_metadata_broadcast after update or delete on public.special_room_boards for each row execute function public.publish_special_room_metadata();

create function public.guard_special_room_child() returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform 1 from special_room_boards where id=coalesce(new.board_id,old.board_id) for update;
  if TG_TABLE_NAME='special_room_closures' then
    if TG_OP<>'DELETE' and new.room_id is not null and not exists(select 1 from special_rooms where id=new.room_id and board_id=new.board_id) then raise exception 'room board mismatch'; end if;
  end if;
  return coalesce(new,old);
end $$;
create trigger special_room_closure_guard before insert or update or delete on public.special_room_closures for each row execute function public.guard_special_room_child();
create trigger special_room_school_day_guard before insert or update or delete on public.special_room_school_days for each row execute function public.guard_special_room_child();
create function public.invalidate_special_room_child() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if TG_TABLE_NAME='special_room_school_days' then
    update special_room_boards set calendar_revision=calendar_revision+1 where id=coalesce(new.board_id,old.board_id);
  else
    update special_room_boards set metadata_revision=metadata_revision+1 where id=coalesce(new.board_id,old.board_id);
  end if;
  return coalesce(new,old);
end $$;
create trigger special_room_closure_changed after insert or update or delete on public.special_room_closures for each row execute function public.invalidate_special_room_child();
-- 학사일정은 아래 최종 동기화 RPC가 한 번만 revision/알림을 보낸다.

create function public.special_room_public_request(p_body jsonb, p_request_key text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare
  a text:=p_body->>'action'; b special_room_boards; r uuid; d date; w date; p int;
  existing special_room_bookings; saved special_room_bookings; ex jsonb; result jsonb; op uuid;
  candidates date[]; off_days date[]; created date[]; fingerprint jsonb; stored special_room_repeat_operations;
  max_requests int; changed boolean:=false;
begin
  max_requests:=case a when 'metadata' then 60 when 'bootstrap' then 60 when 'week' then 120 when 'unlock' then 10 when 'setRepeat' then 20 else 60 end;
  if not consume_special_room_rate_limit(p_request_key,60,max_requests) then return jsonb_build_object('status',429,'error','요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'); end if;
  -- 데이터 연산 실패만 롤백한다. 제한 카운터는 실패·충돌에도 유지한다.
  begin
    select * into b from special_room_boards where public_token=(p_body->>'token')::uuid;
    if not found then return jsonb_build_object('status',404,'error','예약표를 찾을 수 없습니다.'); end if;
    w:=coalesce((p_body->>'from')::date,date_trunc('week',now() at time zone 'Asia/Seoul')::date);
    if extract(isodow from w)<>1 then return jsonb_build_object('status',400,'error','주간 시작은 월요일이어야 합니다.'); end if;
    r:=nullif(p_body->>'roomId','')::uuid;
    if r is not null and not exists(select 1 from special_rooms where id=r and board_id=b.id) then return jsonb_build_object('status',404,'error','특별실을 찾을 수 없습니다.'); end if;
    if r is null then select id into r from special_rooms where board_id=b.id order by position limit 1; end if;
    -- 전환 중 구버전 metadata/week 읽기는 유지한다. 기대 상태 없는 쓰기는 Edge에서 거절한다.
    if a='metadata' then
      return jsonb_build_object('status',200,'board',jsonb_build_object('id',b.id,'publicToken',b.public_token,'title',b.title,'description',b.description,'status',b.status,'hasPassword',b.password_digest is not null,'isPasswordProtected',b.password_digest is not null,'periodCount',b.period_count,'includeSaturday',b.include_saturday,'schoolName',coalesce(b.school_name,''),'termEndDate',coalesce((select (min(day)-1)::text from special_room_school_days where board_id=b.id and source_office=b.neis_office_code and source_school=b.neis_school_code and day>(now() at time zone 'Asia/Seoul')::date and event_name like '%방학%'),''),'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',id,'position',position,'name',name,'location',location) order by position) from special_rooms where board_id=b.id),'[]'),'closures',coalesce((select jsonb_agg(jsonb_build_object('id',id,'roomId',coalesce(room_id::text,''),'startDate',start_date,'endDate',end_date,'reason',reason) order by start_date,id) from special_room_closures where board_id=b.id),'[]')));
    end if;
    if a='bootstrap' and b.password_digest is not null then
      return jsonb_build_object('status',200,'locked',b.password_digest is not null,'board',jsonb_build_object('id',b.id,'publicToken',b.public_token,'title',b.title,'description',b.description,'status',b.status,'isPasswordProtected',b.password_digest is not null,'rooms','[]'::jsonb,'bookings','[]'::jsonb,'schoolDays','[]'::jsonb,'closures','[]'::jsonb,'createdAt',b.created_at,'updatedAt',b.updated_at));
    end if;
    if b.password_digest is not null and not verify_special_room_password(b.id,coalesce(p_body->>'password','')) then return jsonb_build_object('status',401,'error','비밀번호가 맞지 않습니다.'); end if;
    if a='week' and coalesce((p_body->>'legacyWeek')::boolean,false) then
      return jsonb_build_object('status',200,'bookings',coalesce((select jsonb_agg(special_room_booking_dto(x)) from special_room_bookings x where board_id=b.id and booking_date between w and (p_body->>'to')::date),'[]'),'schoolDays',coalesce((select jsonb_agg(jsonb_build_object('date',day,'eventName',event_name,'isOffDay',is_off_day)) from special_room_school_days where board_id=b.id and source_office=b.neis_office_code and source_school=b.neis_school_code and day between w and (p_body->>'to')::date),'[]'));
    end if;
    if a in ('bootstrap','week','unlock') then
      return jsonb_build_object('status',200)||special_room_snapshot(b.id,r,w,coalesce(p_body->'known','{}'));
    end if;
    if a not in ('setBooking','clearBooking','setRepeat') then return jsonb_build_object('status',400,'error','지원하지 않는 요청입니다.'); end if;
    -- 부모 먼저 공유 잠금. 설정 변경은 부모 UPDATE를 먼저 취한다.
    select * into b from special_room_boards where id=b.id for share;
    if b.public_token::text<>p_body->>'token' or (b.password_digest is not null and not verify_special_room_password(b.id,coalesce(p_body->>'password',''))) then return jsonb_build_object('status',401,'error','접근 정보가 변경되었습니다.'); end if;
    if b.status<>'open' then return jsonb_build_object('status',409,'error','예약이 종료되었습니다.','code','BOARD_CLOSED'); end if;
    d:=(p_body->>'date')::date; p:=(p_body->>'period')::int; op:=(p_body->>'operationId')::uuid;
    if p not between 1 and 9 then return jsonb_build_object('status',400,'error','교시는 1교시부터 9교시까지입니다.'); end if;
    perform set_config('special_rooms.operation_id',op::text,true);
    w:=date_trunc('week',d)::date;
    if a='setRepeat' then
      if (p_body->>'until')::date<d or (p_body->>'until')::date>=d+364 then return jsonb_build_object('status',400,'error','반복 예약은 시작 날짜부터 최대 52주까지 가능합니다.'); end if;
      if p>b.period_count or extract(isodow from d)=7 or (extract(isodow from d)=6 and not b.include_saturday) then return jsonb_build_object('status',400,'error','운영 요일과 교시 안에서 예약해 주세요.'); end if;
      perform pg_advisory_xact_lock(hashtextextended(b.id::text||op::text,1));
      fingerprint:=p_body - 'password' - 'token' - 'known';
      select * into stored from special_room_repeat_operations where board_id=b.id and operation_id=op;
      if found then
        if stored.fingerprint<>fingerprint then return jsonb_build_object('status',409,'error','같은 작업 ID의 내용이 달라졌습니다.'); end if;
        if stored.expires_at<now() then return jsonb_build_object('status',409,'error','재시도 기한이 지났습니다. 최신 예약을 확인해 주세요.'); end if;
        return stored.result;
      end if;
      select array_agg(x::date order by x) into candidates from generate_series(d::timestamp,(p_body->>'until')::date::timestamp,interval '7 days') x;
      select coalesce(array_agg(x order by x),'{}'::date[]) into off_days from unnest(candidates) x where exists(select 1 from special_room_school_days where board_id=b.id and source_office=b.neis_office_code and source_school=b.neis_school_code and day=x and is_off_day) or exists(select 1 from special_room_closures where board_id=b.id and (room_id is null or room_id=r) and x between start_date and end_date);
      with inserted as (
        insert into special_room_bookings(board_id,room_id,booking_date,period,label)
        select b.id,r,x,p,trim(p_body->>'label') from unnest(candidates) x where not x=any(off_days) order by x
        on conflict(room_id,booking_date,period) do nothing returning booking_date
      ) select coalesce(array_agg(booking_date order by booking_date),'{}'::date[]) into created from inserted;
      result:=jsonb_build_object('status',200,'created',to_jsonb(created),'skippedOffDay',to_jsonb(off_days),'skippedTaken',coalesce((select jsonb_agg(x order by x) from unnest(candidates) x where not x=any(off_days) and not x=any(created)),'[]'),'operationId',op,
        'bookings',coalesce((select jsonb_agg(special_room_booking_dto(x)) from special_room_bookings x where room_id=r and booking_date=any(created) and period=p),'[]'),
        'scopes',coalesce((select jsonb_agg(jsonb_build_object('weekStart',s.week_start,'scopeRevision',s.revision)) from special_room_week_state s where room_id=r and s.week_start in (select date_trunc('week',x)::date from unnest(created) x)),'[]'));
      delete from special_room_repeat_operations where board_id=b.id and expires_at<now()-interval '1 day';
      insert into special_room_repeat_operations(board_id,operation_id,fingerprint,result) values(b.id,op,fingerprint,result);
      return result;
    end if;
    if exists(select 1 from special_room_closures where board_id=b.id and (room_id is null or room_id=r) and d between start_date and end_date) then return jsonb_build_object('status',409,'error','휴관 기간에는 예약을 바꿀 수 없습니다.','code','ROOM_CLOSED'); end if;
    perform pg_advisory_xact_lock(hashtextextended(r::text||d::text||p::text,0));
    select * into existing from special_room_bookings where room_id=r and booking_date=d and period=p for update;
    if not p_body ? 'expected' then return jsonb_build_object('status',409,'code','CLIENT_UPDATE_REQUIRED','error','예약 화면을 새로고침한 뒤 다시 시도해 주세요.'); end if;
    ex:=p_body->'expected';
    if a='setBooking' and existing.id is not null and existing.last_operation_id=op then
      if existing.label<>trim(p_body->>'label') then return jsonb_build_object('status',409,'code','OPERATION_CONFLICT','error','같은 작업 ID의 내용이 달라졌습니다.'); end if;
      return jsonb_build_object('status',200,'booking',special_room_booking_dto(existing),'roomId',r,'weekStart',w,'scopeRevision',coalesce((select revision from special_room_week_state where room_id=r and week_start=w),0),'operationId',op);
    end if;
    if (existing.id is null and ex<>'null'::jsonb) or (existing.id is not null and (ex='null'::jsonb or existing.id::text is distinct from ex->>'id' or existing.revision is distinct from (ex->>'revision')::bigint)) then
      return jsonb_build_object('status',409,'code','BOOKING_CONFLICT','error','다른 사람이 예약을 변경했습니다. 현재 내용을 확인해 주세요.','current',case when existing.id is null then null else special_room_booking_dto(existing) end);
    end if;
    if a='clearBooking' then
      if existing.id is not null then delete from special_room_bookings where id=existing.id; end if;
    else
      if existing.id is null and (p>b.period_count or extract(isodow from d)=7 or (extract(isodow from d)=6 and not b.include_saturday)) then return jsonb_build_object('status',400,'error','운영 요일과 교시 안에서 예약해 주세요.'); end if;
      if existing.id is null then
        insert into special_room_bookings(board_id,room_id,booking_date,period,label) values(b.id,r,d,p,trim(p_body->>'label')) returning * into saved;
      elsif existing.label=trim(p_body->>'label') then saved:=existing;
      else update special_room_bookings set label=trim(p_body->>'label') where id=existing.id returning * into saved;
      end if;
    end if;
    return jsonb_build_object('status',200,'booking',case when saved.id is null then null else special_room_booking_dto(saved) end,'deletedId',case when a='clearBooking' then existing.id else null end,'roomId',r,'weekStart',w,'scopeRevision',coalesce((select revision from special_room_week_state where room_id=r and week_start=w),0),'operationId',op);
  exception when invalid_text_representation or datetime_field_overflow or check_violation then
    return jsonb_build_object('status',400,'error','요청 값이 올바르지 않습니다.');
  when others then
    return jsonb_build_object('status',500,'error','예약을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  end;
end $$;
revoke all on function public.special_room_public_request(jsonb,text) from public,anon,authenticated;
grant execute on function public.special_room_public_request(jsonb,text) to service_role;

create function public.list_special_room_summaries(p_cursor jsonb default null, p_status text default null, p_limit int default 20) returns jsonb
language sql stable security definer set search_path=public as $$
with page as (select id,title,status,updated_at from special_room_boards where owner_id=auth.uid()
  and (p_status is null or status=p_status) and (p_cursor is null or (updated_at,id)<((p_cursor->>'updatedAt')::timestamptz,(p_cursor->>'id')::uuid))
  order by updated_at desc,id desc limit least(greatest(p_limit,1),20)+1),
items as (select * from page order by updated_at desc,id desc limit least(greatest(p_limit,1),20))
select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'status',i.status,'updatedAt',i.updated_at,
  'roomCount',(select count(*) from special_rooms where board_id=i.id),'bookingCount',(select count(*) from special_room_bookings where board_id=i.id)) order by i.updated_at desc,i.id desc) from items i),'[]'),
  'nextCursor',case when (select count(*) from page)>least(greatest(p_limit,1),20) then (select jsonb_build_object('id',id,'updatedAt',updated_at) from items order by updated_at,id limit 1) else null end)
$$;
create function public.get_special_room_owner_scope(p_board uuid,p_room uuid,p_week date,p_known jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from special_room_boards where id=p_board and owner_id=auth.uid()) then raise exception '예약표 관리 권한이 없습니다.' using errcode='42501'; end if;
  if extract(isodow from p_week)<>1 or (p_room is not null and not exists(select 1 from special_rooms where board_id=p_board and id=p_room)) then raise exception '조회 범위가 올바르지 않습니다.'; end if;
  return special_room_snapshot(p_board,p_room,p_week,p_known,true);
end $$;
create function public.special_room_owner_action(p_board uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare b special_room_boards; count_now bigint; room_count bigint;
begin
  select * into b from special_room_boards where id=p_board and owner_id=auth.uid();
  if not found then raise exception '예약표 관리 권한이 없습니다.' using errcode='42501'; end if;
  if p_action in ('delete','info') then select * into b from special_room_boards where id=p_board and owner_id=auth.uid() for update; end if;
  if p_action='impact' then
    if p_data->>'kind'='shape' then
      select count(*) into count_now from special_room_bookings where board_id=b.id and (period>(p_data->>'periodCount')::int or (not (p_data->>'includeSaturday')::boolean and extract(isodow from booking_date)=6));
    else
      select count(*) into count_now from special_room_bookings where board_id=b.id and (nullif(p_data->>'roomId','') is null or room_id=nullif(p_data->>'roomId','')::uuid) and booking_date between (p_data->>'startDate')::date and (p_data->>'endDate')::date;
    end if;
    return jsonb_build_object('count',count_now,'periods',case when p_data->>'kind'='shape' then coalesce((select jsonb_agg(jsonb_build_object('period',period,'count',n) order by period) from (select period,count(*) n from special_room_bookings where board_id=b.id and period>(p_data->>'periodCount')::int group by period) z),'[]') else null end,
      'saturdayCount',case when p_data->>'kind'='shape' and not (p_data->>'includeSaturday')::boolean then (select count(*) from special_room_bookings where board_id=b.id and extract(isodow from booking_date)=6) else 0 end);
  elsif p_action='deletePreview' then
    select count(*) into count_now from special_room_bookings where board_id=b.id;
    select count(*) into room_count from special_rooms where board_id=b.id;
    return jsonb_build_object('bookingCount',count_now,'roomCount',room_count,'metadataRevision',b.metadata_revision);
  elsif p_action='delete' then
    select count(*) into count_now from special_room_bookings where board_id=b.id;
    if count_now is distinct from (p_data->>'bookingCount')::bigint or b.metadata_revision is distinct from (p_data->>'metadataRevision')::bigint then return jsonb_build_object('status',409,'error','예약표 내용이 변경되었습니다. 건수를 다시 확인해 주세요.'); end if;
    delete from special_room_boards where id=b.id; return jsonb_build_object('status',200);
  elsif p_action='closures' then
    return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'roomId',coalesce(room_id::text,''),'startDate',start_date,'endDate',end_date,'reason',reason) order by start_date,id) from (select * from special_room_closures where board_id=b.id order by start_date,id limit 20 offset greatest(coalesce((p_data->>'offset')::int,0),0)) x),'[]'),'count',(select count(*) from special_room_closures where board_id=b.id));
  elsif p_action='info' then
    if b.metadata_revision is distinct from (p_data->>'expectedRevision')::bigint then return jsonb_build_object('status',409,'error','다른 화면에서 설정이 변경되었습니다. 최신 내용을 확인해 주세요.'); end if;
    if (b.title,b.description,b.period_count,b.include_saturday) is distinct from (p_data->>'title',p_data->>'description',(p_data->>'periodCount')::smallint,(p_data->>'includeSaturday')::boolean) then
      update special_room_boards set title=p_data->>'title',description=p_data->>'description',period_count=(p_data->>'periodCount')::int,include_saturday=(p_data->>'includeSaturday')::boolean where id=b.id;
    end if;
    return jsonb_build_object('status',200);
  end if;
  raise exception 'unsupported owner action';
end $$;

create function public.sync_special_room_school_days(p_board uuid,p_owner uuid,p_office text,p_school text,p_from date,p_to date,p_days jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b special_room_boards; changed int:=0; n int;
begin
  select * into b from special_room_boards where id=p_board and owner_id=p_owner for update;
  if not found then raise exception 'owner denied' using errcode='42501'; end if;
  if (b.neis_office_code,b.neis_school_code) is distinct from (p_office,p_school) then return jsonb_build_object('status',409,'error','일정을 받는 동안 학교가 변경되었습니다. 다시 받아 주세요.'); end if;
  if p_to<p_from or p_to>p_from+370 or jsonb_typeof(p_days)<>'array' then raise exception 'invalid range'; end if;
  if exists(select 1 from jsonb_to_recordset(p_days) as x(day date,event_name text,is_off_day boolean) where day not between p_from and p_to or event_name is null or is_off_day is null) then raise exception 'invalid NEIS day'; end if;
  delete from special_room_school_days d where board_id=b.id and day between p_from and p_to and not exists(select 1 from jsonb_to_recordset(p_days) as x(day date,event_name text,is_off_day boolean) where x.day=d.day and x.event_name=d.event_name);
  get diagnostics n=row_count; changed:=changed+n;
  insert into special_room_school_days(board_id,day,event_name,is_off_day,source_office,source_school)
    select distinct b.id,day,event_name,is_off_day,p_office,p_school from jsonb_to_recordset(p_days) as x(day date,event_name text,is_off_day boolean)
    on conflict(board_id,day,event_name) do update set is_off_day=excluded.is_off_day,source_office=excluded.source_office,source_school=excluded.source_school,fetched_at=now() where (special_room_school_days.is_off_day,special_room_school_days.source_office,special_room_school_days.source_school) is distinct from (excluded.is_off_day,excluded.source_office,excluded.source_school);
  get diagnostics n=row_count; changed:=changed+n;
  if changed>0 then update special_room_boards set calendar_revision=calendar_revision+1 where id=b.id; end if;
  return jsonb_build_object('status',200,'count',jsonb_array_length(p_days),'changed',changed);
end $$;
revoke all on function public.list_special_room_summaries(jsonb,text,int),public.get_special_room_owner_scope(uuid,uuid,date,jsonb),public.special_room_owner_action(uuid,text,jsonb),public.sync_special_room_school_days(uuid,uuid,text,text,date,date,jsonb) from public,anon;
grant execute on function public.list_special_room_summaries(jsonb,text,int),public.get_special_room_owner_scope(uuid,uuid,date,jsonb),public.special_room_owner_action(uuid,text,jsonb) to authenticated;
revoke all on function public.sync_special_room_school_days(uuid,uuid,text,text,date,date,jsonb) from authenticated;
grant execute on function public.sync_special_room_school_days(uuid,uuid,text,text,date,date,jsonb) to service_role;

-- 알림 전용 JWT는 일반 authenticated 사용자로 로그인하지 않는다.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='special_room_viewer') then create role special_room_viewer nologin; end if;
  if exists(select 1 from pg_roles where rolname='authenticator') then grant special_room_viewer to authenticator; end if;
end $$;
grant usage on schema public,realtime,auth to special_room_viewer;
grant select on realtime.messages to special_room_viewer;
create function public.can_receive_special_room_topic(p_topic text) returns boolean
language plpgsql stable security definer set search_path=public,auth as $$
declare parts text[]:=string_to_array(p_topic,':'); b special_room_boards; claims jsonb:=auth.jwt();
begin
  if array_length(parts,1) not in (4,6) or parts[1]<>'sr' then return false; end if;
  select * into b from special_room_boards where id=parts[2]::uuid and access_epoch=parts[3]::bigint;
  if not found then return false; end if;
  if not (b.owner_id=auth.uid() or (claims->>'role'='special_room_viewer' and claims->>'sr_board'=b.id::text and claims->>'sr_epoch'=b.access_epoch::text and (claims->>'exp')::bigint>extract(epoch from now()))) then return false; end if;
  if parts[4]='meta' and array_length(parts,1)=4 then return true; end if;
  return parts[4]='week' and array_length(parts,1)=6 and extract(isodow from parts[6]::date)=1 and exists(select 1 from special_rooms where id=parts[5]::uuid and board_id=b.id);
exception when others then return false;
end $$;
revoke all on function public.can_receive_special_room_topic(text) from public,anon;
grant execute on function public.can_receive_special_room_topic(text) to authenticated,special_room_viewer;
create policy special_room_private_receive on realtime.messages for select to authenticated,special_room_viewer
using (extension='broadcast' and public.can_receive_special_room_topic(coalesce(topic,realtime.topic())));
-- publish 권한은 부여하지 않는다. private flag가 없는 채널에는 전달되지 않는다.

create trigger special_room_room_guard before insert or update or delete on public.special_rooms for each row execute function public.guard_special_room_child();
create function public.invalidate_special_room_rooms() returns trigger language plpgsql security definer set search_path=public as $$
declare q text; g record;
begin
  q:=case TG_OP when 'DELETE' then 'select distinct board_id from old_rooms' else 'select distinct board_id from new_rooms' end;
  for g in execute q loop update special_room_boards set metadata_revision=metadata_revision+1 where id=g.board_id; end loop;
  return null;
end $$;
create trigger special_room_rooms_insert_changed after insert on public.special_rooms referencing new table as new_rooms for each statement execute function public.invalidate_special_room_rooms();
create trigger special_room_rooms_update_changed after update on public.special_rooms referencing new table as new_rooms for each statement execute function public.invalidate_special_room_rooms();
create trigger special_room_rooms_delete_changed after delete on public.special_rooms referencing old table as old_rooms for each statement execute function public.invalidate_special_room_rooms();

-- 격리 SQL 검사: 다른 기능의 allow-all policy가 있어도 특별실 타 소유자 접근은 차단.
-- topic이 sr:로 시작하지 않는 행은 true이므로 다른 기능의 권한은 유지한다.
create policy special_room_private_scope_guard on realtime.messages as restrictive for select to authenticated,special_room_viewer
using (coalesce(topic,realtime.topic(),'') not like 'sr:%' or public.can_receive_special_room_topic(coalesce(topic,realtime.topic())));
