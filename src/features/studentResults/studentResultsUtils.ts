import type { ResultColumn, ResultRecipient, ResultRecipientDraft, StudentResultDraft } from './types';

export const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ');

export interface StudentResultValidationIssue {
  message: string;
  fieldId: string;
}

export const getStudentResultValidationIssue = (draft: StudentResultDraft): StudentResultValidationIssue | null => {
  if (!cleanText(draft.title)) return { message: '안내 제목을 입력해 주세요.', fieldId: 'student-result-title' };
  if (draft.columns.length === 0) return { message: '결과 항목을 한 개 이상 추가해 주세요.', fieldId: 'student-result-add-column' };
  const emptyColumnIndex = draft.columns.findIndex((column) => !cleanText(column.label));
  if (emptyColumnIndex >= 0) return { message: '결과 항목의 이름을 입력해 주세요.', fieldId: `student-result-column-label-${emptyColumnIndex}` };
  const invalidMaxScoreIndex = draft.columns.findIndex((column) => !Number.isFinite(column.maxScore) || column.maxScore <= 0);
  if (invalidMaxScoreIndex >= 0) return { message: '배점은 0보다 커야 합니다.', fieldId: `student-result-column-max-${invalidMaxScoreIndex}` };
  if (draft.recipients.length === 0) return { message: '학생을 한 명 이상 추가해 주세요.', fieldId: 'student-result-add-recipient' };
  const emptyNameIndex = draft.recipients.findIndex((recipient) => !cleanText(recipient.name));
  if (emptyNameIndex >= 0) return { message: `${emptyNameIndex + 1}번 학생의 이름을 입력해 주세요.`, fieldId: `student-result-recipient-name-${emptyNameIndex}` };
  const emptyKeyIndex = draft.recipients.findIndex((recipient) => !cleanText(recipient.studentKey));
  if (emptyKeyIndex >= 0) return { message: `${emptyKeyIndex + 1}번 학생의 식별값을 입력해 주세요.`, fieldId: `student-result-recipient-key-${emptyKeyIndex}` };
  const invalidCodeIndex = draft.recipients.findIndex((recipient) => cleanText(recipient.verificationCode).length < 4);
  if (invalidCodeIndex >= 0) return { message: `${invalidCodeIndex + 1}번 학생의 확인번호를 4자 이상 입력해 주세요.`, fieldId: `student-result-recipient-code-${invalidCodeIndex}` };

  const studentKeys = draft.recipients.map((recipient) => cleanText(recipient.studentKey));
  const duplicateKeyIndex = studentKeys.findIndex((key, index) => studentKeys.indexOf(key) !== index);
  if (duplicateKeyIndex >= 0) return { message: '학생 식별값이 중복되었습니다.', fieldId: `student-result-recipient-key-${duplicateKeyIndex}` };

  const authKeys = draft.recipients.map((recipient) => `${cleanText(recipient.name)}::${cleanText(recipient.verificationCode)}`);
  const duplicateAuthIndex = authKeys.findIndex((key, index) => authKeys.indexOf(key) !== index);
  if (duplicateAuthIndex >= 0) return { message: '이름과 확인번호 조합이 중복되었습니다.', fieldId: `student-result-recipient-code-${duplicateAuthIndex}` };

  for (const [recipientIndex, recipient] of draft.recipients.entries()) {
    for (const [columnIndex, column] of draft.columns.entries()) {
      const score = recipient.values[column.id];
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > column.maxScore) {
        return {
          message: `${cleanText(recipient.name)} 학생의 ${cleanText(column.label)} 점수를 확인해 주세요. 값을 입력하고 0점부터 배점 사이인지 확인하세요.`,
          fieldId: `student-result-score-${recipientIndex}-${columnIndex}`,
        };
      }
    }
  }
  return null;
};

export const validateStudentResultDraft = (draft: StudentResultDraft) => (
  getStudentResultValidationIssue(draft)?.message ?? ''
);

export const makeEmptyRecipient = (index: number, columns: Pick<ResultColumn, 'id'>[]): ResultRecipientDraft => ({
  studentKey: String(index + 1),
  name: '',
  verificationCode: '',
  values: Object.fromEntries(columns.map((column) => [column.id, ''])),
  feedback: '',
});

export const resultStatusLabel = (status: string) => ({
  unviewed: '미조회',
  viewed: '조회',
  confirmed: '확인',
  disputed: '이의',
  reconfirm: '재확인 필요',
}[status] ?? status);

export const paginateStudentResultRecipients = (
  recipients: ResultRecipient[],
  pageSize = 8,
) => {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('페이지당 학생 수는 1 이상의 정수여야 합니다.');
  }

  if (recipients.length === 0) return [[]] as ResultRecipient[][];

  return Array.from(
    { length: Math.ceil(recipients.length / pageSize) },
    (_, index) => recipients.slice(index * pageSize, (index + 1) * pageSize),
  );
};
