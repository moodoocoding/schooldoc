import type { HwpDocument } from '@rhwp/core';
import { isGaejosik, layoutOfficialDocument, levelIndent, lineKey, lineStyle, markerHang, markerScheme, profileOf, tableCells, type LineKey, type TextStyle } from './format';
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
/** 제목과 첫 목차 사이(HWPUNIT, 약 10mm). 제목이 본문에 붙어 보이지 않게 한 줄 남짓 띄운다. */
export const TITLE_GAP = 2800;
const noBorders = { borderLeft: NO_BORDER, borderRight: NO_BORDER, borderTop: NO_BORDER, borderBottom: NO_BORDER };

/** 공문 문서 모델을 rhwp의 편집 가능한 문단과 표로 조판한다. 모델 XML을 직접 쓰지 않는다. */
/** 쪽 수는 막지 않는다. 목표 분량과의 차이는 PageVolume으로 돌려주고 화면에서 알린다(내용·글자 크기를 자동으로 줄이지 않는다). */
export function writeOfficialDocument(doc: HwpDocument, document: OfficialDocument, fonts: OfficialFonts): PageVolume {
  if (!document.title.trim()) throw new Error('문서 제목을 확인해 주세요.');
  const profile = profileOf(document);
  const lines = layoutOfficialDocument(document), gaejosik = isGaejosik(document), scheme = markerScheme(profile, gaejosik);
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
    expected.push(value);
    doc.insertTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, value);
    doc.applyCharFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, doc.getCellParagraphLength(0, t.paraIdx, t.controlIdx, cell, 0), charFormat(textStyle));
    bindFont(doc.getCellCharPropertiesAt(0, t.paraIdx, t.controlIdx, cell, 0, 0), textStyle);
    doc.applyParaFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, JSON.stringify({ alignment, lineSpacing: textStyle.lineSpacing, lineSpacingType: 'Percent', marginLeft: 0, indent: 0, spacingBefore: 0, spacingAfter: 0, keepWithNext: false, pageBreakBefore: false }));
  };
  const createTable = (p: number, rows: number, widths: number[]) => JSON.parse(doc.createTableEx(JSON.stringify({ sectionIdx: 0, paraIdx: p, charOffset: 0, rowCount: rows, colCount: widths.length, colWidths: widths, treatAsChar: true }))) as { paraIdx: number; controlIdx: number };

  doc.deleteText(0, 0, 0, doc.getParagraphLength(0, 0));
  doc.setPageDef(0, JSON.stringify(profile.page));
  let previous: LineKey = 'title';
  const forcedBreaks: number[] = [], keepers: number[] = [], bodies: number[] = [];
  lines.forEach((line, index) => {
    const p = index === 0 ? 0 : doc.getParagraphCount(0);
    if (index > 0) doc.insertParagraph(0, p);
    const key = lineKey(line), gapBefore = index === 0 ? 0 : scheme.gapBefore(previous, key);
    previous = key;
    if (line.kind === 'title') {
      text(p, line.text, profile.title, { alignment: 'center', marginLeft: 0, indent: 0, spacingBefore: 0, spacingAfter: para(TITLE_GAP), keepWithNext: true });
    } else if (line.kind === 'item' || line.kind === 'note') {
      if (line.pageBreakBefore) forcedBreaks.push(p);
      if (line.keepWithNext) keepers.push(p);
      const textStyle = lineStyle(profile, line, gaejosik);
      const left = levelIndent(line.level, profile.indentUnit), hang = markerHang(line.marker, textStyle.size, textStyle.font);
      bodies.push(p);
      text(p, line.text, textStyle, {
        alignment: 'justify',
        // 한글 내어쓰기: 첫 줄은 왼쪽 여백에서, 둘째 줄부터 |indent|만큼 더 들어가 내용 첫 글자에 맞춘다.
        marginLeft: para(left), indent: para(-hang),
        spacingBefore: para(gapBefore), spacingAfter: para(scheme.after), keepWithNext: line.keepWithNext, pageBreakBefore: line.pageBreakBefore,
      });
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
  if (relieveStretchedLines(doc, bodies).length) doc.reflowLinesegs();
  keepHeadingsWithNext(doc, keepers);
  // rhwp 텍스트 내보내기는 일부 기호(◦ 등)를 &#9702; 같은 문자 참조로 돌려준다.
  const decode = (value: string) => value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)));
  const normalize = (value: string) => decode(value).replace(/\s+/g, '');
  const actual = normalize(JSON.parse(doc.getTextFileText()));
  if (expected.some(value => !actual.includes(normalize(value)))) throw new Error('문서 내용 보존 검사에 실패했습니다. 초안을 유지한 채 다시 시도해 주세요.');
  return measurePageVolume(doc, lines.length, forcedBreaks);
}

/** 양쪽 정렬 줄의 빈칸이 보통 빈칸보다 이 비율(글자 크기 대비) 이상 넓어지면 낱말 사이가 벌어져 보인다. */
export const STRETCH_LIMIT = 0.25;
type LayoutRun = { text: string; charX: number[]; paraIdx: number; y: number; fontSize: number };

/**
 * 한글은 어절 단위로 줄을 나누되, 긴 어절이 다음 줄로 넘어가 양쪽 정렬 줄의 빈칸이 크게 벌어진
 * 본문 문단만 글자 단위로 나눈다(한글 기본값과 같은 방식). 실제 조판의 빈칸 폭을 보통 빈칸
 * (같은 글자 크기에서 가장 좁은 빈칸)과 비교한다. 바꾼 문단 번호를 돌려준다.
 */
export function relieveStretchedLines(doc: HwpDocument, bodies: number[]): number[] {
  const body = new Set(bodies), lines = new Map<string, LayoutRun[]>(), lastOf = new Map<number, string>();
  for (let page = 0; page < doc.pageCount(); page++) {
    for (const run of (JSON.parse(doc.getPageTextLayout(page)) as { runs: LayoutRun[] }).runs) {
      if (!body.has(run.paraIdx)) continue;
      const key = `${run.paraIdx}:${page}:${run.y}`;
      lines.set(key, [...(lines.get(key) ?? []), run]);
      lastOf.set(run.paraIdx, key);
    }
  }
  const spaces = (runs: LayoutRun[]) => runs.flatMap(r => [...r.text].flatMap((c, i) => c === ' ' && i + 1 < r.charX.length ? [r.charX[i + 1] - r.charX[i]] : []));
  const normal = new Map<number, number>();
  for (const runs of lines.values()) for (const w of spaces(runs)) normal.set(runs[0].fontSize, Math.min(normal.get(runs[0].fontSize) ?? Infinity, w));
  const stretched = new Set<number>();
  for (const [key, runs] of lines) {
    const p = runs[0].paraIdx, widths = spaces(runs), size = runs[0].fontSize;
    // 마지막 줄은 양쪽 정렬로 늘이지 않는다. 줄 끝 빈칸은 늘지 않으므로 평균에서 뺀다.
    if (key === lastOf.get(p) || widths.length < 2) continue;
    const inner = widths.slice(0, -1), average = inner.reduce((a, b) => a + b, 0) / inner.length;
    if ((average - normal.get(size)!) / size >= STRETCH_LIMIT) stretched.add(p);
  }
  for (const p of stretched) doc.applyParaFormat(0, p, JSON.stringify({ koreanBreakUnit: 1 }));
  return [...stretched];
}

/**
 * 쪽 끝에 홀로 남은 제목을 다음 쪽으로 넘긴다. HWPX에는 '다음 문단과 함께'를 쓰지만
 * rhwp 조판은 이를 따르지 않으므로, 미리보기와 한글 결과가 같도록 쪽 나눔을 직접 넣는다.
 * 제목이 이어지면(4. → 가.) 맨 앞 제목에서 나누고 뒤 제목에 넣었던 나눔은 거둔다.
 */
function keepHeadingsWithNext(doc: HwpDocument, keepers: number[]) {
  const page = (p: number, offset: number) => (JSON.parse(doc.getCursorRect(0, p, offset)) as { pageIndex: number }).pageIndex;
  const broken = new Set<number>();
  const setBreak = (p: number, on: boolean) => { doc.applyParaFormat(0, p, JSON.stringify({ pageBreakBefore: on })); if (on) broken.add(p); else broken.delete(p); };
  const keep = new Set(keepers), skip = new Set<number>();
  for (let round = 0; round < 40; round++) {
    const orphan = keepers.find(p => p > 0 && p + 1 < doc.getParagraphCount(0) && !broken.has(p) && !skip.has(p) && page(p, doc.getParagraphLength(0, p)) < page(p + 1, 0));
    if (orphan === undefined) return;
    let start = orphan;
    while (keep.has(start - 1) && start - 1 > 0 && page(start - 1, 0) === page(orphan, 0)) start--;
    for (let p = start + 1; p <= orphan; p++) if (broken.has(p)) setBreak(p, false);
    // 같은 쪽 맨 위에서 시작하는 제목은 넘겨도 다시 홀로 남으므로 그대로 둔다.
    if (start > 0 && page(start - 1, doc.getParagraphLength(0, start - 1)) === page(start, 0)) { setBreak(start, true); doc.reflowLinesegs(); }
    else skip.add(orphan);
  }
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

