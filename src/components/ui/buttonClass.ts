export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'sm';

/*
 * 색은 .schooldoc-admin-shell이 개인 화면 테마 토큰으로 바꾸는 대표 색 코드만 쓴다.
 * 새 색 코드를 넣으면 테마가 적용되지 않으므로 index.css의 치환 목록과 함께 바꾼다.
 */
const BASE = 'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed';

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-[44px] px-4 text-sm',
  sm: 'min-h-[40px] px-3 text-sm',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-[#0F6CBD] text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]',
  secondary: 'border border-[#C8D0DA] bg-white text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD] disabled:border-[#DCE3EA] disabled:text-[#94A3B8] disabled:hover:text-[#94A3B8]',
  danger: 'bg-[#B42318] text-white hover:bg-[#8F1C14] disabled:bg-[#AAB7C4]',
  ghost: 'text-[#334155] hover:bg-white hover:text-[#0F6CBD] disabled:text-[#94A3B8]',
};

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** 버튼이 아닌 요소(Link 등)에도 같은 모양을 주기 위한 클래스 생성기. */
export function buttonClass({ variant = 'primary', size = 'md', fullWidth = false, className }: ButtonClassOptions = {}) {
  return [BASE, SIZES[size], VARIANTS[variant], fullWidth ? 'w-full' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
}
