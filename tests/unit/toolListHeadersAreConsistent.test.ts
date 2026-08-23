import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const listPages = [
  'src/features/registry/RegistryListPage.tsx',
  'src/features/studentResults/StudentResultsListPage.tsx',
  'src/features/consentForms/ConsentFormsListPage.tsx',
  'src/features/dataCollect/DataCollectListPage.tsx',
  'src/features/specialRooms/SpecialRoomsListPage.tsx',
];

const authGates = [
  'src/features/registry/RegistryAuthGate.tsx',
  'src/features/studentResults/StudentResultsAuthGate.tsx',
  'src/features/consentForms/ConsentFormsAuthGate.tsx',
  'src/features/dataCollect/DataCollectAuthGate.tsx',
  'src/features/specialRooms/SpecialRoomsAuthGate.tsx',
];

describe('교사용 도구 목록 상단 구조', () => {
  test('다섯 목록 화면이 공통 헤더를 사용한다', () => {
    for (const path of listPages) {
      const source = readFileSync(path, 'utf8');
      expect(source, `${path}가 공통 헤더를 사용하지 않는다`).toContain('<ToolListHeader');
      expect(source, `${path}가 별도 뒤로가기 줄을 다시 만들었다`).not.toContain('업무 도구로');
    }
  });

  test('로그인 뒤 인증 게이트가 별도 계정 줄을 끼워 넣지 않는다', () => {
    for (const path of authGates) {
      const source = readFileSync(path, 'utf8');
      expect(source, `${path}가 인증 뒤 자식 화면만 반환하지 않는다`).toContain('return children;');
      expect(source, `${path}가 도구 헤더 위에 계정명을 다시 표시한다`).not.toContain('{displayName}');
    }
  });

  test('특별실 관리자 경로도 인증 게이트 안에 있다', () => {
    const source = readFileSync('src/features/specialRooms/SpecialRoomsWorkspace.tsx', 'utf8');
    expect(source).toContain('<SpecialRoomsAuthGate>');
  });
});
