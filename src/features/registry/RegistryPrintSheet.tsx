import { getRegistryPageSettings, paginateRegistryParticipants } from './registryUtils';
import type { Registry, RegistryParticipant } from './types';

interface RegistryPrintSheetProps {
  registry: Registry;
}

function RegistryTable({
  registry,
  participants,
  rowsPerColumn,
  compact,
}: RegistryPrintSheetProps & { participants: RegistryParticipant[]; rowsPerColumn: number; compact: boolean }) {
  const rows = Array.from({ length: rowsPerColumn }, (_, index) => participants[index] ?? null);

  return (
    <table className="h-full w-full table-fixed border-collapse text-[#111827]">
      <thead>
        <tr className={`h-11 bg-[#F1F4F7] font-bold ${compact ? 'text-[11px]' : 'text-[13px]'}`}>
          <th className={`border border-[#8795A5] ${compact ? 'w-[34px]' : 'w-[52px]'}`}>연번</th>
          <th className={`border border-[#8795A5] ${compact ? 'w-[70px]' : 'w-[116px]'}`}>성명</th>
          {registry.columns.map((column) => (
            <th key={column.id} className={`border border-[#8795A5] break-keep ${compact ? 'px-1' : 'px-2'}`}>{column.label}</th>
          ))}
          <th className={`border border-[#8795A5] ${compact ? 'w-[88px]' : 'w-[150px]'}`}>서명</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((participant, index) => (
          <tr key={participant?.id ?? `empty-${index}`} className={`text-center ${compact ? 'text-[10px]' : 'text-[13px]'}`}>
            <td className="border border-[#8795A5]">{participant?.rowNumber ?? ''}</td>
            <td className={`border border-[#8795A5] break-keep font-semibold ${compact ? 'px-1' : 'px-2'}`}>{participant?.name ?? ''}</td>
            {registry.columns.map((column) => (
              <td key={column.id} className={`border border-[#8795A5] break-keep ${compact ? 'px-1' : 'px-2'}`}>
                {participant?.values[column.id] ?? ''}
              </td>
            ))}
            <td className="border border-[#8795A5] p-1">
              {participant?.signature ? (
                <img
                  src={participant.signature.dataUrl}
                  alt={`${participant.name} 서명`}
                  className="mx-auto max-h-12 max-w-full object-contain"
                />
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RegistryPrintSheet({ registry }: RegistryPrintSheetProps) {
  const { columns, rowsPerColumn } = getRegistryPageSettings(registry.layout);
  const pageSize = columns * rowsPerColumn;
  const pages = paginateRegistryParticipants(registry.participants, pageSize);

  return (
    <div className="registry-print-root space-y-6">
      {pages.map((page, pageIndex) => (
        <section
          key={`${registry.id}-page-${pageIndex + 1}`}
          className="registry-print-page flex h-[1123px] w-[794px] flex-col bg-white px-[54px] py-[58px] shadow-lg"
        >
          <div className="border-t-4 border-[#0F6CBD] pt-4">
            <h1 className="whitespace-pre-wrap text-center text-[24px] font-extrabold text-[#0F172A]">
              {registry.title.trim().split(/\s+/).join('\u3000')}
            </h1>
            <div className="mt-4 flex min-h-6 items-start justify-between gap-6 whitespace-pre-line text-[13px] text-[#334155]">
              <p>{registry.leftHeader}</p>
              <p className="text-right">{registry.rightHeader}</p>
            </div>
          </div>

          <div className={`mt-5 grid min-h-0 flex-1 gap-4 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {Array.from({ length: columns }, (_, columnIndex) => (
              <RegistryTable
                key={columnIndex}
                registry={registry}
                rowsPerColumn={rowsPerColumn}
                compact={columns === 2}
                participants={page.slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn)}
              />
            ))}
          </div>

          <p className="pt-4 text-center text-[12px] text-[#526174]">- {pageIndex + 1} -</p>
        </section>
      ))}
    </div>
  );
}
