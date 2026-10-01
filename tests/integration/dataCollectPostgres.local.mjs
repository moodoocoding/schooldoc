import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const { Pool } = require("../../.tmp/data-collect-runtime/node_modules/pg");
const connection = { host: "127.0.0.1", port: 54329, user: "schooldoc_test" };
const admin = new Pool({ ...connection, database: "postgres" });
const database = "schooldoc_dc_test_" + Date.now();
assert.match(database, /^schooldoc_dc_test_\d+$/);
await admin.query('create database "' + database + '"');
const db = new Pool({ ...connection, database, max: 35 });
const report = { database, checks: [], plans: {} };
const check = (name) => {
  report.checks.push(name);
  console.log("PASS " + name);
};
const call =
  "select public.finalize_data_collection_submission($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::bigint,$14,$15) result";
const owner = randomUUID(),
  other = randomUUID(),
  c = randomUUID(),
  regular = randomUUID();
const parameters = (
  collection,
  personal,
  request = randomUUID(),
  decision = "confirmed",
) => [
  collection,
  personal,
  request,
  "digest:" + request,
  decision,
  "claim",
  null,
  null,
  "encrypted-virtual-identity",
  "가○",
  JSON.stringify(["hash"]),
  null,
  null,
  null,
  "encrypted-virtual-note",
];
const submit = async (args) => (await db.query(call, args)).rows[0].result;
try {
  await db.query(
    "do $$ begin create role anon; exception when duplicate_object then null; end $$; do $$ begin create role authenticated; exception when duplicate_object then null; end $$; do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;",
  );
  await db.query(
    "create schema auth;create schema storage;create schema extensions;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create publication supabase_realtime;create table public.consent_forms(id uuid,status text,updated_at timestamptz);",
  );
  await db.query(
    "create table registries(id uuid,owner_id uuid,title text,status text,updated_at timestamptz);create table registry_signatures(registry_id uuid);create table registry_participants(registry_id uuid);create table student_result_events(id uuid,owner_id uuid,title text,status text,updated_at timestamptz);create table student_result_recipients(event_id uuid,status text);create table special_room_boards(id uuid,owner_id uuid,title text,status text,updated_at timestamptz);create table special_room_bookings(board_id uuid);create table special_rooms(board_id uuid);alter table consent_forms add column owner_id uuid,add column title text,add column deadline timestamptz,add column recipient_mode text,add column response_count integer,add column recipient_count integer;",
  );
  for (const file of [
    "202608210001_data_collect.sql",
    "202608240001_privacy_retention_lifecycle.sql",
    "202608270001_active_work_summary.sql",
    "202610010300_data_collect_submission_and_queries.sql",
  ]) {
    await db.query(readFileSync("supabase/migrations/" + file, "utf8"));
    check("migration " + file);
  }
  report.postgres = (await db.query("select version() v")).rows[0].v;
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query(
    "insert into data_collections(id,owner_id,title,kind,mode,template_path) values($1,$2,'가상 동시 제출','custom','custom','test/template.pdf')",
    [c, owner],
  );
  const personal = Array.from({ length: 30 }, () => randomUUID());
  const responses = await Promise.all(
    personal.map((p) => submit(parameters(c, p))),
  );
  assert.equal(responses.length, 30);
  let rows = (
    await db.query(
      "select row_number from data_collection_targets where collection_id=$1 order by row_number",
      [c],
    )
  ).rows;
  assert.deepEqual(
    rows.map((r) => r.row_number),
    Array.from({ length: 30 }, (_, i) => i + 1),
  );
  check("30명 동시 신규 제출 번호 충돌 없음");
  const args = parameters(c, personal[0]);
  const replay = await Promise.all(
    Array.from({ length: 8 }, () => submit(args)),
  );
  assert.equal(new Set(replay.map((r) => r.revision)).size, 1);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collection_files where request_id=$1",
        [args[2]],
      )
    ).rows[0].n,
    1,
  );
  check("동일 요청 8회 동시 재전송 한 번만 기록");
  const revisions = await Promise.all(
    Array.from({ length: 6 }, () => submit(parameters(c, personal[0]))),
  );
  assert.equal(new Set(revisions.map((r) => r.revision)).size, 6);
  const target = (
    await db.query(
      "select id from data_collection_targets where personal_token=$1",
      [personal[0]],
    )
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collection_files where target_id=$1 and is_current",
        [target],
      )
    ).rows[0].n,
    1,
  );
  check("동일 대상 동시 재제출 연속 버전·현재 1건");
  const before = (
    await db.query(
      "select status,submitted_at from data_collection_targets where id=$1",
      [target],
    )
  ).rows[0];
  await db.query(
    "create function fail_dc_target() returns trigger language plpgsql as $$begin if current_setting('schooldoc.test_fail',true)='yes' then raise exception 'injected_target_write_failure'; end if; return new;end$$;create trigger fail_dc_target before update on data_collection_targets for each row execute function fail_dc_target();",
  );
  const client = await db.connect();
  try {
    await client.query("set schooldoc.test_fail='yes'");
    await assert.rejects(
      client.query(call, parameters(c, personal[0])),
      /injected_target_write_failure/,
    );
    await client.query("set schooldoc.test_fail='no'");
  } finally {
    client.release();
  }
  const after = (
    await db.query(
      "select status,submitted_at from data_collection_targets where id=$1",
      [target],
    )
  ).rows[0];
  assert.deepEqual(after, before);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collection_files where target_id=$1 and is_current",
        [target],
      )
    ).rows[0].n,
    1,
  );
  check("대상 업데이트 실패 전체 롤백·이전 현재 버전 보존");
  await assert.rejects(
    submit([...args.slice(0, 3), "different", ...args.slice(4)]),
    /request_conflict/,
  );
  check("재전송 내용 바꾸기 거부");
  await db.query(
    "insert into data_collections(id,owner_id,title,kind,mode) values($1,$2,'파일 수합','custom','custom')",
    [regular, owner],
  );
  await assert.rejects(
    submit(parameters(regular, randomUUID())),
    /invalid_decision/,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collection_targets where collection_id=$1",
        [regular],
      )
    ).rows[0].n,
    0,
  );
  check("파일 수합 confirmed 우회 거부·유령 대상 없음");
  const upload = parameters(regular, randomUUID(), randomUUID(), "submitted");
  upload[6] = regular + "/pending/" + upload[2] + "/file.pdf";
  upload[7] = "encrypted-file";
  upload[12] = 14;
  upload[13] = "application/pdf";
  await assert.rejects(submit(upload), /invalid_upload_claim/);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collection_targets where collection_id=$1",
        [regular],
      )
    ).rows[0].n,
    0,
  );
  await db.query(
    "insert into data_collection_uploads(id,collection_id,claim_hash,personal_token,storage_path) values($1,$2,$3,$4,$5)",
    [upload[2], regular, "claim", upload[1], upload[6]],
  );
  const first = await submit(upload);
  assert.equal(first.revision, 1);
  assert.equal((await submit(upload)).revision, 1);
  await db.query(
    "update data_collections set allow_resubmit=false where id=$1",
    [regular],
  );

  const prohibited = parameters(regular, upload[1], randomUUID(), "submitted");
  prohibited[6] = regular + "/pending/" + prohibited[2] + "/file.pdf";
  prohibited[7] = "encrypted-second-file";
  prohibited[12] = 14;
  prohibited[13] = "application/pdf";
  await db.query(
    "insert into data_collection_uploads(id,collection_id,claim_hash,personal_token,storage_path) values($1,$2,$3,$4,$5)",
    [prohibited[2], regular, "claim", prohibited[1], prohibited[6]],
  );
  await assert.rejects(submit(prohibited), /resubmit_disabled/);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collection_files where collection_id=$1",
        [regular],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select consumed_at from data_collection_uploads where id=$1",
        [prohibited[2]],
      )
    ).rows[0].consumed_at,
    null,
  );
  check("유효한 업로드 예약도 재제출 금지·예약 미소진");
  check("업로드 예약 결합 검증·성공 시 소진·재전송 동일 결과");
  await db.query(
    "create function fail_dc_file() returns trigger language plpgsql as $$begin if current_setting('schooldoc.test_fail_file',true)='yes' then raise exception 'injected_file_write_failure'; end if; return new;end$$;create trigger fail_dc_file before insert on data_collection_files for each row execute function fail_dc_file();",
  );
  const missingPersonal = randomUUID(),
    failureArgs = parameters(c, missingPersonal);
  const fileClient = await db.connect();
  try {
    await fileClient.query("set schooldoc.test_fail_file='yes'");
    await assert.rejects(
      fileClient.query(call, failureArgs),
      /injected_file_write_failure/,
    );
    await assert.rejects(
      fileClient.query(call, parameters(c, personal[0])),
      /injected_file_write_failure/,
    );
    await fileClient.query("set schooldoc.test_fail_file='no'");
  } finally {
    fileClient.release();
  }
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collection_targets where personal_token=$1",
        [missingPersonal],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collection_files where target_id=$1 and is_current",
        [target],
      )
    ).rows[0].n,
    1,
  );
  assert.deepEqual(
    (
      await db.query(
        "select status,submitted_at from data_collection_targets where id=$1",
        [target],
      )
    ).rows[0],
    before,
  );
  check("실제 파일 INSERT 실패 시 신규 대상·이전 현재 버전 모두 롤백");

  await db.query(
    "update data_collections set allow_resubmit=true where id=$1",
    [regular],
  );
  let finalizedCount = 0,
    cancelledCount = 0;
  for (let i = 0; i < 12; i++) {
    const race = parameters(regular, randomUUID(), randomUUID(), "submitted");
    race[6] = regular + "/pending/" + race[2] + "/file.pdf";
    race[7] = "encrypted-virtual-file";
    race[12] = 14;
    race[13] = "application/pdf";
    await db.query(
      "insert into data_collection_uploads(id,collection_id,claim_hash,personal_token,storage_path) values($1,$2,$3,$4,$5)",
      [race[2], regular, "claim", race[1], race[6]],
    );
    const finalize = () => submit(race);
    const cancel = () =>
      db.query(
        "update data_collection_uploads set expires_at='1970-01-01' where id=$1 and consumed_at is null returning id",
        [race[2]],
      );
    const operations = i % 2 ? [cancel(), finalize()] : [finalize(), cancel()];
    const outcomes = await Promise.allSettled(operations);
    const submission = outcomes[i % 2 ? 1 : 0],
      cleanup = outcomes[i % 2 ? 0 : 1];
    assert.equal(cleanup.status, "fulfilled");
    const files = (
      await db.query(
        "select count(*)::int n from data_collection_files where request_id=$1",
        [race[2]],
      )
    ).rows[0].n;
    if (submission.status === "fulfilled") {
      finalizedCount++;
      assert.equal(files, 1);
      assert.equal(cleanup.value.rowCount, 0);
    } else {
      cancelledCount++;
      assert.match(submission.reason.message, /invalid_upload_claim/);
      assert.equal(files, 0);
      assert.equal(cleanup.value.rowCount, 1);
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from data_collection_targets where personal_token=$1",
            [race[1]],
          )
        ).rows[0].n,
        0,
      );
    }
  }
  report.cleanupRace = { finalizedCount, cancelledCount };
  check(
    "실제 PostgreSQL 예약 정리와 제출 12회 경합: 확정 시 정리 권한 없음·취소 시 유령 대상 없음",
  );

  const summary = (
    await db.query("select data_collect_summary_page($1) v", [owner])
  ).rows[0].v;
  assert.equal(summary.find((r) => r.id === c).total, 30);
  assert.equal(summary.find((r) => r.id === c).responded, 30);
  assert.deepEqual(
    (await db.query("select data_collect_target_page($1,$2) v", [other, c]))
      .rows[0].v,
    [],
  );
  assert.deepEqual(
    (await db.query("select data_collect_summary_page($1) v", [other])).rows[0]
      .v,
    [],
  );
  check("요약 현재 버전만 집계·다른 소유자 조회 없음");
  const denied = await db.connect();
  try {
    await denied.query("set role authenticated");
    await assert.rejects(
      denied.query("select data_collect_summary_page($1)", [owner]),
      /permission denied/,
    );
    await denied.query("reset role");
  } finally {
    denied.release();
  }
  check("브라우저 역할의 관리 RPC 실행 거부");
  await db.query(
    "grant usage on schema public,auth to anon,authenticated;grant select on all tables in schema public to anon,authenticated",
  );
  const rlsClient = await db.connect();
  try {
    await rlsClient.query("set role anon");
    for (const table of [
      "data_collections",
      "data_collection_targets",
      "data_collection_files",
      "data_collection_uploads",
      "data_collection_cleanup",
      "data_collect_template_uploads",
    ])
      assert.equal(
        (await rlsClient.query("select * from " + table)).rows.length,
        0,
      );
    await rlsClient.query("reset role");
    await rlsClient.query("set role service_role");
    assert.equal(
      (await rlsClient.query(call, args)).rows[0].result.revision,
      replay[0].revision,
    );
    await rlsClient.query("reset role");
  } finally {
    rlsClient.release();
  }
  check("실제 PostgreSQL RLS: 익명 데이터 0행·service_role RPC 실행 허용");

  await db.query(
    "insert into data_collect_rate_limits(request_key,window_started_at,request_count) select 'gc-history:'||n,now()-interval '2 hours',1 from generate_series(1,2001)n",
  );
  await db.query(
    "insert into data_collect_rate_limits(request_key,window_started_at,request_count) values('gc-active',to_timestamp(floor(extract(epoch from now())/60)*60),5)",
  );
  await db.query("select consume_data_collect_limits('[]'::jsonb)");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collect_rate_limits where request_key like 'gc-history:%'",
      )
    ).rows[0].n,
    1001,
  );
  await db.query("select consume_data_collect_limits('[]'::jsonb)");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collect_rate_limits where request_key like 'gc-history:%'",
      )
    ).rows[0].n,
    1001,
  );
  assert.equal(
    (
      await db.query(
        "select request_count from data_collect_rate_limits where request_key='gc-active'",
      )
    ).rows[0].request_count,
    5,
  );
  check(
    "만료 요청 제한 기록만 분당 최대 1,000행 정리·반복 정리 없음·현재 카운터 보존",
  );
  const ip = randomUUID();
  const requests = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      db.query("select consume_data_collect_limits($1) ok", [
        JSON.stringify([
          { key: ip, max: 600 },
          { key: ip + ":person:" + i, max: 12 },
        ]),
      ]),
    ),
  );
  assert.ok(requests.every((r) => r.rows[0].ok));
  for (let i = 0; i < 12; i++)
    await db.query("select consume_data_collect_limits($1)", [
      JSON.stringify([{ key: ip + ":attack", max: 12 }]),
    ]);
  assert.equal(
    (
      await db.query("select consume_data_collect_limits($1) ok", [
        JSON.stringify([{ key: ip + ":attack", max: 12 }]),
      ])
    ).rows[0].ok,
    false,
  );
  check("동일 IP 30명 허용·개별 반복 요청 제한");
  // 대표 규모 2,000명과 과거 버전 9,000건을 실제 PostgreSQL에 추가.
  await db.query(
    "insert into data_collection_targets(collection_id,row_number,label_ciphertext,display_label,label_search,owner_search) select $1,n,'encrypted','가○',jsonb_build_array('namehash'||n),jsonb_build_array('ownerhash'||n) from generate_series(31,2000)n",
    [c],
  );
  await db.query(
    "insert into data_collection_files(collection_id,target_id,response_kind,revision,is_current) select $1,t.id,'confirmed',100+n,false from data_collection_targets t cross join generate_series(1,5)n where t.collection_id=$1 and t.row_number<=1800",
    [c],
  );
  await db.query(
    "analyze data_collection_targets;analyze data_collection_files",
  );
  const page = (
    await db.query(
      "select data_collect_target_page($1,$2,0,51,false,false) v",
      [owner, c],
    )
  ).rows[0].v;
  assert.equal(page.length, 51);
  assert.equal(page[0].note_ciphertext, null);
  assert.equal(JSON.stringify(page).includes("personal_token"), false);
  const next = (
    await db.query(
      "select data_collect_target_page($1,$2,50,51,false,false) v",
      [owner, c],
    )
  ).rows[0].v;
  assert.equal(next[0].row_number, 51);
  const plan = (
    await db.query(
      "explain(analyze,buffers,format json) select personal_token,display_label,display_owner from data_collection_targets where collection_id=$1 and (label_search @> $2::jsonb or owner_search @> $2::jsonb) order by row_number limit 10",
      [c, JSON.stringify(["namehash1537"])],
    )
  ).rows[0]["QUERY PLAN"];
  report.plans.lookup = plan;
  const text = JSON.stringify(plan);
  assert.match(text, /data_collect_label_lookup/);
  assert.match(text, /data_collect_owner_lookup/);
  check("2,000명 검색 실제 GIN 이용·현황 51행 제한·메모/토큰 제외");
  report.initialPageBytes = Buffer.byteLength(JSON.stringify(page));
  report.fullLegacyBytes = Buffer.byteLength(
    JSON.stringify(
      (
        await db.query(
          "select row_to_json(f) v from data_collection_files f where collection_id=$1",
          [c],
        )
      ).rows,
    ),
  );
  report.legacyFileRows = (
    await db.query(
      "select count(*)::int n from data_collection_files where collection_id=$1",
      [c],
    )
  ).rows[0].n;
  await db.query("update data_collections set mode='fixed' where id=$1", [c]);
  const activeClient = await db.connect();
  try {
    await activeClient.query(
      "select set_config('request.jwt.claim.sub',$1,false)",
      [owner],
    );
    const active = (
      await activeClient.query(
        "select * from get_active_work_summary() where item_id=$1",
        [c],
      )
    ).rows[0];
    assert.equal(Number(active.done_count), 30);
    assert.equal(Number(active.total_count), 2000);
    await activeClient.query(
      "select set_config('request.jwt.claim.sub',$1,false)",
      [other],
    );
    assert.equal(
      (await activeClient.query("select * from get_active_work_summary()")).rows
        .length,
      0,
    );
  } finally {
    activeClient.release();
  }
  report.plans.currentCount = (
    await db.query(
      "explain(analyze,buffers,format json) select count(*) from data_collection_files where collection_id=$1 and is_current",
      [c],
    )
  ).rows[0]["QUERY PLAN"];
  assert.match(
    JSON.stringify(report.plans.currentCount),
    /data_collection_files_one_current/,
  );
  check("진행 업무 집계도 현재 30건만 반환·현재 부분 인덱스 사용");
  await db.query("update data_collections set status='closed' where id=$1", [
    regular,
  ]);
  const closed = (
    await db.query("select closed_at from data_collections where id=$1", [
      regular,
    ])
  ).rows[0].closed_at;
  await db.query(
    "update data_collections set due_at=now()+interval '7 days' where id=$1",
    [regular],
  );
  assert.deepEqual(
    (
      await db.query("select closed_at from data_collections where id=$1", [
        regular,
      ])
    ).rows[0].closed_at,
    closed,
  );
  check("마감 변경 시 종료·보관 기산점 보존");
} finally {
  mkdirSync("design/feature-reviews/2026-10-01-data-collect-fix", {
    recursive: true,
  });
  writeFileSync(
    "design/feature-reviews/2026-10-01-data-collect-fix/postgres.json",
    JSON.stringify(report, null, 2),
  );
  await db.end();
  await admin.query('drop database "' + database + '"');
  await admin.end();
}
