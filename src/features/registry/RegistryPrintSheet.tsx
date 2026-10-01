import { registryPrintPlan, wrapRegistryText } from '../../../supabase/functions/_shared/registryPrintLayout';
import { paginateRegistryParticipants } from './registryUtils';
import type { Registry, RegistryParticipant } from './types';

interface RegistryPrintSheetProps {
  registry: Registry;
  pageIndex?: number;
  onImageError?: (participantId: string) => void;
}

function RegistryTable({
  registry,
  participants,
  rowsPerColumn,
  compact,
  plan,
  onImageError,
}: RegistryPrintSheetProps & { participants: RegistryParticipant[]; rowsPerColumn: number; compact: boolean; plan: ReturnType<typeof registryPrintPlan> }) {
  const rows = Array.from({ length: rowsPerColumn }, (_, index) => participants[index] ?? null);
  const numberWidth = plan.widths.number / 0.75;
  const nameWidth = plan.widths.name / 0.75;
  const signatureWidth = plan.widths.signature / 0.75;
  const cellText = (text: string, width: number) => wrapRegistryText(text, width - 8, plan.size).join('\n');

  return (
    <table className="w-full table-fixed border-collapse text-[#111827]">
      <colgroup>
        <col style={{ width: numberWidth }} />
        <col style={{ width: nameWidth }} />
        {registry.columns.map((column) => <col key={column.id} style={{ width: plan.widths.fields[registry.columns.indexOf(column)] / 0.75 }} />)}
        <col style={{ width: signatureWidth }} />
      </colgroup>
      <thead>
        <tr style={{ height: plan.headerHeight / 0.75, lineHeight: '16px' }} className={`bg-[#F1F4F7] font-bold ${compact ? 'text-[11px]' : 'text-[13px]'}`}>
          <th className="border border-[#8795A5]">연번</th>
          <th className="border border-[#8795A5]">성명</th>
          {registry.columns.map((column) => (
            <th key={column.id} className={`border border-[#8795A5] whitespace-pre-wrap break-all ${compact ? 'px-1' : 'px-2'}`}>{wrapRegistryText(column.label, plan.widths.fields[registry.columns.indexOf(column)] - 8, compact ? 8 : 9.5).join('\n')}</th>
          ))}
          <th className="border border-[#8795A5]">서명</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((participant, index) => (
          <tr
            key={participant?.id ?? `empty-${index}`}
            className={`text-center ${compact ? 'text-[10px]' : 'text-[13px]'}`}
            style={{ height: plan.rowHeight / 0.75, lineHeight: `${(plan.size + 3) / 0.75}px` }}
          >
            <td className="overflow-hidden border border-[#8795A5]">{participant?.rowNumber ?? ''}</td>
            <td className={`overflow-hidden border border-[#8795A5] whitespace-pre-wrap break-all font-semibold ${compact ? 'px-1' : 'px-2'}`}>{cellText(participant?.name ?? '', plan.widths.name)}</td>
            {registry.columns.map((column) => (
              <td key={column.id} className={`overflow-hidden border border-[#8795A5] whitespace-pre-wrap break-all ${compact ? 'px-1' : 'px-2'}`}>
                {cellText(participant?.values[column.id] ?? '', plan.widths.fields[registry.columns.indexOf(column)])}
              </td>
            ))}
            <td className="relative overflow-hidden border border-[#8795A5] p-0">
              {participant?.signature?.dataUrl && !participant.imageError ? (
                <span className="absolute inset-1 flex items-center justify-center overflow-hidden">
                  <img
                    src={participant.signature.dataUrl}
                    onError={() => onImageError?.(participant.id)}
                    alt={`${participant.name} 서명`}
                    className="block max-h-full max-w-full object-contain"
                  />
                </span>
              ) : participant?.signature ? <span className="text-xs text-[#B42318]">서명 이미지 확인 필요</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RegistryPrintSheet({ registry, pageIndex, onImageError }: RegistryPrintSheetProps) {
  const plan = registryPrintPlan(registry);
  if (!plan.valid) return <p role="alert">상단 정보가 A4 한 쪽에 들어가지 않습니다. 제목이나 상단 내용을 확인해 주세요.</p>;
  const { tableColumns: columns, rowsPerColumn } = plan;
  const pageSize = columns * rowsPerColumn;
  const pages = paginateRegistryParticipants(registry.participants, pageSize);
  const visiblePages = pageIndex === undefined
    ? pages.map((page, index) => ({ page, index }))
    : [{ page: pages[Math.min(Math.max(pageIndex, 0), pages.length - 1)], index: Math.min(Math.max(pageIndex, 0), pages.length - 1) }];

  return (
    <div className="registry-print-root space-y-6">
      {visiblePages.map(({ page, index }) => (
        <section
          key={`${registry.id}-page-${index + 1}`}
          className="registry-print-page flex h-[1123px] w-[794px] flex-col bg-white px-[54px] py-[58px] shadow-lg"
        >
          <div className="border-t-4 border-[#0F6CBD] pt-4">
            <h1 className="whitespace-pre-wrap break-all leading-[29.33px] text-center text-[24px] font-extrabold text-[#0F172A]">
              {plan.titleLines.join('\n')}
            </h1>
            <div className="mt-4 grid min-h-6 grid-cols-2 gap-6 text-[13px] leading-5 text-[#334155]">
              <p className="whitespace-pre-wrap break-all text-left tracking-normal">{plan.leftLines.join('\n')}</p>
              <p className="whitespace-pre-wrap break-all text-right tracking-normal">{plan.rightLines.join('\n')}</p>
            </div>
          </div>

          <div style={{ height: (plan.tableTop - 62) / 0.75 }} className={`mt-5 grid min-h-0 gap-4 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {Array.from({ length: columns }, (_, columnIndex) => (
              <RegistryTable
                key={columnIndex}
                registry={registry}
                onImageError={onImageError}
                rowsPerColumn={rowsPerColumn}
                compact={columns === 2}
                plan={plan}
                participants={page.slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn)}
              />
            ))}
          </div>

          <p className="pt-4 mt-auto text-center text-[12px] text-[#526174]">{index + 1} / {pages.length}</p>
        </section>
      ))}
    </div>
  );
}
