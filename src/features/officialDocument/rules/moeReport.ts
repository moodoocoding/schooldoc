/**
 * 교육부 보고서(개조식) 서식 실측값.
 *
 * 출처: UpstageAI/korean-report-hwpx (MIT, Copyright (c) 2026 Upstage)
 *   korean_report_hwpx/rules_report/교육부.json, 커밋 210b864e4afba5144e3cbc87f9c0211d589e1746
 *   교육부 보도자료의 참고·붙임 보고서 34건, 378개 문단에서 측정한 값이다. 라이선스: ./korean-report-hwpx.LICENSE
 * SchoolDoc에서 쓰는 단계별 글꼴·크기·간격·표 머리·제목 값만 옮겼다. 크기는 pt, 간격은 앞 줄과 사이의 pt다.
 * mark는 실측 문서의 기호 기록이며, 출력 기호는 편람 표기(□ ○ - ㆍ, 참고 ※)를 따른다(format.ts DEEP_MARKERS).
 */
export interface MeasuredLevel { mark: string; font: string; pt: number; line: number; samples: number }
export interface MeasuredGap { pt: number; samples: number; none: number }

export const MOE_REPORT_RULES = {
  documents: 34,
  levels: {
    l1: { mark: '□', font: 'HY헤드라인M', pt: 15, line: 160, samples: 26 },
    l2: { mark: '◦', font: '휴먼명조', pt: 15, line: 160, samples: 181 },
    l3: { mark: '-', font: '휴먼명조', pt: 15, line: 180, samples: 23 },
    ref: { mark: '※', font: '맑은 고딕', pt: 12, line: 160, samples: 28 },
  } satisfies Record<string, MeasuredLevel>,
  /** "앞>뒤" 사이 간격. samples는 간격이 있던 수, none은 간격 없이 붙은 수다. */
  gaps: {
    'l2>l1': { pt: 9, samples: 12, none: 3 },
    'table>table': { pt: 11, samples: 8, none: 0 },
    'table>l1': { pt: 12, samples: 25, none: 10 },
    'l1>l2': { pt: 7.5, samples: 10, none: 31 },
    'l2>l2': { pt: 7.5, samples: 12, none: 67 },
    'l2>ref': { pt: 4, samples: 3, none: 16 },
    'l2>table': { pt: 3, samples: 3, none: 0 },
    'table>l2': { pt: 10, samples: 9, none: 14 },
    'table>ref': { pt: 6, samples: 4, none: 11 },
  } satisfies Record<string, MeasuredGap>,
  tableHead: { font: '맑은 고딕', pt: 12, bold: true, fill: '#DFE6F7', samples: 131 },
  title: { font: 'HY헤드라인M', pt: 16, bold: false, samples: 79 },
} as const;
