/** A4 출력과 브라우저 미리보기가 함께 쓰는 pt 단위 규칙. 문자열을 버리지 않는다. */
export const wrapRegistryText = (text: string, width: number, size: number): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '', used = 0;
    for (const char of Array.from(paragraph)) {
      const advance = (/^[\x20-\x7e]$/.test(char) ? 0.7 : 1.08) * size;
      if (line && used + advance > width) {
        lines.push(line); line = ''; used = 0;
      }
      line += char; used += advance;
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
};

export const registryColumnWidths = (width: number, compact: boolean, fieldCount: number) => {
  const number = compact ? 25.5 : 39;
  const signature = compact ? 66 : 112.5;
  const name = compact ? 52.5 : 87;
  return {
    number,
    name: fieldCount ? name : width - number - signature,
    fields: Array.from({ length: fieldCount }, () => (width - number - name - signature) / fieldCount),
    signature,
  };
};

export interface RegistryPrintInput {
  layout: 10 | 15 | 20 | 30;
  title: string;
  leftHeader: string;
  rightHeader: string;
  columns: { id: string; label: string }[];
  participants: { name: string; values: Record<string, string> }[];
}

export const registryPrintPlan = (registry: RegistryPrintInput) => {
  const titleLines = wrapRegistryText(registry.title, 514, 18);
  const leftLines = wrapRegistryText(registry.leftHeader, 248, 9.5);
  const rightLines = wrapRegistryText(registry.rightHeader, 248, 9.5);
  const tableTop = 728 - (titleLines.length - 1) * 22 - Math.max(leftLines.length, rightLines.length) * 14 - 10;
  const requestedColumns = registry.layout >= 20 ? 2 : 1;
  // 두 단에 입력 열이 세 개 이상이면 한 단으로 전환해 최소 열 너비를 보장한다.
  const tableColumns = requestedColumns === 2 && registry.columns.length <= 2 ? 2 : 1;
  const tableWidth = tableColumns === 2 ? 251 : 514;
  const widths = registryColumnWidths(tableWidth, tableColumns === 2, registry.columns.length);
  const size = tableColumns === 2 ? 7.5 : 9.5;
  const headerLines = Math.max(1, ...registry.columns.map((column, index) =>
    wrapRegistryText(column.label, widths.fields[index] - 8, tableColumns === 2 ? 8 : 9.5).length));
  const headerHeight = Math.max(32, headerLines * 12 + 8);
  const textLines = Math.max(1, ...registry.participants.map((participant) => Math.max(
    wrapRegistryText(participant.name, widths.name - 8, size).length,
    ...registry.columns.map((column, index) =>
      wrapRegistryText(participant.values[column.id] ?? '', widths.fields[index] - 8, size).length),
  )));
  const minRowHeight = Math.max(32, textLines * (size + 3) + 8);
  const bodyHeight = tableTop - 62 - headerHeight;
  const preferredRows = registry.layout === 15 || registry.layout === 30 ? 15 : 10;
  const rowsPerColumn = Math.min(preferredRows, Math.floor(bodyHeight / minRowHeight));
  return {
    valid: rowsPerColumn >= 1,
    tableColumns,
    rowsPerColumn: Math.max(1, rowsPerColumn),
    pageSize: tableColumns * Math.max(1, rowsPerColumn),
    tableTop, tableWidth, headerHeight,
    rowHeight: Math.max(0, bodyHeight) / Math.max(1, rowsPerColumn),
    size, widths, titleLines, leftLines, rightLines,
    adjusted: tableColumns !== requestedColumns || rowsPerColumn !== preferredRows,
  };
};
