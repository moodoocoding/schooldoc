import type { ConsentLocalDraft, ConsentResponseRecord } from './types';

const STORAGE_KEY = 'schooldoc:consent-forms:drafts';
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
  pageCount: value.pageCount ?? Math.max(1, ...(value.fields ?? []).map((field) => field.pageIndex + 1)),
  sourcePath: value.sourcePath,
  sourcePdfDataUrl: value.sourcePdfDataUrl,
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

export const listConsentLocalResponses = (formId: string): ConsentResponseRecord[] => readStoredResponses()
  .filter((response) => response.formId === formId)
  .map(({ id, submittedAt, values }) => ({ id, submittedAt, values }))
  .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

export const addConsentLocalResponse = (id: string, values: Record<string, string>) => {
  const draft = getConsentLocalDraft(id);
  if (!draft) return;
  const response: StoredResponse = { id: crypto.randomUUID(), formId: id, submittedAt: new Date().toISOString(), values };
  localStorage.setItem(RESPONSE_KEY, JSON.stringify([...readStoredResponses(), response]));
  updateConsentLocalDraft(id, { responseCount: draft.responseCount + 1 });
};

export const deleteConsentLocalDraft = (id: string) => {
  const remaining = getConsentLocalDrafts().filter((draft) => draft.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  localStorage.setItem(RESPONSE_KEY, JSON.stringify(readStoredResponses().filter((response) => response.formId !== id)));
};

export const hashConsentPassword = async (password: string) => {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
