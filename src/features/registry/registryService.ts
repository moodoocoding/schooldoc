import { isRegistryDemoMode } from './registryConfig';
import * as remote from './registryRepository';
import * as local from './registryStore';
import type { Registry, RegistryDraft, RegistryParticipant } from './types';

export const listRegistries = async () => (
  isRegistryDemoMode ? local.listRegistries() : remote.listRemoteRegistries()
);

export const getRegistry = async (id: string) => (
  isRegistryDemoMode ? local.getRegistry(id) : remote.getRemoteRegistry(id)
);

export const createRegistry = async (draft: RegistryDraft) => (
  isRegistryDemoMode ? local.createRegistry(draft) : remote.createRemoteRegistry(draft)
);

export const updateRegistry = async (id: string, patch: Partial<Registry>) => (
  isRegistryDemoMode ? local.updateRegistry(id, patch) : remote.updateRemoteRegistry(id, patch)
);

export const deleteRegistry = async (id: string) => {
  if (isRegistryDemoMode) local.deleteRegistry(id);
  else await remote.deleteRemoteRegistry(id);
};

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

export const subscribeRegistries = (listener: () => void) => (
  isRegistryDemoMode
    ? local.subscribeRegistries(listener)
    : remote.subscribeRemoteRegistries(listener)
);
