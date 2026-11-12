import { itemDepth, type OfficialDocument, type OfficialDocumentKind, type OfficialNode, type OfficialTableColumn } from './model';

/**
 * 공문 서식 규칙. 근거는 2025 행정업무운영 편람과 교육청 공문 첨부 문서 실측값이다
 * (docs/official-document-format.md). 크기 단위는 HWPUNIT(1pt = 100)이다.
 */
export interface OfficialFormatProfile {
  bodyFont: string; titleFont: string;
  titleSize: number; bodySize: number; tableSize: number;
  lineSpacing: number; titleLineSpacing: number; ratio: number; spacing: number;
  page: { width: number; height: number; marginLeft: number; marginRight: number; marginTop: number; marginBottom: number; marginHeader: number; marginFooter: number };
  tableHeaderFill: string;
}
export interface OfficialDocumentKindInfo { label: string; profile: OfficialFormatProfile; pageOptions: readonly number[] }

/** 붙임 계획서·보고서: 휴먼명조 13pt·장평 100%·자간 0%·줄간격 160%, 제목 HY헤드라인M 16pt. */
export const ATTACHMENT_PROFILE: OfficialFormatProfile = {
  bodyFont: '휴먼명조', titleFont: 'HY헤드라인M',
  titleSize: 1600, bodySize: 1300, tableSize: 1200,
  lineSpacing: 160, titleLineSpacing: 130, ratio: 100, spacing: 0,
  // A4, 좌우 20mm, 위·아래 15mm, 머리말·꼬리말 10mm.
  page: { width: 59528, height: 84186, marginLeft: 5669, marginRight: 5669, marginTop: 4252, marginBottom: 4252, marginHeader: 2835, marginFooter: 2835 },
  tableHeaderFill: '#e6e6e6',
};
/** 문서 종류 목록. 새 공문서는 여기에 서식과 분량을 등록하고, 내용은 각 기능의 변환기가 문서 모델로 만든다. */
export const OFFICIAL_DOCUMENT_KINDS: Record<OfficialDocumentKind, OfficialDocumentKindInfo> = {
  'attachment-plan': { label: '붙임 계획서', profile: ATTACHMENT_PROFILE, pageOptions: [1, 2] },
};

/** 편람 항목기호(1.→가.→1)→가)→(1)→(가)), 그리고 4단계 이상 문서의 개조식 체계. */
export const OFFICIAL_MARKERS = ['n.', 'k.', 'n)', 'k)', '(n)', '(k)'] as const;
export const DEEP_MARKERS = ['□', '◦', '-', '※'] as const;
const KOREAN_ORDER = '가나다라마바사아자차카타파하';
// 하 다음은 거, 너, 더 … → 고, 노 … 처럼 단모음 순으로 이어 간다(편람 51쪽). 값은 ㅏ에서 각 모음까지의 음절 간격이다.
const VOWEL_STEPS = [0, 4, 8, 13, 18, 20].map(n => n * 28);
const koreanMarker = (index: number) => {
  const round = Math.floor(index / KOREAN_ORDER.length);
  return String.fromCharCode(KOREAN_ORDER.charCodeAt(index % KOREAN_ORDER.length) + VOWEL_STEPS[Math.min(round, VOWEL_STEPS.length - 1)]);
};

/** level(1부터)의 index번째(0부터) 항목 기호. 계층이 4단계 이상이면 □ ◦ - ※를 쓴다. */
export function officialMarker(level: number, index: number, depth: number): string {
  if (depth >= 4) return DEEP_MARKERS[Math.min(level, DEEP_MARKERS.length) - 1];
  const pattern = OFFICIAL_MARKERS[(level - 1) % OFFICIAL_MARKERS.length];
  return pattern.replace('n', String(index + 1)).replace('k', koreanMarker(index));
}

// 휴먼명조 글자 폭(em). 한컴 글꼴에서 측정해 한글에서 둘째 줄이 내용 첫 글자에 맞도록 한다.
const advance = (c: string) => /[0-9]/.test(c) ? 0.5 : c === ' ' ? 0.5 : c === '.' ? 0.27 : c === '(' || c === ')' ? 0.312 : c === '-' ? 0.5 : 1;
/** "기호␠" 뒤 내용 첫 글자까지의 내어쓰기 폭(HWPUNIT). 기호가 없으면 0. */
export function markerHang(marker: string, size: number) {
  if (!marker) return 0;
  return Math.round([...`${marker} `].reduce((sum, c) => sum + advance(c), 0) * size);
}
/** 왼쪽 시작점(HWPUNIT): 하위 항목은 바로 위 항목에서 2타(한글 1자)씩 들여 시작한다. */
export const levelIndent = (level: number, size: number) => (level - 1) * size;

/** 출력기가 그대로 그리는 줄 단위 배치 결과. */
export type OfficialLine =
  | { kind: 'title'; text: string }
  | { kind: 'item' | 'note'; level: number; marker: string; text: string; heading: boolean; pageBreakBefore: boolean }
  | { kind: 'table'; level: number; columns: OfficialTableColumn[]; rows: string[][] };

/** 문서 모델을 항목 기호·계층이 정해진 줄로 펼친다. 하위 항목이 있는 문서의 대항목(1단계)은 목차로 굵게 쓰고 다음 줄과 붙여 둔다. */
export function layoutOfficialDocument(document: OfficialDocument): OfficialLine[] {
  const depth = itemDepth(document.body);
  const lines: OfficialLine[] = [{ kind: 'title', text: document.title.trim() }];
  const walk = (nodes: OfficialNode[], level: number) => {
    let index = 0;
    // 편람 52~53쪽: 항목이 하나뿐이면 항목 기호를 붙이지 않는다(□ ◦ - ※ 개조식은 기호를 유지한다).
    const single = depth < 4 && nodes.filter(n => n.kind === 'item').length === 1;
    for (const node of nodes) {
      if (node.kind === 'item') {
        const marker = single ? '' : officialMarker(level, index, depth);
        index++;
        lines.push({ kind: 'item', level, marker, text: marker ? `${marker} ${node.text}` : node.text, heading: level === 1 && depth > 1, pageBreakBefore: !!node.pageBreakBefore });
        walk(node.children ?? [], level + 1);
      } else if (node.kind === 'note') lines.push({ kind: 'note', level, marker: '※', text: `※ ${node.text}`, heading: false, pageBreakBefore: false });
      else lines.push({ kind: 'table', level, columns: node.columns, rows: node.rows });
    }
  };
  walk(document.body, 1);
  return lines;
}
/** 표 머리행까지 포함한 셀 글자 목록(보존 검사·본문 읽기용). */
export const tableCells = (line: Extract<OfficialLine, { kind: 'table' }>) => [line.columns.map(c => c.label), ...line.rows];
