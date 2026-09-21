import { Check } from 'lucide-react';
import type { ConsentQuestion } from '../../../supabase/functions/_shared/consentQuestions';
import { fieldStyle } from './consentFieldLayout';
import type { ConsentFieldDraft } from './types';

const fieldClass = 'h-full w-full min-h-0 min-w-0 rounded-none border-0 bg-transparent p-0 text-[#0F172A] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]';

/** 원본 좌표를 유지하고 작은 화면에서만 확대 입력을 제공한다. */
export function ConsentResponseField({ field, question, value, mobile, active, onActivate, onOpen, onChange, onSign }: {
  field: ConsentFieldDraft;
  question: ConsentQuestion<ConsentFieldDraft>;
  value: string;
  mobile: boolean;
  active: boolean;
  onActivate: () => void;
  onOpen: () => void;
  onChange: (value: string) => void;
  onSign: () => void;
}) {
  const id = `consent-response-${field.id}`;
  return <div id={`consent-original-${field.id}`} data-testid="consent-original-field" data-kind={field.kind} data-active={active} style={{ ...fieldStyle(field), containerType: 'size', backgroundColor: active ? 'rgba(15, 108, 189, 0.10)' : value && value !== 'false' ? 'transparent' : 'rgba(100, 116, 139, 0.16)' }} className={`absolute z-20 min-h-0 min-w-0 ${active ? 'outline outline-2 outline-[#0F6CBD]' : 'outline outline-1 outline-[#64748B]/50'}`}>
    {mobile ? <button id={id} type="button" aria-label={`${field.label} 입력 위치`} onClick={onOpen} className={`${fieldClass} flex cursor-pointer items-center justify-center`}>
      {field.kind === 'checkbox' ? value === 'true' ? <Check className="h-full w-full" strokeWidth={3} /> : null : field.kind === 'signature' ? value ? <img src={value} alt="서명 완료" className="h-full w-full object-contain" /> : <span style={{ fontSize: 'min(12px, 65cqh)' }}>서명</span> : <span style={{ fontSize: 'min(14px, 75cqh)', lineHeight: 1 }} className="block w-full truncate px-1 text-left">{value || '입력'}</span>}
    </button> : field.kind === 'checkbox' ? <><input id={id} aria-label={field.label} aria-description={question.choice ? `${question.label}, ${question.choice.mode === 'single' ? '하나만 선택' : '복수 선택'}` : undefined} type={field.choice?.mode === 'single' ? 'radio' : 'checkbox'} name={question.id} checked={value === 'true'} onFocus={onActivate} onChange={event => onChange(event.target.checked ? 'true' : '')} className={`${fieldClass} cursor-pointer appearance-none`} />{value === 'true' ? <Check aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" strokeWidth={3} /> : null}</> : field.kind === 'signature' ? <button id={id} type="button" aria-label={value ? `${field.label} 서명 수정` : `${field.label} 작성`} onFocus={onActivate} onClick={onSign} className={`${fieldClass} flex cursor-pointer items-center justify-center`}>
      {value ? <img src={value} alt={`${field.label} 서명`} className="h-full w-full object-contain" /> : <span style={{ fontSize: 'min(14px, 65cqh)' }}>서명하기</span>}
    </button> : <input id={id} aria-label={`${field.label}${field.required ? ' 필수' : ''}`} type={field.kind === 'date' ? 'date' : 'text'} value={value} placeholder="입력" maxLength={5000} onFocus={onActivate} onChange={event => onChange(event.target.value)} className={`${fieldClass} px-1 placeholder:text-[#526174]`} style={{ fontSize: 'min(16px, 75cqh)', lineHeight: 1 }} />}
  </div>;
}
