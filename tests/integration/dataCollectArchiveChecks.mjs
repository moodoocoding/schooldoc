import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyDataCollectArchive(
  db,
  owner,
  other,
  regular,
  check,
) {
  const expired = randomUUID(),
    archived = randomUUID(),
    activeId = randomUUID();
  const recent = randomUUID(),
    otherArchived = randomUUID(),
    raceId = randomUUID();
  const addWork = (id, user, status, due, age = "3 days") =>
    db.query(
      "insert into data_collections(id,owner_id,title,kind,mode,status,due_at,closed_at,created_at,updated_at) values($1,$2,'가상 보관 항목','custom','custom',$3,$4,case when $3='closed' then now()-$5::interval end,now()-$5::interval,now()-$5::interval)",
      [id, user, status, due, age],
    );
  await addWork(expired, owner, "open", new Date(Date.now() - 86_400_000));
  await addWork(archived, owner, "open", new Date(Date.now() - 172_800_000));
  await addWork(activeId, owner, "open", null, "5 days");
  await addWork(recent, owner, "closed", null, "1 minute");
  await addWork(otherArchived, other, "closed", null);
  await addWork(raceId, owner, "closed", null);
  await db.query(
    "insert into data_collections(owner_id,title,kind,mode,status,closed_at,created_at) select $1,'가상 보관 페이지','custom','custom','closed',now()-interval '2 days',now()-interval '2 days'+i*interval '1 minute' from generate_series(1,22) i",
    [owner],
  );
  const page = async (scope, before = null, beforeId = null) =>
    (
      await db.query(
        "select data_collect_scoped_summary_page($1,$2,$3,$4,21,null) v",
        [owner, scope, before, beforeId],
      )
    ).rows[0].v;
  const active = await page("active"),
    first = await page("archive");
  assert(active.some((row) => row.id === activeId));
  assert(
    !active.some((row) => [expired, archived, otherArchived].includes(row.id)),
  );
  assert.equal(first.length, 21);
  const second = await page("archive", first.at(-1).createdAt, first.at(-1).id);
  const archiveIds = [...first, ...second].map((row) => row.id);
  assert.equal(new Set(archiveIds).size, archiveIds.length);
  assert(archiveIds.includes(expired) && archiveIds.includes(archived));
  assert(!archiveIds.includes(otherArchived) && !archiveIds.includes(activeId));
  check("상태 필터를 페이지 제한보다 먼저 적용·보관함 커서·소유자 격리");

  const addReply = async (id, path) => {
    const target = (
      await db.query(
        "insert into data_collection_targets(collection_id,row_number,label_ciphertext,display_label,status) values($1,1,'가상 암호문','가○','submitted') returning id",
        [id],
      )
    ).rows[0].id;
    await db.query(
      "insert into data_collection_files(collection_id,target_id,response_kind,revision,storage_path) values($1,$2,'submitted',1,$3)",
      [id, target, path],
    );
  };
  const old = (
    await db.query(
      "select public_token,retention_months from data_collections where id=$1",
      [expired],
    )
  ).rows[0];
  await addReply(expired, expired + "/pending/reopen.pdf");
  await assert.rejects(
    db.query("select reopen_data_collection($1,$2,now()-interval '1 minute')", [
      owner,
      expired,
    ]),
    /invalid_due/,
  );
  await assert.rejects(
    db.query("select reopen_data_collection($1,$2,null)", [other, expired]),
    /collection_not_found/,
  );
  await db.query(
    "select reopen_data_collection($1,$2,now()+interval '1 day')",
    [owner, expired],
  );
  const reopened = (
    await db.query(
      "select public_token,retention_months,status,closed_at,due_at from data_collections where id=$1",
      [expired],
    )
  ).rows[0];
  assert.equal(reopened.public_token, old.public_token);
  assert.equal(reopened.retention_months, old.retention_months);
  assert.equal(reopened.status, "open");
  assert.equal(reopened.closed_at, null);
  assert(reopened.due_at > new Date());
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from data_collection_files where collection_id=$1",
        [expired],
      )
    ).rows[0].n,
    1,
  );
  await db.query("select reopen_data_collection($1,$2,null)", [owner, regular]);
  assert.deepEqual(
    (
      await db.query(
        "select status,due_at,closed_at from data_collections where id=$1",
        [regular],
      )
    ).rows[0],
    { status: "open", due_at: null, closed_at: null },
  );
  check(
    "만료 및 직접 종료 재개·미래 기한 검사·공개 링크, 회신, 보관 기간 유지",
  );

  const stored = archived + "/pending/archive.pdf";
  const template = owner + "/" + archived + "/template.pdf";
  const otherPath = otherArchived + "/pending/other.pdf";
  await addReply(archived, stored);
  await db.query(
    "insert into storage.objects values('data-collect-files',$1),('data-collect-templates',$2),('data-collect-files',$3)",
    [stored, template, otherPath],
  );
  await db.query(
    "insert into data_collect_template_uploads(storage_path,owner_id,collection_id) values($1,$2,$3)",
    [template, owner, archived],
  );
  const preview = async (id, user = owner) =>
    (await db.query("select data_collect_purge_preview($1,$2) v", [user, id]))
      .rows[0].v;
  const begin = (id, p, user = owner) =>
    db.query("select begin_data_collect_purge($1,$2,$3,$4,$5,$6)", [
      user,
      id,
      p.revision,
      p.targetCount,
      p.responseCount,
      p.fileCount,
    ]);
  const finish = (id) =>
    db.query("select finish_data_collect_purge($1,$2)", [owner, id]);
  await assert.rejects(preview(activeId), /collection_active/);
  await assert.rejects(preview(archived, other), /collection_not_found/);
  await assert.rejects(
    begin(recent, await preview(recent)),
    /upload_grace_period/,
  );
  const snapshot = await preview(archived);
  assert.deepEqual(
    [snapshot.targetCount, snapshot.responseCount, snapshot.fileCount],
    [1, 1, 2],
  );
  await assert.rejects(
    begin(archived, { ...snapshot, fileCount: 1 }),
    /purge_preview_changed/,
  );
  await assert.rejects(
    begin(archived, snapshot, other),
    /collection_not_found/,
  );
  await assert.rejects(finish(archived), /purge_not_started/);
  await begin(archived, snapshot);
  assert.equal((await preview(archived)).pending, true);
  await assert.rejects(
    db.query("select reopen_data_collection($1,$2,null)", [owner, archived]),
    /purge_pending/,
  );
  await assert.rejects(
    db.query("update data_collections set due_at=null where id=$1", [archived]),
    /purge_pending/,
  );
  await assert.rejects(finish(archived), /purge_files_remaining/);
  check(
    "활성·다른 소유자·업로드 대기·오래된 수량 삭제 거절 및 삭제 시작 후 재개 금지",
  );

  const batch = (
    await db.query("select * from data_collect_purge_batch($1,$2)", [
      owner,
      archived,
    ])
  ).rows;
  assert.deepEqual(
    new Set(batch.map((row) => row.path)),
    new Set([stored, template]),
  );
  assert.equal(
    (
      await db.query("select * from data_collect_purge_batch($1,$2)", [
        other,
        archived,
      ])
    ).rowCount,
    0,
  );
  // 시험 fixture에서만 Storage API 일부 성공/재시도의 메타데이터 상태를 재현한다.
  await db.query("delete from storage.objects where name=$1", [stored]);
  await assert.rejects(finish(archived), /purge_files_remaining/);
  const remaining = await preview(archived);
  assert.equal(remaining.fileCount, 1);
  assert.equal(remaining.responseCount, 1);
  await begin(archived, remaining);
  await db.query("delete from storage.objects where name=$1", [template]);
  await finish(archived);
  await finish(archived);
  assert.equal(
    (await db.query("select id from data_collections where id=$1", [archived]))
      .rowCount,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select id from data_collection_files where collection_id=$1",
        [archived],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select storage_path from data_collect_template_uploads where collection_id=$1",
        [archived],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await db.query("select name from storage.objects where name=$1", [
        otherPath,
      ])
    ).rowCount,
    1,
  );
  assert.deepEqual(
    (
      await db.query(
        "select record_count,file_count from privacy_purge_log where resource_id=$1",
        [archived],
      )
    ).rows,
    [{ record_count: 1, file_count: 2 }],
  );
  check(
    "파일 일부 실패 시 기록 보존·남은 파일 재시도·확인 후 원자 파기·감사 건수 보존",
  );

  const raceSnapshot = await preview(raceId);
  const race = await Promise.allSettled([
    begin(raceId, raceSnapshot),
    db.query("select reopen_data_collection($1,$2,null)", [owner, raceId]),
  ]);
  assert.equal(
    race.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.match(
    String(race.find((result) => result.status === "rejected")?.reason),
    /purge_pending|collection_active/,
  );
  const rlsWork = randomUUID();
  await addWork(rlsWork, owner, "closed", null);
  await begin(rlsWork, await preview(rlsWork));
  const denied = await db.connect();
  try {
    await denied.query("set role authenticated");
    await assert.rejects(
      denied.query("select data_collect_purge_preview($1,$2)", [owner, raceId]),
      /permission denied/,
    );
    // 앞선 검사가 테이블 SELECT를 부여했어도 RLS가 행을 숨긴다.
    assert.equal(
      (await denied.query("select * from data_collect_purge_jobs")).rowCount,
      0,
    );
    await assert.rejects(
      denied.query(
        "select data_collect_scoped_summary_page($1,'archive',null,null,21,null)",
        [owner],
      ),
      /permission denied/,
    );
  } finally {
    await denied.query("reset role");
    denied.release();
  }
  check("삭제와 다시 열기 경합 중 한쪽만 성공·브라우저 역할 직접 호출 차단");
}
