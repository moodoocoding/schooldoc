import { describe, expect, test } from 'vitest';
import {
  describeRegistryDeletion,
  maskName,
  maskValue,
  mergeSignedFieldValues,
} from '../../src/features/registry/registryUtils';
import type { RegistryParticipant } from '../../src/features/registry/types';

const participant = (id: string, signed: boolean): RegistryParticipant => ({
  id,
  rowNumber: Number(id),
  name: `참석자 ${id}`,
  values: {},
  signature: signed
    ? { dataUrl: 'data:image/png;base64,AAAA', source: 'draw', signedAt: '2026-08-20T00:00:00.000Z' }
    : undefined,
});

describe('서명자가 채운 항목만 얹는다', () => {
  test('비워 둔 항목은 교사가 넣어 둔 값을 그대로 둔다', () => {
    expect(mergeSignedFieldValues({ affiliation: '3학년 1반', role: '담임' }, { affiliation: '' }))
      .toEqual({ affiliation: '3학년 1반', role: '담임' });
  });

  test('채워 보낸 항목만 바뀐다', () => {
    expect(mergeSignedFieldValues({ affiliation: '3학년 1반', role: '담임' }, { role: '부장' }))
      .toEqual({ affiliation: '3학년 1반', role: '부장' });
  });

  test('공백만 넣은 것은 지우려는 뜻이 아니다', () => {
    expect(mergeSignedFieldValues({ affiliation: '3학년 1반' }, { affiliation: '   ' }))
      .toEqual({ affiliation: '3학년 1반' });
  });

  test('아무것도 보내지 않으면 통째로 지워지지 않는다', () => {
    // 예전에는 이 경우 field_values가 {}로 덮여 교사 입력이 사라졌다.
    expect(mergeSignedFieldValues({ affiliation: '3학년 1반' }, undefined))
      .toEqual({ affiliation: '3학년 1반' });
    expect(mergeSignedFieldValues({ affiliation: '3학년 1반' }, {}))
      .toEqual({ affiliation: '3학년 1반' });
  });

  test('새 항목은 더해진다', () => {
    expect(mergeSignedFieldValues({}, { affiliation: '3학년 1반' }))
      .toEqual({ affiliation: '3학년 1반' });
  });
});

describe('지우기 전에 사라지는 양을 숫자로 알린다', () => {
  test('서명이 있으면 인원과 서명 건수를 함께 밝힌다', () => {
    const description = describeRegistryDeletion({
      participants: [participant('1', true), participant('2', true), participant('3', false)],
    });
    expect(description).toContain('참석자 3명');
    expect(description).toContain('서명 2건');
    expect(description).toContain('되돌릴 수 없');
  });

  test('아직 서명이 없으면 그렇다고 말한다', () => {
    const description = describeRegistryDeletion({ participants: [participant('1', false)] });
    expect(description).toContain('참석자 1명');
    expect(description).toContain('아직 받은 서명은 없습니다');
  });

  test('빈 등록부도 문장이 깨지지 않는다', () => {
    expect(describeRegistryDeletion({ participants: [] })).toContain('참석자 0명');
  });
});

describe('공개 화면으로 나가는 값 가리기', () => {
  // registry-public 엣지 함수가 같은 규칙으로 서버에서 가려 보낸다.
  // 예전에는 원문을 보내고 브라우저에서만 덮어, 응답을 그대로 받으면 명단이 드러났다.
  test('이름은 첫 글자와 끝 글자만 남는다', () => {
    expect(maskName('김하늘')).toBe('김*늘');
    expect(maskName('박도')).toBe('박*');
    expect(maskName('김')).toBe('*');
  });

  test('항목 값은 앞 두 글자만 남는다', () => {
    expect(maskValue('3학년 1반')).toBe('3학****');
    expect(maskValue('')).toBe('');
  });

  test('가린 값에는 원문이 남지 않는다', () => {
    const secret = '서울특별시교육청';
    expect(maskValue(secret).includes('교육청')).toBe(false);
  });
});
