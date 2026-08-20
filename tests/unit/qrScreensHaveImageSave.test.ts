import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * QR을 그리는 화면에는 예외 없이 이미지 저장이 함께 있어야 한다.
 *
 * 이 규칙은 한 번 지켜졌다가 다음 기능으로 이어지지 않았다. 가정통신문 관리 화면에만
 * 만들어져 있었고 등록부와 학생 결과에는 없었다. 사람이 기억하는 대신 여기서 걸리게 한다.
 * 새 기능에 QR을 넣으면 이 테스트가 먼저 실패한다.
 */
const walk = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const path = join(directory, entry);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const sourceFiles = walk('src').filter((path) => path.endsWith('.tsx') || path.endsWith('.ts'));

const drawsQrCode = (source: string) => /QRCodeSVG|QRCodeCanvas/.test(source);
const offersImageSave = (source: string) => /saveQrImage|svgToPngBlob/.test(source);

describe('QR을 그리는 화면은 이미지 저장을 함께 제공한다', () => {
  const qrScreens = sourceFiles
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => drawsQrCode(source));

  test('QR을 그리는 화면을 실제로 찾았다', () => {
    // 선택자가 낡아 아무것도 못 찾으면 아래 검사가 통째로 무의미해진다.
    expect(qrScreens.length).toBeGreaterThan(0);
  });

  test.each(qrScreens.map(({ path }) => path))('%s 에 이미지 저장이 있다', (path) => {
    const source = readFileSync(path, 'utf8');
    expect(offersImageSave(source)).toBe(true);
  });
});
