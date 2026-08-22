import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * 접근 가능한 이름이 서로 부분 일치하면 안 된다.
 *
 * 한 이름이 다른 이름을 통째로 포함하면 `getByLabel`이 둘을 함께 잡고, 보조기기 사용자도
 * 어느 쪽인지 구분할 수 없다. `pro/web-ui-expert.md` 원칙 5다.
 *
 * 이 규칙은 두 번 깨졌다. 등록부의 `참석자 서명 링크`가 `참석자 서명 링크 QR 코드`에,
 * 특별실 예약의 `특별실 예약 링크`가 `특별실 예약 링크 QR 코드`에 포함됐다. 두 번 모두
 * 테스트를 `exact: true`로 우회하며 넘어갔기 때문에, 사람 대신 여기서 막는다.
 */
const walk = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const path = join(directory, entry);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

/** 화면 하나가 한 번에 보여 주는 이름들끼리만 견준다. 파일 단위로 본다. */
const screens = walk('src')
  .filter((path) => path.endsWith('.tsx'))
  .map((path) => ({
    path,
    // 값이 고정된 것만 본다. 템플릿 문자열은 사람 이름 등이 들어가 매번 달라진다.
    names: [...new Set(readFileSync(path, 'utf8').match(/aria-label="[^"{]+"/g) ?? [])]
      .map((match) => match.slice('aria-label="'.length, -1)),
  }))
  .filter((screen) => screen.names.length > 1);

const overlapping = (names: string[]) => names.flatMap((a) => (
  names.filter((b) => a !== b && b.includes(a)).map((b) => `"${a}" ⊂ "${b}"`)
));

describe('접근 가능한 이름은 서로를 포함하지 않는다', () => {
  test('검사할 화면을 실제로 찾았다', () => {
    // 선택자가 낡아 아무것도 못 찾으면 아래 검사가 통째로 무의미해진다.
    expect(screens.length).toBeGreaterThan(0);
  });

  test.each(screens.map((screen) => [screen.path, screen.names] as const))(
    '%s',
    (_path, names) => {
      expect(overlapping([...names])).toEqual([]);
    },
  );
});
