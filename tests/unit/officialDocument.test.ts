import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { strFromU8, unzipSync } from 'fflate';
import { item, itemDepth, note, table, type OfficialDocument } from '../../src/features/officialDocument/model';
import { ATTACHMENT_PROFILE, layoutOfficialDocument, markerHang, officialMarker } from '../../src/features/officialDocument/format';
import { checkedHwpxExport, writeOfficialDocument, type OfficialFonts } from '../../src/features/officialDocument/rhwpWriter';

const assets = 'src/features/officialDocument/assets/';
const read = (name: string) => readFileSync(`${assets}fonts/${name}`);
const gothicBold = read('NanumGothic-Bold.ttf');
const fonts: OfficialFonts = {
  휴먼명조: { regular: read('NanumMyeongjo-Regular.otf'), bold: read('NanumMyeongjo-Bold.otf') },
  HY헤드라인M: { regular: gothicBold, bold: gothicBold },
  '맑은 고딕': { regular: read('NanumGothic-Regular.ttf'), bold: gothicBold },
};
beforeAll(async () => { await init({ module_or_path: readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm') }); });

// 가상의 공문 내용으로 출력 계층만 확인한다.
const shallow: OfficialDocument = {
  kind: 'attachment-plan', title: '가상 연수 운영 계획',
  body: [
    item('목적', [item('교원의 수업 설계 역량을 높이고 연수 결과를 학교 수업에 적용하는 방안을 함께 마련한다.')]),
    item('운영 방법', [item('연수는 두 차례 운영한다.', [item('1차: 사례 공유'), item('2차: 수업 나눔')]), item('사전 설문을 받는다.'), note('일정은 학교 사정에 따라 조정한다.')]),
    item('예산', [table([{ label: '항목', width: 30000 }, { label: '금액', width: 18100, align: 'right' }], [['자료 인쇄', '50,000원']])]),
  ],
};

describe('항목 기호와 배치', () => {
  test('계층이 4단계 미만이면 편람 순서, 4단계 이상이면 □ → ◦ → - → ※', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(level => officialMarker(level, 1, false))).toEqual(['2.', '나.', '2)', '나)', '(2)', '(나)', '②', '㉯']);
    expect([1, 2, 3, 4].map(level => officialMarker(level, 0, true))).toEqual(['□', '◦', '-', '※']);
  });
  test('하 다음 항목은 거, 너 … 순으로 이어 간다', () => {
    expect([13, 14, 15, 28].map(i => officialMarker(2, i, false))).toEqual(['하.', '거.', '너.', '고.']);
  });
  test('계층 깊이는 항목만 세고, 표와 ※ 참고는 번호를 차지하지 않는다', () => {
    expect(itemDepth(shallow.body)).toBe(3);
    const lines = layoutOfficialDocument(shallow);
    expect(lines.map(l => l.kind === 'table' ? `[표 ${l.level}]` : l.text)).toEqual([
      '가상 연수 운영 계획',
      // 항목이 하나뿐인 목적에는 가.를 붙이지 않는다.
      '1. 목적', '교원의 수업 설계 역량을 높이고 연수 결과를 학교 수업에 적용하는 방안을 함께 마련한다.',
      '2. 운영 방법', '가. 연수는 두 차례 운영한다.', '1) 1차: 사례 공유', '2) 2차: 수업 나눔', '나. 사전 설문을 받는다.', '※ 일정은 학교 사정에 따라 조정한다.',
      '3. 예산', '[표 2]',
    ]);
    expect(lines.filter(l => l.kind === 'item' && l.heading).map(l => l.kind !== 'table' && l.text)).toEqual(['1. 목적', '2. 운영 방법', '3. 예산']);
  });
  test('4단계 문서는 같은 트리를 □ ◦ - ※로 펼친다', () => {
    const deep: OfficialDocument = { kind: 'attachment-plan', title: '가상 문서', body: [item('추진 배경', [item('현황', [item('세부', [item('참고')])])])] };
    expect(layoutOfficialDocument(deep).slice(1).map(l => l.kind !== 'table' && l.text)).toEqual(['□ 추진 배경', '◦ 현황', '- 세부', '※ 참고']);
  });
});

describe('rhwp HWPX 출력', () => {
  test('붙임 계획서 서식: 휴먼명조 13pt·장평 100%·자간 0%·줄간격 160%, 제목 HY헤드라인M, A4 여백, 내어쓰기', () => {
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      writeOfficialDocument(doc, shallow, fonts);
      const files = unzipSync(checkedHwpxExport(doc));
      const header = strFromU8(files['Contents/header.xml']), section = strFromU8(files['Contents/section0.xml']);
      const hangulFaces = header.match(/<hh:fontface lang="HANGUL"[\s\S]*?<\/hh:fontface>/)![0];
      const faces = new Map([...hangulFaces.matchAll(/<hh:font id="(\d+)" face="([^"]+)"/g)].map(m => [m[1], m[2]]));
      const charPrs = [...header.matchAll(/<hh:charPr id="(\d+)" height="(\d+)"[\s\S]*?<hh:fontRef hangul="(\d+)"[\s\S]*?<hh:ratio hangul="(\d+)"[\s\S]*?<hh:spacing hangul="(-?\d+)"/g)]
        .map(m => ({ id: m[1], height: Number(m[2]), face: faces.get(m[3]), ratio: Number(m[4]), spacing: Number(m[5]) }));
      const used = new Set([...section.matchAll(/charPrIDRef="(\d+)"/g)].map(m => m[1]));
      const styles = charPrs.filter(c => used.has(c.id) && c.face !== '함초롬바탕');
      expect(styles.some(c => c.face === '휴먼명조' && c.height === 1300)).toBe(true);
      expect(styles.some(c => c.face === 'HY헤드라인M' && c.height === 1600)).toBe(true);
      for (const c of styles) { expect(['휴먼명조', 'HY헤드라인M']).toContain(c.face); expect(c.ratio).toBe(100); expect(c.spacing).toBe(0); }
      expect(header).toMatch(/<hh:lineSpacing type="PERCENT" value="160"/);
      // 실제 공문처럼 한글은 어절 단위로 줄을 나눈다.
      expect(header).toMatch(/breakNonLatinWord="KEEP_WORD"/);
      // 둘째 항목(가.)은 2타 들여 시작하고, 둘째 줄은 내용 첫 글자에 맞춘다. 기호 없는 단독 항목은 내어쓰기 없이 2타만 들인다.
      const hang = markerHang('가.', 1300);
      expect(header).toContain(`<hc:intent value="${-hang}" unit="HWPUNIT"/><hc:left value="1300" unit="HWPUNIT"/>`);
      expect(header).toContain('<hc:intent value="0" unit="HWPUNIT"/><hc:left value="1300" unit="HWPUNIT"/>');
      expect(section).toMatch(/<hp:margin header="2835" footer="2835" gutter="0" left="5669" right="5669" top="4252" bottom="4252"\/>/);
      expect((section.match(/<hp:tbl\b/g) ?? []).length).toBe(1);
    } finally { doc.free(); }
  });
  test('4단계 개조식은 교육부 실측 서식을 본문 크기에 비례해 쓴다(□ HY헤드라인M, ◦·- 휴먼명조, ※ 맑은 고딕)', () => {
    expect(ATTACHMENT_PROFILE.gaejosik.levels.map(l => [l.font, l.size, l.lineSpacing])).toEqual([['HY헤드라인M', 1300, 160], ['휴먼명조', 1300, 160], ['휴먼명조', 1300, 180], ['맑은 고딕', 1050, 160]]);
    // 실측 문서 과반에서 띄운 간격만 쓴다: ◦ 다음 □ 9pt → 13/15 비례 7.5pt, □ 다음 ◦는 붙인다.
    expect(ATTACHMENT_PROFILE.gaejosik.gapBefore('l2', 'l1')).toBe(800);
    expect(ATTACHMENT_PROFILE.gaejosik.gapBefore('l1', 'l2')).toBe(0);
    const deep: OfficialDocument = { kind: 'attachment-plan', title: '가상 개선 보고', body: [item('현황 점검 결과를 공유함', [item('참여 학급 확대 필요', [item('세부 일정 조정', [item('학교 사정 반영')])])]), item('다음 단계를 준비함', [item('설문 실시')])] };
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      writeOfficialDocument(doc, deep, fonts);
      const header = strFromU8(unzipSync(checkedHwpxExport(doc))['Contents/header.xml']);
      const hangulFaces = header.match(/<hh:fontface lang="HANGUL"[\s\S]*?<\/hh:fontface>/)![0];
      const faces = new Map([...hangulFaces.matchAll(/<hh:font id="(\d+)" face="([^"]+)"/g)].map(m => [m[1], m[2]]));
      const shapes = [...header.matchAll(/<hh:charPr id="\d+" height="(\d+)"[\s\S]*?<hh:fontRef hangul="(\d+)"/g)].map(m => `${faces.get(m[2])} ${m[1]}`);
      expect(shapes).toEqual(expect.arrayContaining(['HY헤드라인M 1300', '휴먼명조 1300', '맑은 고딕 1050']));
      expect(header).toMatch(/<hh:lineSpacing type="PERCENT" value="180"/);
    } finally { doc.free(); }
  });
  test('쪽 나눔은 문서 모델의 표시로만 정하고, 실제 조판 결과로 쪽별 채움을 잰다', () => {
    const split = { ...shallow, body: shallow.body.map((n, i) => i === 2 && n.kind === 'item' ? { ...n, pageBreakBefore: true } : n) };
    const again = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      const volume = writeOfficialDocument(again, split, fonts);
      expect(again.pageCount()).toBe(2);
      // 실제 조판 결과로 잰 쪽별 채움: 강제 쪽 나눔 전 본문은 1쪽이다.
      expect(volume.bodyPages).toBe(1);
      expect(volume.fills).toHaveLength(2);
      for (const fill of volume.fills) { expect(fill).toBeGreaterThan(0); expect(fill).toBeLessThan(1); }
    } finally { again.free(); }
  });
});
