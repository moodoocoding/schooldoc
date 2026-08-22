-- 특별실 예약
--
-- 앞선 세 기능과 뼈대는 같다. 담당자만 로그인하고, 예약하는 교사는 공개 토큰으로 들어온다.
-- 다른 점은 두 가지다.
--
-- 1. 개인정보를 담지 않는다. 칸에 들어가는 것은 '6-1반' 같은 학급 이름이지 사람 이름이
--    아니다. 그래서 암호화 컬럼이 없다.
-- 2. 아무나 고치고 지울 수 있다. 공유 시트와 같은 규칙이라 소유권을 칸마다 두지 않는다.
--    대신 중복 예약만 DB가 막는다.

create table if not exists public.special_room_boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_token uuid not null default gen_random_uuid() unique,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  -- 학사일정을 가져올 학교. 넣지 않으면 휴업일 표시 없이 평범한 주간 표가 된다.
  school_name text,
  neis_office_code text,
  neis_school_code text,
  password_digest text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.special_rooms (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.special_room_boards(id) on delete cascade,
  position smallint not null check (position between 0 and 49),
  name text not null check (char_length(name) between 1 and 60),
  location text not null default '' check (char_length(location) <= 60),
  unique (board_id, position)
);

create table if not exists public.special_room_bookings (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.special_room_boards(id) on delete cascade,
  room_id uuid not null references public.special_rooms(id) on delete cascade,
  booking_date date not null,
  period smallint not null check (period between 1 and 8),
  label text not null check (char_length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 이 한 줄이 동시 예약을 막는다. 교시가 이산값이라 시간 범위보다 훨씬 간단하다.
  -- 두 사람이 같은 순간에 눌러도 하나만 성립하고 진 쪽은 23505를 받는다.
  unique (room_id, booking_date, period)
);

-- NEIS에서 한 번 받아 두는 학사일정. 화면을 열 때마다 부르지 않는다.
-- NEIS가 죽어도 예약은 그대로 되어야 하므로 여기에 남겨 둔다.
create table if not exists public.special_room_school_days (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.special_room_boards(id) on delete cascade,
  day date not null,
  event_name text not null default '',
  is_off_day boolean not null default false,
  fetched_at timestamptz not null default now(),
  unique (board_id, day, event_name)
);

create index if not exists special_room_boards_owner_idx
  on public.special_room_boards(owner_id, updated_at desc);
create index if not exists special_room_bookings_week_idx
  on public.special_room_bookings(board_id, booking_date);
create index if not exists special_room_school_days_idx
  on public.special_room_school_days(board_id, day);

-- 수정 시각 자동 갱신
create or replace function public.touch_special_room_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists special_room_boards_touch on public.special_room_boards;
create trigger special_room_boards_touch
  before update on public.special_room_boards
  for each row execute function public.touch_special_room_updated_at();

drop trigger if exists special_room_bookings_touch on public.special_room_bookings;
create trigger special_room_bookings_touch
  before update on public.special_room_bookings
  for each row execute function public.touch_special_room_updated_at();

alter table public.special_room_boards enable row level security;
alter table public.special_rooms enable row level security;
alter table public.special_room_bookings enable row level security;
alter table public.special_room_school_days enable row level security;

-- 담당자는 자기 예약판을 관리한다.
create policy "owners manage special room boards"
on public.special_room_boards for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners manage special rooms"
on public.special_rooms for all
to authenticated
using (exists (
  select 1 from public.special_room_boards as board
  where board.id = special_rooms.board_id and board.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.special_room_boards as board
  where board.id = special_rooms.board_id and board.owner_id = auth.uid()
));

-- 예약은 공개 함수(service_role)만 쓴다. 브라우저가 직접 고치지 못하게 읽기만 연다.
create policy "owners read special room bookings"
on public.special_room_bookings for select
to authenticated
using (exists (
  select 1 from public.special_room_boards as board
  where board.id = special_room_bookings.board_id and board.owner_id = auth.uid()
));

create policy "owners read special room school days"
on public.special_room_school_days for select
to authenticated
using (exists (
  select 1 from public.special_room_boards as board
  where board.id = special_room_school_days.board_id and board.owner_id = auth.uid()
));

-- 공개 함수의 요청 제한. 등록부와 같은 구조를 쓴다.
create table if not exists public.special_room_rate_limits (
  request_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);

alter table public.special_room_rate_limits enable row level security;

create or replace function public.consume_special_room_rate_limit(
  p_request_key text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  insert into public.special_room_rate_limits (request_key, window_started_at, request_count)
  values (p_request_key, now(), 1)
  on conflict (request_key) do update
    set request_count = case
          when public.special_room_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
            then 1
          else public.special_room_rate_limits.request_count + 1
        end,
        window_started_at = case
          when public.special_room_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
            then now()
          else public.special_room_rate_limits.window_started_at
        end
  returning request_count into current_count;

  return current_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_special_room_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_special_room_rate_limit(text, integer, integer) to service_role;

create or replace function public.verify_special_room_password(p_board_id uuid, p_password text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select password_digest = crypt(p_password, password_digest)
     from public.special_room_boards where id = p_board_id),
    false
  );
$$;

revoke all on function public.verify_special_room_password(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_special_room_password(uuid, text) to service_role;

create or replace function public.hash_special_room_password(p_password text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select crypt(p_password, gen_salt('bf', 10));
$$;

revoke all on function public.hash_special_room_password(text) from public, anon;
grant execute on function public.hash_special_room_password(text) to authenticated, service_role;

-- 담당자 화면이 다른 사람의 예약을 바로 보도록 실시간을 켠다.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'special_room_bookings'
  ) then
    alter publication supabase_realtime add table public.special_room_bookings;
  end if;
end;
$$;
