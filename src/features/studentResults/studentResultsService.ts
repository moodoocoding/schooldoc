import { isStudentResultsDemoMode } from './studentResultsConfig';
import * as remote from './studentResultsRepository';
import * as local from './studentResultsStore';
import type { StudentResultDraft, StudentResultEvent } from './types';

export const listStudentResultEvents = async (ownerId: string) => isStudentResultsDemoMode ? local.listStudentResultEvents(ownerId) : remote.listRemoteStudentResultEvents();
export const getStudentResultEvent = async (ownerId: string, eventId: string) => isStudentResultsDemoMode ? local.getStudentResultEvent(ownerId, eventId) : remote.getRemoteStudentResultEvent(eventId);
export const createStudentResultEvent = async (ownerId: string, draft: StudentResultDraft) => isStudentResultsDemoMode ? local.createStudentResultEvent(ownerId, draft) : remote.createRemoteStudentResultEvent(draft);
export const deleteStudentResultEvent = async (ownerId: string, eventId: string) => { if (isStudentResultsDemoMode) local.deleteStudentResultEvent(ownerId, eventId); else await remote.deleteRemoteStudentResultEvent(eventId); };
export const setStudentResultEventStatus = async (ownerId: string, eventId: string, status: StudentResultEvent['status']) => { if (isStudentResultsDemoMode) local.setStudentResultEventStatus(ownerId, eventId, status); else await remote.setRemoteStudentResultEventStatus(eventId, status); };
export const replyToStudentDispute = async (ownerId: string, eventId: string, recipientId: string, reply: string) => { if (isStudentResultsDemoMode) local.replyToStudentDispute(ownerId, eventId, recipientId, reply); else await remote.replyToRemoteStudentDispute(eventId, recipientId, reply); };
export const regenerateStudentResultPersonalToken = async (ownerId: string, eventId: string, recipientId: string) => { if (isStudentResultsDemoMode) local.regenerateStudentResultPersonalToken(ownerId, eventId, recipientId); else await remote.regenerateRemoteStudentResultPersonalToken(eventId, recipientId); };
export const subscribeStudentResults = (listener: () => void) => isStudentResultsDemoMode ? local.subscribeStudentResults(listener) : remote.subscribeRemoteStudentResults(listener);
