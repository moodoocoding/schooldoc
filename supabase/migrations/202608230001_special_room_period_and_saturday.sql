-- 예약표마다 교시 수와 토요일 사용 여부를 정한다.
--
-- 초등은 6교시가 끝인데 7·8교시 두 줄이 늘 비어 있었고, 고등은 방과후와 토요일 모의면접을
-- 잡을 자리가 아예 없었다. 학교마다 시간 구조가 다른데 코드에 1~8교시·월~금이 박혀 있었다.
--
-- 기본값은 지금 동작 그대로다. 이미 만들어진 예약표는 8교시·토요일 없음으로 남는다.

alter table public.special_room_boards
  add column if not exists period_count smallint not null default 8,
  add column if not exists include_saturday boolean not null default false;

alter table public.special_room_boards
  drop constraint if exists special_room_boards_period_count_check;
alter table public.special_room_boards
  add constraint special_room_boards_period_count_check
  check (period_count between 1 and 9);

-- 방과후 8·9교시를 담으려면 예약 쪽 상한도 함께 넓혀야 한다. 좁히는 것이 아니라 넓히는
-- 것이라 기존 자료는 모두 그대로 통과한다.
alter table public.special_room_bookings
  drop constraint if exists special_room_bookings_period_check;
alter table public.special_room_bookings
  add constraint special_room_bookings_period_check
  check (period between 1 and 9);

-- 교시 수를 줄여도 예약은 지우지 않는다. 표에서 보이지 않을 뿐이고 다시 늘리면 나타난다.
-- 지우면 되돌릴 수 없지만 감추면 되돌릴 수 있다.
