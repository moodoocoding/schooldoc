import { consentCrypto, type ConsentRecipientIdentity } from './consentCrypto.ts';
import { consentChoiceConfigError, type QuestionField } from './consentQuestions.ts';
import { isConsentFieldRectValid } from './consentFieldGeometry.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.8';

export class ConsentHttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const dbResult = <T>(result: { data: T; error: { message: string } | null }): T => {
  if (result.error) {
    const coded = /^(400|401|403|404|409|410|422|425)\|(.+)$/s.exec(result.error.message);
    if (coded) throw new ConsentHttpError(Number(coded[1]), coded[2]);
    throw new ConsentHttpError(500, '저장 요청을 처리하지 못했습니다. 입력을 유지한 채 다시 시도해 주세요.');
  }
  return result.data;
};
export const validateConsentFields = (fields: Array<Record<string, unknown>>, pageCount: number) => {
  if (!Array.isArray(fields) || fields.length > 200) throw new ConsentHttpError(422, '응답 필드 설정을 확인해 주세요.');
  const ids = new Set<string>();
  for (const field of fields) {
    const id = typeof field.id === 'string' ? field.id : '';
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || ids.has(id) || !['text','checkbox','date','signature'].includes(String(field.kind)) ||
      typeof field.label !== 'string' || !field.label.trim() || field.label.length > 80 || typeof field.required !== 'boolean' ||
      !Number.isInteger(field.pageIndex) || Number(field.pageIndex) < 0 || Number(field.pageIndex) >= pageCount ||
      ![field.x,field.y,field.width,field.height].every(v => typeof v === 'number' && Number.isFinite(v)) ||
      !isConsentFieldRectValid(String(field.kind), Number(field.x), Number(field.y), Number(field.width), Number(field.height)))
      throw new ConsentHttpError(422, '응답 필드와 좌표 설정을 확인해 주세요.');
    ids.add(id);
  }
  const issue = consentChoiceConfigError(fields as unknown as QuestionField[]);
  if (issue) throw new ConsentHttpError(422, issue);
};
export const decryptRecipients = async (rows: Array<Record<string, unknown>>) => Promise.all(rows.map(async row => {
  const identity = await consentCrypto.decryptPayload<ConsentRecipientIdentity>(String(row.identity_ciphertext));
  return { id: row.id, token: row.token, name: identity.name, studentKey: identity.studentKey,
    responseId: row.response_id, submittedAt: row.submitted_at, createdAt: row.created_at };
}));
export const responseDetails = async (db: SupabaseClient, rows: Array<Record<string, unknown>>) => {
  const responses = await Promise.all(rows.map(async row => ({ id: String(row.id), submittedAt: String(row.submitted_at),
    recipientId: row.recipient_id, detailsLoaded: true,
    values: await consentCrypto.decryptPayload<Record<string, string>>(String(row.values_ciphertext)) })));
  if (!rows.length) return responses;
  const signatures = dbResult(await db.from('consent_response_signatures').select('response_id,field_id,storage_path').in('response_id', responses.map(r => r.id))) ?? [];
  if (signatures.length) {
    const signed = dbResult(await db.storage.from('consent-signatures').createSignedUrls(signatures.map(s => s.storage_path), 600));
    const urls = new Map((signed ?? []).map(s => [s.path, s.signedUrl]));
    for (const s of signatures) {
      const target = responses.find(r => r.id === s.response_id);
      const url = urls.get(s.storage_path);
      if (!target || !url) throw new ConsentHttpError(500, '서명 이미지를 불러오지 못했습니다. 다시 시도해 주세요.');
      target.values[s.field_id] = url;
    }
  }
  return responses;
};
export const recordCleanup = async (db: SupabaseClient, ownerId: string, formId: string, operation: string, paths: string[]) => {
  // 본문·이름·파일명·외부 오류는 기록하지 않는다.
  const result = await db.from('consent_cleanup_failures').insert({ owner_id: ownerId, form_id: formId, operation, storage_paths: paths });
  if (result.error) console.error('consent cleanup recording failed');
};
