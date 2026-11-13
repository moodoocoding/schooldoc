-- 보관함은 종료/마감 시각에서 계산한다. 기존 자료와 보관기간은 변경하지 않는다.
create table public.data_collect_purge_jobs (
  collection_id uuid primary key references public.data_collections(id) on delete cascade,
  response_count integer not null,
  file_count integer not null,
  started_at timestamptz not null default now()
);
alter table public.data_collect_purge_jobs enable row level security;
revoke all on public.data_collect_purge_jobs from anon, authenticated;

-- 이전 Edge Function에서 호출하는 기존 5인자 RPC는 유지한다.
create function public.data_collect_scoped_summary_page(
  p_owner_id uuid, p_scope text, p_before timestamptz, p_before_id uuid,
  p_limit integer, p_collection_id uuid
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with page as (
    select id,title,mode,status,due_at,created_at,template_path from public.data_collections
    where owner_id=p_owner_id
      and (p_collection_id is null or id=p_collection_id)
      and (p_before is null or (created_at,id)<(p_before,p_before_id))
      and case p_scope
        when 'active' then status='open' and (due_at is null or due_at>now())
        when 'archive' then status='closed' or due_at<=now()
        when 'all' then true else false end
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
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'mode',p.mode,'status',p.status,
    'dueAt',coalesce(p.due_at::text,''),'createdAt',p.created_at,'hasTemplate',p.template_path is not null,
    'total',coalesce(c.total,0),'responded',coalesce(c.responded,0),'needsRepair',coalesce(c.needs_repair,0),
    'confirmed',coalesce(c.confirmed,0),'corrected',coalesce(c.corrected,0),'submitted',coalesce(c.submitted,0),
    'purgePending',j.collection_id is not null) order by p.created_at desc,p.id desc),'[]'::jsonb)
  from page p left join counts c on c.collection_id=p.id
  left join public.data_collect_purge_jobs j on j.collection_id=p.id;
$$;

create or replace function public.data_collect_summary_page(
  p_owner_id uuid,p_before timestamptz default null,p_before_id uuid default null,
  p_limit integer default 20,p_collection_id uuid default null
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select public.data_collect_scoped_summary_page(p_owner_id,'all',p_before,p_before_id,p_limit,p_collection_id);
$$;

-- 확정/삭제는 같은 수합 행을 잠근다. 파일 삭제가 시작된 수합은 이전 화면에서도 다시 열 수 없다.
create function public.guard_data_collect_purge() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if (new.status is distinct from old.status or new.due_at is distinct from old.due_at)
    and exists (select 1 from public.data_collect_purge_jobs where collection_id=old.id) then
    raise exception 'purge_pending';
  end if;
  return new;
end $$;
create trigger data_collections_guard_purge before update of status,due_at on public.data_collections
for each row execute function public.guard_data_collect_purge();

create function public.reopen_data_collection(p_owner_id uuid,p_collection_id uuid,p_due_at timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.data_collections;
begin
  select * into c from public.data_collections where id=p_collection_id and owner_id=p_owner_id for update;
  if not found then raise exception 'collection_not_found'; end if;
  if c.status='open' and (c.due_at is null or c.due_at>clock_timestamp()) then raise exception 'collection_active'; end if;
  if p_due_at is not null and (not isfinite(p_due_at) or p_due_at<=clock_timestamp()) then raise exception 'invalid_due'; end if;
  update public.data_collections set status='open', due_at=p_due_at where id=c.id;
end $$;

-- Storage 메타데이터는 수량/존재 확인에만 읽는다. 삭제는 Storage API가 맡는다.
create function public.data_collect_storage_paths(p_owner_id uuid,p_collection_id uuid)
returns table(bucket text,path text) language sql stable set search_path=public,pg_temp as $$
  select o.bucket_id::text,o.name::text from storage.objects o
  where (o.bucket_id='data-collect-files' and o.name like p_collection_id::text || '/%')
    or (o.bucket_id='data-collect-templates' and o.name like p_owner_id::text || '/' || p_collection_id::text || '/%');
$$;

create function public.data_collect_purge_preview(p_owner_id uuid,p_collection_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.data_collections; available_at timestamptz; pending boolean;
begin
  select * into c from public.data_collections where id=p_collection_id and owner_id=p_owner_id;
  if not found then raise exception 'collection_not_found'; end if;
  if c.status='open' and (c.due_at is null or c.due_at>clock_timestamp()) then raise exception 'collection_active'; end if;
  -- 이미 발급된 서명 업로드는 개별 취소할 수 없다. 2시간 유효 기간과 진행 중인 요청에 여유를 둔다.
  available_at := greatest(c.created_at,case when c.status='closed' then coalesce(c.closed_at,c.updated_at) else c.due_at end)
    + interval '2 hours 15 minutes';
  select exists(select 1 from public.data_collect_purge_jobs where collection_id=c.id) into pending;
  return jsonb_build_object('revision',c.updated_at,'availableAt',available_at,'pending',pending,
    'targetCount',(select count(*) from public.data_collection_targets where collection_id=c.id),
    'responseCount',(select count(*) from public.data_collection_files where collection_id=c.id),
    'fileCount',(select count(*) from public.data_collect_storage_paths(p_owner_id,c.id)));
end $$;

create function public.begin_data_collect_purge(
  p_owner_id uuid,p_collection_id uuid,p_revision timestamptz,p_targets integer,p_responses integer,p_files integer
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.data_collections; snapshot jsonb;
begin
  select * into c from public.data_collections where id=p_collection_id and owner_id=p_owner_id for update;
  if not found then raise exception 'collection_not_found'; end if;
  snapshot := public.data_collect_purge_preview(p_owner_id,c.id);
  if not (snapshot->>'pending')::boolean and (snapshot->>'availableAt')::timestamptz>clock_timestamp() then
    raise exception 'upload_grace_period';
  end if;
  if c.updated_at is distinct from p_revision or (snapshot->>'targetCount')::integer is distinct from p_targets
    or (snapshot->>'responseCount')::integer is distinct from p_responses
    or (snapshot->>'fileCount')::integer is distinct from p_files then
    raise exception 'purge_preview_changed';
  end if;
  insert into public.data_collect_purge_jobs(collection_id,response_count,file_count) values(c.id,p_responses,p_files)
    on conflict(collection_id) do nothing;
end $$;

create function public.data_collect_purge_batch(p_owner_id uuid,p_collection_id uuid)
returns table(bucket text,path text) language sql stable security definer set search_path=public,pg_temp as $$
  select f.bucket,f.path from public.data_collect_storage_paths(p_owner_id,p_collection_id) f
  where exists(select 1 from public.data_collect_purge_jobs j join public.data_collections c on c.id=j.collection_id
    where c.id=p_collection_id and c.owner_id=p_owner_id)
  limit 100;
$$;

create function public.finish_data_collect_purge(p_owner_id uuid,p_collection_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.data_collections; job public.data_collect_purge_jobs;
begin
  select * into c from public.data_collections where id=p_collection_id and owner_id=p_owner_id for update;
  if not found then
    if exists(select 1 from public.privacy_purge_log where owner_id=p_owner_id and resource_id=p_collection_id and resource_kind='data-collect') then return; end if;
    raise exception 'collection_not_found';
  end if;
  select * into job from public.data_collect_purge_jobs where collection_id=c.id;
  if not found then raise exception 'purge_not_started'; end if;
  if exists(select 1 from public.data_collect_storage_paths(p_owner_id,c.id)) then raise exception 'purge_files_remaining'; end if;
  delete from public.data_collect_template_uploads where owner_id=p_owner_id and collection_id=c.id;
  delete from public.data_collections where id=c.id;
  insert into public.privacy_purge_log(owner_id,resource_kind,resource_id,record_count,file_count)
    values(p_owner_id,'data-collect',c.id,job.response_count,job.file_count);
end $$;

revoke all on function public.data_collect_scoped_summary_page(uuid,text,timestamptz,uuid,integer,uuid),
  public.guard_data_collect_purge(),public.reopen_data_collection(uuid,uuid,timestamptz),
  public.data_collect_storage_paths(uuid,uuid),public.data_collect_purge_preview(uuid,uuid),
  public.begin_data_collect_purge(uuid,uuid,timestamptz,integer,integer,integer),
  public.data_collect_purge_batch(uuid,uuid),public.finish_data_collect_purge(uuid,uuid) from public,anon,authenticated;
grant execute on function public.data_collect_scoped_summary_page(uuid,text,timestamptz,uuid,integer,uuid),
  public.reopen_data_collection(uuid,uuid,timestamptz),public.data_collect_purge_preview(uuid,uuid),
  public.begin_data_collect_purge(uuid,uuid,timestamptz,integer,integer,integer),
  public.data_collect_purge_batch(uuid,uuid),public.finish_data_collect_purge(uuid,uuid) to service_role;
