import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  /** 탭 옆의 개수 등 보조 정보. */
  count?: number;
  disabled?: boolean;
}

interface TabsProps<T extends string> {
  /** 탭 묶음의 접근 가능한 이름. */
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 각 탭이 제어하는 패널 id를 만들 때 쓰는 접두사. */
  idPrefix?: string;
}

/**
 * 한 기능 안에서 같은 종류의 목록·보기를 바꾸는 탭. 모든 기능이 이 모양만 쓴다.
 * 좌우 화살표·Home·End로 이동하고, 선택된 탭만 Tab 순서에 들어간다.
 */
export function Tabs<T extends string>({ label, items, value, onChange, idPrefix }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled);

  const moveTo = (index: number) => {
    const target = items[index];
    if (!target) return;
    onChange(target.value);
    refs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const position = enabled.findIndex((entry) => entry.index === index);
    if (position === -1 || enabled.length === 0) return;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = enabled[(position + 1) % enabled.length].index;
    else if (event.key === 'ArrowLeft') next = enabled[(position - 1 + enabled.length) % enabled.length].index;
    else if (event.key === 'Home') next = enabled[0].index;
    else if (event.key === 'End') next = enabled[enabled.length - 1].index;
    if (next === null) return;
    event.preventDefault();
    moveTo(next);
  };

  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[#DCE3EA] bg-white p-1">
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(element) => { refs.current[index] = element; }}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${item.value}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${item.value}` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-md px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:text-[#94A3B8] ${
              selected ? 'bg-[#0F6CBD] text-white' : 'text-[#526174] hover:bg-[#F6F8FB] hover:text-[#0F172A]'
            }`}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className={`rounded px-1.5 text-xs ${selected ? 'bg-white/20 text-white' : 'bg-[#EEF1F4] text-[#526174]'}`}>{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
