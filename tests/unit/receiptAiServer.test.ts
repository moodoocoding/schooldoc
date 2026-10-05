import { describe, expect, test, vi } from 'vitest';
import { authorizeReceiptRequest, buildReceiptRequest, createReceiptHandler, readUpload, ReceiptError, requestReceiptAnalysis, validateReceipts } from '../../supabase/functions/receipt-analyze/core';

const upload = { mimeType: 'application/pdf', data: btoa('%PDF-1.7\n') };
const row = { spentAt: '2026-09-08', merchant: '문구점', amount: 32500, currency: 'KRW', description: '문구', page: 1, warnings: [] };
const request = (body: unknown = upload) => new Request('https://local.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const response = (data: unknown = { receipts: [row] }) => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }));

describe('OpenAI 영수증 서버 경계', () => {
  test('일반 교사의 검증된 사용자 ID로만 한도와 분석을 처리한다', async () => {
    const req = request({ ...upload, userId: 'spoofed-owner', role: 'admin' });
    req.headers.set('Authorization', 'Bearer verified-test-token');
    const verifyUser = vi.fn(async () => ({ data: { user: { id: 'ordinary-teacher', is_anonymous: false } }, error: null }));
    const consumeQuota = vi.fn(async () => true), analyze = vi.fn(async () => [row]);
    const handler = createReceiptHandler({ authorize: req => authorizeReceiptRequest(req, verifyUser), consumeQuota, analyze });
    expect((await handler(req)).status).toBe(200);
    expect(verifyUser).toHaveBeenCalledWith('verified-test-token');
    expect(consumeQuota).toHaveBeenCalledWith('ordinary-teacher');
    expect(analyze).toHaveBeenCalledOnce();
  });
  test('인증 없는 요청은 사용자 확인과 한도를 호출하지 않는다', async () => {
    const verifyUser = vi.fn(), consumeQuota = vi.fn(), analyze = vi.fn();
    const handler = createReceiptHandler({ authorize: req => authorizeReceiptRequest(req, verifyUser), consumeQuota, analyze });
    expect((await handler(request())).status).toBe(401);
    expect(verifyUser).not.toHaveBeenCalled(); expect(consumeQuota).not.toHaveBeenCalled(); expect(analyze).not.toHaveBeenCalled();
  });
  test.each(['invalid', 'missing-user', 'anonymous', 'verification-error'])('인증 %s 상태는 AI와 한도를 호출하지 않는다', async state => {
    const req = request(); req.headers.set('Authorization', 'Bearer test-token');
    const verifyUser = vi.fn(async () => {
      if (state === 'verification-error') throw new Error('sensitive-token');
      return { data: { user: state === 'missing-user' ? null : { id: 'u', is_anonymous: state === 'anonymous' } }, error: state === 'invalid' ? new Error('sensitive-token') : null };
    });
    const consumeQuota = vi.fn(), analyze = vi.fn();
    const handler = createReceiptHandler({ authorize: req => authorizeReceiptRequest(req, verifyUser), consumeQuota, analyze });
    const result = await handler(req);
    expect(result.status).toBe(state === 'anonymous' ? 403 : 401);
    expect(await result.text()).not.toContain('sensitive-token');
    expect(consumeQuota).not.toHaveBeenCalled(); expect(analyze).not.toHaveBeenCalled();
  });
  test('PDF 원본과 strict schema를 전송하고 응답 저장을 끈다', () => {
    const body = buildReceiptRequest(upload, 'test-model');
    expect(body).toMatchObject({ model: 'test-model', store: false, text: { format: { strict: true, type: 'json_schema' } } });
    expect(body.input[0].content[1]).toMatchObject({ type: 'input_file', filename: 'receipt.pdf', file_data: 'data:application/pdf;base64,' + upload.data });
  });
  test('이미지는 고해상도 분석 입력으로 구성한다', () => {
    expect(buildReceiptRequest({ mimeType: 'image/png', data: 'test' }, 'test').input[0].content[1]).toMatchObject({ type: 'input_image', detail: 'high' });
  });
  test('인증 실패 시 파일·외부 API·호출 한도를 처리하지 않는다', async () => {
    const analyze = vi.fn(), consumeQuota = vi.fn();
    const handler = createReceiptHandler({ authorize: async () => { throw new ReceiptError(401, '로그인 필요'); }, consumeQuota, analyze });
    expect((await handler(request())).status).toBe(401);
    expect(analyze).not.toHaveBeenCalled(); expect(consumeQuota).not.toHaveBeenCalled();
  });
  test('한도 확인 오류에서도 AI 호출을 하지 않는다', async () => {
    const analyze = vi.fn();
    const handler = createReceiptHandler({ authorize: async () => 'u', consumeQuota: async () => { throw new ReceiptError(503, '제한 확인 실패'); }, analyze });
    expect((await handler(request())).status).toBe(503); expect(analyze).not.toHaveBeenCalled();
  });
  test('호출 제한 실패 시 AI 호출을 하지 않는다', async () => {
    const analyze = vi.fn();
    const handler = createReceiptHandler({ authorize: async () => 'u', consumeQuota: async () => false, analyze });
    expect((await handler(request())).status).toBe(429); expect(analyze).not.toHaveBeenCalled();
  });
  test('유효한 응답만 반환한다', async () => {
    const handler = createReceiptHandler({ authorize: async () => 'u', consumeQuota: async () => true, analyze: async () => [row] });
    const result = await handler(request());
    expect(result.headers.get('cache-control')).toBe('no-store'); expect(await result.json()).toEqual({ receipts: [row] });
  });
  test('확장자 위장, 잘못된 base64, 지원하지 않는 형식을 거부한다', async () => {
    await expect(readUpload(request({ ...upload, data: btoa('not a pdf') }))).rejects.toMatchObject({ status: 415 });
    await expect(readUpload(request({ ...upload, data: '!!!!' }))).rejects.toMatchObject({ status: 400 });
    await expect(readUpload(request({ ...upload, mimeType: 'image/svg+xml' }))).rejects.toMatchObject({ status: 415 });
  });
  test('큰 파일은 본문 읽기 전에 거부한다', async () => {
    const req = request(); req.headers.set('content-length', '20000000');
    await expect(readUpload(req)).rejects.toMatchObject({ status: 413 });
  });
  test('누락된 값은 추정하지 않으며 외화는 환산하지 않는다', () => {
    expect(validateReceipts({ receipts: [{ ...row, spentAt: null, merchant: null, amount: null }] })[0]).toMatchObject({ spentAt: null, merchant: null, amount: null });
    expect(validateReceipts({ receipts: [{ ...row, currency: 'USD' }] })[0].amount).toBeNull();
    expect(validateReceipts({ receipts: [{ ...row, spentAt: '2026-02-30' }] })[0].spentAt).toBeNull();
  });
  test.each([-1, 0, 3.14, 100000001])('잘못된 금액 %s를 거부한다', amount => {
    expect(() => validateReceipts({ receipts: [{ ...row, amount }] })).toThrow();
  });
  test('빈 결과·잘못된 페이지·경고 형식을 거부한다', () => {
    expect(() => validateReceipts({ receipts: [] })).toThrow();
    expect(() => validateReceipts({ receipts: [{ ...row, page: 11 }] })).toThrow();
    expect(() => validateReceipts({ receipts: [{ ...row, warnings: 'bad' }] })).toThrow();
  });
  test('API 결과를 구조화하고 API 키는 서버 요청 헤더에만 사용한다', async () => {
    const fetcher = vi.fn(async () => response());
    expect(await requestReceiptAnalysis(upload, 'test-only-secret', 'test-model', fetcher)).toEqual([row]);
    const init = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init[1].headers).toMatchObject({ Authorization: 'Bearer test-only-secret' });
    expect(init[1].body).not.toContain('test-only-secret');
  });
  test('미완료·거부 응답을 성공으로 처리하지 않는다', async () => {
    for (const body of [{ status: 'incomplete' }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }]) {
      await expect(requestReceiptAnalysis(upload, 'test', 'test', async () => new Response(JSON.stringify(body)))).rejects.toBeInstanceOf(ReceiptError);
    }
  });
  test('공급자 오류 및 내부 예외의 민감한 메시지를 노출하지 않는다', async () => {
    await expect(requestReceiptAnalysis(upload, 'test', 'test', async () => new Response('secret-key-and-receipt', { status: 401 }))).rejects.not.toThrow('secret-key-and-receipt');
    const handler = createReceiptHandler({ authorize: async () => { throw new Error('secret-key'); }, consumeQuota: async () => true, analyze: async () => [] });
    expect(await (await handler(request())).text()).not.toContain('secret-key');
  });
});
