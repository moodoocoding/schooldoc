import { supabase } from '../../utils/supabaseClient';
import { getConsentFieldLayoutIssues } from './consentFieldLayout';
import type { ConsentFieldDraft, ConsentLocalDraft, ConsentPageSize, ConsentRecipientMode, ConsentResponseRecord, ConsentShareSettings } from './types';

const DOCUMENT_BUCKET = 'consent-documents';
const SIGNATURE_BUCKET = 'consent-signatures';
const client = () => {
  if (!supabase) throw new Error('Supabase 연결 정보가 없습니다.');
  return supabase;
};
const fail = (message: string, error?: { message?: string } | null): never => {
  throw new Error(error?.message ? `${message}: ${error.message}` : message);
};

interface ConsentFormRow {
  id: string;
  public_token: string;
  title: string;
  file_name: string;
  source_path: string;
  description: string;
  fields: ConsentFieldDraft[];
  recipient_mode: ConsentRecipientMode;
  recipient_count: number;
  deadline: string | null;
  password_digest: string | null;
  allow_resubmission: boolean;
  response_count: number;
  status: 'open' | 'closed';
  created_at: string;
  page_count: number;
  page_sizes: ConsentPageSize[] | null;
}

const formColumns = 'id, public_token, title, file_name, source_path, description, fields, page_count, page_sizes, recipient_mode, recipient_count, deadline, password_digest, allow_resubmission, response_count, status, created_at';
const mapForm = (row: ConsentFormRow): ConsentLocalDraft => ({
  id: row.id,
  title: row.title,
  fileName: row.file_name,
  fieldCount: row.fields.length,
  recipientMode: row.recipient_mode,
  recipientCount: row.recipient_count,
  createdAt: row.created_at,
  description: row.description,
  fields: row.fields,
  publicToken: row.public_token,
  deadline: row.deadline ?? '',
  passwordEnabled: Boolean(row.password_digest),
  passwordHash: row.password_digest ?? '',
  allowResubmission: row.allow_resubmission,
  responseCount: row.response_count,
  status: row.status,
  sourcePath: row.source_path,
  pageCount: row.page_count,
  pageSizes: row.page_sizes?.length ? row.page_sizes : Array.from({ length: row.page_count }, () => ({ width: 210, height: 297 })),
});

export const listRemoteConsentForms = async () => {
  const { data, error } = await client().from('consent_forms').select(formColumns).order('created_at', { ascending: false });
  if (error) fail('가정통신문 목록을 불러오지 못했습니다', error);
  return ((data ?? []) as ConsentFormRow[]).map(mapForm);
};

export const getRemoteConsentForm = async (id: string) => {
  const { data, error } = await client().from('consent_forms').select(formColumns).eq('id', id).maybeSingle();
  if (error) fail('가정통신문을 불러오지 못했습니다', error);
  return data ? mapForm(data as ConsentFormRow) : null;
};

export const getRemoteConsentSourceFile = async (form: ConsentLocalDraft) => {
  if (!form.sourcePath) throw new Error('원본 PDF 경로가 없습니다.');
  const signed = await client().storage.from(DOCUMENT_BUCKET).createSignedUrl(form.sourcePath, 10 * 60);
  const signedUrl = signed.data?.signedUrl;
  if (signed.error) fail('원본 PDF 주소를 만들지 못했습니다', signed.error);
  if (!signedUrl) throw new Error('원본 PDF 주소를 만들지 못했습니다.');
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error('원본 PDF를 내려받지 못했습니다.');
  return new File([await response.blob()], form.fileName, { type: 'application/pdf' });
};

export const listRemoteConsentResponses = async (formId: string): Promise<ConsentResponseRecord[]> => {
  const { data, error } = await client()
    .from('consent_responses').select('id, values, submitted_at')
    .eq('form_id', formId).order('submitted_at', { ascending: true });
  if (error) fail('제출된 응답을 불러오지 못했습니다', error);
  const rows = (data ?? []) as Array<{ id: string; values: Record<string, string> | null; submitted_at: string }>;
  if (!rows.length) return [];

  const signatureRows = await client()
    .from('consent_response_signatures').select('response_id, field_id, storage_path')
    .in('response_id', rows.map((row) => row.id));
  if (signatureRows.error) fail('서명 이미지를 불러오지 못했습니다', signatureRows.error);
  const signatures = (signatureRows.data ?? []) as Array<{ response_id: string; field_id: string; storage_path: string }>;

  const urlByPath = new Map<string, string>();
  if (signatures.length) {
    const signed = await client().storage.from(SIGNATURE_BUCKET)
      .createSignedUrls(signatures.map((signature) => signature.storage_path), 60 * 60);
    if (signed.error) fail('서명 이미지 주소를 만들지 못했습니다', signed.error);
    (signed.data ?? []).forEach((entry) => {
      if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
    });
  }

  return rows.map((row) => {
    const values = { ...(row.values ?? {}) };
    signatures.filter((signature) => signature.response_id === row.id).forEach((signature) => {
      const url = urlByPath.get(signature.storage_path);
      if (url) values[signature.field_id] = url;
    });
    return { id: row.id, submittedAt: row.submitted_at, values };
  });
};

const STORAGE_PAGE = 1000;
const REMOVE_CHUNK = 100;

/** list는 한 번에 일부만 돌려주므로 끝까지 넘긴다. 응답이 많은 수합에서 빠뜨리지 않기 위함이다. */
const listAllNames = async (prefix: string) => {
  const names: string[] = [];
  for (let offset = 0; ; offset += STORAGE_PAGE) {
    const page = await client().storage.from(SIGNATURE_BUCKET).list(prefix, { limit: STORAGE_PAGE, offset });
    if (page.error) fail('서명 이미지를 확인하지 못했습니다', page.error);
    const entries = page.data ?? [];
    entries.forEach((entry) => names.push(entry.name));
    if (entries.length < STORAGE_PAGE) return names;
  }
};

/** 버킷에 실제로 남아 있는 파일을 훑는다. DB 기록이 어긋나도 실체를 기준으로 지우기 위함이다. */
const listSignaturePaths = async (formId: string) => {
  const paths: string[] = [];
  for (const folder of await listAllNames(formId)) {
    const files = await listAllNames(`${formId}/${folder}`);
    files.forEach((file) => paths.push(`${formId}/${folder}/${file}`));
  }
  return paths;
};

/**
 * 수합을 삭제한다. 응답·서명 행은 on delete cascade로 정리되지만 Storage 객체는 남는다.
 * 게다가 삭제 정책이 consent_forms 행을 참조하므로, 행을 먼저 지우면 남은 파일을
 * 두 번 다시 지울 수 없다. 따라서 파일을 먼저 지우고 실제로 지워졌는지 확인한 뒤에만 행을 지운다.
 */
export const deleteRemoteConsentForm = async (id: string) => {
  const form = await getRemoteConsentForm(id);
  if (!form) throw new Error('가정통신문을 찾지 못했습니다.');

  const signaturePaths = await listSignaturePaths(id);
  if (signaturePaths.length) {
    for (let index = 0; index < signaturePaths.length; index += REMOVE_CHUNK) {
      const removed = await client().storage.from(SIGNATURE_BUCKET).remove(signaturePaths.slice(index, index + REMOVE_CHUNK));
      if (removed.error) fail('서명 이미지를 삭제하지 못했습니다', removed.error);
    }
    // 권한이 없으면 오류 없이 빈 목록만 돌아온다. 조용히 넘어가면 파일이 영구히 남는다.
    const remaining = await listSignaturePaths(id);
    if (remaining.length) throw new Error('서명 이미지를 삭제할 권한이 없어 수합을 지우지 않았습니다. 담당자에게 문의해 주세요.');
  }

  if (form.sourcePath) {
    const removed = await client().storage.from(DOCUMENT_BUCKET).remove([form.sourcePath]);
    if (removed.error) fail('원본 PDF를 삭제하지 못했습니다', removed.error);
  }

  const { error } = await client().from('consent_forms').delete().eq('id', id);
  if (error) fail('가정통신문을 삭제하지 못했습니다', error);
};

export const createRemoteConsentForm = async ({
  title, description, fields, pageSizes, recipientMode, recipientCount, settings, sourceFile,
}: {
  title: string;
  description: string;
  fields: ConsentFieldDraft[];
  pageSizes: ConsentPageSize[];
  recipientMode: ConsentRecipientMode;
  recipientCount: number;
  settings: ConsentShareSettings;
  sourceFile: File;
}) => {
  const layoutIssues = getConsentFieldLayoutIssues(fields, pageSizes.length);
  if (layoutIssues.length) throw new Error(layoutIssues[0].message);
  const { data: authData, error: authError } = await client().auth.getUser();
  if (authError) fail('로그인 정보를 확인하지 못했습니다', authError);
  if (!authData.user) throw new Error('Google 로그인이 필요합니다.');
  const id = crypto.randomUUID();
  const sourcePath = `${authData.user.id}/${id}/source.pdf`;
  // 행이 먼저 생기면 공개 링크가 살아나는데 원본 PDF는 아직 없어서
  // 그 사이에 링크를 연 보호자에게 오류가 보인다. 업로드를 먼저 끝낸다.
  const upload = await client().storage.from(DOCUMENT_BUCKET).upload(sourcePath, sourceFile, { contentType: 'application/pdf', upsert: false });
  if (upload.error) fail('원본 PDF를 저장하지 못했습니다', upload.error);
  try {
    const { data, error } = await client().from('consent_forms').insert({
      id,
      owner_id: authData.user.id,
      title: title.trim(),
      file_name: sourceFile.name,
      source_path: sourcePath,
      description: description.trim(),
      fields,
      page_count: pageSizes.length,
      page_sizes: pageSizes,
      recipient_mode: recipientMode,
      recipient_count: recipientMode === 'named' ? recipientCount : 0,
      deadline: settings.deadline || null,
      allow_resubmission: settings.allowResubmission,
    }).select(formColumns).single();
    if (error || !data) fail('가정통신문 수합을 만들지 못했습니다', error);
    if (settings.passwordEnabled && settings.password.trim()) {
      const passwordResult = await client().rpc('set_consent_form_password', { p_form_id: id, p_password: settings.password.trim() });
      if (passwordResult.error) fail('공개 비밀번호를 설정하지 못했습니다', passwordResult.error);
    }
  } catch (creationError) {
    await client().storage.from(DOCUMENT_BUCKET).remove([sourcePath]);
    await client().from('consent_forms').delete().eq('id', id);
    throw creationError;
  }
  return getRemoteConsentForm(id);
};

export const updateRemoteConsentForm = async (id: string, patch: {
  title?: string;
  deadline?: string;
  allowResubmission?: boolean;
  status?: 'open' | 'closed';
  passwordEnabled?: boolean;
  password?: string;
  description?: string;
  fields?: ConsentFieldDraft[];
  pageCount?: number;
  pageSizes?: ConsentPageSize[];
  fileName?: string;
  sourceFile?: File;
}) => {
  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.deadline !== undefined) values.deadline = patch.deadline || null;
  if (patch.allowResubmission !== undefined) values.allow_resubmission = patch.allowResubmission;
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.fields !== undefined) values.fields = patch.fields;
  if (patch.pageCount !== undefined) values.page_count = patch.pageCount;
  if (patch.pageSizes !== undefined) values.page_sizes = patch.pageSizes;
  if (patch.fileName !== undefined) values.file_name = patch.fileName;
  if (patch.fields !== undefined) {
    const pageCount = patch.pageCount ?? patch.pageSizes?.length ?? (await getRemoteConsentForm(id))?.pageCount ?? 1;
    const layoutIssues = getConsentFieldLayoutIssues(patch.fields, pageCount);
    if (layoutIssues.length) throw new Error(layoutIssues[0].message);
  }
  if (Object.keys(values).length) {
    const { error } = await client().from('consent_forms').update(values).eq('id', id);
    if (error) fail('수합 설정을 저장하지 못했습니다', error);
  }
  if (patch.passwordEnabled === false) {
    const result = await client().rpc('clear_consent_form_password', { p_form_id: id });
    if (result.error) fail('공개 비밀번호를 해제하지 못했습니다', result.error);
  } else if (patch.passwordEnabled && patch.password?.trim()) {
    const result = await client().rpc('set_consent_form_password', { p_form_id: id, p_password: patch.password.trim() });
    if (result.error) fail('공개 비밀번호를 설정하지 못했습니다', result.error);
  }
  if (patch.sourceFile) {
    const form = await getRemoteConsentForm(id);
    if (!form?.sourcePath) throw new Error('원본 PDF 저장 경로를 찾지 못했습니다.');
    const upload = await client().storage.from(DOCUMENT_BUCKET).update(form.sourcePath, patch.sourceFile, { contentType: 'application/pdf', upsert: true });
    if (upload.error) fail('원본 PDF를 갱신하지 못했습니다', upload.error);
  }
  return getRemoteConsentForm(id);
};
