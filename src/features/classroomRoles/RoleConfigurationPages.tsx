import { useState } from "react";
import { Link } from "react-router-dom";
import {
  activeRolePeriod,
  defaultRoleState,
  roleToday,
  validateRoleState,
  validateRoleStateChange,
  type ClassroomRole,
} from "./roleApi";
import type { RolePageProps } from "./ClassroomRolesWorkspace";
import { RoleExcludedDatesCalendar } from "./RoleExcludedDatesCalendar";
import {
  RoleDays,
  RoleError,
  RoleField,
  roleButton,
  roleInput,
  rolePanel,
  roleSecondary,
} from "./RoleControls";

export function RoleCatalogPage({ board, save, busy }: RolePageProps) {
  const [roles, setRoles] = useState(structuredClone(board.state.roles));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const change = (id: string, patch: Partial<ClassroomRole>) => {
    setRoles(roles.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(false);
  };
  const submit = async () => {
    const state = { ...board.state, roles };
    setError("");
    try {
      validateRoleState(state);
      setSaved(await save(state));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-[#526174]">
        역할 이름과 할 일을 적으면 됩니다. 정원과 요일은 필요할 때 조정하세요.
        여기서 바꾼 내용은 다음 배정부터 사용하며, 이미 확정한 배정은
        유지됩니다.
      </p>
      <RoleError message={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={roleSecondary}
          disabled={roles.length >= 60}
          onClick={() => {
            setRoles([
              ...roles,
              {
                id: crypto.randomUUID(),
                name: "",
                description: "",
                capacity: 1,
                weekdays: [1, 2, 3, 4, 5],
              },
            ]);
            setSaved(false);
          }}
        >
          새 역할 추가
        </button>
        {!roles.length && (
          <button
            className={roleSecondary}
            onClick={() => {
              setRoles(defaultRoleState().roles);
              setSaved(false);
            }}
          >
            기본 역할 불러오기
          </button>
        )}
        <span className="text-sm">
          {roles.length}개 역할 · 총 {roles.reduce((n, r) => n + r.capacity, 0)}
          자리
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((r, i) => (
          <section className={`${rolePanel} space-y-4`} key={r.id}>
            <div className="flex justify-between">
              <h2 className="font-bold">역할 {i + 1}</h2>
              <button
                className="min-h-11 px-3 text-sm text-red-700"
                onClick={() => {
                  if (
                    window.confirm(
                      "역할 목록에서 삭제할까요? 이미 확정한 배정과 기록은 유지됩니다.",
                    )
                  ) {
                    setRoles(roles.filter((role) => role.id !== r.id));
                    setSaved(false);
                  }
                }}
                aria-label={`역할 ${i + 1} 삭제`}
              >
                삭제
              </button>
            </div>
            <RoleField label={`역할 ${i + 1} 이름`}>
              <input
                maxLength={40}
                className={roleInput}
                value={r.name}
                onChange={(e) => change(r.id, { name: e.target.value })}
              />
            </RoleField>
            <RoleField label={`역할 ${i + 1} 할 일`}>
              <textarea
                rows={2}
                maxLength={500}
                className={roleInput}
                value={r.description}
                onChange={(e) => change(r.id, { description: e.target.value })}
              />
            </RoleField>
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                정원·실천 요일 ({r.capacity}명)
              </summary>
              <div className="space-y-4 pt-2">
                <RoleField label={`역할 ${i + 1} 정원`}>
                  <input
                    className={roleInput}
                    type="number"
                    min={1}
                    max={60}
                    value={r.capacity}
                    onChange={(e) =>
                      change(r.id, { capacity: Number(e.target.value) })
                    }
                  />
                </RoleField>
                <RoleDays
                  value={r.weekdays}
                  onChange={(weekdays) => change(r.id, { weekdays })}
                />
              </div>
            </details>
          </section>
        ))}
      </div>
      <button
        className={roleButton}
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy ? "저장 중…" : "역할 목록 저장"}
      </button>
      {saved && (
        <p role="status">역할 목록을 저장했습니다. 다음 배정부터 적용됩니다.</p>
      )}
    </div>
  );
}

export function RoleSettingsPage({ board, save, busy }: RolePageProps) {
  const today = roleToday();
  const editablePeriods = board.state.periods
    .filter((period) => period.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const initialPeriod =
    activeRolePeriod(board.state, today) ?? editablePeriods[0];
  const [periodId, setPeriodId] = useState(initialPeriod?.id ?? "");
  const selectedPeriod = editablePeriods.find((period) => period.id === periodId);
  const [periodStart, setPeriodStart] = useState(initialPeriod?.start ?? "");
  const [periodEnd, setPeriodEnd] = useState(initialPeriod?.end ?? "");
  const [settings, setSettings] = useState(
    structuredClone(board.state.settings),
  );
  const [excludedDates, setExcludedDates] = useState(
    [...new Set(settings.excludedDates)].sort(),
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const change = (patch: Partial<typeof settings>) => {
    setSettings({ ...settings, ...patch });
    setSaved(false);
  };
  const submit = async () => {
    const state = {
      ...board.state,
      periods: selectedPeriod
        ? board.state.periods.map((period) =>
            period.id === selectedPeriod.id
              ? { ...period, start: periodStart, end: periodEnd }
              : period,
          )
        : board.state.periods,
      settings: {
        ...settings,
        excludedDates,
      },
    };
    setError("");
    try {
      validateRoleStateChange(board.state, state);
      setSaved(await save(state));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <RoleError message={error} />
      <section className={`${rolePanel} space-y-5`}>
        <div>
          <h2 className="text-lg font-bold">운영 기간</h2>
          {selectedPeriod ? (
            <div className="mt-3 space-y-3">
              {editablePeriods.length > 1 && (
                <RoleField label="수정할 운영 기간">
                  <select
                    className={roleInput}
                    value={periodId}
                    onChange={(event) => {
                      const period = editablePeriods.find(
                        (candidate) => candidate.id === event.target.value,
                      );
                      if (!period) return;
                      setPeriodId(period.id);
                      setPeriodStart(period.start);
                      setPeriodEnd(period.end);
                      setSaved(false);
                    }}
                  >
                    {editablePeriods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.start} ~ {period.end}
                      </option>
                    ))}
                  </select>
                </RoleField>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <RoleField label="운영 시작일">
                  <input
                    type="date"
                    className={`${roleInput} disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]`}
                    value={periodStart}
                    min={selectedPeriod.start > today ? today : undefined}
                    disabled={busy || selectedPeriod.start <= today}
                    onChange={(event) => {
                      setPeriodStart(event.target.value);
                      setSaved(false);
                    }}
                  />
                </RoleField>
                <RoleField label="운영 종료일">
                  <input
                    type="date"
                    className={roleInput}
                    value={periodEnd}
                    min={today}
                    disabled={busy}
                    onChange={(event) => {
                      setPeriodEnd(event.target.value);
                      setSaved(false);
                    }}
                  />
                </RoleField>
              </div>
              {selectedPeriod.start <= today && (
                <p className="text-xs text-[#526174]">
                  시작한 기간의 시작일과 지난 날짜는 변경할 수 없습니다.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#526174]">
              진행 중인 배정이 없습니다. {" "}
              <Link
                className="font-semibold text-[#0F6CBD] underline underline-offset-2"
                to="/tools/classroom-roles/assign"
              >
                학생 역할 배정
              </Link>
              에서 기간을 정해 주세요.
            </p>
          )}
        </div>
      </section>
      <section className={`${rolePanel} space-y-5`}>
        <RoleDays
          label="학급 실천 요일"
          value={settings.schoolDays}
          onChange={(schoolDays) => change({ schoolDays })}
        />
        <div className="border-t border-[#E2E8F0] pt-5">
          <RoleExcludedDatesCalendar
            key={periodId}
            dates={excludedDates}
            onChange={(dates) => {
              setExcludedDates(dates);
              setSaved(false);
            }}
            initialMonth={
              selectedPeriod?.start && selectedPeriod.start > today
                ? selectedPeriod.start.slice(0, 7)
                : today.slice(0, 7)
            }
            busy={busy}
          />
        </div>
        <p className="text-xs text-[#526174]">
          제외일은 집계에서 빼고, 제출된 기록은 유지합니다.
        </p>
      </section>
      <section className={`${rolePanel} space-y-4`}>
        <h2 className="text-lg font-bold">학생 공용 화면</h2>
        <RoleField label="학급 화면 제목">
          <input
            maxLength={60}
            className={roleInput}
            value={settings.title}
            onChange={(e) => change({ title: e.target.value })}
          />
        </RoleField>
        {(
          [
            ["publicEnabled", "학생 화면과 입력 허용"],
            ["showPublicStatus", "공용 화면에 학생별 오늘 상태 표시"],
            ["maskDisplayNames", "전자칠판 보기에서 이름 가운데 글자 가리기"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={settings[key]}
              onChange={(e) => change({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <p className="text-sm leading-6 text-[#526174]">
          공용 링크에는 본인 인증이 없어 다른 학생 이름도 선택할 수 있습니다.
          학급 안에서만 공유하고 기록을 확인해 주세요. 이름 가리기는
          전자칠판에만 적용됩니다.
        </p>
      </section>
      <button
        className={`${roleButton} w-full sm:w-auto`}
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy ? "저장 중…" : "운영 설정 저장"}
      </button>
      {saved && <p role="status">운영 설정을 저장했습니다.</p>}
      <section className={`${rolePanel} space-y-3`}>
        <h2 className="font-bold">공용 링크 재발급</h2>
        <p className="text-sm text-[#526174]">
          학급 밖에 링크가 알려졌다면 재발급하세요. 이전 링크는 즉시 사용할 수
          없게 되며 기존 기록은 유지됩니다.
        </p>
        <button
          className={roleSecondary}
          disabled={busy}
          onClick={async () => {
            if (
              window.confirm(
                "이전 학생 링크를 중지하고 새 링크를 만들까요? 새 링크는 실천판에서 복사할 수 있습니다.",
              )
            ) {
              const ok = await save(board.state, true);
              if (ok) {
                setSaved(false);
                setError("");
                window.alert(
                  "새 링크를 발급했습니다. 실천판에서 새 링크를 공유해 주세요.",
                );
              }
            }
          }}
        >
          공용 링크 재발급
        </button>
      </section>
    </div>
  );
}
