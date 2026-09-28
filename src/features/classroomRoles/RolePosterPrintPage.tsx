import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { qrImageFileName, saveQrImage } from "../../utils/qrImage";
import { activeRolePeriod, rolePublicUrl, roleToday } from "./roleApi";
import type { RolePageProps } from "./ClassroomRolesWorkspace";
import { RoleError, roleButton, rolePanel, roleSecondary } from "./RoleControls";
import { rolePosterPages } from "./rolePoster";

const dateLabel = (date: string) => date.replaceAll("-", ". ");

export function RolePosterPrintPage({ board }: RolePageProps) {
  const today = roleToday();
  const activePeriod = activeRolePeriod(board.state, today);
  const periods = [...board.state.periods].sort((a, b) => b.start.localeCompare(a.start));
  const [selectedPeriodId, setSelectedPeriodId] = useState(activePeriod?.id ?? periods[0]?.id ?? "");
  const [savingQr, setSavingQr] = useState(false);
  const [error, setError] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  const period = periods.find((item) => item.id === selectedPeriodId) ?? activePeriod ?? periods[0];
  const pages = period ? rolePosterPages(period) : [];
  const url = rolePublicUrl(board.public_token);

  const downloadQr = async () => {
    setSavingQr(true);
    setError("");
    try {
      await saveQrImage(qrRef.current, qrImageFileName(board.state.settings.title, "학생화면_QR", "1인1역"));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSavingQr(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className={`${rolePanel} space-y-4 print:hidden`} aria-label="게시판 안내문 인쇄 설정">
        <div>
          <h2 className="text-lg font-bold">게시판 안내문</h2>
          <p className="mt-1 text-sm leading-6 text-[#526174]">
            역할 수와 관계없이 한 장에 20칸을 표시합니다. 남는 칸은 비워 두고, 담당 학생은 확정된 배정에서 가져옵니다.
          </p>
        </div>
        {periods.length > 1 && (
          <label className="block max-w-sm text-sm font-semibold text-[#34485A]">
            배정 기간
            <select
              className="mt-2 block min-h-11 w-full rounded-lg border border-[#CAD4DD] bg-white px-3 text-[#0F172A]"
              value={period?.id ?? ""}
              onChange={(event) => setSelectedPeriodId(event.target.value)}
            >
              {periods.map((item) => (
                <option value={item.id} key={item.id}>{dateLabel(item.start)} ~ {dateLabel(item.end)} · {item.roles.length}개 역할</option>
              ))}
            </select>
          </label>
        )}
        {period && period.id !== activePeriod?.id && (
          <p className="text-sm text-[#9A5610]">
            QR은 현재 학생 실천판으로 연결됩니다. 선택한 배정은 해당 기간이 시작된 뒤 학생 화면에 나타납니다.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={roleButton} disabled={!period} onClick={() => window.print()}>안내문 인쇄 · PDF 저장</button>
          {period && (
            <button type="button" className={roleSecondary} disabled={savingQr} onClick={() => void downloadQr()}>
              {savingQr ? "저장 중…" : "QR 이미지 저장"}
            </button>
          )}
          <Link to="/tools/classroom-roles/board" className={roleSecondary}>실천판으로 돌아가기</Link>
        </div>
        <RoleError message={error} />
      </section>
      {!period ? (
        <section className={rolePanel}>
          <p className="text-sm text-[#526174]">확정된 역할 배정이 없습니다. 학생 역할 배정을 마친 뒤 안내문을 인쇄할 수 있습니다.</p>
          <Link className="mt-3 inline-block font-bold text-[#0F6CBD] underline" to="/tools/classroom-roles/assign">학생 역할 배정으로 이동</Link>
        </section>
      ) : (
        <div>
          <p className="mb-2 text-xs text-[#526174] sm:hidden print:hidden">미리보기를 좌우로 밀어 전체를 확인할 수 있습니다.</p>
          <div className="-mx-4 overflow-x-auto overflow-y-hidden bg-[#E9EDF2] px-4 py-6 sm:mx-0 print:m-0 print:overflow-visible print:bg-white print:p-0">
          <div role="region" className="role-poster-print-root mx-auto w-[210mm] space-y-6 print:space-y-0" aria-label="1인 1역 게시판 안내문 미리보기">
            {pages.map((slots, pageIndex) => (
              <article className="role-poster-print-page flex h-[297mm] w-[210mm] flex-col bg-white px-[11mm] pb-[9mm] pt-[10mm] shadow-lg print:shadow-none" key={pageIndex}>
                <header className="border-b-2 border-[#173A52] pb-[5mm]">
                  <p className="text-[14px] font-bold tracking-wide text-[#0F6CBD]">역할별 담당 학생</p>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <h2 className="min-w-0 break-words text-[32px] font-extrabold leading-tight text-[#152336]">{board.state.settings.title}</h2>
                    <span className="shrink-0 text-[13px] font-semibold text-[#526174]">{period.roles.length}개 역할{pages.length > 1 ? ` · ${pageIndex + 1}/${pages.length}` : ""}</span>
                  </div>
                  <p className="mt-2 text-[13px] text-[#526174]">배정 기간 {dateLabel(period.start)} ~ {dateLabel(period.end)}</p>
                </header>
                <div className="role-poster-slots mt-[5mm] grid min-h-0 flex-1 grid-flow-col grid-cols-2 grid-rows-10 gap-x-[5mm]" aria-label="역할별 담당 학생 20칸">
                  {slots.map((slot) => (
                    <div
                      key={slot.number}
                      className="role-poster-slot flex min-w-0 items-center gap-2 border-b border-[#C9D7DF] px-1 py-1"
                      aria-label={slot.roleName ? `${slot.number}번 역할 ${slot.roleName}, 담당 ${slot.students.join(", ") || "배정 없음"}` : `${slot.number}번 빈 역할 칸`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9F4F4] text-sm font-extrabold tabular-nums text-[#175D63]">{String(slot.number).padStart(2, "0")}</span>
                      <div className="min-w-0">
                        {slot.roleName ? (
                          <>
                            <p className="break-words text-[17px] font-bold leading-tight text-[#152336]">{slot.roleName}</p>
                            <p className="mt-0.5 break-words text-[13px] leading-tight text-[#34485A]">{slot.students.length ? slot.students.join(" · ") : "배정 없음"}</p>
                          </>
                        ) : <span className="sr-only">빈 역할 칸</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <footer className="mt-[5mm] flex min-h-[44mm] items-center gap-[5mm] rounded-xl border-2 border-[#5A9CA0] bg-[#F5FAFA] px-[5mm] py-[3mm]">
                  <div ref={pageIndex === 0 ? qrRef : undefined} className="shrink-0 bg-white p-2">
                    <QRCodeSVG value={url} size={144} level="M" aria-label="학생 실천판 QR 코드" className="h-[37mm] w-[37mm]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[22px] font-extrabold leading-tight text-[#173A52]">오늘의 실천판 열기</p>
                    <p className="mt-2 text-[13px] leading-5 text-[#34485A]">QR을 스캔해 나의 역할을 확인하고<br />오늘의 실천을 기록해요.</p>
                  </div>
                </footer>
              </article>
            ))}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
