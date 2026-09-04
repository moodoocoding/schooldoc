import { Plus, ReceiptText, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { ToolHeaderBadge, ToolListHeader } from '../../components/ToolListHeader';
import { classBudgetReceiptsOwnerId } from './classBudgetReceiptsConfig';
import { calculateReceiptBookSummary, formatWon } from './receiptBookUtils';
import { useReceiptBooks } from './useReceiptBooks';

export function ReceiptBooksListPage() {
  const navigate = useNavigate();
  const { user } = useTeacherAuth();
  const books = useReceiptBooks(classBudgetReceiptsOwnerId(user?.id));

  return <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
    <ToolListHeader
      eyebrow="남은 예산을 바로 확인"
      title="학급 운영비 영수증"
      description="영수증 지출을 장부에 기록하고 전체 예산과 남은 금액을 확인합니다."
      toolbar={<ToolHeaderBadge>개인 장부</ToolHeaderBadge>}
      action={<button type="button" onClick={() => navigate('/tools/receipts/new')} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F]"><Plus className="h-4 w-4" />새 장부 만들기</button>}
    />
    {books.length === 0 ? <section className="border-y border-[#DCE3EA] bg-white py-20 text-center">
      <ReceiptText className="mx-auto h-9 w-9 text-[#94A3B8]" />
      <h2 className="mt-4 text-lg font-bold">아직 학급 운영비 장부가 없습니다</h2>
      <p className="mt-2 text-sm text-[#526174]">제목·학년도·학급·전체 예산만 입력하면 바로 시작할 수 있습니다.</p>
      <button type="button" onClick={() => navigate('/tools/receipts/new')} className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD]">첫 장부 만들기</button>
    </section> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{books.map((book) => {
      const summary = calculateReceiptBookSummary(book);
      return <button key={book.id} type="button" onClick={() => navigate(`/tools/receipts/${book.id}`)} className="rounded-lg border border-[#DCE3EA] bg-white p-5 text-left shadow-sm hover:border-[#0F6CBD]">
        <div className="flex items-center justify-between gap-3"><span className="rounded-md bg-[#E6F4EA] px-2.5 py-1 text-xs font-bold text-[#126B32]">장부 사용 중</span><span className="text-xs font-bold text-[#526174]">지출 {summary.entryCount}건</span></div>
        <h2 className="mt-4 min-h-12 break-words text-lg font-bold text-[#0F172A]">{book.title}</h2>
        <p className="mt-2 text-sm text-[#526174]">{book.schoolYear}학년도 · {book.classLabel}</p>
        <p className="mt-4 text-sm text-[#526174]">전체 {formatWon(book.totalBudget)} · 사용 {formatWon(summary.usedAmount)}</p>
        <p className="mt-2 flex items-center gap-2 text-base font-extrabold text-[#126B32]"><WalletCards className="h-4 w-4" />남음 {formatWon(summary.remainingAmount)}</p>
      </button>;
    })}</div>}
  </div>;
}
