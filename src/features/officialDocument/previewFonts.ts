import { ATTACHMENT_PROFILE, profileFonts } from './format';
import { substituteFor } from './fontAssets';

let fontCss: Promise<string> | undefined;
/** 저장 파일은 한컴 글꼴 이름을 쓰므로, 미리보기 SVG에서 그 이름을 OFL 대체 글꼴로 그리는 @font-face를 만든다. */
export function officialPreviewFontCss(profile = ATTACHMENT_PROFILE) {
  const faces = profileFonts(profile).flatMap(family => {
    const source = substituteFor(family);
    return [{ ...source.regular, family, weight: 400 }, { ...source.bold, family, weight: 700 }];
  });
  fontCss ??= Promise.all(faces.map(async ({ url, family, weight, format }) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('미리보기 글꼴을 불러오지 못했습니다. 다시 시도해 주세요.');
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url('${data}') format('${format}');}`;
  })).then(styles => styles.join('')).catch(error => { fontCss = undefined; throw error; });
  return fontCss;
}
/** SVG 한 쪽에 글꼴 CSS를 넣어 이미지 URL로 만든다. 사용 후 URL.revokeObjectURL로 해제한다. */
export function officialPageUrl(svg: string, css: string) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('지면 미리보기를 읽지 못했습니다. 다시 시도해 주세요.');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style'); style.textContent = css;
  document.documentElement.prepend(style);
  return URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(document)], { type: 'image/svg+xml' }));
}
