import { isRegistryDemoMode } from './registryConfig';
import * as remote from './registryRepository';
import * as local from './registryStore';
import type { Registry, RegistryDraft, RegistryParticipant, RegistrySummary, RegistryPurgeCounts } from './types';

export const getRegistry = async (id: string) => (
  isRegistryDemoMode ? local.getRegistry(id) : remote.getRemoteRegistry(id)
);

export const createRegistry = async (draft: RegistryDraft) => (
  isRegistryDemoMode ? local.createRegistry(draft) : remote.createRemoteRegistry(draft)
);

export const updateRegistry = async (id: string, patch: Partial<Registry>) => (
  isRegistryDemoMode ? local.updateRegistry(id, patch) : remote.updateRemoteRegistry(id, patch)
);

export const previewRegistryPurge = async (id: string): Promise<RegistryPurgeCounts> => {
  if (!isRegistryDemoMode) return remote.previewRemoteRegistryPurge(id);
  const r = local.getRegistry(id);
  if (!r || r.status !== 'closed') throw new Error('수합을 종료한 뒤 파기해 주세요.');
  return { recordCount: r.participants.length, signatureCount: r.participants.filter((p) => p.signature).length, fileCount: r.participants.filter((p) => p.signature).length };
};
export const deleteRegistry = async (id: string, counts: RegistryPurgeCounts) => {
  if (isRegistryDemoMode) {
    const current = await previewRegistryPurge(id);
    if (JSON.stringify(current) !== JSON.stringify(counts)) throw new Error('파기 수량이 바뀌었습니다. 다시 확인해 주세요.');
    local.deleteRegistry(id);
  } else await remote.deleteRemoteRegistry(id, counts);
};
export const cleanupRegistryUploads = async (id: string) => isRegistryDemoMode ? { removedCount: 0 } : remote.cleanupRemoteRegistryUploads(id);

export const addParticipant = async (
  registryId: string,
  participant: Pick<RegistryParticipant, 'name' | 'values'>,
) => (
  isRegistryDemoMode
    ? local.addParticipant(registryId, participant)
    : remote.addRemoteParticipant(registryId, participant)
);

export const removeParticipant = async (registryId: string, participantId: string) => {
  if (isRegistryDemoMode) local.removeParticipant(registryId, participantId);
  else await remote.removeRemoteParticipant(registryId, participantId);
};

export const clearSignature = async (registryId: string, participantId: string) => {
  if (isRegistryDemoMode) local.clearSignature(registryId, participantId);
  else await remote.clearRemoteSignature(registryId, participantId);
};

export const createRegistryPdf = async (registryId: string) => {
  if (isRegistryDemoMode) return null;
  return remote.createRemoteRegistryPdf(registryId);
};

export const subscribeRegistries = (listener: () => void, registryId?: string) => (
  isRegistryDemoMode
    ? local.subscribeRegistries(listener)
    : remote.subscribeRemoteRegistries(listener, registryId)
);

export const listRegistrySummaries = async (): Promise<RegistrySummary[]> => isRegistryDemoMode
  ? local.listRegistries().map((r) => ({ id: r.id, title: r.title, leftHeader: r.leftHeader, rightHeader: r.rightHeader, mode: r.mode, status: r.status, updatedAt: r.updatedAt, participantCount: r.participants.length, signedCount: r.participants.filter((p) => p.signature).length }))
  : remote.listRemoteRegistrySummaries();
export const loadRegistryImages = async (participants: RegistryParticipant[]) => isRegistryDemoMode ? participants : remote.loadParticipantImages(participants);
export const rotateRegistryToken = async (id: string) => isRegistryDemoMode
  ? local.updateRegistry(id, { publicToken: crypto.randomUUID().replaceAll('-', '') }) : remote.rotateRemoteRegistryToken(id);

export const issueVerificationCode = async (registryId: string, participantId: string) => {
  if (!isRegistryDemoMode) return remote.issueRemoteVerificationCode(registryId, participantId);
  const r = local.getRegistry(registryId);
  if (!r) throw new Error('등록부를 찾을 수 없습니다.');
  const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
  local.updateRegistry(registryId, { participants: r.participants.map((p) => p.id === participantId ? { ...p, verificationCode: code } : p) });
  return code;
};
