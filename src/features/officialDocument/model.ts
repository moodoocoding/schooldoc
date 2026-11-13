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

export type OfficialDocumentKind = 'attachment-plan' | 'attachment-report';
/** 붙임 계획서·보고서: 제목과 본문 항목. 기안문 두문·결문은 K-에듀파인이 만들므로 다루지 않는다. */
export interface AttachmentDocument { kind: 'attachment-plan' | 'attachment-report'; title: string; body: OfficialNode[] }
export type OfficialDocument = AttachmentDocument;

export const item = (text: string, children?: OfficialNode[], options: { pageBreakBefore?: boolean } = {}): OfficialItem => ({ kind: 'item', text, ...(children?.length ? { children } : {}), ...options });
export const note = (text: string): OfficialNote => ({ kind: 'note', text });
export const table = (columns: OfficialTableColumn[], rows: string[][]): OfficialTable => ({ kind: 'table', columns, rows });

/** 항목 계층의 최대 깊이. 표와 ※ 참고는 계층으로 세지 않는다. */
export function itemDepth(nodes: OfficialNode[]): number {
  return nodes.reduce((max, node) => node.kind === 'item' ? Math.max(max, 1 + itemDepth(node.children ?? [])) : max, 0);
}
