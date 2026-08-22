import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../src/utils/supabaseClient', () => ({
  supabase: { functions: { invoke } },
}));

import { getRemoteDataCollectMetadata } from '../../src/features/dataCollect/dataCollectPublicApi';

const lockedMetadata = {
  accessGranted: false as const,
  title: '2학기 평가 문항 검토',
  status: 'open' as const,
  dueAt: '',
  passwordRequired: true,
};

describe('data collect public metadata', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { collection: lockedMetadata }, error: null });
  });

  it('최초 조회에는 비밀번호 필드를 보내지 않는다', async () => {
    await expect(getRemoteDataCollectMetadata('public-token')).resolves.toEqual(lockedMetadata);
    expect(invoke).toHaveBeenCalledWith('data-collect-public', {
      body: { action: 'metadata', token: 'public-token' },
    });
  });

  it('잠금 해제 시도에는 빈 값도 포함해 서버 검증을 요청한다', async () => {
    await getRemoteDataCollectMetadata('public-token', '');
    expect(invoke).toHaveBeenCalledWith('data-collect-public', {
      body: { action: 'metadata', token: 'public-token', password: '' },
    });
  });

  it('사용자가 입력한 비밀번호를 metadata 재조회에 전달한다', async () => {
    await getRemoteDataCollectMetadata('public-token', 'school-2026');
    expect(invoke).toHaveBeenCalledWith('data-collect-public', {
      body: { action: 'metadata', token: 'public-token', password: 'school-2026' },
    });
  });
});
