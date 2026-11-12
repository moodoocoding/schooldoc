import init, { HwpDocument } from '@rhwp/core';
import wasmUrl from '@rhwp/core/rhwp_bg.wasm?url';
import templateUrl from './assets/blank.hwpx?url';
import { substituteFor } from './fontAssets';
import { OFFICIAL_DOCUMENT_KINDS, profileFonts } from './format';
import { checkedHwpxExport, writeOfficialDocument } from './rhwpWriter';
import type { RhwpRequest, RhwpResponse } from './rhwpClient';

const bytes = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('문서 엔진 자료를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
  return new Uint8Array(await response.arrayBuffer());
};
self.onmessage = async (event: MessageEvent<RhwpRequest>) => {
  let doc: HwpDocument | undefined;
  try {
    const request = event.data;
    await init({ module_or_path: wasmUrl });
    if (request.action === 'import') {
      doc = new HwpDocument(request.bytes);
      if (doc.pageCount() > 20) throw new Error('한글 공문은 20쪽 이하로 나누어 주세요.');
      if ((JSON.parse(doc.getTextFileText()) as string).length > 40000) throw new Error('한글 공문 본문은 4만 자 이하로 나누어 주세요.');
      const data = checkedHwpxExport(doc);
      if (data.length > 20 * 1024 * 1024) throw new Error('한글 공문이 너무 큽니다. 필요한 본문을 붙여 넣어 주세요.');
      self.postMessage({ ok: true, bytes: data, svgs: [], pageCount: doc.pageCount() } satisfies RhwpResponse, { transfer: [data.buffer] });
    } else {
      const families = profileFonts(OFFICIAL_DOCUMENT_KINDS[request.document.kind].profile);
      const cache = new Map<string, Promise<Uint8Array>>();
      const load = (url: string) => { if (!cache.has(url)) cache.set(url, bytes(url)); return cache.get(url)!; };
      const [template, ...sources] = await Promise.all([bytes(templateUrl), ...families.map(async family => {
        const source = substituteFor(family);
        return [family, { regular: await load(source.regular.url), bold: await load(source.bold.url) }] as const;
      })]);
      doc = new HwpDocument(template);
      writeOfficialDocument(doc, request.document, request.maxPages, Object.fromEntries(sources));
      const data = checkedHwpxExport(doc);
      // Render the exact saved bytes, so the preview and download cannot diverge.
      doc.free(); doc = new HwpDocument(data);
      const svgs = Array.from({ length: doc.pageCount() }, (_, i) => doc!.renderPageSvgWithProfile(i, 'print'));
      self.postMessage({ ok: true, bytes: data, svgs, pageCount: doc.pageCount() } satisfies RhwpResponse, { transfer: [data.buffer] });
    }
  } catch (error) {
    // Never expose parser internals or document text in product errors/logs.
    const message = error instanceof Error && /^(문서|현재 내용을|한글 공문)/.test(error.message) ? error.message : '한글 문서를 처리하지 못했습니다. 잠금·손상 여부를 확인하거나 본문을 붙여 넣어 주세요.';
    self.postMessage({ ok: false, message } satisfies RhwpResponse);
  } finally { doc?.free(); }
};
