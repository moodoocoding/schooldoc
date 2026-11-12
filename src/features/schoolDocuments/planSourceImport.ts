import { strFromU8, unzipSync } from 'fflate';
import { PLAN_LIMITS, validatePlanSources, type PlanSource, type PlanSourcePart } from '../../../supabase/functions/_shared/schoolPlan';
import { loadPdfJs } from '../../utils/pdfjs';
import { runRhwp } from '../officialDocument/rhwpClient';

export const PLAN_SOURCE_ACCEPT = '.pdf,.hwp,.hwpx,.txt';
export function readHwpxArchive(bytes: Uint8Array) {
  let expanded = 0, count = 0;
  return unzipSync(bytes, { filter: entry => {
    expanded += entry.originalSize; count++;
    if (expanded > 20 * 1024 * 1024 || count > 2000) throw new Error('압축을 푼 문서가 너무 큽니다. 필요한 본문을 붙여 넣어 주세요.');
    return /^(mimetype|Contents\/(?:content\.hpf|section\d+\.xml))$/.test(entry.name);
  } });
}
const xml = (content: string) => {
  if (/<!DOCTYPE|<!ENTITY/i.test(content)) throw new Error('외부 참조가 있는 문서는 읽을 수 없습니다.');
  const doc = new DOMParser().parseFromString(content, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('HWPX 본문을 읽지 못했습니다. 원본을 확인해 주세요.');
  return doc;
};
const textNodes = (element: Element) => [...element.getElementsByTagNameNS('*', 't')].map(t => t.textContent ?? '').join('');
export function splitPlanSourceText(text: string, prefix: string, label: string): PlanSourcePart[] {
  const clean = [...text.replace(/\r\n?/g, '\n')].filter(c => c.charCodeAt(0) >= 32 || [9, 10].includes(c.charCodeAt(0))).join('').trim();
  if (!clean) return [];
  const parts: PlanSourcePart[] = [];
  for (let start = 0; start < clean.length; start += PLAN_LIMITS.partChars) {
    const index = parts.length + 1;
    parts.push({ id: `${prefix}_${index}`, label: clean.length > PLAN_LIMITS.partChars ? `${label} / 부분 ${index}` : label, text: clean.slice(start, start + PLAN_LIMITS.partChars) });
  }
  return parts;
}
export function extractHwpxSource(bytes: Uint8Array, name: string, id: string): PlanSource {
  const files = readHwpxArchive(bytes);
  if (!files.mimetype || strFromU8(files.mimetype).trim() !== 'application/hwp+zip') throw new Error('한글 HWPX 파일인지 확인해 주세요. HWP는 HWPX로 저장한 뒤 올려 주세요.');
  let sections = Object.keys(files).filter(path => /^Contents\/section\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  if (files['Contents/content.hpf']) {
    const manifest = xml(strFromU8(files['Contents/content.hpf']));
    const items = [...manifest.getElementsByTagNameNS('*', 'item')];
    const ordered = [...manifest.getElementsByTagNameNS('*', 'itemref')].map(ref => items.find(item => item.getAttribute('id') === ref.getAttribute('idref'))?.getAttribute('href')).filter((p): p is string => !!p).map(path => path.startsWith('Contents/') ? path : `Contents/${path}`);
    const valid = ordered.filter(path => sections.includes(path));
    if (valid.length === sections.length && new Set(valid).size === sections.length) sections = valid;
  }
  const parts: PlanSourcePart[] = [];
  sections.forEach((path, s) => {
    const doc = xml(strFromU8(files[path]));
    [...doc.documentElement.children].filter(el => el.localName === 'p').forEach((paragraph, p) => {
      const tables = [...paragraph.getElementsByTagNameNS('*', 'tbl')];
      // Paragraph text outside tables, followed by cells with their actual row/column addresses.
      const clone = paragraph.cloneNode(true) as Element;
      for (const tbl of [...clone.getElementsByTagNameNS('*', 'tbl')]) tbl.remove();
      parts.push(...splitPlanSourceText(textNodes(clone), `s${s + 1}p${p + 1}`, `${s + 1}구역 ${p + 1}문단`));
      tables.forEach((table, t) => [...table.getElementsByTagNameNS('*', 'tc')].forEach((cell, c) => {
        const addr = cell.getElementsByTagNameNS('*', 'cellAddr')[0];
        const row = Number(addr?.getAttribute('rowAddr') ?? 0) + 1, col = Number(addr?.getAttribute('colAddr') ?? c) + 1;
        parts.push(...splitPlanSourceText(textNodes(cell), `s${s + 1}p${p + 1}t${t + 1}c${c + 1}`, `${s + 1}구역 ${p + 1}문단 표${t + 1} ${row}행 ${col}열`));
      }));
    });
  });
  return validatePlanSources([{ id, name, parts }])[0];
}
export async function importPlanSource(file: File, id: string, signal?: AbortSignal): Promise<PlanSource> {
  if (!file.size || file.size > PLAN_LIMITS.fileBytes) throw new Error('빈 파일은 제외하고 파일당 10MB 이하로 올려 주세요.');
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (!['pdf', 'hwp', 'hwpx', 'txt'].includes(extension ?? '')) throw new Error('PDF·HWP·HWPX·TXT를 올려 주세요.');
  const bytes = new Uint8Array(await file.arrayBuffer()); signal?.throwIfAborted();
  if (extension === 'hwpx' || extension === 'hwp') {
    try {
      // Bound XML/ZIP before handing HWPX to the parser; HWP is isolated in a cancellable worker.
      if (extension === 'hwpx') extractHwpxSource(bytes, file.name, id);
      else if (![208, 207, 17, 224, 161, 177, 26, 225].every((value, i) => bytes[i] === value)) throw new Error('HWP 5.0 파일인지 확인해 주세요. 다른 형식은 한글에서 HWPX로 저장해 주세요.');
      const result = await runRhwp({ action: 'import', bytes }, signal);
      signal?.throwIfAborted();
      return extractHwpxSource(result.bytes, file.name, id);
    }
    catch (cause) { if (cause instanceof Error && /[가-힣]/.test(cause.message)) throw cause; throw new Error('HWPX를 읽지 못했습니다. 손상된 파일인지 확인하거나 본문을 붙여 넣어 주세요.'); }
  }
  if (extension === 'txt') {
    let content: string;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('TXT는 UTF-8로 저장하거나 본문을 붙여 넣어 주세요.'); }
    return validatePlanSources([{ id, name: file.name, parts: splitPlanSourceText(content, 'text', '본문') }])[0];
  }
  if (strFromU8(bytes.slice(0, 5)) !== '%PDF-') throw new Error('PDF 확장자와 실제 내용이 다릅니다.');
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: bytes });
  let document;
  try { document = await task.promise; } catch { await task.destroy(); throw new Error('잠금 또는 손상된 PDF는 읽을 수 없습니다. 본문을 붙여 넣어 주세요.'); }
  try {
    if (document.numPages > 10) throw new Error('PDF는 10쪽 이하로 나누어 주세요.');
    const parts: PlanSourcePart[] = [];
    for (let page = 1; page <= document.numPages; page++) {
      signal?.throwIfAborted();
      const pdfPage = await document.getPage(page);
      const content = await pdfPage.getTextContent();
      const body = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
      if (!body.trim()) throw new Error(`${page}쪽의 텍스트를 읽지 못했습니다. 스캔 PDF는 OCR 후 올리거나 전체 본문을 붙여 넣어 주세요.`);
      parts.push(...splitPlanSourceText(body, `page${page}`, `${page}쪽`)); pdfPage.cleanup();
    }
    return validatePlanSources([{ id, name: file.name, parts }])[0];
  } finally { await task.destroy(); }
}
