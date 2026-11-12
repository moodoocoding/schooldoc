import type { HwpDocument } from '@rhwp/core';
import { isGaejosik, layoutOfficialDocument, levelIndent, lineKey, lineStyle, markerHang, markerScheme, profileOf, tableCells, type ApprovalLayout, type LineKey, type TextStyle } from './format';
import type { OfficialDocument } from './model';

/** 글꼴 이름별 조판·미리보기용 대체 글꼴 바이트. */
export type OfficialFonts = Record<string, { regular: Uint8Array; bold: Uint8Array }>;
/** 쪽별 본문 영역 채움 비율(0~1)과, 강제 쪽 나눔 전까지의 본문 쪽 수. */
export interface PageVolume { fills: number[]; bodyPages: number }
export interface RenderedDocument { bytes: Uint8Array<ArrayBuffer>; svgs: string[]; pageCount: number; volume?: PageVolume }

export function checkedHwpxExport(doc: HwpDocument): Uint8Array<ArrayBuffer> {
  const result = doc.exportHwpxWithReport();
  try {
    const report = JSON.parse(result.contentLoss());
    if (report.count !== 0 || !Array.isArray(report.losses) || report.losses.length) throw new Error('문서의 일부 내용을 보존할 수 없습니다. 원본을 한글에서 HWPX로 저장하거나 본문을 붙여 넣어 주세요.');
    return new Uint8Array(result.takeBytes());
  } finally { result.free(); }
}

// rhwp 문단 JSON은 HWP 5 단위(HWPUNIT의 2배)를, 글자·쪽 JSON은 HWPUNIT을 받는다.
const para = (hwpunit: number) => hwpunit * 2;
const seven = <T,>(value: T) => Array.from({ length: 7 }, () => value);
const NO_BORDER = { type: 0, width: 0, color: '#000000' };
const noBorders = { borderLeft: NO_BORDER, borderRight: NO_BORDER, borderTop: NO_BORDER, borderBottom: NO_BORDER };
const THIN_LINE = { type: 1, width: 1, color: '#000000' };

/** 공문 문서 모델을 rhwp의 편집 가능한 문단과 표로 조판한다. 모델 XML을 직접 쓰지 않는다. */
export function writeOfficialDocument(doc: HwpDocument, document: OfficialDocument, maxPages: number, fonts: OfficialFonts): PageVolume {
  if (!document.title.trim()) throw new Error('문서 제목을 확인해 주세요.');
  const profile = profileOf(document);
  const lines = layoutOfficialDocument(document), gaejosik = isGaejosik(document), scheme = markerScheme(profile, gaejosik);
  const bodyWidth = profile.page.width - profile.page.marginLeft - profile.page.marginRight;
  const fontIdCache = new Map<string, number[]>();
  const fontIds = (face: string) => {
    if (!fontIdCache.has(face)) fontIdCache.set(face, Array.from({ length: 7 }, (_, lang) => doc.findOrCreateFontIdForLang(lang, face)));
    return fontIdCache.get(face)!;
  };
  const registered = new Set<number>();
  // 한컴·MS 글꼴은 배포할 수 없다. 파일에는 원래 글꼴 이름을 쓰고, OFL 대체 글꼴은 조판·미리보기에만 쓴다.
  const bindFont = (properties: string, textStyle: TextStyle) => {
    const id = JSON.parse(properties).charShapeId as number;
    const source = fonts[textStyle.font];
    if (registered.has(id) || !source) return;
    for (let lang = 0; lang < 7; lang++) doc.registerExactFontSource(id, lang, textStyle.bold ? source.bold : source.regular, 0);
    registered.add(id);
  };
  const charFormat = (textStyle: TextStyle) => JSON.stringify({ fontIds: fontIds(textStyle.font), fontSize: textStyle.size, bold: textStyle.bold, ratios: seven(profile.ratio), spacings: seven(profile.spacing) });
  const expected: string[] = [];
  const text = (p: number, value: string, textStyle: TextStyle, paragraph: Record<string, unknown>) => {
    expected.push(value);
    doc.insertText(0, p, 0, value);
    doc.applyCharFormat(0, p, 0, doc.getParagraphLength(0, p), charFormat(textStyle));
    bindFont(doc.getCharPropertiesAt(0, p, 0), textStyle);
    // 새 문단은 앞 문단의 테두리를 물려받으므로 테두리 없음을 명시한다.
    doc.applyParaFormat(0, p, JSON.stringify({ lineSpacing: textStyle.lineSpacing, lineSpacingType: 'Percent', marginRight: 0, koreanBreakUnit: 0, keepLines: true, pageBreakBefore: false, keepWithNext: false, ...noBorders, borderSpacing: [0, 0, 0, 0], ...paragraph }));
  };
  const cellText = (t: { paraIdx: number; controlIdx: number }, cell: number, value: string, textStyle: TextStyle, alignment: string) => {
    if (value) { expected.push(value); doc.insertTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, value); }
    doc.applyCharFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, doc.getCellParagraphLength(0, t.paraIdx, t.controlIdx, cell, 0), charFormat(textStyle));
    if (value) bindFont(doc.getCellCharPropertiesAt(0, t.paraIdx, t.controlIdx, cell, 0, 0), textStyle);
    doc.applyParaFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, JSON.stringify({ alignment, lineSpacing: textStyle.lineSpacing, lineSpacingType: 'Percent', marginLeft: 0, indent: 0, spacingBefore: 0, spacingAfter: 0, keepWithNext: false, pageBreakBefore: false }));
  };
  const createTable = (p: number, rows: number, widths: number[]) => JSON.parse(doc.createTableEx(JSON.stringify({ sectionIdx: 0, paraIdx: p, charOffset: 0, rowCount: rows, colCount: widths.length, colWidths: widths, treatAsChar: true }))) as { paraIdx: number; controlIdx: number };

  /** 별지 제1호서식 결문 틀: 회색 띠 → 결재란(직위·서명) → 협조자 → 시행·접수 → 주소 → 연락처·공개 구분, 칸 선 없이 아래 가로선만. */
  const approval = (p: number, layout: ApprovalLayout) => {
    const d = profile.draft!, k = Math.max(1, layout.signers.length), unit = Math.floor(bodyWidth / k);
    const widths = Array.from({ length: k }, (_, i) => i < k - 1 ? unit : bodyWidth - unit * (k - 1));
    const rows: (string | string[])[] = ['', layout.signers, layout.coordinators, layout.receive ? [layout.issue, layout.receive] : layout.issue, layout.address, layout.contact];
    const t = createTable(p, rows.length, widths);
    doc.applyParaFormat(0, p, JSON.stringify({ alignment: 'center', marginLeft: 0, indent: 0, spacingBefore: 0, spacingAfter: 0, keepWithNext: false, pageBreakBefore: false, ...noBorders }));
    doc.setTableProperties(0, t.paraIdx, t.controlIdx, JSON.stringify({ outerLeft: 0, outerRight: 0, outerTop: 0, outerBottom: 0 }));
    const half = Math.max(1, Math.floor(k / 2));
    rows.forEach((row, ri) => {
      for (let ci = 0; ci < k; ci++) {
        const cell = ri * k + ci;
        const value = Array.isArray(row) ? (row.length === k ? row[ci] : ci === 0 ? row[0] : ci === half ? row[1] : '') : ci === 0 ? row : '';
        // 맨 위 회색 띠는 1pt 빈 줄로 얇게 둔다.
        cellText(t, cell, value, ri === 0 ? { ...d.footer, size: 100, lineSpacing: 100 } : ri === 1 ? d.approval : d.footer, 'left');
        doc.setCellProperties(0, t.paraIdx, t.controlIdx, cell, JSON.stringify({
          ...noBorders, ...(ri === rows.length - 1 ? { borderBottom: THIN_LINE } : {}),
          paddingLeft: 283, paddingRight: 283, paddingTop: ri === 0 ? 0 : 140, paddingBottom: ri === 0 ? 0 : 140, applyInnerMargin: true, verticalAlign: 1,
          ...(ri === 0 ? { fillType: 'solid', fillColor: d.barFill } : {}),
        }));
      }
    });
    // 칸 합치기는 아래 줄부터 해서 위 줄의 칸 번호가 바뀌지 않게 한다. 결재란(1줄)만 사람별 칸을 유지한다.
    for (let ri = rows.length - 1; ri >= 0; ri--) {
      if (ri === 1 || k === 1) continue;
      if (Array.isArray(rows[ri])) {
        doc.mergeTableCells(0, t.paraIdx, t.controlIdx, ri, half, ri, k - 1);
        if (half > 1) doc.mergeTableCells(0, t.paraIdx, t.controlIdx, ri, 0, ri, half - 1);
      } else doc.mergeTableCells(0, t.paraIdx, t.controlIdx, ri, 0, ri, k - 1);
    }
  };

  /** 별지 제1호서식 두문 아래 가로선: 아래 변만 있는 1칸 표(문단 테두리는 미리보기에 그려지지 않아 표로 둔다). */
  const horizontalRule = (p: number) => {
    doc.insertParagraph(0, p);
    const t = createTable(p, 1, [bodyWidth]);
    doc.applyParaFormat(0, p, JSON.stringify({ alignment: 'center', marginLeft: 0, indent: 0, spacingBefore: 0, spacingAfter: para(profile.draft!.headAfter), keepWithNext: true, pageBreakBefore: false, ...noBorders }));
    doc.setTableProperties(0, t.paraIdx, t.controlIdx, JSON.stringify({ outerLeft: 0, outerRight: 0, outerTop: 0, outerBottom: 0 }));
    cellText(t, 0, '', { ...profile.draft!.footer, size: 100, lineSpacing: 100 }, 'left');
    doc.setCellProperties(0, t.paraIdx, t.controlIdx, 0, JSON.stringify({ ...noBorders, borderBottom: THIN_LINE, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0, applyInnerMargin: true }));
  };

  doc.deleteText(0, 0, 0, doc.getParagraphLength(0, 0));
  doc.setPageDef(0, JSON.stringify(profile.page));
  let previous: LineKey = 'title';
  const forcedBreaks: number[] = [];
  lines.forEach((line, index) => {
    const p = index === 0 ? 0 : doc.getParagraphCount(0);
    if (index > 0) doc.insertParagraph(0, p);
    const key = lineKey(line), gapBefore = index === 0 || key === 'draft' ? 0 : scheme.gapBefore(previous, key);
    previous = key;
    if (line.kind === 'title') {
      text(p, line.text, profile.title, { alignment: 'center', marginLeft: 0, indent: 0, spacingBefore: 0, spacingAfter: para(1600), keepWithNext: true });
    } else if (line.kind === 'item' || line.kind === 'note') {
      if (line.pageBreakBefore) forcedBreaks.push(p);
      const textStyle = lineStyle(profile, line, gaejosik);
      text(p, line.text, textStyle, {
        alignment: 'justify',
        // 한글 내어쓰기: 첫 줄은 왼쪽 여백에서, 둘째 줄부터 |indent|만큼 더 들어가 내용 첫 글자에 맞춘다.
        marginLeft: para(levelIndent(line.level, profile.indentUnit)), indent: para(-markerHang(line.marker, textStyle.size, textStyle.font)),
        spacingBefore: para(gapBefore), spacingAfter: para(scheme.after), keepWithNext: line.heading, pageBreakBefore: line.pageBreakBefore,
      });
    } else if (line.kind === 'draft') {
      const d = profile.draft!, textStyle = lineStyle(profile, line, false);
      text(p, line.text, textStyle, {
        alignment: line.role === 'organization' || line.role === 'sender' ? 'center' : 'justify', marginLeft: para(line.left), indent: para(-line.hang),
        spacingBefore: para(line.role === 'sender' ? d.senderBefore : line.spaceBefore ? d.attachmentsBefore : 0),
        spacingAfter: para(line.role === 'organization' ? d.organizationAfter : line.role === 'title' ? 0 : line.role === 'sender' ? d.senderAfter : scheme.after),
        keepWithNext: line.role === 'organization' || line.role === 'to' || line.role === 'via' || line.role === 'title' || line.role === 'sender',
      });
      if (line.role === 'title') horizontalRule(doc.getParagraphCount(0));
    } else if (line.kind === 'approval') {
      approval(p, line.layout);
    } else if (line.kind === 'table') {
      const cells = tableCells(line), widths = line.columns.map(c => c.width);
      const t = createTable(p, cells.length, widths);
      doc.applyParaFormat(0, p, JSON.stringify({ alignment: 'center', marginLeft: 0, indent: 0, spacingBefore: para(gapBefore), spacingAfter: para(scheme.tableAfter), keepWithNext: false, pageBreakBefore: false, ...noBorders }));
      doc.setTableProperties(0, t.paraIdx, t.controlIdx, JSON.stringify({ repeatHeader: true, pageBreak: 2, outerLeft: 0, outerRight: 0, outerTop: 0, outerBottom: 200 }));
      cells.forEach((row, ri) => row.forEach((value, ci) => {
        const cell = ri * row.length + ci;
        cellText(t, cell, value, ri === 0 ? profile.table.head : profile.table.body, ri === 0 ? 'center' : line.columns[ci].align ?? 'left');
        // 칸 안 여백: 좌우 1mm, 위아래 1.5mm. 머리행은 바탕색을 칠한다.
        doc.setCellProperties(0, t.paraIdx, t.controlIdx, cell, JSON.stringify({ paddingLeft: 283, paddingRight: 283, paddingTop: 425, paddingBottom: 425, applyInnerMargin: true, isHeader: ri === 0, verticalAlign: 1, ...(ri === 0 ? { fillType: 'solid', fillColor: profile.table.head.fill } : {}) }));
      }));
    }
  });
  doc.reflowLinesegs();
  // rhwp 텍스트 내보내기는 일부 기호(◦ 등)를 &#9702; 같은 문자 참조로 돌려준다.
  const decode = (value: string) => value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)));
  const normalize = (value: string) => decode(value).replace(/\s+/g, '');
  const actual = normalize(JSON.parse(doc.getTextFileText()));
  if (expected.some(value => !actual.includes(normalize(value)))) throw new Error('문서 내용 보존 검사에 실패했습니다. 초안을 유지한 채 다시 시도해 주세요.');
  if (doc.pageCount() > maxPages) throw new Error(`현재 내용을 ${maxPages}쪽에 담기 어렵습니다. ${maxPages === 1 ? '2쪽을 선택하거나 ' : ''}본문을 수정해 주세요. 내용과 글자 크기는 자동으로 줄이지 않습니다.`);
  return measurePageVolume(doc, lines.length, forcedBreaks);
}

/**
 * 실제 조판 결과로 쪽별 채움을 잰다. 각 문단 끝 좌표의 가장 아래를 본문 영역 높이로 나눈다.
 * (korean-report-hwpx engine/pages.py는 한글 배치를 흉내 내 예측하지만, rhwp는 실제 배치를 알려 준다.)
 */
export function measurePageVolume(doc: HwpDocument, paragraphs: number, forcedBreaks: number[]): PageVolume {
  const pages = doc.pageCount(), bottoms = Array.from({ length: pages }, () => 0);
  const info = JSON.parse(doc.getPageInfo(0)) as { headerArea: { y: number; height: number }; footerArea: { y: number } };
  const top = info.headerArea.y + info.headerArea.height, height = info.footerArea.y - top;
  for (let p = 0; p < Math.min(paragraphs, doc.getParagraphCount(0)); p++) {
    const rect = JSON.parse(doc.getCursorRect(0, p, doc.getParagraphLength(0, p))) as { pageIndex: number; y: number; height: number };
    if (rect.pageIndex >= 0 && rect.pageIndex < pages) bottoms[rect.pageIndex] = Math.max(bottoms[rect.pageIndex], rect.y + rect.height);
  }
  const firstBreak = forcedBreaks.length ? (JSON.parse(doc.getCursorRect(0, forcedBreaks[0], 0)) as { pageIndex: number }).pageIndex : pages;
  return { fills: bottoms.map(b => Math.max(0, Math.min(1, Math.round(((b - top) / height) * 100) / 100))), bodyPages: Math.max(1, firstBreak) };
}

