import { afterEach, expect, test, vi } from 'vitest';
import { runPlanDocument } from '../../src/features/schoolDocuments/planRhwp';

class FakeWorker {
  static latest: FakeWorker;
  onmessage?: (e: { data: unknown }) => void;
  onerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { FakeWorker.latest = this; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
test('취소와 제한 시간 초과는 WASM worker를 종료하고 늦은 응답을 무시한다', async () => {
  vi.stubGlobal('Worker', FakeWorker); vi.useFakeTimers();
  const controller = new AbortController();
  const pending = runPlanDocument({ action: 'import', bytes: new Uint8Array([1]) }, controller.signal);
  const cancelled = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  const first = FakeWorker.latest; controller.abort();
  first.onmessage?.({ data: { ok: true, bytes: new Uint8Array([2]), svgs: [], pageCount: 1 } });
  await cancelled; expect(first.terminate).toHaveBeenCalledTimes(1);
  const timed = runPlanDocument({ action: 'import', bytes: new Uint8Array([1]) });
  const rejected = expect(timed).rejects.toThrow('시간이 초과');
  await vi.advanceTimersByTimeAsync(30000); await rejected;
  expect(FakeWorker.latest.terminate).toHaveBeenCalledTimes(1);
});
test('엔진 로딩 오류 뒤 새 worker로 재시도하고 성공한 자원을 정리한다', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const failed = runPlanDocument({ action: 'import', bytes: new Uint8Array([1]) });
  const error = expect(failed).rejects.toThrow('엔진을 시작하지 못했습니다');
  FakeWorker.latest.onerror?.(); await error;
  const retried = runPlanDocument({ action: 'import', bytes: new Uint8Array([1]) });
  const result = { bytes: new Uint8Array([2]), svgs: [], pageCount: 1 };
  FakeWorker.latest.onmessage?.({ data: { ok: true, ...result } });
  expect(await retried).toEqual(result); expect(FakeWorker.latest.terminate).toHaveBeenCalledTimes(1);
});
