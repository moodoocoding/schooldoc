import fs from 'node:fs/promises';
import ts from 'typescript';
let row = { id: 'form', public_token: 'token', title: '원본 제목', file_name: 'original.pdf', source_path: 'owner/form/source.pdf', description: '', fields: [{ id: 'old', kind: 'text', label: '기존 응답', required: true, pageIndex: 0, x: 10, y: 10, width: 30, height: 7 }], page_count: 2, page_sizes: [{ width: 210, height: 297 }, { width: 210, height: 297 }], recipient_mode: 'named', recipient_count: 24, deadline: null, password_digest: null, allow_resubmission: false, response_count: 24, status: 'open', created_at: '2026-10-01T00:00:00Z', closed_at: null, retention_months: 12 };
const calls = [];
const client = { from: () => ({ update: v => ({ eq: async () => { Object.assign(row, v); calls.push({ operation: 'DB metadata update', values: v }); return { error: null }; } }), select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: structuredClone(row), error: null }) }) }) }), storage: { from: () => ({ update: async () => { calls.push({ operation: 'Storage source PDF update', error: 'mock upload failure' }); return { error: { message: 'mock upload failure' } }; } }) } };
const source = await fs.readFile('src/features/consentForms/consentFormsRepository.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = { exports: {} };
new Function('require', 'module', 'exports', code)(n => n === '../../utils/supabaseClient' ? { supabase: client } : n === './consentFieldLayout' ? { getConsentFieldLayoutIssues: () => [] } : {}, m, m.exports);
let error;
try {
    await m.exports.updateRemoteConsentForm('form', { fields: [{ id: 'new', kind: 'text', label: '바뀐 질문', required: true, pageIndex: 0, x: 50, y: 50, width: 30, height: 7 }], pageCount: 1, pageSizes: [{ width: 210, height: 297 }], fileName: 'replacement.pdf', sourceFile: new File(['fictional PDF'], 'replacement.pdf') });
}
catch (e) {
    error = e.message;
}
const result = { method: 'actual repository TypeScript, mocked Supabase, zero network', error, calls, rowAfterFailure: row, sourceAfterFailure: 'original 2-page PDF', note: 'layout validation stub passes a valid field; no product file edited' };
await fs.writeFile('design/feature-reviews/2026-10-01-consent/evidence/source-replacement-probe.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
