-- Existing columns keep NULL so older "총점" headings can be recognized without changing their stored meaning.
alter table public.student_result_columns
  add column if not exists kind text
  check (kind is null or kind in ('score', 'total'));

alter table public.student_result_events
  add column if not exists revision_ciphertext text;

alter table public.student_result_recipients
  add column if not exists revision_ciphertext text;

alter table public.student_result_recipients
  drop constraint if exists student_result_recipients_status_check;
alter table public.student_result_recipients
  add constraint student_result_recipients_status_check
  check (status in ('unviewed', 'viewed', 'confirmed', 'disputed', 'reconfirm', 'replied'));

-- Replies without a confirmation step were previously stranded in reconfirm.
update public.student_result_recipients as recipient
set status = 'replied'
from public.student_result_events as event
where recipient.event_id = event.id
  and event.allow_confirmation = false
  and recipient.status = 'reconfirm';

comment on column public.student_result_events.revision_ciphertext is
  'AES-GCM encrypted event settings correction history.';
comment on column public.student_result_recipients.revision_ciphertext is
  'AES-GCM encrypted student score and feedback correction history.';

-- Both correction functions lock the event row first. That serializes settings and
-- recipient changes and lets the caller reject stale, already reviewed values.
create or replace function public.update_student_result_recipient_correction(
  p_owner_id uuid,
  p_event_id uuid,
  p_recipient_id uuid,
  p_expected_event_updated_at timestamptz,
  p_expected_recipient_updated_at timestamptz,
  p_result_ciphertext text,
  p_revision_ciphertext text,
  p_reconfirm boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.student_result_events%rowtype;
  v_recipient public.student_result_recipients%rowtype;
begin
  select * into v_event from public.student_result_events
    where id = p_event_id and owner_id = p_owner_id for update;
  if not found or v_event.updated_at is distinct from p_expected_event_updated_at then
    return false;
  end if;

  select * into v_recipient from public.student_result_recipients
    where id = p_recipient_id and event_id = p_event_id for update;
  if not found or v_recipient.updated_at is distinct from p_expected_recipient_updated_at then
    return false;
  end if;

  update public.student_result_recipients
  set result_ciphertext = p_result_ciphertext,
      revision_ciphertext = p_revision_ciphertext,
      status = case when p_reconfirm and status = 'confirmed' then 'reconfirm' else status end,
      confirmed_at = case when p_reconfirm and status = 'confirmed' then null else confirmed_at end
  where id = p_recipient_id and event_id = p_event_id;
  update public.student_result_events set updated_at = now() where id = p_event_id;
  return true;
end;
$$;

revoke all on function public.update_student_result_recipient_correction(uuid, uuid, uuid, timestamptz, timestamptz, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.update_student_result_recipient_correction(uuid, uuid, uuid, timestamptz, timestamptz, text, text, boolean)
  to service_role;

create or replace function public.update_student_result_event_settings(
  p_owner_id uuid,
  p_event_id uuid,
  p_expected_updated_at timestamptz,
  p_recipient_versions jsonb,
  p_title text,
  p_description text,
  p_allow_confirmation boolean,
  p_allow_dispute boolean,
  p_columns jsonb,
  p_revision_ciphertext text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.student_result_events%rowtype;
  v_column jsonb;
begin
  select * into v_event from public.student_result_events
    where id = p_event_id and owner_id = p_owner_id for update;
  if not found or v_event.updated_at is distinct from p_expected_updated_at then
    return false;
  end if;

  if exists (
    select 1 from public.student_result_recipients as r
    where r.event_id = p_event_id
      and (p_recipient_versions ->> r.id::text)::timestamptz is distinct from r.updated_at
  ) then
    return false;
  end if;

  if jsonb_typeof(p_columns) is distinct from 'array'
    or jsonb_array_length(p_columns) <> (select count(*) from public.student_result_columns where event_id = p_event_id)
    or (select count(distinct c->>'id') from jsonb_array_elements(p_columns) as c)
      <> (select count(*) from public.student_result_columns where event_id = p_event_id)
    or (select count(*) from jsonb_array_elements(p_columns) as c where c->>'kind' = 'total') > 1 then
    return false;
  end if;

  for v_column in select value from jsonb_array_elements(p_columns) loop
    if not exists (
      select 1 from public.student_result_columns
      where event_id = p_event_id and id = v_column->>'id'
    ) then
      return false;
    end if;
  end loop;

  update public.student_result_columns as column_row
  set label = edited.label,
      max_score = edited.max_score,
      description = edited.description,
      kind = edited.kind
  from jsonb_to_recordset(p_columns) as edited(
    id text, label text, max_score numeric, description text, kind text
  )
  where column_row.event_id = p_event_id and column_row.id = edited.id;

  update public.student_result_events
  set title = p_title,
      description = p_description,
      allow_confirmation = p_allow_confirmation,
      allow_dispute = p_allow_dispute,
      revision_ciphertext = p_revision_ciphertext
  where id = p_event_id;

  if not p_allow_confirmation then
    update public.student_result_recipients
    set status = 'replied'
    where event_id = p_event_id and status = 'reconfirm';
  end if;
  return true;
end;
$$;

revoke all on function public.update_student_result_event_settings(uuid, uuid, timestamptz, jsonb, text, text, boolean, boolean, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.update_student_result_event_settings(uuid, uuid, timestamptz, jsonb, text, text, boolean, boolean, jsonb, text)
  to service_role;
