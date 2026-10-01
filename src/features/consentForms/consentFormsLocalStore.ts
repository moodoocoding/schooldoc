import { buildDuplicateDraft } from './consentDuplicate';
import type { ConsentLocalDraft, ConsentResponseRecord, ConsentRecipientRecord } from './types';

const STORAGE_KEY = 'schooldoc:consent-forms:drafts';
const RECIPIENT_KEY = 'schooldoc:consent-forms:recipients';
const RESPONSE_KEY = 'schooldoc:consent-forms:responses';

const normalizeDraft = (value: Partial<ConsentLocalDraft>): ConsentLocalDraft => ({
  id: value.id ?? crypto.randomUUID(),
  title: value.title ?? '제목 없는 가정통신문',
  fileName: value.fileName ?? '',
  fieldCount: value.fieldCount ?? value.fields?.length ?? 0,
  recipientMode: value.recipientMode ?? 'open',
  recipientCount: value.recipientCount ?? 0,
  createdAt: value.createdAt ?? new Date().toISOString(),
  description: value.description ?? '',
  fields: value.fields ?? [],
  publicToken: value.publicToken ?? crypto.randomUUID(),
  deadline: value.deadline ?? '',
  passwordEnabled: value.passwordEnabled ?? false,
  passwordHash: value.passwordHash ?? '',
  allowResubmission: value.allowResubmission ?? false,
  responseCount: value.responseCount ?? 0,
  status: value.status ?? 'open',
  closedAt: value.closedAt ?? (value.status === 'closed' ? value.createdAt : undefined),
  pageCount: value.pageCount ?? Math.max(1, ...(value.fields ?? []).map((field) => field.pageIndex + 1)),
  pageSizes: value.pageSizes,
  publicationState: value.publicationState ?? 'ready', documentRevision: value.documentRevision ?? 1, currentResponseCount: value.currentResponseCount ?? value.responseCount ?? 0,
  sourcePath: value.sourcePath,
  sourcePdfDataUrl: value.sourcePdfDataUrl,
  retentionMonths: value.retentionMonths,
});

export const getConsentLocalDrafts = (): ConsentLocalDraft[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const drafts = Array.isArray(parsed) ? parsed.map(normalizeDraft) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    return drafts;
  } catch {
    return [];
  }
};

export const addConsentLocalDraft = (draft: ConsentLocalDraft) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([draft, ...getConsentLocalDrafts()]));
};

export const getConsentLocalDraft = (id: string) => getConsentLocalDrafts().find((draft) => draft.id === id) ?? null;

export const getConsentLocalDraftByToken = (token: string) => getConsentLocalDrafts().find((draft) => draft.publicToken === token) ?? null;

export const updateConsentLocalDraft = (id: string, patch: Partial<ConsentLocalDraft>) => {
  const drafts = getConsentLocalDrafts();
  const original=drafts.find(d=>d.id===id);
  if(original && original.responseCount>0 && ['fields','sourcePdfDataUrl','fileName','pageCount','pageSizes'].some(k=>k in patch)) throw new Error('응답을 받은 원본과 필드는 수정할 수 없습니다. 수합을 복제해 주세요.');
  const updated = drafts.map((draft) => draft.id === id ? normalizeDraft({ ...draft, ...patch }) : draft);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated.find((draft) => draft.id === id) ?? null;
};

interface StoredResponse extends ConsentResponseRecord { formId: string }

const readStoredResponses = (): StoredResponse[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RESPONSE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

interface StoredRecipient extends ConsentRecipientRecord {formId:string}
const readRecipients = (): StoredRecipient[] => {try{return JSON.parse(localStorage.getItem(RECIPIENT_KEY) ?? '[]');}catch{return [];}};
export const listConsentLocalRecipients=(formId:string) => readRecipients().filter(r=>r.formId===formId);
export const saveConsentLocalRecipients=(formId:string,people:Array<{id:string;name:string;identifier:string}>)=>{
 const form=getConsentLocalDraft(formId);if(form?.responseCount) throw new Error('이미 응답을 받아 명단을 교체할 수 없습니다.');
 const old=listConsentLocalRecipients(formId);
 const rows=people.map(p=>({...p,formId,studentKey:p.identifier,token:old.find(r=>r.id===p.id)?.token ?? crypto.randomUUID(),responseId:null,submittedAt:null}));
 localStorage.setItem(RECIPIENT_KEY,JSON.stringify([...readRecipients().filter(r=>r.formId!==formId),...rows]));
};
export const getConsentLocalRecipient=(formId:string,token:string)=>{
 if(!token) return null;
 const row=listConsentLocalRecipients(formId).find(r=>r.token===token);
 if(!row) throw new Error('개인 링크가 올바르지 않습니다. 담당자에게 링크를 다시 요청해 주세요.');
 return row;
};
export const listConsentLocalHistory=(formId:string,recipientId:string)=>readStoredResponses().filter(r=>r.formId===formId && r.recipientId===recipientId).sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt));
export const listConsentLocalResponses=(formId:string):ConsentResponseRecord[]=>{
 const recipients=listConsentLocalRecipients(formId);
 return readStoredResponses().filter(r=>r.formId===formId && (!r.recipientId || recipients.some(p=>p.id===r.recipientId && p.responseId===r.id))).sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt));
};
export const addConsentLocalResponse=(id:string,values:Record<string,string>,recipientToken='',requestId:string=crypto.randomUUID(),expectedResponseId?:string|null)=>{
 const draft=getConsentLocalDraft(id);if(!draft) throw new Error('수합을 찾을 수 없습니다.');
 const recipient=getConsentLocalRecipient(id,recipientToken);
 const stored=readStoredResponses() as Array<StoredResponse & {requestId?:string}>;
 const existing=stored.find(r=>r.formId===id && r.requestId===requestId);
 if(existing){if(JSON.stringify(existing.values)!==JSON.stringify(values)) throw new Error('다른 응답에 사용된 요청입니다.');return existing;}
 if(draft.status==='closed' || (draft.deadline && draft.deadline<new Date().toISOString().slice(0,10))) throw new Error('응답이 종료되었습니다.');
 if(recipient?.responseId && !draft.allowResubmission) throw new Error('이미 제출한 가정통신문입니다.');
 if(recipient && expectedResponseId!==undefined && (recipient.responseId ?? null)!==expectedResponseId) throw new Error('다른 화면에서 응답이 변경되었습니다. 문서를 다시 열어 주세요.');
 const response:StoredResponse & {requestId:string}={id:crypto.randomUUID(),formId:id,submittedAt:new Date().toISOString(),values:{...values},recipientId:recipient?.id ?? null,requestId,detailsLoaded:true};
 localStorage.setItem(RESPONSE_KEY,JSON.stringify([...stored,response]));
 if(recipient) localStorage.setItem(RECIPIENT_KEY,JSON.stringify(readRecipients().map(p=>p.id===recipient.id?{...p,responseId:response.id,submittedAt:response.submittedAt}:p)));
 updateConsentLocalDraft(id,{responseCount:draft.responseCount+1,currentResponseCount:(draft.currentResponseCount ?? draft.responseCount)+(recipient?.responseId?0:1)});
 return response;
};

export const reissueConsentLocalToken = (id: string) => {
  const publicToken = crypto.randomUUID();
  updateConsentLocalDraft(id, { publicToken });
  return publicToken;
};

export const duplicateConsentLocalDraft = (id: string) => {
  const source = getConsentLocalDraft(id);
  if (!source) return null;
  const copy = buildDuplicateDraft(source, {
    id: crypto.randomUUID(),
    publicToken: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  copy.currentResponseCount=0;copy.documentRevision=1;copy.publicationState='ready';
  addConsentLocalDraft(copy);
  saveConsentLocalRecipients(copy.id,listConsentLocalRecipients(id).map(p=>({id:crypto.randomUUID(),name:p.name,identifier:p.studentKey})));
  return copy;
};

export const deleteConsentLocalDraft = (id: string) => {
  if(getConsentLocalDraft(id)?.status==='open') throw new Error('진행 중인 수합은 삭제할 수 없습니다. 먼저 수합을 종료해 주세요.');
  localStorage.setItem(RECIPIENT_KEY,JSON.stringify(readRecipients().filter(r=>r.formId!==id)));
  const remaining = getConsentLocalDrafts().filter((draft) => draft.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  localStorage.setItem(RESPONSE_KEY, JSON.stringify(readStoredResponses().filter((response) => response.formId !== id)));
};

export const hashConsentPassword = async (password: string) => {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
