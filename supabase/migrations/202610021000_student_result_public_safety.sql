-- Keep 202610020200 settings/version/total semantics unchanged.
-- Public result safety: classroom authentication, revocation and atomic state changes.
-- Preserve encrypted payloads and existing verification digests.

-- Only failed guesses consume this event/name bucket. The HMAC lookup contains no
-- plaintext name or code. Locking the bucket makes concurrent guesses count once each.
create or replace function public.authenticate_student_result_session(
  p_event_id uuid, p_name_lookup text, p_code text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_event public.student_result_events%rowtype;
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / 60) * 60);
  v_key text := 'student-result-auth:' || p_event_id::text || ':' || p_name_lookup;
  v_count integer;
  v_matches uuid[];
  v_token uuid;
begin
  select * into v_event from public.student_result_events
    where id = p_event_id for share;
  if not found then return jsonb_build_object('code', 'EVENT_NOT_FOUND'); end if;
  if v_event.status <> 'open' then return jsonb_build_object('code', 'EVENT_CLOSED'); end if;
  if p_name_lookup is null or length(p_name_lookup) > 100 or p_code is null
    or length(p_code) not between 1 and 100 then
    return jsonb_build_object('code', 'AUTH_INVALID');
  end if;

  insert into public.student_result_rate_limits(request_key, window_started_at, request_count)
    values (v_key, v_window, 0) on conflict do nothing;
  select request_count into v_count from public.student_result_rate_limits
    where request_key = v_key and window_started_at = v_window for update;
  if v_count >= 10 then return jsonb_build_object('code', 'RATE_LIMITED'); end if;

  select array_agg(id) into v_matches from public.student_result_recipients
    where event_id = p_event_id and name_lookup = p_name_lookup
      and public.verify_student_result_code(id, p_code);
  if coalesce(array_length(v_matches, 1), 0) <> 1 then
    update public.student_result_rate_limits set request_count = request_count + 1
      where request_key = v_key and window_started_at = v_window;
    return jsonb_build_object('code',
      case when coalesce(array_length(v_matches, 1), 0) > 1 then 'AUTH_AMBIGUOUS' else 'AUTH_INVALID' end);
  end if;

  perform 1 from public.student_result_recipients
    where id = v_matches[1] and event_id = p_event_id for update;
  insert into public.student_result_public_sessions(event_id, recipient_id)
    values (p_event_id, v_matches[1]) returning token into v_token;
  return jsonb_build_object('code', 'OK', 'recipientId', v_matches[1], 'sessionToken', v_token);
end;
$$;

-- The token is checked under the same event/recipient locks used by regeneration,
-- so an old personal token cannot issue a new session after regeneration commits.
create or replace function public.open_student_result_personal_session(
  p_event_id uuid, p_personal_token uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_event public.student_result_events%rowtype;
  v_recipient_id uuid;
  v_token uuid;
begin
  select * into v_event from public.student_result_events where id = p_event_id for share;
  if not found then return jsonb_build_object('code', 'EVENT_NOT_FOUND'); end if;
  if v_event.status <> 'open' then return jsonb_build_object('code', 'EVENT_CLOSED'); end if;
  select id into v_recipient_id from public.student_result_recipients
    where event_id = p_event_id and personal_token = p_personal_token for update;
  if not found then return jsonb_build_object('code', 'PERSONAL_LINK_INVALID'); end if;
  insert into public.student_result_public_sessions(event_id, recipient_id)
    values (p_event_id, v_recipient_id) returning token into v_token;
  return jsonb_build_object('code', 'OK', 'recipientId', v_recipient_id, 'sessionToken', v_token);
end;
$$;

-- Acquire event -> recipient -> session locks consistently. Every public mutation
-- rechecks the session after the locks, including sessions revoked during a wait.
create or replace function public.lock_student_result_session(p_session_token uuid)
returns table(event_id uuid, recipient_id uuid, error_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_session public.student_result_public_sessions%rowtype;
  v_event public.student_result_events%rowtype;
begin
  select * into v_session from public.student_result_public_sessions where token = p_session_token;
  if not found then return query select null::uuid, null::uuid, 'SESSION_EXPIRED'::text; return; end if;
  select * into v_event from public.student_result_events where id = v_session.event_id for update;
  if not found then return query select null::uuid, null::uuid, 'SESSION_EXPIRED'::text; return; end if;
  perform 1 from public.student_result_recipients
    where id = v_session.recipient_id and student_result_recipients.event_id = v_session.event_id for update;
  if not found then return query select null::uuid, null::uuid, 'SESSION_EXPIRED'::text; return; end if;
  select * into v_session from public.student_result_public_sessions where token = p_session_token for update;
  if not found or v_session.expires_at <= clock_timestamp() then
    return query select null::uuid, null::uuid, 'SESSION_EXPIRED'::text; return;
  end if;
  if v_event.status <> 'open' then
    return query select null::uuid, null::uuid, 'EVENT_CLOSED'::text; return;
  end if;
  return query select v_session.event_id, v_session.recipient_id, null::text;
end;
$$;

create or replace function public.confirm_student_result(
  p_session_token uuid, p_expected_updated_at timestamptz
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_session record;
  v_recipient public.student_result_recipients%rowtype;
begin
  select * into v_session from public.lock_student_result_session(p_session_token);
  if v_session.error_code is not null then return v_session.error_code; end if;
  if not (select allow_confirmation from public.student_result_events where id = v_session.event_id) then
    return 'CONFIRM_DISABLED';
  end if;
  select * into v_recipient from public.student_result_recipients where id = v_session.recipient_id;
  if v_recipient.status = 'disputed' then return 'DISPUTE_PENDING'; end if;
  if p_expected_updated_at is null or v_recipient.updated_at is distinct from p_expected_updated_at then
    return 'RESULT_CHANGED';
  end if;
  update public.student_result_recipients set status = 'confirmed', confirmed_at = clock_timestamp()
    where id = v_session.recipient_id and event_id = v_session.event_id;
  return 'OK';
end;
$$;

create or replace function public.submit_student_result_dispute(
  p_session_token uuid, p_message_ciphertext text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_session record;
begin
  select * into v_session from public.lock_student_result_session(p_session_token);
  if v_session.error_code is not null then return v_session.error_code; end if;
  if not (select allow_dispute from public.student_result_events where id = v_session.event_id) then
    return 'DISPUTE_DISABLED';
  end if;
  if (select status from public.student_result_recipients where id = v_session.recipient_id) = 'disputed' then
    return 'DISPUTE_PENDING';
  end if;
  if nullif(p_message_ciphertext, '') is null then return 'INVALID_INPUT'; end if;
  insert into public.student_result_disputes(
    event_id, recipient_id, message, message_ciphertext, submitted_at,
    teacher_reply, reply_ciphertext, replied_at
  ) values (
    v_session.event_id, v_session.recipient_id, null, p_message_ciphertext, clock_timestamp(), null, null, null
  ) on conflict (recipient_id) do update
    set message = null, message_ciphertext = excluded.message_ciphertext, submitted_at = excluded.submitted_at,
        teacher_reply = null, reply_ciphertext = null, replied_at = null;
  update public.student_result_recipients set status = 'disputed', confirmed_at = null
    where id = v_session.recipient_id and event_id = v_session.event_id;
  return 'OK';
end;
$$;

create or replace function public.reply_student_result_dispute(
  p_owner_id uuid, p_event_id uuid, p_recipient_id uuid, p_reply_ciphertext text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_event public.student_result_events%rowtype;
begin
  select * into v_event from public.student_result_events
    where id = p_event_id and owner_id = p_owner_id for update;
  if not found then return 'EVENT_NOT_FOUND'; end if;
  perform 1 from public.student_result_recipients where id = p_recipient_id and event_id = p_event_id for update;
  if not found then return 'RECIPIENT_NOT_FOUND'; end if;
  if nullif(p_reply_ciphertext, '') is null then return 'INVALID_INPUT'; end if;
  update public.student_result_disputes
    set reply_ciphertext = p_reply_ciphertext, teacher_reply = null, replied_at = clock_timestamp()
    where event_id = p_event_id and recipient_id = p_recipient_id;
  if not found then return 'DISPUTE_NOT_FOUND'; end if;
  update public.student_result_recipients
    set status = case when v_event.allow_confirmation then 'reconfirm' else 'replied' end, confirmed_at = null
    where id = p_recipient_id and event_id = p_event_id;
  return 'OK';
end;
$$;

create or replace function public.regenerate_student_result_personal_token(
  p_owner_id uuid, p_event_id uuid, p_recipient_id uuid, p_personal_token uuid
)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.student_result_events where id = p_event_id and owner_id = p_owner_id for update;
  if not found then return 'EVENT_NOT_FOUND'; end if;
  perform 1 from public.student_result_recipients where id = p_recipient_id and event_id = p_event_id for update;
  if not found then return 'RECIPIENT_NOT_FOUND'; end if;
  if p_personal_token is null then return 'INVALID_INPUT'; end if;
  update public.student_result_recipients set personal_token = p_personal_token
    where id = p_recipient_id and event_id = p_event_id;
  delete from public.student_result_public_sessions where event_id = p_event_id and recipient_id = p_recipient_id;
  return 'OK';
end;
$$;

-- Protected writes stay service-only; the Edge Functions validate HTTP identity
-- and these functions additionally validate ownership/session inside each transaction.
revoke all on function public.authenticate_student_result_session(uuid, text, text) from public, anon, authenticated;
revoke all on function public.open_student_result_personal_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.lock_student_result_session(uuid) from public, anon, authenticated;
revoke all on function public.confirm_student_result(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.submit_student_result_dispute(uuid, text) from public, anon, authenticated;
revoke all on function public.reply_student_result_dispute(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.regenerate_student_result_personal_token(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.authenticate_student_result_session(uuid, text, text) to service_role;
grant execute on function public.open_student_result_personal_session(uuid, uuid) to service_role;
grant execute on function public.lock_student_result_session(uuid) to service_role;
grant execute on function public.confirm_student_result(uuid, timestamptz) to service_role;
grant execute on function public.submit_student_result_dispute(uuid, text) to service_role;
grant execute on function public.reply_student_result_dispute(uuid, uuid, uuid, text) to service_role;
grant execute on function public.regenerate_student_result_personal_token(uuid, uuid, uuid, uuid) to service_role;
