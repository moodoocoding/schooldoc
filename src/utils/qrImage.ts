/**
 * QR 코드를 이미지로 내려받는 공용 도구.
 *
 * 화면에 QR을 그렸다면 예외 없이 이미지로 저장할 수 있어야 한다. PDF나 인쇄물로 받을 수
 * 있다는 것은 대체가 되지 못한다. 교사는 QR 하나만 떼어 안내문·공문·슬라이드에 붙이는 일이
 * 잦고, 저장 버튼이 없으면 화면을 캡처하게 되는데 그렇게 만든 QR은 인쇄하면 잘 안 읽힌다.
 *
 * 새로 QR을 그리는 화면을 만들 때도 이 모듈을 함께 붙인다.
 */

/** 인쇄해도 읽히는 크기. 화면 QR은 176px 안팎이라 그대로 저장하면 흐려진다. */
export const QR_IMAGE_SIZE = 1024;

export const qrImageFileName = (title: string, suffix: string, fallback: string) => {
  const safe = title.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 60) || fallback;
  return `${safe}_${suffix}.png`;
};

/** 화면의 QR SVG를 인쇄에 쓸 수 있는 크기의 PNG로 바꾼다. */
export const svgToPngBlob = async (svg: SVGSVGElement, size: number = QR_IMAGE_SIZE) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));
  const markup = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('QR 이미지를 만들지 못했습니다.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('QR 이미지를 만들지 못했습니다.');
    // 흰 바탕을 깔지 않으면 어두운 배경에 얹었을 때 QR을 읽지 못한다.
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('QR 이미지를 만들지 못했습니다.')), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 즉시 해제하면 브라우저가 저장을 시작하기 전에 URL이 사라질 수 있다.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * 감싼 요소 안의 QR SVG를 찾아 PNG로 저장한다.
 * 화면마다 상태 관리가 조금씩 달라 저장 동작만 여기서 맡고 처리 중 표시는 화면에 맡긴다.
 */
export const saveQrImage = async (container: HTMLElement | null, fileName: string) => {
  const svg = container?.querySelector('svg');
  if (!svg) throw new Error('QR 코드를 찾지 못했습니다.');
  downloadBlob(await svgToPngBlob(svg as SVGSVGElement), fileName);
};
