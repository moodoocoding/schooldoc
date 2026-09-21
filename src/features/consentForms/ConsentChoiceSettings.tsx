import type { ConsentChoice } from '../../../supabase/functions/_shared/consentQuestions';
import type { ConsentFieldDraft } from './types';

const inputClass = 'mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] bg-white px-3 text-sm font-normal';

export function ConsentChoiceSettings({ selected, fields, onChange }: {
  selected: ConsentFieldDraft;
  fields: ConsentFieldDraft[];
  onChange: (fields: ConsentFieldDraft[]) => void;
}) {
  const choice = selected.choice;
  const members = choice ? fields.filter(field => field.choice?.id === choice.id) : [];
  const patchChoice = (patch: Partial<ConsentChoice>) => {
    if (!choice) return;
    onChange(fields.map(field => field.choice?.id === choice.id ? { ...field, required: false, choice: { ...choice, ...patch } } : field));
  };
  const join = (targetId: string) => {
    const target = fields.find(field => field.id === targetId);
    if (!target) return;
    const nextChoice = target.choice ?? { id: crypto.randomUUID(), label: '선택 질문', mode: 'single' as const, required: true, minSelections: 1 };
    onChange(fields.map(field => field.id === selected.id || field.id === target.id
      ? { ...field, required: false, choice: nextChoice } : field));
  };
  const detach = () => {
    onChange(fields.map(field => field.id === selected.id || (members.length <= 2 && field.choice?.id === choice?.id)
      ? { ...field, choice: undefined, required: false } : field));
  };
  return <section className="space-y-3 border-y border-[#DCE3EA] py-4" aria-label="체크박스 선택 규칙">
    {choice ? <>
      <label className="block text-xs font-bold">질문 제목<input maxLength={80} value={choice.label} onChange={event => patchChoice({ label: event.target.value })} className={inputClass} /></label>
      <label className="block text-xs font-bold">선택 방식<select value={choice.mode} onChange={event => patchChoice({ mode: event.target.value as ConsentChoice['mode'], minSelections: 1 })} className={inputClass}><option value="single">하나만 선택 (예 / 아니오)</option><option value="multiple">여러 개 선택</option></select></label>
      <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={choice.required} onChange={event => patchChoice({ required: event.target.checked })} />이 질문에 반드시 응답</label>
      {choice.mode === 'multiple' && choice.required ? <label className="block text-xs font-bold">최소 선택 수<input type="number" min={1} max={members.length} value={choice.minSelections} onChange={event => patchChoice({ minSelections: Math.max(1, Math.min(members.length, Number(event.target.value) || 1)) })} className={inputClass} /></label> : null}
      <p className="text-xs leading-5 text-[#526174]">선택지: {members.map(field => field.label).join(' / ')}. 필수 응답은 특정 선택지에 동의하라는 뜻이 아닙니다.</p>
      <button type="button" onClick={detach} className="min-h-[44px] text-xs font-bold text-[#0F6CBD]">이 선택지를 질문에서 분리</button>
    </> : <>
      <label className="block text-xs font-bold">다른 체크박스와 질문으로 묶기<select value="" onChange={event => join(event.target.value)} className={inputClass}><option value="">함께 묶을 선택지 선택</option>{fields.filter(field => field.kind === 'checkbox' && field.id !== selected.id).map(field => <option key={field.id} value={field.id}>{field.choice ? `${field.choice.label} · ` : ''}{field.label} ({field.pageIndex + 1}쪽)</option>)}</select></label>
      <p className="text-xs leading-5 text-[#526174]">예 / 아니오는 같은 질문으로 묶어야 하나만 선택할 수 있습니다.</p>
      {selected.required ? <p role="note" className="text-xs leading-5 text-[#9A6700]">이 독립 체크박스는 현재 반드시 체크해야 제출됩니다. 선택 질문이라면 위에서 묶어 주세요.</p> : null}
    </>}
  </section>;
}
