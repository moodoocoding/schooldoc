import * as XLSX from 'xlsx';
import type { EventData, StudentData } from '../types';

export const parseExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const exportToCSV = (event: EventData) => {
  const headers = ['학번/ID', '이름', '인증번호(비밀번호)'];
  event.criteria.forEach((c) => headers.push(`${c.name} (${c.maxScore}점 만점)`));
  headers.push('종합 피드백', '조회 상태', '이의제기 내용', '마지막 변경일시');

  const rows = event.students.map((student) => {
    const row = [student.id, student.name, student.accessCode];
    event.criteria.forEach((c) => {
      row.push(String(student.scores[c.name] ?? ''));
    });
    row.push(
      student.feedback,
      getStatusLabel(student.status),
      student.disputeMessage || '',
      student.updatedAt ? new Date(student.updatedAt).toLocaleString('ko-KR') : '-'
    );
    return row;
  });

  const csvContent = [headers, ...rows]
    .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${event.title}_조회결과_리포트.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadTemplate = (criteriaNames: string[]) => {
  const headers = ['학번/ID', '이름', '인증번호(비밀번호)', ...criteriaNames, '종합 피드백'];
  const sampleData = [
    [
      '50101',
      '홍길동',
      '1234',
      ...criteriaNames.map(() => '10'),
      '홍길동 학생은 모든 과제를 우수하게 완료하여 모범을 보였습니다.'
    ],
    [
      '50102',
      '이영희',
      '5678',
      ...criteriaNames.map(() => '9'),
      '이영희 학생은 창의적인 디자인 요소가 뛰어납니다.'
    ]
  ];

  const csvContent = [headers, ...sampleData]
    .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `평가데이터_업로드_템플릿.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const getStatusLabel = (status: StudentData['status']) => {
  switch (status) {
    case 'unviewed':
      return '미확인';
    case 'viewed':
      return '조회함';
    case 'confirmed':
      return '확인완료';
    case 'disputed':
      return '이의제기';
    default:
      return '';
  }
};
