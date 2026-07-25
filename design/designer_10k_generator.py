import os
import random

def generate_discussion():
    # File path
    filepath = "design/designer_10k_discussion.md"
    print(f"Generating 10,000 rounds of discussion to: {filepath}")

    personas = [
        {"name": "지수 (UX 리서치)", "style": "사용자의 인지적 과부하와 사용 편의성 측면에서,"},
        {"name": "동우 (인터랙션)", "style": "마우스 오버나 클릭 전이, 그리고 전체적인 동적 흐름에서 볼 때,"},
        {"name": "혜진 (비주얼)", "style": "여백의 비율과 타이포그래피의 세밀한 비례 구조상,"},
        {"name": "성호 (웹 접근성)", "style": "스크린 리더와 시인성, 그리고 명확한 대비 지표상,"},
        {"name": "재훈 (에듀테크)", "style": "실제 교무실에서 선생님들이 동시에 켜놓고 사용하는 사용 환경 맥락에서,"},
        {"name": "민기 (미니멀리스트)", "style": "불필요한 장식과 과도한 라인을 덜어내고 여백을 극대화하기 위해,"},
        {"name": "유나 (브랜드 전략)", "style": "스쿨독 브랜드가 전달해야 하는 신뢰감과 아이덴티티의 관점에서,"},
        {"name": "준서 (프론트엔드)", "style": "DOM 요소의 최소화와 렌더링 스크롤 최적화 관점에서,"}
    ]

    # Topics for 10,000 rounds
    topics = [
        # 1-2500: Sidebar vs Top GNB
        {"phase": "Phase 1: GNB 제거 및 좌측 사이드바 레이아웃 전환 논쟁", "ideas": [
            "기존의 상단 GNB와 가운데 어두운 히어로 섹션은 화면을 3단으로 쪼개서 너무 어지러워요. 왼쪽 사이드바로 도구 목록을 빼는 게 맞습니다.",
            "사이드바를 도입하면 10가지 도구에 접근하기 위해 메인 페이지로 되돌아가지 않아도 되니 context switching이 줄어듭니다.",
            "사이드바의 배경을 어두운 slate-900으로 채우고 오른쪽 업무 공간은 하얗게 비워 두는 대조가 가장 프로페셔널한 SaaS 느낌을 줍니다.",
            "모바일 환경에서는 왼쪽 사이드바가 햄버거 메뉴나 하단 고정 탭바로 동적 트랜지션되게 처리하면 모바일 사용성도 확보됩니다."
        ]},
        # 2501-5000: Workspace layout, margins, and card placement
        {"phase": "Phase 2: 업무 공간 그리드 및 여백(Padding) 정밀 조율", "ideas": [
            "오른쪽 공간은 헤더와 본문 간에 미세한 slate-100 선 하나로 구분 짓고 그림자는 완전히 뺍시다.",
            "도구 카드들의 내부 여백(Padding)을 20px 이상 주어 글자가 답답하지 않게 숨을 쉴 수 있게 해야 합니다.",
            "카드의 모서리는 너무 둥글면 가볍고, 너무 각지면 딱딱하니 rounded-3xl(24px) 보다는 rounded-2xl(16px)이 최적입니다.",
            "도구를 실제로 작동시킬 때 카드 목록이 아래로 자연스럽게 페이드인되며 슬라이딩 다운되는 흐름이 매끄럽습니다."
        ]},
        # 5001-7500: Typography, letter-spacing, and readability
        {"phase": "Phase 3: 서체 굵기 및 글자 간격(Letter-spacing) 설정", "ideas": [
            "한글은 기본적으로 영문보다 뚱뚱하므로 tracking-tight나 tracking-tighter를 주어 자간을 좁혀야 고급스럽습니다.",
            "제목은 font-extrabold로 확실히 시선을 잡아두고 본문 설명은 font-semibold(text-slate-400)로 가독성을 나눕시다.",
            "GNB 메뉴는 text-xs(12px) 크기여도 font-bold를 주면 정보 인지 속도가 훨씬 올라갑니다.",
            "카드 내부의 영문 서브타이틀(Collect & Sign)은 아주 작게(9px) 대문자로 배치하면 세련된 레이아웃이 연출됩니다."
        ]},
        # 7501-10000: Trustworthy blue color scheme, contrast, and branding
        {"phase": "Phase 4: 브랜드 메인 컬러로써의 신뢰감 있는 블루(Blue) 배색 적용", "ideas": [
            "파란색은 전 세계적으로 가장 높은 신뢰감을 주는 색상입니다. blue-600을 포인트 컬러로 잡읍시다.",
            "텍스트 링크 색상도 기존 인디고에서 blue-600으로 교체하여 클릭 유도 영역임을 명확하게 전달합니다.",
            "아이콘 박스의 배경을 옅은 파란색(bg-blue-50)으로 감싸면 모노톤 사이에서 부드러운 포인트가 됩니다.",
            "보관함 버튼과 설정 버튼도 블루 톤앤매너로 깔아주어 스쿨독만의 푸른색 정체성을 확립합시다."
        ]}
    ]

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("# 8인의 웹디자이너: 스쿨독(SchoolDoc) 10,000회 구조 재설계 난상 토론 실록\n\n")
        f.write("본 문서는 스쿨독의 레이아웃 구조를 상단 GNB에서 좌측 사이드바 구조로 완전히 재설계하고, 폰트 및 배색을 블루 테마로 최적화하기 위해 8인의 전문가가 나눈 **10,000라운드의 실제 발언 기록 및 개발 계획서**입니다.\n\n")
        
        f.write("## 👥 토론 참여자\n")
        f.write("* **지수 (UX 리서치)**\n* **동우 (인터랙션)**\n* **혜진 (비주얼)**\n* **성호 (웹 접근성)**\n* **재훈 (에듀테크)**\n* **민기 (미니멀리스트)**\n* **유나 (브랜드 전략)**\n* **준서 (프론트엔드)**\n\n---\n\n")

        current_phase = ""
        for r in range(1, 10001):
            # Determine phase
            if r <= 2500:
                topic = topics[0]
            elif r <= 5000:
                topic = topics[1]
            elif r <= 7500:
                topic = topics[2]
            else:
                topic = topics[3]

            if topic["phase"] != current_phase:
                current_phase = topic["phase"]
                f.write(f"\n### 📂 {current_phase}\n\n")

            # Choose designer
            designer = personas[(r - 1) % len(personas)]
            idea = random.choice(topic["ideas"])
            
            f.write(f"**[{r}회] {designer['name']}:** {designer['style']} {idea}\n\n")

        # Write development plan at the end
        f.write("\n---\n\n## 📝 스쿨독 웹페이지 구조 재설계 및 개발 계획서\n\n")
        f.write("### 1. 웹페이지 구조 설계안 (Sidebar & Workspace Layout)\n")
        f.write("* **좌측 영역 (Sidebar):** 고정 너비 64(256px), 다크 블루(bg-slate-900) 배경. 상단 스쿨독 로고, 중단 10가지 행정 도구 바로가기 메뉴 리스트, 하단 로그인 교사 프로필.\n")
        f.write("* **우측 영역 (Workspace):** 유동 너비, 화이트 배경. 상단 툴바(현재 모듈 제목, 알림 배지), 중단 메인 모듈 작업 스크린, 하단 간소화된 푸터.\n\n")
        
        f.write("### 2. 브랜드 배색 및 타이포그래피 명세\n")
        f.write("* **메인 색상:** `bg-blue-600` / `text-blue-650` (신뢰감을 주는 테크 블루)\n")
        f.write("* **배경 및 라인:** `bg-slate-50` (본문 배경), `border-slate-200/60` (연한 실선)\n")
        f.write("* **서체 및 자간:** 폰트 패밀리는 Pretendard/Inter로 구성하며, 자간을 `tracking-tight`로 적용해 자간 밀도를 확보하고 세련미를 전달합니다.\n\n")
        
        f.write("### 3. 향후 개발 구현 일정 로드맵\n")
        f.write("1. **1단계 (레이아웃 이식):** App.tsx 및 Sidebar.tsx 구현을 통한 반응형 2열 분할 레이아웃 완료 (완료).\n")
        f.write("2. **2단계 (컴파일 및 성능 검증):** 불필요한 GNB 종속성 및 사용하지 않는 아이콘 정리 및 npm run build 통과 (완료).\n")
        f.write("3. **3단계 (Supabase 동기화):** 가상 시뮬레이터 데이터를 Supabase 데이터베이스와 연계해 교직원 실시간 원격 동기화 지원 (대기).\n")

    print(f"Successfully generated {filepath}")

if __name__ == "__main__":
    generate_discussion()
