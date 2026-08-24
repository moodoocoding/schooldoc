-- 특별실 휴관.
--
-- 담당 교사가 출장이나 연가로 자리를 비우면 그 특별실을 쓸 수 없다. 시설 점검이나 시험
-- 기간에도 막아야 한다. 그런데 지금은 그것을 표현할 방법이 없어서, 담당자가 그날 칸을
-- 하나씩 `출장`이라고 채우는 수밖에 없었다. 8교시면 여덟 칸이고, 그것도 예약으로 보일 뿐
-- 누구나 지울 수 있어 막은 것이 되지 못한다.
--
-- 학사일정(`special_room_school_days`)과 나누는 이유는 출처와 범위가 다르기 때문이다.
-- 학사일정은 NEIS에서 받아 학교 전체에 걸리고, 휴관은 담당자가 특별실 하나에 건다.

create table if not exists public.special_room_closures (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.special_room_boards(id) on delete cascade,
  -- 비우면 그 예약표의 모든 특별실이 닫힌다. 시험 기간처럼 전체를 막을 때 쓴다.
  room_id uuid references public.special_rooms(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null default '' check (char_length(reason) <= 40),
  created_at timestamptz not null default now(),
  constraint special_room_closures_period_check check (end_date >= start_date)
);

create index if not exists special_room_closures_board_idx
  on public.special_room_closures(board_id, start_date);

alter table public.special_room_closures enable row level security;

-- 담당자만 건다. 공개 화면에서 풀 수 있으면 막은 것이 되지 못한다.
-- 공개 화면은 엣지 함수가 service role로 읽어 내려보낸다.
create policy "owners manage special room closures"
on public.special_room_closures for all
to authenticated
using (exists (
  select 1 from public.special_room_boards board
  where board.id = special_room_closures.board_id and board.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.special_room_boards board
  where board.id = special_room_closures.board_id and board.owner_id = auth.uid()
));
