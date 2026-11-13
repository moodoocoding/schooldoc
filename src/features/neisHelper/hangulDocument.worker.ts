import init, { HwpDocument } from '@rhwp/core';
import wasmUrl from '@rhwp/core/rhwp_bg.wasm?url';
import { NEIS_MAX_PAGES } from '../../../supabase/functions/_shared/neisHelper';

type HangulTextRun = { text: string; x: number; y: number; w: number; fontSize: number };
export type HangulPage = { svg: string; runs: HangulTextRun[]; width: number; height: number };
export type HangulRequest = { file: File } | { index: number };
export type HangulResponse = { count: number } | { page: HangulPage } | { error: string };

let doc: HwpDocument | undefined;

self.onmessage = async ({ data }: MessageEvent<HangulRequest>) => {
  try {
    if ('file' in data) {
      await init({ module_or_path: wasmUrl });
      doc = new HwpDocument(new Uint8Array(await data.file.arrayBuffer()));
      const format = data.file.name.toLowerCase().endsWith('.hwpx') ? 'hwpx' : 'hwp';
      if (doc.getSourceFormat() !== format) {
        self.postMessage({ error: '파일 확장자와 내용이 일치하는 HWP 5.0 또는 HWPX를 올려 주세요.' } satisfies HangulResponse);
        return;
      }
      const count = doc.pageCount();
      if (count < 1 || count > NEIS_MAX_PAGES) {
        self.postMessage({ error: `한글 문서는 1~${NEIS_MAX_PAGES}쪽으로 올려 주세요.` } satisfies HangulResponse);
        return;
      }
      self.postMessage({ count } satisfies HangulResponse);
    } else if (doc) {
      const { index } = data;
      const { printSize } = JSON.parse(doc.getPageInfo(index)) as { printSize: { width: number; height: number } };
      const page: HangulPage = {
        ...printSize,
        svg: doc.renderPageSvgWithProfile(index, 'print'),
        runs: (JSON.parse(doc.getPageTextLayout(index)) as { runs: HangulTextRun[] }).runs,
      };
      self.postMessage({ page } satisfies HangulResponse);
      if (index === doc.pageCount() - 1) {
        doc.free();
        doc = undefined;
      }
    }
  } catch {
    doc?.free();
    doc = undefined;
    self.postMessage({ error: '한글 문서를 읽지 못했습니다. 잠금이나 손상 여부를 확인하거나 PDF로 저장해 올려 주세요.' } satisfies HangulResponse);
  }
};
