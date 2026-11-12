/**
 * 운영 기간: 달력에서 고른 시작일·종료일(YYYY-MM-DD)과 저장 문자열(편람 날짜 표기) 사이의 변환.
 * 편람 49쪽: 2026. 11. 23. 꼴, 월·일의 0은 쓰지 않는다. 기간은 물결표(∼)로 잇고 같은 해면 끝 날짜의 연도를 생략한다.
 */
export interface PlanTimingRange { start: string; end: string }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const parts = (iso: string) => { const m = ISO.exec(iso); return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null; };
const iso = (y: string | number, m: string | number, d: string | number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** 시작일만 있으면 하루, 둘 다 있으면 기간. 시작일이 없으면 빈 문자열(미정). */
export function formatPlanTiming({ start, end }: PlanTimingRange): string {
  const a = parts(start), b = parts(end);
  if (!a) return '';
  const first = `${a.y}. ${a.m}. ${a.d}.`;
  if (!b || end <= start) return first;
  return `${first}∼${b.y === a.y ? '' : `${b.y}. `}${b.m}. ${b.d}.`;
}

/** 저장된 운영 기간을 달력 값으로 되돌린다. 달력으로 만든 표기가 아니면(예전 자유 입력) null. */
export function parsePlanTiming(value: string): PlanTimingRange | null {
  const text = value.trim();
  if (!text) return { start: '', end: '' };
  const m = /^(\d{4})\. (\d{1,2})\. (\d{1,2})\.(?:∼(?:(\d{4})\. )?(\d{1,2})\. (\d{1,2})\.)?$/.exec(text);
  if (!m) return null;
  const start = iso(m[1], m[2], m[3]);
  return { start, end: m[5] ? iso(m[4] ?? m[1], m[5], m[6]) : '' };
}
