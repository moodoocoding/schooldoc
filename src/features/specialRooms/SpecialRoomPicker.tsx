import type { SpecialRoom } from './types';
export function SpecialRoomPicker({
  rooms,
  value,
  onChange,
  panelId,
}: {
  rooms: SpecialRoom[];
  value: string;
  onChange: (id: string) => void;
  panelId: string;
}) {
  if (rooms.length > 8) {
    return (
      <label className="grid min-w-0 gap-1 text-xs font-bold">
        특별실 선택
        <select
          aria-label="특별실 선택"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[44px] max-w-full rounded-lg border border-[var(--sr-border,#C8D0DA)] bg-white px-3 text-sm text-[#24312C]"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.location ? ' · ' + r.location : ''}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (rooms.length < 2) {
    return <p className="text-sm font-bold">{rooms[0]?.name || '특별실'}</p>;
  }
  return (
    <div
      role="tablist"
      aria-label="특별실 선택"
      className="flex min-w-0 flex-wrap gap-1.5"
    >
      {rooms.map((r, i) => (
        <button
          key={r.id}
          id={`${panelId}-tab-${r.id}`}
          type="button"
          role="tab"
          aria-selected={value === r.id}
          aria-controls={panelId}
          tabIndex={value === r.id ? 0 : -1}
          onClick={() => onChange(r.id)}
          onKeyDown={(e) => {
            let n = i;
            if (e.key === 'ArrowRight') n = (i + 1) % rooms.length;
            else if (e.key === 'ArrowLeft') {
              n = (i + rooms.length - 1) % rooms.length;
            } else if (e.key === 'Home') n = 0;
            else if (e.key === 'End') n = rooms.length - 1;
            else return;
            e.preventDefault();
            onChange(rooms[n].id);
            e.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('[role=tab]')
              [n]?.focus();
          }}
          className={`min-h-[44px] rounded-lg border px-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 ${
            value === r.id
              ? 'border-[#315F50] bg-[#315F50] text-white'
              : 'border-[#C8D0DA] bg-white text-[#334155]'
          }`}
        >
          {r.name}
        </button>
      ))}
    </div>
  );
}
