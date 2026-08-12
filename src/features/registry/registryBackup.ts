import type {
  Registry,
  RegistryColumn,
  RegistryParticipant,
  RegistrySignature,
} from './types';
import { isValidSignatureDataUrl } from './registryUtils';

export const REGISTRY_BACKUP_KIND = 'schooldoc.registry.backup';
export const REGISTRY_BACKUP_VERSION = 1;
export const MAX_REGISTRY_BACKUP_BYTES = 10_000_000;

export interface RegistryBackupDocument {
  kind: typeof REGISTRY_BACKUP_KIND;
  version: typeof REGISTRY_BACKUP_VERSION;
  exportedAt: string;
  registries: Registry[];
}

export interface RegistryBackupSummary {
  registryCount: number;
  participantCount: number;
  signatureCount: number;
}

export class RegistryBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryBackupError';
  }
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const fail = (message: string): never => {
  throw new RegistryBackupError(message);
};

const readString = (
  record: UnknownRecord,
  key: string,
  path: string,
  maxLength: number,
  allowEmpty = false,
) => {
  const value = record[key];
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    return fail(`${path} 값이 올바르지 않습니다.`);
  }
  if (value.length > maxLength) return fail(`${path} 값이 너무 깁니다.`);
  return value;
};

const readDate = (record: UnknownRecord, key: string, path: string) => {
  const value = readString(record, key, path, 80);
  if (Number.isNaN(Date.parse(value))) return fail(`${path} 날짜가 올바르지 않습니다.`);
  return value;
};

const readArray = (record: UnknownRecord, key: string, path: string) => {
  const value = record[key];
  if (!Array.isArray(value)) return fail(`${path} 목록이 올바르지 않습니다.`);
  return value;
};

const parseColumn = (value: unknown, path: string): RegistryColumn => {
  if (!isRecord(value)) return fail(`${path} 열 정보가 올바르지 않습니다.`);
  return {
    id: readString(value, 'id', `${path}.id`, 200),
    label: readString(value, 'label', `${path}.label`, 120),
  };
};

const parseSignature = (value: unknown, path: string): RegistrySignature => {
  if (!isRecord(value)) return fail(`${path} 서명 정보가 올바르지 않습니다.`);
  const dataUrl = readString(value, 'dataUrl', `${path}.dataUrl`, 8_000_000);
  if (!isValidSignatureDataUrl(dataUrl)) return fail(`${path} 서명 이미지가 올바르지 않습니다.`);
  if (value.source !== 'draw' && value.source !== 'photo') {
    return fail(`${path} 서명 방식이 올바르지 않습니다.`);
  }
  return {
    dataUrl,
    source: value.source,
    signedAt: readDate(value, 'signedAt', `${path}.signedAt`),
  };
};

const parseParticipant = (
  value: unknown,
  path: string,
  columnIds: Set<string>,
): RegistryParticipant => {
  if (!isRecord(value)) return fail(`${path} 참석자 정보가 올바르지 않습니다.`);
  if (!Number.isInteger(value.rowNumber) || (value.rowNumber as number) < 1) {
    return fail(`${path}.rowNumber 값이 올바르지 않습니다.`);
  }
  if (!isRecord(value.values)) return fail(`${path}.values 값이 올바르지 않습니다.`);

  const values = Object.fromEntries(Object.entries(value.values).map(([key, entry]) => {
    if (!columnIds.has(key)) return fail(`${path}.values에 알 수 없는 열이 있습니다.`);
    if (typeof entry !== 'string' || entry.length > 1_000) {
      return fail(`${path}.values.${key} 값이 올바르지 않습니다.`);
    }
    return [key, entry];
  }));

  const participant: RegistryParticipant = {
    id: readString(value, 'id', `${path}.id`, 200),
    rowNumber: value.rowNumber as number,
    name: readString(value, 'name', `${path}.name`, 120),
    values,
  };
  if (value.signature !== undefined) {
    participant.signature = parseSignature(value.signature, `${path}.signature`);
  }
  return participant;
};

const assertUnique = (values: string[], path: string) => {
  if (new Set(values).size !== values.length) return fail(`${path} 값이 중복되어 있습니다.`);
};

const parseRegistry = (value: unknown, index: number): Registry => {
  const path = `registries[${index}]`;
  if (!isRecord(value)) return fail(`${path} 등록부 정보가 올바르지 않습니다.`);
  if (value.mode !== 'fixed' && value.mode !== 'custom') {
    return fail(`${path}.mode 값이 올바르지 않습니다.`);
  }
  if (value.status !== 'open' && value.status !== 'closed') {
    return fail(`${path}.status 값이 올바르지 않습니다.`);
  }
  if (value.layout !== 10 && value.layout !== 15 && value.layout !== 20 && value.layout !== 30) {
    return fail(`${path}.layout 값이 올바르지 않습니다.`);
  }
  if (typeof value.allowWalkIn !== 'boolean') {
    return fail(`${path}.allowWalkIn 값이 올바르지 않습니다.`);
  }

  const columns = readArray(value, 'columns', `${path}.columns`)
    .map((column, columnIndex) => parseColumn(column, `${path}.columns[${columnIndex}]`));
  assertUnique(columns.map((column) => column.id), `${path}.columns.id`);
  const columnIds = new Set(columns.map((column) => column.id));
  const participants = readArray(value, 'participants', `${path}.participants`)
    .map((participant, participantIndex) => (
      parseParticipant(participant, `${path}.participants[${participantIndex}]`, columnIds)
    ));
  assertUnique(participants.map((participant) => participant.id), `${path}.participants.id`);

  const registry: Registry = {
    id: readString(value, 'id', `${path}.id`, 200),
    publicToken: readString(value, 'publicToken', `${path}.publicToken`, 300),
    title: readString(value, 'title', `${path}.title`, 300),
    leftHeader: readString(value, 'leftHeader', `${path}.leftHeader`, 1_000, true),
    rightHeader: readString(value, 'rightHeader', `${path}.rightHeader`, 1_000, true),
    mode: value.mode,
    status: value.status,
    layout: value.layout,
    allowWalkIn: value.allowWalkIn,
    columns,
    participants,
    createdAt: readDate(value, 'createdAt', `${path}.createdAt`),
    updatedAt: readDate(value, 'updatedAt', `${path}.updatedAt`),
  };
  if (value.publicPassword !== undefined) {
    registry.publicPassword = readString(value, 'publicPassword', `${path}.publicPassword`, 200, true);
  }
  return registry;
};

export const validateRegistryBackup = (value: unknown): RegistryBackupDocument => {
  if (!isRecord(value)) return fail('백업 문서 형식이 올바르지 않습니다.');
  if (value.kind !== REGISTRY_BACKUP_KIND) return fail('등록부 백업 파일이 아닙니다.');
  if (value.version !== REGISTRY_BACKUP_VERSION) {
    return fail(`지원하지 않는 백업 버전입니다. 현재 버전은 ${REGISTRY_BACKUP_VERSION}입니다.`);
  }

  const registries = readArray(value, 'registries', 'registries')
    .map((registry, index) => parseRegistry(registry, index));
  assertUnique(registries.map((registry) => registry.id), 'registries.id');
  assertUnique(registries.map((registry) => registry.publicToken), 'registries.publicToken');

  return {
    kind: REGISTRY_BACKUP_KIND,
    version: REGISTRY_BACKUP_VERSION,
    exportedAt: readDate(value, 'exportedAt', 'exportedAt'),
    registries,
  };
};

export const createRegistryBackup = (
  registries: Registry[],
  exportedAt = new Date().toISOString(),
) => validateRegistryBackup({
  kind: REGISTRY_BACKUP_KIND,
  version: REGISTRY_BACKUP_VERSION,
  exportedAt,
  registries,
});

export const serializeRegistryBackup = (backup: RegistryBackupDocument) => (
  JSON.stringify(validateRegistryBackup(backup), null, 2)
);

export const parseRegistryBackup = (text: string) => {
  if (new TextEncoder().encode(text).byteLength > MAX_REGISTRY_BACKUP_BYTES) {
    return fail('백업 파일은 10MB 이하만 복원할 수 있습니다.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('백업 파일의 JSON 형식이 올바르지 않습니다.');
  }
  return validateRegistryBackup(parsed);
};

export const summarizeRegistryBackup = (backup: RegistryBackupDocument): RegistryBackupSummary => ({
  registryCount: backup.registries.length,
  participantCount: backup.registries.reduce((sum, registry) => sum + registry.participants.length, 0),
  signatureCount: backup.registries.reduce((sum, registry) => (
    sum + registry.participants.filter((participant) => participant.signature).length
  ), 0),
});
