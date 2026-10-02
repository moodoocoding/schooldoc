const totalLabels = new Set(['총점', '합계', '종합점수', '전체점수', 'total', 'totalscore']);

/** Explicit choices win; legacy/manual columns infer a kind from the displayed label. */
export const studentResultColumnKind = (column: { label: string; kind?: unknown }): 'score' | 'total' => (
  column.kind === 'total'
    || (column.kind === undefined && totalLabels.has(column.label.trim().toLocaleLowerCase('ko-KR').replace(/\s/g, '')))
    ? 'total' : 'score'
);

export const normalizeStudentResultColumn = <T extends { label: string; kind?: unknown }>(column: T) => ({
  ...column, kind: studentResultColumnKind(column),
});
