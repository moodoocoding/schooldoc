import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authenticateStudentResult,
  confirmStudentResult,
  createStudentResultEvent,
  disputeStudentResult,
  getStudentResultEvent,
  listStudentResultEvents,
  regenerateStudentResultPersonalToken,
  replyToStudentDispute,
  authenticateStudentResultByToken,
} from '../../src/features/studentResults/studentResultsStore';
import { getStudentResultValidationIssue, paginateStudentResultRecipients, validateStudentResultDraft } from '../../src/features/studentResults/studentResultsUtils';
import type { StudentResultDraft } from '../../src/features/studentResults/types';
import {
  analyzeStudentResultRows,
  findPossibleStudentResultNonParticipants,
  reconstructStudentResultPdfRows,
} from '../../src/features/studentResults/studentResultsImport';

const memory = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() { return memory.size; },
};

const windowStub = new EventTarget();

const draft: StudentResultDraft = {
  title: '2학기 수행평가 결과',
  description: '결과를 확인해 주세요.',
  allowConfirmation: true,
  allowDispute: true,
  columns: [{ id: 'score', label: '발표', maxScore: 10, description: '' }],
  recipients: [{
    studentKey: '10101',
    name: '김하늘',
    verificationCode: '4821',
    values: { score: 9 },
    feedback: '준비가 충실합니다.',
  }],
};

beforeEach(() => {
  memory.clear();
  vi.stubGlobal('localStorage', localStorageStub);
  vi.stubGlobal('window', windowStub);
});

describe('학생 결과 안내 로컬 흐름', () => {
  it('교사별 목록과 상세를 격리한다', () => {
    const created = createStudentResultEvent('teacher-a', draft);

    expect(listStudentResultEvents('teacher-a')).toHaveLength(1);
    expect(listStudentResultEvents('teacher-b')).toHaveLength(0);
    expect(getStudentResultEvent('teacher-b', created.id)).toBeNull();
  });

  it('조회, 이의, 교사 답변, 재확인을 순서대로 반영한다', () => {
    const created = createStudentResultEvent('teacher-a', draft);
    const authenticated = authenticateStudentResult(created.publicToken, '김하늘', '4821');
    expect(authenticated?.recipient.status).toBe('viewed');

    const disputed = disputeStudentResult(created.id, authenticated!.recipient.id, '점수를 확인해 주세요.');
    expect(disputed?.recipient.status).toBe('disputed');

    const replied = replyToStudentDispute('teacher-a', created.id, authenticated!.recipient.id, '확인 후 반영했습니다.');
    expect(replied?.recipient.status).toBe('reconfirm');
    expect(replied?.recipient.dispute?.teacherReply).toBe('확인 후 반영했습니다.');

    const confirmed = confirmStudentResult(created.id, authenticated!.recipient.id);
    expect(confirmed?.recipient.status).toBe('confirmed');
  });

  it('틀린 확인번호에는 결과를 반환하지 않는다', () => {
    const created = createStudentResultEvent('teacher-a', draft);
    expect(authenticateStudentResult(created.publicToken, '김하늘', '0000')).toBeNull();
  });

  it('개인 링크를 재발급하면 이전 토큰을 폐기한다', () => {
    const created = createStudentResultEvent('teacher-a', draft);
    const recipient = created.recipients[0];
    const regenerated = regenerateStudentResultPersonalToken('teacher-a', created.id, recipient.id);

    expect(regenerated?.recipient.personalToken).not.toBe(recipient.personalToken);
    expect(authenticateStudentResultByToken(created.publicToken, recipient.personalToken)).toBeNull();
    expect(authenticateStudentResultByToken(created.publicToken, regenerated!.recipient.personalToken)).not.toBeNull();
  });
});

describe('학생 결과 안내 입력 검증', () => {
  it('중복 식별값과 배점 초과를 차단한다', () => {
    expect(validateStudentResultDraft({
      ...draft,
      recipients: [...draft.recipients, { ...draft.recipients[0], name: '이도윤', verificationCode: '5732' }],
    })).toBe('학생 식별값이 중복되었습니다.');

    expect(validateStudentResultDraft({
      ...draft,
      recipients: [{ ...draft.recipients[0], values: { score: 11 } }],
    })).toContain('점수를 확인해 주세요.');
  });

  it('첫 오류 입력의 식별자를 함께 반환한다', () => {
    expect(getStudentResultValidationIssue({
      ...draft,
      recipients: [{ ...draft.recipients[0], values: { score: '' } }],
    })).toMatchObject({
      fieldId: 'student-result-score-0-0',
      message: expect.stringContaining('점수를 확인해 주세요.'),
    });
  });
});

describe('학생 QR 인쇄 페이지 분할', () => {
  it('학생을 A4 한 장당 8명씩 나눈다', () => {
    const recipients = Array.from({ length: 17 }, (_, index) => ({
      id: String(index),
      studentKey: String(index + 1),
      name: `학생 ${index + 1}`,
      verificationCode: '1234',
      personalToken: `token-${index}`,
      values: {},
      feedback: '',
      status: 'unviewed' as const,
    }));

    expect(paginateStudentResultRecipients(recipients).map((page) => page.length)).toEqual([8, 8, 1]);
  });
});

describe('학생 결과 파일 분석', () => {
  it('제목과 실제 머리글을 찾고 열 순서와 무관하게 결과를 구성한다', () => {
    const rows = [
      ['2026학년도 2학기 수행평가 결과'],
      ['안내: 결과를 확인해 주세요.'],
      [],
      ['피드백', '확인번호', '발표(20점)', '성명', '학번', '협업/10'],
      ['준비가 충실합니다.', '4821', 18, '김하늘', '10101', 9],
      ['의견을 잘 나눕니다.', '5732', 17, '이도윤', '10102', 8],
    ];

    const analysis = analyzeStudentResultRows(rows, '평가 결과');

    expect(analysis.title).toBe('2026학년도 2학기 수행평가 결과');
    expect(analysis.description).toBe('안내: 결과를 확인해 주세요.');
    expect(analysis.headerRowNumber).toBe(4);
    expect(analysis.columns.map(({ label, maxScore }) => ({ label, maxScore }))).toEqual([
      { label: '발표', maxScore: 20 },
      { label: '협업', maxScore: 10 },
    ]);
    expect(analysis.recipients[0]).toMatchObject({
      studentKey: '10101',
      name: '김하늘',
      verificationCode: '4821',
      feedback: '준비가 충실합니다.',
    });
    expect(Object.values(analysis.recipients[0].values)).toEqual([18, 9]);
  });

  it('확인번호가 없으면 중복 없는 번호를 생성하고 텍스트 열을 제외한다', () => {
    const codes = ['1001', '1002'];
    const analysis = analyzeStudentResultRows([
      ['성명', '소속', '학년', '점수'],
      ['김하늘', '새봄초', 5, 92],
      ['이도윤', '한빛중', 5, 87],
    ], 'Sheet1', '평가 결과', () => codes.shift() ?? '9999');

    expect(analysis.recipients.map((recipient) => recipient.verificationCode)).toEqual(['1001', '1002']);
    expect(analysis.columns).toMatchObject([{ label: '점수', maxScore: 100 }]);
    expect(analysis.warnings.join(' ')).toContain('확인번호가 없는 학생 2명');
    expect(analysis.warnings.join(' ')).toContain('소속');
    expect(analysis.warnings.join(' ')).toContain('학년');
  });

  it('전 과목이 0점 또는 미입력인 학생만 미응시 후보로 찾는다', () => {
    const analysis = analyzeStudentResultRows([
      ['성명', '국어/20', '수학/20'],
      ['김미응시', 0, 0],
      ['박미입력', '', ''],
      ['이응시', 0, 1],
    ]);

    expect(findPossibleStudentResultNonParticipants(analysis).map((recipient) => recipient.name)).toEqual([
      '김미응시',
      '박미입력',
    ]);
  });

  it('PDF 글자의 좌표를 표의 행과 열로 복원한다', () => {
    const item = (text: string, x: number, y: number) => ({ text, x, y });
    const rows = reconstructStudentResultPdfRows([[
      item('2026 Semester Result', 20, 800),
      item('Please review your results.', 20, 780),
      item('id', 20, 740),
      item('name', 80, 740),
      item('accesscode', 140, 740),
      item('Math/100', 220, 740),
      item('feedback', 300, 740),
      item('30101', 20, 710),
      item('Kim', 80, 710),
      item('Sky', 98, 710),
      item('4821', 140, 710),
      item('93', 220, 710),
      item('Good work', 300, 710),
      item('1', 300, 20),
    ]]);

    expect(rows).toEqual([
      ['2026 Semester Result'],
      ['Please review your results.'],
      ['id', 'name', 'accesscode', 'Math/100', 'feedback'],
      ['30101', 'Kim Sky', '4821', '93', 'Good work'],
    ]);

    const analysis = analyzeStudentResultRows(rows, 'PDF 1쪽');
    expect(analysis.title).toBe('2026 Semester Result');
    expect(analysis.description).toBe('Please review your results.');
    expect(analysis.columns).toMatchObject([{ label: 'Math', maxScore: 100 }]);
    expect(analysis.recipients[0]).toMatchObject({
      studentKey: '30101',
      name: 'Kim Sky',
      verificationCode: '4821',
      feedback: 'Good work',
    });
    expect(Object.values(analysis.recipients[0].values)).toEqual([93]);
  });

  it('PDF에서 조각난 과목 머리글을 실제 점수 열에 맞춰 합친다', () => {
    const item = (text: string, x: number, y: number) => ({ text, x, y });
    const rows = reconstructStudentResultPdfRows([[
      item('기초학력 진단·보정 결과서', 190, 780),
      item('이름', 72.52, 703.4),
      item('국어', 135.09, 703.4),
      item('(', 148.84, 703.4),
      item('가형', 152.16, 703.4),
      item(')', 165.91, 703.4),
      item('수학', 207.87, 703.4),
      item('(', 221.61, 703.4),
      item('가형', 224.94, 703.4),
      item(')', 238.68, 703.4),
      item('전체', 493.54, 703.4),
      item('맞은', 509.2, 703.4),
      item('개수', 524.86, 703.4),
      item('강서윤', 69.08, 685.4),
      item('20', 147.29, 685.4),
      item('19', 220.61, 685.4),
      item('39/40', 503.8, 685.4),
      item('경태현', 69.08, 666.65),
      item('19', 147.83, 666.65),
      item('16', 220.61, 666.65),
      item('35/40', 503.21, 666.65),
      item('김다은', 69.08, 648.65),
      item('0/40', 505.63, 648.65),
    ]]);

    expect(rows).toEqual([
      ['기초학력 진단·보정 결과서'],
      ['이름', '국어(가형)', '수학(가형)', '전체 맞은 개수'],
      ['강서윤', '20', '19', '39/40'],
      ['경태현', '19', '16', '35/40'],
      ['김다은', '', '', '0/40'],
    ]);

    const analysis = analyzeStudentResultRows(rows, 'PDF 1쪽');
    expect(analysis.columns.map(({ label, maxScore }) => ({ label, maxScore }))).toEqual([
      { label: '국어(가형)', maxScore: 20 },
      { label: '수학(가형)', maxScore: 20 },
    ]);
    expect(analysis.recipients).toHaveLength(3);
    expect(Object.values(analysis.recipients[0].values)).toEqual([20, 19]);
    expect(analysis.recipients[2]).toMatchObject({ name: '김다은' });
    expect(Object.values(analysis.recipients[2].values)).toEqual(['', '']);
  });
});
