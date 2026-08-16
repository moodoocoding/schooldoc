import { describe, expect, it, vi } from 'vitest';
import {
  DocumentPreparingError,
  PREPARING_STATUS,
  isPreparing,
  retryDelay,
  retryLoad,
  shouldRetry,
} from '../../src/features/consentForms/consentDocumentReady';

const withStatus = (status: number) => Object.assign(new Error(`status ${status}`), { status });
const noWait = async () => {};

describe('consent document ready', () => {
  it('준비 중 상태를 구분한다', () => {
    expect(isPreparing(new DocumentPreparingError())).toBe(true);
    expect(isPreparing(withStatus(PREPARING_STATUS))).toBe(true);
    expect(isPreparing(withStatus(404))).toBe(false);
    expect(isPreparing(new Error('network'))).toBe(false);
  });

  it('준비 중과 서버 오류만 다시 시도한다', () => {
    expect(shouldRetry(new DocumentPreparingError())).toBe(true);
    expect(shouldRetry(withStatus(500))).toBe(true);
    expect(shouldRetry(new Error('network'))).toBe(true);
    expect(shouldRetry(withStatus(401))).toBe(false);
    expect(shouldRetry(withStatus(404))).toBe(false);
  });

  it('준비 중에는 더 길게 기다리고 서버 오류 대기는 상한을 둔다', () => {
    expect(retryDelay(0, true)).toBe(2_000);
    expect(retryDelay(5, true)).toBe(2_000);
    expect(retryDelay(0, false)).toBe(700);
    expect(retryDelay(9, false)).toBe(3_000);
  });

  it('준비가 끝나면 결과를 돌려주고 준비 중임을 알린다', async () => {
    const onPreparing = vi.fn();
    const operation = vi.fn()
      .mockRejectedValueOnce(new DocumentPreparingError())
      .mockRejectedValueOnce(new DocumentPreparingError())
      .mockResolvedValue('문서');

    await expect(retryLoad(operation, { attempts: 5, onPreparing, wait: noWait })).resolves.toBe('문서');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(onPreparing).toHaveBeenCalledTimes(2);
  });

  it('다시 시도해도 소용없는 오류는 즉시 던진다', async () => {
    const operation = vi.fn().mockRejectedValue(withStatus(401));
    await expect(retryLoad(operation, { attempts: 5, wait: noWait })).rejects.toThrow('status 401');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('끝까지 준비되지 않으면 마지막 오류를 던져 화면이 멈추지 않게 한다', async () => {
    const operation = vi.fn().mockRejectedValue(new DocumentPreparingError());
    await expect(retryLoad(operation, { attempts: 3, wait: noWait })).rejects.toBeInstanceOf(DocumentPreparingError);
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
