import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

/** QR을 표시하는 화면은 개별/공유 여부와 관계없이 PNG 저장을 제공한다. */
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
