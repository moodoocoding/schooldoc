-- 자료 수합: 현재 현황의 제한 조회, 업로드 예약, 원자 제출 확정.
-- 기존 암호화 키/응답 결정/보관 기산점과 적용된 마이그레이션은 유지한다.
alter table public.data_collection_files add column if not exists request_id uuid;
alter table public.data_collection_files add column if not exists request_digest text;
create unique index if not exists data_collect_submission_request
  on public.data_collection_files(collection_id, request_id) where request_id is not null;
create index if not exists data_collect_owner_page
  on public.data_collections(owner_id, created_at desc, id desc);
create index if not exists data_collect_label_lookup on public.data_collection_targets using gin(label_search jsonb_path_ops);
create index if not exists data_collect_owner_lookup on public.data_collection_targets using gin(owner_search jsonb_path_ops);

create table if not exists public.data_collection_uploads (
  id uuid primary key,
  collection_id uuid not null references public.data_collections(id) on delete cascade,
  claim_hash text not null,
  personal_token uuid not null,
  storage_path text not null unique,
  expires_at timestamptz not null default now() + interval '2 hours',
  consumed_at timestamptz
);
create table if not exists public.data_collection_cleanup (
  storage_path text primary key,
  collection_id uuid not null references public.data_collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error_code text not null default 'storage_remove_failed'
);
alter table public.data_collection_uploads enable row level security;
alter table public.data_collection_cleanup enable row level security;

create or replace function public.finalize_data_collection_submission(
  p_collection_id uuid, p_personal_token uuid, p_request_id uuid, p_request_digest text,
  p_decision text, p_claim_hash text, p_storage_path text,
  p_name_ciphertext text, p_identity_ciphertext text, p_display_label text, p_label_search jsonb,
  p_content_hash text, p_byte_size bigint, p_mime_type text, p_note_ciphertext text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  c public.data_collections; t public.data_collection_targets; f public.data_collection_files;
  next_row integer; next_revision integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_collection_id::text||p_request_id::text,0));
  select * into c from public.data_collections where id=p_collection_id;
  if not found then raise exception 'collection_not_found'; end if;
  -- 같은 요청의 재전송은 같은 대상·내용일 때 기존 결과만 반환한다.
  select * into f from public.data_collection_files where collection_id=c.id and request_id=p_request_id;
  if found then
    select * into t from public.data_collection_targets where id=f.target_id;
    if t.personal_token is distinct from p_personal_token or f.request_digest is distinct from p_request_digest then
      raise exception 'request_conflict';
    end if;
    return jsonb_build_object('submitted',true,'revision',f.revision,'decision',f.response_kind,'personalToken',t.personal_token);
  end if;
  if c.status <> 'open' or (c.due_at is not null and c.due_at <= now()) then raise exception 'collection_closed'; end if;
  if (c.template_path is null and p_decision <> 'submitted')
    or (c.template_path is not null and p_decision not in ('confirmed','corrected')) then raise exception 'invalid_decision'; end if;
  if (p_decision='confirmed' and p_storage_path is not null)
    or (p_decision<>'confirmed' and (p_storage_path is null or coalesce(p_byte_size,0)<=0 or p_byte_size>52428800)) then
    raise exception 'invalid_file';
  end if;

  select * into t from public.data_collection_targets
    where collection_id=c.id and personal_token=p_personal_token;
  if not found then
    if c.mode<>'custom' or p_identity_ciphertext is null or p_personal_token is null then raise exception 'target_not_found'; end if;
    -- 파일 검증은 함수 호출 전에 완료. 신규 번호만 짧게 수합 단위로 잠근다.
    perform 1 from public.data_collections where id=c.id for update;
    select * into c from public.data_collections where id=c.id;
    if c.status <> 'open' or (c.due_at is not null and c.due_at<=now()) then raise exception 'collection_closed'; end if;
    select * into t from public.data_collection_targets where collection_id=c.id and personal_token=p_personal_token for update;
    if not found then
      select coalesce(max(row_number),0)+1 into next_row from public.data_collection_targets where collection_id=c.id;
      if next_row>2000 then raise exception 'collection_full'; end if;
      insert into public.data_collection_targets(collection_id,row_number,label_ciphertext,owner_ciphertext,display_label,label_search,personal_token)
        values(c.id,next_row,p_identity_ciphertext,p_identity_ciphertext,p_display_label,p_label_search,p_personal_token) returning * into t;
    end if;
  else
    -- 수합→대상 순서로 잠가 다른 신규 제출/종료 변경과의 교착을 피한다.
    perform 1 from public.data_collections where id=c.id for share;
    select * into c from public.data_collections where id=c.id;
    if c.status <> 'open' or (c.due_at is not null and c.due_at<=now()) then raise exception 'collection_closed'; end if;
    select * into t from public.data_collection_targets where id=t.id for update;
  end if;
  -- 같은 대상의 동시 재전송도 대상 잠금 후 다시 확인한다.
  select * into f from public.data_collection_files where collection_id=c.id and request_id=p_request_id;
  if found then
    if f.target_id<>t.id or f.request_digest is distinct from p_request_digest then raise exception 'request_conflict'; end if;
    return jsonb_build_object('submitted',true,'revision',f.revision,'decision',f.response_kind,'personalToken',t.personal_token);
  end if;
  if p_storage_path is not null then
    perform 1 from public.data_collection_uploads where id=p_request_id and collection_id=c.id and storage_path=p_storage_path
      and personal_token=p_personal_token and claim_hash=p_claim_hash and consumed_at is null and expires_at>now() for update;
    if not found then raise exception 'invalid_upload_claim'; end if;
  end if;
  select coalesce(max(revision),0)+1 into next_revision from public.data_collection_files where collection_id=c.id and target_id=t.id;
  if next_revision>1 and not c.allow_resubmit then raise exception 'resubmit_disabled'; end if;
  update public.data_collection_files set is_current=false where collection_id=c.id and target_id=t.id and is_current;
  insert into public.data_collection_files(collection_id,target_id,response_kind,revision,is_current,storage_path,original_name_ciphertext,
    content_hash,byte_size,mime_type,note_ciphertext,request_id,request_digest)
    values(c.id,t.id,p_decision,next_revision,true,p_storage_path,p_name_ciphertext,p_content_hash,p_byte_size,p_mime_type,p_note_ciphertext,p_request_id,p_request_digest);
  update public.data_collection_targets set status=p_decision,submitted_at=now() where id=t.id;
  if p_storage_path is not null then update public.data_collection_uploads set consumed_at=now() where id=p_request_id; end if;
  return jsonb_build_object('submitted',true,'revision',next_revision,'decision',p_decision,'personalToken',t.personal_token);
end $$;

create or replace function public.data_collect_summary_page(p_owner_id uuid,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20,p_collection_id uuid default null)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with page as (
    select id,title,mode,status,due_at,created_at,template_path from public.data_collections
    where owner_id=p_owner_id and (p_collection_id is null or id=p_collection_id) and (p_before is null or (created_at,id)<(p_before,p_before_id))
    order by created_at desc,id desc limit least(greatest(p_limit,1),21)
  ), counts as (
    select t.collection_id,count(*) total,count(f.id) responded,
      count(*) filter(where f.id is null and t.status<>'unsubmitted') needs_repair,
      count(f.id) filter(where f.response_kind='confirmed') confirmed,
      count(f.id) filter(where f.response_kind='corrected') corrected,
      count(f.id) filter(where f.response_kind='submitted') submitted
    from public.data_collection_targets t join page p on p.id=t.collection_id
    left join public.data_collection_files f on f.collection_id=t.collection_id and f.target_id=t.id and f.is_current
    group by t.collection_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'mode',p.mode,'status',p.status,'dueAt',coalesce(p.due_at::text,''),
    'createdAt',p.created_at,'hasTemplate',p.template_path is not null,'total',coalesce(c.total,0),'responded',coalesce(c.responded,0),
    'needsRepair',coalesce(c.needs_repair,0),'confirmed',coalesce(c.confirmed,0),'corrected',coalesce(c.corrected,0),'submitted',coalesce(c.submitted,0))
    order by p.created_at desc,p.id desc),'[]'::jsonb)
  from page p left join counts c on c.collection_id=p.id;
$$;

create or replace function public.data_collect_target_page(p_owner_id uuid,p_collection_id uuid,p_after integer default 0,p_limit integer default 50,p_unsubmitted boolean default false,p_detail boolean default false)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.row_number),'[]'::jsonb) from (
    select t.id,t.row_number,t.label_ciphertext,t.display_owner,
      f.id submission_id,f.response_kind,f.revision,f.uploaded_at,
      (f.note_ciphertext is not null) has_note,(f.storage_path is not null) has_file,coalesce(f.byte_size,0) byte_size,
      case when p_detail then f.note_ciphertext end note_ciphertext,
      case when p_detail then f.original_name_ciphertext end original_name_ciphertext,
      (f.id is null and t.status<>'unsubmitted') needs_repair
    from public.data_collection_targets t
    join public.data_collections c on c.id=t.collection_id and c.owner_id=p_owner_id
    left join public.data_collection_files f on f.collection_id=t.collection_id and f.target_id=t.id and f.is_current
    where t.collection_id=p_collection_id and t.row_number>p_after and (not p_unsubmitted or (f.id is null and t.status='unsubmitted'))
    order by t.row_number limit least(greatest(p_limit,1),2001)
  ) q;
$$;
revoke all on function public.finalize_data_collection_submission(uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.data_collect_summary_page(uuid,timestamptz,uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.data_collect_target_page(uuid,uuid,integer,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.finalize_data_collection_submission(uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,text,bigint,text,text) to service_role;
grant execute on function public.data_collect_summary_page(uuid,timestamptz,uuid,integer,uuid) to service_role;
grant execute on function public.data_collect_target_page(uuid,uuid,integer,integer,boolean,boolean) to service_role;

create index if not exists data_collect_limit_expiry on public.data_collect_rate_limits(window_started_at,request_key);

create or replace function public.consume_data_collect_limits(p_limits jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; n integer; ok boolean:=true; window_at timestamptz:=to_timestamp(floor(extract(epoch from now())/60)*60);
begin
  for item in select value from jsonb_array_elements(p_limits) order by value->>'key' loop
    insert into public.data_collect_rate_limits(request_key,window_started_at,request_count) values(item->>'key',window_at,1)
      on conflict(request_key,window_started_at) do update set request_count=data_collect_rate_limits.request_count+1 returning request_count into n;
    if n>least(greatest((item->>'max')::integer,1),1200) then ok:=false; end if;
  end loop;

  -- 만료된 기술 제한 기록만 분당 한 번, 제한된 배치로 정리한다.
  insert into public.data_collect_rate_limits(request_key,window_started_at,request_count)
    values('maintenance:data-collect',window_at,0) on conflict do nothing;
  if found then
    delete from public.data_collect_rate_limits where (request_key,window_started_at) in (
      select request_key,window_started_at from public.data_collect_rate_limits
      where window_started_at<window_at-interval '1 hour'
      order by window_started_at,request_key limit 1000
    );
  end if;
  return ok;
end $$;
revoke all on function public.consume_data_collect_limits(jsonb) from public,anon,authenticated;
grant execute on function public.consume_data_collect_limits(jsonb) to service_role;


-- 업무 생성 이전의 배포 파일도 예약으로 추적한다. 완료 파일과 연결된 경로는 정리하지 않는다.
create table if not exists public.data_collect_template_uploads (
  storage_path text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null,
  expires_at timestamptz not null default now()+interval '2 hours',
  consumed_at timestamptz,
  attempts integer not null default 0,
  last_error_code text
);
alter table public.data_collect_template_uploads enable row level security;

-- 기존 진행 업무 집계도 현재 버전 기준으로 맞춘다. 다른 업무의 SQL은 보존한다.
do $$
declare definition text; changed text;
begin
  if to_regprocedure('public.get_active_work_summary()') is not null then
    definition:=pg_get_functiondef('public.get_active_work_summary()'::regprocedure);
    changed:=regexp_replace(definition,
      'select case[[:space:]]+when collection.mode = ''fixed'' then count\(distinct file.target_id\)[[:space:]]+else count\(\*\) filter \(where file.is_current\)[[:space:]]+end',
      'select count(*)');
    if changed=definition then raise exception 'active_work_summary_definition_changed'; end if;
    changed:=replace(changed,'where file.collection_id = collection.id','where file.collection_id = collection.id and file.is_current');
    execute changed;
  end if;
end $$;
