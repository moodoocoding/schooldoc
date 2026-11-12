import { itemDepth, type DraftDocument, type OfficialDocument, type OfficialDocumentKind, type OfficialNode, type OfficialTableColumn } from './model';
import { MOE_REPORT_RULES } from './rules/moeReport';
import { OFFICIAL_DRAFT_RULES } from './rules/officialDraft';

/**
 * 공문 서식 규칙. 근거는 2025 행정업무운영 편람, 교육청 공문 첨부 문서 실측값,
 * 교육부 보고서 실측값(rules/moeReport.ts), 기안문 서식(rules/officialDraft.ts)이다(docs/official-document-format.md).
 * 크기 단위는 HWPUNIT(1pt = 100)이다.
 */
export interface TextStyle { font: string; size: number; bold: boolean; lineSpacing: number }
export type LineKey = 'title' | 'l1' | 'l2' | 'l3' | 'l4' | 'ref' | 'table' | 'draft';
/** 한 항목 체계(편람 번호 또는 개조식)의 단계별 글자와 간격. */
export interface MarkerScheme {
  /** 1단계부터의 글자 모양. 더 깊은 단계는 마지막 값을 쓴다. */
  levels: TextStyle[];
  /** ※ 참고 */
  note: TextStyle;
  /** 앞 줄과 사이의 간격(HWPUNIT). */
  gapBefore: (previous: LineKey, next: LineKey) => number;
  /** 줄 뒤 간격(HWPUNIT). */
  after: number;
  /** 표 뒤 간격(HWPUNIT). */
  tableAfter: number;
}
/** 기안문 두문·결문 글자 모양. */
export interface DraftStyles {
  organization: TextStyle; head: TextStyle; sender: TextStyle; approval: TextStyle; footer: TextStyle;
  /** 간격(HWPUNIT) */
  organizationAfter: number; headAfter: number; attachmentsBefore: number; senderBefore: number; senderAfter: number;
  barFill: string;
}
export interface OfficialFormatProfile {
  title: TextStyle;
  /** 2타(한글 1자) 들여쓰기 기준 크기. */
  indentUnit: number;
  numbered: MarkerScheme;
  /** 4단계 이상 개조식을 허용하는 문서만 둔다. 기안문은 편람 번호만 쓴다. */
  gaejosik?: MarkerScheme;
  table: { body: TextStyle; head: TextStyle & { fill: string } };
  draft?: DraftStyles;
  ratio: number; spacing: number;
  page: { width: number; height: number; marginLeft: number; marginRight: number; marginTop: number; marginBottom: number; marginHeader: number; marginFooter: number };
}
export interface OfficialDocumentKindInfo { label: string; profile: OfficialFormatProfile; pageOptions: readonly number[] }

const pt = (value: number) => Math.round(value * 100);
const style = (font: string, size: number, lineSpacing: number, bold = false): TextStyle => ({ font, size, bold, lineSpacing });
/**
 * 교육부 개조식 실측값을 본문 크기에 맞춰 비례로 줄인다(◦ 15pt → 본문 크기). 크기는 0.5pt 단위로 반올림한다.
 * 간격은 실측 문서의 과반에서 실제로 띄운 경우만 쓴다.
 */
function moeGaejosik(bodySize: number): MarkerScheme {
  const { levels, gaps } = MOE_REPORT_RULES;
  const scale = bodySize / pt(levels.l2.pt);
  const size = (value: number) => Math.round(value * scale * 2) / 2;
  const level = (l: { font: string; pt: number; line: number }) => style(l.font, pt(size(l.pt)), l.line);
  const majority = new Map(Object.entries(gaps).filter(([, g]) => g.samples > g.none).map(([key, g]) => [key, pt(size(g.pt))]));
  return {
    levels: [level(levels.l1), level(levels.l2), level(levels.l3), level(levels.ref)],
    note: level(levels.ref),
    gapBefore: (previous, next) => majority.get(`${previous === 'l4' ? 'ref' : previous}>${next === 'l4' ? 'ref' : next}`) ?? 0,
    after: 0, tableAfter: 0,
  };
}
// A4, 좌우 20mm, 위·아래 15mm, 머리말·꼬리말 10mm(교육청 공문 첨부 실측).
const A4 = { width: 59528, height: 84186, marginLeft: 5669, marginRight: 5669, marginTop: 4252, marginBottom: 4252, marginHeader: 2835, marginFooter: 2835 };

/** 붙임 계획서: 휴먼명조 13pt·장평 100%·자간 0%·줄간격 160%, 제목 HY헤드라인M 16pt(교육청 공문 첨부 실측). */
const BODY = pt(13);
export const ATTACHMENT_PROFILE: OfficialFormatProfile = {
  title: style('HY헤드라인M', pt(16), 130),
  indentUnit: BODY,
  numbered: {
    levels: [style('휴먼명조', BODY, 160, true), style('휴먼명조', BODY, 160)],
    note: style('휴먼명조', BODY, 160),
    gapBefore: (previous, next) => next === 'l1' && previous !== 'title' ? pt(6) : 0,
    after: pt(2), tableAfter: pt(4),
  },
  gaejosik: moeGaejosik(BODY),
  table: { body: style('휴먼명조', pt(12), 130), head: { ...style('휴먼명조', pt(12), 130, true), fill: '#e6e6e6' } },
  ratio: 100, spacing: 0, page: A4,
};
/** 기안문(별지 제1호서식): 본문 휴먼명조 15pt·줄간격 160%, 행정기관명 HY헤드라인M 22pt, 발신명의 18pt, 결문 맑은 고딕 11pt. */
const R = OFFICIAL_DRAFT_RULES, DRAFT_BODY = pt(R.body.pt);
export const DRAFT_PROFILE: OfficialFormatProfile = {
  title: style(R.head.font, pt(R.head.pt), R.head.line),
  indentUnit: DRAFT_BODY,
  numbered: { levels: [style(R.body.font, DRAFT_BODY, R.body.line)], note: style(R.body.font, DRAFT_BODY, R.body.line), gapBefore: () => 0, after: pt(2), tableAfter: pt(4) },
  table: { body: style(R.body.font, pt(12), 130), head: { ...style(R.body.font, pt(12), 130, true), fill: '#e6e6e6' } },
  draft: {
    organization: style(R.organization.font, pt(R.organization.pt), 100), head: style(R.head.font, pt(R.head.pt), R.head.line),
    sender: style(R.sender.font, pt(R.sender.pt), 100), approval: style(R.approval.font, pt(R.approval.pt), 130), footer: style(R.footer.font, pt(R.footer.pt), R.footer.line),
    organizationAfter: pt(R.organization.afterPt), headAfter: pt(R.head.afterPt), attachmentsBefore: pt(R.attachments.beforePt),
    senderBefore: pt(R.sender.beforePt), senderAfter: pt(R.sender.afterPt), barFill: R.approval.barFill,
  },
  ratio: 100, spacing: 0, page: A4,
};
/** 문서 종류 목록. 새 공문서는 여기에 서식과 분량을 등록하고, 내용은 각 기능의 변환기가 문서 모델로 만든다. */
export const OFFICIAL_DOCUMENT_KINDS: Record<OfficialDocumentKind, OfficialDocumentKindInfo> = {
  'attachment-plan': { label: '붙임 계획서', profile: ATTACHMENT_PROFILE, pageOptions: [1, 2] },
  draft: { label: '기안문', profile: DRAFT_PROFILE, pageOptions: [1, 2, 3] },
};
export const profileOf = (document: OfficialDocument) => OFFICIAL_DOCUMENT_KINDS[document.kind].profile;
/** 계층이 4단계 이상이면 개조식(□ ◦ - ※), 그 미만이면 편람 번호 체계를 쓴다. */
export const usesGaejosik = (depth: number) => depth >= 4;
/** 이 문서가 개조식으로 출력되는지(개조식을 허용하는 문서 종류이고 4단계 이상). */
export const isGaejosik = (document: OfficialDocument) => !!profileOf(document).gaejosik && usesGaejosik(itemDepth(document.body));
export const markerScheme = (profile: OfficialFormatProfile, gaejosik: boolean) => gaejosik && profile.gaejosik ? profile.gaejosik : profile.numbered;
/** 줄의 글자 모양. */
export function lineStyle(profile: OfficialFormatProfile, line: OfficialLine, gaejosik: boolean): TextStyle {
  if (line.kind === 'title') return profile.title;
  if (line.kind === 'table') return profile.table.body;
  if (line.kind === 'approval') return profile.draft!.approval;
  if (line.kind === 'draft') {
    const d = profile.draft!;
    return line.role === 'organization' ? d.organization : line.role === 'sender' ? d.sender : ['to', 'via', 'title'].includes(line.role) ? d.head : profile.numbered.note;
  }
  const scheme = markerScheme(profile, gaejosik);
  if (line.kind === 'note') return scheme.note;
  const level = scheme.levels[Math.min(line.level, scheme.levels.length) - 1];
  // 하위 항목이 없는 단순 나열 문서의 1단계는 목차가 아니므로 굵게 쓰지 않는다.
  return line.level === 1 && !line.heading ? { ...level, bold: false } : level;
}
/** 서식 프로필이 쓰는 글꼴 이름(미리보기 대체 글꼴을 고를 때 쓴다). */
export function profileFonts(profile: OfficialFormatProfile): string[] {
  const d = profile.draft;
  const styles = [profile.title, profile.table.body, profile.table.head, ...[profile.numbered, profile.gaejosik].flatMap(s => s ? [...s.levels, s.note] : []),
    ...(d ? [d.organization, d.head, d.sender, d.approval, d.footer] : [])];
  return [...new Set(styles.map(s => s.font))];
}
export const lineKey = (line: OfficialLine): LineKey => line.kind === 'title' ? 'title' : line.kind === 'table' ? 'table' : line.kind === 'note' ? 'ref'
  : line.kind === 'item' ? `l${Math.min(line.level, 4)}` as LineKey : 'draft';

/** 편람 항목기호(1. → 가. → 1) → 가) → (1) → (가) → ① → ㉮, 편람 51쪽), 그리고 4단계 이상 문서의 개조식 체계. */
export const OFFICIAL_MARKERS = ['n.', 'k.', 'n)', 'k)', '(n)', '(k)', 'c', 'h'] as const;
export const DEEP_MARKERS = ['□', '◦', '-', '※'] as const;
const KOREAN_ORDER = '가나다라마바사아자차카타파하';
// 하 다음은 거, 너, 더 … → 고, 노 … 처럼 단모음 순으로 이어 간다(편람 51쪽). 값은 ㅏ에서 각 모음까지의 음절 간격이다.
const VOWEL_STEPS = [0, 4, 8, 13, 18, 20].map(n => n * 28);
const koreanMarker = (index: number) => {
  const round = Math.floor(index / KOREAN_ORDER.length);
  return String.fromCharCode(KOREAN_ORDER.charCodeAt(index % KOREAN_ORDER.length) + VOWEL_STEPS[Math.min(round, VOWEL_STEPS.length - 1)]);
};

/** level(1부터)의 index번째(0부터) 항목 기호. 개조식이면 □ ◦ - ※를 쓴다. */
export function officialMarker(level: number, index: number, gaejosik: boolean): string {
  if (gaejosik) return DEEP_MARKERS[Math.min(level, DEEP_MARKERS.length) - 1];
  const pattern = OFFICIAL_MARKERS[(level - 1) % OFFICIAL_MARKERS.length];
  if (pattern === 'c') return String.fromCharCode(0x2460 + Math.min(index, 19));
  if (pattern === 'h') return String.fromCharCode(0x326e + Math.min(index, 13));
  return pattern.replace('n', String(index + 1)).replace('k', koreanMarker(index));
}

// 기호 글자 폭(em). 한컴 글꼴과 맑은 고딕에서 측정해 한글에서 둘째 줄이 내용 첫 글자에 맞도록 한다.
const ADVANCES: Record<string, Record<string, number>> = {
  휴먼명조: { ' ': 0.5, digit: 0.5, '.': 0.27, '(': 0.312, ')': 0.312, '-': 0.5, '※': 1 },
  HY헤드라인M: { ' ': 0.333, digit: 0.583, '.': 0.242, '(': 0.291, ')': 0.294, '-': 0.503, '※': 1 },
  '맑은 고딕': { ' ': 0.352, digit: 0.551, '.': 0.219, '(': 0.305, ')': 0.305, '-': 0.41, '※': 0.8 },
};
/** 글자열 폭(HWPUNIT). 한글·전각 기호는 1em으로 센다. */
export function textAdvance(text: string, size: number, font = '휴먼명조') {
  const table = ADVANCES[font] ?? ADVANCES['휴먼명조'];
  return Math.round([...text].reduce((sum, c) => sum + (/[0-9]/.test(c) ? table.digit : table[c] ?? 1), 0) * size);
}
/** "기호␠" 뒤 내용 첫 글자까지의 내어쓰기 폭(HWPUNIT). 기호가 없으면 0. */
export const markerHang = (marker: string, size: number, font = '휴먼명조') => marker ? textAdvance(`${marker} `, size, font) : 0;
/** 왼쪽 시작점(HWPUNIT): 하위 항목은 바로 위 항목에서 2타(한글 1자)씩 들여 시작한다. */
export const levelIndent = (level: number, size: number) => (level - 1) * size;

export type DraftRole = 'organization' | 'to' | 'via' | 'title' | 'attachment' | 'end' | 'sender' | 'recipients';
export interface ApprovalLayout { signers: string[]; coordinators: string; issue: string; receive?: string; address: string; contact: string }
/** 출력기가 그대로 그리는 줄 단위 배치 결과. */
export type OfficialLine =
  | { kind: 'title'; text: string }
  | { kind: 'item' | 'note'; level: number; marker: string; text: string; heading: boolean; pageBreakBefore: boolean }
  | { kind: 'table'; level: number; columns: OfficialTableColumn[]; rows: string[][] }
  /** 기안문 두문·붙임·끝 표시·발신명의. left·hang은 HWPUNIT. */
  | { kind: 'draft'; role: DraftRole; text: string; left: number; hang: number; spaceBefore: boolean }
  | { kind: 'approval'; layout: ApprovalLayout };

function bodyLines(nodes: OfficialNode[], gaejosik: boolean, nested: boolean): OfficialLine[] {
  const lines: OfficialLine[] = [];
  const walk = (list: OfficialNode[], level: number) => {
    let index = 0;
    // 편람 52~53쪽: 항목이 하나뿐이면 항목 기호를 붙이지 않는다(□ ◦ - ※ 개조식은 기호를 유지한다).
    const single = !gaejosik && list.filter(n => n.kind === 'item').length === 1;
    for (const node of list) {
      if (node.kind === 'item') {
        const marker = single ? '' : officialMarker(level, index, gaejosik);
        index++;
        lines.push({ kind: 'item', level, marker, text: marker ? `${marker} ${node.text}` : node.text, heading: level === 1 && nested, pageBreakBefore: !!node.pageBreakBefore });
        walk(node.children ?? [], level + 1);
      } else if (node.kind === 'note') lines.push({ kind: 'note', level, marker: '※', text: `※ ${node.text}`, heading: false, pageBreakBefore: false });
      else lines.push({ kind: 'table', level, columns: node.columns, rows: node.rows });
    }
  };
  walk(nodes, 1);
  return lines;
}

/** 기안문 배치: 두문 → 본문(편람 번호) → 붙임 → 끝 표시 → 발신명의 → 수신자 → 결문. */
function layoutDraft(document: DraftDocument): OfficialLine[] {
  const { head, attachments: att, endMark, recipients, approval: approvalRule, footer } = OFFICIAL_DRAFT_RULES;
  const size = DRAFT_BODY, font = R.body.font;
  const line = (role: DraftRole, text: string, left = 0, hang = 0, spaceBefore = false): OfficialLine => ({ kind: 'draft', role, text, left, hang, spaceBefore });
  const headLine = (role: 'to' | 'via' | 'title', value: string) => {
    const label = `${head.labels[role]}${head.labelGap}`;
    return line(role, `${label}${value.trim()}`, 0, textAdvance(label, size, font));
  };
  const lines: OfficialLine[] = [line('organization', document.organization.trim()), headLine('to', document.to)];
  if (document.via?.trim()) lines.push(headLine('via', document.via));
  lines.push(headLine('title', document.title));
  const body = bodyLines(document.body, false, false);
  lines.push(...body);
  // 끝 표시(시행규칙 제4조⑤): 붙임이 있으면 붙임 끝에, 없으면 본문 마지막 글자에서 2타 띄워서. 표로 끝나면 다음 줄 왼쪽 기본선에서.
  const end = `${endMark.gap}${endMark.text}`;
  const list = (document.attachments ?? []).map(a => a.trim()).filter(Boolean);
  if (list.length) {
    const label = `${att.label}${att.labelGap}`, labelWidth = textAdvance(label, size, font);
    if (list.length === 1) lines.push(line('attachment', `${label}${list[0]}${end}`, 0, labelWidth, true));
    else list.forEach((name, i) => {
      const marker = `${i + 1}.`, text = `${marker} ${name}${i === list.length - 1 ? end : ''}`;
      // 붙임  1. ○○ / (붙임 너비만큼 들여) 2. ○○ — 둘째 줄은 명칭 첫 글자에 맞춘다.
      lines.push(i === 0 ? line('attachment', `${label}${text}`, 0, labelWidth + markerHang(marker, size, font), true) : line('attachment', text, labelWidth, markerHang(marker, size, font)));
    });
  } else {
    const last = [...lines].reverse().find(l => l.kind !== 'table');
    if (body.length && body.at(-1)!.kind !== 'table' && last && (last.kind === 'item' || last.kind === 'note')) last.text += end;
    else lines.push(line('end', end));
  }
  lines.push(line('sender', document.sender.trim(), 0, 0, true));
  if (document.to.trim() === '수신자 참조' && document.recipients?.length) {
    const label = `${recipients.label}${recipients.labelGap}`;
    lines.push(line('recipients', `${label}${document.recipients.join(recipients.separator)}`, 0, textAdvance(label, size, font)));
  }
  const signer = (s: { title: string; name?: string; mark?: string; opinion?: boolean }) => `${s.mark ?? ''}${s.title}${s.opinion ? approvalRule.opinionText : ''}${s.name ? `  ${s.name}` : ''}`;
  const { docNo, contact, approval } = document, sep = footer.separator;
  lines.push({
    kind: 'approval', layout: {
      signers: [approval.drafter, ...(approval.reviewers ?? []), approval.approver].map(signer),
      coordinators: approval.coordinators?.length ? `${approvalRule.coordinatorLabel}  ${approval.coordinators.join(' / ')}` : approvalRule.coordinatorLabel,
      issue: `${footer.issue}  ${docNo.issue} (${docNo.issueDate})`,
      receive: docNo.receive ? `${footer.receive}  ${docNo.receive} (${docNo.receiveDate ?? ''})` : undefined,
      address: `${footer.zip} ${contact.zip ?? ''}  ${contact.address ?? ''}${sep}${contact.homepage ?? ''}`,
      contact: `${footer.phone} ${contact.phone ?? ''}  ${footer.fax} ${contact.fax ?? ''}${sep}${contact.email ?? ''}${sep}${contact.disclosure}`,
    },
  });
  return lines;
}

/** 문서 모델을 항목 기호·계층이 정해진 줄로 펼친다. 하위 항목이 있는 문서의 대항목(1단계)은 목차로 다음 줄과 붙여 둔다. */
export function layoutOfficialDocument(document: OfficialDocument): OfficialLine[] {
  if (document.kind === 'draft') return layoutDraft(document);
  const depth = itemDepth(document.body);
  return [{ kind: 'title', text: document.title.trim() }, ...bodyLines(document.body, isGaejosik(document), depth > 1)];
}
/** 표 머리행까지 포함한 셀 글자 목록(보존 검사·본문 읽기용). */
export const tableCells = (line: Extract<OfficialLine, { kind: 'table' }>) => [line.columns.map(c => c.label), ...line.rows];
/** 결문 틀의 글자 목록(보존 검사·본문 읽기용). */
export const approvalTexts = (layout: ApprovalLayout) => [...layout.signers, layout.coordinators, layout.issue, ...(layout.receive ? [layout.receive] : []), layout.address, layout.contact];
