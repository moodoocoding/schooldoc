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
  const numberWidth = compact ? 34 : 52;
  const nameWidth = compact ? 70 : 116;
  const signatureWidth = compact ? 88 : 150;

  return (
    <table className="h-full w-full table-fixed border-collapse text-[#111827]">
      <colgroup>
        <col style={{ width: numberWidth }} />
        <col style={{ width: nameWidth }} />
        {registry.columns.map((column) => <col key={column.id} />)}
        <col style={{ width: signatureWidth }} />
      </colgroup>
      <thead>
        <tr className={`h-11 bg-[#F1F4F7] font-bold ${compact ? 'text-[11px]' : 'text-[13px]'}`}>
          <th className="border border-[#8795A5]">연번</th>
          <th className="border border-[#8795A5]">성명</th>
          {registry.columns.map((column) => (
            <th key={column.id} className={`border border-[#8795A5] break-keep ${compact ? 'px-1' : 'px-2'}`}>{column.label}</th>
          ))}
          <th className="border border-[#8795A5]">서명</th>
        </tr>
      </thead>
      <tbody className="h-full">
        {rows.map((participant, index) => (
          <tr
            key={participant?.id ?? `empty-${index}`}
            className={`text-center ${compact ? 'text-[10px]' : 'text-[13px]'}`}
            style={{ height: `${100 / rowsPerColumn}%` }}
          >
            <td className="overflow-hidden border border-[#8795A5]">{participant?.rowNumber ?? ''}</td>
            <td className={`overflow-hidden border border-[#8795A5] break-keep font-semibold ${compact ? 'px-1' : 'px-2'}`}>{participant?.name ?? ''}</td>
            {registry.columns.map((column) => (
              <td key={column.id} className={`overflow-hidden border border-[#8795A5] break-keep ${compact ? 'px-1' : 'px-2'}`}>
                {participant?.values[column.id] ?? ''}
              </td>
            ))}
            <td className="relative overflow-hidden border border-[#8795A5] p-0">
              {participant?.signature ? (
                <span className="absolute inset-1 flex items-center justify-center overflow-hidden">
                  <img
                    src={participant.signature.dataUrl}
                    alt={`${participant.name} 서명`}
                    className="block max-h-full max-w-full object-contain"
                  />
                </span>
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
            <div className="mt-4 grid min-h-6 grid-cols-2 gap-6 text-[13px] leading-5 text-[#334155]">
              <p className="whitespace-pre-wrap text-left tracking-normal">{registry.leftHeader}</p>
              <p className="whitespace-pre-wrap text-right tracking-normal">{registry.rightHeader}</p>
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
