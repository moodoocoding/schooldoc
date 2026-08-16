import { describe, expect, it } from 'vitest';
import {
  CONSENT_EXCEL_HEADER_BASE,
  buildConsentResponsesSheet,
  buildPendingRecipientRows,
  consentExcelFileName,
} from '../../src/features/consentForms/consentResponsesExcel';
import type { ConsentFieldDraft, ConsentRecipientRecord, ConsentResponseRecord } from '../../src/features/consentForms/types';

const field = (id: string, kind: ConsentFieldDraft['kind'], label: string): ConsentFieldDraft => ({
  id, kind, label, required: true, pageIndex: 0, x: 10, y: 10, width: 30, height: 7,
});

const fields = [
  field('f1', 'text', '보호자 의견'),
  field('f2', 'checkbox', '참가 동의'),
  field('f3', 'date', '작성일'),
  field('f4', 'signature', '보호자 서명'),
];

const response: ConsentResponseRecord = {
  id: 'resp-1',
  submittedAt: '2026-08-16T01:00:00.000Z',
  values: { f1: '참가합니다', f2: 'true', f3: '2026-08-16', f4: 'data:image/png;base64,AAAA' },
};

const recipients: ConsentRecipientRecord[] = [
  { id: 'r1', token: 't1', name: '김학생', studentKey: '30101', responseId: 'resp-1', submittedAt: '2026-08-16T01:00:00.000Z' },
  { id: 'r2', token: 't2', name: '이학생', studentKey: '30102', responseId: null, submittedAt: null },
];

describe('응답 결과 표', () => {
  it('필드마다 열을 만들고 제출자를 함께 적는다', () => {
    const { header, rows } = buildConsentResponsesSheet(fields, [response], recipients);

    expect(header).toEqual([...CONSENT_EXCEL_HEADER_BASE, '보호자 의견', '참가 동의', '작성일', '보호자 서명']);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([1, '김학생', '30101', '2026-08-16T01:00:00.000Z', '참가합니다', '예', '2026. 8. 16.', '서명함']);
  });

  it('제출자를 못 찾으면 이름 칸을 비워 둔다', () => {
    const { rows } = buildConsentResponsesSheet(fields, [response], []);
    expect(rows[0][1]).toBe('');
    expect(rows[0][2]).toBe('');
  });

  it('체크하지 않은 항목과 빈 값은 비워 둔다', () => {
    const empty: ConsentResponseRecord = { id: 'resp-2', submittedAt: '2026-08-16T02:00:00.000Z', values: { f2: '' } };
    const { rows } = buildConsentResponsesSheet(fields, [empty], []);
    expect(rows[0].slice(4)).toEqual(['', '', '', '']);
  });

  it('미제출자도 독촉할 수 있도록 함께 담는다', () => {
    const pending = buildPendingRecipientRows(recipients, fields.length);
    expect(pending).toHaveLength(1);
    expect(pending[0].slice(0, 3)).toEqual(['미제출', '이학생', '30102']);
    expect(pending[0]).toHaveLength(CONSENT_EXCEL_HEADER_BASE.length + fields.length);
  });

  it('파일 이름에서 경로 문자를 제거한다', () => {
    expect(consentExcelFileName('현장체험학습 동의서')).toBe('현장체험학습 동의서_응답.xlsx');
    expect(consentExcelFileName('1/2학기: 안내')).toBe('1_2학기_ 안내_응답.xlsx');
    expect(consentExcelFileName('  ')).toBe('가정통신문_응답.xlsx');
  });
});
