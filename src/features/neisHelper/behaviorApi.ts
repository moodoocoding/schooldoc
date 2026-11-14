import { supabase } from '../../utils/supabaseClient';
import { readJsonEvents } from '../../../supabase/functions/_shared/neisEvents';
import { createBehaviorValidator, validateBehaviorInput } from '../../../supabase/functions/_shared/neisBehavior';
import type { BehaviorInput, BehaviorRow } from '../../../supabase/functions/_shared/neisBehavior';

export async function generateBehavior(input: BehaviorInput, signal: AbortSignal, onRow: (row: BehaviorRow) => void) {
  validateBehaviorInput(input);
  if (!supabase) throw new Error('서버 연결 설정을 확인해 주세요.');
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error('로그인 후 다시 시도해 주세요.');
  const { data, error } = await supabase.functions.invoke('neis-behavior', { body: input, headers: { Accept: 'text/event-stream' }, signal: AbortSignal.any([signal, AbortSignal.timeout(150_000)]) });
  if (error) {
    let message = '작성 서버에 연결하지 못했습니다. 입력을 유지한 채 다시 시도해 주세요.';
    if (error.context instanceof Response) try { const detail = await error.context.json(); if (typeof detail.error === 'string') message = detail.error; } catch { /* safe fallback */ }
    throw new Error(message);
  }
  if (!(data instanceof Response) || !data.body) throw new Error('작성 응답을 열지 못했습니다.');
  const validator = createBehaviorValidator(input);
  for await (const raw of readJsonEvents(data.body)) {
    signal.throwIfAborted();
    const event = raw as { type?: string; row?: BehaviorRow; message?: string };
    if (event.type === 'row') {
      const row = validator.accept(event.row);
      onRow({ ...row, error: event.row?.error || row.error });
    } else if (event.type === 'error') throw new Error(event.message || '작성 연결이 중단되었습니다.');
    else if (event.type === 'done') {
      for (const row of validator.missing()) onRow(row);
      return;
    }
  }
  throw new Error('작성 연결이 중단되었습니다. 도착한 내용은 유지됩니다.');
}
