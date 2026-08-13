import type { ConsentLocalDraft } from './types';

const STORAGE_KEY = 'schooldoc:consent-forms:drafts';

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

export const countConsentLocalResponse = (id: string) => {
  const draft = getConsentLocalDraft(id);
  if (draft) updateConsentLocalDraft(id, { responseCount: draft.responseCount + 1 });
};

export const hashConsentPassword = async (password: string) => {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
