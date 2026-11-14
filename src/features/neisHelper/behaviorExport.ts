import writeXlsx from 'write-excel-file/browser';
import { downloadBlob } from '../../utils/qrImage';
import { behaviorCounts, identicalBehaviorIds } from '../../../supabase/functions/_shared/neisBehavior';
import type { BehaviorEntry } from './behaviorState';

export function behaviorExportRows(entries: BehaviorEntry[]) {
  const rows = entries.filter((entry) => entry.text.trim() && !entry.error && !entry.stale).toSorted((a, b) => a.number - b.number);
  if (!rows.length) throw new Error('저장할 완성된 내용이 없습니다.');
  if (identicalBehaviorIds(rows).size) throw new Error('전체 내용이 같은 학생이 있습니다. 중복 문장을 수정한 뒤 저장해 주세요.');
  return rows;
}
export async function exportBehavior(entries: BehaviorEntry[]) {
  const rows = behaviorExportRows(entries);
  const cell = (value: string) => ({ type: String, value, format: '@', wrap: true });
  const sheet = [['번호', '이름', '행동특성 및 종합의견', '글자 수(공백 포함)', '바이트(줄바꿈 1)'].map(cell), ...rows.map((row) => {
    const counts = behaviorCounts(row.text);
    return [String(row.number), row.name, row.text, String(counts.characters), String(counts.bytes)].map(cell);
  })];
  const blob = await writeXlsx(sheet, { sheet: '행동특성 및 종합의견', columns: [8, 16, 100, 20, 20].map((width) => ({ width })), stickyRowsCount: 1 }, { fontFamily: '맑은 고딕', fontSize: 11 }).toBlob();
  downloadBlob(blob, '행동특성_및_종합의견.xlsx');
}
