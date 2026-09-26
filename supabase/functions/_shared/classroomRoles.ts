/** Browser and Edge Functions share the same validation and calendar rules. */
export type RoleStudent = { id: string; number: number; name: string };
export type ClassroomRole = {
  id: string;
  name: string;
  description: string;
  capacity: number;
  weekdays: number[];
};
export type RolePeriod = {
  id: string;
  start: string;
  end: string;
  students: RoleStudent[];
  roles: ClassroomRole[];
  assignments: Record<string, string>;
};
export type RoleSettings = {
  title: string;
  schoolDays: number[];
  excludedDates: string[];
  publicEnabled: boolean;
  showPublicStatus: boolean;
  maskDisplayNames: boolean;
};
export type RoleState = {
  roster: RoleStudent[];
  roles: ClassroomRole[];
  periods: RolePeriod[];
  settings: RoleSettings;
};
export type RoleStatus = "done" | "not_done" | "exempt";
export type RoleRecord = {
  period_id: string;
  student_id: string;
  record_date: string;
  status: RoleStatus;
  source: "student" | "teacher";
  updated_at: string;
};
export type RoleBoard = {
  id: string;
  version: number;
  public_token: string;
  state: RoleState;
};
export type PublicRoleBoard = {
  title: string;
  today: string;
  periodId: string | null;
  message: string;
  students: (RoleStudent & {
    role: ClassroomRole;
    eligible: boolean;
    status?: RoleStatus;
  })[];
  maskDisplayNames: boolean;
  showStatus: boolean;
};

export const ROLE_STATUS_LABELS = {
  done: "했어요",
  not_done: "못했어요",
  exempt: "해당 없음",
  missing: "미기록",
};
export const roleToday = (now = new Date()) =>
  new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
export const validRoleDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^20\d{2}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const roleWeekday = (date: string) =>
  new Date(`${date}T00:00:00Z`).getUTCDay();
export const activeRolePeriod = (state: RoleState, date: string) =>
  state.periods.find((p) => p.start <= date && date <= p.end);
export const roleForStudent = (period: RolePeriod, studentId: string) =>
  period.roles.find((r) => r.id === period.assignments[studentId]);
export const isRoleDay = (
  state: RoleState,
  period: RolePeriod,
  studentId: string,
  date: string,
) =>
  date >= period.start &&
  date <= period.end &&
  state.settings.schoolDays.includes(roleWeekday(date)) &&
  !state.settings.excludedDates.includes(date) &&
  Boolean(
    roleForStudent(period, studentId)?.weekdays.includes(roleWeekday(date)),
  );
export function roleMonthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  };
}
export function roleDates(start: string, end: string): string[] {
  if (!validRoleDate(start) || !validRoleDate(end) || start > end) return [];
  const dates: string[] = [];
  for (
    let time = Date.parse(`${start}T00:00:00Z`);
    time <= Date.parse(`${end}T00:00:00Z`) && dates.length < 366;
    time += 86400000
  )
    dates.push(new Date(time).toISOString().slice(0, 10));
  return dates;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown): asserts value is Record<string, unknown> {
  ensure(
    value && typeof value === "object" && !Array.isArray(value),
    "입력 형식을 확인해 주세요.",
  );
}
function shortText(
  value: unknown,
  max: number,
  empty = false,
): asserts value is string {
  ensure(
    typeof value === "string" &&
      value.length <= max &&
      (empty || value.trim().length > 0),
    "글자 수와 빈 항목을 확인해 주세요.",
  );
}
function days(value: unknown): asserts value is number[] {
  ensure(
    Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 7 &&
      value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
      new Set(value).size === value.length,
    "요일을 하나 이상 선택해 주세요.",
  );
}
export function validateRoleRoster(
  value: unknown,
): asserts value is RoleStudent[] {
  ensure(
    Array.isArray(value) && value.length <= 60,
    "학생은 최대 60명까지 등록할 수 있습니다.",
  );
  for (const s of value) {
    object(s);
    ensure(
      typeof s.id === "string" && uuid.test(s.id),
      "학생 식별자가 올바르지 않습니다.",
    );
    shortText(s.name, 40);
    ensure(
      Number.isInteger(s.number) &&
        Number(s.number) >= 1 &&
        Number(s.number) <= 999,
      "학생 번호는 1~999 사이여야 합니다.",
    );
  }
  ensure(
    new Set(value.map((s) => s.id)).size === value.length &&
      new Set(value.map((s) => s.number)).size === value.length,
    "학생 번호가 중복되었습니다.",
  );
}
export function validateClassroomRoles(
  value: unknown,
): asserts value is ClassroomRole[] {
  ensure(
    Array.isArray(value) && value.length <= 60,
    "역할은 최대 60개까지 등록할 수 있습니다.",
  );
  for (const r of value) {
    object(r);
    ensure(
      typeof r.id === "string" && uuid.test(r.id),
      "역할 식별자가 올바르지 않습니다.",
    );
    shortText(r.name, 40);
    shortText(r.description, 500, true);
    ensure(
      Number.isInteger(r.capacity) &&
        Number(r.capacity) >= 1 &&
        Number(r.capacity) <= 60,
      "역할 정원은 1~60명입니다.",
    );
    days(r.weekdays);
  }
  ensure(
    new Set(value.map((r) => r.id)).size === value.length,
    "역할이 중복되었습니다.",
  );
}
export function validateRoleState(value: unknown): asserts value is RoleState {
  object(value);
  validateRoleRoster(value.roster);
  validateClassroomRoles(value.roles);
  object(value.settings);
  const settings = value.settings;
  shortText(settings.title, 60);
  days(settings.schoolDays);
  ensure(
    Array.isArray(settings.excludedDates) &&
      settings.excludedDates.length <= 366 &&
      settings.excludedDates.every(validRoleDate),
    "제외일 날짜를 확인해 주세요.",
  );
  for (const key of ["publicEnabled", "showPublicStatus", "maskDisplayNames"])
    ensure(typeof settings[key] === "boolean", "공개 설정을 확인해 주세요.");
  ensure(
    Array.isArray(value.periods) && value.periods.length <= 60,
    "배정 기간은 최대 60개까지 저장할 수 있습니다.",
  );
  const periods = value.periods;
  for (const p of periods) {
    object(p);
    ensure(
      typeof p.id === "string" && uuid.test(p.id),
      "기간 식별자가 올바르지 않습니다.",
    );
    ensure(
      validRoleDate(p.start) &&
        validRoleDate(p.end) &&
        p.start <= p.end &&
        Date.parse(p.end) - Date.parse(p.start) <= 365 * 86400000,
      "배정 기간은 시작일부터 최대 1년 이내로 정해 주세요.",
    );
    validateRoleRoster(p.students);
    validateClassroomRoles(p.roles);
    ensure(p.students.length > 0, "학생 명단을 먼저 등록해 주세요.");
    object(p.assignments);
    const assignments = p.assignments;
    const students = p.students;
    ensure(
      Object.keys(assignments).length === students.length &&
        Object.keys(assignments).every((id) =>
          students.some((s: RoleStudent) => s.id === id),
        ),
      "모든 학생에게 역할을 배정해 주세요.",
    );
    for (const s of p.students)
      ensure(
        p.roles.some((r: ClassroomRole) => r.id === assignments[s.id]),
        "모든 학생에게 역할을 배정해 주세요.",
      );
    for (const r of p.roles)
      ensure(
        Object.values(assignments).filter((id) => id === r.id).length <=
          r.capacity,
        `${r.name} 역할의 정원을 초과했습니다.`,
      );
  }
  ensure(
    new Set(periods.map((p) => p.id)).size === periods.length,
    "배정 기간이 중복되었습니다.",
  );
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++)
    ensure(
      sorted[i - 1].end < sorted[i].start,
      "기존 배정 기간과 겹칩니다. 시작일을 확인해 주세요.",
    );
}
export function validateRoleStateChange(previous: RoleState, next: RoleState) {
  validateRoleState(next);
  for (const p of previous.periods)
    ensure(
      next.periods.some(
        (n) => n.id === p.id && JSON.stringify(n) === JSON.stringify(p),
      ),
      "이미 확정한 배정은 보존됩니다. 새 기간을 만들어 교체해 주세요.",
    );
  ensure(
    next.periods.length <= previous.periods.length + 1,
    "한 번에 한 기간씩 확정해 주세요.",
  );
}
export function validateRoleRecord(
  state: RoleState,
  periodId: string,
  studentId: string,
  date: string,
  status: unknown,
  source: "student" | "teacher",
  today = roleToday(),
) {
  ensure(
    validRoleDate(date) && date <= today,
    "미래 날짜에는 기록할 수 없습니다.",
  );
  ensure(
    status === "done" ||
      status === "not_done" ||
      status === "exempt" ||
      (source === "teacher" && status === "missing"),
    "기록 상태를 확인해 주세요.",
  );
  const period = state.periods.find((p) => p.id === periodId);
  ensure(
    period &&
      period.students.some((s) => s.id === studentId) &&
      date >= period.start &&
      date <= period.end,
    "배정 정보를 확인해 주세요.",
  );
  if (source === "student") {
    ensure(state.settings.publicEnabled, "학생 입력이 잠시 중지되었습니다.");
    ensure(
      date === today && (status === "done" || status === "not_done"),
      "학생은 오늘의 실천만 기록할 수 있습니다.",
    );
    ensure(
      isRoleDay(state, period, studentId, date),
      "오늘은 이 역할의 실천일이 아닙니다.",
    );
  }
}
export function publicRoleProjection(
  state: RoleState,
  records: RoleRecord[],
  today = roleToday(),
  selectedId?: string,
): PublicRoleBoard {
  const period = activeRolePeriod(state, today);
  const enabled = state.settings.publicEnabled;
  return {
    title: state.settings.title,
    today,
    periodId: enabled && period ? period.id : null,
    message: !enabled
      ? "선생님이 학생 입력을 잠시 중지했어요."
      : !period
        ? "오늘은 배정된 역할이 없어요."
        : "",
    maskDisplayNames: state.settings.maskDisplayNames,
    showStatus: state.settings.showPublicStatus,
    students:
      !enabled || !period
        ? []
        : period.students.map((s) => {
            const role = roleForStudent(period, s.id)!;
            return {
              id: s.id,
              number: s.number,
              name: s.name,
              role: {
                id: role.id,
                name: role.name,
                description: role.description,
                capacity: role.capacity,
                weekdays: role.weekdays,
              },
              eligible: isRoleDay(state, period, s.id, today),
              ...(state.settings.showPublicStatus || selectedId === s.id
                ? {
                    status: records.find(
                      (r) =>
                        r.period_id === period.id &&
                        r.student_id === s.id &&
                        r.record_date === today,
                    )?.status,
                  }
                : {}),
            };
          }),
  };
}
export function parseRoleRoster(
  text: string,
  previous: RoleStudent[] = [],
): RoleStudent[] {
  const usedIds = new Set<string>();
  const students = text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      const match = line.trim().match(/^(\d+)[\s,.\t]+(.+)$/);
      const number = match ? Number(match[1]) : index + 1;
      const name = (match ? match[2] : line).trim();
      const existing = previous.find(
        (s) => s.number === number && s.name === name && !usedIds.has(s.id),
      );
      const id = existing?.id ?? crypto.randomUUID();
      usedIds.add(id);
      return { id, number, name };
    });
  validateRoleRoster(students);
  return students;
}
export function defaultRoleState(): RoleState {
  const templates = [
    ["칠판 도우미", "칠판과 칠판 주변을 정리해요."],
    ["책 깔끔이", "학급 문고의 책을 정리해요."],
    ["학습 나눔이", "학습지와 안내장을 나눠 줘요."],
    ["전등 지킴이", "빈 교실의 전등을 꺼요."],
    ["문 지킴이", "교실 문을 안전하게 여닫아요."],
    ["지구 지킴이", "분리수거함 주변을 정리해요."],
    ["게임 마스터", "보드게임을 정리해요."],
    ["책상 정리 도우미", "책상과 의자 줄을 맞춰요."],
    ["분실물 도우미", "주인을 잃은 물건을 정리해요."],
    ["사물함 도우미", "사물함 주변을 정리해요."],
    ["앞 청소 도우미", "교실 앞쪽을 청소해요."],
    ["뒤 청소 도우미", "교실 뒤쪽을 청소해요."],
    ["복도 도우미", "우리 반 앞 복도를 정리해요."],
    ["준비물 도우미", "공용 준비물을 정리해요."],
    ["환기 도우미", "선생님과 함께 환기를 도와요."],
    ["게시판 도우미", "게시물을 정돈해요."],
    ["쓰레기통 도우미", "쓰레기통 주변을 깨끗이 해요."],
    ["함께 도우미", "도움이 필요한 친구의 역할을 도와요."],
  ];
  return {
    roster: [],
    roles: templates.map(([name, description]) => ({
      id: crypto.randomUUID(),
      name,
      description,
      capacity: 2,
      weekdays: [1, 2, 3, 4, 5],
    })),
    periods: [],
    settings: {
      title: "우리 반 1인 1역",
      schoolDays: [1, 2, 3, 4, 5],
      excludedDates: [],
      publicEnabled: true,
      showPublicStatus: false,
      maskDisplayNames: true,
    },
  };
}
