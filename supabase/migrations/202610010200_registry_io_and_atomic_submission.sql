-- 기존 자료에는 보관 기간을 소급하지 않는다.
alter table public.registries add column if not exists retention_months integer check (retention_months between 1 and 120);
alter table public.registries add column if not exists closed_at timestamptz;
alter table public.registry_signatures add column if not exists request_id uuid;
alter table public.registry_signatures add column if not exists request_digest text;

create or replace function public.registry_close_time() returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='closed' and old.status <> 'closed' then new.closed_at=now(); end if;
  if new.status='open' and old.status <> 'open' then new.closed_at=null; end if;
  return new;
end $$;
create trigger registry_close_time before update on public.registries for each row execute function public.registry_close_time();

-- 집계는 소유자의 등록부만 읽고 명단/암호문/서명 URL은 반환하지 않는다.
create or replace function public.registry_owner_summaries()
returns table(id uuid,title text,left_header text,right_header text,mode text,status text,participant_count bigint,signed_count bigint,updated_at timestamptz)
language sql stable security invoker set search_path=public as $$
  select r.id,r.title,r.left_header,r.right_header,r.mode,r.status,count(p.id),count(p.id) filter(where p.status='signed'),r.updated_at
  from public.registries r left join public.registry_participants p on p.registry_id=r.id
  where r.owner_id=(select auth.uid()) group by r.id order by r.updated_at desc;
$$;
revoke all on function public.registry_owner_summaries() from public,anon;
grant execute on function public.registry_owner_summaries() to authenticated;

create or replace function public.registry_owner_snapshot(p_registry_id uuid,p_owner_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r public.registries;
begin
  select * into r from registries where id=p_registry_id and owner_id=p_owner_id;
  if not found then return null; end if;
  return jsonb_build_object('registry',to_jsonb(r)-'password_digest' || jsonb_build_object('has_password',r.password_digest is not null),'columns',coalesce((select jsonb_agg(c order by c.position) from registry_columns c where c.registry_id=r.id),'[]'),
    'participants',coalesce((select jsonb_agg(to_jsonb(p)-'verification_digest' || jsonb_build_object('requires_code',p.verification_digest is not null) order by p.row_number) from registry_participants p where p.registry_id=r.id),'[]'),
    'signatures',coalesce((select jsonb_agg(s) from registry_signatures s where s.registry_id=r.id),'[]'));
end $$;
revoke all on function public.registry_owner_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.registry_owner_snapshot(uuid,uuid) to service_role;

create or replace function public.rotate_registry_token(p_registry_id uuid) returns uuid
language plpgsql security invoker set search_path=public as $$
declare t uuid;
begin
  update registries set public_token=gen_random_uuid() where id=p_registry_id and owner_id=(select auth.uid()) returning public_token into t;
  if t is null then raise exception 'Registry not owned'; end if;
  return t;
end $$;
revoke all on function public.rotate_registry_token(uuid) from public,anon;
grant execute on function public.rotate_registry_token(uuid) to authenticated;

-- 실패 응답도 결과로 반환하여 요청 카운터의 증가가 rollback되지 않게 한다.
create or replace function public.registry_public_context(p_token uuid,p_action text,p_ip_key text,p_password text default '',p_query text default '',p_participant_id uuid default null,p_code text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare r public.registries; p public.registry_participants; limit_n integer; ok boolean; candidates jsonb;
begin
  if p_action not in ('metadata','unlock','search','walk-in','submit') then return jsonb_build_object('error','요청 형식이 올바르지 않습니다.','status',400); end if;
  limit_n=case p_action when 'metadata' then 360 when 'unlock' then 180 when 'search' then 360 when 'walk-in' then 180 else 180 end;
  ok=consume_registry_rate_limit('registry2:'||p_ip_key||':'||p_token::text||':'||p_action,60,limit_n);
  if not ok then return jsonb_build_object('error','요청이 많습니다. 60초 후 다시 시도해 주세요.','status',429); end if;
  select * into r from registries where public_token=p_token;
  if not found then return jsonb_build_object('error','등록부를 찾을 수 없습니다.','status',404); end if;
  if p_action <> 'metadata' and r.password_digest is not null and crypt(p_password,r.password_digest)<>r.password_digest then
    ok=consume_registry_rate_limit('registry2:failed-password:'||p_ip_key||':'||p_token::text,60,10);
    return jsonb_build_object('error',case when ok then '비밀번호가 맞지 않습니다.' else '60초 후 다시 시도해 주세요.' end,'status',case when ok then 401 else 429 end);
  end if;
  if p_action not in ('metadata','unlock') and r.status<>'open' then return jsonb_build_object('error','서명 수합이 종료되었습니다.','status',409); end if;
  if p_action='submit' and p_participant_id is not null then
    ok=consume_registry_rate_limit('registry2:participant:'||r.id::text||':'||p_participant_id::text,60,12);
    if not ok then return jsonb_build_object('error','잠시 후 다시 제출해 주세요.','status',429); end if;
    select * into p from registry_participants where id=p_participant_id and registry_id=r.id;
    if p.verification_digest is not null and (p_code='' or crypt(p_code,p.verification_digest)<>p.verification_digest) then
      ok=consume_registry_rate_limit('registry2:failed-code:'||p_ip_key||':'||p_token::text,60,12);
      return jsonb_build_object('error',case when ok then '확인 코드가 맞지 않습니다.' else '60초 후 확인 코드를 다시 입력해 주세요.' end,'status',case when ok then 401 else 429 end);
    end if;
  end if;
  if p_action='search' then
    select coalesce(jsonb_agg(q),'[]') into candidates from (
      select to_jsonb(x)-'verification_digest' || jsonb_build_object('requires_identity',exists(select 1 from registry_participants other where other.registry_id=x.registry_id and other.name=x.name and other.id<>x.id),'requires_code',x.verification_digest is not null) as q
      from registry_participants x where x.registry_id=r.id and x.name ilike '%'||replace(replace(replace(p_query,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%' escape E'\\'
      and (p_code='' or (x.verification_digest is not null and crypt(p_code,x.verification_digest)=x.verification_digest))
      order by x.row_number limit 20
    ) found;
  end if;
  if p_action='search' and p_code<>'' and candidates='[]'::jsonb then
    ok=consume_registry_rate_limit('registry2:failed-code:'||p_ip_key||':'||p_token::text,60,12);
    if not ok then return jsonb_build_object('error','60초 후 확인 코드를 다시 입력해 주세요.','status',429); end if;
  end if;
  return jsonb_build_object('registry',to_jsonb(r)-'password_digest','has_password',r.password_digest is not null,'columns',coalesce((select jsonb_agg(c order by c.position) from registry_columns c where c.registry_id=r.id),'[]'),
    'participants',coalesce(candidates,'[]'),'participant',case when p.id is null then null else to_jsonb(p)-'verification_digest' || jsonb_build_object('code_valid',p.verification_digest is not null and p_code<>'' and crypt(p_code,p.verification_digest)=p.verification_digest,'requires_code',p.verification_digest is not null) end,
    'peers',case when p.id is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x)-'verification_digest') from registry_participants x where x.registry_id=r.id and x.name=p.name),'[]') end,
    'prior_signature',case when p.id is null then null else (select to_jsonb(s) from registry_signatures s where s.participant_id=p.id) end,
    'duplicate_count',case when p_action='walk-in' then (select count(*) from registry_participants x where x.registry_id=r.id and x.name=p_query) else 0 end);
end $$;
revoke all on function public.registry_public_context(uuid,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.registry_public_context(uuid,text,text,text,text,uuid,text) to service_role;

-- 모든 서명 삽입 경로의 상태 트리거를 유지하면서 완료 RPC에서는 항목과 상태를 한 번에 갱신.
create or replace function public.sync_registry_signature_status() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    update registry_participants set status='pending',signed_at=null where id=old.participant_id;
    return old;
  end if;
  if current_setting('schooldoc.registry_commit',true) is distinct from 'yes' then
    update registry_participants set status='signed',signed_at=new.created_at where id=new.participant_id;
  end if;
  return new;
end $$;

create or replace function public.registry_commit_signature(p_registry_id uuid,p_token uuid,p_password text,p_participant_id uuid,p_request_id uuid,p_expected_updated_at timestamptz,p_name text,p_ciphertext text,p_source text,p_path text,p_hash text,p_width integer,p_height integer,p_request_digest text,p_confirm_duplicate boolean default false)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare r public.registries; p public.registry_participants; s public.registry_signatures; stamp timestamptz;
begin
  -- 공유 설정 변경/종료와 경합을 막고 현장 입력의 연번을 직렬화한다.
  if p_name is null then
    select * into r from registries where id=p_registry_id for share;
  else
    select * into r from registries where id=p_registry_id for update;
  end if;
  if not found or r.public_token<>p_token or r.status<>'open' then return jsonb_build_object('status',409,'error','공개 설정이 바뀌었습니다. 화면을 다시 열어 주세요.'); end if;
  if r.password_digest is not null and crypt(p_password,r.password_digest)<>r.password_digest then return jsonb_build_object('status',401,'error','비밀번호가 맞지 않습니다.'); end if;
  select * into p from registry_participants where id=p_participant_id and registry_id=r.id for update;
  if p.id is not null then
    select * into s from registry_signatures where participant_id=p.id;
    if s.id is not null then
      if s.request_id=p_request_id and s.content_hash=p_hash and s.request_digest=p_request_digest then return jsonb_build_object('ok',true,'replayed',true); end if;
      return jsonb_build_object('status',409,'error','이미 서명이 제출되었습니다.');
    end if;
    if p_expected_updated_at is null or p.updated_at<>p_expected_updated_at then return jsonb_build_object('status',409,'error','참석 정보가 바뀌었습니다. 다시 확인해 주세요.'); end if;
  else
    if p_name is null or length(trim(p_name)) not between 1 and 100 or (r.mode<>'custom' and not r.allow_walk_in) then return jsonb_build_object('status',403,'error','현장 참석자 추가가 허용되지 않습니다.'); end if;
    if not p_confirm_duplicate and exists(select 1 from registry_participants where registry_id=r.id and name=trim(p_name)) then return jsonb_build_object('status',409,'error','같은 이름이 등록되었습니다. 참석 정보를 다시 확인해 주세요.'); end if;
    if (select count(*) from registry_participants where registry_id=r.id)>=2000 then return jsonb_build_object('status',422,'error','참석자는 2000명까지 등록할 수 있습니다.'); end if;
    insert into registry_participants(id,registry_id,row_number,name,field_values,field_values_ciphertext)
      values(p_participant_id,r.id,(select coalesce(max(row_number),0)+1 from registry_participants where registry_id=r.id),trim(p_name),null,p_ciphertext) returning * into p;
  end if;
  perform set_config('schooldoc.registry_commit','yes',true);
  insert into registry_signatures(registry_id,participant_id,request_id,source,storage_path,content_hash,width,height,request_digest)
    values(r.id,p.id,p_request_id,p_source,p_path,p_hash,p_width,p_height,p_request_digest) returning created_at into stamp;
  update registry_participants set field_values=null,field_values_ciphertext=p_ciphertext,status='signed',signed_at=stamp where id=p.id;
  perform set_config('schooldoc.registry_commit','',true);
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.registry_commit_signature(uuid,uuid,text,uuid,uuid,timestamptz,text,text,text,text,text,integer,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.registry_commit_signature(uuid,uuid,text,uuid,uuid,timestamptz,text,text,text,text,text,integer,integer,text,boolean) to service_role;

create table public.registry_cleanup_attempts(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,registry_id uuid not null,purpose text not null check(purpose in ('purge','upload')),file_count integer not null default 0,updated_at timestamptz not null default now());
alter table public.registry_cleanup_attempts enable row level security;
grant select on public.registry_cleanup_attempts to authenticated;
grant all on public.registry_cleanup_attempts to service_role;
create policy "Owner reads registry cleanup attempts" on public.registry_cleanup_attempts for select to authenticated using(owner_id=(select auth.uid()));
revoke insert,update,delete on public.registry_cleanup_attempts from authenticated,anon;
-- 날짜별 작은 배치로 정리한다. 제출/검색 요청마다 전체 카운터 정리를 실행하지 않는다.
create or replace function public.prune_registry_rate_limits() returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  delete from registry_public_rate_limits where request_key in (select request_key from registry_public_rate_limits where request_key like 'registry2:%' and updated_at<now()-interval '1 day' limit 1000);
  get diagnostics n=row_count; return n;
end $$;
revoke all on function public.prune_registry_rate_limits() from public,anon,authenticated;
grant execute on function public.prune_registry_rate_limits() to service_role;

create or replace function public.registry_set_verification_code(p_registry_id uuid,p_participant_id uuid,p_owner_id uuid,p_code text) returns boolean
language plpgsql security definer set search_path=public,extensions as $$
begin
  if not exists(select 1 from registries where id=p_registry_id and owner_id=p_owner_id) then return false; end if;
  update registry_participants set verification_digest=crypt(p_code,gen_salt('bf')) where id=p_participant_id and registry_id=p_registry_id;
  return found;
end $$;
revoke all on function public.registry_set_verification_code(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.registry_set_verification_code(uuid,uuid,uuid,text) to service_role;

-- Storage 삭제가 진행되는 동안 재개·명단 변경을 잠가 확인한 대상을 보존한다.
alter table public.registries add column purge_started_at timestamptz;
alter table public.registries add column purge_file_count integer;
create function public.registry_guard_purge() returns trigger language plpgsql set search_path=public as $$
declare rid uuid; locked_at timestamptz;
begin
  if current_setting('schooldoc.registry_purge',true)='yes' then return coalesce(new,old); end if;
  if tg_table_name='registries' then
    if old.purge_started_at is not null then raise exception '파기 중인 등록부는 다시 열거나 변경할 수 없습니다. 파기를 재시도해 주세요.'; end if;
  else
    rid=case when tg_op='DELETE' then old.registry_id else new.registry_id end;
    select purge_started_at into locked_at from registries where id=rid for share;
    if locked_at is not null then raise exception '파기 중인 등록부입니다.'; end if;
  end if;
  return coalesce(new,old);
end $$;
create trigger registry_guard_purge before update or delete on registries for each row execute function registry_guard_purge();
create trigger registry_participants_guard_purge before insert or update or delete on registry_participants for each row execute function registry_guard_purge();
create trigger registry_columns_guard_purge before insert or update or delete on registry_columns for each row execute function registry_guard_purge();
create trigger registry_signatures_guard_purge before insert or update or delete on registry_signatures for each row execute function registry_guard_purge();

alter table public.privacy_purge_log drop constraint privacy_purge_log_resource_kind_check;
alter table public.privacy_purge_log add constraint privacy_purge_log_resource_kind_check check(resource_kind in ('consent-form','data-collect','registry'));
create function public.registry_prepare_purge(p_registry_id uuid,p_owner_id uuid,p_records integer,p_signatures integer,p_files integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.registries; records integer; signatures integer;
begin
  select * into r from registries where id=p_registry_id and owner_id=p_owner_id for update;
  if not found then return jsonb_build_object('status',404,'error','등록부를 찾을 수 없습니다.'); end if;
  if r.status<>'closed' then return jsonb_build_object('status',409,'error','수합을 종료한 뒤 파기해 주세요.'); end if;
  select count(*) into records from registry_participants where registry_id=r.id;
  select count(*) into signatures from registry_signatures where registry_id=r.id;
  if records<>p_records or signatures<>p_signatures or p_files<0 then return jsonb_build_object('status',409,'error','파기 수량이 바뀌었습니다. 대상을 다시 확인해 주세요.'); end if;
  perform set_config('schooldoc.registry_purge','yes',true);
  update registries set purge_started_at=coalesce(purge_started_at,now()),purge_file_count=coalesce(purge_file_count,p_files) where id=r.id;
  perform set_config('schooldoc.registry_purge','',true);
  return jsonb_build_object('ok',true);
end $$;
create function public.registry_finish_purge(p_registry_id uuid,p_owner_id uuid,p_records integer,p_signatures integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.registries;
begin
  select * into r from registries where id=p_registry_id and owner_id=p_owner_id for update;
  if not found then return jsonb_build_object('status',404,'error','등록부를 찾을 수 없습니다.'); end if;
  if r.status<>'closed' or r.purge_started_at is null then return jsonb_build_object('status',409,'error','파기 대상 확인이 필요합니다.'); end if;
  if (select count(*) from registry_participants where registry_id=r.id)<>p_records or (select count(*) from registry_signatures where registry_id=r.id)<>p_signatures then return jsonb_build_object('status',409,'error','파기 수량이 바뀌었습니다.'); end if;
  perform set_config('schooldoc.registry_purge','yes',true);
  insert into privacy_purge_log(owner_id,resource_kind,resource_id,record_count,file_count) values(p_owner_id,'registry',r.id,p_records,coalesce(r.purge_file_count,0));
  delete from registries where id=r.id;
  delete from registry_cleanup_attempts where registry_id=r.id and owner_id=p_owner_id;
  perform set_config('schooldoc.registry_purge','',true);
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.registry_prepare_purge(uuid,uuid,integer,integer,integer), public.registry_finish_purge(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.registry_prepare_purge(uuid,uuid,integer,integer,integer), public.registry_finish_purge(uuid,uuid,integer,integer) to service_role;
create function public.registry_retained_work() returns table(id uuid,title text,retention_months integer,closed_at timestamptz,record_count bigint,file_count bigint)
language sql stable security invoker set search_path=public as $$
 select r.id,r.title,r.retention_months,r.closed_at,(select count(*) from registry_participants p where p.registry_id=r.id),(select count(*) from registry_signatures s where s.registry_id=r.id)
 from registries r where r.owner_id=(select auth.uid()) and r.status='closed' and r.closed_at is not null and r.retention_months is not null;
$$;
revoke all on function public.registry_retained_work() from public,anon;
grant execute on function public.registry_retained_work() to authenticated;
-- 관리 화면 진입 시 작은 배치 한 번만 청소한다. 시간 인덱스는 다른 기능의 카운터에도 유용하다.
create index if not exists registry_public_rate_limits_updated_idx on registry_public_rate_limits(updated_at);

-- 교사 추가도 현장 제출과 같은 부모 잠금을 사용해 연번 중복과 2,000명 한도 경합을 막는다.
create or replace function public.registry_owner_add_participant(p_registry_id uuid,p_owner_id uuid,p_name text,p_ciphertext text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.registries; p public.registry_participants;
begin
  select * into r from registries where id=p_registry_id and owner_id=p_owner_id for update;
  if not found then return jsonb_build_object('error','등록부를 찾을 수 없습니다.','status',404); end if;
  if r.purge_started_at is not null then return jsonb_build_object('error','파기가 진행 중입니다.','status',409); end if;
  if length(trim(p_name)) not between 1 and 100 or p_ciphertext is null then return jsonb_build_object('error','참석 정보를 확인해 주세요.','status',422); end if;
  if (select count(*) from registry_participants where registry_id=r.id)>=2000 then return jsonb_build_object('error','참석자는 2,000명까지 등록할 수 있습니다.','status',422); end if;
  insert into registry_participants(registry_id,row_number,name,field_values,field_values_ciphertext)
  values(r.id,(select coalesce(max(row_number),0)+1 from registry_participants where registry_id=r.id),trim(p_name),null,p_ciphertext) returning * into p;
  return jsonb_build_object('participant',jsonb_build_object('id',p.id,'rowNumber',p.row_number,'name',p.name));
end $$;
revoke all on function public.registry_owner_add_participant(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.registry_owner_add_participant(uuid,uuid,text,text) to service_role;
