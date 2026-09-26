import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { createPayloadCrypto } from "./payloadCrypto.ts";
import {
  defaultRoleState,
  publicRoleProjection,
  roleToday,
  validRoleDate,
  validateRoleRecord,
  validateRoleStateChange,
  type RoleState,
  type RoleRecord,
} from "./classroomRoles.ts";

const seal = createPayloadCrypto(
  "CLASSROOM_ROLES_ENCRYPTION_KEY",
  "1인 1역 저장소 설정이 필요합니다.",
);
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
class RequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
function fail(message: string, status = 400): never {
  throw new RequestError(message, status);
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown): string =>
  typeof value === "string" && idPattern.test(value)
    ? value
    : fail("요청 정보를 확인해 주세요.");

export async function handleClassroomRoles(
  request: Request,
  publicRequest: boolean,
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST")
    return json({ error: "지원하지 않는 요청입니다." }, 405);
  try {
    // Limit the streamed body, not only the caller-supplied Content-Length.
    const reader = request.body?.getReader();
    if (!reader) fail("요청 내용이 없습니다.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_500_000) {
        await reader.cancel();
        fail("요청이 너무 큽니다.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      fail("요청 형식을 확인해 주세요.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail("요청 형식을 확인해 주세요.");
    const url = Deno.env.get("SUPABASE_URL");
    const key =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SECRET_KEY");
    if (!url || !key || !seal.isConfigured())
      fail("1인 1역 서비스가 아직 준비되지 않았습니다.", 503);
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let ownerId = "";
    if (!publicRequest) {
      const bearer = request.headers
        .get("Authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
      if (!bearer) fail("교사 로그인이 필요합니다.", 401);
      const { data, error } = await db.auth.getUser(bearer);
      if (error || !data.user) fail("다시 로그인해 주세요.", 401);
      ownerId = data.user.id;
    }
    const token = publicRequest ? id(body.token) : "";
    const remoteIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `classroom-roles:${publicRequest ? remoteIp : ownerId}`,
      ),
    );
    const requestKey = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const limit = await db.rpc("consume_registry_rate_limit", {
      p_request_key: `roles:${requestKey}`,
      p_window_seconds: 60,
      p_max_requests: publicRequest ? 240 : 120,
    });
    if (limit.error) fail("잠시 후 다시 시도해 주세요.", 503);
    if (!limit.data) fail("요청이 많습니다. 1분 후 다시 시도해 주세요.", 429);
    let query = db.from("classroom_role_boards").select("*");
    query = publicRequest
      ? query.eq("public_token", token)
      : query.eq("owner_id", ownerId);
    let { data: board, error: boardError } = await query.maybeSingle();
    if (boardError) fail("저장소를 불러오지 못했습니다.", 503);
    if (!board && !publicRequest && body.action === "load") {
      // Ignore a concurrent first visit; read its row instead of replacing it.
      const created = await db
        .from("classroom_role_boards")
        .upsert(
          {
            owner_id: ownerId,
            encrypted_payload: await seal.encryptPayload(defaultRoleState()),
          },
          { onConflict: "owner_id", ignoreDuplicates: true },
        );
      if (created.error) fail("학급을 만들지 못했습니다.", 503);
      const loaded = await db
        .from("classroom_role_boards")
        .select("*")
        .eq("owner_id", ownerId)
        .single();
      board = loaded.data;
      if (loaded.error) fail("학급을 불러오지 못했습니다.", 503);
    }
    if (!board) fail("사용할 수 없는 학급 링크입니다.", 404);
    const state = await seal.decryptPayload<RoleState>(board.encrypted_payload);
    const today = roleToday();
    if (publicRequest) {
      if (body.action !== "view" && body.action !== "record")
        fail("지원하지 않는 요청입니다.");
      if (body.action === "record") {
        const periodId = id(body.periodId);
        const studentId = id(body.studentId);
        try {
          validateRoleRecord(
            state,
            periodId,
            studentId,
            String(body.date),
            body.status,
            "student",
            today,
          );
        } catch (e) {
          fail((e as Error).message);
        }
        const saved = await db.rpc("write_classroom_role_record", {
          p_board_id: board.id,
          p_version: board.version,
          p_period_id: periodId,
          p_student_id: studentId,
          p_date: body.date,
          p_status: body.status,
          p_source: "student",
        });
        if (saved.error)
          fail("기록을 저장하지 못했습니다. 다시 시도해 주세요.", 503);
        if (!saved.data) fail("배정이 변경되었습니다. 새로고침해 주세요.", 409);
        return json({ ok: true });
      }
      const selectedId = body.studentId ? id(body.studentId) : undefined;
      const records = await db
        .from("classroom_role_records")
        .select("period_id,student_id,record_date,status,source,updated_at")
        .eq("board_id", board.id)
        .eq("record_date", today);
      if (records.error) fail("오늘의 기록을 불러오지 못했습니다.", 503);
      return json(publicRoleProjection(state, records.data, today, selectedId));
    }
    if (body.action === "load")
      return json({
        id: board.id,
        version: board.version,
        public_token: board.public_token,
        state,
      });
    if (body.action === "save" || body.action === "rotateToken") {
      if (body.version !== board.version)
        fail(
          "다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
          409,
        );
      const next = body.action === "save" ? (body.state as RoleState) : state;
      try {
        validateRoleStateChange(state, next);
      } catch (e) {
        fail((e as Error).message);
      }
      const nextToken =
        body.action === "rotateToken"
          ? crypto.randomUUID()
          : board.public_token;
      const updated = await db
        .from("classroom_role_boards")
        .update({
          encrypted_payload: await seal.encryptPayload(next),
          public_token: nextToken,
          version: board.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", board.id)
        .eq("owner_id", ownerId)
        .eq("version", board.version)
        .select("id,version,public_token")
        .maybeSingle();
      if (updated.error) fail("저장하지 못했습니다. 다시 시도해 주세요.", 503);
      if (!updated.data)
        fail("다른 화면에서 변경되었습니다. 새로고침해 주세요.", 409);
      return json({ ...updated.data, state: next });
    }
    if (body.action === "records") {
      if (
        !validRoleDate(body.start) ||
        !validRoleDate(body.end) ||
        body.start > body.end ||
        Date.parse(body.end) - Date.parse(body.start) > 31 * 86400000
      )
        fail("조회 기간은 한 달 이내로 선택해 주세요.");
      // PostgREST may cap responses at 1000 rows. Page explicitly for 60 × 31 days.
      const records: RoleRecord[] = [];
      for (let offset = 0; offset < 4000; offset += 500) {
        const result = await db
          .from("classroom_role_records")
          .select("period_id,student_id,record_date,status,source,updated_at")
          .eq("board_id", board.id)
          .gte("record_date", body.start)
          .lte("record_date", body.end)
          .order("record_date")
          .order("student_id")
          .order("period_id")
          .range(offset, offset + 499);
        if (result.error) fail("기록을 불러오지 못했습니다.", 503);
        records.push(...result.data);
        if (result.data.length < 500) return json(records);
      }
      fail("조회할 기록이 너무 많습니다. 기간을 줄여 주세요.");
    }
    if (body.action === "record") {
      const periodId = id(body.periodId);
      const studentId = id(body.studentId);
      try {
        validateRoleRecord(
          state,
          periodId,
          studentId,
          String(body.date),
          body.status,
          "teacher",
          today,
        );
      } catch (e) {
        fail((e as Error).message);
      }
      if (body.version !== board.version)
        fail("배정이 변경되었습니다. 새로고침해 주세요.", 409);
      const result = await db.rpc("write_classroom_role_record", {
        p_board_id: board.id,
        p_version: board.version,
        p_period_id: periodId,
        p_student_id: studentId,
        p_date: body.date,
        p_status: body.status,
        p_source: "teacher",
      });
      if (result.error) fail("기록을 저장하지 못했습니다.", 503);
      if (!result.data) fail("배정이 변경되었습니다. 새로고침해 주세요.", 409);
      return json({ ok: true });
    }
    fail("지원하지 않는 요청입니다.");
  } catch (error) {
    // Do not log request bodies, names, tokens or decrypted payloads.
    return json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      error instanceof RequestError ? error.status : 500,
    );
  }
}
