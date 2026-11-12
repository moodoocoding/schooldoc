import myeongjoUrl from './assets/fonts/NanumMyeongjo-Regular.otf?url';
import myeongjoBoldUrl from './assets/fonts/NanumMyeongjo-Bold.otf?url';
import gothicUrl from './assets/fonts/NanumGothic-Regular.ttf?url';
import gothicBoldUrl from './assets/fonts/NanumGothic-Bold.ttf?url';

export interface FontSource { url: string; format: 'opentype' | 'truetype' }
/**
 * 한컴·MS 글꼴은 배포할 수 없어 OFL 나눔 글꼴로 조판·미리보기를 대신한다. 저장 파일에는 원래 글꼴 이름을 쓴다.
 * 휴먼명조 → 나눔명조, HY헤드라인M → 나눔고딕 Bold, 맑은 고딕 → 나눔고딕.
 */
export const FONT_SUBSTITUTES: Record<string, { regular: FontSource; bold: FontSource }> = {
  휴먼명조: { regular: { url: myeongjoUrl, format: 'opentype' }, bold: { url: myeongjoBoldUrl, format: 'opentype' } },
  HY헤드라인M: { regular: { url: gothicBoldUrl, format: 'truetype' }, bold: { url: gothicBoldUrl, format: 'truetype' } },
  '맑은 고딕': { regular: { url: gothicUrl, format: 'truetype' }, bold: { url: gothicBoldUrl, format: 'truetype' } },
};
export const substituteFor = (family: string) => FONT_SUBSTITUTES[family] ?? FONT_SUBSTITUTES['휴먼명조'];
