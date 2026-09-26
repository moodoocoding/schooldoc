import { cloneElement, useId, type ReactElement } from "react";
export const roleButton =
  "min-h-11 rounded-xl bg-[#0F6CBD] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B589D] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD]";
export const roleSecondary =
  "min-h-11 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#334155] hover:bg-[#F1F5F9] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD]";
export const roleInput =
  "mt-1 block min-h-11 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-2 focus:outline-[#0F6CBD]";
export const rolePanel =
  "rounded-2xl border border-[#DCE3EA] bg-white p-5 sm:p-6";
export function RoleField({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="text-sm font-semibold text-[#334155]">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}
export function RoleDays({
  value,
  onChange,
  label = "실천 요일",
}: {
  value: number[];
  onChange: (days: number[]) => void;
  label?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
          <button
            type="button"
            aria-pressed={value.includes(i)}
            key={day}
            onClick={() =>
              onChange(
                value.includes(i)
                  ? value.filter((d) => d !== i)
                  : [...value, i].sort(),
              )
            }
            className={value.includes(i) ? roleButton : roleSecondary}
          >
            {day}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function RoleError({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      {message}
    </p>
  ) : null;
}
