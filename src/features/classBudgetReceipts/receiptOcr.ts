import type { ReceiptAnalysisDraft, ReceiptAnalysisSource } from './types';
const datePatterns = [
  /((?:19|20)\d{2})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*일?/,
  /\b(\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})\b/,
];
const totalLabelPattern = /(결제\s*금액|승인\s*금액|받을\s*금액|합\s*계|총\s*액|총\s*금액|TOTAL|AMOUNT)/i;
const excludedAmountLabelPattern = /(부가세|과세|면세|공급가|거스름|잔액|할인|VAT|TAX|CHANGE|SUBTOTAL)/i;
const merchantLabelPattern = /(?:상호|가맹점명|가맹점|업체명|사업자명|매장명|STORE|MERCHANT)\s*[:：]?\s*(.+)/i;
const merchantExcludedPattern = /(영수증|매출전표|카드전표|사업자|대표자|전화|TEL|FAX|주소|승인|거래|일시|날짜|DATE|합계|총액|TOTAL|금액|AMOUNT|부가세|공급가|카드|현금|고객용|메뉴|단가|수량)/i;

const normalizeLines = (text: string) => text
  .replace(/\r/g, '\n')
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const validDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const findSpentAt = (lines: string[]) => {
  for (const line of lines) {
    for (const [index, pattern] of datePatterns.entries()) {
      const match = line.match(pattern);
      if (!match) continue;
      const year = index === 1 ? 2000 + Number(match[1]) : Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (validDate(year, month, day)) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  return '';
};

const parseMoney = (value: string) => Number(value.replace(/[,.\s]/g, ''));
const moneyPattern = /(?:₩|￦|W)?\s*(-?\d{1,3}(?:(?:,|\.)\s*\d{3})+|-?\d{2,9})\s*원?/g;
const explicitMoneyPattern = /(?:[₩￦W]\s*)?(\d{1,3}(?:(?:,|\.)\s*\d{3})+)(?:\s*원)?|(\d{3,8})\s*원/g;

const moneyValues = (line: string) => Array.from(line.matchAll(moneyPattern))
  .map((match) => parseMoney(match[1]))
  .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000_000);

const explicitMoneyValues = (line: string) => Array.from(line.matchAll(explicitMoneyPattern))
  .map((match) => parseMoney(match[1] ?? match[2]))
  .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000_000);

const findAmount = (lines: string[]) => {
  const labeled = lines
    .filter((line) => totalLabelPattern.test(line) && !excludedAmountLabelPattern.test(line))
    .flatMap(moneyValues);
  if (labeled.length) return Math.max(...labeled);

  const fallback = lines
    .filter((line) => !excludedAmountLabelPattern.test(line) && !datePatterns.some((pattern) => pattern.test(line)))
    .flatMap(explicitMoneyValues)
    .filter((value) => value >= 100);
  if (!fallback.length) return null;
  const frequencies = fallback.reduce<Map<number, number>>((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map());
  const repeated = [...frequencies.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([leftValue, leftCount], [rightValue, rightCount]) => rightValue - leftValue || rightCount - leftCount);
  return repeated[0]?.[0] ?? Math.max(...fallback);
};

const cleanMerchant = (value: string) => value
  .replace(/^[-\s:：]+/, '')
  .replace(/\s+(?:사업자|대표자|TEL|전화|주소).*$/i, '')
  .trim()
  .slice(0, 80);

const findMerchant = (lines: string[]) => {
  for (const line of lines.slice(0, 18)) {
    const match = line.match(merchantLabelPattern);
    const labeled = match ? cleanMerchant(match[1]) : '';
    if (labeled.length >= 2) return labeled;
  }
  return lines.slice(0, 12)
    .map(cleanMerchant)
    .find((line) => line.length >= 2
      && line.length <= 80
      && /[가-힣A-Za-z]/.test(line)
      && !merchantExcludedPattern.test(line)
      && !datePatterns.some((pattern) => pattern.test(line))
      && moneyValues(line).length === 0
      && line.split(/\s+/).filter((token) => /^[A-Za-z]{1,2}$/.test(token)).length < 3) ?? '';
};

export const parseReceiptText = (
  text: string,
  source: ReceiptAnalysisSource,
  ocrConfidence = 1,
): ReceiptAnalysisDraft => {
  const lines = normalizeLines(text);
  const spentAt = findSpentAt(lines);
  const merchant = findMerchant(lines);
  const amount = findAmount(lines);
  const warnings: string[] = [];
  if (!spentAt) warnings.push('사용 날짜를 찾지 못했습니다.');
  if (!merchant) warnings.push('사용처를 찾지 못했습니다.');
  if (amount === null) warnings.push('결제 금액을 찾지 못했습니다.');
  warnings.push('사용 목적은 직접 입력해야 합니다.');
  const foundRatio = [Boolean(spentAt), Boolean(merchant), amount !== null].filter(Boolean).length / 3;
  return {
    spentAt,
    merchant,
    amount,
    confidence: Math.max(0, Math.min(1, foundRatio * Math.max(0.45, Math.min(1, ocrConfidence)))),
    source,
    warnings,
  };
};
