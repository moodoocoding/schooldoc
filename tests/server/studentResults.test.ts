// Actual Edge handlers, AES-GCM, and PostgreSQL (PGlite). Only Auth/PostgREST
// transport are substitutes; no hosted Supabase or student data is accessed.
import { PGlite } from 'npm:@electric-sql/pglite@0.5.8';
import { studentResultSummary } from '../../src/features/studentResults/studentResultsUtils.ts';
import { decryptStudentPayload } from '../../supabase/functions/_shared/studentResultsCrypto.ts';

const owner = '10000000-0000-4000-8000-000000000001';
const otherOwner = '10000000-0000-4000-8000-000000000002';
const assert = (value: unknown, message = 'Student result assertion failed') => { if (!value) throw new Error(message); };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
type Handler = (request: Request) => Promise<Response>;
let captured: Handler;
const previousServe = Deno.serve;
const envNames = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STUDENT_RESULTS_ENCRYPTION_KEY'];
const previousEnv = envNames.map((name) => Deno.env.get(name));
Deno.env.set(envNames[0], 'https://student-result-test.invalid');
Deno.env.set(envNames[1], 'fixture-service-key');
Deno.env.set(envNames[2], '12'.repeat(32));
Deno.serve = ((handler: Handler) => { captured = handler; return {} as ReturnType<typeof Deno.serve>; }) as typeof Deno.serve;
await import('../../supabase/functions/student-results-admin/index.ts');
const admin = captured!;
await import('../../supabase/functions/student-results-public/index.ts');
const student = captured!;
Deno.serve = previousServe;
envNames.forEach((name, i) => previousEnv[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, previousEnv[i]!));

const draft = {
  title: '가상 평가 결과', description: '합성 데이터 안내', allowConfirmation: true, allowDispute: true,
  columns: [
    { id: 'detail', label: '세부 점수', maxScore: 50, description: '' },
    { id: 'total', label: '총점', maxScore: 100, description: '' },
  ],
  recipients: [
    { studentKey: '1', name: '가상하늘', verificationCode: '4821', values: { detail: 45, total: 92 }, feedback: '가상 피드백' },
    { studentKey: '2', name: '가상바다', verificationCode: '5732', values: { detail: 40, total: 87 }, feedback: '' },
  ],
};

async function fixture(run: (f: Awaited<ReturnType<typeof createFixture>>) => Promise<void>) {
  const oldFetch = globalThis.fetch;
  const oldKey = Deno.env.get(envNames[2]);
  Deno.env.set(envNames[2], '12'.repeat(32));
  const db = await PGlite.create();
  try { await run(await createFixture(db)); }
  finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) Deno.env.delete(envNames[2]); else Deno.env.set(envNames[2], oldKey);
    await db.close();
  }
}

async function createFixture(db: PGlite) {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function public.crypt(text,text) returns text language sql immutable as $$ select $1 $$;
    create function public.gen_salt(text,int) returns text language sql immutable as $$ select 'fixture'::text $$;
    insert into auth.users values('${owner}'),('${otherOwner}');`);
  for (const file of [
    '202608130002_student_results.sql', '202608130003_student_results_deidentification.sql',
    '202608130004_student_results_protected_disputes.sql', '202610010100_student_result_corrections.sql',
    '202610020200_student_result_settings_versions.sql',
  ]) {
    let sql = await Deno.readTextFile(new URL('../../supabase/migrations/' + file, import.meta.url));
    if (file === '202608130002_student_results.sql') {
      // PGlite lacks pgcrypto and replication. Only these infrastructure hooks
      // are substituted; tables, RLS, version triggers, and RPCs execute as shipped.
      sql = sql.replace('create extension if not exists pgcrypto;', '').split('\ndo $$')[0];
    }
    await db.exec(sql);
  }
  let raceBeforeConfirm: (() => Promise<void>) | undefined;
  let raceBeforeColumns: (() => Promise<void>) | undefined;
  const quote = (name: string) => { assert(/^[a-z_]+$/.test(name), 'Unexpected fixture identifier'); return `"${name}"`; };
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert(url.hostname === 'student-result-test.invalid', 'Unexpected external request');
    if (url.pathname === '/auth/v1/user') {
      const bearer = request.headers.get('authorization');
      return bearer === 'Bearer teacher-a' || bearer === 'Bearer teacher-b'
        ? json({ id: bearer === 'Bearer teacher-a' ? owner : otherOwner, aud: 'authenticated', role: 'authenticated' })
        : json({ message: 'invalid token' }, 401);
    }
    const name = url.pathname.split('/').at(-1)!;
    const body = request.method === 'GET' || request.method === 'DELETE' ? undefined : await request.json();
    if (url.pathname.includes('/rpc/')) {
      const args = Object.keys(body);
      const result = await db.query<{ value: unknown }>(`select ${quote(name)}(${args.map((arg, i) => `${quote(arg)} := $${i + 1}`).join(',')}) as value`, args.map((arg) => body[arg]));
      return json(result.rows[0].value);
    }
    assert(name.startsWith('student_result_'), 'Unexpected fixture table');
    const params: unknown[] = [];
    const where: string[] = [];
    for (const [field, filter] of url.searchParams) {
      if (['select', 'order', 'limit', 'columns', 'on_conflict'].includes(field)) continue;
      if (filter.startsWith('eq.')) { params.push(filter.slice(3)); where.push(`${quote(field)} = $${params.length}`); }
      else if (filter.startsWith('in.(')) {
        const values = filter.slice(4, -1).split(',');
        where.push(`${quote(field)} in (${values.map((value) => { params.push(value); return `$${params.length}`; }).join(',')})`);
      } else throw new Error('Unexpected fixture filter: ' + filter);
    }
    const condition = where.length ? ' where ' + where.join(' and ') : '';
    let rows: Record<string, unknown>[];
    if (request.method === 'GET') {
      if (name === 'student_result_columns' && raceBeforeColumns) {
        const race = raceBeforeColumns; raceBeforeColumns = undefined; await race();
      }
      const order = url.searchParams.get('order')?.split('.')[0];
      rows = (await db.query<Record<string, unknown>>(`select * from ${quote(name)}${condition}${order ? ' order by ' + quote(order) : ''}`, params)).rows;
    } else if (request.method === 'POST') {
      rows = [];
      for (const value of Array.isArray(body) ? body : [body]) {
        const fields = Object.keys(value);
        rows.push(...(await db.query<Record<string, unknown>>(`insert into ${quote(name)} (${fields.map(quote).join(',')}) values (${fields.map((_, i) => `$${i + 1}`).join(',')}) returning *`, fields.map((field) => value[field]))).rows);
      }
    } else if (request.method === 'PATCH') {
      if (body.status === 'confirmed' && raceBeforeConfirm) {
        const race = raceBeforeConfirm; raceBeforeConfirm = undefined; await race();
      }
      const fields = Object.keys(body);
      const sets = fields.map((field) => { params.push(body[field]); return `${quote(field)} = $${params.length}`; });
      rows = (await db.query<Record<string, unknown>>(`update ${quote(name)} set ${sets.join(',')}${condition} returning *`, params)).rows;
    } else if (request.method === 'DELETE') {
      rows = (await db.query<Record<string, unknown>>(`delete from ${quote(name)}${condition} returning *`, params)).rows;
    } else throw new Error('Unexpected fixture method');
    return json(request.headers.get('accept')?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);
  };
  const call = (handler: Handler, body: object, bearer?: string) => handler(new Request('https://handler.invalid', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body),
  }));
  const teacherCall = (body: object, bearer = 'teacher-a') => call(admin, body, bearer);
  const studentCall = (body: object) => call(student, body);
  const create = async (value = draft) => {
    const response = await teacherCall({ action: 'create', draft: value });
    assert(response.status === 200, await response.clone().text());
    return (await response.json()).event;
  };
  const get = async (eventId: string) => (await (await teacherCall({ action: 'get', eventId })).json()).event;
  const settings = (event: any) => ({ title: event.title, description: event.description, allowConfirmation: event.allowConfirmation, allowDispute: event.allowDispute, columns: event.columns });
  const save = (event: any, patch: Record<string, unknown>) => teacherCall({ action: 'update-settings', eventId: event.id, expectedUpdatedAt: event.updatedAt, settings: { ...settings(event), ...patch } });
  const authenticate = async (event: any, index = 0) => {
    const response = await studentCall({ action: 'authenticate', token: event.publicToken, name: draft.recipients[index].name, verificationCode: draft.recipients[index].verificationCode });
    assert(response.status === 200, await response.clone().text());
    return response.json();
  };
  const confirm = (session: any, version = session.result.recipient.updatedAt) => studentCall({ action: 'confirm', sessionToken: session.sessionToken, expectedUpdatedAt: version });
  return { db, teacherCall, studentCall, create, get, settings, save, authenticate, confirm,
    race: (fn: () => Promise<void>) => { raceBeforeConfirm = fn; },
    readRace: (fn: () => Promise<void>) => { raceBeforeColumns = fn; } };
}

Deno.test('manual/inferred total survives encrypted save, teacher reload, and student reload', () => fixture(async (f) => {
  for (const label of ['총점', '합계', ' Total Score ']) {
    const event = await f.create({ ...draft, columns: [draft.columns[0], { ...draft.columns[1], label }] });
    const loaded = await f.get(event.id);
    assert(loaded.columns[1].kind === 'total');
    assert(studentResultSummary(loaded.columns, loaded.recipients[0].values).score === 92);
    const session = await f.authenticate(event);
    assert(studentResultSummary(session.result.event.columns, session.result.recipient.values).score === 92);
    assert(!('verificationCode' in session.result.recipient) && !('personalToken' in session.result.recipient));
    const stored = (await f.db.query<any>('select * from student_result_recipients where event_id=$1', [event.id])).rows[0];
    assert(stored.result_values === null && stored.name === null);
    assert((await decryptStudentPayload<any>(stored.result_ciphertext)).values.total === 92);
  }
  const explicit = await f.create({ ...draft, columns: draft.columns.map((c) => ({ ...c, kind: 'score' })) });
  assert(studentResultSummary(explicit.columns, explicit.recipients[0].values).score === 137);
  const duplicate = await f.teacherCall({ action: 'create', draft: { ...draft, columns: draft.columns.map((c) => ({ ...c, label: '총점' })) } });
  assert(duplicate.status === 400);
}));

Deno.test('settings corrections invalidate confirmed and unconfirmed screens; refresh permits confirmation', () => fixture(async (f) => {
  for (const field of ['label', 'kind', 'maxScore', 'description', 'title', 'allowDispute']) {
    const created = await f.create();
    const session = await f.authenticate(created);
    const unseen = await f.authenticate(created, 1);
    const confirmed = await f.confirm(session);
    assert(confirmed.status === 200, await confirmed.clone().text());
    const current = await f.get(created.id);
    const patch = field === 'title' ? { title: '정정된 제목' } : field === 'allowDispute' ? { allowDispute: false }
      : { columns: current.columns.map((c: any) => c.id === 'total' ? { ...c, [field]: field === 'kind' ? 'score' : field === 'maxScore' ? 200 : '정정 항목' } : c) };
    assert((await f.save(current, patch)).status === 200);
    const updated = await f.get(created.id);
    assert(updated.recipients[0].status === 'reconfirm' && !updated.recipients[0].confirmedAt);
    for (const r of updated.recipients) assert(r.updatedAt !== current.recipients.find((old: any) => old.id === r.id).updatedAt);
    assert((await f.confirm(session)).status === 409);
    assert((await f.confirm(unseen)).status === 409);
    assert((await f.studentCall({ action: 'confirm', sessionToken: session.sessionToken })).status === 409);
    const refreshed = await (await f.studentCall({ action: 'session', sessionToken: session.sessionToken })).json();
    assert(refreshed.result.event.columns[1][field] === updated.columns[1][field] || field === 'title' || field === 'allowDispute');
    assert((await f.confirm(refreshed)).status === 200);
    assert((await f.save(current, patch)).status === 409);
    const latest = await f.get(created.id);
    assert(latest.recipients[0].values.total === 92 && latest.revisions.length === 1);
  }
}));

Deno.test('no-op preserves confirmation; CAS rejects an edit between confirm read and write; access stays scoped', () => fixture(async (f) => {
  const created = await f.create();
  const session = await f.authenticate(created);
  assert((await f.confirm(session)).status === 200);
  const current = await f.get(created.id);
  assert((await f.save(current, {})).status === 200);
  const identical = await f.get(created.id);
  assert(identical.updatedAt === current.updatedAt && identical.recipients[0].status === 'confirmed');
  assert(identical.recipients[0].updatedAt === current.recipients[0].updatedAt && !identical.revisions);
  const refreshed = await (await f.studentCall({ action: 'session', sessionToken: session.sessionToken })).json();
  f.race(async () => { assert((await f.save(current, { title: '확인 직전 설정 정정' })).status === 200); });
  assert((await f.confirm(refreshed)).status === 409);
  assert((await f.teacherCall({ action: 'get', eventId: created.id }, 'teacher-b')).status === 404);
  assert((await f.teacherCall({ action: 'get', eventId: created.id }, 'invalid')).status === 401);
  const privileges = (await f.db.query<any>(`select has_function_privilege('anon', 'update_student_result_event_settings(uuid,uuid,timestamptz,jsonb,text,text,boolean,boolean,jsonb,text)', 'EXECUTE') as anon,
    has_function_privilege('authenticated', 'update_student_result_event_settings(uuid,uuid,timestamptz,jsonb,text,text,boolean,boolean,jsonb,text)', 'EXECUTE') as authenticated`)).rows[0];
  assert(!privileges.anon && !privileges.authenticated);
}));

Deno.test('confirmation option changes preserve disputes and only label actual replies replied', () => fixture(async (f) => {
  const created = await f.create();
  const session = await f.authenticate(created);
  assert((await f.confirm(session)).status === 200);
  const disputed = await f.authenticate(created, 1);
  const dispute = await f.studentCall({ action: 'dispute', sessionToken: disputed.sessionToken, message: '가상 이의' });
  assert(dispute.status === 200);
  let current = await f.get(created.id);
  assert((await f.save(current, { allowConfirmation: false })).status === 200);
  current = await f.get(created.id);
  assert(current.recipients[0].status === 'viewed' && !current.recipients[0].confirmedAt);
  assert(current.recipients[1].status === 'disputed');
  assert((await f.teacherCall({ action: 'reply', eventId: current.id, recipientId: current.recipients[1].id, reply: '가상 답변' })).status === 200);
  current = await f.get(created.id);
  assert(current.recipients[1].status === 'replied');
  assert((await f.save(current, { allowConfirmation: true })).status === 200);
  current = await f.get(created.id);
  assert(current.recipients[1].status === 'reconfirm');
  assert((await f.save(current, { allowConfirmation: false })).status === 200);
  current = await f.get(created.id);
  assert(current.recipients[1].status === 'replied' && current.recipients[1].dispute.teacherReply === '가상 답변');
}));

Deno.test('settings change during reload rejects a mixed snapshot; same-transaction versions always advance', () => fixture(async (f) => {
  const created = await f.create();
  const session = await f.authenticate(created);
  const current = await f.get(created.id);
  f.readRace(async () => { assert((await f.save(current, { title: '조회 도중 정정된 제목' })).status === 200); });
  assert((await f.studentCall({ action: 'session', sessionToken: session.sessionToken })).status === 409);
  const refreshed = await (await f.studentCall({ action: 'session', sessionToken: session.sessionToken })).json();
  assert(refreshed.result.event.title === '조회 도중 정정된 제목');
  assert((await f.confirm(refreshed)).status === 200);
  const recipientId = current.recipients[0].id;
  await f.db.transaction(async (tx) => {
    await tx.query(`update student_result_recipients set updated_at='2099-01-01' where id=$1`, [recipientId]);
    const first = (await tx.query<{ value: string }>('select updated_at::text as value from student_result_recipients where id=$1', [recipientId])).rows[0].value;
    await tx.query('update student_result_recipients set updated_at=now() where id=$1', [recipientId]);
    const second = (await tx.query<{ newer: boolean }>('select updated_at > $2::timestamptz as newer from student_result_recipients where id=$1', [recipientId, first])).rows[0].newer;
    assert(second, 'Two writes in a transaction must produce different CAS tokens');
  });
}));

Deno.test('legacy NULL kinds retain confirmation on semantically identical save, but real edits invalidate it', () => fixture(async (f) => {
  const created = await f.create();
  await f.db.query('update student_result_columns set kind=null where event_id=$1', [created.id]);
  const session = await f.authenticate(created);
  assert(studentResultSummary(session.result.event.columns, session.result.recipient.values).score === 92);
  assert((await f.confirm(session)).status === 200);
  const current = await f.get(created.id);
  assert(current.columns.every((c: any) => c.kind === undefined));
  assert((await f.save(current, {})).status === 200);
  const same = await f.get(created.id);
  assert(same.updatedAt === current.updatedAt && same.recipients[0].updatedAt === current.recipients[0].updatedAt);
  assert(same.recipients[0].status === 'confirmed' && same.recipients[0].confirmedAt === current.recipients[0].confirmedAt && !same.revisions);
  // Also exercise the new client's explicit serialization of legacy kinds.
  const explicitColumns = current.columns.map((c: any) => ({ ...c, kind: c.id === 'total' ? 'total' : 'score' }));
  assert((await f.save(same, { columns: explicitColumns })).status === 200);
  const stillSame = await f.get(created.id);
  assert(stillSame.updatedAt === current.updatedAt && stillSame.recipients[0].status === 'confirmed' && !stillSame.revisions);
  assert(stillSame.columns.every((c: any) => c.kind === undefined));
  assert((await f.save(stillSame, { columns: explicitColumns.map((c: any) => ({ ...c, maxScore: 200 })) })).status === 200);
  assert((await f.get(created.id)).recipients[0].status === 'reconfirm');
}));
