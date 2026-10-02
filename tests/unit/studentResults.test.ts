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
  updateStudentResultRecipient,
  updateStudentResultSettings,
} from '../../src/features/studentResults/studentResultsStore';
import { getStudentResultValidationIssue, paginateStudentResultRecipients, studentResultSummary, validateStudentResultDraft } from '../../src/features/studentResults/studentResultsUtils';
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
  it.each(['총점', '합계', ' Total Score '])('수동 %s 열을 명시 종류로 저장하고 재조회해도 세부 점수를 중복 합산하지 않는다', (label) => {
    const created = createStudentResultEvent('teacher-a', {
      ...draft,
      columns: [...draft.columns, { id: 'total', label, maxScore: 10, description: '' }],
      recipients: [{ ...draft.recipients[0], values: { score: 9, total: 9 } }],
    });
    const loaded = getStudentResultEvent('teacher-a', created.id)!;
    expect(loaded.columns.map((column) => column.kind)).toEqual(['score', 'total']);
    expect(studentResultSummary(loaded.columns, loaded.recipients[0].values)).toEqual({ score: 9, maxScore: 10, source: 'total' });
  });

  it('명시적으로 개별 점수를 선택한 총점 이름은 저장 후에도 합산한다', () => {
    const created = createStudentResultEvent('teacher-a', {
      ...draft, columns: [{ ...draft.columns[0], label: '총점', kind: 'score' }],
    });
    expect(studentResultSummary(created.columns, created.recipients[0].values).source).toBe('sum');
  });

  it.each(['label', 'kind', 'maxScore', 'description', 'title', 'allowDispute'] as const)('%s 설정 변경은 확인을 무효화하고 오래 열린 미확인 화면도 거부한다', (field) => {
    const created = createStudentResultEvent('teacher-a', {
      ...draft, recipients: [...draft.recipients, { ...draft.recipients[0], studentKey: '2', name: '가상바다', verificationCode: '5732' }],
    });
    const confirmed = confirmStudentResult(created.id, created.recipients[0].id)!;
    const current = getStudentResultEvent('teacher-a', created.id)!;
    const settings = { title: current.title, description: current.description, allowConfirmation: true, allowDispute: true, columns: current.columns };
    if (field === 'title') settings.title = '수정 안내';
    else if (field === 'allowDispute') settings.allowDispute = false;
    else settings.columns = settings.columns.map((column) => ({ ...column, [field]: field === 'maxScore' ? 20 : field === 'kind' ? 'total' : '변경 항목' }));
    updateStudentResultSettings('teacher-a', created.id, current.updatedAt, settings);
    const loaded = getStudentResultEvent('teacher-a', created.id)!;
    expect(loaded.recipients[0]).toMatchObject({ status: 'reconfirm', values: { score: 9 } });
    expect(loaded.recipients[0].confirmedAt).toBeUndefined();
    for (const recipient of loaded.recipients) expect(recipient.updatedAt).not.toBe(current.recipients.find((old) => old.id === recipient.id)!.updatedAt);
    expect(confirmStudentResult(created.id, confirmed.recipient.id, confirmed.recipient.updatedAt)).toBeNull();
    expect(confirmStudentResult(created.id, current.recipients[1].id, current.recipients[1].updatedAt)).toBeNull();
    const refreshed = authenticateStudentResult(created.publicToken, '김하늘', '4821')!;
    expect(confirmStudentResult(created.id, refreshed.recipient.id, refreshed.recipient.updatedAt)?.recipient.status).toBe('confirmed');
  });

  it('동일 설정 저장은 확인과 버전을 유지하며 확인 해제는 답변 없는 학생을 조회 상태로 돌린다', () => {
    const created = createStudentResultEvent('teacher-a', draft);
    confirmStudentResult(created.id, created.recipients[0].id);
    const current = getStudentResultEvent('teacher-a', created.id)!;
    const settings = { title: current.title, description: current.description, allowConfirmation: true, allowDispute: true, columns: current.columns };
    updateStudentResultSettings('teacher-a', created.id, current.updatedAt, settings);
    expect(getStudentResultEvent('teacher-a', created.id)).toEqual(current);
    updateStudentResultSettings('teacher-a', created.id, current.updatedAt, { ...settings, allowConfirmation: false });
    expect(getStudentResultEvent('teacher-a', created.id)?.recipients[0]).toMatchObject({ status: 'viewed' });
    expect(getStudentResultEvent('teacher-a', created.id)?.recipients[0].confirmedAt).toBeUndefined();
  });

  it('시계가 같은 밀리초에 머물러도 설정 정정은 이전 확인 버전과 겹치지 않는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));
    try {
      const created = createStudentResultEvent('teacher-a', draft);
      const viewed = authenticateStudentResult(created.publicToken, '김하늘', '4821')!;
      const current = getStudentResultEvent('teacher-a', created.id)!;
      updateStudentResultSettings('teacher-a', current.id, current.updatedAt, { ...current, title: '정정 안내' });
      expect(confirmStudentResult(created.id, viewed.recipient.id, viewed.recipient.updatedAt)).toBeNull();
      expect(getStudentResultEvent('teacher-a', current.id)!.recipients[0].updatedAt! > viewed.recipient.updatedAt!).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it('총점 열을 개별 과목에 다시 더하지 않고, 명시 종류와 기존 머리글 모두 인식한다', () => {
    const columns = [
      { id: 'math', label: '수학', maxScore: 50, description: '', kind: 'score' as const },
      { id: 'korean', label: '국어', maxScore: 50, description: '', kind: 'score' as const },
      { id: 'sum', label: '합산 결과', maxScore: 100, description: '', kind: 'total' as const },
    ];
    expect(studentResultSummary(columns, { math: 45, korean: 47, sum: 92 })).toMatchObject({ score: 92, maxScore: 100, source: 'total' });
    expect(studentResultSummary([{ ...columns[2], kind: undefined, label: '총점' }], { sum: 92 })).toMatchObject({ score: 92, source: 'total' });
  });

  it('교사 점수 정정은 수정 내역을 남기고 기존 확인을 재확인 필요로 바꾼다', () => {
    const created = createStudentResultEvent('teacher-a', draft);
    const confirmed = confirmStudentResult(created.id, created.recipients[0].id)!;
    const current = getStudentResultEvent('teacher-a', created.id)!;
    const corrected = updateStudentResultRecipient('teacher-a', created.id, created.recipients[0].id, current.updatedAt, confirmed.recipient.updatedAt!, { score: 8 }, '오류 정정', '채점표 재확인');
    expect(corrected?.recipient.status).toBe('reconfirm');
    expect(corrected?.recipient.confirmedAt).toBeUndefined();
    expect(corrected?.recipient.revisions?.[0]).toMatchObject({ reason: '채점표 재확인', before: { values: { score: 9 } }, after: { values: { score: 8 } } });
  });

  it('확인 받기가 꺼진 결과의 이의 답변은 완료 상태로 마친다', () => {
    const created = createStudentResultEvent('teacher-a', { ...draft, allowConfirmation: false });
    disputeStudentResult(created.id, created.recipients[0].id, '확인 부탁드립니다.');
    const replied = replyToStudentDispute('teacher-a', created.id, created.recipients[0].id, '수정했습니다.');
    expect(replied?.recipient.status).toBe('replied');
    const current = getStudentResultEvent('teacher-a', created.id)!;
    expect(() => updateStudentResultSettings('teacher-a', created.id, 'stale-version', { title: current.title, description: current.description, columns: current.columns, allowConfirmation: false, allowDispute: true })).toThrow('다른 변경');
  });
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
