import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import templateUrl from '../officialDocument/assets/blank.hwpx?url';
import { planBudgetTotal, type PlanDraft, type PlanPages } from '../../../supabase/functions/_shared/schoolPlan';

const HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
const HH = 'http://www.hancom.co.kr/hwpml/2011/head';
interface Block { text: string; kind: 'title' | 'heading' | 'body' }
export function planOutputBlocks(draft: PlanDraft, title: string): Block[] {
  const blocks: Block[] = [{ text: `[초안] ${title}`, kind: 'title' }, { text: 'AI 작성 초안 · 일정·담당·단가와 학교 확인 사항 검토 후 사용', kind: 'body' }];
  draft.sections.forEach((s, i) => {
    blocks.push({ text: `${i + 1}. ${s.heading}`, kind: 'heading' });
    s.paragraphs.forEach((p, index) => blocks.push({ text: `${['가', '나', '다', '라'][index]}. ${p}`, kind: 'body' }));
  });
  blocks.push({ text: `${draft.sections.length + 1}. 세부추진 일정안`, kind: 'heading' });
  draft.schedule.forEach((s, i) => blocks.push({ text: `${i + 1}) ${s.when} · ${s.activity}\n   담당: ${s.owner}`, kind: 'body' }));
  blocks.push({ text: `${draft.sections.length + 2}. 예산안`, kind: 'heading' });
  draft.budget.forEach((b, i) => blocks.push({ text: `${i + 1}) ${b.item}: ${b.unitPrice.toLocaleString('ko-KR')}원 × ${b.quantity} = ${(b.unitPrice * b.quantity).toLocaleString('ko-KR')}원`, kind: 'body' }));
  blocks.push({ text: draft.budget.length ? `합계 ${planBudgetTotal(draft).toLocaleString('ko-KR')}원 · 단가와 배분은 제안이며 집행 기준·실제 견적 확인 필요` : '예산 없음 또는 미정: 금액 확정 후 집행 기준에 따라 확인', kind: 'body' });
  if (draft.unknowns.length) { blocks.push({ text: '학교 확인 사항', kind: 'heading' }); draft.unknowns.forEach(u => blocks.push({ text: `※ ${u}`, kind: 'body' })); }
  return blocks;
}
const heights = { title: 1800, heading: 1300, body: 1200 };
function estimateHeight(block: Block) {
  const font = heights[block.kind];
  const lines = block.text.split('\n').reduce((sum, line) => {
    const width = [...line].reduce((sum, c) => sum + (/[\u0020-\u007e]/.test(c) ? 0.6 : 1), 0) * font;
    return sum + Math.max(1, Math.ceil(width / 47600));
  }, 0);
  return Math.ceil(lines * font * 1.3 + (block.kind === 'heading' ? 650 : 260));
}
export function paginatePlanBlocks(blocks: Block[], pages: 1 | 2): number {
  const capacity = 69000;
  const sizes = blocks.map(estimateHeight), total = sizes.reduce((a, b) => a + b, 0);
  if (pages === 1) {
    if (total > capacity) throw new Error('현재 내용을 1쪽에 담기 어렵습니다. 2쪽을 선택하거나 본문을 수정해 주세요. 내용은 삭제하지 않았습니다.');
    return -1;
  }
  let sum = 0, best = -1, delta = Infinity;
  for (let index = 1; index < blocks.length; index++) {
    sum += sizes[index - 1];
    if (index < 3 || blocks[index - 1].kind === 'heading' || sum > capacity || total - sum > capacity) continue;
    const distance = Math.abs(total / 2 - sum) + (blocks[index].kind === 'heading' ? 0 : 3000);
    if (distance < delta) { delta = distance; best = index; }
  }
  if (best < 0) throw new Error('현재 내용을 2쪽에 담기 어렵습니다. 필수 조건을 유지하며 본문을 수정해 주세요. 글자 크기와 내용은 자동으로 줄이지 않습니다.');
  return best;
}
function parseXml(bytes: Uint8Array) {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('한글 출력 서식을 읽지 못했습니다. 새로고침 후 다시 시도해 주세요.');
  return doc;
}
const first = (root: Document | Element, name: string) => root.getElementsByTagNameNS('*', name)[0];
// Preserved as a comparison baseline; production never silently falls back to this writer.
export async function exportLegacyPlanHwpx(draft: PlanDraft, options: { title: string; pages: 1 | 2; template?: Uint8Array }): Promise<Uint8Array<ArrayBuffer>> {
  const title = options.title.trim();
  if (!title || title.length > 100 || [...title].some(c => c.charCodeAt(0) < 32)) throw new Error('문서 제목을 100자 이내로 확인해 주세요.');
  const blocks = planOutputBlocks(draft, title), pageBreak = paginatePlanBlocks(blocks, options.pages);
  let template = options.template;
  if (!template) { const response = await fetch(templateUrl); if (!response.ok) throw new Error('한글 출력 서식을 내려받지 못했습니다. 다시 시도해 주세요.'); template = new Uint8Array(await response.arrayBuffer()); }
  const files = unzipSync(template), header = parseXml(files['Contents/header.xml']), section = parseXml(files['Contents/section0.xml']);
  for (const font of [...header.getElementsByTagNameNS('*', 'font')]) font.setAttribute('face', '맑은 고딕');
  const chars = first(header, 'charProperties'), paras = first(header, 'paraProperties');
  const charBase = chars.children[0], paraBase = paras.children[0];
  const charStart = chars.children.length, paraStart = paras.children.length;
  const styleIds = { body: { char: String(charStart), para: String(paraStart) }, heading: { char: String(charStart + 1), para: String(paraStart + 1) }, title: { char: String(charStart + 2), para: String(paraStart + 2) } };
  for (const [offset, kind] of (['body', 'heading', 'title'] as const).entries()) {
    const cp = charBase.cloneNode(true) as Element; cp.setAttribute('id', String(charStart + offset)); cp.setAttribute('height', String(heights[kind]));
    if (kind !== 'body' && !first(cp, 'bold')) cp.appendChild(header.createElementNS(HH, 'hh:bold'));
    chars.appendChild(cp);
    const pp = paraBase.cloneNode(true) as Element; pp.setAttribute('id', String(paraStart + offset));
    const align = first(pp, 'align'); align?.setAttribute('horizontal', kind === 'title' ? 'CENTER' : 'LEFT');
    for (const line of [...pp.getElementsByTagNameNS('*', 'lineSpacing')]) { line.setAttribute('type', 'PERCENT'); line.setAttribute('value', '130'); }
    for (const margin of [...pp.getElementsByTagNameNS('*', 'margin')]) {
      for (const name of ['left', 'right', 'intent', 'prev', 'next']) { const n = first(margin, name); if (n) n.setAttribute('value', name === 'next' ? kind === 'heading' ? '600' : '250' : name === 'left' && kind === 'body' ? '1200' : name === 'intent' && kind === 'body' ? '-1200' : '0'); }
    }
    const breaking = first(pp, 'breakSetting'); breaking?.setAttribute('keepWithNext', kind === 'heading' ? '1' : '0');
    paras.appendChild(pp);
  }
  chars.setAttribute('itemCnt', String(chars.children.length)); paras.setAttribute('itemCnt', String(paras.children.length));
  const firstRun = first(section, 'run')?.cloneNode(true) as Element;
  for (const cache of [...firstRun.getElementsByTagNameNS('*', 'linesegarray')]) cache.remove();
  const margins = first(firstRun, 'margin');
  for (const [name, value] of Object.entries({ left: '5669', right: '5669', top: '4252', bottom: '4252', header: '0', footer: '0' })) margins?.setAttribute(name, value);
  while (section.documentElement.firstChild) section.documentElement.firstChild.remove();
  const attr = (node: Element, values: Record<string, string>) => { for (const [k, v] of Object.entries(values)) node.setAttribute(k, v); return node; };
  blocks.forEach((block, i) => {
    const style = styleIds[block.kind];
    const p = attr(section.createElementNS(HP, 'hp:p'), { id: String(i + 1), paraPrIDRef: style.para, styleIDRef: '0', pageBreak: i === pageBreak ? '1' : '0', columnBreak: '0', merged: '0' });
    if (i === 0) p.appendChild(firstRun);
    const run = attr(section.createElementNS(HP, 'hp:run'), { charPrIDRef: style.char });
    block.text.split('\n').forEach((line, index) => { if (index) run.appendChild(section.createElementNS(HP, 'hp:lineBreak')); const t = section.createElementNS(HP, 'hp:t'); t.textContent = line; run.appendChild(t); });
    p.appendChild(run); section.documentElement.appendChild(p);
  });
  const serializer = new XMLSerializer();
  files['Contents/header.xml'] = strToU8(serializer.serializeToString(header));
  files['Contents/section0.xml'] = strToU8(serializer.serializeToString(section));
  if (files['settings.xml']) {
    const settings = parseXml(files['settings.xml']);
    const caret = first(settings, 'CaretPosition');
    for (const key of ['listIDRef', 'paraIDRef', 'pos']) caret?.setAttribute(key, '0');
    files['settings.xml'] = strToU8(serializer.serializeToString(settings));
  }
  files['Preview/PrvText.txt'] = strToU8(blocks.map(b => b.text).join('\n'));
  // First member must be the uncompressed HWPX media type.
  return zipSync({ mimetype: [strToU8('application/hwp+zip'), { level: 0 }], ...Object.fromEntries(Object.entries(files).filter(([name]) => name !== 'mimetype')) });
}

export async function exportPlanHwpx(draft: PlanDraft, options: { title: string; pages: PlanPages; signal?: AbortSignal }): Promise<Uint8Array<ArrayBuffer>> {
  const [{ runRhwp }, { planToOfficialDocument }] = await Promise.all([import('../officialDocument/rhwpClient'), import('./planDocument')]);
  return (await runRhwp({ action: 'render', document: planToOfficialDocument(draft, options.title, options.pages) }, options.signal)).bytes;
}
