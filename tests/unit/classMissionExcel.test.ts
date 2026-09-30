import { describe, expect, test } from 'vitest';
import { buildMissionExcelSheet } from '../../src/features/classMissions/missionExportExcel';
import type { MissionBoard } from '../../supabase/functions/_shared/classMissions';

describe('학급 미션 Excel', () => {
  test('학생 자기보고와 교사 확인을 별도 열로 기록하고 수식처럼 생긴 이름도 텍스트로 둔다', () => {
    const students = [
      { id: crypto.randomUUID(), number: 1, name: '=가상학생' },
      { id: crypto.randomUUID(), number: 2, name: '가상바다' },
    ];
    const mission = { id: crypto.randomUUID(), title: '읽기 미션', description: '', startDate: '2026-09-01', dueDate: '2026-09-30',
      requiresConfirmation: true, status: 'open' as const, targets: students,
      createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' };
    const board: MissionBoard = { id: crypto.randomUUID(), publicToken: crypto.randomUUID(), publicEnabled: true,
      version: 1, updatedAt: '2026-09-01T00:00:00Z', state: { className: '가상 5학년 2반', roster: students,
        missions: [mission], checks: [
          { missionId: mission.id, studentId: students[0].id, status: 'pending', updatedAt: '2026-09-20T00:00:00Z' },
          { missionId: mission.id, studentId: students[1].id, status: 'confirmed', updatedAt: '2026-09-21T00:00:00Z' },
        ], events: [] } };
    const rows = buildMissionExcelSheet(board, mission, '2026-09-27');
    expect(rows[1]?.[0]).toMatchObject({ value: expect.stringContaining('2026-09-27') });
    expect(rows[6]?.[1]).toMatchObject({ value: '=가상학생', type: String, format: '@' });
    expect(rows[6]?.[2]).toMatchObject({ value: '예' });
    expect(rows[6]?.[3]).toMatchObject({ value: '아니요' });
    expect(rows[7]?.[2]).toMatchObject({ value: '예' });
    expect(rows[7]?.[3]).toMatchObject({ value: '예' });
    expect(JSON.stringify(rows)).not.toContain(board.publicToken);
  });
});
