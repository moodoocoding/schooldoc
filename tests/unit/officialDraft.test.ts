import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { strFromU8, unzipSync } from 'fflate';
import { item, table, type DraftDocument } from '../../src/features/officialDocument/model';
import { layoutOfficialDocument } from '../../src/features/officialDocument/format';
import { checkOfficialDocument, officialAmount, pageVolumeIssues } from '../../src/features/officialDocument/lint';
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

// 가상 기관·인물·연락처. korean-report-hwpx tests/sample_official.py의 구성을 학교 상황으로 바꾼 것이다.
const draft: DraftDocument = {
  kind: 'draft', organization: '가상초등학교', to: '수신자 참조', title: '2026학년도 가상 독서 주간 운영 안내',
  body: [
    item('독서 주간을 다음과 같이 운영하오니 각 학년에서는 참여 학급을 안내하여 주시기 바랍니다.', [
      item('기간: 2026. 11. 2.(월)∼11. 6.(금)'),
      item('대상: 3∼6학년 학생', [item('학급별 자율 참여'), item('읽기 기록지 제출')]),
    ]),
    item(`예산: ${officialAmount(300000)} 이내에서 활동 재료와 인쇄비로 집행합니다.`),
  ],
  attachments: ['독서 주간 운영 계획 1부.', '읽기 기록지 양식 1부.'],
  sender: '가상초등학교장', recipients: ['교무부장', '각 학년 부장'],
  approval: { drafter: { title: '교사', mark: '★' }, reviewers: [{ title: '교무부장' }, { title: '교감', opinion: true }], approver: { title: '교장' }, coordinators: ['행정실장'] },
  docNo: { issue: '가상초등학교-1234', issueDate: '2026. 10. 20.' },
  contact: { zip: '00000', address: '가상시 가상로 1', homepage: 'school.example', phone: '000-000-0000', fax: '000-000-0001', email: 'teacher@school.example', disclosure: '공개' },
};
const text = (d: DraftDocument) => layoutOfficialDocument(d).flatMap(l => 'text' in l ? [l.text] : []);

describe('기안문 배치', () => {
  test('두문 → 편람 번호 본문 → 붙임 → 끝 → 발신명의 → 수신자 순서', () => {
    expect(text(draft)).toEqual([
      '가상초등학교', '수신  수신자 참조', '제목  2026학년도 가상 독서 주간 운영 안내',
      '1. 독서 주간을 다음과 같이 운영하오니 각 학년에서는 참여 학급을 안내하여 주시기 바랍니다.',
      '가. 기간: 2026. 11. 2.(월)∼11. 6.(금)', '나. 대상: 3∼6학년 학생', '1) 학급별 자율 참여', '2) 읽기 기록지 제출',
      `2. 예산: ${officialAmount(300000)} 이내에서 활동 재료와 인쇄비로 집행합니다.`,
      '붙임  1. 독서 주간 운영 계획 1부.', '2. 읽기 기록지 양식 1부.  끝.',
      '가상초등학교장', '수신자  교무부장, 각 학년 부장',
    ]);
    const approval = layoutOfficialDocument(draft).find(l => l.kind === 'approval');
    expect(approval?.kind === 'approval' && approval.layout.signers).toEqual(['★교사', '교무부장', '교감(의견 있음)', '교장']);
  });
  test('끝 표시는 한 번: 붙임 1개면 붙임 줄 끝, 붙임이 없으면 본문 끝, 표로 끝나면 다음 줄 왼쪽에서(시행규칙 제4조⑤)', () => {
    const one = { ...draft, attachments: ['운영 계획 1부.'] };
    expect(text(one).filter(t => t.includes('끝.'))).toEqual(['붙임  운영 계획 1부.  끝.']);
    const none = { ...draft, attachments: [] };
    expect(text(none).filter(t => t.includes('끝.'))).toEqual([`2. 예산: ${officialAmount(300000)} 이내에서 활동 재료와 인쇄비로 집행합니다.  끝.`]);
    const tableEnd = { ...draft, attachments: [], body: [item('일정을 다음과 같이 안내합니다.'), table([{ label: '구분', width: 24000 }, { label: '기한', width: 24190 }], [['신청', '2026. 10. 31.']])] };
    expect(text(tableEnd).filter(t => t.includes('끝.'))).toEqual(['  끝.']);
  });
});

describe('기안문 HWPX', () => {
  test('별지 제1호서식 글자 모양·두문 아래 가로선·결재란 칸·끝 표시 한 번, 1쪽', () => {
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      const volume = writeOfficialDocument(doc, draft, 1, fonts);
      expect(volume.fills).toHaveLength(1);
      const bytes = checkedHwpxExport(doc);
      const files = unzipSync(bytes), header = strFromU8(files['Contents/header.xml']), section = strFromU8(files['Contents/section0.xml']);
      const hangulFaces = header.match(/<hh:fontface lang="HANGUL"[\s\S]*?<\/hh:fontface>/)![0];
      const faces = new Map([...hangulFaces.matchAll(/<hh:font id="(\d+)" face="([^"]+)"/g)].map(m => [m[1], m[2]]));
      const shapes = [...header.matchAll(/<hh:charPr id="\d+" height="(\d+)"[\s\S]*?<hh:fontRef hangul="(\d+)"/g)].map(m => `${faces.get(m[2])} ${m[1]}`);
      expect(shapes).toEqual(expect.arrayContaining(['HY헤드라인M 2200', 'HY헤드라인M 1800', '휴먼명조 1500', '맑은 고딕 1100']));
      // 결재란 표: 기안자·검토자 2명·결재권자 = 4칸
      expect(section).toMatch(/<hp:tbl[^>]*colCnt="4"/);
      const reopened = new HwpDocument(bytes);
      try {
        const all = JSON.parse(reopened.getTextFileText()) as string;
        expect(all.match(/끝\./g)).toHaveLength(1);
        expect(all).toContain('시행  가상초등학교-1234 (2026. 10. 20.)');
        expect(all).toContain('협조자  행정실장');
        expect(reopened.pageCount()).toBe(1);
      } finally { reopened.free(); }
      mkdirSync('test-results/official-draft', { recursive: true });
      writeFileSync('test-results/official-draft/draft.hwpx', bytes);
    } finally { doc.free(); }
  });
});

describe('기안문 점검과 분량 점검', () => {
  test('필수 항목·수신자·공개 구분을 알리고, 날짜와 붙임 표기를 고친다', () => {
    const messy: DraftDocument = { ...draft, recipients: [], attachments: ['붙임 1. 운영 계획 1부.'], docNo: { issue: '', issueDate: '2026-10-20' }, contact: { ...draft.contact, disclosure: '전체' as never } };
    const { document, issues } = checkOfficialDocument(messy);
    expect(document.kind === 'draft' && [document.attachments, document.docNo.issueDate]).toEqual([['운영 계획 1부.'], '2026. 10. 20.']);
    expect(issues.map(i => [i.where, i.fixed])).toEqual(expect.arrayContaining([['붙임 1', true], ['시행 번호', false], ['수신자', false], ['공개 구분', false], ['시행일', true]]));
    expect(issues).toHaveLength(5);
    expect(checkOfficialDocument(draft).issues).toEqual([]);
  });
  test('본문(강제 쪽 나눔 전) 마지막 쪽이 80%보다 덜 차면 알린다', () => {
    expect(pageVolumeIssues({ fills: [0.46, 0.58], bodyPages: 1 })).toEqual([expect.objectContaining({ where: '1쪽', fixed: false })]);
    expect(pageVolumeIssues({ fills: [0.95, 0.3], bodyPages: 1 })).toEqual([]);
    expect(pageVolumeIssues({ fills: [1, 0.5], bodyPages: 2 })[0].message).toContain('약 50%');
    expect(pageVolumeIssues(undefined)).toEqual([]);
  });
});
