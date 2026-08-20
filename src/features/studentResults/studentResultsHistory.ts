import type { ResultColumn, ResultRecipientDraft } from './types';

export type EditableResultColumn = Omit<ResultColumn, 'maxScore'> & { maxScore: number | '' };

export interface FormSnapshot {
  title: string;
  description: string;
  columns: EditableResultColumn[];
  recipients: ResultRecipientDraft[];
}

export interface HistoryEntry {
  /** 무엇을 되돌리는지 화면에 그대로 보여 줄 말. "3번 학생 삭제" */
  label: string;
  snapshot: FormSnapshot;
}

/**
 * 학급 하나를 손으로 채우는 화면이라, 잘못 지운 것을 되돌리지 못하면 처음부터 다시 입력해야
 * 한다. 되돌릴 수 있는 횟수는 한 학급을 다루기에 넉넉한 선에서 끊는다.
 */
export const HISTORY_LIMIT = 30;

export const rememberSnapshot = (stack: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] => (
  [...stack, entry].slice(-HISTORY_LIMIT)
);

export const takeLastSnapshot = (stack: HistoryEntry[]) => ({
  entry: stack.length > 0 ? stack[stack.length - 1] : null,
  rest: stack.slice(0, -1),
});

/** 되돌리기 단축키인지 본다. 입력칸 안에서는 브라우저의 글자 되돌리기를 그대로 둔다. */
export const isUndoShortcut = (event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey'>) => (
  event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey
);

const TEXT_ENTRY_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

export const isTextEntryTarget = (target: EventTarget | null) => {
  const element = target as { tagName?: unknown; isContentEditable?: unknown } | null;
  if (!element) return false;
  if (element.isContentEditable === true) return true;
  return TEXT_ENTRY_TAGS.includes(String(element.tagName ?? '').toUpperCase());
};
