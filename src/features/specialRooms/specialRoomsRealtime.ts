import { createClient } from '@supabase/supabase-js';
import {
  koreanDate,
  weekStart,
} from '../../../supabase/functions/_shared/specialRooms';
import { supabase } from '../../utils/supabaseClient';
import type { SpecialRoomBoard, SpecialRoomBooking } from './types';
export interface CellEvent {
  scopeRevision: number;
  roomId: string;
  weekStart: string;
  upserts: SpecialRoomBooking[];
  deletedIds: string[];
  operationId?: string;
}
/** 버전이 누락되면 스냅샷을 조회한다. 내 이벤트도 같은 버전 규칙을 따른다. */
export function applyCellEvent(
  board: SpecialRoomBoard,
  event: CellEvent,
): { board: SpecialRoomBoard; gap: boolean } {
  if (
    event.roomId !== board.selectedRoomId ||
    event.weekStart !== board.weekStart
  )
    return { board, gap: false };
  const current = board.scopeRevision ?? 0;
  if (
    !Number.isSafeInteger(event.scopeRevision) ||
    !Array.isArray(event.upserts) ||
    !Array.isArray(event.deletedIds)
  )
    return { board, gap: true };
  if (event.scopeRevision <= current) return { board, gap: false };
  if (event.scopeRevision !== current + 1) return { board, gap: true };
  if (
    event.upserts.some(
      (b) =>
        b.roomId !== event.roomId ||
        b.date < event.weekStart ||
        b.date >
          new Date(Date.parse(event.weekStart) + 5 * 86400000)
            .toISOString()
            .slice(0, 10),
    )
  )
    return { board, gap: true };
  const bookings = board.bookings.filter(
    (b) =>
      !event.deletedIds.includes(b.id) &&
      !event.upserts.some((n) => n.date === b.date && n.period === b.period),
  );
  const nextBookings = [...bookings, ...event.upserts];
  const visibleCount = (rows: SpecialRoomBooking[]) =>
    rows.filter(
      (b) =>
        board.includeSaturday ||
        new Date(b.date + 'T00:00:00Z').getUTCDay() !== 6,
    ).length;
  const count = board.thisWeekBookingCount;
  return {
    board: {
      ...board,
      thisWeekBookingCount:
        count !== undefined && event.weekStart === weekStart(koreanDate())
          ? count + visibleCount(nextBookings) - visibleCount(board.bookings)
          : count,
      bookings: nextBookings,
      scopeRevision: event.scopeRevision,
    },
    gap: false,
  };
}
export function subscribeScope(
  board: SpecialRoomBoard,
  notification: { token: string; expiresAt: number } | null | undefined,
  owner: boolean,
  onCells: (event: CellEvent) => void,
  onMetadata: (kind: string) => void,
  onStatus: (status: string) => void,
) {
  const client = owner
    ? supabase
    : notification
      ? createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
            accessToken: async () => notification.token,
          },
        )
      : null;
  if (!client) {
    onStatus('UNAVAILABLE');
    return () => {};
  }
  let disposed = false;
  let connected = 0;
  const prefix = `sr:${board.id}:${board.accessEpoch}:`;
  const channels = [
    client
      .channel(prefix + 'meta', { config: { private: true } })
      .on('broadcast', { event: 'metadata' }, ({ payload }) =>
        onMetadata(payload.kind),
      ),
    client
      .channel(prefix + `week:${board.selectedRoomId}:${board.weekStart}`, {
        config: { private: true },
      })
      .on('broadcast', { event: 'cells' }, ({ payload }) =>
        onCells(payload as CellEvent),
      ),
  ];
  const seen = new Set<number>();
  channels.forEach((channel, index) =>
    channel.subscribe((status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        seen.add(index);
        connected = seen.size;
        if (connected === 2) onStatus('SUBSCRIBED');
      } else {
        seen.delete(index);
        onStatus(status);
      }
    }),
  );
  return () => {
    disposed = true;
    channels.forEach((channel) => {
      void client.removeChannel(channel);
    });
    if (!owner) client.realtime.disconnect();
  };
}
