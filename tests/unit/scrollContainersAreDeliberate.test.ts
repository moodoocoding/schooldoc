import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * 스크롤 컨테이너는 의도해서 만든 것만 있어야 한다.
 *
 * 두 가지를 막는다.
 *
 * 1. 한 축만 `hidden`으로 막는 것.
 *    CSS는 한 축이 `visible`이 아니면 반대 축의 `visible`을 `auto`로 계산한다. 그래서
 *    `overflow-x-hidden`만 적으면 그 요소는 뜻하지 않게 세로 스크롤 컨테이너가 된다.
 *    스크롤 컨테이너가 되면 flex 안에서 `min-height: auto`가 0으로 풀려 내용이 부모
 *    높이로 찌그러지고, 안쪽의 `position: sticky`도 기준이 바뀐다.
 *    가로만 자르고 싶으면 `overflow-x-clip`을 쓴다. `clip`은 반대 축을 건드리지 않는다.
 *
 * 2. 화면 전체 높이(`h-screen`)에 세로 스크롤을 같이 붙이는 것.
 *    앱 껍데기가 100vh에 고정되면 문서가 1px이라도 밀리는 순간 껍데기 바닥 아래로
 *    `body`의 흰 배경이 드러난다. 실제로 학생 결과·특별실 화면에서 아래쪽에 194px짜리
 *    흰 여백이 생겼다. 세로 스크롤은 문서 하나가 맡고, 껍데기는 `min-h-screen`으로 둔다.
 *
 * 대화상자처럼 화면 위에 떠서 제 안을 굴려야 하는 것은 예외다. 그때는 `h-screen` 대신
 * `max-h-[...]`를 쓰므로 아래 검사에 걸리지 않는다.
 */
const walk = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const path = join(directory, entry);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const sources = walk('src')
  .filter((path) => path.endsWith('.tsx'))
  .map((path) => ({ path, text: readFileSync(path, 'utf8') }));

/** className 안에 들어 있는 클래스 묶음만 본다. 주석과 설명 글은 걸리지 않는다. */
const classLists = (text: string): string[] => (
  [...text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? '')
);

/** `sm:`·`print:` 같은 조건이 붙은 것도 같은 클래스로 본다. */
const has = (classes: string[], name: string) => classes.some((klass) => (
  klass === name || klass.endsWith(`:${name}`)
));

const findings = sources.flatMap(({ path, text }) => classLists(text).flatMap((list) => {
  const classes = list.split(/\s+/).filter(Boolean);
  const axis = (prefix: string) => classes.some((klass) => (
    klass.startsWith(`${prefix}-`) || klass.includes(`:${prefix}-`)
  ));
  const problems: string[] = [];

  // 한 축만 hidden으로 막으면 반대 축이 auto가 된다. 반대 축을 함께 적었다면 의도한 것이다.
  if (has(classes, 'overflow-x-hidden') && !axis('overflow-y') && !has(classes, 'overflow-hidden')) {
    problems.push('overflow-x-hidden → overflow-x-clip');
  }
  if (has(classes, 'overflow-y-hidden') && !axis('overflow-x') && !has(classes, 'overflow-hidden')) {
    problems.push('overflow-y-hidden → overflow-y-clip');
  }

  // 화면 높이에 못 박은 판이 스스로 세로 스크롤까지 맡으면 문서와 스크롤이 겹친다.
  if (has(classes, 'h-screen') && (has(classes, 'overflow-y-auto') || has(classes, 'overflow-auto')
    || has(classes, 'overflow-y-scroll') || has(classes, 'overflow-scroll'))) {
    problems.push('h-screen + 세로 스크롤 → min-h-screen으로 두고 문서가 스크롤하게');
  }

  return problems.map((problem) => `${path}: ${problem}\n  ${list.slice(0, 90)}`);
}));

describe('스크롤 컨테이너는 의도해서 만든 것만 있다', () => {
  test('검사할 화면을 실제로 찾았다', () => {
    // 선택자가 낡아 아무것도 못 읽으면 아래 검사가 통째로 무의미해진다.
    expect(sources.length).toBeGreaterThan(20);
    expect(sources.some(({ text }) => classLists(text).length > 0)).toBe(true);
  });

  test('뜻하지 않게 스크롤 컨테이너가 되는 곳이 없다', () => {
    expect(findings).toEqual([]);
  });
});
