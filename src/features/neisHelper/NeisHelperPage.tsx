import { BookOpen, ClipboardList, Sprout, Trophy } from 'lucide-react';
import { ToolHeaderBadge, ToolListHeader } from '../../components/ToolListHeader';
import { useNavigate } from 'react-router-dom';

const features = [
  { name: '교과학습발달상황(세특)', description: '교과별 학습 과정과 성취를 기록합니다.', Icon: BookOpen },
  { name: '행동특성 및 발달상황', description: '학생의 생활 모습과 성장 과정을 기록합니다.', Icon: Sprout },
  {
    name: '창체 누가기록 및 특기·적성',
    description: '활동별 누가기록과 학생의 특기·적성을 정리합니다.',
    Icon: ClipboardList,
  },
  {
    name: '학교스포츠클럽 특기사항',
    description: '종목별 활동 내용과 학생의 참여 모습을 기록합니다.',
    Icon: Trophy,
  },
];

export function NeisHelperPage() {
  const navigate = useNavigate();
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <ToolListHeader
        eyebrow="학생 기록 작성"
        title="Neis Helper"
        description="교과 평어부터 평가 근거에 맞게 작성합니다."
        action={null}
        toolbar={<ToolHeaderBadge>개발 중</ToolHeaderBadge>}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="개발 예정 기능">
        {features.map(({ name, description, Icon }, index) => (
          <button
            key={name}
            type="button"
            disabled={index !== 0}
            onClick={() => navigate('/tools/neis-helper/subject')}
            aria-label={`${name}. ${index === 0 ? '평어 작성 시작' : '개발 예정'}`}
            className="flex min-h-[148px] flex-col items-start rounded-xl border border-[#DCE3EA] bg-white p-5 text-left enabled:hover:border-blue-500 enabled:focus-visible:ring-2 enabled:focus-visible:ring-blue-600 disabled:cursor-not-allowed lg:min-h-[172px]"
          >
            <span className="mb-4 flex w-full items-center justify-between gap-3">
              <Icon className="h-6 w-6 text-[#526174]" aria-hidden="true" />
              <span className="rounded-md bg-[#F1F5F9] px-2.5 py-1 text-xs font-semibold text-[#475569]">
                {index === 0 ? '평어 작성' : '개발 예정'}
              </span>
            </span>
            <span className="break-keep text-lg font-bold leading-snug text-[#0F172A]">{name}</span>
            <span className="mt-2 break-keep text-sm leading-relaxed text-[#526174]">{description}</span>
          </button>
        ))}
      </div>
      <p className="break-keep text-sm leading-relaxed text-[#526174]">
        교과 평어는 평가계획과 나이스 성적을 확인한 뒤 작성합니다. 나머지 세 기능은 개발 예정입니다.
      </p>
    </section>
  );
}
