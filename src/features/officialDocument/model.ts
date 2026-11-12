/**
 * 공문 문서 모델: 계획 계층(문서 종류별 작성기)이 만들고 출력 계층(HWPX·미리보기)이 읽는 공통 표현.
 * 항목은 트리로만 담는다. 항목 기호·들여쓰기·글꼴은 저장하지 않고 출력할 때 계층 깊이와 서식 프로필로 정한다.
 */
export interface OfficialItem {
  kind: 'item';
  text: string;
  children?: OfficialNode[];
  /** 이 항목부터 새 쪽에서 시작한다. 글자 내용으로 쪽을 나누지 않는다. */
  pageBreakBefore?: boolean;
}
export interface OfficialTableColumn { label: string; width: number; align?: 'left' | 'center' | 'right' }
export interface OfficialTable { kind: 'table'; columns: OfficialTableColumn[]; rows: string[][] }
/** ※ 참고 표시. 항목 번호를 차지하지 않는다. */
export interface OfficialNote { kind: 'note'; text: string }
export type OfficialNode = OfficialItem | OfficialTable | OfficialNote;

export type OfficialDocumentKind = 'attachment-plan' | 'draft';
/** 붙임 계획서·보고서: 제목과 본문 항목. */
export interface AttachmentDocument { kind: 'attachment-plan'; title: string; body: OfficialNode[] }

/** 기안문 결재란의 한 사람. 서명란은 성명이 있을 때만 채운다. */
export interface DraftSigner { title: string; name?: string; /** 기안자 표시 ★ 등 */ mark?: string; /** 검토자 의견 있음 */ opinion?: boolean }
export const DRAFT_DISCLOSURES = ['공개', '부분공개', '비공개'] as const;
/**
 * 기안문·시행문(행정업무규정 시행규칙 별지 제1호서식): 두문(행정기관명·수신·경유·제목), 본문, 결문(발신명의·결재란·시행·주소·공개 구분).
 * 끝 표시와 붙임 표시는 출력 계층이 붙인다.
 */
export interface DraftDocument {
  kind: 'draft';
  organization: string;
  /** 수신: 기관·직위, "내부결재", 또는 "수신자 참조"(이때 recipients 사용) */
  to: string;
  via?: string;
  title: string;
  body: OfficialNode[];
  attachments?: string[];
  sender: string;
  recipients?: string[];
  approval: { drafter: DraftSigner; reviewers?: DraftSigner[]; approver: DraftSigner; coordinators?: string[] };
  docNo: { issue: string; issueDate: string; receive?: string; receiveDate?: string };
  contact: { zip?: string; address?: string; homepage?: string; phone?: string; fax?: string; email?: string; disclosure: typeof DRAFT_DISCLOSURES[number] };
}
export type OfficialDocument = AttachmentDocument | DraftDocument;

export const item = (text: string, children?: OfficialNode[], options: { pageBreakBefore?: boolean } = {}): OfficialItem => ({ kind: 'item', text, ...(children?.length ? { children } : {}), ...options });
export const note = (text: string): OfficialNote => ({ kind: 'note', text });
export const table = (columns: OfficialTableColumn[], rows: string[][]): OfficialTable => ({ kind: 'table', columns, rows });

/** 항목 계층의 최대 깊이. 표와 ※ 참고는 계층으로 세지 않는다. */
export function itemDepth(nodes: OfficialNode[]): number {
  return nodes.reduce((max, node) => node.kind === 'item' ? Math.max(max, 1 + itemDepth(node.children ?? [])) : max, 0);
}
