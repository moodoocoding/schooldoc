import { assessmentProblems, commentStyleContext, normalizeGrade, SKIP_COLUMN, suggestAssessment } from '../../../supabase/functions/_shared/neisHelper';
import type { Assessment, GradeBook, GradeStudent } from '../../../supabase/functions/_shared/neisHelper';
import type { ClassCommentInput } from '../../../supabase/functions/_shared/neisClassComments';
import type { AssessmentWorksheet, CommentDraft } from './subjectDraft';

export function automaticMappings(book: GradeBook, assessments: Assessment[]) {
  const candidates = book.columns.map((column) => suggestAssessment(column.label, assessments));
  return Object.fromEntries(book.columns.flatMap((column, index) => {
    const id = candidates[index];
    return id && candidates.indexOf(id) === candidates.lastIndexOf(id) ? [[column.id, id]] : [];
  }));
}

export function buildClassRequest(
  subject: string,
  length: ClassCommentInput['length'],
  book: GradeBook,
  targets: GradeStudent[],
  assessments: Assessment[],
  mappings: Record<string, string>,
  worksheets: Record<string, AssessmentWorksheet>,
  results: Record<string, CommentDraft>,
) {
  const used = book.columns.flatMap((column, index) => {
    const id = mappings[column.id];
    if (id === SKIP_COLUMN) return [];
    const evaluation = assessments.find((assessment) => assessment.id === id);
    if (!evaluation || assessmentProblems(evaluation).length) throw new Error('연결된 평가의 기준을 확인해 주세요.');
    return [{ evaluation, index }];
  });
  if (!used.length || !targets.length) throw new Error('연결된 평가와 생성할 학생을 확인해 주세요.');
  const idMap = new Map<string, string>();
  const groups = new Map<string, ClassCommentInput['groups'][number]>();
  const orderedStudents = book.students.toSorted((a, b) => Number(a.number) - Number(b.number));
  for (const student of targets) {
    const alias = `s${orderedStudents.findIndex((row) => row.id === student.id) + 1}`;
    const grades = used.map(({ index: columnIndex }) => {
      const grade = normalizeGrade(student.grades[columnIndex]);
      if (!grade) throw new Error('비어 있거나 확인되지 않은 성적이 있습니다.');
      return grade;
    });
    const key = grades.join(',');
    const group = groups.get(key) ?? { ids: [], grades };
    group.ids.push(alias);
    groups.set(key, group);
    idMap.set(alias, student.id);
  }
  const targetIds = new Set(targets.map((student) => student.id));
  // Compare against what the teacher currently sees, including their edits.
  const previousComments = orderedStudents.flatMap((student) =>
    !targetIds.has(student.id) && results[student.id]?.text.trim() ? [results[student.id].text] : [],
  );
  const gradeGroups = [...groups.values()];
  const input: ClassCommentInput = {
    subject, length,
    evaluations: used.map(({ evaluation }, index) => {
      const activeGrades = new Set(gradeGroups.map((group) => group.grades[index]));
      const taskContext = worksheets[evaluation.id]?.taskContext.trim();
      return {
        standardCode: evaluation.standardCode, standard: evaluation.standard, task: evaluation.task,
        rubrics: Object.fromEntries([...activeGrades].map((grade) => [grade, evaluation.rubrics[grade]])),
        ...(taskContext ? { taskContext } : {}),
      };
    }),
    groups: gradeGroups,
    ...commentStyleContext(previousComments),
    revisions: [...idMap].flatMap(([id, studentId]) => results[studentId]?.text.trim()
      ? [{ id, text: results[studentId].text, reason: '교사가 재작성을 요청했습니다. 다른 학생과 겹치지 않는 자연스러운 문장으로 다시 작성하세요.' }]
      : []),
  };
  return { input, idMap };
}
