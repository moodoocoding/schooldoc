import { describe, expect, it } from 'vitest';
import { extractSignatureInk, fitSignatureSize } from '../../src/features/registry/signatureImage';

const makeImage = (width: number, height: number, value = 255) => {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = 255;
  }
  return pixels;
};

const fillRectangle = (
  pixels: Uint8ClampedArray,
  imageWidth: number,
  left: number,
  top: number,
  width: number,
  height: number,
  color: [number, number, number],
) => {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const index = (y * imageWidth + x) * 4;
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
    }
  }
};

describe('사진 서명 잉크 추출', () => {
  it('밝은 배경은 투명하게 만들고 검은 획 주변만 자른다', () => {
    const width = 40;
    const height = 30;
    const pixels = makeImage(width, height);
    fillRectangle(pixels, width, 15, 10, 10, 10, [20, 20, 20]);

    const result = extractSignatureInk(pixels, width, height, 0);

    expect(result.bounds).toEqual({ x: 9, y: 4, width: 22, height: 22 });
    expect(result.inkPixels).toBe(100);
    expect(result.pixels[3]).toBe(0);
    expect(result.pixels[(10 * width + 15) * 4 + 3]).toBe(255);
  });

  it('파란색 서명 획도 잉크로 인식한다', () => {
    const pixels = makeImage(40, 30);
    fillRectangle(pixels, 40, 12, 12, 16, 6, [30, 80, 190]);

    const result = extractSignatureInk(pixels, 40, 30);

    expect(result.bounds).not.toBeNull();
    expect(result.inkPixels).toBe(96);
  });

  it('빈 종이는 서명으로 인정하지 않는다', () => {
    const result = extractSignatureInk(makeImage(40, 30), 40, 30);
    expect(result.bounds).toBeNull();
    expect(result.inkPixels).toBe(0);
  });

  it('픽셀 배열 크기가 맞지 않으면 거부한다', () => {
    expect(() => extractSignatureInk(new Uint8ClampedArray(4), 10, 10)).toThrow(RangeError);
  });
});

describe('사진 서명 크기 축소', () => {
  it('가로와 세로 비율을 유지하며 최대 1000×400 안에 맞춘다', () => {
    expect(fitSignatureSize(2400, 1200)).toEqual({ width: 800, height: 400 });
    expect(fitSignatureSize(2000, 400)).toEqual({ width: 1000, height: 200 });
  });

  it('작은 이미지는 확대하지 않는다', () => {
    expect(fitSignatureSize(320, 120)).toEqual({ width: 320, height: 120 });
  });
});
