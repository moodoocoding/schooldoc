import { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { Registry } from './types';
import { RegistryPrintSheet } from './RegistryPrintSheet';

// Chrome 메뉴 인쇄도 축소 미리보기 대신 body 직속의 원본 전체 쪽을 인쇄한다.
// URL이 아직 없는 서명은 빈 서명으로 출력하지 않고 준비 방법을 안내한다.
export function RegistryBrowserPrint({ registry }: { registry: Registry }) {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  if (!printing) return null;
  const incomplete = registry.participants.some((p) => p.signature && (!p.signature.dataUrl || p.imageError));
  return createPortal(
    <div className="registry-browser-print">
      <style>{`@media print {
        body > #root { display: none !important; }
        .registry-browser-print, .registry-browser-print * { visibility: visible !important; }
        .registry-browser-print { position: absolute; inset: 0; width: 210mm; }
        .registry-browser-print .registry-print-root { position: static !important; }
        .registry-print-page { margin: 0 !important; width: 210mm !important; height: 297mm !important; }
        .registry-print-page:last-child { break-after: auto; page-break-after: auto; }
      }`}</style>
      {incomplete ? <div className="p-8"><h1>서명 이미지 준비가 필요합니다</h1><p>인쇄 창을 닫고 등록부 관리 화면의 ‘전체 인쇄’를 눌러 주세요. 완료된 서명 파일을 확인한 뒤 전체 쪽을 준비합니다.</p></div> : <RegistryPrintSheet registry={registry} />}
    </div>, document.body,
  );
}
