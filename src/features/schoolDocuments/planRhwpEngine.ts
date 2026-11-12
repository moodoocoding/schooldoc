import type { HwpDocument } from '@rhwp/core';
import { planBudgetTotal, type PlanDraft } from '../../../supabase/functions/_shared/schoolPlan';

export const PLAN_FONT = '나눔고딕';
export type PlanBlock = { kind: 'title' | 'heading' | 'body'; text: string } | { kind: 'table'; rows: string[][]; widths: number[] };
export interface PlanDocument { bytes: Uint8Array<ArrayBuffer>; svgs: string[]; pageCount: number }
export function planDocumentBlocks(draft: PlanDraft, title: string): PlanBlock[] {
  if (!title.trim() || title.length > 100 || [...title].some(c => c.charCodeAt(0) < 32)) throw new Error('문서 제목을 100자 이내로 확인해 주세요.');
  const blocks: PlanBlock[] = [
    { kind: 'title', text: `[초안] ${title.trim()}` },
    { kind: 'body', text: 'AI 작성 초안 · 일정·담당·단가와 학교 확인 사항 검토 후 사용' },
  ];
  draft.sections.forEach((section, i) => {
    blocks.push({ kind: 'heading', text: `${i + 1}. ${section.heading}` });
    section.paragraphs.forEach((text, j) => blocks.push({ kind: 'body', text: `${['가', '나', '다', '라'][j] ?? j + 1}. ${text}` }));
  });
  blocks.push({ kind: 'heading', text: `${draft.sections.length + 1}. 세부추진 일정안` });
  if (draft.schedule.length) blocks.push({ kind: 'table', widths: [9600, 26300, 12200], rows: [['시기', '활동', '담당'], ...draft.schedule.map(s => [s.when, s.activity, s.owner])] });
  blocks.push({ kind: 'heading', text: `${draft.sections.length + 2}. 예산안` });
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
  if (draft.budget.length) {
    blocks.push({ kind: 'table', widths: [20500, 10000, 6500, 11100], rows: [['항목', '단가', '수량', '금액'], ...draft.budget.map(b => [b.item, won(b.unitPrice), String(b.quantity), won(b.unitPrice * b.quantity)])] });
    blocks.push({ kind: 'body', text: `합계 ${won(planBudgetTotal(draft))} · 단가와 배분은 제안이며 집행 기준·실제 견적 확인 필요` });
  } else blocks.push({ kind: 'body', text: '예산 없음 또는 미정: 금액 확정 후 집행 기준에 따라 확인' });
  if (draft.unknowns.length) {
    blocks.push({ kind: 'heading', text: '학교 확인 사항' });
    draft.unknowns.forEach(text => blocks.push({ kind: 'body', text: `※ ${text}` }));
  }
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

/** Creates editable paragraphs and native tables through rhwp, never raw model XML. */
export function buildPlanDocument(doc: HwpDocument, draft: PlanDraft, title: string, pages: 1 | 2, fonts: [Uint8Array, Uint8Array]) {
  const blocks = planDocumentBlocks(draft, title);
  const fontIds = Array.from({ length: 7 }, (_, lang) => doc.findOrCreateFontIdForLang(lang, PLAN_FONT));
  const registered = new Set<number>();
  const bindFont = (properties: string, bold: boolean) => {
    const id = JSON.parse(properties).charShapeId as number;
    if (registered.has(id)) return;
    for (let lang = 0; lang < 7; lang++) doc.registerExactFontSource(id, lang, fonts[bold ? 1 : 0], 0);
    registered.add(id);
  };
  doc.deleteText(0, 0, 0, doc.getParagraphLength(0, 0));
  doc.setPageDef(0, JSON.stringify({ width: 59528, height: 84186, marginLeft: 5669, marginRight: 5669, marginTop: 4252, marginBottom: 4252, marginHeader: 0, marginFooter: 0 }));
  const expected: string[] = [];
  blocks.forEach((block, index) => {
    const p = index === 0 ? 0 : doc.getParagraphCount(0);
    if (index > 0) doc.insertParagraph(0, p);
    if (block.kind !== 'table') {
      expected.push(block.text);
      doc.insertText(0, p, 0, block.text);
      const bold = block.kind !== 'body';
      doc.applyCharFormat(0, p, 0, doc.getParagraphLength(0, p), JSON.stringify({ fontIds, fontSize: block.kind === 'title' ? 1800 : block.kind === 'heading' ? 1300 : 1200, bold }));
      bindFont(doc.getCharPropertiesAt(0, p, 0), bold);
      doc.applyParaFormat(0, p, JSON.stringify({ alignment: block.kind === 'title' ? 'center' : 'left', lineSpacing: 130, lineSpacingType: 'Percent', spacingAfter: block.kind === 'heading' ? 500 : 220, spacingBefore: block.kind === 'heading' ? 400 : 0, keepWithNext: block.kind !== 'body', keepLines: true, pageBreakBefore: pages === 2 && block.kind === 'heading' && block.text.endsWith('세부추진 일정안') }));
    } else {
      const t = JSON.parse(doc.createTableEx(JSON.stringify({ sectionIdx: 0, paraIdx: p, charOffset: 0, rowCount: block.rows.length, colCount: block.widths.length, colWidths: block.widths, treatAsChar: true })));
      doc.applyParaFormat(0, p, JSON.stringify({ alignment: 'left', spacingAfter: 400, keepWithNext: false, pageBreakBefore: false }));
      doc.setTableProperties(0, t.paraIdx, t.controlIdx, JSON.stringify({ repeatHeader: true, pageBreak: 2, outerLeft: 0, outerRight: 0, outerTop: 0, outerBottom: 200 }));
      block.rows.forEach((row, ri) => row.forEach((text, ci) => {
        expected.push(text);
        const cell = ri * row.length + ci;
        doc.insertTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, text);
        doc.applyCharFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, doc.getCellParagraphLength(0, t.paraIdx, t.controlIdx, cell, 0), JSON.stringify({ fontIds, fontSize: 1200, bold: ri === 0 }));
        bindFont(doc.getCellCharPropertiesAt(0, t.paraIdx, t.controlIdx, cell, 0, 0), ri === 0);
        doc.applyParaFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, JSON.stringify({ alignment: ri === 0 ? 'center' : block.widths.length === 4 && ci > 0 ? 'right' : 'left', lineSpacing: 130, spacingBefore: 0, spacingAfter: 0, keepWithNext: false, pageBreakBefore: false }));
        doc.setCellProperties(0, t.paraIdx, t.controlIdx, cell, JSON.stringify({ paddingLeft: 400, paddingRight: 400, paddingTop: 240, paddingBottom: 240, applyInnerMargin: true, isHeader: ri === 0, verticalAlign: 1, ...(ri === 0 ? { fillType: 'solid', fillColor: '#edf2f7' } : {}) }));
      }));
    }
  });
  doc.reflowLinesegs();
  const normalize = (text: string) => text.replace(/\s+/g, '');
  const actual = normalize(JSON.parse(doc.getTextFileText()));
  if (expected.some(text => !actual.includes(normalize(text)))) throw new Error('문서 내용 보존 검사에 실패했습니다. 초안을 유지한 채 다시 시도해 주세요.');
  if (doc.pageCount() > pages) throw new Error(`현재 내용을 ${pages}쪽에 담기 어렵습니다. ${pages === 1 ? '2쪽을 선택하거나 ' : ''}본문을 수정해 주세요. 내용과 글자 크기는 자동으로 줄이지 않습니다.`);
}
