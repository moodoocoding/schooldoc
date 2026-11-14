import { planAnalysisSchema, type PlanRequest } from '../_shared/schoolPlan.ts';
import { PLAN_REVISION_FIELDS, planDocumentSchema, planRevisionSchema, validatePlanDocument } from '../_shared/planDocumentV2.ts';
import type { PlanReferenceType } from '../_shared/schoolPlanReferences.ts';
import { PlanError, validatePlanResult } from './core.ts';
import { getPlanReferencePack } from './references.ts';
import { corePrompt, PLAN_PAGE_TARGETS, PLAN_PROMPT_VERSION, planAnalysisInstructions, revisionPrompt, typeGuide } from './prompt.ts';

// Only our fixed validator messages may leave this boundary, never provider
// output, source fragments, stack traces or arbitrary exception messages.
const safeValidationMessages = new Set(['이전 형식의 초안입니다. 초안을 다시 작성해 주세요.']);

/** 기본 모델은 gpt-6-luna. 초안 작성·수정은 SCHOOL_PLAN_WRITING_MODEL을 먼저 본다. */
export function selectPlanAiModel(action: PlanRequest['action'], settings: { model?: string; writingModel?: string } = {}) {
  const writing = action !== 'analyze';
  return (writing ? settings.writingModel?.trim() : '') || settings.model?.trim() || 'gpt-6-luna';
}

const message = (role: 'developer' | 'user', text: string) => ({ role, content: [{ type: 'input_text', text }] });

export function buildPlanAiRequest(request: PlanRequest, model: string) {
  if (request.action === 'analyze') return {
    model, store: false, instructions: planAnalysisInstructions,
    input: [message('user', JSON.stringify(request))],
    text: { format: { type: 'json_schema', name: 'school_plan_analyze', strict: true, schema: planAnalysisSchema } },
  };
  const { type, examples } = getPlanReferencePack(request);
  const pages = request.pages ?? 2;
  const revision = request.action === 'revise' ? PLAN_REVISION_FIELDS[request.revision.area] : undefined;
  if (request.action === 'revise' && !revision) throw new PlanError(422, '수정할 영역을 확인해 주세요.');
  const taskContext = {
    ...request,
    referencePack: { examples },
    outputPreferences: { pages, approxBodyChars: PLAN_PAGE_TARGETS[pages].bodyChars, note: '분량은 필수 내용을 빠뜨리지 않는 범위에서 맞춘다.' },
  };
  return {
    model, store: false,
    instructions: corePrompt,
    input: [
      message('developer', [typeGuide(type as PlanReferenceType), ...(revision ? [revisionPrompt(revision)] : [])].join('\n\n')),
      message('user', JSON.stringify(taskContext)),
    ],
    text: { format: { type: 'json_schema', name: `school_plan_${request.action}_v${PLAN_PROMPT_VERSION}`, strict: true,
      schema: request.action === 'revise' ? planRevisionSchema(request.revision.area) : planDocumentSchema } },
  };
}

/** 내용 없이 사용량만 남긴다(입력·출력 토큰, 시간). 원문·초안·키는 기록하지 않는다. */
function logUsage(action: string, model: string, started: number, usage: unknown) {
  const u = usage && typeof usage === 'object' ? usage as Record<string, unknown> : {};
  console.log(JSON.stringify({ event: 'school-plan-usage', action, model, ms: Date.now() - started, input_tokens: u.input_tokens ?? null, output_tokens: u.output_tokens ?? null }));
}

export async function requestPlanAi(request: PlanRequest, apiKey: string, model: string, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  if (signal?.aborted) throw new PlanError(499, '요청이 취소되었습니다.');
  const started = Date.now();
  let response: Response;
  try {
    response = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPlanAiRequest(request, model)),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(140_000)]) : AbortSignal.timeout(140_000),
    });
  } catch {
    if (signal?.aborted) throw new PlanError(499, '요청이 취소되었습니다.');
    throw new PlanError(504, 'AI 작성 시간이 초과되었습니다. 입력은 유지되므로 다시 시도해 주세요.');
  }
  // Never log or echo provider errors: they can contain source text or keys.
  if (!response.ok) throw new PlanError(response.status === 429 ? 429 : 502, response.status === 429
    ? 'AI 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
    : 'AI 작성에 실패했습니다. 서버의 API 키·모델 설정을 확인해 주세요.');
  let body;
  try { body = await response.json(); } catch { throw new PlanError(502, 'AI 응답을 읽지 못했습니다. 다시 시도해 주세요.'); }
  logUsage(request.action, model, started, body?.usage);
  if (signal?.aborted) throw new PlanError(499, '요청이 취소되었습니다.');
  if (body?.status !== 'completed') throw new PlanError(502, 'AI 작성이 완료되지 않았습니다. 자료를 나누거나 다시 시도해 주세요.');
  const content = (Array.isArray(body.output) ? body.output : [])
    .filter((v: { type?: string }) => v?.type === 'message')
    .flatMap((v: { content?: unknown[] }) => Array.isArray(v.content) ? v.content : []);
  if (content.some((v: { type?: string }) => v?.type === 'refusal')) throw new PlanError(422, '이 자료의 AI 작성을 완료하지 못했습니다. 본문을 확인해 주세요.');
  let result;
  try { result = JSON.parse(content.filter((v: { type?: string }) => v?.type === 'output_text').map((v: { text?: string }) => v.text ?? '').join('')); }
  catch { throw new PlanError(502, 'AI 결과 형식을 읽지 못했습니다. 다시 시도해 주세요.'); }
  try {
    if (request.action === 'analyze') return validatePlanResult(request, { analysis: result });
    if (request.action === 'revise') {
      const fields: readonly string[] = PLAN_REVISION_FIELDS[request.revision.area];
      if (!result || typeof result !== 'object' || Object.keys(result).some(key => !fields.includes(key)) || fields.some(key => !Object.hasOwn(result, key))) throw new Error();
      // 고르지 않은 영역은 현재 초안 값을 그대로 쓴다.
      return validatePlanResult(request, { draft: validatePlanDocument({ ...request.draft, ...result }, request) });
    }
    return validatePlanResult(request, { draft: validatePlanDocument(result, request) });
  } catch (error) {
    if (error instanceof PlanError) throw error;
    if (error instanceof Error && safeValidationMessages.has(error.message)) throw new PlanError(502, `AI 초안 검사: ${error.message}`);
    throw new PlanError(502, 'AI 결과가 운영계획서 형식 검사를 통과하지 못했습니다. 다시 작성해 주세요.');
  }
}
