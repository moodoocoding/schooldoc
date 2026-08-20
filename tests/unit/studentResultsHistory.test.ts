import { describe, expect, test } from 'vitest';
import {
  HISTORY_LIMIT,
  isTextEntryTarget,
  isUndoShortcut,
  rememberSnapshot,
  takeLastSnapshot,
  type FormSnapshot,
  type HistoryEntry,
} from '../../src/features/studentResults/studentResultsHistory';

const snapshot = (title: string): FormSnapshot => ({
  title,
  description: '',
  columns: [{ id: 'score', label: '평가 점수', maxScore: 100, description: '' }],
  recipients: [],
});
const entry = (label: string): HistoryEntry => ({ label, snapshot: snapshot(label) });

describe('되돌리기 기록', () => {
  test('쌓은 순서대로 마지막 것부터 돌려준다', () => {
    const stack = rememberSnapshot(rememberSnapshot([], entry('첫 변경')), entry('두 번째 변경'));
    const { entry: last, rest } = takeLastSnapshot(stack);
    expect(last?.label).toBe('두 번째 변경');
    expect(takeLastSnapshot(rest).entry?.label).toBe('첫 변경');
  });

  test('빈 기록에서는 아무것도 꺼내지 않는다', () => {
    expect(takeLastSnapshot([])).toEqual({ entry: null, rest: [] });
  });

  test('한도를 넘으면 오래된 것부터 버리고 최근 것을 남긴다', () => {
    const stack = Array.from({ length: HISTORY_LIMIT + 5 }).reduce<HistoryEntry[]>(
      (current, _, index) => rememberSnapshot(current, entry(`변경 ${index}`)),
      [],
    );
    expect(stack).toHaveLength(HISTORY_LIMIT);
    expect(takeLastSnapshot(stack).entry?.label).toBe(`변경 ${HISTORY_LIMIT + 4}`);
    expect(stack[0].label).toBe('변경 5');
  });

  test('기록은 원본과 끊겨 있어 나중 수정에 딸려 바뀌지 않는다', () => {
    const original = snapshot('원본');
    const stack = rememberSnapshot([], { label: '삭제', snapshot: structuredClone(original) });
    original.title = '나중에 고친 제목';
    expect(takeLastSnapshot(stack).entry?.snapshot.title).toBe('원본');
  });
});

describe('되돌리기 단축키', () => {
  test('Ctrl+Z와 Cmd+Z를 모두 받는다', () => {
    expect(isUndoShortcut({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false })).toBe(true);
    expect(isUndoShortcut({ key: 'z', ctrlKey: false, metaKey: true, shiftKey: false })).toBe(true);
    expect(isUndoShortcut({ key: 'Z', ctrlKey: true, metaKey: false, shiftKey: false })).toBe(true);
  });

  test('수식키 없는 z와 다시 실행(Shift+Ctrl+Z)은 아니다', () => {
    expect(isUndoShortcut({ key: 'z', ctrlKey: false, metaKey: false, shiftKey: false })).toBe(false);
    expect(isUndoShortcut({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: true })).toBe(false);
  });
});

const target = (tagName: string, isContentEditable = false) => (
  { tagName, isContentEditable } as unknown as EventTarget
);

describe('입력칸 판별', () => {
  test('입력칸 안에서는 브라우저의 글자 되돌리기를 건드리지 않는다', () => {
    expect(isTextEntryTarget(target('INPUT'))).toBe(true);
    expect(isTextEntryTarget(target('TEXTAREA'))).toBe(true);
    expect(isTextEntryTarget(target('SELECT'))).toBe(true);
    expect(isTextEntryTarget(target('DIV', true))).toBe(true);
  });

  test('행을 지운 뒤 포커스가 가는 자리에서는 우리가 받는다', () => {
    expect(isTextEntryTarget(target('BODY'))).toBe(false);
    expect(isTextEntryTarget(target('BUTTON'))).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});

describe('성명과 확인번호가 겹치면 만들 수 없다', () => {
  // 확인번호는 임의 솔트를 쓰는 bcrypt라 저장한 뒤에는 대조할 수 없다. 그래서 만드는
  // 시점에 막아야 한다. 서버(student-results-admin)도 같은 규칙을 다시 검사한다.
  const authKeys = (recipients: { name: string; verificationCode: string }[]) => (
    recipients.map((recipient) => `${recipient.name.trim()}::${recipient.verificationCode.trim()}`)
  );
  const firstDuplicate = (keys: string[]) => keys.findIndex((key, index) => keys.indexOf(key) !== index);

  test('동명이인이 같은 확인번호를 쓰면 걸린다', () => {
    const keys = authKeys([
      { name: '김하늘', verificationCode: '4821' },
      { name: '박도윤', verificationCode: '7315' },
      { name: '김하늘', verificationCode: '4821' },
    ]);
    expect(firstDuplicate(keys)).toBe(2);
  });

  test('동명이인이라도 확인번호가 다르면 지나간다', () => {
    const keys = authKeys([
      { name: '김하늘', verificationCode: '4821' },
      { name: '김하늘', verificationCode: '9902' },
    ]);
    expect(firstDuplicate(keys)).toBe(-1);
  });

  test('같은 확인번호라도 이름이 다르면 지나간다', () => {
    const keys = authKeys([
      { name: '김하늘', verificationCode: '4821' },
      { name: '박도윤', verificationCode: '4821' },
    ]);
    expect(firstDuplicate(keys)).toBe(-1);
  });
});
