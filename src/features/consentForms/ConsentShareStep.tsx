import { ArrowLeft, Check, LockKeyhole } from 'lucide-react';
import type { ConsentRecipientMode, ConsentShareSettings } from './types';

export function ConsentShareStep({ title, fileName, fieldCount, recipientMode, recipientCount, settings, hasExistingPassword = false, saving = false, error = '', onSettingsChange, onBack, onCreate }: {
  title: string;
  fileName: string;
  fieldCount: number;
  recipientMode: ConsentRecipientMode;
  recipientCount: number;
  settings: ConsentShareSettings;
  hasExistingPassword?: boolean;
  saving?: boolean;
  error?: string;
  onSettingsChange: (settings: ConsentShareSettings) => void;
  onBack: () => void;
  onCreate: () => void | Promise<void>;
}) {
  const passwordInvalid = settings.passwordEnabled && !hasExistingPassword && settings.password.trim().length < 4;
  return <div className="mx-auto w-full max-w-5xl space-y-5 pb-12">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4"><button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />수신자 설정으로</button><span className="text-xs font-semibold text-[#526174]">4. 공유 설정 및 확인</span></header>
    <div><p className="text-xs font-bold text-[#0F6CBD]">새 가정통신문 수합</p><h1 className="mt-1 text-2xl font-extrabold">공유 조건 확인</h1><p className="mt-2 text-sm text-[#526174]">응답 기한과 보호 설정을 정한 뒤 수합을 만듭니다.</p></div>
    <section className="border-y border-[#DCE3EA] bg-white px-4 py-5 sm:px-5"><h2 className="text-sm font-bold">공유 설정</h2><div className="mt-4 grid gap-5 sm:grid-cols-2"><label className="text-xs font-bold text-[#334155]">응답 기한 (선택)<input type="date" value={settings.deadline} onChange={(event) => onSettingsChange({ ...settings, deadline: event.target.value })} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" /></label><div className="space-y-2"><label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" checked={settings.allowResubmission} onChange={(event) => onSettingsChange({ ...settings, allowResubmission: event.target.checked })} className="h-4 w-4 accent-[#0F6CBD]" />제출 후 수정 허용</label><label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" checked={settings.passwordEnabled} onChange={(event) => onSettingsChange({ ...settings, passwordEnabled: event.target.checked })} className="h-4 w-4 accent-[#0F6CBD]" />공개 링크 비밀번호 사용</label></div></div>{settings.passwordEnabled ? <label className="mt-4 block max-w-sm text-xs font-bold text-[#334155]">{hasExistingPassword ? '새 비밀번호 (변경할 때만)' : '비밀번호'}<input type="password" value={settings.password} onChange={(event) => onSettingsChange({ ...settings, password: event.target.value })} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" placeholder={hasExistingPassword ? '기존 비밀번호 유지' : '4자 이상'} />{passwordInvalid ? <span className="mt-1 block text-[#B42318]">4자 이상 입력하세요.</span> : null}</label> : null}</section>
    <section className="border-y border-[#DCE3EA] bg-white px-4 py-5 sm:px-5"><h2 className="text-sm font-bold">최종 확인</h2><dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[#64748B]">제목</dt><dd className="mt-1 font-bold">{title}</dd></div><div><dt className="text-xs text-[#64748B]">원본 PDF</dt><dd className="mt-1 truncate font-semibold">{fileName}</dd></div><div><dt className="text-xs text-[#64748B]">응답 필드</dt><dd className="mt-1 font-semibold">{fieldCount}개</dd></div><div><dt className="text-xs text-[#64748B]">수합 대상</dt><dd className="mt-1 font-semibold">{recipientMode === 'named' ? `명단 ${recipientCount}명` : '명단 없는 공개 수합'}</dd></div></dl><p className="mt-5 flex items-start gap-2 border-t border-[#EEF1F4] pt-4 text-xs leading-5 text-[#526174]"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#0F6CBD]" />원본 PDF와 응답 설정은 비공개로 저장하며, 응답자에게는 유효 시간이 제한된 문서 열람 주소만 제공합니다.</p></section>
    {error ? <p role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}
    <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[#DCE3EA] bg-[#F6F8FB]/95 py-3 backdrop-blur"><button type="button" disabled={saving} onClick={onBack} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold disabled:opacity-60">이전</button><button type="button" disabled={passwordInvalid || saving} onClick={() => void onCreate()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]"><Check className="h-4 w-4" />{saving ? '원본 PDF 저장 중' : '수합 만들기'}</button></div>
  </div>;
}
