create extension if not exists pgcrypto;

create table if not exists public.data_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_token uuid not null default gen_random_uuid() unique,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  kind text not null check (kind in ('worksheet', 'plan', 'consent', 'custom')),
  mode text not null default 'fixed' check (mode in ('fixed', 'custom')),
  allow_walk_in boolean not null default false,
  template_path text check (template_path is null or char_length(template_path) between 1 and 1000),
  template_name_ciphertext text,
  template_size bigint check (template_size is null or template_size > 0),
  template_mime text,
  status text not null default 'open' check (status in ('open', 'closed')),
  due_at timestamptz,
  password_digest text,
  allow_resubmit boolean not null default true,
  retention_months integer not null default 12 check (retention_months between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_collection_targets (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.data_collections(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  label_ciphertext text not null,
  owner_ciphertext text not null default '',
  label_search jsonb not null default '[]'::jsonb check (jsonb_typeof(label_search) = 'array'),
  owner_search jsonb not null default '[]'::jsonb check (jsonb_typeof(owner_search) = 'array'),
  display_label text not null,
  display_owner text not null default '',
  personal_token uuid not null default gen_random_uuid() unique,
  status text not null default 'unsubmitted' check (status in ('unsubmitted', 'confirmed', 'corrected', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(collection_id, row_number)
);

create table if not exists public.data_collection_files (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.data_collections(id) on delete cascade,
  target_id uuid references public.data_collection_targets(id) on delete cascade,
  response_kind text not null check (response_kind in ('confirmed', 'corrected', 'submitted')),
  revision integer not null check (revision > 0),
  is_current boolean not null default true,
  storage_path text check (storage_path is null or char_length(storage_path) between 1 and 1000),
  original_name_ciphertext text,
  content_hash text,
  byte_size bigint check (byte_size is null or byte_size > 0),
  mime_type text,
  note_ciphertext text,
  uploaded_at timestamptz not null default now(),
  check ((response_kind = 'confirmed' and storage_path is null) or (response_kind <> 'confirmed' and storage_path is not null)),
  unique(collection_id, target_id, revision)
);

create table if not exists public.data_collect_rate_limits (
  request_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key(request_key, window_started_at)
);

create unique index if not exists data_collection_files_one_current
on public.data_collection_files(collection_id, target_id)
where is_current;

create or replace function public.touch_data_collection_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists data_collections_touch_updated_at on public.data_collections;
create trigger data_collections_touch_updated_at before update on public.data_collections
for each row execute function public.touch_data_collection_updated_at();

create or replace function public.set_data_collection_password(p_collection_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if char_length(p_password) < 4 or char_length(p_password) > 200 then
    raise exception '비밀번호는 4자 이상 200자 이하로 입력하세요.';
  end if;
  update public.data_collections
  set password_digest = crypt(p_password, gen_salt('bf', 10))
  where id = p_collection_id and owner_id = auth.uid();
  if not found then raise exception '자료 수합을 찾을 수 없습니다.'; end if;
end;
$$;

create or replace function public.clear_data_collection_password(p_collection_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.data_collections set password_digest = null
  where id = p_collection_id and owner_id = auth.uid();
  if not found then raise exception '자료 수합을 찾을 수 없습니다.'; end if;
end;
$$;

create or replace function public.verify_data_collection_password(p_collection_id uuid, p_password text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select password_digest is null or password_digest = crypt(p_password, password_digest)
  from public.data_collections where id = p_collection_id;
$$;

create or replace function public.consume_data_collect_rate_limit(p_request_key text, p_window_seconds integer, p_max_requests integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1));
  v_count integer;
begin
  insert into public.data_collect_rate_limits(request_key, window_started_at, request_count)
  values (p_request_key, v_window, 1)
  on conflict (request_key, window_started_at)
  do update set request_count = public.data_collect_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= greatest(p_max_requests, 1);
end;
$$;

revoke all on function public.verify_data_collection_password(uuid, text) from public, anon, authenticated;
revoke all on function public.consume_data_collect_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.set_data_collection_password(uuid, text) to authenticated;
grant execute on function public.clear_data_collection_password(uuid) to authenticated;
grant execute on function public.verify_data_collection_password(uuid, text) to service_role;
grant execute on function public.consume_data_collect_rate_limit(text, integer, integer) to service_role;

alter table public.data_collections enable row level security;
alter table public.data_collection_targets enable row level security;
alter table public.data_collection_files enable row level security;
alter table public.data_collect_rate_limits enable row level security;

-- 자료 수합은 처음부터 Edge Function이 복호화·권한 검사를 맡는다. 브라우저가 암호문 테이블을
-- 직접 읽거나 쓰는 정책을 만들지 않아, 나중에 암호화를 다시 옮길 필요가 없게 한다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('data-collect-templates', 'data-collect-templates', false, 31457280,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/x-hwp', 'application/haansofthwp', 'application/octet-stream', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 31457280;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('data-collect-files', 'data-collect-files', false, 52428800,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/x-hwp', 'application/haansofthwp', 'application/octet-stream', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 52428800;

do $$ begin alter publication supabase_realtime add table public.data_collections; exception when duplicate_object then null; end $$;
