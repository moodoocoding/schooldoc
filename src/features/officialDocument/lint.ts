import { isGaejosik } from './format';
import type { OfficialDocument, OfficialNode } from './model';
import type { PageVolume } from './rhwpWriter';

/**
 * 공문 문서 모델의 생성 전 점검과 표기 정리.
 *
 * 규칙 근거: 2025 행정업무운영 편람 49·51~53·61쪽, 「행정업무의 운영 및 혁신에 관한 규정」 제7조⑤, 같은 시행규칙 제2조②.
 * 점검 방식과 정규식은 UpstageAI/korean-report-hwpx(MIT, Copyright (c) 2026 Upstage)의
 * server.py `_normalize`·`_style_warnings`·`_count_sentences`, engine/official.py `_정규화날짜`·`_check_amount_needed`
 * (커밋 210b864e4afba5144e3cbc87f9c0211d589e1746)를 TypeScript로 옮겨 SchoolDoc 문서 모델에 맞춘 것이다.
 * 라이선스: ./rules/korean-report-hwpx.LICENSE
 */
export interface OfficialIssue {
  /** 문제 위치(예: "본문 2 > 1"). */
  where: string;
  message: string;
  /** 표기를 자동으로 고쳤으면 true. 내용은 바꾸지 않고 기호·날짜 표기만 고친다. */
  fixed: boolean;
}
export interface OfficialCheck { document: OfficialDocument; issues: OfficialIssue[] }

// 본문 앞에 붙은 기호(○○부 같은 가림 표기는 남긴다)와 편람 번호. 번호는 '11. 2.' 같은 날짜와 구분한다.
const LEAD_SYMBOL = /^[\s　]*(?:(?![○〇]{2})[○〇ㅇ◦∘•●·‧*]+[\s　]+|[-‐–—―]+[\s　]*|[□■◆◇❍▪▶►☞※]+[\s　]*)+/;
const ORDER = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허';
const LEAD_NUMBER = new RegExp(String.raw`^[\s　]*(?:\d{1,2}[.)]|[${ORDER}][.)]|\(\d{1,2}\)|\([${ORDER}]\)|[①-⑳]|[㉮-㉻])[\s　]+(?!\d{1,2}\.)`);
const DASH = /[‐–—―]/g;
const VERB_END = /(니다|했다|한다|이다|된다|있다|없다|였다|밝혔다)\.?\s*(붙임\s?\d+|참고\s?\d+)?\s*$/;
const NOT_SENTENCE_DOT = new RegExp([
  String.raw`(?:\d{4}|'\d{2})\.\s?\d{1,2}\.\s?\d{1,2}\.(?:\([월화수목금토일]\))?`,
  String.raw`(?<![\d.])\d{1,2}\.\s?\d{1,2}\.(?:\([월화수목금토일]\))?`,
  String.raw`(?:\d{4}|'\d{2})\.\s?\d{1,2}\.(?=[\s)~〜]|$)`,
  String.raw`\d+\.\d+`,
  String.raw`(?<![A-Za-z])(?:[Pp]{1,2}|[Nn]o|[Vv]s|etc|e\.g|i\.e|cf|Dr|Mr|Ms|Jr|St)\.`,
  String.raw`…|\.{2,}`,
].join('|'), 'g');
const SENTENCE_END = /(?:다|함|임|됨|음)\.(?:\s|$)|[.?!](?=\s+\S)/g;

/** □ 두괄식 점검용 문장 수. 날짜·소수·약어·줄임표의 온점은 문장 끝으로 세지 않는다. */
export function countSentences(text: string) {
  const t = text.trim().replace(/\s*(붙임|참고)\s?\d+\s*$/, '').replace(NOT_SENTENCE_DOT, 'x');
  let n = (t.match(SENTENCE_END) ?? []).length;
  if (n && !/[.?!][)\]」』”"']*\**$/.test(t)) n += 1;
  return n;
}

/** 날짜 표기(편람 49쪽): 2026-11-13, 2026.11.13, 2026. 09. 06. → 2026. 11. 13. 꼴. */
export function normalizeDates(text: string) {
  return text
    .replace(/(?<![\d.])(\d{4})-(\d{1,2})-(\d{1,2})(?![\d-])/g, (_, y, m, d) => `${y}. ${Number(m)}. ${Number(d)}.`)
    .replace(/(?<![\d.])(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})(?:\.|(?=$|[\s,)~∼]))/g, (_, y, m, d) => `${y}. ${Number(m)}. ${Number(d)}.`);
}
/** 금액 표기(시행규칙 제2조②): 금액 뒤에 (금…원) 한글 병기가 있어야 한다. */
export function needsKoreanAmount(text: string) {
  return /금\d|\d{1,3}(?:,\d{3})+원/.test(text) && !/\(금[^)]+원\)/.test(text);
}
const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
/** 금액을 한글로 쓴다(편람 49쪽 예: 113560 → 일십일만삼천오백육십). */
export function koreanAmount(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('금액은 0 이상의 정수여야 합니다.');
  if (value === 0) return '영';
  const groups = ['', '만', '억', '조'];
  let result = '', rest = value;
  for (let g = 0; rest > 0; g++, rest = Math.floor(rest / 10000)) {
    const chunk = rest % 10000;
    if (!chunk) continue;
    const text = [...String(chunk).padStart(4, '0')].map((d, i) => d === '0' ? '' : DIGITS[Number(d)] + ['천', '백', '십', ''][i]).join('');
    result = text + groups[g] + result;
  }
  return result;
}
/** 편람 표기의 금액: 금113,560원(금일십일만삼천오백육십원). */
export const officialAmount = (value: number) => `금${value.toLocaleString('ko-KR')}원(금${koreanAmount(value)}원)`;

/** 문서 모델을 점검한다. 기호·대시·날짜 표기는 고친 문서를 돌려주고, 나머지는 고칠 점으로 알린다. */
export function checkOfficialDocument(document: OfficialDocument): OfficialCheck {
  const issues: OfficialIssue[] = [];
  const gaejosik = isGaejosik(document);
  if (!document.title.trim()) issues.push({ where: '제목', message: '제목이 비어 있습니다.', fixed: false });
  else if (document.title.trim().length > 40) issues.push({ where: '제목', message: `제목이 깁니다(${document.title.trim().length}자). 40자 안쪽을 권장합니다.`, fixed: false });
  const tidy = (text: string, where: string) => {
    let next = text.replace(DASH, '-');
    const stripped = next.replace(LEAD_SYMBOL, '').replace(LEAD_NUMBER, '');
    if (stripped.trim() !== next.trim()) issues.push({ where, message: `앞의 항목 기호를 지웠습니다('${text.trim().slice(0, 8)}…'). 기호는 출력 서식이 붙입니다.`, fixed: true });
    next = stripped;
    const dated = normalizeDates(next);
    if (dated !== next) issues.push({ where, message: '날짜를 공문 표기(2026. 11. 13.)로 고쳤습니다.', fixed: true });
    next = dated.trim();
    if (!next) issues.push({ where, message: '내용이 비어 있습니다.', fixed: false });
    if (/(오전|오후)\s?\d{1,2}\s?시/.test(next)) issues.push({ where, message: '시각은 24시각제로 씁니다(예: 오후 3시 20분 → 15:20).', fixed: false });
    if (needsKoreanAmount(next)) issues.push({ where, message: '금액 뒤에 한글 병기가 필요합니다(예: 금113,560원(금일십일만삼천오백육십원)).', fixed: false });
    return next;
  };
  const walk = (nodes: OfficialNode[], path: string, level: number): OfficialNode[] => nodes.map((node, i) => {
    const where = `${path}${path ? ' > ' : '본문 '}${i + 1}`;
    if (node.kind === 'table') return node;
    const text = tidy(node.text, where);
    if (node.kind === 'note') return { ...node, text };
    if (gaejosik && level === 1 && countSentences(text) >= 2) issues.push({ where, message: `□ 항목은 두괄식 한 문장으로 씁니다(지금 ${countSentences(text)}문장).`, fixed: false });
    if (gaejosik && VERB_END.test(text)) issues.push({ where, message: `개조식은 명사형으로 끝냅니다(~함·~임·~ 예정): '…${text.slice(-12)}'`, fixed: false });
    return { ...node, text, ...(node.children ? { children: walk(node.children, where, level + 1) } : {}) };
  });
  return { document: { ...document, title: document.title.trim(), body: walk(document.body, '', 1) }, issues };
}

/**
 * 분량 점검(korean-report-hwpx `_size_warnings`를 옮김): 본문(강제 쪽 나눔 전) 마지막 쪽이 80%보다 덜 차면 알린다.
 * 넘침은 출력기가 저장을 막으므로 여기서는 다루지 않는다.
 */
export function pageVolumeIssues(volume: PageVolume | undefined): OfficialIssue[] {
  if (!volume || !volume.fills.length) return [];
  const page = Math.min(volume.bodyPages, volume.fills.length), fill = volume.fills[page - 1];
  if (fill >= 0.8) return [];
  return [{ where: `${page}쪽`, message: `본문 마지막 쪽이 약 ${Math.round(fill * 100)}%만 찼습니다. 쪽 수를 줄이거나 무엇·왜·누가·언제·숫자 같은 세부 내용을 보강할 수 있습니다.`, fixed: false }];
}
