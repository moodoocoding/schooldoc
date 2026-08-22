import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { insertRowAfter, isRowAddKey } from '../../utils/rowEntry';
import { isSpecialRoomsDemoMode } from './specialRoomsConfig';
import { SchoolPicker } from './SchoolPicker';
import { mondayOf, toDateKey } from './specialRoomWeek';
import * as service from './specialRoomsService';
import type { SelectedSchool } from './types';

const inputClass = 'min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm';

export function SpecialRoomsCreatePage() {
  const navigate = useNavigate();
  const { user } = useTeacherAuth();
  const ownerId = user?.id ?? (isSpecialRoomsDemoMode ? 'local-demo-teacher' : '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [school, setSchool] = useState<SelectedSchool | null>(null);
  const [password, setPassword] = useState('');
  const [rooms, setRooms] = useState([{ name: '', location: '' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [focusRoom, setFocusRoom] = useState(-1);

  // 엔터로 끼운 줄에 곧바로 이어 적을 수 있어야 한다.
  useEffect(() => {
    if (focusRoom < 0) return;
    document.querySelector<HTMLInputElement>(`input[aria-label="${focusRoom + 1}번 특별실 이름"]`)?.focus();
    setFocusRoom(-1);
  }, [focusRoom]);

  /** 목록 칸의 엔터는 폼을 보내지 않고 줄을 더한다. `utils/rowEntry` 참고. */
  const onRoomKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isRowAddKey(event)) return;
    event.preventDefault();
    // 빈 줄에서 또 누르면 빈 줄만 쌓인다. 제출만 막고 둔다.
    if (!rooms[index].name.trim()) return;
    setRooms((current) => insertRowAfter(current, index, () => ({ name: '', location: '' })));
    setFocusRoom(index + 1);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ownerId || saving) return;
    if (!title.trim()) { setError('예약판 이름을 입력해 주세요.'); return; }
    const filled = rooms.filter((room) => room.name.trim());
    if (filled.length === 0) { setError('특별실을 한 곳 이상 입력해 주세요.'); return; }

    setSaving(true);
    setError('');
    try {
      const created = await service.createBoard(ownerId, { title, description, school, password, rooms: filled });
      // 학교를 고른 이유가 학사일정이므로 만드는 김에 같이 받아 둔다. 실패해도 예약판은
      // 살리고, 관리 화면에서 무엇을 다시 해야 하는지 알린다.
      const outcome = school && !isSpecialRoomsDemoMode
        ? await service.linkSchoolAndSyncDays(created.id, school, mondayOf(toDateKey(new Date())))
        : null;
      navigate(`/tools/special-rooms/${created.id}`, {
        state: outcome ? { schoolNotice: outcome.notice, schoolError: outcome.error } : undefined,
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '예약판을 만들지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto w-full max-w-3xl space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-4">
        <button type="button" onClick={() => navigate('/tools/special-rooms')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:text-[#0F6CBD]">
          <ArrowLeft className="h-5 w-5" />목록으로
        </button>
      </div>

      <div>
        <p className="text-xs font-bold text-[#0F6CBD]">새 예약판</p>
        <h1 className="mt-1 text-2xl font-extrabold">특별실과 안내를 입력하세요</h1>
      </div>

      {error ? <p role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]"><AlertCircle className="mr-1 inline h-4 w-4" />{error}</p> : null}

      <section className="grid gap-4 border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
        <label className="grid gap-2 text-sm font-bold text-[#334155]">예약판 이름
          <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 2학기 특별실 예약" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-[#334155]">안내 문구
          <input className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="예: 사용 후 정리 부탁드립니다" />
        </label>
        <div className="grid gap-2 text-sm font-bold text-[#334155]">
          학교
          <SchoolPicker value={school} onChange={setSchool} />
        </div>
        <label className="grid gap-2 text-sm font-bold text-[#334155]">공개 비밀번호 <span className="font-normal text-[#64748B]">(비워 두면 링크만으로 열립니다)</span>
          <input className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
      </section>

      <section className="border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">특별실</h2>
          <button type="button" onClick={() => setRooms((current) => [...current, { name: '', location: '' }])} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD]">
            <Plus className="h-4 w-4" />특별실 추가
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {rooms.map((room, index) => (
            <div key={index} className="flex gap-2">
              <input className={inputClass} value={room.name} aria-label={`${index + 1}번 특별실 이름`} placeholder="과학실" onKeyDown={onRoomKeyDown(index)} onChange={(event) => setRooms((current) => current.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry))} />
              <input className={inputClass} value={room.location} aria-label={`${index + 1}번 특별실 위치`} placeholder="본관 3층" onKeyDown={onRoomKeyDown(index)} onChange={(event) => setRooms((current) => current.map((entry, i) => i === index ? { ...entry, location: event.target.value } : entry))} />
              <button type="button" disabled={rooms.length === 1} onClick={() => setRooms((current) => current.filter((_, i) => i !== index))} aria-label={`${index + 1}번 특별실 삭제`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#B42318] disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <button type="submit" disabled={saving} className="min-h-[52px] w-full rounded-lg bg-[#0F6CBD] text-base font-bold text-white disabled:bg-[#AAB7C4]">
        {saving ? '만드는 중' : '예약판 만들기'}
      </button>
    </form>
  );
}
