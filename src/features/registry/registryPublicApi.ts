import { supabase } from '../../utils/supabaseClient';
import type { Registry, RegistryParticipant, SignatureSource } from './types';

interface MetadataResponse {
  registry: {
    id: string;
    publicToken: string;
    title: string;
    leftHeader: string;
    rightHeader: string;
    mode: Registry['mode'];
    status: Registry['status'];
    layout: Registry['layout'];
    allowWalkIn: boolean;
    hasPassword: boolean;
    columns: Registry['columns'];
  };
}

interface ParticipantsResponse {
  participants: Array<{
    id: string;
    rowNumber: number;
    name: string;
    values: Record<string, string>;
    signed: boolean;
    signedAt?: string;
  }>;
}

const invoke = async <T>(body: Record<string, unknown>) => {
  if (!supabase) throw new Error('서명 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('registry-public', { body });
  if (error) {
    const context = error.context as Response | undefined;
    if (context) {
      try {
        const response = await context.clone().json() as { error?: string };
        if (response.error) throw new Error(response.error);
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message !== 'Unexpected end of JSON input') throw contextError;
      }
    }
    throw new Error(error.message || '공개 서명 서버 요청에 실패했습니다.');
  }
  return data as T;
};

const mapParticipant = (participant: ParticipantsResponse['participants'][number]): RegistryParticipant => ({
  id: participant.id,
  rowNumber: participant.rowNumber,
  name: participant.name,
  values: participant.values,
  signature: participant.signed ? {
    dataUrl: '',
    source: 'draw',
    signedAt: participant.signedAt ?? '',
  } : undefined,
});

export const loadPublicRegistry = async (token: string) => {
  const { registry } = await invoke<MetadataResponse>({ action: 'metadata', token });
  return {
    id: registry.id,
    publicToken: registry.publicToken,
    title: registry.title,
    leftHeader: registry.leftHeader,
    rightHeader: registry.rightHeader,
    mode: registry.mode,
    status: registry.status,
    layout: registry.layout,
    allowWalkIn: registry.allowWalkIn,
    isPasswordProtected: registry.hasPassword,
    columns: registry.columns,
    participants: [],
    createdAt: '',
    updatedAt: '',
  } satisfies Registry;
};

export const unlockPublicRegistry = async (token: string, password: string) => {
  await invoke<{ ok: true }>({ action: 'unlock', token, password });
};

export const searchPublicParticipants = async (token: string, password: string, query: string) => {
  const { participants } = await invoke<ParticipantsResponse>({ action: 'search', token, password, query });
  return participants.map(mapParticipant);
};

export const createPublicWalkIn = async (
  token: string,
  password: string,
  name: string,
  values: Record<string, string>,
) => {
  const { participants } = await invoke<ParticipantsResponse>({
    action: 'walk-in',
    token,
    password,
    name,
    values,
  });
  return mapParticipant(participants[0]);
};

export const submitPublicSignature = async (
  token: string,
  password: string,
  participantId: string,
  dataUrl: string,
  source: SignatureSource,
  values: Record<string, string>,
  width: number,
  height: number,
) => {
  await invoke<{ ok: true }>({
    action: 'submit',
    token,
    password,
    participantId,
    dataUrl,
    source,
    values,
    width,
    height,
  });
};
