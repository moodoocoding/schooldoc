import { ArrowLeft, ArrowRight, FileSpreadsheet, FileText, Globe2, ListChecks, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ConsentRecipientDraft, ConsentRecipientMode } from './types';
import { consentRecipientExcelAccept, consentRecipientPdfAccept, importConsentRecipients } from './consentRecipientImport';

export function ConsentRecipientsStep({ mode, recipients, onModeChange, onRecipientsChange, onBack, onNext }: {
  mode: ConsentRecipientMode;
  recipients: ConsentRecipientDraft[];
  onModeChange: (mode: ConsentRecipientMode) => void;
  onRecipientsChange: (recipients: ConsentRecipientDraft[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const excelInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const canContinue = mode === 'open' || recipients.length > 0;

  const addRecipient = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onRecipientsChange([...recipients, { id: crypto.randomUUID(), name: trimmedName, identifier: identifier.trim() }]);
    setName('');
    setIdentifier('');
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setIsImporting(true);
    setImportError('');
    setImportMessage('');
    try {
      const result = await importConsentRecipients(file);
      const existingKeys = new Set(recipients.map((recipient) => `${recipient.name.toLocaleLowerCase('ko-KR')}\u0000${recipient.identifier.toLocaleLowerCase('ko-KR')}`));
      const imported = result.recipients.filter((recipient) => {
        const key = `${recipient.name.toLocaleLowerCase('ko-KR')}\u0000${recipient.identifier.toLocaleLowerCase('ko-KR')}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      }).map((recipient) => ({ ...recipient, id: crypto.randomUUID() }));
      onRecipientsChange([...recipients, ...imported]);
      const duplicateCount = result.recipients.length - imported.length;
      setImportMessage(`${result.sourceLabel}에서 ${imported.length}명을 불러왔습니다. ${result.mappingLabel}${duplicateCount ? ` · 중복 ${duplicateCount}명 제외` : ''}${result.warnings.length ? ` · ${result.warnings.join(' ')}` : ''}`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '명단을 불러오지 못했습니다.');
    } finally {
      setIsImporting(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  return <div className="mx-auto w-full max-w-5xl space-y-5 pb-12">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4"><button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />필드 배치로</button><span className="text-xs font-semibold text-[#526174]">3. 수신자 설정</span></header>
    <div><p className="text-xs font-bold text-[#0F6CBD]">새 가정통신문 수합</p><h1 className="mt-1 text-2xl font-extrabold">누가 응답할지 정하기</h1><p className="mt-2 text-sm text-[#526174]">대상별 제출 현황이 필요하면 명단을 사용하고, 누구나 응답해도 되면 공개 수합을 선택하세요.</p></div>

    <fieldset className="border-y border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
      <legend className="px-1 text-sm font-bold">수합 방식</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={`flex min-h-24 cursor-pointer gap-3 border p-4 ${mode === 'named' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#C8D0DA]'}`}><input type="radio" name="recipient-mode" value="named" checked={mode === 'named'} onChange={() => onModeChange('named')} className="mt-1 h-4 w-4 accent-[#0F6CBD]" /><ListChecks className="h-5 w-5 shrink-0 text-[#0F6CBD]" /><span><strong className="block text-sm">명단으로 받기</strong><span className="mt-1 block text-xs leading-5 text-[#526174]">대상별 제출 여부를 확인합니다.</span></span></label>
        <label className={`flex min-h-24 cursor-pointer gap-3 border p-4 ${mode === 'open' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#C8D0DA]'}`}><input type="radio" name="recipient-mode" value="open" checked={mode === 'open'} onChange={() => onModeChange('open')} className="mt-1 h-4 w-4 accent-[#0F6CBD]" /><Globe2 className="h-5 w-5 shrink-0 text-[#0F6CBD]" /><span><strong className="block text-sm">명단 없이 받기</strong><span className="mt-1 block text-xs leading-5 text-[#526174]">하나의 공개 링크로 응답을 받습니다.</span></span></label>
      </div>
    </fieldset>

    {mode === 'named' ? <section className="border-y border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-bold">수신자 명단</h2><p className="mt-1 text-xs text-[#64748B]">명단 파일을 불러오거나 아래에서 직접 추가하세요.</p></div><span className="shrink-0 text-xs font-bold text-[#0F6CBD]">{recipients.length}명</span></div>
      <div className="mt-4 flex flex-wrap gap-2 border-b border-[#EEF1F4] pb-4">
        <input ref={excelInputRef} type="file" accept={consentRecipientExcelAccept} onChange={(event) => void importFile(event.target.files?.[0])} className="sr-only" aria-label="엑셀 명단 파일" />
        <input ref={pdfInputRef} type="file" accept={consentRecipientPdfAccept} onChange={(event) => void importFile(event.target.files?.[0])} className="sr-only" aria-label="PDF 명단 파일" />
        <button type="button" onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-4 text-sm font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD] disabled:opacity-60"><FileSpreadsheet className="h-4 w-4" />엑셀 불러오기</button>
        <button type="button" onClick={() => pdfInputRef.current?.click()} disabled={isImporting} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-4 text-sm font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD] disabled:opacity-60"><FileText className="h-4 w-4" />PDF 불러오기</button>
        {isImporting ? <span className="inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-[#526174]"><LoaderCircle className="h-4 w-4 animate-spin" />명단을 읽는 중</span> : null}
      </div>
      {importError ? <p role="alert" className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-semibold text-[#B42318]">{importError}</p> : null}
      {importMessage ? <p role="status" className="mt-3 rounded-lg border border-[#B9D9F3] bg-[#EFF6FC] px-3 py-2 text-xs leading-5 text-[#0B5B9F]">{importMessage}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="text-xs font-bold text-[#334155]">이름 (필수)<input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addRecipient(); }} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" /></label>
        <label className="text-xs font-bold text-[#334155]">식별값 (선택)<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addRecipient(); }} placeholder="예: 3학년 2반 1번" className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" /></label>
        <button type="button" onClick={addRecipient} disabled={!name.trim()} className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#0F6CBD] px-4 text-sm font-bold text-[#0F6CBD] disabled:border-[#C8D0DA] disabled:text-[#94A3B8]"><Plus className="h-4 w-4" />추가</button>
      </div>
      {recipients.length === 0 ? <p className="mt-5 border-t border-[#EEF1F4] py-8 text-center text-sm text-[#64748B]">수신자를 한 명 이상 추가하세요.</p> : <ul className="mt-5 divide-y divide-[#EEF1F4] border-t border-[#DCE3EA]">{recipients.map((recipient, index) => <li key={recipient.id} className="flex min-h-[56px] items-center gap-3 py-2"><span className="w-7 text-center text-xs text-[#64748B]">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{recipient.name}</strong>{recipient.identifier ? <span className="block truncate text-xs text-[#64748B]">{recipient.identifier}</span> : null}</span><button type="button" onClick={() => onRecipientsChange(recipients.filter((item) => item.id !== recipient.id))} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#B42318]" aria-label={`${recipient.name} 삭제`} title="삭제"><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
    </section> : <p className="border-y border-[#F5D08A] bg-[#FFF9ED] px-4 py-4 text-sm leading-6 text-[#76520E]">공개 링크를 받은 사람은 누구나 응답할 수 있습니다. 다음 단계에서 공개 비밀번호와 종료일을 설정합니다.</p>}

    <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[#DCE3EA] bg-[#F6F8FB]/95 py-3 backdrop-blur"><button type="button" onClick={onBack} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold">이전</button><button type="button" disabled={!canContinue} onClick={onNext} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]">다음: 공유 설정<ArrowRight className="h-4 w-4" /></button></div>
  </div>;
}
