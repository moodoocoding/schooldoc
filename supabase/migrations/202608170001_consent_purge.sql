-- 학년이 끝난 자료를 정리할 수단이 없어 개별 삭제에만 의존하고 있었다.
-- 보유 기간을 두되 자동으로 지우지는 않는다. 학교 자료가 예고 없이 사라지는 편이 더 위험하다.
alter table public.consent_forms
  add column if not exists retention_months integer not null default 12
  check (retention_months between 1 and 120);

comment on column public.consent_forms.retention_months is
  'Months to keep before the form shows up in the cleanup list. Deletion stays manual.';

-- 무엇을 언제 지웠는지 남긴다. 개인정보는 담지 않는다.
create table if not exists public.consent_purge_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  form_title text not null check (char_length(form_title) <= 200),
  response_count integer not null default 0 check (response_count >= 0),
  signature_count integer not null default 0 check (signature_count >= 0),
  purged_at timestamptz not null default now()
);

create index if not exists consent_purge_log_owner_idx on public.consent_purge_log (owner_id, purged_at desc);

alter table public.consent_purge_log enable row level security;

drop policy if exists "Teachers read their consent purge log" on public.consent_purge_log;
create policy "Teachers read their consent purge log" on public.consent_purge_log for select to authenticated
using (owner_id = auth.uid());

comment on table public.consent_purge_log is
  'Record of purged consent forms. Titles and counts only, never response content or names.';
