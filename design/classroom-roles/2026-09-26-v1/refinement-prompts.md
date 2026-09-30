# 보정 프롬프트

생성 방식: 내장 image_gen. 모든 호출의 transparent_background는 false입니다.

최종 02 시안은 아래 보정 시도 후 최초 프롬프트로 새로 생성했으며, 다음 불투명 배경·정확한 문구 제약을 덧붙였습니다.

```text
The entire image must be fully opaque with an uninterrupted #F6F8FB canvas and white panels. No transparent background, no torn edges, no dark gaps. Ensure the wizard labels read exactly "1 역할 설정", "2 학생 배정", "3 배포". Ensure the timing is exactly "하교 전" (after school before going home), never "학교 전". Keep all other text as specified.
```

## 04–09 원본 생성에 추가한 공통 제약

```text
Output must be fully opaque, solid light-gray canvas and white panels; no transparency or missing background pixels.
```

## 02 배경 복원

```text
Use case: precise-object-edit. Repair ONLY the damaged/missing background in this Korean SchoolDoc UI mockup. The image has black/transparent-looking torn areas around the header, sidebar and margins. Replace ALL of these with an even fully opaque pale gray #F6F8FB main canvas and fully opaque white sidebar and footer. Restore crisp dark navy header and sidebar labels where affected, preserve the exact Korean labels, two-pane editor content, layout, buttons, controls, and overall geometry. This is a flat complete application screenshot with NO transparent pixels, NO black areas, NO distressed textures. The header is '우리 반 역할 만들기'. Do not alter any role content or positions.
```

## 02 탐색·수행 시점 문구 통일

```text
Use case: text-localization. Edit ONLY four Korean text labels in this otherwise excellent fully opaque flat SchoolDoc screen. 1) In the left sidebar second nav entry replace '학급활동' with exact '진행 중'. 2) In the top wizard step 3 replace '검토' with exact '배포'. 3) In the bottom-left profile replace '김교사' with exact '김선생'. 4) In the rightmost first task timing dropdown ensure the exact text is '하교 전' (going home after school), not '학교 전'. Keep ALL other Korean text, layout, colors, icons, table positions, form controls, opaque pale gray background and white sidebar exactly unchanged. Do not redesign, add, remove or reorder any element. No transparency, no dark patches.
```
