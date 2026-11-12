import type { HwpDocument } from '@rhwp/core';
import { OFFICIAL_DOCUMENT_KINDS, layoutOfficialDocument, levelIndent, lineKey, lineStyle, markerHang, markerScheme, tableCells, type LineKey, type TextStyle } from './format';
import { itemDepth, type OfficialDocument } from './model';

/** 글꼴 이름별 조판·미리보기용 대체 글꼴 바이트. */
export type OfficialFonts = Record<string, { regular: Uint8Array; bold: Uint8Array }>;
export interface RenderedDocument { bytes: Uint8Array<ArrayBuffer>; svgs: string[]; pageCount: number }

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

/** 공문 문서 모델을 rhwp의 편집 가능한 문단과 표로 조판한다. 모델 XML을 직접 쓰지 않는다. */
export function writeOfficialDocument(doc: HwpDocument, document: OfficialDocument, maxPages: number, fonts: OfficialFonts) {
  if (!document.title.trim()) throw new Error('문서 제목을 확인해 주세요.');
  const profile = OFFICIAL_DOCUMENT_KINDS[document.kind].profile;
  const lines = layoutOfficialDocument(document), depth = itemDepth(document.body), scheme = markerScheme(profile, depth);
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
  doc.deleteText(0, 0, 0, doc.getParagraphLength(0, 0));
  doc.setPageDef(0, JSON.stringify(profile.page));
  const expected: string[] = [];
  let previous: LineKey = 'title';
  lines.forEach((line, index) => {
    const p = index === 0 ? 0 : doc.getParagraphCount(0);
    if (index > 0) doc.insertParagraph(0, p);
    const key = lineKey(line), gapBefore = index === 0 ? 0 : scheme.gapBefore(previous, key);
    previous = key;
    if (line.kind !== 'table') {
      expected.push(line.text);
      doc.insertText(0, p, 0, line.text);
      const textStyle = lineStyle(profile, line, depth);
      doc.applyCharFormat(0, p, 0, doc.getParagraphLength(0, p), charFormat(textStyle));
      bindFont(doc.getCharPropertiesAt(0, p, 0), textStyle);
      doc.applyParaFormat(0, p, JSON.stringify(line.kind === 'title'
        ? { alignment: 'center', lineSpacing: textStyle.lineSpacing, lineSpacingType: 'Percent', marginLeft: 0, indent: 0, marginRight: 0, spacingBefore: 0, spacingAfter: para(1600), keepWithNext: true, keepLines: true, koreanBreakUnit: 0, pageBreakBefore: false }
        : {
          alignment: 'justify', lineSpacing: textStyle.lineSpacing, lineSpacingType: 'Percent',
          // 한글 내어쓰기: 첫 줄은 왼쪽 여백에서, 둘째 줄부터 |indent|만큼 더 들어가 내용 첫 글자에 맞춘다.
          marginLeft: para(levelIndent(line.level, profile.indentUnit)), indent: para(-markerHang(line.marker, textStyle.size, textStyle.font)), marginRight: 0, koreanBreakUnit: 0,
          spacingBefore: para(gapBefore), spacingAfter: para(scheme.after),
          keepWithNext: line.heading, keepLines: true, pageBreakBefore: line.pageBreakBefore,
        }));
    } else {
      const cells = tableCells(line), widths = line.columns.map(c => c.width);
      const t = JSON.parse(doc.createTableEx(JSON.stringify({ sectionIdx: 0, paraIdx: p, charOffset: 0, rowCount: cells.length, colCount: widths.length, colWidths: widths, treatAsChar: true })));
      doc.applyParaFormat(0, p, JSON.stringify({ alignment: 'center', marginLeft: 0, indent: 0, spacingBefore: para(gapBefore), spacingAfter: para(scheme.tableAfter), keepWithNext: false, pageBreakBefore: false }));
      doc.setTableProperties(0, t.paraIdx, t.controlIdx, JSON.stringify({ repeatHeader: true, pageBreak: 2, outerLeft: 0, outerRight: 0, outerTop: 0, outerBottom: 200 }));
      cells.forEach((row, ri) => row.forEach((text, ci) => {
        expected.push(text);
        const cell = ri * row.length + ci, textStyle = ri === 0 ? profile.table.head : profile.table.body;
        doc.insertTextInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, text);
        doc.applyCharFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, 0, doc.getCellParagraphLength(0, t.paraIdx, t.controlIdx, cell, 0), charFormat(textStyle));
        bindFont(doc.getCellCharPropertiesAt(0, t.paraIdx, t.controlIdx, cell, 0, 0), textStyle);
        doc.applyParaFormatInCell(0, t.paraIdx, t.controlIdx, cell, 0, JSON.stringify({ alignment: ri === 0 ? 'center' : line.columns[ci].align ?? 'left', lineSpacing: textStyle.lineSpacing, lineSpacingType: 'Percent', marginLeft: 0, indent: 0, spacingBefore: 0, spacingAfter: 0, keepWithNext: false, pageBreakBefore: false }));
        // 칸 안 여백: 좌우 1mm, 위아래 1.5mm. 머리행은 바탕색을 칠한다.
        doc.setCellProperties(0, t.paraIdx, t.controlIdx, cell, JSON.stringify({ paddingLeft: 283, paddingRight: 283, paddingTop: 425, paddingBottom: 425, applyInnerMargin: true, isHeader: ri === 0, verticalAlign: 1, ...(ri === 0 ? { fillType: 'solid', fillColor: profile.table.head.fill } : {}) }));
      }));
    }
  });
  doc.reflowLinesegs();
  // rhwp 텍스트 내보내기는 일부 기호(◦ 등)를 &#9702; 같은 문자 참조로 돌려준다.
  const decode = (text: string) => text.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)));
  const normalize = (text: string) => decode(text).replace(/\s+/g, '');
  const actual = normalize(JSON.parse(doc.getTextFileText()));
  if (expected.some(text => !actual.includes(normalize(text)))) throw new Error('문서 내용 보존 검사에 실패했습니다. 초안을 유지한 채 다시 시도해 주세요.');
  if (doc.pageCount() > maxPages) throw new Error(`현재 내용을 ${maxPages}쪽에 담기 어렵습니다. ${maxPages === 1 ? '2쪽을 선택하거나 ' : ''}본문을 수정해 주세요. 내용과 글자 크기는 자동으로 줄이지 않습니다.`);
}
