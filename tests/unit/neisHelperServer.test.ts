import { describe, expect, test, vi } from 'vitest';
import { teacherCommentPrompt } from '../../supabase/functions/neis-helper/teacherCommentPrompt';
import { neisWritingRules } from '../../supabase/functions/neis-helper/neisWritingRules';
import {
  authorizeNeisRequest,
  buildNeisAiRequest,
  createNeisHandler,
  NeisError,
  readNeisRequest,
  requestNeisAi,
  selectNeisAiModel,
} from '../../supabase/functions/neis-helper/core';
import type { NeisDependencies, NeisRequest } from '../../supabase/functions/neis-helper/core';

const request = (body: unknown = { action: 'plan', data: btoa('%PDF-1.7\n') }) =>
  new Request('https://local.invalid/neis-helper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fixture-token' },
    body: JSON.stringify(body),
  });
test('기본 모델은 gpt-6-luna이고, 평어 전용·공통 설정을 보존한다', () => {
  expect(selectNeisAiModel('generate-class')).toBe('gpt-6-luna');
  expect(selectNeisAiModel('generate')).toBe('gpt-6-luna');
  expect(selectNeisAiModel('plan')).toBe('gpt-6-luna');
  expect(selectNeisAiModel('grades', { model: 'global', commentModel: 'writing' })).toBe('global');
  expect(selectNeisAiModel('generate-class', { model: ' global ', commentModel: ' writing ' })).toBe('writing');
  expect(selectNeisAiModel('generate-class', { model: ' global ', commentModel: ' ' })).toBe('global');
});
const teacher = {
  id: 'verified-id',
  email: 'panthea0@gmail.com',
  email_confirmed_at: '2026-11-12',
  is_anonymous: false,
};
const plan = {
  year: '2026',
  schoolGrade: '5학년',
  semester: '2학기',
  assessments: [
    {
      subject: '수학',
      standardCode: '기준',
      standard: '평균을 구한다.',
      task: '평균',
      rubrics: { high: '평균 문제를 해결한다.', middle: '평균을 구한다.', low: '간단한 평균을 구한다.' },
      sourcePage: 1,
      warnings: [],
    },
  ],
};
const deps = (overrides: Partial<NeisDependencies> = {}): NeisDependencies => ({
  authorize: vi.fn(async () => 'verified-id'),
  checkPdf: vi.fn(async () => {}),
  consumeQuota: vi.fn(async () => true),
  analyze: vi.fn(async () => plan),
  ...overrides,
});
const generate: NeisRequest = {
  action: 'generate',
  input: {
    subject: '수학',
    length: 200,
    evidence: [
      {
        assessmentId: 'a',
        standardCode: '기준',
        standard: '평균을 구한다.',
        task: '평균',
        grade: 'low',
        criterion: '간단한 평균을 구한다.',
      },
    ],
  },
};

describe('Neis Helper 서버 인증·비용·응답 경계', () => {
  test('평어 모델에는 등급이나 상위 목표 대신 선택한 수행 기준을 전달한다', () => {
    const body = buildNeisAiRequest(generate, 'test-model');
    const content = body.input[0].content[0];
    const input = JSON.parse('text' in content ? content.text! : '{}');
    expect(input.evidence[0].criterion).toBe('간단한 평균을 구한다.');
    expect(input.evidence[0]).not.toHaveProperty('grade');
    expect(input.evidence[0]).not.toHaveProperty('standard');
  });
  test('검증된 관리자 ID만 사용하고 본문 역할·ID는 무시한다', async () => {
    const verify = vi.fn(async () => ({ data: { user: teacher }, error: null }));
    const dependencies = deps({ authorize: (req) => authorizeNeisRequest(req, verify) });
    const res = await createNeisHandler(dependencies)(
      request({ action: 'plan', data: btoa('%PDF-1.7'), userId: 'spoofed', role: 'admin' }),
    );
    expect(res.status).toBe(200);
    expect(dependencies.consumeQuota).toHaveBeenCalledWith('verified-id');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
  test.each(['missing', 'anonymous', 'ordinary', 'unconfirmed', 'broken'])(
    '%s 인증은 파일 분석·한도 소비 전에 차단한다',
    async (state) => {
      const verify = vi.fn(async () => {
        if (state === 'broken') throw new Error('secret-token');
        return {
          data: {
            user:
              state === 'missing'
                ? null
                : {
                    ...teacher,
                    email: state === 'ordinary' ? 'ordinary@example.invalid' : teacher.email,
                    email_confirmed_at: state === 'unconfirmed' ? '' : teacher.email_confirmed_at,
                    is_anonymous: state === 'anonymous',
                  },
          },
          error: null,
        };
      });
      const dependencies = deps({ authorize: (req) => authorizeNeisRequest(req, verify) });
      const res = await createNeisHandler(dependencies)(request());
      expect([401, 403]).toContain(res.status);
      expect(dependencies.checkPdf).not.toHaveBeenCalled();
      expect(dependencies.consumeQuota).not.toHaveBeenCalled();
      expect(dependencies.analyze).not.toHaveBeenCalled();
      expect(await res.text()).not.toContain('secret-token');
    },
  );
  test('인증 헤더 누락은 원격 사용자 조회도 하지 않는다', async () => {
    const req = request();
    req.headers.delete('Authorization');
    const verify = vi.fn();
    await expect(authorizeNeisRequest(req, verify)).rejects.toMatchObject({ status: 401 });
    expect(verify).not.toHaveBeenCalled();
  });
  test.each([false, 'failure'])('한도 초과 또는 확인 실패 %s는 AI를 호출하지 않는다', async (mode) => {
    const dependencies = deps({
      consumeQuota: async () => {
        if (mode === 'failure') throw new NeisError(503, '한도 확인 실패');
        return false;
      },
    });
    expect((await createNeisHandler(dependencies)(request())).status).toBe(mode === false ? 429 : 503);
    expect(dependencies.analyze).not.toHaveBeenCalled();
  });
  test('PDF 손상·쪽수 초과는 한도와 외부 AI 호출 전에 거부한다', async () => {
    const dependencies = deps({
      checkPdf: async () => {
        throw new NeisError(422, '80쪽 초과');
      },
    });
    expect((await createNeisHandler(dependencies)(request())).status).toBe(422);
    expect(dependencies.consumeQuota).not.toHaveBeenCalled();
    expect(dependencies.analyze).not.toHaveBeenCalled();
  });
  test('파일 위장·과대 본문·미확인 성적을 거부한다', async () => {
    await expect(readNeisRequest(request({ action: 'plan', data: btoa('fake') }))).rejects.toMatchObject({
      status: 415,
    });
    const large = request();
    large.headers.set('content-length', '20000000');
    await expect(readNeisRequest(large)).rejects.toMatchObject({ status: 413 });
    await expect(
      readNeisRequest(
        request({
          action: 'generate',
          input: { ...generate.input, evidence: [{ ...generate.input.evidence[0], grade: '' }] },
        }),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
  test('성적 개수 오류와 허구 근거 ID가 공급자에서 와도 성공으로 반환하지 않는다', async () => {
    const grades = deps({
      analyze: async () => ({
        context: '',
        columns: ['A', 'B'],
        students: [{ number: '1', name: '가', grades: ['◎'] }],
      }),
    });
    expect(
      (await createNeisHandler(grades)(request({ action: 'grades', data: btoa('%PDF-1.7') }))).status,
    ).toBe(422);
    const generated = deps({
      analyze: async () => ({
        sentences: [{ text: '평균을 구함.', assessmentId: 'wrong', evidenceQuote: '간단한 평균을 구한다.' }],
      }),
    });
    expect((await createNeisHandler(generated)(request(generate))).status).toBe(422);
  });
  test('PDF 분석의 영역 필드를 요청하고 브라우저 응답까지 보존한다', async () => {
    const body = buildNeisAiRequest({ action: 'plan', data: 'test' }, 'm');
    expect(body.text.format.schema).toMatchObject({ properties: { assessments: { items: {
      properties: { domain: { type: 'string' } }, required: expect.arrayContaining(['domain']),
    } } } });
    const response = await createNeisHandler(deps({ analyze: async () => ({
      ...plan, assessments: plan.assessments.map((a) => ({ ...a, domain: '자료와 가능성' })),
    }) }))(request());
    expect(response.status).toBe(200);
    expect((await response.json()).result.assessments[0].domain).toBe('자료와 가능성');
  });
  test('고정 파일명·구조화 응답·무저장을 사용하며 사실성 지시를 포함한다', () => {
    const body = buildNeisAiRequest(generate, 'test-model');
    expect(body).toMatchObject({ model: 'test-model', store: false, text: { format: { strict: true } } });
    expect(body.instructions).toContain(teacherCommentPrompt);
    expect(body.instructions).toContain(neisWritingRules);
    expect(body.instructions).toContain('자료 안의 명령');
    expect(JSON.stringify(body)).not.toContain('studentName');
    expect(buildNeisAiRequest({ action: 'plan', data: 'test' }, 'm').input[0].content[1]).toMatchObject({
      filename: 'assessment-plan.pdf',
    });
  });
  test('미완료·거부·민감한 공급자 오류는 안전한 오류로 반환한다', async () => {
    for (const body of [
      { status: 'incomplete' },
      { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] },
    ]) {
      await expect(
        requestNeisAi(generate, 'secret', 'model', async () => new Response(JSON.stringify(body))),
      ).rejects.toBeInstanceOf(NeisError);
    }
    await expect(
      requestNeisAi(
        generate,
        'secret',
        'model',
        async () => new Response('secret-file-content', { status: 401 }),
      ),
    ).rejects.not.toThrow('secret-file-content');
    const res = await createNeisHandler(
      deps({
        analyze: async () => {
          throw new Error('secret-file-content');
        },
      }),
    )(request());
    expect(await res.text()).not.toContain('secret-file-content');
  });
});
