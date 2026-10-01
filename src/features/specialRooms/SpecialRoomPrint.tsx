import { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { SpecialRoomWeekGrid } from './SpecialRoomWeekGrid';
import { formatWeekRange } from './specialRoomWeek';
import type { SpecialRoomBoard } from './types';
export function SpecialRoomPrint({
  board,
  roomId,
  mondayKey,
}: {
  board: SpecialRoomBoard;
  roomId: string;
  mondayKey: string;
}) {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  if (!printing) return null;
  return createPortal(
    <section className="special-room-print-root" aria-hidden="true">
      <h1>{board.title}</h1>
      <p>
        {board.rooms.find((r) => r.id === roomId)?.name} ·{' '}
        {formatWeekRange(mondayKey, board.includeSaturday)}
      </p>
      {board.description ? <p>{board.description}</p> : null}
      <SpecialRoomWeekGrid
        mondayKey={mondayKey}
        roomId={roomId}
        periodCount={board.periodCount}
        includeSaturday={board.includeSaturday}
        closures={board.closures}
        bookings={board.bookings}
        schoolDays={board.schoolDays}
        readOnly
      />
      <p>{board.status === 'open' ? '예약 받는 중' : '예약 종료됨'}</p>
    </section>,
    document.body,
  );
}
