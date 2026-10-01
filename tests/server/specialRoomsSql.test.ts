// 실제 PostgreSQL 엔진(PGlite)에서 SQL 실행. 다중 연결 잠금/원격 Realtime 검증은 별도이다.
import { PGlite } from 'npm:@electric-sql/pglite@0.5.8';
const assert = (v: unknown, m = 'SQL assertion failed') => {
  if (!v) throw new Error(m);
};
const owner = '10000000-0000-4000-8000-000000000001';
const board = '20000000-0000-4000-8000-000000000001';
const room = '30000000-0000-4000-8000-000000000001';
const token = '40000000-0000-4000-8000-000000000001';
Deno.test('special rooms PostgreSQL migration and atomic contracts', async (t) => {
  const db = await PGlite.create();
  try {
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
    for (
      const file of [
        '202608210002_special_room_reservation.sql',
        '202608230001_special_room_period_and_saturday.sql',
        '202608230002_special_room_closure.sql',
        '202610010600_special_room_scoped_sync.sql',
      ]
    ) {
      let sql = await Deno.readTextFile(
        new URL('../../supabase/migrations/' + file, import.meta.url),
      );
      if (file === '202608210002_special_room_reservation.sql') {
        sql = sql.slice(
          0,
          sql.indexOf('-- 담당자 화면이 다른 사람의 예약을 바로 보도록'),
        );
      }
      await t.step('apply ' + file, async () => {
        await db.exec(sql);
      });
    }
    await db.exec(
      `grant all on all tables in schema public,realtime to service_role; grant select,insert,update,delete on public.special_room_boards,public.special_rooms,public.special_room_closures to authenticated;
      grant select on special_room_bookings,special_room_school_days,realtime.messages to authenticated;
      insert into special_room_boards(id,owner_id,public_token,title,period_count,include_saturday) values('${board}','${owner}','${token}','가상 예약표',9,true);
      insert into special_rooms(id,board_id,position,name) values('${room}','${board}',0,'과학실');`,
    );
    const request = async (body: Record<string, unknown>, key = 'test') =>
      (await db.query<{ result: Record<string, any> }>(
        'select special_room_public_request($1::jsonb,$2) result',
        [JSON.stringify({ token, roomId: room, ...body }), key],
      )).rows[0].result;
    const create = {
      action: 'setBooking',
      date: '2026-10-05',
      period: 9,
      label: '6학년1반',
      expected: null,
      operationId: crypto.randomUUID(),
    };
    await t.step('9교시 생성과 빈 칸 CAS', async () => {
      const ok = await request(create);
      assert(ok.status === 200, JSON.stringify(ok));
      assert(ok.booking.revision === 1);
      const conflict = await request({
        ...create,
        operationId: crypto.randomUUID(),
        label: '다른 학급',
      });
      assert(conflict.status === 409 && conflict.current.id === ok.booking.id);
      const count = (await db.query<{ request_count: number }>(
        'select request_count from special_room_rate_limits where request_key=$1',
        ['test'],
      )).rows[0].request_count;
      assert(count === 2, 'conflict must keep limiter write');
      const update = await request({
        ...create,
        label: '수정 학급',
        operationId: crypto.randomUUID(),
        expected: { id: ok.booking.id, revision: 1 },
      });
      assert(
        update.status === 200 && update.booking.revision === 2,
        JSON.stringify(update),
      );
      const stale = await request({
        ...create,
        action: 'clearBooking',
        expected: { id: ok.booking.id, revision: 1 },
      });
      assert(stale.status === 409);
      const noOp = await request({
        ...create,
        label: '수정 학급',
        expected: { id: ok.booking.id, revision: 2 },
      });
      assert(noOp.scopeRevision === update.scopeRevision);
    });
    await t.step('selected scope snapshot and real event rows', async () => {
      const snapshot = await request({ action: 'week', from: '2026-10-05' });
      assert(snapshot.status === 200, JSON.stringify(snapshot));
      assert(snapshot.board.bookings.length === 1);
      assert(snapshot.board.scopeRevision === 2);
      const metadata = await request({action:'metadata'});assert(metadata.board.rooms.length===1 && metadata.board.hasPassword===false && !Object.hasOwn(metadata.board,'bookings'),'legacy metadata');
      const legacy = await request({action:'week',from:'2026-10-05',to:'2026-10-10',legacyWeek:true});assert(legacy.bookings.length===1 && legacy.schoolDays.length===0,'legacy week response');
      const events = (await db.query<{ payload: any; private: boolean }>(
        "select payload,private from realtime.messages where event='cells'",
      )).rows;
      assert(events.length === 2 && events.every((e) => e.private));
      assert(events[1].payload.upserts[0].revision === 2);
      const known = {
        scopeRevision: 2,
        metadataRevision: snapshot.board.metadataRevision,
        calendarRevision: snapshot.board.calendarRevision,
      };
      const conditional = await request({
        action: 'week',
        from: '2026-10-05',
        known,
      });
      assert(
        conditional.unchanged === true && conditional.board.bookings === null,
      );
    });
    await t.step('repeat counts and same operation replay', async () => {
      const body = {
        action: 'setRepeat',
        date: '2026-10-05',
        period: 9,
        label: '반복 학급',
        until: '2026-10-26',
        operationId: crypto.randomUUID(),
      };
      const result = await request(body);
      assert(result.status === 200, JSON.stringify(result));
      assert(result.created.length === 3 && result.skippedTaken.length === 1);
      const replay = await request(body);
      assert(JSON.stringify(replay) === JSON.stringify(result));
    });

    await t.step(
      'settings, closed repeat, hidden record correction and closure guard',
      async () => {
        await db.exec(
          `update special_room_boards set period_count=4,include_saturday=false where id='${board}';`,
        );
        const invalid = await request({
          ...create,
          date: '2026-10-10',
          expected: null,
          operationId: crypto.randomUUID(),
        });
        assert(invalid.status === 400);
        const current =
          (await request({ action: 'week', from: '2026-10-05' })).board
            .bookings[0];
        const corrected = await request({
          ...create,
          label: '숨겨진 기록 정정',
          operationId: crypto.randomUUID(),
          expected: { id: current.id, revision: current.revision },
        });
        assert(corrected.status === 200);
        await db.exec(
          `update special_room_boards set status='closed' where id='${board}';`,
        );
        assert(
          (await request({
            action: 'setRepeat',
            date: '2026-10-05',
            period: 1,
            label: '종료',
            until: '2026-10-12',
            operationId: crypto.randomUUID(),
          })).status === 409,
        );
        await db.exec(
          `update special_room_boards set status='open' where id='${board}'; insert into special_room_closures(board_id,room_id,start_date,end_date,reason) values('${board}','${room}','2026-10-06','2026-10-06','가상 점검');`,
        );
        assert(
          (await request({
            ...create,
            date: '2026-10-06',
            period: 1,
            operationId: crypto.randomUUID(),
          })).status === 409,
        );
      },
    );
    await t.step(
      'calendar transaction diff/no-op/rollback/source check',
      async () => {
        await db.exec(
          `update special_room_boards set neis_office_code='B10',neis_school_code='school-a',school_name='가상 학교' where id='${board}';`,
        );
        const sync = (days: unknown[]) =>
          db.query<{ result: any }>(
            'select sync_special_room_school_days($1,$2,$3,$4,$5::date,$6::date,$7::jsonb) result',
            [
              board,
              owner,
              'B10',
              'school-a',
              '2026-10-01',
              '2026-10-31',
              JSON.stringify(days),
            ],
          );
        const days = [{
          day: '2026-10-05',
          event_name: '가상 휴업',
          is_off_day: true,
        }];
        assert((await sync(days)).rows[0].result.changed === 1);
        const revision = (await db.query<{ calendar_revision: number }>(
          'select calendar_revision from special_room_boards where id=$1',
          [board],
        )).rows[0].calendar_revision;
        const messages = (await db.query<{ count: number }>(
          'select count(*)::int count from realtime.messages',
        )).rows[0].count;
        assert((await sync(days)).rows[0].result.changed === 0);
        assert(
          (await db.query<{ count: number }>(
            'select count(*)::int count from realtime.messages',
          )).rows[0].count === messages,
        );
        await db.exec(
          `alter table special_room_school_days add constraint reject_synthetic_event check(event_name<>'가상 실패');`,
        );
        let failed = false;
        try {
          await sync([{
            day: '2026-10-06',
            event_name: '가상 실패',
            is_off_day: true,
          }]);
        } catch {
          failed = true;
        }
        assert(failed);
        assert(
          (await db.query<{ calendar_revision: number }>(
            'select calendar_revision from special_room_boards where id=$1',
            [board],
          )).rows[0].calendar_revision === revision,
        );
        assert(
          (await request({ action: 'week', from: '2026-10-05' })).board
            .schoolDays.length === 1,
        );
        await db.exec(
          `update special_room_boards set neis_school_code='school-b' where id='${board}';`,
        );
        assert(
          (await request({ action: 'week', from: '2026-10-05' })).board
            .schoolDays.length === 0,
          'old school events must not show for new school',
        );
        assert((await sync(days)).rows[0].result.status === 409);
        assert(
          (await db.query<{ count: number }>(
            'select count(*)::int count from special_room_school_days',
          )).rows[0].count === 1,
          'stored history is preserved',
        );
      },
    );
    await t.step(
      'owner summaries, private topic claims, direct viewer denial',
      async () => {
        await db.exec(
          `set role authenticated; set request.jwt.claim.sub='${owner}';`,
        );
        const summaries = (await db.query<{ result: any }>(
          'select list_special_room_summaries() result',
        )).rows[0].result;
        assert(
          summaries.items.length === 1 && summaries.items[0].bookingCount === 4,
        );
        assert(!('bookings' in summaries.items[0]));
        const snapshot = (await db.query<{ result: any }>(
          'select get_special_room_owner_scope($1,$2,$3::date) result',
          [board, room, '2026-10-05'],
        )).rows[0].result;
        for (
          const key of [
            'id',
            'title',
            'periodCount',
            'includeSaturday',
            'bookings',
            'schoolDays',
            'closures',
            'rooms',
            'scopeRevision',
            'metadataRevision',
            'calendarRevision',
            'accessEpoch',
          ]
        ) assert(Object.hasOwn(snapshot.board, key), 'missing snapshot ' + key);
        for (
          const key of [
            'password',
            'passwordDigest',
            'password_digest',
            'ownerId',
            'owner_id',
          ]
        ) assert(!Object.hasOwn(snapshot.board, key), 'private field ' + key);
        await db.exec('reset role');
        const epoch = snapshot.board.accessEpoch;
        const topic = 'sr:' + board + ':' + epoch + ':week:' + room +
          ':2026-10-05';
        const claims = {
          sub: crypto.randomUUID(),
          role: 'special_room_viewer',
          sr_board: board,
          sr_epoch: String(epoch),
          exp: Math.floor(Date.now() / 1000) + 900,
        };
        await db.query(
          "select set_config('request.jwt.claims',$1,false),set_config('request.jwt.claim.sub',$2,false),set_config('realtime.topic',$3,false)",
          [JSON.stringify(claims), claims.sub, topic],
        );
        await db.exec("insert into realtime.messages(topic,event,payload,private) values('other-feature:private','cells','{}',true); set role special_room_viewer");
        assert((await db.query<{count:number}>("select count(*)::int count from realtime.messages where topic='other-feature:private'")).rows[0].count===0, 'viewer cannot read other feature rows');
        assert(
          (await db.query<{ ok: boolean }>(
            'select can_receive_special_room_topic($1) ok',
            [topic],
          )).rows[0].ok,
        );
        assert(
          !(await db.query<{ ok: boolean }>(
            'select can_receive_special_room_topic($1) ok',
            ['sr:' + board + ':999:meta'],
          )).rows[0].ok,
        );
        assert(
          !(await db.query<{ ok: boolean }>(
            'select can_receive_special_room_topic($1) ok',
            [
              'sr:' + board + ':' + epoch +
              ':week:50000000-0000-4000-8000-000000000001:2026-10-05',
            ],
          )).rows[0].ok,
        );
        for (
          const sql of [
            'select * from special_room_bookings',
            'select * from special_room_week_state',
            "select special_room_public_request('{}','bypass')",
            'select list_special_room_summaries()',
            "insert into realtime.messages(topic) values('sr:any')",
          ]
        ) {
          let denied = false;
          try {
            await db.exec(sql);
          } catch {
            denied = true;
          }
          assert(denied, 'viewer denied: ' + sql);
        }
        await db.exec('reset role');
        // 제한 조건이 특별실 이외의 주제와 topic 없는 조회를 제한하지 않는지 실제 SQL truth table로 확인한다.
        for (const topic of ['other-feature:board', '', null]) {
          assert(
            (await db.query<{ ok: boolean }>(
              "select coalesce($1::text,'') not like 'sr:%' as ok",
              [topic],
            )).rows[0].ok,
          );
        }
        await db.exec(
          `set role authenticated; set request.jwt.claim.sub='60000000-0000-4000-8000-000000000001';`,
        );
        assert(
          (await db.query<{ result: any }>(
            'select list_special_room_summaries() result',
          )).rows[0].result.items.length === 0,
        );
        let denied = false;
        try {
          await db.query(
            'select get_special_room_owner_scope($1,$2,$3::date)',
            [board, room, '2026-10-05'],
          );
        } catch {
          denied = true;
        }
        assert(denied);
        await db.exec('reset role');
        await db.query("select set_config('request.jwt.claims',$1,false)", [
          JSON.stringify({
            role: 'authenticated',
            sub: '60000000-0000-4000-8000-000000000001',
          }),
        ]);
        await db.exec(
          `create policy synthetic_other_feature_receive on realtime.messages for select to authenticated using(true);
        create policy synthetic_sr_scope_guard on realtime.messages as restrictive for select to authenticated using(coalesce(topic,realtime.topic(),'') not like 'sr:%' or can_receive_special_room_topic(coalesce(topic,realtime.topic())));
        insert into realtime.messages(topic,event,payload,private) values('other-feature:board','test','{}',true);
        set role authenticated;`,
        );
        assert(
          (await db.query<{ count: number }>(
            "select count(*)::int count from realtime.messages where topic='other-feature:board'",
          )).rows[0].count === 1,
          'other feature stays allowed',
        );
        assert(
          (await db.query<{ count: number }>(
            "select count(*)::int count from realtime.messages where topic like 'sr:%'",
          )).rows[0].count === 0,
          'broad existing policy must not grant foreign special room',
        );
        await db.exec('reset role');
      },
    );
  } finally {
    await db.close();
  }
});
