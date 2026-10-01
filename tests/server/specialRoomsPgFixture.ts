// 로컬 HTTP 검증 전용 실제 PGlite. pgcrypto/Realtime 서비스는 SQL 시험용 adapter로 표시한다.
import { PGlite } from 'npm:@electric-sql/pglite@0.5.8';
const owner = '10000000-0000-4000-8000-000000000001';
const board = '20000000-0000-4000-8000-000000000001';
const room = '30000000-0000-4000-8000-000000000001';
const token = '40000000-0000-4000-8000-000000000001';
export async function createSpecialRoomPg() {
  const db = await PGlite.create();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions; create schema realtime;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function extensions.crypt(text,text) returns text language sql immutable as $$ select $1 $$;
    create function extensions.gen_salt(text,int) returns text language sql immutable as $$ select 'test-only'::text $$;
    create table realtime.messages(id uuid default gen_random_uuid(),topic text,event text,payload jsonb,extension text default 'broadcast',private boolean);
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ insert into realtime.messages(topic,event,payload,private) values($3,$2,$1,$4) $$;
    grant usage on schema public,auth,realtime,extensions to anon,authenticated,service_role;
    insert into auth.users values('${owner}');`,
  );
  for (const file of [
    '202608210002_special_room_reservation.sql',
    '202608230001_special_room_period_and_saturday.sql',
    '202608230002_special_room_closure.sql',
    '202610010600_special_room_scoped_sync.sql',
  ]) {
    let sql = await Deno.readTextFile(
      new URL('../../supabase/migrations/' + file, import.meta.url),
    );
    if (file === '202608210002_special_room_reservation.sql') {
      sql = sql.slice(
        0,
        sql.indexOf('-- 담당자 화면이 다른 사람의 예약을 바로 보도록'),
      );
    }
    await db.exec(sql);
  }
  await db.exec(
    `grant all on all tables in schema public,realtime to service_role; grant select,insert,update,delete on public.special_room_boards,public.special_rooms,public.special_room_closures to authenticated;
      grant select on special_room_bookings,special_room_school_days,realtime.messages to authenticated;
      insert into special_room_boards(id,owner_id,public_token,title,period_count,include_saturday) values('${board}','${owner}','${token}','가상 예약표',9,true);
      insert into special_rooms(id,board_id,position,name) values('${room}','${board}',0,'과학실');`,
  );
  return { db, owner, board, room, token };
}
