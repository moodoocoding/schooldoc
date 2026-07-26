import React from 'react';
import { 
  ShieldCheck, FileCheck2, ClipboardCheck, Inbox, FileEdit, 
  Receipt, Award, CalendarClock, SearchCheck, PackageCheck, ArrowRight
} from 'lucide-react';
import type { SchoolTool } from '../types/schooldoc';

interface ToolCardProps {
  tool: SchoolTool;
  onSelectTool: (toolId: string) => void;
}

export const getToolIcon = (iconName: string): React.FC<{ className?: string }> => {
  switch (iconName) {
    case 'shield-check': return ShieldCheck;
    case 'file-signature': return FileCheck2;
    case 'clipboard-list': return ClipboardCheck;
    case 'inbox': return Inbox;
    case 'file-pen': return FileEdit;
    case 'receipt': return Receipt;
    case 'award': return Award;
    case 'calendar-clock': return CalendarClock;
    case 'package-search': return SearchCheck;
    case 'package-check': return PackageCheck;
    default: return FileCheck2;
  }
};

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onSelectTool }) => {
  const Icon = getToolIcon(tool.iconName);

  return (
    <button
      onClick={() => onSelectTool(tool.id)}
      className="w-full text-left bg-white rounded-xl p-5 border border-[#DCE3EA] shadow-xs hover:shadow-md hover:border-[#0F6CBD] transition-all duration-200 group flex flex-col justify-between min-h-[192px] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] relative cursor-pointer"
      aria-label={`${tool.name} 시작하기. ${tool.desc}`}
    >
      <div>
        {/* Header: Icon & Real Status Badge */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[#EFF6FC] border border-[#0F6CBD]/10 flex items-center justify-center text-[#0F6CBD] group-hover:bg-[#0F6CBD] group-hover:text-white transition-colors">
            <Icon className="w-5 h-5" />
          </div>

          {tool.statusText ? (
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                tool.status === 'in_progress'
                  ? 'bg-[#EFF6FC] text-[#0F6CBD] border-[#0F6CBD]/20'
                  : tool.warningCount
                  ? 'bg-[#FFFBEB] text-[#A15C00] border-[#FCD34D]'
                  : 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]'
              }`}
            >
              {tool.statusText}
            </span>
          ) : (
            <span className="text-xs font-semibold text-[#64748B] bg-[#F6F8FB] px-2.5 py-1 rounded-md border border-[#DCE3EA]">
              새로 만들기
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-[#0F172A] group-hover:text-[#0F6CBD] transition-colors mb-1.5 leading-snug tracking-tight">
          {tool.name}
        </h3>

        {/* Description (max 2 lines, min 14px) */}
        <p className="text-sm text-[#334155] leading-relaxed line-clamp-2 font-normal">
          {tool.desc}
        </p>
      </div>

      {/* Footer Action Button */}
      <div className="pt-3 mt-3 border-t border-[#F6F8FB] flex items-center justify-between text-sm font-semibold text-[#0F6CBD] group-hover:text-[#0F5B9E]">
        <span>시작하기</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
};
