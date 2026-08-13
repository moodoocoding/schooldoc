create extension if not exists pgcrypto;

create table if not exists public.consent_forms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_token uuid not null default gen_random_uuid() unique,
  title text not null check (char_length(title) between 1 and 200),
  file_name text not null check (char_length(file_name) between 1 and 500),
  source_path text not null check (char_length(source_path) between 1 and 1000),
  description text not null default '' check (char_length(description) <= 4000),
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  page_count integer not null default 1 check (page_count between 1 and 100),
  recipient_mode text not null default 'open' check (recipient_mode in ('named', 'open')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  deadline date,
  password_digest text,
  allow_resubmission boolean not null default false,
  response_count integer not null default 0 check (response_count >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consent_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.consent_forms(id) on delete cascade,
  values jsonb not null default '{}'::jsonb check (jsonb_typeof(values) = 'object'),
  submitted_at timestamptz not null default now()
);

create table if not exists public.consent_response_signatures (
  response_id uuid not null references public.consent_responses(id) on delete cascade,
  field_id text not null check (char_length(field_id) between 1 and 100),
  storage_path text not null check (char_length(storage_path) between 1 and 1000),
  created_at timestamptz not null default now(),
  primary key (response_id, field_id)
);

create table if not exists public.consent_rate_limits (
  request_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (request_key, window_started_at)
);

create or replace function public.touch_consent_form_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists consent_forms_touch_updated_at on public.consent_forms;
create trigger consent_forms_touch_updated_at before update on public.consent_forms
for each row execute function public.touch_consent_form_updated_at();

create or replace function public.set_consent_form_password(p_form_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if char_length(p_password) < 4 or char_length(p_password) > 200 then raise exception '비밀번호는 4자 이상 200자 이하로 입력하세요.'; end if;
  update public.consent_forms set password_digest = crypt(p_password, gen_salt('bf', 10))
  where id = p_form_id and owner_id = auth.uid();
  if not found then raise exception '가정통신문을 찾을 수 없습니다.'; end if;
end;
$$;

create or replace function public.clear_consent_form_password(p_form_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.consent_forms set password_digest = null where id = p_form_id and owner_id = auth.uid();
  if not found then raise exception '가정통신문을 찾을 수 없습니다.'; end if;
end;
$$;

create or replace function public.verify_consent_form_password(p_form_id uuid, p_password text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select password_digest is null or password_digest = crypt(p_password, password_digest)
  from public.consent_forms where id = p_form_id;
$$;

create or replace function public.increment_consent_response_count(p_form_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.consent_forms set response_count = response_count + 1 where id = p_form_id;
$$;

create or replace function public.consume_consent_rate_limit(p_request_key text, p_window_seconds integer, p_max_requests integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1));
  v_count integer;
begin
  insert into public.consent_rate_limits(request_key, window_started_at, request_count) values (p_request_key, v_window, 1)
  on conflict (request_key, window_started_at) do update set request_count = public.consent_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= greatest(p_max_requests, 1);
end;
$$;

revoke all on function public.verify_consent_form_password(uuid, text) from public, anon, authenticated;
revoke all on function public.increment_consent_response_count(uuid) from public, anon, authenticated;
revoke all on function public.consume_consent_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.verify_consent_form_password(uuid, text) to service_role;
grant execute on function public.increment_consent_response_count(uuid) to service_role;
grant execute on function public.consume_consent_rate_limit(text, integer, integer) to service_role;
grant execute on function public.set_consent_form_password(uuid, text) to authenticated;
grant execute on function public.clear_consent_form_password(uuid) to authenticated;

alter table public.consent_forms enable row level security;
alter table public.consent_responses enable row level security;
alter table public.consent_response_signatures enable row level security;
alter table public.consent_rate_limits enable row level security;

create policy "Teachers manage their consent forms" on public.consent_forms for all to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Teachers read their consent responses" on public.consent_responses for select to authenticated
using (exists (select 1 from public.consent_forms f where f.id = form_id and f.owner_id = auth.uid()));
create policy "Teachers read their consent signatures" on public.consent_response_signatures for select to authenticated
using (exists (
  select 1 from public.consent_responses r join public.consent_forms f on f.id = r.form_id
  where r.id = response_id and f.owner_id = auth.uid()
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consent-documents', 'consent-documents', false, 31457280, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 31457280, allowed_mime_types = array['application/pdf'];
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consent-signatures', 'consent-signatures', false, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 524288, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

create policy "Teachers upload their consent documents" on storage.objects for insert to authenticated
with check (bucket_id = 'consent-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Teachers read their consent documents" on storage.objects for select to authenticated
using (bucket_id = 'consent-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Teachers update their consent documents" on storage.objects for update to authenticated
using (bucket_id = 'consent-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Teachers delete their consent documents" on storage.objects for delete to authenticated
using (bucket_id = 'consent-documents' and (storage.foldername(name))[1] = auth.uid()::text);

do $$ begin alter publication supabase_realtime add table public.consent_forms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.consent_responses; exception when duplicate_object then null; end $$;
