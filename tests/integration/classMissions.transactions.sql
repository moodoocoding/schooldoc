-- Remote contract verification. The supplied owners must be this run's synthetic users.
-- Every test row and audit change is rolled back. No migration or policy is changed.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '5s';
do $$
declare
  owner_a uuid := '__OWNER_A__';
  owner_b uuid := '__OWNER_B__';
  board_id uuid := gen_random_uuid();
  fixture_mission uuid := gen_random_uuid();
  original_token uuid := gen_random_uuid();
  original_created timestamptz := now() - interval '1 day';
  board_row public.class_mission_boards%rowtype;
  ok boolean;
begin
  if (select count(*) from auth.users where id in (owner_a, owner_b)
      and raw_user_meta_data->>'class_missions_smoke' = '__RUN__') <> 2 then
    raise exception 'Synthetic owner guard failed';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on c.relnamespace=n.oid
      where n.nspname='public' and c.relname in ('class_mission_boards','class_mission_purge_audit')
      and c.relrowsecurity) <> 2 then raise exception 'RLS flags missing'; end if;
  if has_table_privilege('anon','public.class_mission_boards','select,insert,update,delete')
     or has_table_privilege('authenticated','public.class_mission_boards','select,insert,update,delete')
     or has_table_privilege('anon','public.class_mission_purge_audit','select,insert,update,delete')
     or has_table_privilege('authenticated','public.class_mission_purge_audit','select,insert,update,delete') then
    raise exception 'Browser table grants present';
  end if;
  if has_function_privilege('anon','public.commit_class_mission_purge(uuid,uuid,integer,uuid,text,integer,integer,integer,boolean)','execute')
     or has_function_privilege('authenticated','public.commit_class_mission_purge(uuid,uuid,integer,uuid,text,integer,integer,integer,boolean)','execute')
     or not has_function_privilege('service_role','public.commit_class_mission_purge(uuid,uuid,integer,uuid,text,integer,integer,integer,boolean)','execute') then
    raise exception 'RPC role grants invalid';
  end if;
  if (select prosecdef from pg_proc where oid='public.commit_class_mission_purge(uuid,uuid,integer,uuid,text,integer,integer,integer,boolean)'::regprocedure) then
    raise exception 'RPC must remain security invoker';
  end if;

  insert into public.class_mission_boards(id,owner_id,public_token,encrypted_payload,created_at)
    values(board_id,owner_a,original_token,'synthetic-opaque-original',original_created);
  ok := public.commit_class_mission_purge(board_id,owner_b,1,fixture_mission,'synthetic-opaque-next',2,1,1,false);
  if ok then raise exception 'Foreign owner accepted'; end if;
  ok := public.commit_class_mission_purge(board_id,owner_a,99,fixture_mission,'synthetic-opaque-next',2,1,1,false);
  if ok then raise exception 'Stale version accepted'; end if;
  select * into strict board_row from public.class_mission_boards where id=board_id;
  if board_row.version<>1 or board_row.encrypted_payload<>'synthetic-opaque-original'
     or exists(select 1 from public.class_mission_purge_audit a where a.board_id=board_row.id) then
    raise exception 'Rejected requests changed rows';
  end if;

  begin
    perform public.commit_class_mission_purge(board_id,owner_a,1,fixture_mission,'synthetic-opaque-next',-1,1,1,false);
    raise exception 'Negative count accepted';
  exception when raise_exception then
    if sqlerrm <> 'invalid purge request' then raise; end if;
  end;
  -- A NULL audit mission fails only after delete/reinsert. The subtransaction must
  -- restore the original board, proving atomic rollback on an actual SQL constraint.
  begin
    perform public.commit_class_mission_purge(board_id,owner_a,1,null::uuid,'synthetic-opaque-next',2,1,1,false);
    raise exception 'Audit failure was not raised';
  exception when not_null_violation then null;
  end;
  select * into strict board_row from public.class_mission_boards where id=board_id;
  if board_row.version<>1 or board_row.encrypted_payload<>'synthetic-opaque-original'
     or exists(select 1 from public.class_mission_purge_audit a where a.board_id=board_row.id) then
    raise exception 'Failed audit left a partial commit';
  end if;

  insert into public.class_mission_purge_audit(board_id,mission_id,status,target_count,check_count,event_count,reason_code)
    values(board_id,fixture_mission,'retry',2,1,1,'commit_failed');
  ok := public.commit_class_mission_purge(board_id,owner_a,1,fixture_mission,'synthetic-opaque-next',2,1,1,false);
  if not ok then raise exception 'Valid commit failed'; end if;
  select * into strict board_row from public.class_mission_boards where id=board_id;
  if board_row.version<>2 or board_row.encrypted_payload<>'synthetic-opaque-next'
     or board_row.owner_id<>owner_a or board_row.created_at<>original_created
     or board_row.public_token<>original_token or not board_row.public_enabled then
    raise exception 'Replacement changed preserved fields';
  end if;
  if (select count(*) from public.class_mission_purge_audit a where a.board_id=board_row.id
      and a.mission_id=fixture_mission and a.status='resolved')<>1
     or (select count(*) from public.class_mission_purge_audit a where a.board_id=board_row.id
      and a.mission_id=fixture_mission and a.status='completed' and a.target_count=2 and a.check_count=1 and a.event_count=1)<>1 then
    raise exception 'Audit completion/retry resolution failed';
  end if;

  ok := public.commit_class_mission_purge(board_id,owner_a,1,fixture_mission,'synthetic-opaque-replayed',2,1,1,true);
  if ok then raise exception 'Replay accepted'; end if;
  ok := public.commit_class_mission_purge(board_id,owner_a,2,gen_random_uuid(),'synthetic-opaque-final',0,0,0,true);
  if not ok then raise exception 'Final-roster commit failed'; end if;
  select * into strict board_row from public.class_mission_boards where id=board_id;
  if board_row.version<>3 or board_row.public_enabled or board_row.public_token=original_token then
    raise exception 'Final roster did not revoke sharing';
  end if;
end $$;
rollback;
select true as passed, 8 as contract_groups, 'all synthetic SQL changes rolled back' as cleanup;
