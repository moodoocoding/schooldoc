import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * 하나의 공유 QR을 보여주는 화면에는 이미지 저장이 함께 있어야 한다.
 *
 * 개인 QR PDF는 여러 학생의 QR을 인쇄·배부하는 화면이라 카드마다 같은 저장 버튼을 반복하지
 * 않는다. 이 화면의 대표 동작은 PDF 다운로드 하나이며 아래 명시적 예외 검사가 그 결정을
 * 지킨다.
 */
const walk = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const path = join(directory, entry);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const sourceFiles = walk('src').filter((path) => path.endsWith('.tsx') || path.endsWith('.ts'));

const drawsQrCode = (source: string) => /QRCodeSVG|QRCodeCanvas/.test(source);
const offersImageSave = (source: string) => /saveQrImage|svgToPngBlob/.test(source);
const studentResultQrPdfPath = 'src/features/studentResults/StudentResultsQrPrintPage.tsx';

describe('하나의 공유 QR을 그리는 화면은 이미지 저장을 함께 제공한다', () => {
  const qrScreens = sourceFiles
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ path, source }) => path !== studentResultQrPdfPath && drawsQrCode(source));

  test('QR을 그리는 화면을 실제로 찾았다', () => {
    // 선택자가 낡아 아무것도 못 찾으면 아래 검사가 통째로 무의미해진다.
    expect(qrScreens.length).toBeGreaterThan(0);
  });

  test.each(qrScreens.map(({ path }) => path))('%s 에 이미지 저장이 있다', (path) => {
    const source = readFileSync(path, 'utf8');
    expect(offersImageSave(source)).toBe(true);
  });

  test('개인 QR PDF는 반복 이미지 저장을 제공하지 않는다', () => {
    const source = readFileSync(studentResultQrPdfPath, 'utf8');
    expect(drawsQrCode(source)).toBe(true);
    expect(offersImageSave(source)).toBe(false);
  });
});
