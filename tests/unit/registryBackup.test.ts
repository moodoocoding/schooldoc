import { describe, expect, it } from 'vitest';
import {
  createRegistryBackup,
  parseRegistryBackup,
  REGISTRY_BACKUP_KIND,
  REGISTRY_BACKUP_VERSION,
  serializeRegistryBackup,
  summarizeRegistryBackup,
} from '../../src/features/registry/registryBackup';
import type { Registry } from '../../src/features/registry/types';

const makeRegistry = (overrides: Partial<Registry> = {}): Registry => ({
  id: 'registry-1',
  publicToken: 'public-token-1',
  title: '교직원 연수 등록부',
  leftHeader: '일시: 2026. 8. 13.',
  rightHeader: '장소: 미래교육실',
  mode: 'fixed',
  status: 'open',
  layout: 10,
  allowWalkIn: true,
  publicPassword: '1234',
  columns: [{ id: 'affiliation', label: '소속' }],
  participants: [{
    id: 'participant-1',
    rowNumber: 1,
    name: '테스트교사',
    values: { affiliation: '새봄초등학교' },
    signature: {
      dataUrl: 'data:image/png;base64,aGVsbG8=',
      source: 'draw',
      signedAt: '2026-08-13T01:00:00.000Z',
    },
  }],
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T01:00:00.000Z',
  ...overrides,
});

const makeBackupText = (registries: Registry[] = [makeRegistry()]) => serializeRegistryBackup(
  createRegistryBackup(registries, '2026-08-13T02:00:00.000Z'),
);

describe('registry backup', () => {
  it('등록부, 공개 비밀번호, 서명을 손실 없이 직렬화하고 요약한다', () => {
    const parsed = parseRegistryBackup(makeBackupText());

    expect(parsed.kind).toBe(REGISTRY_BACKUP_KIND);
    expect(parsed.version).toBe(REGISTRY_BACKUP_VERSION);
    expect(parsed.registries[0]).toEqual(makeRegistry());
    expect(summarizeRegistryBackup(parsed)).toEqual({
      registryCount: 1,
      participantCount: 1,
      signatureCount: 1,
    });
  });

  it('빈 등록부 백업도 정상적인 전체 복원 대상으로 허용한다', () => {
    const parsed = parseRegistryBackup(makeBackupText([]));

    expect(parsed.registries).toEqual([]);
    expect(summarizeRegistryBackup(parsed).registryCount).toBe(0);
  });

  it('JSON이 아니거나 다른 종류의 파일을 거부한다', () => {
    expect(() => parseRegistryBackup('{잘못된 JSON')).toThrow('JSON 형식이 올바르지 않습니다');
    expect(() => parseRegistryBackup(JSON.stringify({
      kind: 'another.backup',
      version: 1,
      exportedAt: '2026-08-13T02:00:00.000Z',
      registries: [],
    }))).toThrow('등록부 백업 파일이 아닙니다');
  });

  it('지원하지 않는 버전의 백업을 거부한다', () => {
    const value = JSON.parse(makeBackupText()) as Record<string, unknown>;
    value.version = 2;

    expect(() => parseRegistryBackup(JSON.stringify(value))).toThrow('지원하지 않는 백업 버전');
  });

  it('등록부 ID나 공개 토큰이 중복된 백업을 거부한다', () => {
    const first = makeRegistry();
    const duplicateId = makeRegistry({ publicToken: 'public-token-2' });
    expect(() => makeBackupText([first, duplicateId])).toThrow('registries.id 값이 중복');

    const duplicateToken = makeRegistry({ id: 'registry-2' });
    expect(() => makeBackupText([first, duplicateToken])).toThrow('registries.publicToken 값이 중복');
  });

  it('알 수 없는 참석자 열이나 유효하지 않은 서명 이미지를 거부한다', () => {
    const unknownValue = makeRegistry({
      participants: [{
        id: 'participant-1',
        rowNumber: 1,
        name: '테스트교사',
        values: { unknown: '값' },
      }],
    });
    expect(() => makeBackupText([unknownValue])).toThrow('알 수 없는 열');

    const invalidSignature = makeRegistry({
      participants: [{
        id: 'participant-1',
        rowNumber: 1,
        name: '테스트교사',
        values: { affiliation: '새봄초등학교' },
        signature: {
          dataUrl: 'data:text/plain;base64,aGVsbG8=',
          source: 'photo',
          signedAt: '2026-08-13T01:00:00.000Z',
        },
      }],
    });
    expect(() => makeBackupText([invalidSignature])).toThrow('서명 이미지가 올바르지 않습니다');
  });
});
