import { useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { useDialogFocus } from '../features/registry/useDialogFocus';

interface NotificationComingSoonDialogProps {
  onClose: () => void;
}

export function NotificationComingSoonDialog({ onClose }: NotificationComingSoonDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(dialogRef, onClose, confirmRef);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-coming-soon-title"
        aria-describedby="notification-coming-soon-description"
        tabIndex={-1}
        className="w-full max-w-sm rounded-xl border border-[#DCE3EA] bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FC] text-[#0F6CBD]">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#0F6CBD]">준비 중</span>
              <h2 id="notification-coming-soon-title" className="mt-0.5 text-base font-extrabold text-[#0F172A]">
                알림 기능을 개발하고 있습니다
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="알림 안내 닫기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F6F8FB] hover:text-[#0F172A]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p id="notification-coming-soon-description" className="mt-4 text-sm leading-6 text-[#526174]">
          제출, 서명, 예약처럼 확인이 필요한 업무를 이곳에서 알려드릴 예정입니다.
          현재는 알림을 보내거나 저장하지 않습니다.
        </p>

        <div className="mt-5 flex justify-end">
          <button
            ref={confirmRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0F5B9E]"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
