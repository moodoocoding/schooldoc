import { isStudentResultsDemoMode } from './studentResultsConfig';
import * as remote from './studentResultsRepository';
import * as local from './studentResultsStore';
import type { StudentResultDraft, StudentResultEvent, StudentResultEventSettings } from './types';

export const listStudentResultEvents = async (ownerId: string) => isStudentResultsDemoMode ? local.listStudentResultEvents(ownerId) : remote.listRemoteStudentResultEvents();
export const getStudentResultEvent = async (ownerId: string, eventId: string) => isStudentResultsDemoMode ? local.getStudentResultEvent(ownerId, eventId) : remote.getRemoteStudentResultEvent(eventId);
export const createStudentResultEvent = async (ownerId: string, draft: StudentResultDraft) => isStudentResultsDemoMode ? local.createStudentResultEvent(ownerId, draft) : remote.createRemoteStudentResultEvent(draft);
export const deleteStudentResultEvent = async (ownerId: string, eventId: string) => { if (isStudentResultsDemoMode) local.deleteStudentResultEvent(ownerId, eventId); else await remote.deleteRemoteStudentResultEvent(eventId); };
export const setStudentResultEventStatus = async (ownerId: string, eventId: string, status: StudentResultEvent['status']) => { if (isStudentResultsDemoMode) local.setStudentResultEventStatus(ownerId, eventId, status); else await remote.setRemoteStudentResultEventStatus(eventId, status); };
export const replyToStudentDispute = async (ownerId: string, eventId: string, recipientId: string, reply: string) => { if (isStudentResultsDemoMode) local.replyToStudentDispute(ownerId, eventId, recipientId, reply); else await remote.replyToRemoteStudentDispute(eventId, recipientId, reply); };
export const regenerateStudentResultPersonalToken = async (ownerId: string, eventId: string, recipientId: string) => { if (isStudentResultsDemoMode) local.regenerateStudentResultPersonalToken(ownerId, eventId, recipientId); else await remote.regenerateRemoteStudentResultPersonalToken(eventId, recipientId); };
export const updateStudentResultSettings = async (ownerId: string, eventId: string, expectedUpdatedAt: string, settings: StudentResultEventSettings) => {
  if (isStudentResultsDemoMode) local.updateStudentResultSettings(ownerId, eventId, expectedUpdatedAt, settings);
  else await remote.updateRemoteStudentResultSettings(eventId, expectedUpdatedAt, settings);
};
export const updateStudentResultRecipient = async (ownerId: string, eventId: string, recipientId: string, expectedEventUpdatedAt: string, expectedRecipientUpdatedAt: string, values: Record<string, number>, feedback: string, reason: string) => {
  if (isStudentResultsDemoMode) local.updateStudentResultRecipient(ownerId, eventId, recipientId, expectedEventUpdatedAt, expectedRecipientUpdatedAt, values, feedback, reason);
  else await remote.updateRemoteStudentResultRecipient(eventId, recipientId, expectedEventUpdatedAt, expectedRecipientUpdatedAt, values, feedback, reason);
};
export const subscribeStudentResults = (listener: () => void) => isStudentResultsDemoMode ? local.subscribeStudentResults(listener) : remote.subscribeRemoteStudentResults(listener);
