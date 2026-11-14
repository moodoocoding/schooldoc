import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import {
  Button,
  buttonClass,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  PageShell,
  Panel,
  Stepper,
  Tabs,
} from '../../src/components/ui';

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(
  createElement(MemoryRouter, null, element),
);

describe('공용 UI 부품', () => {
  test('버튼은 44px 클릭 영역과 변형별 대표 색을 쓴다', () => {
    expect(buttonClass()).toContain('min-h-[44px]');
    expect(buttonClass({ variant: 'primary' })).toContain('bg-[#0F6CBD]');
    expect(buttonClass({ variant: 'danger' })).toContain('bg-[#B42318]');
    expect(buttonClass({ variant: 'secondary' })).toContain('border-[#C8D0DA]');
    const html = render(createElement(Button, null, '저장'));
    expect(html).toContain('type="button"');
  });

  test('페이지 너비는 정해진 세 가지 중 하나다', () => {
    expect(render(createElement(PageShell, null, 'x'))).toContain('max-w-7xl');
    expect(render(createElement(PageShell, { width: 'narrow' }, 'x'))).toContain('max-w-3xl');
    expect(render(createElement(PageShell, { width: 'full' }, 'x'))).toContain('max-w-[1500px]');
  });

  test('페이지 상단은 뒤로가기·소제목·h1·주 동작을 같은 구조로 그린다', () => {
    const html = render(createElement(PageHeader, {
      back: { label: '등록부 목록', to: '/tools/registry' },
      eyebrow: '등록부 관리',
      title: '연수 등록부',
      description: '서명 현황을 확인합니다.',
      action: createElement(Button, null, '링크 복사'),
    }));
    expect(html).toContain('등록부 목록');
    expect(html).toContain('<h1');
    expect(html).toContain('연수 등록부');
    expect(html).toContain('링크 복사');
    expect(html).toContain('border-b');
  });

  test('뒤로가기가 없는 최상위 화면은 빈 뒤로가기 줄을 그리지 않는다', () => {
    const html = render(createElement(PageHeader, { title: '설정' }));
    expect(html).not.toContain('border-b');
    expect(html).toContain('설정');
  });

  test('패널 제목은 h2이고 모든 패널이 같은 카드 모양을 쓴다', () => {
    const html = render(createElement(Panel, { title: '학생 명단' }, '내용'));
    expect(html).toContain('<h2');
    expect(html).toContain('rounded-lg border border-[#DCE3EA] bg-white');
  });

  test('탭은 선택된 탭만 Tab 순서에 넣는다', () => {
    const html = render(createElement(Tabs<'open' | 'archive'>, {
      label: '자료 수합 목록',
      items: [{ value: 'open', label: '수합 중' }, { value: 'archive', label: '보관함' }],
      value: 'open',
      onChange: () => undefined,
    }));
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="자료 수합 목록"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1);
  });

  test('단계 표시는 현재 단계를 aria-current로, 상태를 문구로도 알린다', () => {
    const html = render(createElement(Stepper, {
      label: '작성 단계',
      steps: [
        { label: '기본 설정', status: 'complete' },
        { label: '공문 추가', status: 'current' },
        { label: '검토·저장', status: 'upcoming' },
      ],
    }));
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain('완료');
    expect(html).toContain('현재 단계');
    expect(html).toContain('대기');
  });

  test('빈 상태·불러오기·오류 안내가 같은 문구와 역할을 쓴다', () => {
    const empty = render(createElement(EmptyState, { title: '아직 수합이 없습니다', action: createElement(Button, null, '새 수합') }));
    expect(empty).toContain('<h2');
    expect(empty).toContain('새 수합');

    const loading = render(createElement(LoadingState));
    expect(loading).toContain('role="status"');
    expect(loading).toContain('불러오는 중입니다.');

    expect(render(createElement(Notice, { tone: 'danger' }, '저장하지 못했습니다.'))).toContain('role="alert"');
    expect(render(createElement(Notice, { tone: 'info' }, '안내'))).toContain('role="status"');
  });

  test('기존 목록 머리글과 확인 창은 공용 부품을 그대로 쓴다', () => {
    expect(readFileSync('src/components/ToolListHeader.tsx', 'utf8')).toContain('<PageHeader');
    expect(readFileSync('src/features/registry/RegistryConfirmDialog.tsx', 'utf8')).toContain('<ConfirmDialog');
  });

  test('공용 부품은 개인 화면 테마가 치환하지 않는 강조색을 새로 만들지 않는다', () => {
    const themed = readFileSync('src/index.css', 'utf8');
    const files = readdirSync('src/components/ui').filter((name) => name.endsWith('.tsx'));
    for (const name of files) {
      const source = readFileSync(`src/components/ui/${name}`, 'utf8');
      for (const [, color] of source.matchAll(/(?:bg|text|border)-\[(#[0-9A-Fa-f]{6})\]/g)) {
        // 의미 색(성공·주의·오류)과 보조 회색 외의 파란 계열은 테마 치환 목록에 있어야 한다.
        if (!/^#0[A-F0-9]{5}$/i.test(color)) continue;
        expect(themed.toLowerCase(), `${name}의 ${color}가 테마 치환 목록에 없다`).toContain(color.toLowerCase());
      }
    }
  });
});
