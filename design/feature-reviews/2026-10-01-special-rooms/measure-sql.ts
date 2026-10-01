// 실제 PostgreSQL 실행계획·논리 DML 계측. 로컬 WASM 엔진의 수치를 원격 IOPS/WAL로 해석하지 않는다.
import { createSpecialRoomPg } from '../../../tests/server/specialRoomsPgFixture.ts';
const {db,board,room,token,owner}=await createSpecialRoomPg();
const out=new URL('./implementation-evidence/sql-measurements.json',import.meta.url);
const report:Record<string,unknown>={engine:'PGlite PostgreSQL; in-memory WASM; synthetic data',limits:'pgcrypto and realtime.send adapters; physical disk IOPS, remote WAL, multi-connection locks and Realtime delivery are not measured',scenarios:[]};
const assert=(v:unknown,m:string)=>{if(!v)throw new Error(m);};
try{
 const explain=async(sql:string)=>(await db.query('explain (analyze,buffers,format json) '+sql)).rows[0];
 for(const size of [1,3,50]){
  await db.query(`insert into special_rooms(id,board_id,position,name) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1,n-1,'가상 특별실 '||n from generate_series(2,$2) n on conflict(id) do nothing`,[board,size]);
  await db.query(`insert into special_room_bookings(board_id,room_id,booking_date,period,label) select $1,r.id,'2026-10-05'::date+n*7,1,'가상 주간 학급' from special_rooms r cross join generate_series(-25,26) n where r.board_id=$1 on conflict(room_id,booking_date,period) do nothing`,[board]);
  await db.query(`insert into special_room_bookings(board_id,room_id,booking_date,period,label) select $1,r.id,'2026-10-05'::date+d,p,'가상 대표 학급' from special_rooms r cross join generate_series(0,5) d cross join generate_series(1,9) p where r.board_id=$1 on conflict(room_id,booking_date,period) do nothing`,[board]);
  await db.exec('analyze special_room_bookings; analyze special_rooms; analyze special_room_week_state;');
  const oldPublic=`select id,room_id,booking_date,period,label,updated_at from special_room_bookings where board_id='${board}' and booking_date between '2026-10-05' and '2026-10-10'`;
  const oldOwner=`select id,board_id,room_id,booking_date,period,label,updated_at from special_room_bookings where board_id='${board}'`;
  const snapshot=(await db.query<{data:any}>('select special_room_snapshot($1,$2,$3) data',[board,room,'2026-10-05'])).rows[0].data;
  const oldRows=(await db.query(oldPublic)).rows;const ownerRows=(await db.query(oldOwner)).rows;
  const source=(await db.query<{prosrc:string}>("select prosrc from pg_proc where proname='special_room_snapshot'")).rows[0].prosrc;
  const inline=(known:string)=>source.replace(/\bp_board\b/g,`'${board}'::uuid`).replace(/\bp_room\b/g,`'${room}'::uuid`).replace(/\bp_week\b/g,"'2026-10-05'::date").replace(/\bp_known\b/g,`'${known}'::jsonb`).replace(/\bp_owner\b/g,'false');
  const known={scopeRevision:snapshot.board.scopeRevision,metadataRevision:snapshot.board.metadataRevision,calendarRevision:snapshot.board.calendarRevision};
  assert(snapshot.board.bookings.length===54,'scope must be bounded at 54');
  (report.scenarios as unknown[]).push({rooms:size,weeks:52,oldPublicBookingRows:oldRows.length,newBookingRows:snapshot.board.bookings.length,oldOwnerBookingRows:ownerRows.length,oldPublicRowBytes:new TextEncoder().encode(JSON.stringify(oldRows)).length,newSnapshotBytes:new TextEncoder().encode(JSON.stringify(snapshot)).length,plans:{oldPublic:await explain(oldPublic),oldOwner:await explain(oldOwner),snapshotInternalSql:await explain(inline('{}')),unchangedInternalSql:await explain(inline(JSON.stringify(known)))}});
 }
 // 감사 트리거는 이 독립 시험 DB에만 설치하며 실제 변경된 논리 행을 센다.
 await db.exec(`create table test_dml(table_name text,action text);create function test_count_dml() returns trigger language plpgsql as $$begin insert into test_dml values(TG_TABLE_NAME,TG_OP);return null;end$$;`);
 for(const table of ['special_room_bookings','special_room_week_state','special_room_boards','special_room_rate_limits','special_room_repeat_operations','realtime.messages'])await db.exec(`create trigger test_dml after insert or update or delete on ${table} for each row execute function test_count_dml();`);
 const rpc=async(body:unknown)=>(await db.query<{result:any}>('select special_room_public_request($1::jsonb,$2) result',[JSON.stringify({token,roomId:room,...body as object}),'benchmark'])).rows[0].result;
 const counts=async()=>(await db.query('select table_name,action,count(*)::int rows from test_dml group by table_name,action order by table_name,action')).rows;
 const single={action:'setBooking',date:'2028-01-03',period:9,label:'가상 단일 예약',expected:null,operationId:crypto.randomUUID()};
 const saved=await rpc(single);assert(saved.status===200,'single save');const saveDml=await counts();await db.exec('truncate test_dml');
 const replay=await rpc(single);assert(replay.booking.id===saved.booking.id&&replay.booking.revision===saved.booking.revision,'single replay');const replayDml=await counts();await db.exec('truncate test_dml');
 const noOp=await rpc({...single,operationId:crypto.randomUUID(),expected:{id:saved.booking.id,revision:saved.booking.revision}});assert(noOp.scopeRevision===saved.scopeRevision,'no-op version');const noOpDml=await counts();await db.exec('truncate test_dml');
 const repeat={action:'setRepeat',date:'2028-02-07',period:9,label:'가상 52주 반복',until:'2029-01-29',operationId:crypto.randomUUID()};
 const repeated=await rpc(repeat);assert(repeated.status===200&&repeated.created.length===52&&repeated.scopes.length===52,'actual 52 created');const repeatDml=await counts();await db.exec('truncate test_dml');
 const repeatReplay=await rpc(repeat);assert(JSON.stringify(repeatReplay)===JSON.stringify(repeated),'same 52 result replay');
 report.writes={singleSave:saveDml,singleResponseReplay:replayDml,noOp:noOpDml,repeat52:repeatDml,repeat52Replay:await counts(),repeatCreated:repeated.created.length,repeatScopes:repeated.scopes.length};
 await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',owner]);
 await db.query("insert into special_room_boards(owner_id,title) select $1,'가상 목록 '||n from generate_series(1,24) n",[owner]);
 const first=(await db.query<{data:any}>('select list_special_room_summaries() data')).rows[0].data;
 const next=(await db.query<{data:any}>('select list_special_room_summaries($1) data',[first.nextCursor])).rows[0].data;
 assert(first.items.length===20&&next.items.length===5&&new Set([...first.items,...next.items].map(x=>x.id)).size===25,'20 summaries cursor');
 report.summaryPagination={first:first.items.length,next:next.items.length,unique:25,detailedBookingLabelsReturned:0};
 await Deno.writeTextFile(out,JSON.stringify(report,null,2));
 console.log(JSON.stringify({scenarios:(report.scenarios as any[]).map(s=>({rooms:s.rooms,oldPublic:s.oldPublicBookingRows,new:s.newBookingRows,oldOwner:s.oldOwnerBookingRows,oldPublicBytes:s.oldPublicRowBytes,newSnapshotBytes:s.newSnapshotBytes})),writes:report.writes,summaryPagination:report.summaryPagination},null,2));
}finally{await db.close();}
