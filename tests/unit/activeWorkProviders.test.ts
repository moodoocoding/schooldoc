import { describe, expect, test } from 'vitest';
import { loadActiveWorkSnapshot } from '../../src/features/activeWork/activeWorkProviders';
import type { ActiveWorkItem, ActiveWorkProvider } from '../../src/features/activeWork/types';

const item = (id: string, updatedAt: string): ActiveWorkItem => ({
  id,
  toolId: 'data-collect',
  toolName: '자료 수합',
  title: `수합 ${id}`,
  statusLabel: '수합 중',
  progressLabel: '0/2명 회신',
  updatedAt,
  listPath: '/tools/data-collect',
  detailPath: `/tools/data-collect/${id}`,
  overdue: false,
});

describe('진행 업무 공급자 집계', () => {
  test('공급자를 동시에 읽고 도구 순서와 도구 안의 최근 갱신 순서를 지킨다', async () => {
    const providers: ActiveWorkProvider[] = [
      {
        toolId: 'data-collect',
        toolName: '자료 수합',
        listPath: '/tools/data-collect',
        load: async () => [
          item('old', '2026-08-20T09:00:00.000Z'),
          item('new', '2026-08-22T09:00:00.000Z'),
        ],
      },
      {
        toolId: 'registry-sign',
        toolName: '등록부 서명',
        listPath: '/tools/registry-sign',
        load: async () => [{
          ...item('registry', '2026-08-21T09:00:00.000Z'),
          toolId: 'registry-sign',
          toolName: '등록부 서명',
          listPath: '/tools/registry-sign',
          detailPath: '/tools/registry-sign/registry',
        }],
      },
    ];

    const snapshot = await loadActiveWorkSnapshot({ userId: 'teacher', now: new Date('2026-08-22T12:00:00.000Z') }, providers);

    expect(snapshot.failures).toEqual([]);
    expect(snapshot.groups.map((group) => group.toolId)).toEqual(['data-collect', 'registry-sign']);
    expect(snapshot.groups[0].items.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  test('한 도구가 실패해도 성공한 도구는 보여주고 빈 도구는 숨긴다', async () => {
    const providers: ActiveWorkProvider[] = [
      {
        toolId: 'data-collect',
        toolName: '자료 수합',
        listPath: '/tools/data-collect',
        load: async () => [item('open', '2026-08-22T09:00:00.000Z')],
      },
      {
        toolId: 'notice-collect',
        toolName: '가정통신문 수합',
        listPath: '/tools/consent-forms',
        load: async () => { throw new Error('연결 실패'); },
      },
      {
        toolId: 'special-room',
        toolName: '특별실 예약',
        listPath: '/tools/special-rooms',
        load: async () => [],
      },
    ];

    const snapshot = await loadActiveWorkSnapshot({ userId: 'teacher', now: new Date('2026-08-22T12:00:00.000Z') }, providers);

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].toolId).toBe('data-collect');
    expect(snapshot.failures).toEqual([{
      toolId: 'notice-collect',
      toolName: '가정통신문 수합',
      message: '연결 실패',
    }]);
  });
});
