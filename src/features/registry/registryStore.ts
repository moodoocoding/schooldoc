import type {
  Registry,
  RegistryDraft,
  RegistryParticipant,
  RegistrySignature,
  SignatureSubmission,
} from './types';
import { isRegistryDemoMode } from './registryConfig';
import {
  createRegistryBackup,
  parseRegistryBackup,
  serializeRegistryBackup,
  summarizeRegistryBackup,
} from './registryBackup';
import { isValidSignatureDataUrl } from './registryUtils';

const STORAGE_KEY = 'schooldoc_registry_v1';
const CHANGE_EVENT = 'schooldoc-registry-change';

const makeId = () => crypto.randomUUID();

const SAMPLE_REGISTRY: Registry = {
  id: 'demo-registry-2026',
  publicToken: 'demo-digital-training-2026',
  title: '2026 교직원 디지털 역량 강화 연수',
  leftHeader: '일시: 2026. 8. 20.(목) 14:00',
  rightHeader: '장소: 미래교육실',
  mode: 'fixed',
  status: 'open',
  layout: 10,
  allowWalkIn: true,
  columns: [{ id: 'affiliation', label: '소속' }],
  participants: [
    ['김하늘', '새봄초등학교'],
    ['이도윤', '한빛초등학교'],
    ['박서연', '푸른중학교'],
    ['최민준', '가온고등학교'],
    ['정유진', '교육지원청'],
    ['한지우', '늘봄초등학교'],
  ].map(([name, affiliation], index) => ({
    id: `demo-participant-${index + 1}`,
    rowNumber: index + 1,
    name,
    values: { affiliation },
  })),
  createdAt: '2026-08-12T09:00:00.000Z',
  updatedAt: '2026-08-12T09:00:00.000Z',
};

const sampleRegistries = () => [{
  ...SAMPLE_REGISTRY,
  columns: SAMPLE_REGISTRY.columns.map((column) => ({ ...column })),
  participants: SAMPLE_REGISTRY.participants.map((participant) => ({
    ...participant,
    values: { ...participant.values },
  })),
}];

const notify = () => window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

const normalize = (registries: Registry[]) => registries.map((registry) => ({
  ...registry,
  participants: registry.participants.map((participant, index) => ({
    ...participant,
    rowNumber: index + 1,
  })),
}));

const read = (): Registry[] => {
  if (!isRegistryDemoMode) return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = sampleRegistries();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return normalize(JSON.parse(raw) as Registry[]);
  } catch {
    const seeded = sampleRegistries();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
};

const write = (registries: Registry[]) => {
  if (!isRegistryDemoMode) throw new Error('등록부 로컬 저장은 명시적인 개발 모드에서만 사용할 수 있습니다.');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(registries)));
  notify();
};

const updateOne = (id: string, updater: (registry: Registry) => Registry) => {
  const registries = read();
  let updated: Registry | null = null;
  write(registries.map((registry) => {
    if (registry.id !== id) return registry;
    updated = { ...updater(registry), updatedAt: new Date().toISOString() };
    return updated;
  }));
  return updated;
};

export const listRegistries = () => read().toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const getRegistry = (id: string) => read().find((registry) => registry.id === id) ?? null;

export const getRegistryByToken = (token: string) => (
  read().find((registry) => registry.publicToken === token) ?? null
);

export const createRegistry = (draft: RegistryDraft) => {
  const now = new Date().toISOString();
  const registry: Registry = {
    ...draft,
    id: makeId(),
    publicToken: makeId().replaceAll('-', ''),
    status: 'open',
    participants: draft.participants.map((participant, index) => ({
      ...participant,
      id: makeId(),
      rowNumber: index + 1,
    })),
    createdAt: now,
    updatedAt: now,
  };
  write([...read(), registry]);
  return registry;
};

export const updateRegistry = (id: string, patch: Partial<Registry>) => (
  updateOne(id, (registry) => ({ ...registry, ...patch, id: registry.id }))
);

export const deleteRegistry = (id: string) => write(read().filter((registry) => registry.id !== id));

export const exportRegistryDemoData = () => (
  serializeRegistryBackup(createRegistryBackup(read()))
);

export const inspectRegistryDemoBackup = (text: string) => {
  const backup = parseRegistryBackup(text);
  return { backup, summary: summarizeRegistryBackup(backup) };
};

export const restoreRegistryDemoData = (text: string) => {
  const backup = parseRegistryBackup(text);
  write(backup.registries);
  return summarizeRegistryBackup(backup);
};

export const resetRegistryDemoData = () => {
  const registries = sampleRegistries();
  write(registries);
  return registries;
};

export const addParticipant = (
  registryId: string,
  participant: Pick<RegistryParticipant, 'name' | 'values'>,
) : RegistryParticipant | null => {
  const registry = getRegistry(registryId);
  if (!registry) return null;
  const created: RegistryParticipant = {
    ...participant,
    id: makeId(),
    rowNumber: registry.participants.length + 1,
  };
  updateOne(registryId, (current) => ({
    ...current,
    participants: [...current.participants, created],
  }));
  return created;
};

export const removeParticipant = (registryId: string, participantId: string) => (
  updateOne(registryId, (registry) => ({
    ...registry,
    participants: registry.participants.filter((participant) => participant.id !== participantId),
  }))
);

export const submitSignature = (registryId: string, submission: SignatureSubmission) => {
  if (!isValidSignatureDataUrl(submission.dataUrl)) {
    throw new Error('유효한 서명 이미지가 아닙니다.');
  }

  return updateOne(registryId, (registry) => {
    if (registry.status !== 'open') return registry;
    const signature: RegistrySignature = {
      dataUrl: submission.dataUrl,
      source: submission.source,
      signedAt: new Date().toISOString(),
    };
    return {
      ...registry,
      participants: registry.participants.map((participant) => (
        participant.id === submission.participantId && !participant.signature
          ? {
              ...participant,
              values: submission.values ?? participant.values,
              signature,
            }
          : participant
      )),
    };
  });
};

export const clearSignature = (registryId: string, participantId: string) => (
  updateOne(registryId, (registry) => ({
    ...registry,
    participants: registry.participants.map((participant) => {
      if (participant.id !== participantId) return participant;
      const unsigned = { ...participant };
      delete unsigned.signature;
      return unsigned;
    }),
  }))
);

export const subscribeRegistries = (listener: () => void) => {
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
