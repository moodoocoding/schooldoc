import {
  NEIS_MAX_FILE_BYTES,
  NEIS_MAX_PAGES,
  validatePlan,
  validateGradeBook,
  validateCommentInput,
  validateGeneratedComment,
  validateCommentLength,
} from '../_shared/neisHelper.ts';
import type { CommentInput } from '../_shared/neisHelper.ts';
import { classAssessmentOrder, createClassOutputValidator, validateClassInput, validateClassOutput } from '../_shared/neisClassComments.ts';
import type { ClassCommentEvent, ClassCommentInput } from '../_shared/neisClassComments.ts';
import { createClassRowReader } from '../_shared/neisClassRows.ts';
import { readJsonEvents } from '../_shared/neisEvents.ts';
import { classCommentInstruction, commentLengthInstruction, singleStudentCommentInstruction, untrustedInputInstruction } from './commentPrompts.ts';

export class NeisError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
interface VerifiedUser {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
}
type VerifyUser = (token: string) => Promise<{ data: { user: VerifiedUser | null }; error: unknown }>;
export async function authorizeNeisRequest(req: Request, verify: VerifyUser): Promise<string> {
  const token = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new NeisError(401, '로그인 후 사용할 수 있습니다.');
  let result: Awaited<ReturnType<VerifyUser>>;
  try {
    result = await verify(token);
  } catch {
    throw new NeisError(401, '로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.');
  }
  const user = result.data.user;
  if (result.error || !user?.id) throw new NeisError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.');
  // 기존 개발 중 메뉴의 공개 범위를 서버에서도 적용한다. 요청 본문의 역할은 사용하지 않는다.
  if (user.is_anonymous || !user.email_confirmed_at || user.email?.toLowerCase() !== 'panthea0@gmail.com')
    throw new NeisError(403, '현재 개발 중인 Neis Helper에 접근할 수 없습니다.');
  return user.id;
}
export type NeisRequest =
  | { action: 'plan'; data: string }
  | { action: 'grades'; data: string }
  | { action: 'generate'; input: CommentInput }
  | { action: 'generate-class'; input: ClassCommentInput };
const MAX_BODY = Math.ceil(NEIS_MAX_FILE_BYTES / 3) * 4 + 200_000;
export async function readNeisRequest(req: Request): Promise<NeisRequest> {
  if (!req.headers.get('content-type')?.includes('application/json'))
    throw new NeisError(415, '요청 형식을 확인해 주세요.');
  if (Number(req.headers.get('content-length')) > MAX_BODY)
    throw new NeisError(413, '파일은 10MB까지 올릴 수 있습니다.');
  const reader = req.body?.getReader();
  if (!reader) throw new NeisError(400, '자료가 없습니다.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new NeisError(413, '파일은 10MB까지 올릴 수 있습니다.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new NeisError(400, '요청 자료를 읽지 못했습니다.');
  }
  if (body?.action === 'generate' || body?.action === 'generate-class') {
    try {
      return body.action === 'generate-class'
        ? { action: 'generate-class', input: validateClassInput(body.input) }
        : { action: 'generate', input: validateCommentInput(body.input) };
    } catch (e) {
      throw new NeisError(422, e instanceof Error ? e.message : '평가 근거를 확인해 주세요.');
    }
  }
  if (!['plan', 'grades'].includes(body?.action)) throw new NeisError(400, '지원하지 않는 요청입니다.');
  if (
    typeof body.data !== 'string' ||
    !body.data.length ||
    body.data.length % 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(body.data)
  )
    throw new NeisError(400, '파일 데이터를 읽지 못했습니다.');
  const decoded = atob(body.data);
  if (decoded.length > NEIS_MAX_FILE_BYTES) throw new NeisError(413, '파일은 10MB까지 올릴 수 있습니다.');
  if (!decoded.startsWith('%PDF-')) throw new NeisError(415, 'PDF 원본 파일을 선택해 주세요.');
  return { action: body.action, data: body.data };
}
const string = { type: 'string' };
const strings = { type: 'array', items: string };
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
export const planSchema = object({
  year: string,
  schoolGrade: string,
  semester: string,
  assessments: {
    type: 'array',
    items: object({
      subject: string,
      domain: string,
      standardCode: string,
      standard: string,
      task: string,
      rubrics: object({ high: string, middle: string, low: string }),
      sourcePage: { type: ['integer', 'null'] },
      warnings: strings,
    }),
  },
});
export const gradesSchema = object({
  context: string,
  columns: strings,
  students: {
    type: 'array',
    items: object({
      number: string,
      name: string,
      grades: { type: 'array', items: { type: ['string', 'null'] } },
    }),
  },
});
export const commentSchema = object({
  sentences: { type: 'array', items: object({ text: string, assessmentId: string, evidenceQuote: string }) },
});
export const classCommentSchema = object({
  rows: { type: 'array', items: object({
    id: string, sentences: { type: 'array', items: object({ a: { type: 'integer' }, t: string }) },
  }) },
});
const untrusted = untrustedInputInstruction;
const planInstruction = `${untrusted}
초등학교 평가계획의 요약 표에서 모든 교과의 평가 항목을 한 번씩 추출한다. 뒤에 반복되는 개별 평가지는 같은 평가로 중복 추가하지 않는다.
각 평가의 영역(예: 듣기·말하기, 읽기, 쓰기)을 domain에 원문 그대로 보존한다. 영역·성취기준·평가요소·수준별 기준은 같은 평가의 행 관계를 유지한다. 병합된 영역 셀은 그 셀에 속한 평가 행에만 적용한다. 영역이 원문에 없으면 추측하지 말고 빈 문자열로 둔다.
성취기준 코드와 본문은 원문 그대로 각각 보존한다. 과제는 평가요소를 사용한다. ◎·○·△의 평가기준을 서로 바꾸거나 합치지 말고 high·middle·low에 원문으로 넣는다.
각 항목의 원본 PDF 쪽 번호를 sourcePage로 반환한다(1부터). 연도·학년·학기는 보이는 대로 반환하고 모르면 빈 문자열로 둔다.
성취기준·과제·기준이 비거나 모순되면 내용을 만들지 말고 해당 값을 빈 문자열로 두고 warnings에 교사가 확인할 부분을 한국어로 적는다.
평가 단계가 3단계가 아니면 임의로 3단계로 바꾸지 않는다. 수준 기준은 빈 값과 warnings로 반환한다. 학생 이름이나 무관한 개인정보는 출력하지 않는다.`;
const gradeInstruction = `${untrusted}
나이스 수행평가 성적표의 한 학급을 추출한다. context에 원문에 보이는 학년·반·학기·교과를 짧게 담는다.
columns에는 평가 열의 제목을 원본 순서로 반환하고, students에는 모든 학생의 원본 번호와 이름을 원래 행 순서대로 반환한다.
다단 머리글에 영역과 평가요소·과제명·성취기준 코드가 함께 있으면 해당 성적 열에 속한 제목들을 함께 보존한다. 영역명만 남겨 구체적인 평가 제목을 버리지 않는다. 원문에 영역명만 있으면 그 영역명을 그대로 반환하고 없는 과제명을 만들지 않는다.
동명이인을 합치거나 번호를 재부여하지 않는다. 학생의 번호·이름이 없거나 불확실하면 빈 문자열로 둔다.
grades는 columns와 같은 개수와 순서여야 한다. 원래 기호/문자열을 그대로 쓴다. 빈칸·읽지 못한 칸은 그 자리에 null을 넣는다.
뒤 성적을 앞 빈칸으로 당기거나 성적을 임의로 보충·평균·상향하지 않는다. 머리글 반복·합계 행은 학생이 아니다.
여러 학급이 섞이면 번호 중복을 유지한다. 최대 60명, 평가 열 40개. 넘어가면 부분 추출하지 말고 빈 students로 반환한다.`;
export function selectNeisAiModel(action: NeisRequest['action'], settings: { model?: string; commentModel?: string } = {}): string {
  const writing = action === 'generate' || action === 'generate-class';
  return (writing ? settings.commentModel?.trim() : '') || settings.model?.trim() || (writing ? 'gpt-6-luna' : 'gpt-4.1-mini');
}

export function buildNeisAiRequest(request: NeisRequest, model: string) {
  if (request.action === 'generate-class') {
    const { groups, ...context } = request.input;
    const students = groups.flatMap((group) => group.ids.map((id) => ({
      id, grades: group.grades, order: classAssessmentOrder(id, context.evaluations.length),
    })))
      .toSorted((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    const count = students.length;
    return {
      model, store: false,
      instructions: `${classCommentInstruction}\n\n${commentLengthInstruction(request.input.length, request.input.evaluations.length)}`,
      input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ ...context, studentCount: count, students }) }] }],
      text: { format: { type: 'json_schema', name: 'neis_class', strict: true, schema: object({ rows: {
        type: 'array', minItems: count, maxItems: count,
        items: object({ id: { type: 'string', enum: students.map((student) => student.id) },
          sentences: { type: 'array', minItems: request.input.evaluations.length, maxItems: 40,
            items: object({ a: { type: 'integer', minimum: 1, maximum: request.input.evaluations.length }, t: string }) },
        }),
      } }) } },
    };
  }
  const generation = request.action === 'generate';
  return {
    model,
    store: false,
    instructions: generation
      ? `${singleStudentCommentInstruction}\n\n${commentLengthInstruction(request.input.length, request.input.evidence.length)}`
      : request.action === 'plan'
        ? planInstruction
        : gradeInstruction,
    input: [
      {
        role: 'user',
        content: generation
          ? [{ type: 'input_text', text: JSON.stringify({
              subject: request.input.subject,
              length: request.input.length,
              evidence: request.input.evidence.map(({ assessmentId, standardCode, task, criterion }) =>
                ({ assessmentId, standardCode, task, criterion })),
            }) }]
          : [
              {
                type: 'input_text',
                text:
                  request.action === 'plan'
                    ? '평가계획의 기준 표를 추출하세요.'
                    : '나이스 성적표의 모든 학생과 평가 열을 추출하세요.',
              },
              {
                type: 'input_file',
                filename: request.action === 'plan' ? 'assessment-plan.pdf' : 'grades.pdf',
                file_data: `data:application/pdf;base64,${request.data}`,
              },
            ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: `neis_${request.action}`,
        strict: true,
        schema: generation ? commentSchema : request.action === 'plan' ? planSchema : gradesSchema,
      },
    },
  };
}

async function openNeisAiResponse(
  request: NeisRequest,
  key: string,
  model: string,
  fetcher: typeof fetch,
  signal: AbortSignal,
  stream = false,
) {
  let response: Response;
  try {
    response = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...buildNeisAiRequest(request, model), ...(stream ? { stream: true } : {}) }),
      signal,
    });
  } catch {
    throw new NeisError(504, '분석 시간이 길어졌습니다. 자료를 유지했으니 잠시 후 다시 시도해 주세요.');
  }
  if (!response.ok)
    throw new NeisError(
      response.status === 429 ? 429 : 502,
      response.status === 429
        ? 'AI 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
        : 'AI 요청에 실패했습니다. 관리자는 서버의 키·모델 설정을 확인해 주세요.',
    );
  return response;
}

export async function requestNeisAi(request: NeisRequest, key: string, model: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await openNeisAiResponse(request, key, model, fetcher,
    AbortSignal.timeout(request.action === 'generate-class' ? 140_000 : 110_000));
  let body;
  try {
    body = await response.json();
  } catch {
    throw new NeisError(502, 'AI 응답을 읽지 못했습니다. 다시 시도해 주세요.');
  }
  const contents = (Array.isArray(body.output) ? body.output : [])
    .filter((o: { type?: string }) => o.type === 'message')
    .flatMap((o: { content?: unknown[] }) => (Array.isArray(o.content) ? o.content : []));
  if (contents.some((c: { type?: string }) => c.type === 'refusal'))
    throw new NeisError(422, '이 자료를 분석하지 못했습니다. 원본을 확인해 주세요.');
  const source = contents
    .filter((c: { type?: string }) => c.type === 'output_text')
    .map((c: { text?: string }) => c.text ?? '')
    .join('');
  if (body.status !== 'completed') {
    if (request.action === 'generate-class' && body.incomplete_details?.reason === 'max_output_tokens') {
      const rows = createClassRowReader().push(source);
      if (rows.length) return { rows };
      throw new NeisError(502, '학급 평어가 출력 한도를 넘었습니다. 분량을 줄여 다시 시도해 주세요.');
    }
    throw new NeisError(502, '분석이 끝나지 않았습니다. 자료를 확인하고 다시 시도해 주세요.');
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new NeisError(502, '분석 결과를 읽지 못했습니다. 다시 시도해 주세요.');
  }
  return value;
}

type ClassRequest = Extract<NeisRequest, { action: 'generate-class' }>;
export async function requestNeisClassStream(
  request: ClassRequest, key: string, model: string, signal: AbortSignal, fetcher: typeof fetch = fetch,
) {
  const disconnect = new AbortController();
  const downstream = AbortSignal.any([signal, disconnect.signal]);
  const upstream = AbortSignal.any([downstream, AbortSignal.timeout(140_000)]);
  const response = await openNeisAiResponse(request, key, model, fetcher, upstream, true);
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream'))
    throw new NeisError(502, '실시간 평어 응답을 열지 못했습니다. 다시 시도해 주세요.');
  const body = response.body;
  const reader = createClassRowReader();
  const validator = createClassOutputValidator(request.input);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(output) {
      const send = (event: ClassCommentEvent) => {
        if (!downstream.aborted) output.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        if (!downstream.aborted) output.enqueue(encoder.encode(': connected\n\n'));
        let terminal = false;
        for await (const raw of readJsonEvents(body)) {
          if (downstream.aborted) break;
          const event = raw as { type?: string; delta?: string; response?: { incomplete_details?: { reason?: string } } };
          if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
            for (const row of reader.push(event.delta)) send({ type: 'row', row: validator.accept(row) });
          } else if (event.type === 'response.completed') {
            if (!reader.ended) throw new Error('Incomplete class result');
            terminal = true;
            break;
          } else if (event.type === 'response.incomplete' && event.response?.incomplete_details?.reason === 'max_output_tokens') {
            terminal = true;
            break;
          } else if (['response.failed', 'response.incomplete', 'response.refusal.delta', 'error'].includes(event.type ?? '')) {
            throw new Error('Unsuccessful class response');
          }
        }
        if (!terminal && !downstream.aborted) throw new Error('Interrupted class response');
        for (const row of validator.missing()) send({ type: 'row', row });
        send({ type: 'done' });
      } catch {
        send({ type: 'error', message: '평어 생성 연결이 중단됐습니다. 도착한 평어를 유지했습니다. 미생성 항목을 다시 시도해 주세요.' });
      } finally {
        if (!disconnect.signal.aborted) output.close();
      }
    },
    cancel() { disconnect.abort(); },
  });
}
export interface NeisDependencies {
  authorize: (req: Request) => Promise<string>;
  consumeQuota: (userId: string) => Promise<boolean>;
  checkPdf: (base64: string, maxPages: number) => Promise<void>;
  analyze: (request: NeisRequest) => Promise<unknown>;
  streamClass?: (request: ClassRequest, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>;
}
export function createNeisHandler(deps: NeisDependencies) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    try {
      if (req.method !== 'POST') throw new NeisError(405, 'POST 요청만 지원합니다.');
      const userId = await deps.authorize(req);
      const request = await readNeisRequest(req);
      if (request.action === 'plan' || request.action === 'grades') await deps.checkPdf(request.data, NEIS_MAX_PAGES);
      if (!(await deps.consumeQuota(userId)))
        throw new NeisError(429, 'AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
      if (request.action === 'generate-class' && req.headers.get('accept')?.includes('text/event-stream') && deps.streamClass) {
        const stream = await deps.streamClass(request, req.signal);
        return new Response(stream, { headers: { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform' } });
      }
      const raw = await deps.analyze(request);
      let result;
      try {
        result =
          request.action === 'plan'
            ? validatePlan(raw)
            : request.action === 'grades'
              ? validateGradeBook(raw)
              : request.action === 'generate-class'
                ? validateClassOutput(raw, request.input)
                : validateCommentLength(validateGeneratedComment(raw, request.input), request.input.length);
      } catch (error) {
        throw new NeisError(422, error instanceof Error ? error.message : '분석 결과를 확인해 주세요.');
      }
      return new Response(JSON.stringify({ result }), { headers });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error:
            error instanceof NeisError
              ? error.message
              : 'Neis Helper 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        }),
        { status: error instanceof NeisError ? error.status : 500, headers },
      );
    }
  };
}
