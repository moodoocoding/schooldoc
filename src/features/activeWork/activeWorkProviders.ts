import { isConsentFormsDemoMode } from '../consentForms/consentFormsConfig';
import { getConsentLocalDrafts } from '../consentForms/consentFormsLocalStore';
import { listRemoteConsentForms } from '../consentForms/consentFormsRepository';
import { dataCollectOwnerId, isDataCollectDemoMode } from '../dataCollect/dataCollectConfig';
import { listDataCollections, subscribeDataCollections } from '../dataCollect/dataCollectService';
import { isRegistryDemoMode } from '../registry/registryConfig';
import { listRegistries, subscribeRegistries } from '../registry/registryService';
import { isSpecialRoomsDemoMode } from '../specialRooms/specialRoomsConfig';
import { listBoards, subscribeSpecialRooms } from '../specialRooms/specialRoomsService';
import { isStudentResultsDemoMode, studentResultsOwnerId } from '../studentResults/studentResultsConfig';
import { listStudentResultEvents, subscribeStudentResults } from '../studentResults/studentResultsService';
import type {
  ActiveWorkItem,
  ActiveWorkLoadContext,
  ActiveWorkProvider,
  ActiveWorkSnapshot,
} from './types';

export const isActiveWorkDemoMode = isRegistryDemoMode
  || isStudentResultsDemoMode
  || isConsentFormsDemoMode
  || isDataCollectDemoMode
  || isSpecialRoomsDemoMode;

const hasPassed = (value: string, now: Date) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp < now.getTime();
};

const registryProvider: ActiveWorkProvider = {
  toolId: 'registry-sign',
  toolName: '등록부 서명',
  listPath: '/tools/registry-sign',
  subscribe: subscribeRegistries,
  load: async ({ userId }) => {
    if (!userId && !isRegistryDemoMode) return [];
    const registries = await listRegistries();
    return registries
      .filter((registry) => registry.status === 'open')
      .map((registry): ActiveWorkItem => {
        const signedCount = registry.participants.filter((participant) => participant.signature).length;
        return {
          id: registry.id,
          toolId: 'registry-sign',
          toolName: '등록부 서명',
          title: registry.title,
          statusLabel: '수합 중',
          progressLabel: `${signedCount}/${registry.participants.length}명 서명`,
          updatedAt: registry.updatedAt,
          listPath: '/tools/registry-sign',
          detailPath: `/tools/registry-sign/${registry.id}`,
          overdue: false,
        };
      });
  },
};

const studentResultsProvider: ActiveWorkProvider = {
  toolId: 'student-lookup',
  toolName: '학생 결과 안내',
  listPath: '/tools/student-results',
  subscribe: subscribeStudentResults,
  load: async ({ userId }) => {
    const ownerId = studentResultsOwnerId(userId || undefined);
    if (!ownerId && !isStudentResultsDemoMode) return [];
    const events = await listStudentResultEvents(ownerId);
    return events
      .filter((event) => event.status === 'open')
      .map((event): ActiveWorkItem => {
        const confirmedCount = event.recipients.filter((recipient) => recipient.status === 'confirmed').length;
        const disputeCount = event.recipients.filter((recipient) => recipient.status === 'disputed').length;
        return {
          id: event.id,
          toolId: 'student-lookup',
          toolName: '학생 결과 안내',
          title: event.title,
          statusLabel: '안내 중',
          progressLabel: `${confirmedCount}/${event.recipients.length}명 확인${disputeCount ? ` · 이의 ${disputeCount}건` : ''}`,
          updatedAt: event.updatedAt,
          listPath: '/tools/student-results',
          detailPath: `/tools/student-results/${event.id}`,
          overdue: false,
        };
      });
  },
};

const consentFormsProvider: ActiveWorkProvider = {
  toolId: 'notice-collect',
  toolName: '가정통신문 수합',
  listPath: '/tools/consent-forms',
  load: async ({ userId, now }) => {
    if (!userId && !isConsentFormsDemoMode) return [];
    const forms = isConsentFormsDemoMode ? getConsentLocalDrafts() : await listRemoteConsentForms();
    return forms
      .filter((form) => form.status === 'open')
      .map((form): ActiveWorkItem => {
        const overdue = hasPassed(form.deadline, now);
        return {
          id: form.id,
          toolId: 'notice-collect',
          toolName: '가정통신문 수합',
          title: form.title,
          statusLabel: overdue ? '마감 지남' : '수합 중',
          progressLabel: form.recipientMode === 'named'
            ? `${form.responseCount}/${form.recipientCount}명 응답`
            : `응답 ${form.responseCount}건`,
          updatedAt: form.createdAt,
          listPath: '/tools/consent-forms',
          detailPath: `/tools/consent-forms/${form.id}`,
          overdue,
        };
      });
  },
};

const dataCollectProvider: ActiveWorkProvider = {
  toolId: 'data-collect',
  toolName: '자료 수합',
  listPath: '/tools/data-collect',
  subscribe: subscribeDataCollections,
  load: async ({ userId, now }) => {
    const ownerId = dataCollectOwnerId(userId || undefined);
    if (!ownerId && !isDataCollectDemoMode) return [];
    const collections = await listDataCollections(ownerId);
    return collections
      .filter((collection) => collection.status === 'open')
      .map((collection): ActiveWorkItem => {
        const responseCount = new Set(collection.submissions.map((submission) => submission.targetId)).size;
        const overdue = hasPassed(collection.dueAt, now);
        return {
          id: collection.id,
          toolId: 'data-collect',
          toolName: '자료 수합',
          title: collection.title,
          statusLabel: overdue ? '마감 지남' : '수합 중',
          progressLabel: collection.mode === 'fixed'
            ? `${responseCount}/${collection.targets.length}명 회신`
            : `회신 ${responseCount}건`,
          updatedAt: collection.updatedAt,
          listPath: '/tools/data-collect',
          detailPath: `/tools/data-collect/${collection.id}`,
          overdue,
        };
      });
  },
};

const specialRoomsProvider: ActiveWorkProvider = {
  toolId: 'special-room',
  toolName: '특별실 예약',
  listPath: '/tools/special-rooms',
  subscribe: subscribeSpecialRooms,
  load: async ({ userId }) => {
    const ownerId = userId || (isSpecialRoomsDemoMode ? 'local-demo-teacher' : '');
    if (!ownerId) return [];
    const boards = await listBoards(ownerId);
    return boards
      .filter((board) => board.status === 'open')
      .map((board): ActiveWorkItem => ({
        id: board.id,
        toolId: 'special-room',
        toolName: '특별실 예약',
        title: board.title,
        statusLabel: '예약 중',
        progressLabel: `특별실 ${board.rooms.length}곳 · 예약 ${board.bookings.length}건`,
        updatedAt: board.updatedAt,
        listPath: '/tools/special-rooms',
        detailPath: `/tools/special-rooms/${board.id}`,
        overdue: false,
      }));
  },
};

/**
 * 새 도구는 이 배열에 공급자 하나만 추가하면 진행 업무 화면에 합류한다.
 * 각 공급자는 자기 도메인의 목록을 공통 ActiveWorkItem으로만 바꾼다.
 */
export const activeWorkProviders: ActiveWorkProvider[] = [
  registryProvider,
  studentResultsProvider,
  consentFormsProvider,
  dataCollectProvider,
  specialRoomsProvider,
];

export const loadActiveWorkSnapshot = async (
  context: ActiveWorkLoadContext,
  providers: ActiveWorkProvider[] = activeWorkProviders,
): Promise<ActiveWorkSnapshot> => {
  const results = await Promise.allSettled(providers.map((provider) => provider.load(context)));
  const groups = providers.flatMap((provider, index) => {
    const result = results[index];
    if (result.status !== 'fulfilled' || result.value.length === 0) return [];
    return [{
      toolId: provider.toolId,
      toolName: provider.toolName,
      listPath: provider.listPath,
      items: result.value.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }];
  });
  const failures = providers.flatMap((provider, index) => {
    const result = results[index];
    if (result.status !== 'rejected') return [];
    return [{
      toolId: provider.toolId,
      toolName: provider.toolName,
      message: result.reason instanceof Error ? result.reason.message : '업무 목록을 불러오지 못했습니다.',
    }];
  });
  return { groups, failures };
};
