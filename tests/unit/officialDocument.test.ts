import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { strFromU8, unzipSync } from 'fflate';
import { item, itemDepth, note, table, type OfficialDocument } from '../../src/features/officialDocument/model';
import { layoutOfficialDocument, markerHang, officialMarker } from '../../src/features/officialDocument/format';
import { checkedHwpxExport, writeOfficialDocument, type OfficialFonts } from '../../src/features/officialDocument/rhwpWriter';

const assets = 'src/features/officialDocument/assets/';
const fonts: OfficialFonts = { body: readFileSync(`${assets}fonts/NanumMyeongjo-Regular.otf`), bodyBold: readFileSync(`${assets}fonts/NanumMyeongjo-Bold.otf`), title: readFileSync(`${assets}fonts/NanumGothic-Bold.ttf`) };
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
    expect([1, 2, 3, 4, 5, 6].map(level => officialMarker(level, 1, 3))).toEqual(['2.', '나.', '2)', '나)', '(2)', '(나)']);
    expect([1, 2, 3, 4].map(level => officialMarker(level, 0, 4))).toEqual(['□', '◦', '-', '※']);
  });
  test('하 다음 항목은 거, 너 … 순으로 이어 간다', () => {
    expect([13, 14, 15, 28].map(i => officialMarker(2, i, 2))).toEqual(['하.', '거.', '너.', '고.']);
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
      writeOfficialDocument(doc, shallow, 1, fonts);
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
  test('쪽 나눔은 문서 모델의 표시로만 정하고, 쪽 수를 넘으면 내용을 줄이지 않고 거부한다', () => {
    const split = { ...shallow, body: shallow.body.map((n, i) => i === 2 && n.kind === 'item' ? { ...n, pageBreakBefore: true } : n) };
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      expect(() => writeOfficialDocument(doc, split, 1, fonts)).toThrow(/1쪽에 담기 어렵습니다/);
    } finally { doc.free(); }
    const again = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      writeOfficialDocument(again, split, 2, fonts);
      expect(again.pageCount()).toBe(2);
    } finally { again.free(); }
  });
});
