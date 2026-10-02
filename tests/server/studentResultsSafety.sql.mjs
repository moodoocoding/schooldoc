// Local PostgreSQL/WASM regression. No Supabase credentials or network are used.
// CI: deno run --no-lock --allow-env --allow-read --node-modules-dir=none tests/server/studentResultsSafety.sql.mjs
// Node can use STUDENT_RESULTS_PGLITE_PATH pointing to an isolated @electric-sql/pglite package.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const runtimePath = process.env.STUDENT_RESULTS_PGLITE_PATH;
const packageName = typeof Deno === 'undefined' ? '@electric-sql/pglite' : 'npm:@electric-sql/pglite@0.5.8';
const { PGlite } = await import(runtimePath ? pathToFileURL(runtimePath + '/dist/index.js').href : packageName);
const { pgcrypto } = await import(runtimePath ? pathToFileURL(runtimePath + '/dist/contrib/pgcrypto.js').href : packageName + '/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
const owner = randomUUID(), otherOwner = randomUUID(), eventId = randomUUID();
const recipientIds = Array.from({ length: 60 }, () => randomUUID());
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log('PASS ' + name); };
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0].result;
const recipient = async (id = recipientIds[0]) => (await db.query(
  'select *, updated_at::text as version from public.student_result_recipients where id = $1', [id],
)).rows[0];
const authenticate = (index, code = '1234') => scalar(
  'select public.authenticate_student_result_session($1,$2,$3) as result', [eventId, 'fictional-name-hmac-' + index, code],
);
const openPersonal = async (index) => scalar('select public.open_student_result_personal_session($1,$2) as result',
  [eventId, (await recipient(recipientIds[index])).personal_token]);
const confirm = (sessionToken, version) => scalar('select public.confirm_student_result($1,$2) as result', [sessionToken, version]);
const dispute = (sessionToken) => scalar('select public.submit_student_result_dispute($1,$2) as result', [sessionToken, 'fictional-encrypted-message']);
const reply = () => scalar('select public.reply_student_result_dispute($1,$2,$3,$4) as result',
  [owner, eventId, recipientIds[0], 'fictional-encrypted-reply']);
const settings = async (changes = {}) => {
  const event = (await db.query('select *,updated_at::text as version from public.student_result_events where id=$1', [eventId])).rows[0];
  const versions = (await db.query('select id,updated_at::text as version from public.student_result_recipients where event_id=$1', [eventId])).rows;
  const columns = [{ id: 'math', label: '수학', max_score: 100, description: '', kind: 'score', ...changes.column }];
  return scalar('select public.update_student_result_event_settings($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result',
    [owner, eventId, event.version, Object.fromEntries(versions.map(r => [r.id,r.version])), changes.title ?? event.title,
      changes.description ?? event.description, changes.allowConfirmation ?? event.allow_confirmation,
      changes.allowDispute ?? event.allow_dispute, columns, 'fictional-encrypted-history']);
};

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    create publication supabase_realtime;
  `);
  for (const filename of [
    '202608130002_student_results.sql',
    '202608130003_student_results_deidentification.sql',
    '202608130004_student_results_protected_disputes.sql',
    '202610010100_student_result_corrections.sql',
    '202610020200_student_result_settings_versions.sql',
    '202610021000_student_result_public_safety.sql',
  ]) await db.exec(await readFile(new URL('../../supabase/migrations/' + filename, import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values ($1),($2)', [owner,otherOwner]);
  await db.query('insert into public.student_result_events(id,owner_id,title) values ($1,$2,$3)',[eventId,owner,'가상 결과']);
  await db.query("insert into public.student_result_columns(event_id,id,position,label,max_score,kind) values ($1,'math',0,'수학',100,'score')",[eventId]);
  const digest = await scalar("select public.hash_student_result_code('1234') as result");
  for (let i = 0; i < recipientIds.length; i++) await db.query(`
    insert into public.student_result_recipients(id,event_id,student_key,name,verification_code,result_values,feedback,
      verification_digest,identity_ciphertext,result_ciphertext,name_lookup,status)
    values ($1,$2,null,null,null,null,null,$3,'fictional-encrypted-identity','fictional-encrypted-result',$4,'viewed')
  `,[recipientIds[i],eventId,digest,'fictional-name-hmac-'+i]);

  let commonSessions;
  await check('60 successful classroom authentications do not consume failed-credential quota', async () => {
    commonSessions = await Promise.all(recipientIds.map((_,i) => authenticate(i)));
    assert(commonSessions.every(s => s.code === 'OK'));
    assert.equal(await scalar("select sum(request_count)::int as result from public.student_result_rate_limits"),0);
  });
  let personalSessions;
  await check('60 personal sessions open without shared credential failure quota', async () => {
    personalSessions = await Promise.all(recipientIds.map((_,i) => openPersonal(i)));
    assert(personalSessions.every(s => s.code === 'OK'));
  });
  await check('15 submitted wrong codes count exactly 10 failures then deny further verification', async () => {
    const attempts = await Promise.all(Array.from({length:15},() => authenticate(59,'wrong')));
    assert.equal(attempts.filter(s=>s.code === 'AUTH_INVALID').length,10);
    assert.equal(attempts.filter(s=>s.code === 'RATE_LIMITED').length,5);
    assert.equal((await authenticate(59)).code,'RATE_LIMITED');
    assert.equal((await authenticate(58)).code,'OK');
    assert.equal(await scalar("select request_count as result from public.student_result_rate_limits where request_key=$1",
      ['student-result-auth:'+eventId+':fictional-name-hmac-59']),10);
  });
  await check('a fresh minute permits authentication again without deleting another student quota', async () => {
    await db.query("update public.student_result_rate_limits set window_started_at=window_started_at-interval '2 minutes' where request_key=$1",
      ['student-result-auth:'+eventId+':fictional-name-hmac-59']);
    assert.equal((await authenticate(59)).code,'OK');
  });
  await check('ambiguous identities fail without choosing the first student', async () => {
    const extra=randomUUID();
    await db.query(`insert into public.student_result_recipients(id,event_id,verification_digest,identity_ciphertext,result_ciphertext,name_lookup)
      values ($1,$2,$3,'fictional-encrypted-identity','fictional-encrypted-result','fictional-name-hmac-58')`,[extra,eventId,digest]);
    assert.equal((await authenticate(58)).code,'AUTH_AMBIGUOUS');
    await db.query('delete from public.student_result_recipients where id=$1',[extra]);
  });
  await check('regeneration rejects old token and revokes common and personal sessions for only that student', async () => {
    const old = await recipient();
    assert.equal(await scalar('select public.regenerate_student_result_personal_token($1,$2,$3,$4) as result',
      [otherOwner,eventId,recipientIds[0],randomUUID()]),'EVENT_NOT_FOUND');
    assert.equal(await scalar('select public.regenerate_student_result_personal_token($1,$2,$3,$4) as result',
      [owner,eventId,recipientIds[0],randomUUID()]),'OK');
    assert.equal((await scalar('select public.open_student_result_personal_session($1,$2) as result',
      [eventId,old.personal_token])).code,'PERSONAL_LINK_INVALID');
    for (const session of [commonSessions[0],personalSessions[0]]) assert.equal(await confirm(session.sessionToken,old.version),'SESSION_EXPIRED');
    assert.equal(await scalar('select count(*)::int as result from public.student_result_public_sessions where recipient_id=$1',[recipientIds[0]]),0);
    assert(await scalar('select count(*)::int as result from public.student_result_public_sessions where recipient_id=$1',[recipientIds[1]]) > 0);
    assert.equal((await openPersonal(0)).code,'OK');
  });
  await check('regeneration rolls back token replacement if deleting sessions fails', async () => {
    const fresh=await openPersonal(0), old=await recipient();
    await db.exec(`create function public.fictional_session_failure() returns trigger language plpgsql as $$
      begin raise exception 'fictional revoke failure'; end; $$;
      create trigger fictional_revoke_failure before delete on public.student_result_public_sessions
      for each row execute function public.fictional_session_failure();`);
    await assert.rejects(scalar('select public.regenerate_student_result_personal_token($1,$2,$3,$4) as result',
      [owner,eventId,recipientIds[0],randomUUID()]),/fictional revoke failure/);
    assert.equal((await recipient()).personal_token,old.personal_token);
    assert.equal(await scalar('select count(*)::int as result from public.student_result_public_sessions where token=$1',[fresh.sessionToken]),1);
    await db.exec('drop trigger fictional_revoke_failure on public.student_result_public_sessions; drop function public.fictional_session_failure();');
  });
  const active = await authenticate(0);
  await check('confirm requires the actual recipient version', async () => {
    assert.equal(await confirm(active.sessionToken,null),'RESULT_CHANGED');
    assert.equal(await confirm(active.sessionToken,(await recipient()).version),'OK');
  });
  await check('changed title and column invalidate every student version and completed confirmation', async () => {
    const old = await recipient();
    assert.equal(await settings({title:'수정된 가상 결과',column:{max_score:200}}),true);
    const after = await recipient();
    assert.notEqual(after.version,old.version);
    assert.equal(after.status,'reconfirm'); assert.equal(after.confirmed_at,null);
    assert.equal(await confirm(active.sessionToken,old.version),'RESULT_CHANGED');
    assert.equal(await confirm(active.sessionToken,after.version),'OK');
  });
  await check('disabling confirmation after a meaning change clears stale confirmation without requiring a new one', async () => {
    assert.equal(await settings({description:'바뀐 안내',allowConfirmation:false}),true);
    assert.equal((await recipient()).status,'viewed');
    assert.equal((await recipient()).confirmed_at,null);
    assert.equal(await confirm(active.sessionToken,(await recipient()).version),'CONFIRM_DISABLED');
    assert.equal(await settings({allowConfirmation:true}),true);
  });
  await check('dispute insertion and state update roll back together on a recipient trigger failure', async () => {
    await db.exec(`create function public.fictional_status_failure() returns trigger language plpgsql as $$
      begin if new.status='disputed' then raise exception 'fictional state failure'; end if; return new; end; $$;
      create trigger fictional_dispute_failure before update on public.student_result_recipients
      for each row execute function public.fictional_status_failure();`);
    await assert.rejects(dispute(active.sessionToken),/fictional state failure/);
    assert.equal(await scalar('select count(*)::int as result from public.student_result_disputes where recipient_id=$1',[recipientIds[0]]),0);
    assert.equal((await recipient()).status,'viewed');
    await db.exec('drop trigger fictional_dispute_failure on public.student_result_recipients; drop function public.fictional_status_failure();');
    assert.equal(await dispute(active.sessionToken),'OK');
    assert.equal((await recipient()).status,'disputed');
    assert.equal(await dispute(active.sessionToken),'DISPUTE_PENDING');
  });
  await check('teacher answer and state update roll back together on a recipient trigger failure', async () => {
    await db.exec(`create function public.fictional_status_failure() returns trigger language plpgsql as $$
      begin if new.status='reconfirm' then raise exception 'fictional reply state failure'; end if; return new; end; $$;
      create trigger fictional_reply_failure before update on public.student_result_recipients
      for each row execute function public.fictional_status_failure();`);
    await assert.rejects(reply(),/fictional reply state failure/);
    assert.equal(await scalar('select reply_ciphertext as result from public.student_result_disputes where recipient_id=$1',[recipientIds[0]]),null);
    assert.equal((await recipient()).status,'disputed');
    await db.exec('drop trigger fictional_reply_failure on public.student_result_recipients; drop function public.fictional_status_failure();');
    assert.equal(await reply(),'OK'); assert.equal((await recipient()).status,'reconfirm');
    assert.equal(await settings({allowConfirmation:false}),true);
    assert.equal((await recipient()).status,'replied');
    assert.equal(await reply(),'OK'); assert.equal((await recipient()).status,'replied');
  });
  await check('changing action flags advances every screen version and preserves an actual completed reply', async () => {
    const before=(await db.query('select id,updated_at::text as version from public.student_result_recipients where event_id=$1',[eventId])).rows;
    const replyBefore=await scalar('select reply_ciphertext as result from public.student_result_disputes where recipient_id=$1',[recipientIds[0]]);
    assert.equal(await settings({allowDispute:false}),true);
    for (const row of before) assert.notEqual((await recipient(row.id)).version,row.version);
    assert.equal((await recipient()).status,'replied');
    assert.equal(await scalar('select reply_ciphertext as result from public.student_result_disputes where recipient_id=$1',[recipientIds[0]]),replyBefore);
    const outdated=(await recipient()).version;
    assert.equal(await settings({allowDispute:true,allowConfirmation:true}),true);
    assert.equal(await confirm(active.sessionToken,outdated),'RESULT_CHANGED');
    assert.equal((await recipient()).status,'reconfirm');
  });
  await check('identical settings preserve the current version, confirmation and revision history', async () => {
    assert.equal(await confirm(active.sessionToken,(await recipient()).version),'OK');
    const before=await recipient();
    const history=await scalar('select revision_ciphertext as result from public.student_result_events where id=$1',[eventId]);
    assert.equal(await settings(),true);
    assert.equal((await recipient()).version,before.version);
    assert.equal((await recipient()).status,'confirmed');
    assert.equal((await recipient()).confirmed_at.getTime(),before.confirmed_at.getTime());
    assert.equal(await scalar('select revision_ciphertext as result from public.student_result_events where id=$1',[eventId]),history);
  });
  await check('service-only RPC grants and actual teacher RLS retain owner separation', async () => {
    const signatures=[
      'consume_student_result_rate_limit(text,integer,integer)', 'authenticate_student_result_session(uuid,text,text)', 'open_student_result_personal_session(uuid,uuid)',
      'lock_student_result_session(uuid)', 'confirm_student_result(uuid,timestamptz)',
      'submit_student_result_dispute(uuid,text)', 'reply_student_result_dispute(uuid,uuid,uuid,text)',
      'regenerate_student_result_personal_token(uuid,uuid,uuid,uuid)',
      'update_student_result_event_settings(uuid,uuid,timestamptz,jsonb,text,text,boolean,boolean,jsonb,text)',
    ];
    for (const signature of signatures) {
      assert.equal(await scalar('select has_function_privilege($1,$2,$3) as result',['anon','public.'+signature,'EXECUTE']),false);
      assert.equal(await scalar('select has_function_privilege($1,$2,$3) as result',['authenticated','public.'+signature,'EXECUTE']),false);
      assert.equal(await scalar('select has_function_privilege($1,$2,$3) as result',['service_role','public.'+signature,'EXECUTE']),true);
    }
    await db.exec('grant usage on schema public,auth to authenticated; grant select on public.student_result_events,public.student_result_recipients to authenticated;');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
    await db.exec('set role authenticated');
    assert.equal(await scalar('select count(*)::int as result from public.student_result_recipients'),60);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[otherOwner]);
    assert.equal(await scalar('select count(*)::int as result from public.student_result_recipients'),0);
    await db.exec('reset role');
  });
  await check('closed event and expired session reject public mutations inside SQL', async () => {
    await db.query("update public.student_result_events set status='closed' where id=$1",[eventId]);
    assert.equal(await dispute(active.sessionToken),'EVENT_CLOSED');
    await db.query("update public.student_result_events set status='open' where id=$1",[eventId]);
    await db.query("update public.student_result_public_sessions set expires_at=clock_timestamp()-interval '1 second' where token=$1",[active.sessionToken]);
    assert.equal(await dispute(active.sessionToken),'SESSION_EXPIRED');
  });
  await check('approved 60/120/600/1200 boundaries use the existing atomic rate limiter', async () => {
    // Keep now() in one transaction so a wall-clock minute boundary cannot change this test.
    await db.exec('begin');
    try {
      for (const limit of [60,120,600,1200]) {
        const key='fictional-approved-limit-'+limit;
        for (let i=0;i<limit;i++) assert.equal(await scalar(
          'select public.consume_student_result_rate_limit($1,60,$2) as result',[key,limit]),true);
        assert.equal(await scalar('select public.consume_student_result_rate_limit($1,60,$2) as result',[key,limit]),false);
      }
    } finally { await db.exec('rollback'); }
  });
  await check('rate-limit windows reset and independent buckets do not consume each other', async () => {
    await db.exec('begin');
    try {
      const key='fictional-exhausted-bucket';
      assert.equal(await scalar('select public.consume_student_result_rate_limit($1,60,1) as result',[key]),true);
      assert.equal(await scalar('select public.consume_student_result_rate_limit($1,60,1) as result',[key]),false);
      assert.equal(await scalar('select public.consume_student_result_rate_limit($1,60,1) as result',['fictional-other-bucket']),true);
      await db.query("update public.student_result_rate_limits set window_started_at=window_started_at-interval '2 minutes' where request_key=$1",[key]);
      assert.equal(await scalar('select public.consume_student_result_rate_limit($1,60,1) as result',[key]),true);
    } finally { await db.exec('rollback'); }
  });
  console.log(`${checks} local SQL checks passed. PGlite uses one connection; multi-connection lock waits and remote deployment are not tested.`);
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { await db.close(); }
