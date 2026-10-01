import { invokeConsentAdmin } from './consentAdminApi';
import { supabase } from '../../utils/supabaseClient';
import { getConsentFieldLayoutIssues } from './consentFieldLayout';
import type { ConsentFieldDraft, ConsentLocalDraft, ConsentPageSize, ConsentRecipientMode, ConsentShareSettings } from './types';

const DOCUMENT_BUCKET = 'consent-documents';
const client = () => {
  if (!supabase) throw new Error('Supabase 연결 정보가 없습니다.');
  return supabase;
};
const fail = (message: string, _error?: { message?: string } | null): never => {
  throw new Error(`${message}. 입력은 유지됩니다. 연결을 확인하고 다시 시도해 주세요.`);
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
  password_enabled: boolean;
  field_count?: number;
  publication_state?: 'preparing' | 'ready' | 'purging';
  document_revision?: number;
  current_response_count?: number;
  updated_at?: string;
  allow_resubmission: boolean;
  response_count: number;
  status: 'open' | 'closed';
  created_at: string;
  page_count: number;
  page_sizes: ConsentPageSize[] | null;
  retention_months: number | null;
  closed_at: string | null;
}

export const mapConsentForm = (row: ConsentFormRow): ConsentLocalDraft => ({
  id: row.id,
  title: row.title,
  fileName: row.file_name,
  fieldCount: row.field_count ?? row.fields?.length ?? 0,
  recipientMode: row.recipient_mode,
  recipientCount: row.recipient_count,
  createdAt: row.created_at,
  description: row.description,
  fields: row.fields ?? [],
  publicToken: row.public_token,
  deadline: row.deadline ?? '',
  passwordEnabled: Boolean(row.password_enabled),
  passwordHash: row.password_enabled ? 'configured' : '',
  allowResubmission: row.allow_resubmission,
  responseCount: row.response_count,
  status: row.status,
  closedAt: row.closed_at ?? undefined,
  publicationState: row.publication_state, documentRevision: row.document_revision, currentResponseCount: row.current_response_count, updatedAt: row.updated_at,
  sourcePath: row.source_path,
  pageCount: row.page_count,
  pageSizes: row.page_sizes?.length ? row.page_sizes : Array.from({ length: row.page_count }, () => ({ width: 210, height: 297 })),
  retentionMonths: row.retention_months ?? undefined,
});

export const listRemoteConsentForms = async () => {
  const rows: ConsentLocalDraft[] = []; let cursor: unknown = null;
  do {
    const page = await invokeConsentAdmin<{forms:ConsentFormRow[];nextCursor:unknown}>({action:'forms',cursor});
    rows.push(...page.forms.map(mapConsentForm)); cursor=page.nextCursor;
  } while(cursor);
  return rows;
};
export const getRemoteConsentForm = async (id: string) => mapConsentForm((await invokeConsentAdmin<{form:ConsentFormRow}>({action:'get',formId:id})).form);
export const getConsentManagementBundle = async (id: string) => {
  const bundle=await invokeConsentAdmin<{form:ConsentFormRow;recipients:import('./types').ConsentRecipientRecord[];responses:import('./types').ConsentResponseRecord[]}>({action:'bundle',formId:id});
  return {...bundle,form:mapConsentForm(bundle.form)};
};
// 메모리에만 보관한다. 계정과 불변 원본 경로가 바뀌면 재사용하지 않는다.
const sourceCache=new Map<string,{expires:number;file:Promise<File>}>();
supabase?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT') sourceCache.clear();});
export const getRemoteConsentSourceFile = async (form: ConsentLocalDraft) => {
  if(!form.sourcePath) throw new Error('원본 PDF 경로가 없습니다.');
  const session=await client().auth.getSession(); const userId=session.data.session?.user.id;
  if(!userId) throw new Error('로그인이 필요합니다.');
  const key=`${userId}:${form.id}:${form.documentRevision ?? 1}:${form.sourcePath}`;
  const cached=sourceCache.get(key); if(cached && cached.expires>Date.now()) return cached.file;
  sourceCache.clear();
  const file=(async()=>{
    const signed=await client().storage.from(DOCUMENT_BUCKET).createSignedUrl(form.sourcePath!,600);
    if(signed.error || !signed.data?.signedUrl) throw new Error('원본 PDF 주소를 만들지 못했습니다.');
    const response=await fetch(signed.data.signedUrl);
    if(!response.ok) throw new Error('원본 PDF를 내려받지 못했습니다.');
    return new File([await response.blob()],form.fileName,{type:'application/pdf'});
  })();
  sourceCache.set(key,{expires:Date.now()+9*60000,file});
  try{return await file;} catch(error){sourceCache.delete(key);throw error;}
};

export const createRemoteConsentForm = async ({
  title, description, fields, pageSizes, recipientMode, settings, sourceFile, pendingId,
}: {
  title: string;
  description: string;
  fields: ConsentFieldDraft[];
  pageSizes: ConsentPageSize[];
  recipientMode: ConsentRecipientMode;
  recipientCount: number;
  settings: ConsentShareSettings;
  sourceFile: File;
  pendingId?: string;
}) => {
  const layoutIssues = getConsentFieldLayoutIssues(fields, pageSizes.length);
  if (layoutIssues.length) throw new Error(layoutIssues[0].message);
  const { data: authData, error: authError } = await client().auth.getUser();
  if (authError) fail('로그인 정보를 확인하지 못했습니다', authError);
  if (!authData.user) throw new Error('Google 로그인이 필요합니다.');
  if (pendingId) return getRemoteConsentForm(pendingId);
  const id = crypto.randomUUID();
  const sourcePath = `${authData.user.id}/${id}/${crypto.randomUUID()}.pdf`;
  // 행이 먼저 생기면 공개 링크가 살아나는데 원본 PDF는 아직 없어서
  // 그 사이에 링크를 연 보호자에게 오류가 보인다. 업로드를 먼저 끝낸다.
  const upload = await client().storage.from(DOCUMENT_BUCKET).upload(sourcePath, sourceFile, { contentType: 'application/pdf', upsert: false });
  if (upload.error) fail('원본 PDF를 저장하지 못했습니다', upload.error);
  try {
    const {data,error} = await client().from('consent_forms').insert({
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
      recipient_count: 0,
      publication_state: 'preparing',
      deadline: settings.deadline || null,
      allow_resubmission: settings.allowResubmission,
      retention_months: settings.retentionMonths,
    }).select('id,public_token,created_at,document_revision').single();
    if(error || !data) fail('가정통신문 수합을 만들지 못했습니다', error);
    return {id,title:title.trim(),fileName:sourceFile.name,fieldCount:fields.length,recipientMode,recipientCount:0,createdAt:data!.created_at,description:description.trim(),fields,publicToken:data!.public_token,deadline:settings.deadline,passwordEnabled:false,passwordHash:'',allowResubmission:settings.allowResubmission,responseCount:0,currentResponseCount:0,status:'open',publicationState:'preparing',documentRevision:data!.document_revision,pageCount:pageSizes.length,pageSizes,retentionMonths:settings.retentionMonths,sourcePath} satisfies ConsentLocalDraft;
  } catch (creationError) {
    // 생성 결과가 불명확하면 소유자 API로 확인한다. 원본을 먼저 지우지 않는다.
    try { return await getRemoteConsentForm(id); } catch { throw creationError; }
  }
};

/** 링크가 엉뚱한 곳으로 퍼졌을 때 쓰는 재발급. 이전 주소와 QR은 즉시 무효가 된다. */
export const reissueConsentPublicToken = async (id:string) => (await invokeConsentAdmin<{publicToken:string}>({action:'reissue',formId:id})).publicToken;

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
  retentionMonths?: number;
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
  if (patch.retentionMonths !== undefined) values.retention_months = patch.retentionMonths;
  if (patch.fileName !== undefined) values.file_name = patch.fileName;
  if (patch.fields !== undefined) {
    const pageCount = patch.pageCount ?? patch.pageSizes?.length ?? (await getRemoteConsentForm(id))?.pageCount ?? 1;
    const layoutIssues = getConsentFieldLayoutIssues(patch.fields, pageCount);
    if (layoutIssues.length) throw new Error(layoutIssues[0].message);
  }
  if (patch.passwordEnabled !== undefined) values.password_enabled=patch.passwordEnabled;
  if (patch.password?.trim()) values.password=patch.password.trim();
  let uploadedPath='';
  try {
    if(patch.sourceFile) {
      const form=await getRemoteConsentForm(id);
      if(form.responseCount>0) throw new Error('응답을 받은 원본과 필드는 수정할 수 없습니다. 수합을 복제해 주세요.');
      const user=(await client().auth.getUser()).data.user;
      if(!user) throw new Error('로그인이 필요합니다.');
      uploadedPath=`${user.id}/${id}/${crypto.randomUUID()}.pdf`;
      const upload=await client().storage.from(DOCUMENT_BUCKET).upload(uploadedPath,patch.sourceFile,{contentType:'application/pdf',upsert:false});
      if(upload.error) throw new Error('새 원본 PDF를 저장하지 못했습니다. 기존 원본은 유지됩니다.');
      values.source_path=uploadedPath;
    }
    const result=await invokeConsentAdmin<{form:ConsentFormRow}>({action:'save',formId:id,patch:values});
    sourceCache.clear(); return mapConsentForm(result.form);
  } catch(error) {
    // 저장 응답 유실이어도 현재 원본은 서버에서 삭제하지 않는다.
    if(uploadedPath) await invokeConsentAdmin({action:'discard-upload',formId:id,path:uploadedPath}).catch(()=>undefined);
    throw error;
  }
};
