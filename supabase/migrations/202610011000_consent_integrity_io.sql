-- 원본·응답·명단을 확정 단위로 저장하고 필요한 목록만 읽는다.
-- 기존 제출 이력과 암호문은 보존한다. 신규 생성은 준비 중으로 시작한다.
alter table public.consent_forms
  add column if not exists publication_state text not null default 'ready'
    check (publication_state in ('preparing', 'ready', 'purging')),
  add column if not exists document_revision integer not null default 1 check (document_revision > 0),
  add column if not exists current_response_count integer not null default 0 check (current_response_count >= 0),
  add column if not exists purge_file_count integer check(purge_file_count >= 0),
  add column if not exists field_count integer generated always as (jsonb_array_length(fields)) stored;
alter table public.consent_forms alter column publication_state set default 'preparing';
alter table public.consent_responses
  add column if not exists request_id uuid,
  add column if not exists request_digest text,
  add column if not exists document_revision integer not null default 1;
alter table public.consent_recipients add column if not exists identity_lookup text;

create unique index if not exists consent_response_request_idx on public.consent_responses(form_id, request_id) where request_id is not null;
create index if not exists consent_forms_owner_created_idx on public.consent_forms(owner_id, created_at desc, id desc);
create index if not exists consent_responses_form_submitted_idx on public.consent_responses(form_id, submitted_at desc, id desc);
create index if not exists consent_responses_recipient_submitted_idx on public.consent_responses(recipient_id, submitted_at desc, id desc) where recipient_id is not null;
create index if not exists consent_recipients_form_created_idx on public.consent_recipients(form_id, created_at, id);


update public.consent_forms f set current_response_count = (
  select count(*) from public.consent_responses r
  where r.form_id = f.id and (r.recipient_id is null or exists (
    select 1 from public.consent_recipients p where p.form_id = f.id and p.id = r.recipient_id and p.response_id = r.id
  ))
);

create table if not exists public.consent_cleanup_failures (
  id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete cascade,
  form_id uuid not null, operation text not null check (operation in ('submission', 'document', 'purge')),
  storage_paths jsonb not null default '[]', created_at timestamptz not null default now()
);
alter table public.consent_cleanup_failures enable row level security;
-- 내부 Storage 식별자만 저장한다. 이름·문서 제목·응답·원본 파일명·오류 원문은 기록하지 않는다.

create or replace function public.guard_consent_document()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.publication_state <> 'preparing' and (old.status <> 'closed' or old.publication_state <> 'purging') then
      raise exception '409|종료 후 확인한 수합만 파기할 수 있습니다.';
    end if;
    return old;
  end if;
  if old.publication_state = 'purging' and (new.status <> 'closed' or new.publication_state <> 'purging') then
    raise exception '409|파기 중인 수합은 재개할 수 없습니다.';
  end if;
  if row(new.source_path,new.fields,new.page_count,new.page_sizes,new.file_name) is distinct from
     row(old.source_path,old.fields,old.page_count,old.page_sizes,old.file_name) then
    if exists(select 1 from public.consent_responses where form_id = old.id) then
      raise exception '409|응답이 있는 수합은 원본과 질문을 변경할 수 없습니다. 사본을 만들어 주세요.';
    end if;
    new.document_revision := old.document_revision + 1;
  end if;
  return new;
end $$;
create trigger consent_document_guard before update or delete on public.consent_forms for each row execute function public.guard_consent_document();

-- 브라우저 직접 수정·삭제를 막아 원본 고정과 파일 삭제 순서를 우회하지 못하게 한다.
drop policy if exists "Teachers manage their consent forms" on public.consent_forms;
create policy "Teachers read their consent forms" on public.consent_forms for select to authenticated using(owner_id = auth.uid());
create policy "Teachers prepare their consent forms" on public.consent_forms for insert to authenticated
with check(owner_id = auth.uid() and source_path like owner_id::text || '/' || id::text || '/%' and publication_state = 'preparing' and status = 'open' and response_count = 0 and current_response_count = 0);
drop policy if exists "Teachers delete their consent signature files" on storage.objects;
drop policy if exists "Teachers remove their consent recipients" on public.consent_recipients;
drop policy if exists "Teachers update their consent documents" on storage.objects;
drop policy if exists "Teachers delete their consent documents" on storage.objects;

create or replace function public.consent_public_context(p_token uuid, p_recipient_token uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.consent_forms; p public.consent_recipients;
begin
  select * into f from public.consent_forms where public_token = p_token;
  if not found then raise exception '404|가정통신문을 찾을 수 없습니다.'; end if;
  if p_recipient_token is not null then
    select * into p from public.consent_recipients where token = p_recipient_token and form_id = f.id;
    if not found then raise exception '404|이 링크의 수신자를 찾을 수 없습니다.'; end if;
  end if;
  return jsonb_build_object('form',to_jsonb(f),'recipient',case when p.id is null then null else to_jsonb(p) end);
end $$;

create or replace function public.commit_consent_response(
  p_token uuid, p_recipient_token uuid, p_response_id uuid, p_request_id uuid, p_request_digest text,
  p_values_ciphertext text, p_signatures jsonb, p_document_revision integer, p_expected_response_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.consent_forms; p public.consent_recipients; r public.consent_responses; s jsonb; current_increment integer := 1;
begin
  select * into f from public.consent_forms where public_token = p_token for update;
  if not found then raise exception '404|가정통신문을 찾을 수 없습니다.'; end if;
  if p_recipient_token is not null then
    select * into p from public.consent_recipients where form_id = f.id and token = p_recipient_token for update;
    if not found then raise exception '404|이 링크의 수신자를 찾을 수 없습니다.'; end if;
  end if;
  select * into r from public.consent_responses where form_id = f.id and request_id = p_request_id;
  if found then
    if r.request_digest is distinct from p_request_digest or r.recipient_id is distinct from p.id then
      raise exception '409|같은 제출 요청의 내용이 달라졌습니다. 다시 확인해 주세요.';
    end if;
    return jsonb_build_object('responseId',r.id,'submittedAt',r.submitted_at,'replayed',true);
  end if;
  if f.publication_state <> 'ready' or f.status <> 'open' or (f.deadline is not null and f.deadline < current_date) then
    raise exception '410|응답이 종료되었거나 아직 준비되지 않았습니다.';
  end if;
  if f.document_revision <> p_document_revision then raise exception '409|원본이 변경되었습니다. 입력을 보존한 채 원본을 다시 확인해 주세요.'; end if;
  if p.id is not null then
    if p.response_id is not null and not f.allow_resubmission then raise exception '409|이미 제출한 가정통신문입니다.'; end if;
    if p.response_id is distinct from p_expected_response_id then raise exception '409|다른 화면에서 응답이 변경되었습니다. 최신 응답을 다시 확인해 주세요.'; end if;
    if p.response_id is not null then current_increment := 0; end if;
  end if;
  if p_values_ciphertext is null or p_request_id is null or p_request_digest is null or jsonb_typeof(p_signatures) <> 'array' then
    raise exception '400|응답 형식이 올바르지 않습니다.';
  end if;
  insert into public.consent_responses(id,form_id,recipient_id,values_ciphertext,request_id,request_digest,document_revision)
    values(p_response_id,f.id,p.id,p_values_ciphertext,p_request_id,p_request_digest,f.document_revision) returning * into r;
  for s in select * from jsonb_array_elements(p_signatures) loop
    if not exists(select 1 from jsonb_array_elements(f.fields) x where x->>'id' = s->>'field_id' and x->>'kind' = 'signature') then
      raise exception '400|서명 항목이 올바르지 않습니다.';
    end if;
    if s->>'storage_path' not like f.id::text || '/' || p_response_id::text || '/%' and not exists(
      select 1 from public.consent_response_signatures where response_id = p.response_id
        and field_id = s->>'field_id' and storage_path = s->>'storage_path'
    ) then raise exception '400|서명 저장 위치가 올바르지 않습니다.'; end if;
    insert into public.consent_response_signatures(response_id,field_id,storage_path) values(r.id,s->>'field_id',s->>'storage_path');
  end loop;
  if p.id is not null then update public.consent_recipients set response_id = r.id, submitted_at = r.submitted_at where id = p.id; end if;
  update public.consent_forms set response_count = response_count + 1, current_response_count = current_response_count + current_increment where id = f.id;
  return jsonb_build_object('responseId',r.id,'submittedAt',r.submitted_at,'replayed',false);
end $$;

create or replace function public.finalize_consent_form(p_form_id uuid, p_owner_id uuid, p_recipients jsonb, p_password text default null)
returns jsonb language plpgsql security definer set search_path = public,extensions as $$
declare f public.consent_forms; n integer;
begin
  select * into f from public.consent_forms where id = p_form_id and owner_id = p_owner_id for update;
  if not found then raise exception '403|이 수합을 관리할 권한이 없습니다.'; end if;
  if f.publication_state = 'purging' or exists(select 1 from public.consent_responses where form_id=f.id) then raise exception '409|응답이 있는 수합의 명단은 교체할 수 없습니다.'; end if;
  if jsonb_typeof(p_recipients) <> 'array' or jsonb_array_length(p_recipients)>2000 then raise exception '422|명단 형식과 수량을 확인해 주세요.'; end if;
  n := jsonb_array_length(p_recipients);
  if f.recipient_mode = 'named' and n = 0 then raise exception '422|명단 수합에는 대상이 필요합니다.'; end if;
  if f.recipient_mode = 'open' and n <> 0 then raise exception '422|공개 수합에 명단을 저장할 수 없습니다.'; end if;
  delete from public.consent_recipients where form_id = f.id and id not in(select (x->>'id')::uuid from jsonb_array_elements(p_recipients) x);
  insert into public.consent_recipients(id,form_id,identity_ciphertext,name_lookup,identity_lookup,display_hint)
    select (x->>'id')::uuid,f.id,x->>'identity_ciphertext',x->>'name_lookup',x->>'identity_lookup',x->>'display_hint' from jsonb_array_elements(p_recipients) x
    on conflict(id) do update set identity_ciphertext=excluded.identity_ciphertext,name_lookup=excluded.name_lookup,identity_lookup=excluded.identity_lookup,display_hint=excluded.display_hint
    where consent_recipients.form_id=f.id and consent_recipients.identity_lookup is distinct from excluded.identity_lookup;
  if (select count(*) from public.consent_recipients where form_id=f.id) <> n then raise exception '409|명단 식별자가 충돌했습니다.'; end if;
  if p_password is not null and (char_length(p_password)<4 or char_length(p_password)>200) then raise exception '422|비밀번호는 4자 이상 200자 이하로 입력하세요.'; end if;
  update public.consent_forms set recipient_count=n,publication_state='ready',password_digest=case when p_password is null then password_digest else crypt(p_password,gen_salt('bf',10)) end
    where id=f.id returning * into f;
  return to_jsonb(f) - 'password_digest' || jsonb_build_object('password_enabled',f.password_digest is not null);
end $$;

create or replace function public.save_consent_form(p_form_id uuid,p_owner_id uuid,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare f public.consent_forms; password_value text;
begin
  select * into f from public.consent_forms where id=p_form_id and owner_id=p_owner_id for update;
  if not found then raise exception '403|이 수합을 관리할 권한이 없습니다.'; end if;
  if f.publication_state='purging' then raise exception '409|파기 중인 수합은 변경할 수 없습니다.'; end if;
  if p_patch ? 'password' then
    password_value := p_patch->>'password';
    if char_length(password_value)<4 or char_length(password_value)>200 then raise exception '422|비밀번호는 4자 이상 200자 이하로 입력하세요.'; end if;
  end if;
  if p_patch ? 'source_path' and p_patch->>'source_path' not like f.owner_id::text || '/' || f.id::text || '/%' then raise exception '400|원본 저장 위치가 올바르지 않습니다.'; end if;
  update public.consent_forms set
    title=coalesce(p_patch->>'title',title), description=coalesce(p_patch->>'description',description),
    deadline=case when p_patch ? 'deadline' then nullif(p_patch->>'deadline','')::date else deadline end,
    allow_resubmission=coalesce((p_patch->>'allow_resubmission')::boolean,allow_resubmission),
    retention_months=coalesce((p_patch->>'retention_months')::integer,retention_months),
    status=coalesce(p_patch->>'status',status),
    source_path=coalesce(p_patch->>'source_path',source_path),file_name=coalesce(p_patch->>'file_name',file_name),
    fields=coalesce(p_patch->'fields',fields),page_count=coalesce((p_patch->>'page_count')::integer,page_count),page_sizes=coalesce(p_patch->'page_sizes',page_sizes),
    password_digest=case when p_patch->>'password_enabled'='false' then null when password_value is not null then crypt(password_value,gen_salt('bf',10)) else password_digest end
  where id=f.id returning * into f;
  return to_jsonb(f)-'password_digest' || jsonb_build_object('password_enabled',f.password_digest is not null);
end $$;

create or replace function public.begin_consent_purge(p_form_id uuid,p_owner_id uuid,p_expected_count integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare f public.consent_forms;
begin
  select * into f from public.consent_forms where id=p_form_id and owner_id=p_owner_id for update;
  if not found then raise exception '403|이 수합을 관리할 권한이 없습니다.'; end if;
  if f.status<>'closed' then raise exception '409|진행 중인 수합은 파기할 수 없습니다. 먼저 종료해 주세요.'; end if;
  if p_expected_count is null or p_expected_count<>f.response_count then raise exception '409|파기 대상 수량이 변경되었습니다. 다시 확인해 주세요.'; end if;
  update public.consent_forms set publication_state='purging' where id=f.id;
  return to_jsonb(f)-'password_digest';
end $$;

create or replace function public.finish_consent_purge(p_form_id uuid,p_owner_id uuid,p_file_count integer)
returns void language plpgsql security definer set search_path=public as $$
declare f public.consent_forms;
begin
  select * into f from public.consent_forms where id=p_form_id and owner_id=p_owner_id for update;
  if not found or f.status<>'closed' or f.publication_state<>'purging' then raise exception '409|파기 상태를 다시 확인해 주세요.'; end if;
  delete from public.consent_cleanup_failures where form_id=f.id;
  delete from public.consent_forms where id=f.id;
  insert into public.privacy_purge_log(owner_id,resource_kind,resource_id,record_count,file_count)
    values(p_owner_id,'consent-form',p_form_id,f.response_count,coalesce(f.purge_file_count,p_file_count));
end $$;

-- 위 함수는 Edge Function의 사용자/토큰 검사 후에만 호출한다.
do $$ declare signature regprocedure; begin
  for signature in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in('consent_public_context','commit_consent_response','finalize_consent_form','save_consent_form','begin_consent_purge','finish_consent_purge') loop
    execute format('revoke all on function %s from public, anon, authenticated',signature);
    execute format('grant execute on function %s to service_role',signature);
  end loop;
end $$;

-- 최신 결과를 하나의 기준으로 읽는다. 이력은 별도 상세 조회로 보존한다.
create view public.consent_current_responses with (security_invoker = true) as
select r.* from public.consent_responses r
left join public.consent_recipients p on p.id = r.recipient_id and p.form_id = r.form_id
where r.recipient_id is null or p.response_id = r.id;
grant select on public.consent_current_responses to authenticated, service_role;

create function public.consent_management_bundle(p_form_id uuid, p_owner_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.consent_forms; people jsonb; answers jsonb;
begin
  select * into f from public.consent_forms where id = p_form_id and owner_id = p_owner_id;
  if not found then raise exception '403|이 수합을 관리할 권한이 없습니다.'; end if;
  select coalesce(jsonb_agg(to_jsonb(p)), '[]') into people from
    (select id, token, identity_ciphertext, response_id, submitted_at, created_at
     from public.consent_recipients where form_id = p_form_id order by created_at, id limit 60) p;
  select coalesce(jsonb_agg(to_jsonb(r)), '[]') into answers from
    (select id, recipient_id, submitted_at from public.consent_current_responses
     where form_id = p_form_id order by submitted_at desc, id desc limit 60) r;
  return jsonb_build_object('form', (to_jsonb(f) - 'password_digest') || jsonb_build_object('password_enabled', f.password_digest is not null),
    'recipients', people, 'responses', answers);
end; $$;
revoke all on function public.consent_management_bundle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consent_management_bundle(uuid, uuid) to service_role;
-- 모든 관리 변경은 소유자를 확인한 새 원자적 관리 API를 거친다.
revoke execute on function public.set_consent_form_password(uuid, text) from public, anon, authenticated;
revoke execute on function public.clear_consent_form_password(uuid) from public, anon, authenticated;
