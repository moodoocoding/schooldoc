import type {
  AuthenticatedStudentResult,
  ResultRecipient,
  StudentResultDraft,
  StudentResultEvent,
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

export const confirmStudentResult = (eventId: string, recipientId: string) => (
  updateRecipient(eventId, recipientId, (recipient) => ({
    ...recipient,
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
  }))
);

export const disputeStudentResult = (eventId: string, recipientId: string, message: string) => (
  updateRecipient(eventId, recipientId, (recipient) => ({
    ...recipient,
    status: 'disputed',
    dispute: { message: message.trim(), submittedAt: new Date().toISOString() },
  }))
);

export const replyToStudentDispute = (ownerId: string, eventId: string, recipientId: string, reply: string) => {
  const event = getStudentResultEvent(ownerId, eventId);
  if (!event) return null;
  return updateRecipient(eventId, recipientId, (recipient) => ({
    ...recipient,
    status: 'reconfirm',
    confirmedAt: undefined,
    dispute: recipient.dispute ? {
      ...recipient.dispute,
      teacherReply: reply.trim(),
      repliedAt: new Date().toISOString(),
    } : undefined,
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
