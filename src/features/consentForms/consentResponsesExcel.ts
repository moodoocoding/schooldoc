import { formatConsentValue } from './consentResponseRender';
import type { ConsentFieldDraft, ConsentRecipientRecord, ConsentResponseRecord } from './types';

/**
 * 제출 결과를 표로 정리한다.
 * 합성 PDF가 원본 서식을 그대로 보여준다면, 이 표는 값만 모아 한눈에 비교하기 위한 것이다.
 * 서명은 이미지라 표에 담을 수 없으므로 제출 여부만 적는다.
 */
export const CONSENT_EXCEL_HEADER_BASE = ['연번', '제출자', '식별값', '제출 시각'];

const cellValue = (field: ConsentFieldDraft, raw: string) => {
  if (!raw) return '';
  if (field.kind === 'signature') return '서명함';
  if (field.kind === 'checkbox') return raw === 'true' ? '예' : '';
  return formatConsentValue(field, raw);
};

export const buildConsentResponsesSheet = (
  fields: ConsentFieldDraft[],
  responses: ConsentResponseRecord[],
  recipients: ConsentRecipientRecord[],
) => {
  const header = [...CONSENT_EXCEL_HEADER_BASE, ...fields.map((field) => field.label)];
  const rows = responses.map((response, index) => {
    const recipient = recipients.find((entry) => entry.responseId === response.id) ?? null;
    return [
      index + 1,
      recipient?.name ?? '',
      recipient?.studentKey ?? '',
      response.submittedAt,
      ...fields.map((field) => cellValue(field, response.values[field.id] ?? '')),
    ];
  });
  return { header, rows };
};

/** 아직 내지 않은 사람도 함께 보여야 독촉할 대상을 바로 알 수 있다. */
export const buildPendingRecipientRows = (recipients: ConsentRecipientRecord[], columnCount: number) => (
  recipients
    .filter((recipient) => !recipient.submittedAt)
    .map((recipient) => ['미제출', recipient.name, recipient.studentKey, '', ...Array<string>(columnCount).fill('')])
);

export const consentExcelFileName = (title: string) => (
  `${title.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 60) || '가정통신문'}_응답.xlsx`
);

export const downloadConsentResponsesExcel = async (
  title: string,
  fields: ConsentFieldDraft[],
  responses: ConsentResponseRecord[],
  recipients: ConsentRecipientRecord[],
) => {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const { header, rows } = buildConsentResponsesSheet(fields, responses, recipients);
  const pending = buildPendingRecipientRows(recipients, fields.length);
  const sheet = [
    header.map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#EAF1F7' })),
    ...rows,
    ...pending,
  ];
  await writeXlsxFile(sheet).toFile(consentExcelFileName(title));
};
