/** 시간대 없는 기존 웹 요청은 서버에서 한국 시각으로 해석한다. 새 웹 요청은 UTC를 보낸다. */
export const normalizeDataCollectDeadline = (
  value: unknown,
  legacyOffset?: string,
  now = Date.now(),
): string => {
  if (value === undefined || value === null || value === "") return "";
  const invalid = () => new Error("마감 날짜와 시간을 확인해 주세요.");
  if (typeof value !== "string") throw invalid();
  const input = value.trim();
  if (!input) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(input);
  if (!match) throw invalid();
  const [, year, month, day, hour, minute, second = "0", , zone] = match;
  const calendar = new Date(0);
  calendar.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  if (
    calendar.getUTCFullYear() !== Number(year)
    || calendar.getUTCMonth() !== Number(month) - 1
    || calendar.getUTCDate() !== Number(day)
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || (zone && zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))
  ) throw invalid();
  const timestamp = Date.parse(!zone && legacyOffset ? input + legacyOffset : input);
  if (!Number.isFinite(timestamp)) throw invalid();
  if (timestamp <= now) throw new Error("마감 시각은 현재보다 뒤로 설정해 주세요.");
  return new Date(timestamp).toISOString();
};
