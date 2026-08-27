import { activeWorkProviders } from './activeWorkProviders';
import type { ActiveWorkItem, ActiveWorkSnapshot, ActiveWorkToolId } from './types';

export interface ActiveWorkSummaryRow {
  tool_id: string;
  item_id: string;
  title: string;
  mode: string | null;
  done_count: number | string;
  total_count: number | string;
  issue_count: number | string;
  due_at: string | null;
  updated_at: string;
}

const toCount = (value: number | string) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const isToolId = (value: string): value is ActiveWorkToolId => (
  activeWorkProviders.some((provider) => provider.toolId === value)
);

const progressLabel = (row: ActiveWorkSummaryRow) => {
  const done = toCount(row.done_count);
  const total = toCount(row.total_count);
  const issues = toCount(row.issue_count);
  switch (row.tool_id) {
    case 'registry-sign': return `${done}/${total}명 서명`;
    case 'student-lookup': return `${done}/${total}명 확인${issues ? ` · 이의 ${issues}건` : ''}`;
    case 'notice-collect': return row.mode === 'named' ? `${done}/${total}명 응답` : `응답 ${done}건`;
    case 'data-collect': return row.mode === 'fixed' ? `${done}/${total}명 회신` : `회신 ${done}건`;
    case 'special-room': return `특별실 ${total}곳 · 예약 ${done}건`;
    default: return '';
  }
};

const hasPassed = (value: string | null, now: Date) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp < now.getTime();
};

export const activeWorkSnapshotFromSummary = (
  rows: ActiveWorkSummaryRow[],
  now: Date,
): ActiveWorkSnapshot => {
  const items = rows.flatMap((row): ActiveWorkItem[] => {
    if (!isToolId(row.tool_id)) return [];
    const provider = activeWorkProviders.find((candidate) => candidate.toolId === row.tool_id);
    if (!provider) return [];
    const overdue = (row.tool_id === 'notice-collect' || row.tool_id === 'data-collect')
      && hasPassed(row.due_at, now);
    const statusLabel = row.tool_id === 'student-lookup'
      ? '안내 중'
      : row.tool_id === 'special-room'
        ? '예약 중'
        : overdue
          ? '마감 지남'
          : '수합 중';
    return [{
      id: row.item_id,
      toolId: row.tool_id,
      toolName: provider.toolName,
      title: row.title,
      statusLabel,
      progressLabel: progressLabel(row),
      updatedAt: row.updated_at,
      listPath: provider.listPath,
      detailPath: `${provider.listPath}/${row.item_id}`,
      overdue,
    }];
  });

  return {
    groups: activeWorkProviders.flatMap((provider) => {
      const providerItems = items
        .filter((item) => item.toolId === provider.toolId)
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return providerItems.length ? [{
        toolId: provider.toolId,
        toolName: provider.toolName,
        listPath: provider.listPath,
        items: providerItems,
      }] : [];
    }),
    failures: [],
  };
};
