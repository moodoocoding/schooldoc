/** 단위 테스트의 형식·중복 검사에 사용하는 합성 문자열. 자연스러운 AI 문장 검증 자료가 아니다. */
export function fitCommentLengthForTest(text: string, target = 200): string {
  const missing = target - Array.from(text).length;
  if (missing <= 0) return text;
  if (missing < 4) throw new Error('분량 검사 fixture에 충분한 여백이 필요합니다.');
  const seed = text.replace(/[.!?。]/gu, '') + ' ';
  const padding = seed.repeat(Math.ceil(missing / seed.length)).slice(0, missing - 4);
  return `${text} ${padding} 임.`;
}
