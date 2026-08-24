import { Archive, CalendarClock, CheckCircle2, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegistryConfirmDialog } from '../registry/RegistryConfirmDialog';
import {
  DEFAULT_PRIVACY_RETENTION_SETTINGS,
  RETENTION_MONTH_OPTIONS,
  isPurgeDue,
  retentionDueAt,
  sortRetainedWorkItems,
  type PrivacyPurgeLog,
  type PrivacyRetentionSettings,
  type RetainedWorkItem,
} from './privacyRetention';
import {
  listPrivacyPurgeLogs,
  listRetainedWorkItems,
  loadPrivacyRetentionSettings,
  purgeRetainedWorkItem,
  savePrivacyRetentionSettings,
} from './privacyRetentionSettings';

const monthLabel = (months: number) => months === 12 ? '1년' : `${months}개월`;

const dateLabel = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 확인 필요';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
};

const kindLabel = (kind: RetainedWorkItem['kind']) => kind === 'consent-form' ? '가정통신문 수합' : '자료 수합';
const managePath = (item: RetainedWorkItem) => item.kind === 'consent-form'
  ? `/tools/consent-forms/${item.id}`
  : `/tools/data-collect/${item.id}`;

export function PrivacyRetentionPanel({ userId, isLoggedIn }: { userId: string; isLoggedIn: boolean }) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PrivacyRetentionSettings>(DEFAULT_PRIVACY_RETENTION_SETTINGS);
  const [items, setItems] = useState<RetainedWorkItem[]>([]);
  const [logs, setLogs] = useState<PrivacyPurgeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingPurge, setPendingPurge] = useState<RetainedWorkItem | null>(null);
  const [purging, setPurging] = useState(false);

  const scheduledItems = useMemo(() => sortRetainedWorkItems(items), [items]);
  const dueCount = useMemo(() => scheduledItems.filter((item) => isPurgeDue(item)).length, [scheduledItems]);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError('');
    try {
      const [nextItems, nextLogs] = await Promise.all([
        listRetainedWorkItems(userId),
        listPrivacyPurgeLogs(),
      ]);
      setItems(nextItems);
      setLogs(nextLogs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '파기 일정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, userId]);

  useEffect(() => {
    let active = true;
    void loadPrivacyRetentionSettings(userId).then((loaded) => {
      if (active) setSettings(loaded);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!isLoggedIn) {
      setItems([]);
      setLogs([]);
      return;
    }
    void refresh();
  }, [isLoggedIn, refresh]);

  const save = async () => {
    if (!isLoggedIn || saving) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      setSettings(await savePrivacyRetentionSettings(userId, settings));
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '기본 보관 정책을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const purge = async () => {
    if (!pendingPurge || purging || !isPurgeDue(pendingPurge)) return;
    setPurging(true);
    setError('');
    setNotice('');
    try {
      const label = kindLabel(pendingPurge.kind);
      await purgeRetainedWorkItem(pendingPurge);
      setPendingPurge(null);
      setNotice(`${label} 1건과 관련 파일을 영구 파기했습니다.`);
      await refresh();
    } catch (purgeError) {
      setError(purgeError instanceof Error ? purgeError.message : '자료를 파기하지 못했습니다.');
    } finally {
      setPurging(false);
    }
  };

  return <div className="space-y-7">
    <section aria-labelledby="privacy-policy-heading" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="privacy-policy-heading" className="text-base font-bold text-[#0F172A]">개인정보 보관 및 파기 정책</h3>
            <span className="rounded-md bg-[#E6F4EA] px-2 py-1 text-[11px] font-bold text-[#126B32]">교사 확인 후 파기</span>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#64748B]">
            진행 중인 업무는 지우지 않습니다. 업무를 종료하면 아래 기본 기간을 적용해 파기 예정일을 계산하고, 예정일이 지난 자료도 선생님이 확인해야만 영구 삭제합니다.
          </p>
        </div>
      </div>

      <fieldset disabled={!isLoggedIn || saving}>
        <legend className="text-xs font-bold text-[#0F172A]">새로 만드는 수합의 기본 보관기간</legend>
        <p className="mt-1 text-xs text-[#64748B]">기존 업무에는 소급 적용하지 않으며, 각 업무에서 별도로 바꿀 수 있습니다.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {RETENTION_MONTH_OPTIONS.map((months) => {
            const selected = settings.defaultRetentionMonths === months;
            return <label key={months} className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-lg border px-4 focus-within:ring-2 focus-within:ring-[#0F6CBD] ${selected ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}>
              <input
                type="radio"
                name="default-retention-months"
                value={months}
                checked={selected}
                onChange={() => { setSettings({ ...settings, defaultRetentionMonths: months }); setSaved(false); }}
                className="h-4 w-4 accent-[#0F6CBD]"
              />
              <span><strong className="block text-sm text-[#0F172A]">종료 후 {monthLabel(months)}</strong><span className="mt-0.5 block text-[11px] text-[#64748B]">파기 예정 목록에 표시</span></span>
            </label>;
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!isLoggedIn || saving} onClick={() => void save()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-xs font-bold text-white disabled:bg-[#AAB7C4]">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {saving ? '저장 중' : '기본 정책 저장'}
        </button>
        {saved ? <span role="status" className="inline-flex items-center gap-1 text-xs font-bold text-[#126B32]"><CheckCircle2 className="h-4 w-4" />저장되었습니다.</span> : null}
        {!isLoggedIn ? <span className="text-xs font-semibold text-[#64748B]">로그인하면 계정별 정책을 저장할 수 있습니다.</span> : null}
      </div>
    </section>

    <section aria-labelledby="purge-schedule-heading" className="border-t border-[#DCE3EA] pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="purge-schedule-heading" className="flex items-center gap-2 text-base font-bold text-[#0F172A]"><Archive className="h-4 w-4 text-[#0F6CBD]" />파기 예정 자료</h3>
          <p className="mt-1 text-xs text-[#64748B]">종료한 가정통신문 수합과 자료 수합을 한곳에서 확인합니다.</p>
        </div>
        <button type="button" disabled={!isLoggedIn || loading} onClick={() => void refresh()} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />새로고침</button>
      </div>

      {notice ? <p role="status" className="mt-4 border-l-2 border-[#16803C] bg-[#E6F4EA] px-3 py-2.5 text-xs font-semibold text-[#126B32]">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 border-l-2 border-[#B42318] bg-[#FEF2F2] px-3 py-2.5 text-xs font-semibold text-[#B42318]">{error}</p> : null}

      {!isLoggedIn ? <div className="mt-4 rounded-lg border border-dashed border-[#C8D0DA] bg-[#F8FAFC] px-4 py-8 text-center text-xs font-semibold text-[#64748B]">로그인하면 종료된 업무의 파기 일정을 확인할 수 있습니다.</div>
        : loading && scheduledItems.length === 0 ? <div className="mt-4 py-8 text-center text-xs font-semibold text-[#64748B]">파기 일정을 불러오고 있습니다.</div>
          : scheduledItems.length === 0 ? <div className="mt-4 rounded-lg border border-dashed border-[#C8D0DA] bg-[#F8FAFC] px-4 py-8 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-[#16803C]" /><p className="mt-2 text-xs font-bold text-[#334155]">파기 일정이 잡힌 종료 업무가 없습니다.</p></div>
            : <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-[#526174]">전체 {scheduledItems.length}건 · 확인 필요 {dueCount}건</p>
              <ul className="divide-y divide-[#EEF1F4] rounded-lg border border-[#DCE3EA] bg-white px-4">
                {scheduledItems.map((item) => {
                  const due = isPurgeDue(item);
                  const dueAt = retentionDueAt(item.closedAt, item.retentionMonths);
                  return <li key={`${item.kind}:${item.id}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-1 text-[11px] font-bold ${due ? 'bg-[#FEF2F2] text-[#B42318]' : 'bg-[#EFF6FC] text-[#0F6CBD]'}`}>{due ? '파기 확인 필요' : '파기 예정'}</span><span className="text-[11px] font-semibold text-[#64748B]">{kindLabel(item.kind)}</span></div>
                      <p className="mt-2 truncate text-sm font-bold text-[#0F172A]" title={item.title}>{item.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#526174]"><CalendarClock className="h-3.5 w-3.5" />종료 {dateLabel(item.closedAt)} · 파기 예정 {dueAt ? dateLabel(dueAt) : '확인 필요'}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => navigate(managePath(item))} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155]"><ExternalLink className="h-3.5 w-3.5" />업무 열기</button>
                      {due ? <button type="button" onClick={() => setPendingPurge(item)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#B42318] px-3 text-xs font-bold text-[#B42318] hover:bg-[#FEF2F2]"><Trash2 className="h-3.5 w-3.5" />영구 파기</button> : null}
                    </div>
                  </li>;
                })}
              </ul>
            </div>}
    </section>

    {logs.length > 0 ? <section aria-labelledby="purge-log-heading" className="border-t border-[#DCE3EA] pt-6"><h3 id="purge-log-heading" className="text-sm font-bold text-[#0F172A]">최근 파기 이력</h3><p className="mt-1 text-xs text-[#64748B]">이름·제목·파일명은 남기지 않습니다.</p><ul className="mt-3 divide-y divide-[#EEF1F4] text-xs text-[#526174]">{logs.map((log) => <li key={log.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{kindLabel(log.resourceKind)} 1건 · 기록 {log.recordCount}건 · 파일 {log.fileCount}개</span><time dateTime={log.purgedAt}>{dateLabel(log.purgedAt)}</time></li>)}</ul></section> : null}

    {pendingPurge ? <RegistryConfirmDialog
      title={`${kindLabel(pendingPurge.kind)}을 영구 파기할까요?`}
      description={`“${pendingPurge.title}”의 제출 기록과 관련 파일을 모두 삭제합니다. 삭제한 내용은 복구할 수 없습니다.`}
      confirmLabel={purging ? '파기 중' : '영구 파기'}
      onCancel={() => { if (!purging) setPendingPurge(null); }}
      onConfirm={() => void purge()}
    /> : null}
  </div>;
}
