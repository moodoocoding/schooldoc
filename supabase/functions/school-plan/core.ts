import { PLAN_REVISION_FIELDS, validatePlanDocument } from '../_shared/planDocumentV2.ts';
import { validatePlanAnalysis, validatePlanContext, validatePlanSources, type PlanAnalysis, type PlanDraft, type PlanRequest } from '../_shared/schoolPlan.ts';
import { isVerifiedPreviewAdmin, type PreviewAccessUser } from '../_shared/previewAccess.ts';

export class PlanError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
type Verify = (token: string) => Promise<{ data: { user: PreviewAccessUser | null }; error: unknown }>;
export async function authorizePlanRequest(req: Request, verify: Verify) {
  const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new PlanError(401, '계획서 AI 작성은 로그인 후 사용할 수 있습니다.');
  let result: Awaited<ReturnType<Verify>>;
  try { result = await verify(token); } catch { throw new PlanError(401, '로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.'); }
  if (result.error || !result.data.user?.id) throw new PlanError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.');
  if (result.data.user.is_anonymous) throw new PlanError(403, '교사 계정으로 로그인해 주세요.');
  if (!isVerifiedPreviewAdmin(result.data.user)) throw new PlanError(403, '현재 학교 문서 작성은 관리자 계정에서만 사용할 수 있습니다.');
  return result.data.user.id;
}
export async function readPlanRequest(req: Request): Promise<PlanRequest> {
  if (!req.headers.get('content-type')?.includes('application/json')) throw new PlanError(415, '문서 전송 형식이 올바르지 않습니다.');
  const max = 384 * 1024;
  if (Number(req.headers.get('content-length')) > max) throw new PlanError(413, '전송할 본문이 너무 큽니다. 자료를 나누어 주세요.');
  const reader = req.body?.getReader();
  if (!reader) throw new PlanError(400, '문서 내용이 없습니다.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel(); throw new PlanError(413, '전송할 본문이 너무 큽니다. 자료를 나누어 주세요.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('문서 전송 형식을 확인해 주세요.');
    if (body.consent !== true) throw new Error('AI 전송 안내를 확인하고 동의한 뒤 진행해 주세요.');
    if (body.action === 'analyze') {
      const sources = validatePlanSources(body.sources);
      if (!sources.length) throw new Error('분석할 공문을 추가해 주세요.');
      return { action: 'analyze', sources };
    }
    const context = validatePlanContext(body);
    if (body.action === 'draft') return { action: 'draft', ...context };
    if (body.action === 'revise') {
      const draft = validatePlanDocument(body.draft, context), revision = body.revision;
      if (!revision || !['body', 'schedule', 'budget'].includes(revision.area) || typeof revision.instruction !== 'string' || !revision.instruction.trim() || revision.instruction.length > 1000) throw new Error('수정할 영역과 요청을 확인해 주세요.');
      return { action: 'revise', ...context, draft, revision: { area: revision.area, instruction: revision.instruction } };
    }
    throw new Error('지원하지 않는 문서 작업입니다.');
  } catch (error) { throw new PlanError(422, error instanceof SyntaxError ? '문서 전송 형식을 확인해 주세요.' : error instanceof Error ? error.message : '문서 입력을 확인해 주세요.'); }
}
export function validatePlanResult(request: PlanRequest, result: { analysis?: PlanAnalysis; draft?: PlanDraft }) {
  if (request.action === 'analyze') return { analysis: validatePlanAnalysis(result.analysis, request.sources) };
  const draft = validatePlanDocument(result.draft, request);
  if (request.action === 'revise') {
    const changed: readonly string[] = PLAN_REVISION_FIELDS[request.revision.area];
    const stable = (Object.keys(draft) as (keyof PlanDraft)[]).filter(key => !changed.includes(key));
    if (stable.some(key => JSON.stringify(draft[key]) !== JSON.stringify(request.draft[key]))) throw new PlanError(502, '선택하지 않은 영역이 변경되어 수정안을 반영하지 않았습니다. 다시 요청해 주세요.');
  }
  return { draft };
}
interface Dependencies {
  authorize: (req: Request) => Promise<string>;
  consumeQuota: (userId: string) => Promise<boolean>;
  run: (request: PlanRequest, signal?: AbortSignal) => Promise<{ analysis?: PlanAnalysis; draft?: PlanDraft }>;
}
// Transport is injected. This core never sends source text to an external API.
export function createPlanHandler(deps: Dependencies) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    try {
      if (req.method !== 'POST') throw new PlanError(405, 'POST 요청만 지원합니다.');
      const userId = await deps.authorize(req);
      const request = await readPlanRequest(req);
      if (!await deps.consumeQuota(userId)) throw new PlanError(429, '계획서 AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
      let result;
      try { result = validatePlanResult(request, await deps.run(request, req.signal)); }
      catch (error) { if (error instanceof PlanError) throw error; throw new PlanError(502, '생성 결과가 공문 근거·예산·문서 형식 검사를 통과하지 못했습니다. 다시 작성해 주세요.'); }
      return new Response(JSON.stringify(result), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof PlanError ? error.message : '계획서 서버 연결을 확인해 주세요.' }), { status: error instanceof PlanError ? error.status : 500, headers });
    }
  };
}
