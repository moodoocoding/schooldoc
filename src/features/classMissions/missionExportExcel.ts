import type { CellObject, SheetData } from 'write-excel-file/browser';
import { downloadBlob } from '../../utils/qrImage';
import { checkFor, missionCounts, type Mission, type MissionBoard } from './missionApi';

export const MISSION_EXCEL_HEADERS = ['번호', '이름', '완료 표시', '교사 확인', '현재 상태', '마지막 변경'];
export const MISSION_EXCEL_COLUMNS = [8, 20, 14, 14, 17, 24].map((width) => ({ width }));
const textCell = (value: string, style: Partial<CellObject> = {}): CellObject => ({
  type: String, value, format: '@', wrap: true, alignVertical: 'center', ...style,
});
const numberCell = (value: number, style: Partial<CellObject> = {}): CellObject => ({ type: Number, value, format: '0', ...style });
const statusLabel = { unmarked: '표시 전', reported: '완료 표시', pending: '확인 대기', confirmed: '교사 확인', exempt: '해당 없음' };

export function buildMissionExcelSheet(board: MissionBoard, mission: Mission, exportDate: string): SheetData {
  const counts = missionCounts(board.state, mission);
  const completed = counts.reported + counts.pending + counts.confirmed;
  const header = { fontWeight: 'bold' as const, backgroundColor: '#EAF1F7', borderColor: '#DCE3EA', borderStyle: 'thin' as const, height: 29 };
  return [
    [textCell(`${board.state.className} · ${mission.title}`, { columnSpan: 6, fontWeight: 'bold', fontSize: 16, height: 34 }), null, null, null, null, null],
    [textCell(`기준일 ${exportDate} · 운영 기간 ${mission.startDate} ~ ${mission.dueDate}`, { columnSpan: 6, height: 27 }), null, null, null, null, null],
    [textCell(`대상 ${mission.targets.length}명 · 완료 표시 ${completed}명 · 확인 대기 ${counts.pending}명 · 교사 확인 ${counts.confirmed}명 · 해당 없음 ${counts.exempt}명`, { columnSpan: 6, height: 28 }), null, null, null, null, null],
    [textCell('완료 표시는 학생의 자기보고를 포함합니다. 교사 확인은 선생님이 별도로 확인한 상태입니다.', { columnSpan: 6, height: 30, textColor: '#526174' }), null, null, null, null, null],
    [],
    MISSION_EXCEL_HEADERS.map((value) => textCell(value, header)),
    ...mission.targets.map((student) => {
      const check = checkFor(board.state, mission.id, student.id);
      const status = check?.status ?? 'unmarked';
      const style: Partial<CellObject> = { borderColor: '#DCE3EA', borderStyle: 'thin', height: 27 };
      return [numberCell(student.number, style), textCell(student.name, style),
        textCell(['reported', 'pending', 'confirmed'].includes(status) ? '예' : '아니요', style),
        textCell(status === 'confirmed' ? '예' : '아니요', style),
        textCell(statusLabel[status], style), textCell(check?.updatedAt ? new Date(check.updatedAt).toLocaleString('ko-KR') : '', style)];
    }),
  ];
}

export async function downloadMissionExcel(board: MissionBoard, mission: Mission): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const blob = await writeXlsxFile(buildMissionExcelSheet(board, mission, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })), {
    sheet: '미션 현황', columns: MISSION_EXCEL_COLUMNS, stickyRowsCount: 6, showGridLines: false,
  }, { fontFamily: '맑은 고딕', fontSize: 11 }).toBlob();
  const safe = `${board.state.className}_${mission.title}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '학급미션';
  downloadBlob(blob, `${safe}_미션현황.xlsx`);
}
