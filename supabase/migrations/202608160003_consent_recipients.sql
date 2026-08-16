-- 명단이 있는 수합에서 "누가 제출했는지"를 붙이기 위한 수신자 표.
-- 이름은 평문으로 두지 않고 AES-GCM 암호문과 조회용 HMAC 색인으로만 보관한다.
create table if not exists public.consent_recipients (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.consent_forms(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  identity_ciphertext text not null,
  name_lookup text not null,
  display_hint text not null default '' check (char_length(display_hint) <= 40),
  response_id uuid references public.consent_responses(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists consent_recipients_form_idx on public.consent_recipients (form_id);
create index if not exists consent_recipients_lookup_idx on public.consent_recipients (form_id, name_lookup);

-- 어떤 응답이 어느 수신자의 것인지 되짚을 수 있어야 한다.
alter table public.consent_responses
  add column if not exists recipient_id uuid references public.consent_recipients(id) on delete set null;

alter table public.consent_recipients enable row level security;

create policy "Teachers read their consent recipients" on public.consent_recipients for select to authenticated
using (exists (select 1 from public.consent_forms f where f.id = form_id and f.owner_id = auth.uid()));

create policy "Teachers remove their consent recipients" on public.consent_recipients for delete to authenticated
using (exists (select 1 from public.consent_forms f where f.id = form_id and f.owner_id = auth.uid()));

-- 명단 저장·조회는 암호화를 담당하는 Edge Function만 하도록 두어, 평문 이름이 클라이언트로 오가지 않게 한다.
comment on column public.consent_recipients.identity_ciphertext is
  'AES-GCM encrypted JSON containing recipient name and student key. Decrypted only by owner-checked Edge Functions.';
comment on column public.consent_recipients.name_lookup is
  'Deterministic HMAC-SHA256 of the normalized name for duplicate detection.';
comment on column public.consent_recipients.display_hint is
  'Masked name shown before authentication, e.g. 김○○.';

do $$ begin alter publication supabase_realtime add table public.consent_recipients; exception when duplicate_object then null; end $$;
