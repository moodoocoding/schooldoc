/** A4 높이 안에 카드의 실제 글자 높이를 보존하면서 2열로 배치한다. */
export const studentResultsQrPageSize = (availableHeight: number, cardHeight: number) => {
  if (!Number.isFinite(availableHeight) || !Number.isFinite(cardHeight) || availableHeight <= 0 || cardHeight <= 0) {
    throw new RangeError('QR 인쇄 영역의 크기를 확인해 주세요.');
  }
  const gap = 12;
  const rows = Math.min(4, Math.floor((availableHeight + gap) / (cardHeight + gap)));
  if (rows < 1) throw new RangeError('이름과 안내가 한 페이지보다 깁니다. 내용을 확인해 주세요.');
  return rows * 2;
};
