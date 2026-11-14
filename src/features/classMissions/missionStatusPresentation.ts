import type { CheckStatus } from './missionApi';

export const statusLabel: Record<CheckStatus, string> = {
  unmarked: '표시 전', reported: '완료 표시', pending: '확인 대기', confirmed: '교사 확인', exempt: '해당 없음',
};

export const statusTone: Record<CheckStatus, string> = {
  unmarked: 'bg-[#F1F5F9] text-[#475569]', reported: 'bg-[#E8F4FF] text-[#0B5B9F]',
  pending: 'bg-[#FFF3D6] text-[#8A5100]', confirmed: 'bg-[#E6F4EA] text-[#126B32]', exempt: 'bg-[#F5F3FF] text-[#6D42A0]',
};
