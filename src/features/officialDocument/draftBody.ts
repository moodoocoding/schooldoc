import { bodyLines, tableCells } from './format';
import type { OfficialNode } from './model';

/**
 * K-에듀파인 기안 본문 칸에 붙여 넣을 일반 텍스트. 두문(수신·제목)과 결문(발신명의·결재란)은 업무관리시스템이 만든다.
 *
 * 편람 규칙(51~53·61쪽, 시행규칙 제2조·제4조⑤):
 * - 항목 기호 1. → 가. → 1) …, 하위 항목은 2타(스페이스 2번)씩 들여 쓴다. 기호와 내용 사이는 1타.
 * - 본문 문장 아래 항목이 이어지면 항목은 1.부터 왼쪽 기본선에서 시작한다. 항목이 하나뿐이면 기호를 붙이지 않는다.
 * - 붙임: `붙임  명칭 1부.  끝.`, 여러 개면 `붙임  1. 명칭` 다음 줄부터 `붙임  ` 너비(스페이스 6번)만큼 들여 쓴다.
 * - 끝 표시는 한 번만: 붙임이 있으면 붙임 끝, 없으면 본문 마지막 글자에서 2타 띄워서.
 * 표기 방식은 korean-report-hwpx(MIT, Copyright (c) 2026 Upstage) engine/official.py의 붙임·끝 표시 처리를 일반 텍스트에 맞춰 옮겼다.
 */
export interface DraftBodyInput {
  /** 항목 앞에 오는 본문 문장(기호 없음). */
  lead?: string;
  items: OfficialNode[];
  attachments?: string[];
}
const END = '  끝.';
const ATTACHMENT_LABEL = '붙임  ';
/** `붙임  `은 한글 2자 + 스페이스 2번 = 한글 3자 너비 = 스페이스 6번. */
const ATTACHMENT_INDENT = ' '.repeat(6);

export function draftBodyText({ lead, items, attachments = [] }: DraftBodyInput): string {
  const lines: string[] = [];
  if (lead?.trim()) lines.push(lead.trim());
  for (const line of bodyLines(items, false, false)) {
    if (line.kind === 'title') continue;
    const indent = '  '.repeat(line.level - 1);
    if (line.kind === 'table') tableCells(line).forEach(row => lines.push(`${indent}${row.join(' | ')}`));
    else lines.push(`${indent}${line.text}`);
  }
  const names = attachments.map(name => name.trim()).filter(Boolean);
  if (!names.length) {
    if (lines.length) lines[lines.length - 1] += END;
    return lines.join('\n');
  }
  lines.push('');
  if (names.length === 1) lines.push(`${ATTACHMENT_LABEL}${names[0]}${END}`);
  else names.forEach((name, i) => lines.push(`${i ? ATTACHMENT_INDENT : ATTACHMENT_LABEL}${i + 1}. ${name}${i === names.length - 1 ? END : ''}`));
  return lines.join('\n');
}
