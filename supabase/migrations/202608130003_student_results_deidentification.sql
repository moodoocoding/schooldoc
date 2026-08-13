alter table public.student_result_recipients
  add column if not exists identity_ciphertext text,
  add column if not exists result_ciphertext text,
  add column if not exists name_lookup text;

alter table public.student_result_disputes
  add column if not exists message_ciphertext text,
  add column if not exists reply_ciphertext text,
  alter column message drop not null;

alter table public.student_result_recipients
  alter column student_key drop not null,
  alter column name drop not null,
  alter column verification_code drop not null,
  alter column result_values drop not null,
  alter column feedback drop not null;

create or replace function public.hash_student_result_verification_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.verification_code is not null
    and (tg_op = 'INSERT' or new.verification_code is distinct from old.verification_code) then
    new.verification_digest = crypt(new.verification_code, gen_salt('bf', 10));
  end if;
  return new;
end;
$$;

drop index if exists student_result_recipients_name_idx;
create index if not exists student_result_recipients_name_lookup_idx
  on public.student_result_recipients (event_id, name_lookup);

alter table public.student_result_recipients
  add constraint student_result_recipients_protected_payload_check
  check (
    (identity_ciphertext is not null and result_ciphertext is not null and name_lookup is not null)
    or (student_key is not null and name is not null and verification_code is not null)
  ) not valid;

create or replace function public.hash_student_result_code(p_code text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select crypt(p_code, gen_salt('bf', 10));
$$;

revoke all on function public.hash_student_result_code(text) from public, anon, authenticated;
grant execute on function public.hash_student_result_code(text) to service_role;

create or replace function public.verify_student_result_code(p_recipient_id uuid, p_code text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select coalesce((
    select verification_digest = crypt(p_code, verification_digest)
    from public.student_result_recipients
    where id = p_recipient_id
  ), false);
$$;

revoke all on function public.verify_student_result_code(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_student_result_code(uuid, text) to service_role;

drop policy if exists "Teachers manage their student result recipients" on public.student_result_recipients;
drop policy if exists "Teachers manage their student result disputes" on public.student_result_disputes;

create policy "Teachers observe protected student result recipients"
on public.student_result_recipients for select to authenticated
using (exists (
  select 1 from public.student_result_events e where e.id = event_id and e.owner_id = auth.uid()
));

create policy "Teachers observe protected student result disputes"
on public.student_result_disputes for select to authenticated
using (exists (
  select 1 from public.student_result_events e where e.id = event_id and e.owner_id = auth.uid()
));

comment on column public.student_result_recipients.identity_ciphertext is
  'AES-GCM encrypted JSON containing name, student key, and verification code. Decrypted only by owner-checked Edge Functions.';
comment on column public.student_result_recipients.result_ciphertext is
  'AES-GCM encrypted JSON containing result values and feedback.';
comment on column public.student_result_recipients.name_lookup is
  'Deterministic HMAC-SHA256 of the normalized name for public verification lookup.';
comment on column public.student_result_disputes.message_ciphertext is
  'AES-GCM encrypted student dispute message.';
comment on column public.student_result_disputes.reply_ciphertext is
  'AES-GCM encrypted teacher reply.';
