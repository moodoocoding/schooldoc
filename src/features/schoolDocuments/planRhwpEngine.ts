import type { HwpDocument } from '@rhwp/core';
import { planBudgetTotal, type PlanDraft } from '../../../supabase/functions/_shared/schoolPlan';

/**
 * Official-document layout measured from 교육청 공문 첨부 계획서(HWPX) and the
 * 2025 행정업무운영 편람 (docs/official-document-format.md). Sizes are HWPUNIT (1pt = 100).
 */
export const PLAN_BODY_FONT = '휴먼명조';
export const PLAN_TITLE_FONT = 'HY헤드라인M';
export const PLAN_FORMAT = {
  titleSize: 1600, bodySize: 1300, tableSize: 1200, lineSpacing: 160, ratio: 100, spacing: 0,
  // A4, 좌우 20mm, 위·아래 15mm, 머리말·꼬리말 10mm.
  page: { width: 59528, height: 84186, marginLeft: 5669, marginRight: 5669, marginTop: 4252, marginBottom: 4252, marginHeader: 2835, marginFooter: 2835 },
} as const;
/** 편람 항목기호(1.→가.→1)→가)), and the 개조식 체계 used once a plan needs four or more levels. */
export const OFFICIAL_MARKERS = ['n.', 'k.', 'n)', 'k)', '(n)', '(k)'] as const;
export const DEEP_MARKERS = ['□', '◦', '-', '※'] as const;
const KOREAN_ORDER = '가나다라마바사아자차카타파하';
export type PlanFonts = { body: Uint8Array; bodyBold: Uint8Array; title: Uint8Array };
export type PlanTextBlock = { kind: 'title' | 'heading' | 'body'; text: string; level: number; marker: string };
export type PlanBlock = PlanTextBlock | { kind: 'table'; rows: string[][]; widths: number[] };
export interface PlanDocument { bytes: Uint8Array<ArrayBuffer>; svgs: string[]; pageCount: number }

/** Marker for the index-th item (0-based) at a level; deep plans use □ ◦ - ※ instead of numbering. */
export function planMarker(level: number, index: number, depth: number): string {
  if (depth >= 4) return DEEP_MARKERS[Math.min(level, DEEP_MARKERS.length) - 1];
  const pattern = OFFICIAL_MARKERS[(level - 1) % OFFICIAL_MARKERS.length];
  const korean = index < KOREAN_ORDER.length ? KOREAN_ORDER[index] : `${KOREAN_ORDER[index % KOREAN_ORDER.length]}${Math.floor(index / KOREAN_ORDER.length)}`;
  return pattern.replace('n', String(index + 1)).replace('k', korean);
}

// 휴먼명조 advance widths in em, measured from the Hancom font so wrapped lines meet the first content letter in 한글.
const advance = (c: string) => /[0-9]/.test(c) ? 0.5 : c === ' ' ? 0.5 : c === '.' ? 0.27 : c === '(' || c === ')' ? 0.312 : c === '-' ? 0.5 : 1;
/** Hanging indent (HWPUNIT) that aligns wrapped lines with the text after "marker␠". */
export function markerHang(marker: string, size: number) {
  return Math.round([...`${marker} `].reduce((sum, c) => sum + advance(c), 0) * size);
}
/** Left edge (HWPUNIT): each lower level starts 2타 (one Hangul letter) right of the level above. */
export const levelIndent = (level: number, size: number) => (level - 1) * size;

export function planDocumentBlocks(draft: PlanDraft, title: string): PlanBlock[] {
  if (!title.trim() || title.length > 100 || [...title].some(c => c.charCodeAt(0) < 32)) throw new Error('문서 제목을 100자 이내로 확인해 주세요.');
  // Sections → paragraphs is a two-level plan, so the 편람 numbering applies.
  const depth = 2;
  const blocks: PlanBlock[] = [{ kind: 'title', text: title.trim(), level: 0, marker: '' }];
  let headingIndex = 0;
  const heading = (text: string) => { const marker = planMarker(1, headingIndex++, depth); blocks.push({ kind: 'heading', text: `${marker} ${text}`, level: 1, marker }); };
  const item = (text: string, index: number) => { const marker = planMarker(2, index, depth); blocks.push({ kind: 'body', text: `${marker} ${text}`, level: 2, marker }); };
  const note = (text: string) => blocks.push({ kind: 'body', text: `※ ${text}`, level: 2, marker: '※' });
  draft.sections.forEach(section => { heading(section.heading); section.paragraphs.forEach(item); });
  heading('세부추진 일정(안)');
  if (draft.schedule.length) blocks.push({ kind: 'table', widths: [11600, 23500, 13000], rows: [['시기', '활동', '담당'], ...draft.schedule.map(s => [s.when, s.activity, s.owner])] });
  heading('소요 예산(안)');
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
  if (draft.budget.length) {
    blocks.push({ kind: 'table', widths: [20500, 10000, 6500, 11100], rows: [['항목', '단가', '수량', '금액'], ...draft.budget.map(b => [b.item, won(b.unitPrice), String(b.quantity), won(b.unitPrice * b.quantity)])] });
    note(`합계 ${won(planBudgetTotal(draft))}(단가와 배분은 제안이며 집행 기준·실제 견적 확인 필요)`);
  } else note('예산 없음 또는 미정: 금액 확정 후 집행 기준에 따라 확인');
  if (draft.unknowns.length) { heading('학교 확인 사항'); draft.unknowns.forEach(note); }
  return blocks;
}
export function checkedHwpxExport(doc: HwpDocument): Uint8Array<ArrayBuffer> {
  const result = doc.exportHwpxWithReport();
  try {
    const report = JSON.parse(result.contentLoss());
    if (report.count !== 0 || !Array.isArray(report.losses) || report.losses.length) throw new Error('문서의 일부 내용을 보존할 수 없습니다. 원본을 한글에서 HWPX로 저장하거나 본문을 붙여 넣어 주세요.');
    return new Uint8Array(result.takeBytes());
  } finally { result.free(); }
}

// rhwp paragraph JSON takes HWP 5 units (2 per HWPUNIT); character and page JSON take HWPUNIT.
const para = (hwpunit: number) => hwpunit * 2;
const seven = <T,>(value: T) => Array.from({ length: 7 }, () => value);

/** Creates editable paragraphs and native tables through rhwp, never raw model XML. */
export function buildPlanDocument(doc: HwpDocument, draft: PlanDraft, title: string, pages: 1 | 2, fonts: PlanFonts) {
  const blocks = planDocumentBlocks(draft, title);
  const fontIds = (face: string) => Array.from({ length: 7 }, (_, lang) => doc.findOrCreateFontIdForLang(lang, face));
  const bodyFonts = fontIds(PLAN_BODY_FONT), titleFonts = fontIds(PLAN_TITLE_FONT);
  const registered = new Set<number>();
  // Hancom fonts cannot be bundled: OFL substitutes only measure and paint the preview; the file names the Hancom faces.
  const bindFont = (properties: string, source: Uint8Array) => {
    const id = JSON.parse(properties).charShapeId as number;
    if (registered.has(id)) return;
    for (let lang = 0; lang < 7; lang++) doc.registerExactFontSource(id, lang, source, 0);
    registered.add(id);
  };
  const charFormat = (fontSize: number, bold: boolean, title = false) => JSON.stringify({ fontIds: title ? titleFonts : bodyFonts, fontSize, bold, ratios: seven(PLAN_FORMAT.ratio), spacings: seven(PLAN_FORMAT.spacing) });
  doc.deleteText(0, 0, 0, doc.getParagraphLength(0, 0));
  doc.setPageDef(0, JSON.stringify(PLAN_FORMAT.page));
  const expected: string[] = [];
  const { bodySize } = PLAN_FORMAT;
  blocks.forEach((block, index) => {
    const p = index === 0 ? 0 : doc.getParagraphCount(0);
    if (index > 0) doc.insertParagraph(0, p);
    if (block.kind !== 'table') {
      expected.push(block.text);
      doc.insertText(0, p, 0, block.text);
      const isTitle = block.kind === 'title', bold = block.kind === 'heading';
      doc.applyCharFormat(0, p, 0, doc.getParagraphLength(0, p), charFormat(isTitle ? PLAN_FORMAT.titleSize : bodySize, bold, isTitle));
      bindFont(doc.getCharPropertiesAt(0, p, 0), isTitle ? fonts.title : bold ? fonts.bodyBold : fonts.body);
      const hang = block.marker ? markerHang(block.marker, bodySize) : 0;
      doc.applyParaFormat(0, p, JSON.stringify({
        alignment: isTitle ? 'center' : 'justify', lineSpacing: isTitle ? 130 : PLAN_FORMAT.lineSpacing, lineSpacingType: 'Percent',
        // rhwp/한글 내어쓰기: 첫 줄은 왼쪽 여백에서, 둘째 줄부터 |indent|만큼 더 들어간다.
        marginLeft: para(isTitle ? 0 : levelIndent(block.level, bodySize)), indent: para(-hang), marginRight: 0, koreanBreakUnit: 0,
        spacingBefore: para(block.kind === 'heading' && index > 1 ? 600 : 0), spacingAfter: para(isTitle ? 1600 : 200),
        keepWithNext: block.kind !== 'body', keepLines: true,
        pageBreakBefore: pages === 2 && block.kind === 'heading' && block.text.endsWith('세부추진 일정(안)'),
      }));
    } else {
      const t = JSON.parse(doc.createTableEx(JSON.stringify({ sectionIdx: 0, paraIdx: p, charOffset: 0, rowCount: block.rows.length, colCount: block.widths.length, colWidths: block.widths, treatAsChar: true })));
      doc.applyParaFormat(0, p, JSON.stringify({ alignment: 'center', marginLeft: 0, indent: 0, spacingAfter: para(400), keepWithNext: false, pageBreakBefore: false }));
      doc.setTableProperties(0, t.paraIdx, t.controlIdx, JSON.stringify({ repeatHeader: true, pageBreak: 2, outerLeft: 0, outerRight: 0, outerTop: 0, outerBottom: 200 }));
      block.rows.forEach((row, ri) => row.forEach((text, ci) => {
        expected.push(text);
        const cell = ri * row.length + ci;
        doc.insertTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, text);
        doc.applyCharFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, doc.getCellParagraphLength(0, t.paraIdx, t.controlIdx, cell, 0), charFormat(PLAN_FORMAT.tableSize, ri === 0));
        bindFont(doc.getCellCharPropertiesAt(0, t.paraIdx, t.controlIdx, cell, 0, 0), ri === 0 ? fonts.bodyBold : fonts.body);
        doc.applyParaFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, JSON.stringify({ alignment: ri === 0 ? 'center' : block.widths.length === 4 && ci > 0 ? 'right' : 'left', lineSpacing: 130, lineSpacingType: 'Percent', marginLeft: 0, indent: 0, spacingBefore: 0, spacingAfter: 0, keepWithNext: false, pageBreakBefore: false }));
        doc.setCellProperties(0, t.paraIdx, t.controlIdx, cell, JSON.stringify({ paddingLeft: 283, paddingRight: 283, paddingTop: 425, paddingBottom: 425, applyInnerMargin: true, isHeader: ri === 0, verticalAlign: 1, ...(ri === 0 ? { fillType: 'solid', fillColor: '#e6e6e6' } : {}) }));
      }));
    }
  });
  doc.reflowLinesegs();
  const normalize = (text: string) => text.replace(/\s+/g, '');
  const actual = normalize(JSON.parse(doc.getTextFileText()));
  if (expected.some(text => !actual.includes(normalize(text)))) throw new Error('문서 내용 보존 검사에 실패했습니다. 초안을 유지한 채 다시 시도해 주세요.');
  if (doc.pageCount() > pages) throw new Error(`현재 내용을 ${pages}쪽에 담기 어렵습니다. ${pages === 1 ? '2쪽을 선택하거나 ' : ''}본문을 수정해 주세요. 내용과 글자 크기는 자동으로 줄이지 않습니다.`);
}
