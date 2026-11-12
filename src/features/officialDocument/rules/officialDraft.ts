/**
 * 기안문·시행문(행정업무규정 시행규칙 별지 제1호서식) 서식 값.
 *
 * 출처: UpstageAI/korean-report-hwpx (MIT, Copyright (c) 2026 Upstage)
 *   korean_report_hwpx/rules_official/_공통.json, engine/official.py, 커밋 210b864e4afba5144e3cbc87f9c0211d589e1746
 *   근거: 「행정업무의 운영 및 혁신에 관한 규정」 제7조④⑤⑥, 같은 시행규칙 제2조·제4조·제6조. 라이선스: ./korean-report-hwpx.LICENSE
 * 크기·간격은 pt다.
 */
export const OFFICIAL_DRAFT_RULES = {
  organization: { font: 'HY헤드라인M', pt: 22, afterPt: 10 },
  head: { font: '휴먼명조', pt: 15, line: 160, labels: { to: '수신', via: '(경유)', title: '제목' }, labelGap: '  ', afterPt: 6 },
  body: { font: '휴먼명조', pt: 15, line: 160 },
  attachments: { label: '붙임', labelGap: '  ', beforePt: 5 },
  endMark: { text: '끝.', gap: '  ' },
  sender: { font: 'HY헤드라인M', pt: 18, beforePt: 20, afterPt: 10 },
  recipients: { label: '수신자', labelGap: '  ', separator: ', ' },
  approval: { font: '맑은 고딕', pt: 11, opinionText: '(의견 있음)', coordinatorLabel: '협조자', barFill: '#BFBFBF' },
  footer: { font: '맑은 고딕', pt: 11, line: 150, issue: '시행', receive: '접수', zip: '우', phone: '전화번호', fax: '팩스번호', separator: '  /  ' },
} as const;
