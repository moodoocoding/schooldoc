import { supabase } from "../../utils/supabaseClient";
import { getPublicAppOrigin } from "../../utils/publicAppOrigin";
import {
  changedRolePeriod,
  defaultRoleState,
  publicRoleProjection,
  roleToday,
  validateRoleRecord,
  validateRoleStateChange,
  type RoleBoard,
  type RoleRecord,
  type RoleState,
  type PublicRoleBoard,
} from "../../../supabase/functions/_shared/classroomRoles";
export * from "../../../supabase/functions/_shared/classroomRoles";
export const isRolesDemo =
  import.meta.env.DEV &&
  import.meta.env.VITE_CLASSROOM_ROLES_DEMO_MODE === "true";
const demoKey = "schooldoc_classroom_roles_demo_v1";
const recordsKey = `${demoKey}_records`;
const copy = <T>(value: T): T => structuredClone(value);
function demoBoard(): RoleBoard {
  const raw = localStorage.getItem(demoKey);
  if (raw) return JSON.parse(raw);
  const board = {
    id: crypto.randomUUID(),
    version: 1,
    public_token: crypto.randomUUID(),
    state: defaultRoleState(),
  };
  localStorage.setItem(demoKey, JSON.stringify(board));
  return board;
}
function demoRecords(): RoleRecord[] {
  return JSON.parse(localStorage.getItem(recordsKey) ?? "[]");
}
async function invoke<T>(endpoint: string, body: object): Promise<T> {
  if (!supabase) throw new Error("서버 연결 설정을 확인해 주세요.");
  const { data, error } = await supabase.functions.invoke(endpoint, { body });
  if (error) {
    let message = "연결하지 못했습니다. 입력을 유지한 채 다시 시도해 주세요.";
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const detail = await context.clone().json();
        if (typeof detail.error === "string") message = detail.error;
      } catch {
        /* use safe fallback */
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export async function loadRoleBoard(): Promise<RoleBoard> {
  return isRolesDemo
    ? copy(demoBoard())
    : invoke("classroom-roles-admin", { action: "load" });
}
export async function saveRoleBoard(
  board: RoleBoard,
  state: RoleState,
  rotateToken = false,
): Promise<RoleBoard> {
  if (!isRolesDemo)
    return invoke("classroom-roles-admin", {
      action: rotateToken ? "rotateToken" : "save",
      version: board.version,
      state,
    });
  const current = demoBoard();
  if (board.version !== current.version)
    throw new Error(
      "다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
    );
  validateRoleStateChange(current.state, state);
  const changedPeriod = changedRolePeriod(current.state, state);
  if (
    changedPeriod &&
    demoRecords().some(
      (record) =>
        record.period_id === changedPeriod.before.id &&
        (!changedPeriod.after ||
          record.record_date < changedPeriod.after.start ||
          record.record_date > changedPeriod.after.end),
    )
  )
    throw new Error(
      "해당 기간에 이미 기록된 날짜가 있습니다. 기록이 포함되도록 기간을 조정하거나 삭제하지 마세요.",
    );
  const next = {
    ...current,
    state: copy(state),
    version: current.version + 1,
    public_token: rotateToken ? crypto.randomUUID() : current.public_token,
  };
  localStorage.setItem(demoKey, JSON.stringify(next));
  return next;
}
export async function loadRoleRecords(
  start: string,
  end: string,
): Promise<RoleRecord[]> {
  return isRolesDemo
    ? demoRecords().filter(
        (r) => r.record_date >= start && r.record_date <= end,
      )
    : invoke("classroom-roles-admin", { action: "records", start, end });
}
export async function writeRoleRecord(input: {
  periodId: string;
  studentId: string;
  date: string;
  status: string;
  version?: number;
  token?: string;
}): Promise<void> {
  if (!isRolesDemo) {
    await invoke(
      input.token ? "classroom-roles-public" : "classroom-roles-admin",
      { action: "record", ...input },
    );
    return;
  }
  const board = demoBoard();
  const source = input.token ? "student" : "teacher";
  if (input.token && input.token !== board.public_token)
    throw new Error("사용할 수 없는 학급 링크입니다.");
  if (!input.token && input.version !== board.version)
    throw new Error("배정이 변경되었습니다. 새로고침해 주세요.");
  validateRoleRecord(
    board.state,
    input.periodId,
    input.studentId,
    input.date,
    input.status,
    source,
  );
  if (
    source === "student" &&
    demoRecords().some((record) =>
      record.period_id === input.periodId &&
      record.student_id === input.studentId &&
      record.record_date === input.date &&
      record.source === "teacher"
    )
  )
    throw new Error("선생님이 확인한 기록은 학생 화면에서 바꿀 수 없어요.");
  const records = demoRecords().filter(
    (r) =>
      !(
        r.period_id === input.periodId &&
        r.student_id === input.studentId &&
        r.record_date === input.date
      ),
  );
  if (input.status !== "missing")
    records.push({
      period_id: input.periodId,
      student_id: input.studentId,
      record_date: input.date,
      status: input.status as RoleRecord["status"],
      source,
      updated_at: new Date().toISOString(),
    });
  localStorage.setItem(recordsKey, JSON.stringify(records));
}
export async function loadPublicRoleBoard(
  token: string,
  studentId?: string,
): Promise<PublicRoleBoard> {
  if (!isRolesDemo)
    return invoke("classroom-roles-public", {
      action: "view",
      token,
      studentId,
    });
  const board = demoBoard();
  if (token !== board.public_token)
    throw new Error("사용할 수 없는 학급 링크입니다.");
  return publicRoleProjection(
    board.state,
    demoRecords(),
    roleToday(),
    studentId,
  );
}
export const rolePublicUrl = (token: string) =>
  `${getPublicAppOrigin()}/s/roles/${token}`;
