// Real, billable OpenAI check using synthetic students only. No deployed data is changed.
// Node 24+: node --env-file-if-exists=.env.local scripts/verify-neis-class-comments.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { sameGradeClass } from '../tests/fixtures/neisSameGradeClass.ts';
import { generateClassWithRepairs } from '../supabase/functions/_shared/neisClassGeneration.ts';
import { repeatedCommentIds } from '../supabase/functions/_shared/neisHelper.ts';
import { buildNeisAiRequest, requestNeisClassStream, selectNeisAiModel } from '../supabase/functions/neis-helper/core.ts';
import { teacherCommentPrompt } from '../supabase/functions/neis-helper/teacherCommentPrompt.ts';
import { readJsonEvents } from '../supabase/functions/_shared/neisEvents.ts';

const model = selectNeisAiModel('generate-class', { model: process.env.NEIS_HELPER_AI_MODEL, commentModel: process.env.NEIS_HELPER_COMMENT_MODEL });
const target = Number(process.argv.find((arg) => arg.startsWith('--length='))?.split('=')[1] || 300);
if (![200, 300, 400].includes(target)) throw new Error('--length는 200, 300, 400 중 하나여야 합니다.');
const input = { ...sameGradeClass(), length: target };
if (process.argv.includes('--prompt-only')) {
  const promptDirectory = resolve('test-results/neis-class-ai/structured-prompt');
  const payload = buildNeisAiRequest({ action: 'generate-class', input }, model);
  await mkdir(promptDirectory, { recursive: true });
  await writeFile(resolve(promptDirectory, 'instructions.txt'), payload.instructions, 'utf8');
  await writeFile(resolve(promptDirectory, 'user-input.json'), payload.input[0].content[0].text, 'utf8');
  await writeFile(resolve(promptDirectory, 'api-request.json'), JSON.stringify(payload, null, 2), 'utf8');
  console.log(JSON.stringify({ promptDirectory, model, actualOpenAI: false }));
  process.exit(0);
}
const key = process.env.OPENAI_API_KEY?.trim();
if (!key) {
  console.error('OPENAI_API_KEY가 필요합니다. 키를 설정한 로컬 환경 파일로 실행하세요. 실제 AI 검사는 실행되지 않았습니다.');
  process.exit(2);
}
const directory = resolve('test-results/neis-class-ai', `${new Date().toISOString().replace(/[:.]/g, '-')}-${target}`);
const rows = new Map();
const calls = [];
const requestBodies = [];
let outcomeError = '';
const started = Date.now();
const controller = new AbortController();
process.once('SIGINT', () => controller.abort());

try {
  await generateClassWithRepairs(input, controller.signal, async (next, signal, onRow) => {
    const ids = next.groups.flatMap((group) => group.ids);
    const call = { ids, accepted: [], rejected: [] };
    let observeUsage = Promise.resolve();
    calls.push(call);
    console.log(`실제 AI 요청 ${calls.length}: 가상 학생 ${ids.length}명 (${model})`);
    const stream = await requestNeisClassStream({ action: 'generate-class', input: next }, key, model, signal,
      async (url, options) => {
        const payload = JSON.parse(options.body);
        if (!payload.instructions.includes(teacherCommentPrompt)) throw new Error('교사 프롬프트 전문이 누락되었습니다.');
        requestBodies.push(payload);
        const response = await fetch(url, options);
        if (response.ok && response.body) {
          observeUsage = (async () => {
            for await (const event of readJsonEvents(response.clone().body)) {
              if (event.response?.usage) call.usage = event.response.usage;
            }
          })().catch(() => {});
        }
        return response;
      });
    let completed = false;
    for await (const event of readJsonEvents(stream)) {
      if (event.type === 'row') {
        if (event.row.comment && !event.row.error) call.accepted.push(event.row.id);
        else call.rejected.push({ id: event.row.id, reason: event.row.error, text: event.row.rejectedText || '' });
        onRow(event.row);
      } else if (event.type === 'error') throw new Error(event.message);
      else if (event.type === 'done') completed = true;
    }
    if (!completed) throw new Error('학급 생성 스트림이 완료되지 않았습니다.');
    await observeUsage;
    console.log(`요청 ${calls.length} 완료: 통과 ${call.accepted.length}, 재작성 대상 ${call.rejected.length}`);
  }, (row) => rows.set(row.id, row));
} catch (error) {
  outcomeError = error.message;
}
const comments = input.groups[0].ids.map((id) => {
  const row = rows.get(id);
  return { id, assessmentOrder: row?.comment?.sentences.map((sentence) => sentence.assessmentId) || [], text: row?.comment?.sentences.map((sentence) => sentence.text).join(' ') || '', error: row?.error || (row?.comment ? '' : '미생성') };
});
// Independent exact checks alongside the production similarity checker.
const keys = { sentence: new Map(), firstWord: new Map(), firstThree: new Map() };
for (const row of comments) {
  for (const [index, sentence] of row.text.normalize('NFKC').split(/\.(?!\d)|[!?。\n]+/u).filter((part) => part.trim()).entries()) {
    const words = sentence.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const compact = words.join('');
    for (const [category, value] of Object.entries({ sentence: compact, firstWord: words[0], firstThree: compact.slice(0, 3) })) {
      if (category !== 'sentence' && index > 0) continue;
      if (!value) continue;
      const owners = keys[category].get(value) || new Set();
      owners.add(row.id);
      keys[category].set(value, owners);
    }
  }
}
const duplicates = Object.fromEntries(Object.entries(keys).map(([category, values]) => [category,
  [...values].filter(([, owners]) => owners.size > 1).map(([text, owners]) => ({ text, ids: [...owners] })),
]));
const similar = [...repeatedCommentIds(comments)];
const lengthRange = { min: target * 9 / 10, max: target * 11 / 10 };
const characterCounts = comments.map((row) => ({ id: row.id, characters: Array.from(row.text.replace(/\r\n?/g, '\n')).length }));
const lengthFailures = characterCounts.filter((row) => row.characters < lengthRange.min || row.characters > lengthRange.max);
const passed = !outcomeError && comments.length === 23 && comments.every((row) => row.text && !row.error) &&
  Object.values(duplicates).every((items) => !items.length) && !similar.length && !lengthFailures.length;
const report = {
  actualOpenAI: true, model, elapsedSeconds: Math.round((Date.now() - started) / 1000),
  teacherPromptSha256: createHash('sha256').update(teacherCommentPrompt).digest('hex'),
  input, calls, duplicates, similarStudentIds: similar, automaticChecksPassed: passed,
  lengthValidation: { target, ...lengthRange, characters: characterCounts, failures: lengthFailures },
  openingAssessmentCounts: Object.fromEntries(input.evaluations.map((_, index) => [String(index + 1), comments.filter((row) => row.assessmentOrder[0] === String(index + 1)).length])),
  usage: calls.every((call) => call.usage) ? calls.reduce((sum, call) => ({
    inputTokens: sum.inputTokens + call.usage.input_tokens,
    cachedInputTokens: sum.cachedInputTokens + (call.usage.input_tokens_details?.cached_tokens || 0),
    outputTokens: sum.outputTokens + call.usage.output_tokens,
    reasoningTokens: sum.reasoningTokens + (call.usage.output_tokens_details?.reasoning_tokens || 0),
  }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0 }) : null,
  naturalnessReview: '자동 지표와 별도로 23명 원문 전체의 자연스러움·평가 근거 유지 여부를 검토해야 합니다.',
  error: outcomeError, comments,
};
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'result.json'), JSON.stringify(report, null, 2), 'utf8');
for (const [index, payload] of requestBodies.entries()) {
  await writeFile(resolve(directory, `api-request-${index + 1}.json`), JSON.stringify(payload, null, 2), 'utf8');
}
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
await writeFile(resolve(directory, 'comments.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>가상 학생 23명 평어 검증</title><style>body{font:16px/1.8 sans-serif;max-width:1000px;margin:32px auto;padding:0 20px;color:#17243b}article{border-top:1px solid #ccd5df;padding:18px 0}h2{font-size:17px}small{color:#526077}.error{color:#a22}</style><h1>가상 학생 23명 · 동일 성적 평어</h1><p>국어 3개 평가 모두 ◎ · 목표 ${target}자 · 허용 ${lengthRange.min}~${lengthRange.max}자 (공백·문장부호 포함) · ${escape(model)} · 실제 AI 요청 ${calls.length}회</p><p>자동 분량·중복 검사: ${passed ? '통과' : '미통과'}. 자연스러움과 사실성은 원문을 읽고 별도로 검토합니다.</p>${comments.map((row, index) => `<article><h2>가상 학생 ${index + 1}</h2><p>${escape(row.text)}</p>${row.error ? `<p class="error">${escape(row.error)}</p>` : ''}<small>${Array.from(row.text).length}자 (공백 포함)</small></article>`).join('')}</html>`, 'utf8');
console.log(JSON.stringify({ automaticChecksPassed: passed, completed: comments.filter((row) => row.text && !row.error).length, calls: calls.length, directory, error: outcomeError }));
if (!passed) process.exitCode = 1;
