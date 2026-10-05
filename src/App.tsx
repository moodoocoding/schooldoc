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
import { ReceiptBooksWorkspace } from './features/classBudgetReceipts/ReceiptBooksWorkspace';
import { ClassroomRolesWorkspace } from './features/classroomRoles/ClassroomRolesWorkspace';
import { useAppearanceSettings } from './features/settings/appearanceContext';
import { PublicClassroomRolesPage } from './features/classroomRoles/PublicClassroomRolesPage';
import { ClassMissionsWorkspace } from './features/classMissions/ClassMissionsWorkspace';
import { PublicClassMissionsPage } from './features/classMissions/PublicClassMissionsPage';
import { canAccessClassBudgetReceipts } from './features/classBudgetReceipts/classBudgetReceiptsConfig';
import { useTeacherAuth } from './auth/teacherAuth';
import { getVisibleSchoolTools } from './auth/schoolToolVisibility';
import type { SidebarTab, SchoolTool } from './types/schooldoc';

function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SidebarTab>('home');
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [quickMenuIds, setQuickMenuIds] = useState<string[]>(['notice-collect', 'student-lookup']);
  const [isOpenNotifications, setIsOpenNotifications] = useState<boolean>(false);
  const { user, loading: authLoading, signIn, error: authError } = useTeacherAuth();
  const { settings: appearance } = useAppearanceSettings();
  const canUseReceiptBooks = canAccessClassBudgetReceipts(user);

  // 개발 중인 네 도구의 공개 범위는 아래 공통 필터에서 구분한다.
  const allToolsMap: Record<string, SchoolTool> = {
    'class-missions': {
      id: 'class-missions',
      name: '학급 미션',
      desc: '학생의 완료 표시를 받고 미션별 현황을 확인합니다.',
      iconName: 'clipboard-list',
      status: 'ready',
    },
    'classroom-roles': {
      id: 'classroom-roles',
      name: '1인 1역',
      desc: '우리 반 역할을 배정하고 학생들의 매일 실천을 기록합니다.',
      iconName: 'clipboard-list',
      status: 'ready',
    },
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
      name: '학급 운영비 영수증',
      desc: '학급 운영비 지출을 기록하고 전체 예산과 남은 금액을 확인합니다.',
      iconName: 'receipt',
      status: 'ready',
      statusText: canUseReceiptBooks ? undefined : '로그인 후 사용',
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

  const visibleToolsMap = getVisibleSchoolTools(allToolsMap, user, authLoading);
  const visibleQuickMenuIds = quickMenuIds.filter((id) => Boolean(visibleToolsMap[id]));

  const isRegistryRoute = location.pathname.startsWith('/tools/registry-sign');
  const isStudentResultsRoute = location.pathname.startsWith('/tools/student-results');
  const isConsentFormsRoute = location.pathname.startsWith('/tools/consent-forms');
  const isSpecialRoomsRoute = location.pathname.startsWith('/tools/special-rooms');
  const isDataCollectRoute = location.pathname.startsWith('/tools/data-collect');
  const isReceiptBooksRoute = location.pathname.startsWith('/tools/receipts');
  const isClassroomRolesRoute = location.pathname.startsWith('/tools/classroom-roles');
  const isClassMissionsRoute = location.pathname.startsWith('/tools/class-missions');
  const isRoleAssignmentRoute = /^\/tools\/classroom-roles\/(assign|rotate)$/.test(location.pathname);

  const toolRoutes: Record<string, string> = {
    'class-missions': '/tools/class-missions',
    'classroom-roles': '/tools/classroom-roles',
    'registry-sign': '/tools/registry-sign',
    'student-lookup': '/tools/student-results',
    'notice-collect': '/tools/consent-forms',
    'special-room': '/tools/special-rooms',
    'data-collect': '/tools/data-collect',
    'receipt-auto': '/tools/receipts',
  };

  const handleSelectTool = (toolId: string) => {
    if (!visibleToolsMap[toolId]) return;
    const route = toolRoutes[toolId];
    // 아직 만들지 않은 도구는 열지 않는다. 단계와 업로드가 있는 화면이 열리면
    // 동작하는 줄 알고 자료를 올리게 된다.
    if (!route) return;
    navigate(route);
  };

  const handleAddQuickMenu = (toolId: string) => {
    if (!visibleToolsMap[toolId]) return;
    setQuickMenuIds((current) => {
      const visibleIds = current.filter((id) => Boolean(visibleToolsMap[id]));
      if (visibleIds.length >= 5 || visibleIds.includes(toolId)) return current;
      return [...visibleIds, toolId];
    });
  };

  const handleRemoveQuickMenu = (toolId: string) => {
    setQuickMenuIds((current) => current.filter((id) => id !== toolId));
  };

  return (
    <div data-role-default-theme={appearance.themeId === 'schooldoc-blue' ? 'true' : undefined} className={`schooldoc-admin-shell min-h-screen bg-[#F6F8FB] font-sans text-[#0F172A] flex antialiased ${isRoleAssignmentRoute ? 'role-assignment-shell' : ''}`}>
      {/* Smart Hover Sidebar Component */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          navigate('/');
        }}
        quickMenuIds={visibleQuickMenuIds}
        allToolsMap={visibleToolsMap}
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
        {isRegistryRoute || isStudentResultsRoute || isConsentFormsRoute || isSpecialRoomsRoute || isDataCollectRoute || isReceiptBooksRoute || isClassroomRolesRoute || isClassMissionsRoute ? (
          <main className={`min-w-0 overflow-x-clip p-4 sm:p-8 ${isRoleAssignmentRoute ? 'role-assignment-main' : ''}`}>
            {isRegistryRoute ? <RegistryWorkspace />
              : isStudentResultsRoute ? <StudentResultsWorkspace />
              : isConsentFormsRoute ? <ConsentFormsWorkspace />
              : isSpecialRoomsRoute ? <SpecialRoomsWorkspace />
              : isDataCollectRoute ? <DataCollectWorkspace />
              : isClassMissionsRoute ? <ClassMissionsWorkspace />
              : isClassroomRolesRoute ? <Routes><Route path="/tools/classroom-roles/*" element={<ClassroomRolesWorkspace />} /></Routes>
              : !authLoading && canUseReceiptBooks ? <ReceiptBooksWorkspace key={user?.id} />
                : <section className="mx-auto max-w-xl border-y border-[#DCE3EA] bg-white px-6 py-16 text-center">
                  <h1 className="text-xl font-extrabold text-[#0F172A]">학급 운영비 영수증</h1>
                  <p className="mt-3 text-sm leading-6 text-[#526174]">
                    {authLoading ? '로그인 상태를 확인하고 있습니다.' : '교사 계정으로 로그인하면 개인 장부를 만들고 영수증을 정리할 수 있습니다.'}
                  </p>
                  {authError ? <p role="alert" className="mt-3 text-sm text-[#B42318]">{authError}</p> : null}
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {!authLoading ? <button type="button" onClick={() => void signIn()} className="min-h-[44px] rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white">Google로 로그인</button> : null}
                    <button type="button" onClick={() => navigate('/')} className="min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD]">홈으로 돌아가기</button>
                  </div>
                </section>}
          </main>
        ) : (
          <main className="flex-1">
            {activeTab === 'home' && (
              <HomeWorkspace
                allToolsMap={visibleToolsMap}
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
      <Route path="/s/missions/:token" element={<PublicClassMissionsPage />} />
      <Route path="/s/roles/:token" element={<PublicClassroomRolesPage />} />
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
