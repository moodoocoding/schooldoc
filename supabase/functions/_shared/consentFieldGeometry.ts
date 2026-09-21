/** PDF 쪽 대비 %. 편집기와 서버 검증이 같은 최소 크기를 사용한다. */
export const consentFieldMinimumSize = (kind: string) => (
  kind === 'text' || kind === 'date'
    ? { width: 3, height: 1 }
    : kind === 'checkbox' ? { width: 1, height: 0.7 } : { width: 10, height: 4 }
);

export const isConsentFieldRectValid = (kind: string, x: number, y: number, width: number, height: number) => {
  const minimum = consentFieldMinimumSize(kind);
  return [x, y, width, height].every(Number.isFinite)
    && x >= 0 && y >= 0 && width >= minimum.width && height >= minimum.height
    && x + width <= 100 && y + height <= 100;
};
