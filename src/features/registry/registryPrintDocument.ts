/** 화면 배율·스크롤과 분리된 원본 문서. 인쇄와 데모 PDF가 함께 사용한다. */
export const createRegistryPrintDocument = async (source: HTMLElement) => {
  const frame = document.createElement('iframe');
  frame.title = '등록부 전체 인쇄';
  Object.assign(frame.style, {
    position: 'fixed', left: '0', top: '0', width: '794px', height: '1123px',
    opacity: '0', pointerEvents: 'none', zIndex: '-1',
  });
  document.body.append(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  doc.close();
  const waits: Promise<void>[] = [];
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    const clone = node.cloneNode(true) as HTMLStyleElement | HTMLLinkElement;
    if (clone instanceof HTMLLinkElement) {
      waits.push(new Promise((resolve, reject) => {
        clone.onload = () => resolve();
        clone.onerror = () => reject(new Error('인쇄 스타일을 불러오지 못했습니다.'));
      }));
    }
    doc.head.append(clone);
  });
  const style = doc.createElement('style');
  style.textContent = `
    html,body { margin:0; padding:0; width:794px; background:white; }
    .registry-print-root { position:static!important; margin:0!important; }
    .registry-print-page { margin:0!important; box-shadow:none!important; transform:none!important; }
    @media print {
      html,body { width:210mm; }
      body * { visibility:visible!important; }
      .registry-print-page { width:210mm!important; height:297mm!important; }
      .registry-print-page:last-child { break-after:auto; page-break-after:auto; }
    }`;
  doc.head.append(style);
  doc.body.append(source.cloneNode(true));
  try {
    await Promise.all(waits);
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map((img) => img.decode()));
    return {
      frame, document: doc,
      pages: Array.from(doc.querySelectorAll<HTMLElement>('.registry-print-page')),
      dispose: () => frame.remove(),
    };
  } catch {
    frame.remove();
    throw new Error('서명 이미지 또는 인쇄 자료를 불러오지 못했습니다. 다시 시도해 주세요.');
  }
};
