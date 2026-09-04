import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { loadTeacherProfile } from '../settings/profileSettings';
import { classBudgetReceiptsOwnerId } from './classBudgetReceiptsConfig';
import { createReceiptBook } from './receiptBookStore';

const digitsOnly = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

export function ReceiptBookCreatePage() {
  const navigate = useNavigate();
  const { user, displayName } = useTeacherAuth();
  const ownerId = classBudgetReceiptsOwnerId(user?.id);
  const year = new Date().getFullYear();
  const profile = useMemo(() => loadTeacherProfile(ownerId, displayName), [displayName, ownerId]);
  const initialClass = profile.gradeClass || '';
  const [schoolYear, setSchoolYear] = useState(String(year));
  const [classLabel, setClassLabel] = useState(initialClass);
  const [title, setTitle] = useState(`${year}학년도${initialClass ? ` ${initialClass}` : ''} 학급 운영비`);
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const numericYear = Number(schoolYear);
    const numericBudget = Number(budget);
    if (!title.trim() || !classLabel.trim() || numericYear < 2000 || numericBudget < 1) {
      setError('제목·학년도·학급·전체 예산을 모두 확인해 주세요.');
      return;
    }
    setSaving(true);
    const book = createReceiptBook(ownerId, { title: title.trim(), schoolYear: numericYear, classLabel: classLabel.trim(), totalBudget: numericBudget });
    navigate(`/tools/receipts/${book.id}`);
  };

  return <div className="mx-auto w-full max-w-3xl space-y-6 pb-12">
    <button type="button" onClick={() => navigate('/tools/receipts')} className="inline-flex min-h-[44px] items-center gap-2 px-2 text-sm font-semibold text-[#334155]"><ArrowLeft className="h-5 w-5" />장부 목록</button>
    <header><p className="text-xs font-bold text-[#0F6CBD]">한 화면에서 바로 시작</p><h1 className="mt-1 text-3xl font-extrabold">새 장부 만들기</h1><p className="mt-2 text-sm text-[#526174]">학급 운영비를 확인하는 데 필요한 네 가지만 입력합니다.</p></header>
    <form onSubmit={submit} className="border-y border-[#DCE3EA] bg-white px-5 py-7 sm:px-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold">제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} className="min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-4" /></label>
        <label><span className="mb-2 block text-sm font-bold">학년도</span><input type="number" min="2000" max="2100" value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} className="min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-4" /></label>
        <label><span className="mb-2 block text-sm font-bold">학급</span><input value={classLabel} onChange={(event) => setClassLabel(event.target.value)} placeholder="예: 5학년 2반" maxLength={30} className="min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-4" /></label>
        <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold">전체 예산</span><span className="flex items-center rounded-lg border border-[#C8D0DA]"><input inputMode="numeric" value={budget} onChange={(event) => setBudget(digitsOnly(event.target.value))} placeholder="예: 500000" className="min-h-[46px] min-w-0 flex-1 px-4 text-right font-bold outline-none" /><span className="pr-4 text-sm font-bold text-[#526174]">원</span></span></label>
      </div>
      {error ? <p role="alert" className="mt-4 border-l-2 border-[#B42318] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}
      <div className="mt-7 flex justify-end gap-2"><button type="button" onClick={() => navigate('/tools/receipts')} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-5 text-sm font-bold">취소</button><button type="submit" disabled={saving} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}장부 만들기</button></div>
    </form>
  </div>;
}
