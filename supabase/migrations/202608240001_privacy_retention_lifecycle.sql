-- 개인정보는 업무가 끝난 뒤부터 보관기간을 계산한다. 진행 중인 업무는 파기 대상으로 잡지 않는다.
alter table public.consent_forms add column if not exists closed_at timestamptz;
alter table public.data_collections add column if not exists closed_at timestamptz;

update public.consent_forms set closed_at = updated_at where status = 'closed' and closed_at is null;
update public.data_collections set closed_at = updated_at where status = 'closed' and closed_at is null;

create or replace function public.track_closed_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'closed' then new.closed_at = now();
    elsif new.status = 'open' then new.closed_at = null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists consent_forms_track_closed_at on public.consent_forms;
create trigger consent_forms_track_closed_at before update on public.consent_forms
for each row execute function public.track_closed_at();

drop trigger if exists data_collections_track_closed_at on public.data_collections;
create trigger data_collections_track_closed_at before update on public.data_collections
for each row execute function public.track_closed_at();

-- 사용자 설정은 새 업무의 기본값일 뿐 기존 업무를 소급 변경하거나 자동 삭제하지 않는다.
create table if not exists public.teacher_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_retention_months integer not null default 3 check (default_retention_months between 1 and 120),
  purge_mode text not null default 'review' check (purge_mode = 'review'),
  updated_at timestamptz not null default now()
);

alter table public.teacher_privacy_settings enable row level security;
drop policy if exists "Teachers manage their privacy settings" on public.teacher_privacy_settings;
create policy "Teachers manage their privacy settings" on public.teacher_privacy_settings for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 파기 이력은 제목·이름·파일명을 담지 않는다. 삭제된 자료를 되살릴 수 없는 최소 감사 기록이다.
create table if not exists public.privacy_purge_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('consent-form', 'data-collect')),
  resource_id uuid not null,
  record_count integer not null default 0 check (record_count >= 0),
  file_count integer not null default 0 check (file_count >= 0),
  purged_at timestamptz not null default now()
);

create index if not exists privacy_purge_log_owner_idx on public.privacy_purge_log (owner_id, purged_at desc);
alter table public.privacy_purge_log enable row level security;
drop policy if exists "Teachers read their privacy purge log" on public.privacy_purge_log;
create policy "Teachers read their privacy purge log" on public.privacy_purge_log for select to authenticated
using (owner_id = auth.uid());

comment on table public.teacher_privacy_settings is
  'Default retention preference for newly created work. It never schedules unattended deletion.';
comment on table public.privacy_purge_log is
  'Non-identifying record of completed manual destruction.';
