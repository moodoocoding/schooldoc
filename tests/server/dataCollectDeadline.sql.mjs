// 실제 PostgreSQL/WASM + 운영 제출 RPC. 가상 로컬 DB만 사용하며 원격/다중 연결 검사를 대신하지 않는다.
// deno run --no-lock --allow-env --allow-read --node-modules-dir=none tests/server/dataCollectDeadline.sql.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "npm:@electric-sql/pglite@0.5.8";
import { pgcrypto } from "npm:@electric-sql/pglite@0.5.8/contrib/pgcrypto";
import { normalizeDataCollectDeadline } from "../../supabase/functions/_shared/dataCollectDeadline.ts";
const db = new PGlite({ extensions: { pgcrypto } });
const owner = randomUUID(), id = randomUUID();
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log("PASS " + name); };
const submit = async () => {
  const request = randomUUID();
  return db.query("select public.finalize_data_collection_submission($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::bigint,$14,$15) result", [
    id, randomUUID(), request, "fictional-digest-" + request, "confirmed", "fictional-claim", null, null,
    "fictional-encrypted-identity", "가○", JSON.stringify(["fictional-name-hash"]), null, null, null, "fictional-encrypted-note",
  ]);
};
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create publication supabase_realtime;
  `);
  await db.exec(await readFile(new URL("../../supabase/migrations/202608210001_data_collect.sql", import.meta.url), "utf8"));
  const submissionSql = await readFile(new URL("../../supabase/migrations/202610010300_data_collect_submission_and_queries.sql", import.meta.url), "utf8");
  // 다른 기능의 요약 RPC를 제외하고 운영의 원자 제출 RPC까지 그대로 적용한다.
  await db.exec(submissionSql.slice(0, submissionSql.indexOf("create or replace function public.list_data_collection_summaries")));
  await db.query("insert into auth.users values($1)", [owner]);
  const utc = normalizeDataCollectDeadline("2030-10-09T17:00", "+09:00");
  await db.query("insert into data_collections(id,owner_id,title,kind,mode,template_path,due_at) values($1,$2,'가상 마감 검사','custom','custom','fictional/template.pdf',$3)", [id, owner, utc]);
  await check("한국 시간 17시는 timestamptz에서 08:00 UTC로 저장되고 서버 시간대와 무관하게 같은 시각이다", async () => {
    assert.equal(utc, "2030-10-09T08:00:00.000Z");
    for (const timezone of ["UTC", "Asia/Seoul", "America/Los_Angeles"]) {
      await db.query("select set_config('TimeZone',$1,false)", [timezone]);
      const row = (await db.query("select due_at,extract(epoch from due_at) epoch from data_collections where id=$1", [id])).rows[0];
      assert.equal(new Date(row.due_at).toISOString(), utc);
      assert.equal(Number(row.epoch) * 1000, Date.parse(utc));
    }
  });
  await check("시간대 없는 기존 한국 요청과 명시적 UTC·offset 요청은 같은 DB 마감이다", async () => {
    for (const input of ["2030-10-09T17:00", "2030-10-09T08:00:00Z", "2030-10-09T17:00:00+09:00"]) {
      await db.query("update data_collections set due_at=$1 where id=$2", [normalizeDataCollectDeadline(input, "+09:00"), id]);
      assert.equal(new Date((await db.query("select due_at from data_collections where id=$1", [id])).rows[0].due_at).toISOString(), utc);
    }
  });
  await check("마감 전 공개 원자 제출이 성공한다", async () => {
    assert.equal((await submit()).rows[0].result.submitted, true);
  });
  await check("마감 정각과 이후에는 새 제출이 차단되고 명단·응답을 추가하지 않는다", async () => {
    const before = (await db.query("select count(*)::int n from data_collection_targets")).rows[0].n;
    await db.exec("begin");
    try {
      await db.query("update data_collections set due_at=now() where id=$1", [id]);
      // 정각을 고정하는 트랜잭션 안에서 거절 후 savepoint로 복구한다.
      await db.exec("savepoint deadline");
      await assert.rejects(submit, /collection_closed/);
      await db.exec("rollback to savepoint deadline");
      await db.query("update data_collections set due_at=now()-interval '1 second' where id=$1", [id]);
      await db.exec("savepoint expired");
      await assert.rejects(submit, /collection_closed/);
      await db.exec("rollback to savepoint expired");
      assert.equal((await db.query("select count(*)::int n from data_collection_targets")).rows[0].n, before);
    } finally { await db.exec("rollback"); }
  });
  await check("기한 없음을 저장하면 열린 수합에서 제출을 다시 받을 수 있다", async () => {
    await db.query("update data_collections set due_at=null where id=$1", [id]);
    assert.equal((await submit()).rows[0].result.submitted, true);
  });
  console.log(checks + " PostgreSQL deadline checks passed");
} finally { await db.close(); }
