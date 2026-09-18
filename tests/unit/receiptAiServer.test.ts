import { describe, expect, test, vi } from 'vitest';
import { buildReceiptRequest, createReceiptHandler, isReceiptAiAdmin, readUpload, ReceiptError, requestReceiptAnalysis, validateReceipts } from '../../supabase/functions/receipt-analyze/core';

const upload = { mimeType: 'application/pdf', data: btoa('%PDF-1.7\n') };
const row = { spentAt: '2026-09-08', merchant: '문구점', amount: 32500, currency: 'KRW', description: '문구', page: 1, warnings: [] };
const request = (body: unknown = upload) => new Request('https://local.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const response = (data: unknown = { receipts: [row] }) => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }));

describe('OpenAI 영수증 서버 경계', () => {
  test('인증된 관리자 메타데이터 또는 확인된 허용 이메일만 승인한다', () => {
    const emails = new Set(['admin@example.invalid']);
    expect(isReceiptAiAdmin({ email: 'admin@example.invalid' }, emails)).toBe(false);
    expect(isReceiptAiAdmin({ email: 'ADMIN@example.invalid', email_confirmed_at: '2026-09-08' }, emails)).toBe(true);
    expect(isReceiptAiAdmin({ app_metadata: { role: 'admin' } }, emails)).toBe(true);
    expect(isReceiptAiAdmin({ app_metadata: { role: 'teacher' }, email: 'other@example.invalid', email_confirmed_at: '2026-09-08' }, emails)).toBe(false);
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
  test('관리자 외 계정을 거부한다', async () => {
    const analyze = vi.fn();
    const handler = createReceiptHandler({ authorize: async () => { throw new ReceiptError(403, '관리자 전용'); }, consumeQuota: async () => true, analyze });
    expect((await handler(request())).status).toBe(403); expect(analyze).not.toHaveBeenCalled();
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
