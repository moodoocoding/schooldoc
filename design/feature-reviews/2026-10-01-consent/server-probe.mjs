import fs from 'node:fs/promises';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
const ev = 'design/feature-reviews/2026-10-01-consent/evidence';
const clone = x => JSON.parse(JSON.stringify(x));
const ids = { form: '11111111-1111-4111-8111-111111111111', token: '22222222-2222-4222-8222-222222222222', recipient: '33333333-3333-4333-8333-333333333333', owner: '55555555-5555-4555-8555-555555555555' };
const env = { SUPABASE_URL: 'https://offline.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'mock-service', SUPABASE_ANON_KEY: 'mock-anon', CONSENT_FORMS_ENCRYPTION_KEY: '12'.repeat(32) };
const runtime = { env: { get: k => env[k] }, serve: h => handlers.push(h) };
const handlers = [];
async function module(file, deps = {}) { const source = await fs.readFile(file, 'utf8'); const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; const m = { exports: {} }; new Function('require', 'module', 'exports', 'Deno', 'crypto', js)(name => { if (!(name in deps))
    throw Error('Unmapped dependency ' + name); return deps[name]; }, m, m.exports, runtime, webcrypto); return m.exports; }
const cryptoModule = await module('supabase/functions/_shared/payloadCrypto.ts');
const consentCrypto = (await module('supabase/functions/_shared/consentCrypto.ts', { './payloadCrypto.ts': cryptoModule })).consentCrypto;
const questions = await module('supabase/functions/_shared/consentQuestions.ts');
const geometry = await module('supabase/functions/_shared/consentFieldGeometry.ts');
const choice = { id: 'agreement', label: '참가 동의 여부', mode: 'single', required: true, minSelections: 1 };
const fields = [{ id: 'yes', kind: 'checkbox', label: '예', required: false, choice, pageIndex: 0, x: 20, y: 30, width: 2, height: 1.414 }, { id: 'no', kind: 'checkbox', label: '아니오', required: false, choice, pageIndex: 0, x: 40, y: 30, width: 2, height: 1.414 }];
let state;
async function reset(options = {}) { state = { tables: { consent_forms: [{ id: ids.form, owner_id: ids.owner, public_token: ids.token, title: '가상 동의서', description: '', source_path: 'owner/form/source.pdf', fields, deadline: null, password_digest: null, allow_resubmission: true, status: 'open', page_count: 1, page_sizes: [{ width: 210, height: 297 }], response_count: 0, ...options.form }], consent_recipients: [{ id: 'recipient-1', form_id: ids.form, token: ids.recipient, identity_ciphertext: await consentCrypto.encryptPayload({ name: '가상학생', studentKey: '1' }), display_hint: '가○○', response_id: null, submitted_at: null }], consent_responses: [], consent_response_signatures: [], consent_purge_log: [], privacy_purge_log: [] }, calls: [], failCount: options.failCount ?? false, failUpload: false, rate: options.rate ?? false, rateCounts: {}, userId: options.userId ?? ids.owner }; }
class Query {
    constructor(table) { this.table = table; this.filters = []; this.action = 'select'; }
    select() { return this; }
    eq(k, v) { this.filters.push(r => r[k] === v); return this; }
    is(k, v) { this.filters.push(r => r[k] === v); return this; }
    in(k, vs) { this.filters.push(r => vs.includes(r[k])); return this; }
    order() { return this; }
    insert(v) { this.action = 'insert'; this.value = Array.isArray(v) ? v : [v]; return this; }
    update(v) { this.action = 'update'; this.value = v; return this; }
    delete() { this.action = 'delete'; return this; }
    maybeSingle() { return this.exec(true); }
    single() { return this.exec(true); }
    then(resolve, reject) { return this.exec(false).then(resolve, reject); }
    async exec(single) { const rows = state.tables[this.table] ??= []; state.calls.push({ table: this.table, action: this.action, value: this.value }); const selected = rows.filter(r => this.filters.every(f => f(r))); if (this.action === 'insert') {
        for (const r of this.value)
            rows.push(clone(r));
        return { data: null, error: null };
    } if (this.action === 'update') {
        selected.forEach(r => Object.assign(r, clone(this.value)));
        return { data: single ? clone(selected[0]) : clone(selected), error: null };
    } if (this.action === 'delete') {
        state.tables[this.table] = rows.filter(r => !selected.includes(r));
        if (this.table === 'consent_responses')
            for (const r of state.tables.consent_recipients)
                if (selected.some(x => x.id === r.response_id))
                    r.response_id = null;
        return { data: null, error: null };
    } return { data: single ? clone(selected[0] ?? null) : clone(selected), error: null }; }
}
const db = { from: t => new Query(t), auth: { getUser: async () => ({ data: { user: { id: state.userId } }, error: null }) }, storage: { from: b => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://offline.example.invalid/source.pdf' }, error: null }), list: async () => ({ data: [], error: null }), remove: async (p) => ({ data: p, error: null }), upload: async () => ({ data: {}, error: null }) }) }, rpc: async (name, params) => { state.calls.push({ rpc: name, params }); if (name === 'consume_consent_rate_limit') {
        let n = (state.rateCounts[params.p_request_key] ?? 0) + 1;
        state.rateCounts[params.p_request_key] = n;
        return { data: !state.rate || n <= params.p_max_requests, error: null };
    } if (name === 'increment_consent_response_count') {
        if (state.failCount)
            return { data: null, error: { message: 'mock count failure' } };
        state.tables.consent_forms[0].response_count++;
        return { data: null, error: null };
    } return { data: true, error: null }; } };
await module('supabase/functions/consent-forms-public/index.ts', { 'npm:@supabase/supabase-js@2.110.8': { createClient: () => db }, '../_shared/consentCrypto.ts': { consentCrypto }, '../_shared/consentQuestions.ts': questions, '../_shared/consentFieldGeometry.ts': geometry });
const publicHandler = handlers[0];
await module('supabase/functions/consent-forms-admin/index.ts', { 'npm:@supabase/supabase-js@2.110.8': { createClient: () => db }, '../_shared/consentCrypto.ts': { consentCrypto } });
const adminHandler = handlers[1];
async function call(handler, body) { const response = await handler(new Request('https://offline.example.invalid', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-user', 'x-forwarded-for': '192.0.2.1' }, body: JSON.stringify(body) })); return { status: response.status, body: await response.json() }; }
const submit = (values = { no: 'true' }, extra = {}) => call(publicHandler, { action: 'submit', token: ids.token, recipientToken: ids.recipient, values, ...extra });
const result = { method: 'Actual TypeScript transpiled to CommonJS; in-memory Supabase and Deno.serve shim; actual AES-GCM; zero network.', probes: [] };
await reset();
const first = await submit();
const second = await submit({ yes: 'true' });
const sheet = await module('src/features/consentForms/consentResponsesExcel.ts', { './consentResponseRender': { formatConsentValue: (f, v) => v } });
const rs = await Promise.all(state.tables.consent_responses.map(async (r) => ({ id: r.id, recipientId: r.recipient_id, submittedAt: '2026-10-01T00:00:00Z', values: await consentCrypto.decryptPayload(r.values_ciphertext) })));
const recipients = state.tables.consent_recipients.map(r => ({ id: r.id, name: '가상학생', studentKey: '1', responseId: r.response_id, submittedAt: r.submitted_at }));
result.probes.push({ name: 'resubmission creates two records, older submitter disappears in Excel', first, second, count: state.tables.consent_forms[0].response_count, responses: rs, sheet: sheet.buildConsentResponsesSheet(fields, rs, recipients) });
await reset({ form: { allow_resubmission: false } });
const concurrent = await Promise.all([submit(), submit()]);
result.probes.push({ name: 'concurrent submits despite no resubmission', concurrent, responseRows: state.tables.consent_responses.length, count: state.tables.consent_forms[0].response_count });
await reset({ failCount: true, form: { allow_resubmission: false } });
const failed = await submit();
state.failCount = false;
const retry = await submit();
result.probes.push({ name: 'failed increment leaves submitted recipient with no response', failed, retry, responseRows: state.tables.consent_responses.length, recipient: state.tables.consent_recipients[0], count: state.tables.consent_forms[0].response_count });
await reset({ rate: true });
const rate = [];
for (let i = 0; i < 9; i++)
    rate.push((await submit({ no: 'true' }, { recipientToken: '' })).status);
result.probes.push({ name: 'shared IP ninth submit blocked within one window', statuses: rate });
await reset();
const invalidToken = await submit({ no: 'true' }, { recipientToken: 'mistyped-recipient' });
result.probes.push({ name: 'malformed personal token silently becomes anonymous', result: invalidToken, recipientId: state.tables.consent_responses[0]?.recipient_id });
await reset({ userId: '66666666-6666-4666-8666-666666666666' });
const foreign = await call(adminHandler, { action: 'responses', formId: ids.form });
result.probes.push({ name: 'owner guard denies foreign teacher', result: foreign });
await reset();
const purge = await call(adminHandler, { action: 'purge', formIds: [ids.form] });
result.probes.push({ name: 'admin purge accepts ongoing form', result: purge, formsRemaining: state.tables.consent_forms.length, calls: state.calls });
await fs.writeFile(ev + '/server-probes.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.probes.map(p => ({ name: p.name, status: p.result?.status, rows: p.responseRows, count: p.count, statuses: p.statuses, concurrent: p.concurrent?.map(x => x.status) })), null, 2));
