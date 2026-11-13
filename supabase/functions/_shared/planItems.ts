/**
 * 운영계획서 문단 안의 하위 항목 표기. 저장 형식은 기존과 같은 문자열 문단이며,
 * 줄을 바꾸고 앞에 공백 2칸씩 들이면 한 단계 아래 항목이 된다.
 *
 *   개별 읽기 기록(방법안)        → 가. 개별 읽기 기록(방법안)
 *     운영 방법                   →   1) 운영 방법
 *       학생이 책을 골라 읽는다.  →     가) 학생이 책을 골라 읽는다.
 *     결과물: 읽기 기록지         →   2) 결과물: 읽기 기록지
 *
 * 들여쓰기 없는 줄바꿈은 앞 항목의 이어지는 글로 본다(이전 초안과 직접 수정한 글 호환).
 * 항목 기호는 쓰지 않는다. 출력 계층이 깊이에 따라 편람 번호를 붙인다.
 */
export const ITEM_INDENT = '  ';
/** 문단 첫 줄 아래로 허용하는 하위 단계 수. */
export const MAX_SUB_LEVELS = 3;
export interface PlanItemNode { text: string; children: PlanItemNode[] }

export function parseParagraphItems(paragraph: string): PlanItemNode {
  const lines = paragraph.replace(/\r\n?/g, '\n').split('\n');
  const root: PlanItemNode = { text: lines[0].trim(), children: [] };
  const path: PlanItemNode[] = [root];
  for (const raw of lines.slice(1)) {
    const text = raw.trim();
    if (!text) continue;
    const indent = raw.length - raw.trimStart().length;
    if (indent < ITEM_INDENT.length) {
      const last = path[path.length - 1];
      last.text = `${last.text} ${text}`.trim();
      continue;
    }
    const level = Math.min(Math.floor(indent / ITEM_INDENT.length), path.length, MAX_SUB_LEVELS);
    const node: PlanItemNode = { text, children: [] };
    path[level - 1].children.push(node);
    path.length = level;
    path.push(node);
  }
  return root;
}

/** 하위 항목 표기를 뺀 본문 글자(분량 계산·비교용). */
export const paragraphPlainText = (paragraph: string) => paragraph.replace(/\s*\n\s*/g, ' ').trim();
