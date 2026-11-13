import { createBehaviorValidator, validateBehaviorInput } from '../_shared/neisBehavior.ts';
import type { BehaviorEvent, BehaviorInput } from '../_shared/neisBehavior.ts';
import { createClassRowReader } from '../_shared/neisClassRows.ts';
import { readJsonEvents } from '../_shared/neisEvents.ts';
import { NeisError } from '../neis-helper/core.ts';
import { buildBehaviorAiRequest } from './prompts.ts';

export async function requestBehaviorStream(input: BehaviorInput, key: string, model: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const disconnect = new AbortController();
  const upstream = AbortSignal.any([signal, disconnect.signal, AbortSignal.timeout(140_000)]);
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBehaviorAiRequest(input, model)), signal: upstream,
  });
  if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new NeisError(response.status === 429 ? 429 : 502, response.status === 429 ? 'AI 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.' : '작성 서버에 연결하지 못했습니다. 입력은 유지됩니다.');
  }
  const body = response.body;
  const parser = createClassRowReader();
  const validator = createBehaviorValidator(input);
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(output) {
      const send = (event: BehaviorEvent) => { if (!disconnect.signal.aborted && !signal.aborted) output.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); };
      try {
        let completed = false;
        for await (const raw of readJsonEvents(body)) {
          const event = raw as { type?: string; delta?: string };
          if (upstream.aborted) throw new Error('Aborted');
          if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
            for (const row of parser.push(event.delta)) send({ type: 'row', row: validator.accept(row) });
          } else if (event.type === 'response.completed') { completed = true; break; }
          else if (['error', 'response.failed', 'response.incomplete', 'response.refusal.delta'].includes(event.type ?? '')) throw new Error('Generation failed');
        }
        if (!completed || !parser.ended) throw new Error('Interrupted');
        for (const row of validator.missing()) send({ type: 'row', row });
        send({ type: 'done' });
      } catch {
        send({ type: 'error', message: '작성 연결이 중단되었습니다. 도착한 내용은 유지되며 미완료 학생만 다시 요청할 수 있습니다.' });
      } finally { if (!disconnect.signal.aborted) output.close(); }
    },
    cancel() { disconnect.abort(); },
  });
}

export interface BehaviorDependencies {
  authorize(req: Request): Promise<string>;
  consumeQuota(id: string): Promise<boolean>;
  generate(input: BehaviorInput, signal: AbortSignal): Promise<ReadableStream<Uint8Array>>;
}
export function createBehaviorHandler(deps: BehaviorDependencies) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    try {
      if (req.method !== 'POST') throw new NeisError(405, 'POST 요청만 지원합니다.');
      const owner = await deps.authorize(req);
      if (!req.headers.get('content-type')?.includes('application/json')) throw new NeisError(415, '요청 형식을 확인해 주세요.');
      const reader = req.body?.getReader();
      if (!reader) throw new NeisError(400, '학생 자료가 없습니다.');
      let text = '';
      let size = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 800_000) { await reader.cancel(); throw new NeisError(413, '학생 자료가 너무 큽니다. 메모 분량을 줄여 주세요.'); }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
      let input: BehaviorInput;
      try { input = validateBehaviorInput(JSON.parse(text)); }
      catch (error) { throw new NeisError(422, error instanceof SyntaxError ? '학생 자료를 읽지 못했습니다.' : (error as Error).message); }
      if (!(await deps.consumeQuota(owner))) throw new NeisError(429, 'AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
      const stream = await deps.generate(input, req.signal);
      return new Response(stream, { headers: { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform' } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof NeisError ? error.message : '작성 서버에 연결하지 못했습니다. 입력을 유지한 채 다시 시도해 주세요.' }), { status: error instanceof NeisError ? error.status : 500, headers });
    }
  };
}
