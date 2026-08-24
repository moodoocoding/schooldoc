import { useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { HomeWorkspace } from './components/HomeWorkspace';
import { NotificationComingSoonDialog } from './components/NotificationComingSoonDialog';
import { ActiveWorkPage } from './features/activeWork/ActiveWorkPage';
import { SpecialRoomsWorkspace } from './features/specialRooms/SpecialRoomsWorkspace';
import { PublicSpecialRoomsPage } from './features/specialRooms/PublicSpecialRoomsPage';
import { SettingsPage } from './components/SettingsPage';
import { PublicRegistrySignPage } from './features/registry/PublicRegistrySignPage';
import { RegistryWorkspace } from './features/registry/RegistryWorkspace';
import { PublicStudentResultPage } from './features/studentResults/PublicStudentResultPage';
import { StudentResultsWorkspace } from './features/studentResults/StudentResultsWorkspace';
import { ConsentFormsWorkspace } from './features/consentForms/ConsentFormsWorkspace';
import { PublicConsentResponsePage } from './features/consentForms/PublicConsentResponsePage';
import { DataCollectWorkspace } from './features/dataCollect/DataCollectWorkspace';
import { PublicDataCollectPage } from './features/dataCollect/PublicDataCollectPage';
import type { SidebarTab, SchoolTool } from './types/schooldoc';

function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SidebarTab>('home');
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [quickMenuIds, setQuickMenuIds] = useState<string[]>(['notice-collect', 'student-lookup']);
  const [isOpenNotifications, setIsOpenNotifications] = useState<boolean>(false);

  // 10 Core Services matched EXACTLY with user specification
  const allToolsMap: Record<string, SchoolTool> = {
    'student-lookup': {
      id: 'student-lookup',
      name: '학생 결과 안내',
      desc: '엑셀을 올리고 학생별 결과를 안전하게 안내합니다.',
      iconName: 'shield-check',
      status: 'ready',
    },
    'notice-collect': {
      id: 'notice-collect',
      name: '가정통신문 수합',
      desc: '가정통신문의 응답과 보호자 서명을 온라인으로 받습니다.',
      iconName: 'file-signature',
      status: 'ready',
    },
    'registry-sign': {
      id: 'registry-sign',
      name: '등록부 서명',
      desc: '회의와 행사 참석자의 서명을 받아 등록부를 완성합니다.',
      iconName: 'clipboard-list',
      status: 'ready',
    },
    'data-collect': {
      id: 'data-collect',
      name: '자료 수합',
      desc: '필요한 제출 항목을 만들고 파일과 응답을 한곳에서 받습니다.',
      iconName: 'inbox',
      status: 'ready',
    },
    'special-room': {
      id: 'special-room',
      name: '특별실 예약',
      desc: '특별실의 사용 가능 시간을 확인하고 예약합니다.',
      iconName: 'calendar-clock',
      status: 'ready',
    },
    'receipt-auto': {
      id: 'receipt-auto',
      name: '영수증 정리',
      desc: '영수증을 촬영하면 금액과 상호명을 인식해 표로 정리합니다.',
      iconName: 'receipt',
      status: 'in_progress',
      statusText: '개발 중',
    },
    'cert-collect': {
      id: 'cert-collect',
      name: '이수증 수합',
      desc: '연수 이수증을 모으고 연수명과 이수 시간을 자동 집계합니다.',
      iconName: 'award',
      status: 'in_progress',
      statusText: '개발 중',
    },
    'doc-sign': {
      id: 'doc-sign',
      name: '문서 서명',
      desc: 'PDF의 서명 위치를 지정하고 비대면 서명을 받습니다.',
      iconName: 'file-pen',
      status: 'in_progress',
      statusText: '개발 중',
    },
    'lost-found': {
      id: 'lost-found',
      name: '분실물 관리',
      desc: '습득물 사진과 장소를 등록하고 반환 상태를 관리합니다.',
      iconName: 'package-search',
      status: 'in_progress',
      statusText: '개발 중',
    },
    'item-rent': {
      id: 'item-rent',
      name: '물품 대여',
      desc: '공용 물품의 대여자와 반납 예정일을 관리합니다.',
      iconName: 'package-check',
      status: 'in_progress',
      statusText: '개발 중',
    },
  };

  const isRegistryRoute = location.pathname.startsWith('/tools/registry-sign');
  const isStudentResultsRoute = location.pathname.startsWith('/tools/student-results');
  const isConsentFormsRoute = location.pathname.startsWith('/tools/consent-forms');
  const isSpecialRoomsRoute = location.pathname.startsWith('/tools/special-rooms');
  const isDataCollectRoute = location.pathname.startsWith('/tools/data-collect');

  const toolRoutes: Record<string, string> = {
    'registry-sign': '/tools/registry-sign',
    'student-lookup': '/tools/student-results',
    'notice-collect': '/tools/consent-forms',
    'special-room': '/tools/special-rooms',
    'data-collect': '/tools/data-collect',
  };

  const handleSelectTool = (toolId: string) => {
    const route = toolRoutes[toolId];
    // 아직 만들지 않은 도구는 열지 않는다. 단계와 업로드가 있는 화면이 열리면
    // 동작하는 줄 알고 자료를 올리게 된다.
    if (!route) return;
    navigate(route);
  };

  const handleAddQuickMenu = (toolId: string) => {
    if (quickMenuIds.length >= 5) return;
    if (!quickMenuIds.includes(toolId)) {
      setQuickMenuIds([...quickMenuIds, toolId]);
    }
  };

  const handleRemoveQuickMenu = (toolId: string) => {
    setQuickMenuIds(quickMenuIds.filter((id) => id !== toolId));
  };

  return (
    <div className="schooldoc-admin-shell min-h-screen bg-[#F6F8FB] font-sans text-[#0F172A] flex antialiased">
      {/* Smart Hover Sidebar Component */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          navigate('/');
        }}
        quickMenuIds={quickMenuIds}
        allToolsMap={allToolsMap}
        onSelectTool={handleSelectTool}
        onAddQuickMenu={handleAddQuickMenu}
        onRemoveQuickMenu={handleRemoveQuickMenu}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        onOpenNotifications={() => setIsOpenNotifications(true)}
      />

      {/*
        Right Workspace Main Content

        세로 스크롤은 문서 하나만 맡는다. 사이드바가 `h-screen sticky top-0`이라 그래야
        따라 붙고, 껍데기를 100vh로 못 박지 않아야 내용이 길어질 때 같이 늘어난다.
        예전에는 이 판이 `h-screen overflow-y-auto`로 스크롤을 가로챘는데, 그러면 껍데기
        높이가 100vh에 고정된 채 문서가 조금이라도 밀릴 때 아래에 흰 바닥이 드러났다.

        main의 가로 넘침은 `clip`으로 자른다. `overflow-x-hidden`을 쓰면 반대 축의
        `visible`이 `auto`로 계산돼 main이 뜻하지 않게 세로 스크롤 컨테이너가 되고,
        flex 안에서 `min-height: auto`가 0으로 풀려 내용이 잘린다. `clip`은 반대 축을
        건드리지 않는다.
      */}
      <div className="flex-1 flex flex-col min-w-0">
        {isRegistryRoute || isStudentResultsRoute || isConsentFormsRoute || isSpecialRoomsRoute || isDataCollectRoute ? (
          <main className="min-w-0 overflow-x-clip p-4 sm:p-8">
            {isRegistryRoute ? <RegistryWorkspace />
              : isStudentResultsRoute ? <StudentResultsWorkspace />
              : isConsentFormsRoute ? <ConsentFormsWorkspace />
              : isSpecialRoomsRoute ? <SpecialRoomsWorkspace />
              : <DataCollectWorkspace />}
          </main>
        ) : (
          <main className="flex-1">
            {activeTab === 'home' && (
              <HomeWorkspace
                allToolsMap={allToolsMap}
                onSelectTool={handleSelectTool}
                onOpenMobileMenu={() => setIsOpenMobile(true)}
              />
            )}

            {activeTab === 'in_progress' && (
              <ActiveWorkPage />
            )}

            {activeTab === 'settings' && (
              <SettingsPage />
            )}
          </main>
        )}
      </div>

      {isOpenNotifications ? (
        <NotificationComingSoonDialog onClose={() => setIsOpenNotifications(false)} />
      ) : null}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/s/registry/:token" element={<PublicRegistrySignPage />} />
      <Route path="/s/results/:token" element={<PublicStudentResultPage />} />
      <Route path="/s/consent/:token" element={<PublicConsentResponsePage />} />
      <Route path="/s/rooms/:token" element={<PublicSpecialRoomsPage />} />
      <Route path="/s/data/:token" element={<PublicDataCollectPage />} />
      <Route path="*" element={<AdminApp />} />
    </Routes>
  );
}

export default App;
