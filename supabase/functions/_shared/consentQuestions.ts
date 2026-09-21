/** JSON 필드에 저장하는 선택 질문. 기존 독립 필드의 의미는 바꾸지 않는다. */
export interface ConsentChoice {
  id: string;
  label: string;
  mode: 'single' | 'multiple';
  required: boolean;
  minSelections: number;
}

export interface QuestionField {
  id: string;
  kind: string;
  label: string;
  required: boolean;
  pageIndex: number;
  x: number;
  y: number;
  choice?: ConsentChoice;
}

export interface ConsentQuestion<T extends QuestionField = QuestionField> {
  id: string;
  label: string;
  fields: T[];
  choice?: ConsentChoice;
  required: boolean;
}

/** 서버에서도 호출하므로 저장된 JSON을 신뢰하지 않고 먼저 검증한다. */
export function consentChoiceConfigError(fields: readonly QuestionField[]): string | null {
  const groups = new Map<string, { choice: ConsentChoice; fields: QuestionField[] }>();
  for (const field of fields) {
    if (field.choice === undefined) continue;
    const choice = field.choice;
    if (!choice || typeof choice !== 'object' || field.kind !== 'checkbox'
      || typeof choice.id !== 'string' || !choice.id.trim() || choice.id.length > 100
      || typeof choice.label !== 'string' || !choice.label.trim() || choice.label.length > 80
      || !['single', 'multiple'].includes(choice.mode) || typeof choice.required !== 'boolean'
      || !Number.isInteger(choice.minSelections) || choice.minSelections < 1
      || (choice.mode === 'single' && choice.minSelections !== 1) || field.required !== false) {
      return '선택 질문 설정을 확인해 주세요.';
    }
    const group = groups.get(choice.id);
    if (group) {
      const previous = group.choice;
      if (previous.label !== choice.label || previous.mode !== choice.mode
        || previous.required !== choice.required || previous.minSelections !== choice.minSelections) {
        return '같은 질문의 선택 규칙이 서로 다릅니다.';
      }
      group.fields.push(field);
    } else groups.set(choice.id, { choice, fields: [field] });
  }
  for (const { choice, fields: options } of groups.values()) {
    if (options.length < 2 || choice.minSelections > options.length) return `${choice.label}: 선택지는 2개 이상이며 최소 선택 수보다 많거나 같아야 합니다.`;
    if (new Set(options.map(field => field.label.trim())).size !== options.length) return `${choice.label}: 선택지 이름을 다르게 입력하세요.`;
  }
  return null;
}

export function consentQuestions<T extends QuestionField>(fields: readonly T[]): ConsentQuestion<T>[] {
  const result: ConsentQuestion<T>[] = [];
  const groups = new Map<string, ConsentQuestion<T>>();
  for (const field of [...fields].sort((a, b) => a.pageIndex - b.pageIndex || a.y - b.y || a.x - b.x)) {
    const choice = field.choice;
    if (choice) {
      const existing = groups.get(choice.id);
      if (existing) existing.fields.push(field);
      else {
        const question = { id: `group:${choice.id}`, label: choice.label, fields: [field], choice, required: choice.required };
        groups.set(choice.id, question);
        result.push(question);
      }
    } else result.push({ id: `field:${field.id}`, label: field.label, fields: [field], required: field.required });
  }
  return result;
}

export function consentQuestionError(question: ConsentQuestion, values: Record<string, unknown>): string | null {
  if (question.fields.some(field => field.kind === 'checkbox' && values[field.id] !== undefined
    && values[field.id] !== '' && values[field.id] !== 'true' && values[field.id] !== 'false')) {
    return `${question.label}: 올바른 선택 값을 보내 주세요.`;
  }
  if (question.choice) {
    const count = question.fields.filter(field => values[field.id] === 'true').length;
    if (question.choice.mode === 'single' && count > 1) return `${question.label}: 하나만 선택해 주세요.`;
    const minimum = question.required ? question.choice.minSelections : 0;
    if (count < minimum) return `${question.label}: ${minimum === 1 ? '하나 이상' : `${minimum}개 이상`} 선택해 주세요.`;
    return null;
  }
  const field = question.fields[0];
  const value = values[field.id];
  if (question.required && (field.kind === 'checkbox' ? value !== 'true' : typeof value !== 'string' || !value.trim())) {
    return `${question.label} 항목을 ${field.kind === 'checkbox' ? '확인' : '입력'}해 주세요.`;
  }
  return null;
}

export function consentResponseError(fields: readonly QuestionField[], values: Record<string, unknown>): string | null {
  const configError = consentChoiceConfigError(fields);
  if (configError) return configError;
  for (const question of consentQuestions(fields)) {
    const error = consentQuestionError(question, values);
    if (error) return error;
  }
  return null;
}

export function setConsentChoice<T extends QuestionField>(fields: readonly T[], values: Record<string, string>, fieldId: string, checked: boolean) {
  const field = fields.find(item => item.id === fieldId);
  const next = { ...values };
  if (checked && field?.choice?.mode === 'single') {
    for (const option of fields) if (option.choice?.id === field.choice.id) next[option.id] = '';
  }
  next[fieldId] = checked ? 'true' : '';
  return next;
}
