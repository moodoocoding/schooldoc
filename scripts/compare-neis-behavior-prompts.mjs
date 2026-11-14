// Opt-in live comparison. Only synthetic fixtures; never writes credentials or raw provider bodies.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildBehaviorAiRequest } from '../supabase/functions/neis-behavior/prompts.ts';
import { selectNeisAiModel } from '../supabase/functions/neis-helper/core.ts';
import { behaviorCounts, behaviorDuplicates, createBehaviorValidator, validateBehaviorInput } from '../supabase/functions/_shared/neisBehavior.ts';

const label = process.argv[2];
if (!['baseline', 'candidate'].includes(label) || !process.argv.includes('--run')) {
  throw new Error('Explicit live run required: node --experimental-strip-types scripts/compare-neis-behavior-prompts.mjs baseline|candidate --run');
}
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required; never pass it as a command argument.');
const directory = new URL('../design/feature-reviews/2026-11-14-neis-behavior/prompt-comparison/', import.meta.url);
await mkdir(directory, { recursive: true });
const resultPath = new URL(label + '-result.json', directory);
try { await access(resultPath); throw new Error('Existing comparison result must not be overwritten.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const input = validateBehaviorInput(JSON.parse(await readFile(new URL('../tests/fixtures/neis-behavior-prompt-comparison.json', import.meta.url), 'utf8')));
const model = selectNeisAiModel('generate-class', {
  model: process.env.NEIS_HELPER_AI_MODEL,
  commentModel: process.env.NEIS_HELPER_COMMENT_MODEL,
});
const request = { ...buildBehaviorAiRequest(input, model), stream: false };
const inputHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
const instructionHash = createHash('sha256').update(request.instructions).digest('hex');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: new URL('..', import.meta.url), windowsHide: true }).trim();
await writeFile(new URL(label + '-request.json', directory), JSON.stringify(request, null, 2) + '\n');
const start = Date.now();
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
  signal: AbortSignal.timeout(150_000),
});
if (!response.ok) throw new Error('Live comparison API returned HTTP ' + response.status);
const data = await response.json();
if (data.status !== 'completed') throw new Error('Live comparison did not complete.');
const output = (data.output ?? []).flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text).join('');
const parsed = JSON.parse(output);
const validator = createBehaviorValidator(input);
const accepted = parsed.rows.map(row => validator.accept(row));
accepted.push(...validator.missing());
const duplicates = behaviorDuplicates(accepted);
const rows = accepted.map(row => ({
  ...row,
  ...behaviorCounts(row.text),
  sentences: row.text.split(/(?<=[.!?。])\s*/u).filter(Boolean).length,
  firstWord: row.text.trim().split(/\s+/u)[0],
  firstThree: Array.from(row.text.replace(/[\p{P}\p{Z}\s]/gu, '')).slice(0, 3).join(''),
  duplicate: duplicates.has(row.id),
}));
const result = {
  label, createdAt: new Date().toISOString(), head, modelRequested: model, modelReturned: data.model,
  inputHash, instructionHash, instructionCharacters: Array.from(request.instructions).length,
  durationMs: Date.now() - start, usage: data.usage, rows,
  note: 'Synthetic live OpenAI call; non-streaming response collection. This is not a browser/auth/quota or remote Supabase integration test.',
};
await writeFile(resultPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ label, model: data.model, inputHash, instructionCharacters: result.instructionCharacters, usage: data.usage, rows: rows.map(({id,characters,sentences,error,duplicate}) => ({id,characters,sentences,error,duplicate})) }));
