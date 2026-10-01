import type {
  AuthenticatedStudentResult,
  ResultRecipient,
  StudentResultDraft,
  StudentResultEvent,
  StudentResultEventSettings,
} from './types';
import { cleanText, validateStudentResultDraft } from './studentResultsUtils';

const STORAGE_KEY = 'schooldoc_student_results_v1';
const CHANGE_EVENT = 'schooldoc-student-results-change';
const makeId = () => crypto.randomUUID();
const makeToken = () => makeId().replaceAll('-', '');

const read = (): StudentResultEvent[] => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StudentResultEvent[];
  } catch {
    return [];
  }
};

const write = (events: StudentResultEvent[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

const publicResult = (event: StudentResultEvent, recipient: ResultRecipient): AuthenticatedStudentResult => ({
  event: {
    id: event.id,
    publicToken: event.publicToken,
    title: event.title,
    description: event.description,
    status: event.status,
    allowConfirmation: event.allowConfirmation,
    allowDispute: event.allowDispute,
    columns: event.columns,
  },
  recipient,
});

const updateEvent = (eventId: string, updater: (event: StudentResultEvent) => StudentResultEvent) => {
  let updated: StudentResultEvent | null = null;
  const events = read().map((event) => {
    if (event.id !== eventId) return event;
    updated = { ...updater(event), updatedAt: new Date().toISOString() };
    return updated;
  });
  write(events);
  return updated;
};

const updateRecipient = (eventId: string, recipientId: string, updater: (recipient: ResultRecipient) => ResultRecipient) => {
  let updatedRecipient: ResultRecipient | null = null;
  const event = updateEvent(eventId, (current) => ({
    ...current,
    recipients: current.recipients.map((recipient) => {
      if (recipient.id !== recipientId) return recipient;
      updatedRecipient = updater(recipient);
      return updatedRecipient;
    }),
  }));
  return event && updatedRecipient ? publicResult(event, updatedRecipient) : null;
};

export const listStudentResultEvents = (ownerId: string) => (
  read().filter((event) => event.ownerId === ownerId).toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
);

export const getStudentResultEvent = (ownerId: string, eventId: string) => (
  read().find((event) => event.id === eventId && event.ownerId === ownerId) ?? null
);

export const createStudentResultEvent = (ownerId: string, draft: StudentResultDraft) => {
  const validationError = validateStudentResultDraft(draft);
  if (validationError) throw new Error(validationError);
  const now = new Date().toISOString();
  const event: StudentResultEvent = {
    id: makeId(),
    ownerId,
    publicToken: makeToken(),
    title: cleanText(draft.title),
    description: draft.description.trim(),
    status: 'open',
    allowConfirmation: draft.allowConfirmation,
    allowDispute: draft.allowDispute,
    columns: draft.columns.map((column) => ({ ...column, label: cleanText(column.label) })),
    recipients: draft.recipients.map((recipient) => ({
      id: makeId(),
      studentKey: cleanText(recipient.studentKey),
      name: cleanText(recipient.name),
      verificationCode: cleanText(recipient.verificationCode),
      personalToken: makeToken(),
      values: Object.fromEntries(Object.entries(recipient.values).map(([key, value]) => [key, Number(value)])),
      feedback: recipient.feedback.trim(),
      status: 'unviewed',
      updatedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  };
  write([...read(), event]);
  return event;
};

export const deleteStudentResultEvent = (ownerId: string, eventId: string) => {
  write(read().filter((event) => !(event.id === eventId && event.ownerId === ownerId)));
};

export const setStudentResultEventStatus = (ownerId: string, eventId: string, status: StudentResultEvent['status']) => (
  updateEvent(eventId, (event) => event.ownerId === ownerId ? { ...event, status } : event)
);

export const getPublicResultEvent = (publicToken: string) => {
  const event = read().find((candidate) => candidate.publicToken === publicToken);
  return event ? { title: event.title, description: event.description, status: event.status } : null;
};

const markViewed = (event: StudentResultEvent, recipient: ResultRecipient) => {
  if (recipient.status !== 'unviewed') return publicResult(event, recipient);
  return updateRecipient(event.id, recipient.id, (current) => ({
    ...current,
    status: 'viewed',
    viewedAt: new Date().toISOString(),
  }));
};

export const authenticateStudentResult = (publicToken: string, name: string, verificationCode: string) => {
  const event = read().find((candidate) => candidate.publicToken === publicToken && candidate.status === 'open');
  if (!event) return null;
  const recipient = event.recipients.find((candidate) => (
    candidate.name === cleanText(name) && candidate.verificationCode === cleanText(verificationCode)
  ));
  return recipient ? markViewed(event, recipient) : null;
};

export const authenticateStudentResultByToken = (publicToken: string, personalToken: string) => {
  const event = read().find((candidate) => candidate.publicToken === publicToken && candidate.status === 'open');
  if (!event) return null;
  const recipient = event.recipients.find((candidate) => candidate.personalToken === personalToken);
  return recipient ? markViewed(event, recipient) : null;
};

export const getStudentResultEventPublicRecipient = (eventId: string, recipientId: string) => {
  const event = read().find((candidate) => candidate.id === eventId && candidate.status === 'open');
  const recipient = event?.recipients.find((candidate) => candidate.id === recipientId);
  return event && recipient ? publicResult(event, recipient) : null;
};

export const confirmStudentResult = (eventId: string, recipientId: string) => {
  const event = read().find((candidate) => candidate.id === eventId && candidate.status === 'open');
  const recipient = event?.recipients.find((candidate) => candidate.id === recipientId);
  if (!event?.allowConfirmation || !recipient || recipient.status === 'disputed') return null;
  return updateRecipient(eventId, recipientId, (current) => ({
    ...current,
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
};

export const disputeStudentResult = (eventId: string, recipientId: string, message: string) => {
  const event = read().find((candidate) => candidate.id === eventId && candidate.status === 'open');
  if (!event?.allowDispute || !message.trim()) return null;
  return updateRecipient(eventId, recipientId, (recipient) => ({
    ...recipient,
    status: 'disputed',
    confirmedAt: undefined,
    dispute: { message: message.trim(), submittedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  }));
};

export const replyToStudentDispute = (ownerId: string, eventId: string, recipientId: string, reply: string) => {
  const event = getStudentResultEvent(ownerId, eventId);
  if (!event || !reply.trim() || !event.recipients.some((recipient) => recipient.id === recipientId && recipient.dispute)) return null;
  return updateRecipient(eventId, recipientId, (recipient) => ({
    ...recipient,
    status: event.allowConfirmation ? 'reconfirm' : 'replied',
    confirmedAt: undefined,
    updatedAt: new Date().toISOString(),
    dispute: recipient.dispute ? {
      ...recipient.dispute,
      teacherReply: reply.trim(),
      repliedAt: new Date().toISOString(),
    } : undefined,
  }));
};

export const updateStudentResultSettings = (ownerId: string, eventId: string, expectedUpdatedAt: string, settings: StudentResultEventSettings) => {
  const event = getStudentResultEvent(ownerId, eventId);
  if (!event) throw new Error('결과 안내를 찾을 수 없습니다.');
  if (event.updatedAt !== expectedUpdatedAt) throw new Error('다른 변경이 반영되었습니다. 새로고침 후 다시 확인해 주세요.');
  if (!settings.title.trim() || settings.title.length > 200 || settings.description.length > 4000
    || settings.columns.length !== event.columns.length
    || settings.columns.some((column) => !event.columns.some((existing) => existing.id === column.id)
      || !column.label.trim() || column.maxScore <= 0 || !Number.isFinite(column.maxScore)
      || event.recipients.some((recipient) => recipient.values[column.id] > column.maxScore))) {
    throw new Error('안내 정보와 결과 항목을 확인해 주세요.');
  }
  const before = { title: event.title, description: event.description, allowConfirmation: event.allowConfirmation, allowDispute: event.allowDispute, columns: event.columns };
  return updateEvent(eventId, (current) => ({
    ...current,
    title: cleanText(settings.title), description: settings.description.trim(),
    allowConfirmation: settings.allowConfirmation, allowDispute: settings.allowDispute,
    columns: settings.columns,
    recipients: settings.allowConfirmation ? current.recipients : current.recipients.map((recipient) => (
      recipient.status === 'reconfirm' ? { ...recipient, status: 'replied', updatedAt: new Date().toISOString() } : recipient
    )),
    revisions: [...(current.revisions ?? []), { changedAt: new Date().toISOString(), before, after: settings }],
  }));
};

export const updateStudentResultRecipient = (ownerId: string, eventId: string, recipientId: string, expectedEventUpdatedAt: string, expectedRecipientUpdatedAt: string, values: Record<string, number>, feedback: string, reason: string) => {
  const event = getStudentResultEvent(ownerId, eventId);
  const recipient = event?.recipients.find((candidate) => candidate.id === recipientId);
  if (!event || !recipient) throw new Error('학생 결과를 찾을 수 없습니다.');
  if (event.updatedAt !== expectedEventUpdatedAt || recipient.updatedAt !== expectedRecipientUpdatedAt) throw new Error('다른 변경이 반영되었습니다. 새로고침 후 다시 확인해 주세요.');
  if (!reason.trim() || reason.length > 200 || feedback.length > 10000
    || Object.keys(values).length !== event.columns.length
    || event.columns.some((column) => !Number.isFinite(values[column.id]) || values[column.id] < 0 || values[column.id] > column.maxScore)) {
    throw new Error('점수·피드백과 수정 사유를 확인해 주세요.');
  }
  const before = { values: recipient.values, feedback: recipient.feedback };
  const after = { values, feedback: feedback.trim() };
  return updateRecipient(eventId, recipientId, (current) => ({
    ...current,
    ...after,
    updatedAt: new Date().toISOString(),
    status: current.status === 'confirmed' && event.allowConfirmation ? 'reconfirm' : current.status,
    confirmedAt: current.status === 'confirmed' && event.allowConfirmation ? undefined : current.confirmedAt,
    revisions: [...(current.revisions ?? []), { changedAt: new Date().toISOString(), reason: reason.trim(), before, after }],
  }));
};

export const regenerateStudentResultPersonalToken = (ownerId: string, eventId: string, recipientId: string) => {
  const event = getStudentResultEvent(ownerId, eventId);
  if (!event) return null;
  let updatedRecipient: ResultRecipient | null = null;
  const updatedEvent = updateEvent(eventId, (current) => ({
    ...current,
    recipients: current.recipients.map((recipient) => {
      if (recipient.id !== recipientId) return recipient;
      updatedRecipient = { ...recipient, personalToken: makeToken() };
      return updatedRecipient;
    }),
  }));
  return updatedEvent && updatedRecipient ? publicResult(updatedEvent, updatedRecipient) : null;
};

export const subscribeStudentResults = (listener: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
};
