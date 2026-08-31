import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { loadActiveWork } from '../../src/features/activeWork/activeWorkService';
import { activeWorkSnapshotFromSummary, type ActiveWorkSummaryRow } from '../../src/features/activeWork/activeWorkSummary';
import type { ActiveWorkSnapshot } from '../../src/features/activeWork/types';

const row = (patch: Partial<ActiveWorkSummaryRow>): ActiveWorkSummaryRow => ({
  tool_id: 'registry-sign',
  item_id: 'registry-id',
  title: '교직원 연수 등록부',
  mode: null,
  done_count: 18,
  total_count: 34,
  issue_count: 0,
  due_at: null,
  updated_at: '2026-08-27T08:00:00.000Z',
  ...patch,
});

describe('진행 업무 경량 요약', () => {
  test('RPC 집계 행을 기존 화면 계약과 같은 그룹으로 바꾼다', () => {
    const snapshot = activeWorkSnapshotFromSummary([
      row({}),
      row({
        tool_id: 'student-lookup', item_id: 'result-id', title: '진단평가 결과 안내',
        done_count: '20', total_count: '23', issue_count: '2',
      }),
      row({
        tool_id: 'data-collect', item_id: 'collect-id', title: '계획서 수합', mode: 'fixed',
        done_count: 4, total_count: 6, due_at: '2026-08-26T00:00:00.000Z',
      }),
      row({
        tool_id: 'special-room', item_id: 'room-id', title: '2학기 특별실',
        done_count: 9, total_count: 3,
      }),
      row({ tool_id: 'unknown-tool' }),
    ], new Date('2026-08-27T09:00:00.000Z'));

    expect(snapshot.groups.map((group) => group.toolId)).toEqual([
      'registry-sign', 'student-lookup', 'data-collect', 'special-room',
    ]);
    expect(snapshot.groups[0].items[0].progressLabel).toBe('18/34명 서명');
    expect(snapshot.groups[1].items[0].progressLabel).toBe('20/23명 확인 · 이의 2건');
    expect(snapshot.groups[2].items[0]).toMatchObject({
      statusLabel: '마감 지남', progressLabel: '4/6명 회신', overdue: true,
    });
    expect(snapshot.groups[3].items[0].progressLabel).toBe('특별실 3곳 · 예약 9건');
  });

  test('운영에서는 원격 요약 한 번만 읽고 상세 공급자를 호출하지 않는다', async () => {
    const remoteSnapshot: ActiveWorkSnapshot = { groups: [], failures: [] };
    const loadRemote = vi.fn(async () => remoteSnapshot);
    const loadLegacy = vi.fn(async () => remoteSnapshot);

    await expect(loadActiveWork(
      { userId: 'teacher', now: new Date('2026-08-27T09:00:00.000Z') },
      { demoMode: false, loadRemote, loadLegacy },
    )).resolves.toBe(remoteSnapshot);

    expect(loadRemote).toHaveBeenCalledOnce();
    expect(loadLegacy).not.toHaveBeenCalled();
  });

  test('요약 RPC를 아직 적용하지 않았거나 일시 실패하면 기존 목록으로 복구한다', async () => {
    const legacySnapshot: ActiveWorkSnapshot = { groups: [], failures: [] };
    const loadLegacy = vi.fn(async () => legacySnapshot);

    await expect(loadActiveWork(
      { userId: 'teacher', now: new Date('2026-08-27T09:00:00.000Z') },
      { demoMode: false, loadRemote: async () => { throw new Error('RPC 없음'); }, loadLegacy },
    )).resolves.toBe(legacySnapshot);

    expect(loadLegacy).toHaveBeenCalledOnce();
  });

  test('RPC는 로그인 사용자만 실행할 수 있고 개인정보·파일 경로를 반환하지 않는다', () => {
    const migration = readFileSync('supabase/migrations/202608270001_active_work_summary.sql', 'utf8');
    expect(migration).toContain('security definer');
    expect(migration).toContain('registry.owner_id = auth.uid()');
    expect(migration).toContain('event.owner_id = auth.uid()');
    expect(migration).toContain('collection.owner_id = auth.uid()');
    expect(migration).toContain('revoke all on function public.get_active_work_summary() from anon');
    expect(migration).toContain('grant execute on function public.get_active_work_summary() to authenticated');
    expect(migration).not.toMatch(/identity_ciphertext|result_ciphertext|storage_path|personal_token/);
  });
});
