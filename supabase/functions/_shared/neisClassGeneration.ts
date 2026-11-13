import { commentStyleContext } from './neisHelper.ts';
import type { ClassCommentInput, ClassCommentRow } from './neisClassComments.ts';
import { createClassOutputValidator } from './neisClassComments.ts';

export const MAX_CLASS_ATTEMPTS = 4;
type RequestClass = (input: ClassCommentInput, signal: AbortSignal, onRow: (row: ClassCommentRow) => void) => Promise<void>;

/** One class request first. Only rejected/missing rows are rewritten, at most three times. */
export async function generateClassWithRepairs(
  input: ClassCommentInput, signal: AbortSignal, requestClass: RequestClass, onRow: (row: ClassCommentRow) => void,
) {
  const ids = input.groups.flatMap((group) => group.ids);
  const accepted = new Map<string, ClassCommentRow>();
  let pending = new Set(ids);
  let next = input;
  for (let attempt = 0; attempt < MAX_CLASS_ATTEMPTS; attempt++) {
    signal.throwIfAborted();
    const rejected = new Map<string, ClassCommentRow>();
    const received = new Set<string>();
    // Use the same checks at both boundaries, including when an older server responds.
    const validator = createClassOutputValidator(next);
    await requestClass(next, signal, (receivedRow) => {
      signal.throwIfAborted();
      const row = receivedRow.comment && !receivedRow.error ? validator.accept({
        id: receivedRow.id, sentences: receivedRow.comment.sentences.map((sentence) => ({ a: Number(sentence.assessmentId), t: sentence.text })),
      }) : receivedRow;
      if (!pending.has(row.id) || received.has(row.id)) throw new Error('생성된 평어의 학생 연결을 확인해 주세요.');
      received.add(row.id);
      if (row.comment && !row.error) {
        accepted.set(row.id, row);
        onRow(row);
      } else rejected.set(row.id, row);
    });
    signal.throwIfAborted();
    for (const id of pending) if (!received.has(id)) rejected.set(id, { id, comment: null, error: '이 학생의 평어가 응답에 없습니다.' });
    if (!rejected.size) return;
    if (attempt === MAX_CLASS_ATTEMPTS - 1) {
      for (const row of rejected.values()) onRow({ ...row, error: `${row.error} 자동 재작성을 마치지 못했습니다. 다시 시도해 주세요.` });
      return;
    }
    pending = new Set(rejected.keys());
    const kept = commentStyleContext([...accepted.values()].map((row) => row.comment!.sentences.map((sentence) => sentence.text).join(' ')));
    next = {
      ...input,
      groups: input.groups.map((group) => ({ ...group, ids: group.ids.filter((id) => pending.has(id)) })).filter((group) => group.ids.length),
      usedStarts: [...new Set([...(input.usedStarts ?? []), ...kept.usedStarts])],
      priorSentences: [...new Set([...(input.priorSentences ?? []), ...kept.priorSentences])],
      revisions: [...rejected.values()].flatMap((row) => row.rejectedText
        ? [{ id: row.id, text: row.rejectedText, reason: row.error.slice(0, 400) }]
        : (input.revisions ?? []).filter((revision) => revision.id === row.id)),
    };
  }
}
