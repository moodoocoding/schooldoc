import type { OfficialDocument } from './model';
import type { RenderedDocument } from './rhwpWriter';
export type RhwpRequest = { action: 'render'; document: OfficialDocument; maxPages: number } | { action: 'import'; bytes: Uint8Array<ArrayBuffer> };
export type RhwpResponse = ({ ok: true } & RenderedDocument) | { ok: false; message: string };

/** One worker per operation bounds document lifetime; termination cancels synchronous WASM. */
export function runRhwp(request: RhwpRequest, signal?: AbortSignal): Promise<RenderedDocument> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./rhwp.worker.ts', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (result?: RenderedDocument, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout); signal?.removeEventListener('abort', abort); worker.terminate();
      if (error) reject(error); else resolve(result!);
    };
    const abort = () => finish(undefined, signal?.reason ?? new DOMException('작업을 취소했습니다.', 'AbortError'));
    const timeout = setTimeout(() => finish(undefined, new Error('문서 처리 시간이 초과됐습니다. 입력은 유지됩니다. 다시 시도하거나 공문 본문을 붙여 넣어 주세요.')), 30000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => finish(undefined, new Error('문서 엔진을 시작하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'));
    worker.onmessageerror = () => finish(undefined, new Error('문서 결과를 받지 못했습니다. 다시 시도해 주세요.'));
    worker.onmessage = (event: MessageEvent<RhwpResponse>) => {
      if (!event.data.ok) finish(undefined, new Error(event.data.message));
      else finish({ bytes: event.data.bytes, svgs: event.data.svgs, pageCount: event.data.pageCount });
    };
    try { worker.postMessage(request); } catch (error) { finish(undefined, error); }
  });
}
