-- Versions are CAS tokens. now() is fixed at transaction start and can move
-- backwards after a lock wait, or repeat for two edits in one transaction.
create or replace function public.touch_student_result_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

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
  v_changed boolean;
begin
  select * into v_event from public.student_result_events
    where id = p_event_id and owner_id = p_owner_id for update;
  if not found or v_event.updated_at is distinct from p_expected_updated_at then
    return false;
  end if;

  -- Serialize public confirmations with the version check and invalidation.
  perform id from public.student_result_recipients
    where event_id = p_event_id order by id for update;
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

  v_changed := v_event.title is distinct from p_title
    or v_event.description is distinct from p_description
    or v_event.allow_confirmation is distinct from p_allow_confirmation
    or v_event.allow_dispute is distinct from p_allow_dispute
    or exists (
      select 1 from public.student_result_columns as c
      join jsonb_to_recordset(p_columns) as edited(
        id text, label text, max_score numeric, description text, kind text
      ) on edited.id = c.id
      where c.event_id = p_event_id
        and (c.label is distinct from edited.label
          or c.max_score is distinct from edited.max_score
          or c.description is distinct from edited.description
          or c.kind is distinct from edited.kind)
    );
  -- Saving identical settings must not erase a valid confirmation/history.
  if not v_changed then return true; end if;

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

  -- Every screen used the old settings, including students not yet confirmed.
  -- Keep pending disputes pending and never label an unanswered correction replied.
  update public.student_result_recipients as r
  set status = case
        when r.status in ('confirmed', 'reconfirm', 'replied') then
          case when p_allow_confirmation then 'reconfirm'
            when exists (select 1 from public.student_result_disputes as d
              where d.recipient_id = r.id and d.reply_ciphertext is not null) then 'replied'
            else 'viewed' end
        else r.status end,
      confirmed_at = null,
      updated_at = clock_timestamp()
  where r.event_id = p_event_id;
  return true;
end;
$$;

revoke all on function public.update_student_result_event_settings(uuid, uuid, timestamptz, jsonb, text, text, boolean, boolean, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.update_student_result_event_settings(uuid, uuid, timestamptz, jsonb, text, text, boolean, boolean, jsonb, text)
  to service_role;
