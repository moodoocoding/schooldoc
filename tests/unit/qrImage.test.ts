import { describe, expect, test } from 'vitest';
import { QR_IMAGE_SIZE, qrImageFileName } from '../../src/utils/qrImage';

describe('QR 이미지 파일 이름', () => {
  test('제목 뒤에 용도를 붙이고 png로 끝난다', () => {
    expect(qrImageFileName('2학기 수행평가', '개인QR', '학생 결과 안내'))
      .toBe('2학기 수행평가_개인QR.png');
  });

  test('파일 이름에 쓸 수 없는 글자를 바꾼다', () => {
    expect(qrImageFileName('1/2학기: 안내', '서명QR', '등록부'))
      .toBe('1_2학기_ 안내_서명QR.png');
  });

  test('제목이 비면 기능 이름으로 대신한다', () => {
    expect(qrImageFileName('   ', '서명QR', '등록부')).toBe('등록부_서명QR.png');
  });

  test('아주 긴 제목은 잘라 낸다', () => {
    const name = qrImageFileName('가'.repeat(200), '개인QR', '가정통신문');
    expect(name.length).toBeLessThanOrEqual(60 + '_개인QR.png'.length);
  });
});

describe('인쇄에 견디는 크기로 저장한다', () => {
  test('화면 QR보다 훨씬 크게 만든다', () => {
    // 화면 QR은 104~190px이다. 그대로 저장하면 인쇄했을 때 읽히지 않는다.
    expect(QR_IMAGE_SIZE).toBeGreaterThanOrEqual(1024);
  });
});
