import React, { useEffect, useState } from 'react';
import { 
  User, Building2, Lock, Bell, Sun, Palette,
  ShieldCheck, CheckCircle2, FileSignature, Upload
} from 'lucide-react';
import { useTeacherAuth } from '../auth/teacherAuth';
import { SchoolPicker } from '../features/specialRooms/SchoolPicker';
import type { SelectedSchool } from '../features/specialRooms/types';
import { useAppearanceSettings } from '../features/settings/appearanceContext';
import { SCHOOLDOC_THEMES } from '../features/settings/appearanceSettings';
import { loadTeacherProfile, saveTeacherProfile } from '../features/settings/profileSettings';

export const SettingsPage: React.FC = () => {
  const { configured, displayName, error, loading, signIn, user } = useTeacherAuth();
  const { settings: appearance, setFontSize, setTheme } = useAppearanceSettings();
  const isLoggedIn = Boolean(user);
  const [activeTab, setActiveTab] = useState<'profile' | 'signature' | 'security' | 'display'>('profile');
  const [school, setSchool] = useState<SelectedSchool | null>(null);
  const [teacherName, setTeacherName] = useState<string>('');
  const [gradeClass, setGradeClass] = useState<string>('');
  const [profileSaved, setProfileSaved] = useState<boolean>(false);
  const [autoPurgeDays, setAutoPurgeDays] = useState<number>(90);
  const accountLabel = displayName || '교사 계정';

  useEffect(() => {
    const profile = loadTeacherProfile(user?.id ?? '', displayName ?? '');
    setSchool(profile.school);
    setTeacherName(profile.teacherName);
    setGradeClass(profile.gradeClass);
    setProfileSaved(false);
  }, [displayName, user?.id]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    saveTeacherProfile(user.id, {
      school,
      teacherName: teacherName.trim(),
      gradeClass: gradeClass.trim(),
    });
    setProfileSaved(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8 animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCE3EA] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            스쿨독 환경 설정
          </h1>
          <p className="text-sm text-[#334155] mt-1 font-normal">
            개인 프로필, 전자 서명 도장, 알림, 화면 환경을 관리합니다.
          </p>
        </div>

        {/* Auth Status Badge */}
        <div>
          {isLoggedIn ? (
            <div className="flex items-center gap-2 bg-[#E6F4EA] border border-[#16803C]/20 px-3.5 py-1.5 rounded-full">
              <ShieldCheck className="w-4 h-4 text-[#16803C]" />
              <span className="max-w-56 truncate text-xs font-bold text-[#16803C]">계정 인증됨 ({accountLabel})</span>
            </div>
          ) : (
            <button
              onClick={() => void signIn('/')}
              disabled={loading || !configured}
              className="flex items-center gap-2 bg-[#EFF6FC] hover:bg-[#0F6CBD] hover:text-white border border-[#0F6CBD]/30 px-4 py-2 rounded-lg text-xs font-bold text-[#0F6CBD] transition-colors disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#64748B]"
            >
              <Lock className="w-4 h-4" />
              <span>{configured ? 'Google로 로그인하여 설정 열기' : '로그인 설정 필요'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Logged Out State Banner */}
      {!isLoggedIn && (
        <div className="bg-[#EFF6FC] border border-[#0F6CBD]/20 rounded-xl p-6 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#0F6CBD] text-white flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-[#0F172A]">
              선생님 계정 로그인이 필요합니다
            </h2>
            <p className="text-xs text-[#334155] leading-relaxed">
              소속 학교 정보 등록, 가정통신문 전자서명/도장 관리, 보안 설정은 로그인을 완료하신 후 이용하실 수 있습니다.
            </p>
          </div>
          <button
            onClick={() => void signIn('/')}
            disabled={loading || !configured}
            className="bg-[#0F6CBD] hover:bg-[#0F5B9E] text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-xs transition disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
          >
            {loading ? '로그인 확인 중' : configured ? 'Google로 로그인하기' : '관리자에게 로그인 설정 요청하기'}
          </button>
          {error ? <p role="alert" className="text-xs font-semibold text-[#B42318]">{error}</p> : null}
        </div>
      )}

      {/* Main Settings Tabs & Content */}
      <div className="bg-white rounded-xl border border-[#DCE3EA] shadow-xs overflow-hidden">
        {/* Tab Header Buttons */}
        <div className="flex border-b border-[#DCE3EA] bg-[#F6F8FB] overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
              activeTab === 'profile'
                ? 'border-[#0F6CBD] text-[#0F6CBD] bg-white font-black'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>프로필 & 소속 학교</span>
          </button>

          <button
            onClick={() => setActiveTab('signature')}
            className={`px-5 py-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
              activeTab === 'signature'
                ? 'border-[#0F6CBD] text-[#0F6CBD] bg-white font-black'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            <span>전자 서명 & 도장</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-5 py-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
              activeTab === 'security'
                ? 'border-[#0F6CBD] text-[#0F6CBD] bg-white font-black'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>알림 & 개인정보 보안</span>
          </button>

          <button
            onClick={() => setActiveTab('display')}
            className={`px-5 py-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
              activeTab === 'display'
                ? 'border-[#0F6CBD] text-[#0F6CBD] bg-white font-black'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>화면 및 가독성</span>
          </button>
        </div>

        {/* Tab 1: Profile */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 space-y-6">
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-xs font-bold text-[#0F172A] block mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#0F6CBD]" />
                  <span>소속 학교</span>
                </label>
                <SchoolPicker
                  value={school}
                  onChange={(nextSchool) => { setSchool(nextSchool); setProfileSaved(false); }}
                  disabled={!isLoggedIn}
                  helpText="NEIS 학교 정보에서 찾습니다. 학교 이름과 교육청·학교 코드를 함께 저장합니다."
                />
                {school ? (
                  <p className="mt-1.5 text-xs text-[#64748B]">
                    NEIS 교육청 코드 {school.officeCode} · 학교 코드 {school.schoolCode}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-xs font-bold text-[#0F172A] block mb-1.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#0F6CBD]" />
                  <span>교사 성함</span>
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => { setTeacherName(e.target.value); setProfileSaved(false); }}
                  disabled={!isLoggedIn}
                  placeholder="선생님 성함을 입력하세요"
                  className="w-full border border-[#DCE3EA] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] disabled:bg-[#F6F8FB] disabled:text-[#64748B]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0F172A] block mb-1.5">
                  담당 학년 / 학급 / 직책
                </label>
                <input
                  type="text"
                  value={gradeClass}
                  onChange={(e) => { setGradeClass(e.target.value); setProfileSaved(false); }}
                  disabled={!isLoggedIn}
                  placeholder="예: 3학년 2반 담임"
                  className="w-full border border-[#DCE3EA] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] disabled:bg-[#F6F8FB] disabled:text-[#64748B]"
                />
              </div>
            </div>

            {isLoggedIn && (
              <div className="flex items-center gap-3 pt-4 border-t border-[#F6F8FB]">
                <button
                  type="submit"
                  disabled={!teacherName.trim()}
                  className="bg-[#0F6CBD] hover:bg-[#0F5B9E] text-white font-bold text-xs px-6 py-2.5 rounded-lg shadow-xs transition disabled:cursor-not-allowed disabled:bg-[#AAB7C4]"
                >
                  프로필 저장하기
                </button>
                {profileSaved && (
                  <span role="status" className="text-xs font-bold text-[#16803C] flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>저장되었습니다.</span>
                  </span>
                )}
              </div>
            )}
          </form>
        )}

        {/* Tab 2: Signature */}
        {activeTab === 'signature' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-[#0F172A]">전자서명 및 도장 등록</h3>
              <p className="text-xs text-[#64748B]">
                가정통신문 결재 및 교직원 서명 수합 시 자동으로 합성될 서명 이미지를 관리합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <div className="border border-[#DCE3EA] rounded-xl p-5 text-center space-y-3 bg-[#F6F8FB]">
                <div className="w-16 h-16 rounded-full bg-white border border-[#DCE3EA] flex items-center justify-center mx-auto text-[#0F6CBD]">
                  <FileSignature className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold text-[#0F172A] block">직인 / 직인 도장 이미지</span>
                <button
                  disabled={!isLoggedIn}
                  className="bg-white border border-[#DCE3EA] hover:border-[#0F6CBD] text-[#0F172A] text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 mx-auto disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>PNG 이미지 업로드</span>
                </button>
              </div>

              <div className="border border-[#DCE3EA] rounded-xl p-5 text-center space-y-3 bg-[#F6F8FB]">
                <div className="w-16 h-16 rounded-full bg-white border border-[#DCE3EA] flex items-center justify-center mx-auto text-[#0F6CBD]">
                  <FileSignature className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold text-[#0F172A] block">터치 서명 직접 그리기</span>
                <button
                  disabled={!isLoggedIn}
                  className="bg-white border border-[#DCE3EA] hover:border-[#0F6CBD] text-[#0F172A] text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 mx-auto disabled:opacity-50"
                >
                  <span>캔버스 서명 작성</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Security */}
        {activeTab === 'security' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-4 max-w-lg">
              <h3 className="text-base font-bold text-[#0F172A]">개인정보 보관 및 파기 설정</h3>
              <p className="text-xs text-[#64748B]">
                개인정보보호법에 의거, 수합 완료된 제출 서류 및 개인키의 자동 삭제 기간을 설정합니다.
              </p>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-[#0F172A] block">수합 서류 자동 파기 기간</label>
                <div className="flex gap-3">
                  {[30, 90, 365].map((days) => (
                    <button
                      key={days}
                      onClick={() => setAutoPurgeDays(days)}
                      disabled={!isLoggedIn}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border transition ${
                        autoPurgeDays === days
                          ? 'bg-[#0F6CBD] text-white border-[#0F6CBD]'
                          : 'bg-white text-[#334155] border-[#DCE3EA] hover:bg-[#F6F8FB]'
                      } disabled:opacity-50`}
                    >
                      {days}일 후 자동 파기
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Display */}
        {activeTab === 'display' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-6">
              <h3 className="text-base font-bold text-[#0F172A]">화면 테마 및 가독성 설정</h3>

              <fieldset className="space-y-3">
                <div>
                  <legend className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
                    <Palette className="h-4 w-4 text-[#0F6CBD]" />
                    색상 테마
                  </legend>
                  <p className="mt-1 text-xs text-[#64748B]">
                    화면 구성은 그대로 두고 배경·강조·본문·테두리 색만 바꿉니다.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SCHOOLDOC_THEMES.map((theme) => {
                    const selected = appearance.themeId === theme.id;
                    return (
                      <label
                        key={theme.id}
                        className={`theme-choice relative flex min-h-[72px] cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                          selected
                            ? 'border-[#0F6CBD] bg-[#EFF6FC] shadow-xs'
                            : 'border-[#DCE3EA] bg-white hover:border-[#0F6CBD]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="schooldoc-theme"
                          value={theme.id}
                          checked={selected}
                          onChange={() => setTheme(theme.id)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className="grid h-10 w-10 shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-black/10"
                        >
                          <span style={{ backgroundColor: theme.colors.accent }} />
                          <span style={{ backgroundColor: theme.colors.accentSoft }} />
                          <span style={{ backgroundColor: theme.colors.canvas }} />
                          <span style={{ backgroundColor: theme.colors.text }} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-[#0F172A]">{theme.name}</span>
                          <span className="block truncate text-xs text-[#64748B]">{theme.description}</span>
                        </span>
                        {selected ? <CheckCircle2 aria-label="선택됨" className="h-4 w-4 shrink-0 text-[#0F6CBD]" /> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#DCE3EA] bg-[#F6F8FB] p-4 sm:flex-row sm:items-center">
                <div>
                  <span className="text-sm font-bold text-[#0F172A] block">화면 글자 크기</span>
                  <span className="text-xs text-[#64748B]">교사용 화면의 글자와 줄 간격을 함께 조정합니다.</span>
                </div>
                <div role="group" aria-label="화면 글자 크기" className="flex gap-2">
                  <button
                    type="button"
                    aria-pressed={appearance.fontSize === 'normal'}
                    onClick={() => setFontSize('normal')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${
                      appearance.fontSize === 'normal'
                        ? 'bg-[#0F6CBD] text-white border-[#0F6CBD]'
                        : 'bg-white text-[#334155] border-[#DCE3EA]'
                    }`}
                  >
                    보통
                  </button>
                  <button
                    type="button"
                    aria-pressed={appearance.fontSize === 'large'}
                    onClick={() => setFontSize('large')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${
                      appearance.fontSize === 'large'
                        ? 'bg-[#0F6CBD] text-white border-[#0F6CBD]'
                        : 'bg-white text-[#334155] border-[#DCE3EA]'
                    }`}
                  >
                    크게
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
