// Isolated HTTP contract tests: fetch is mocked and no network permission is granted.
// Run: npx deno test --no-config --allow-env tests/server/classroomRoles.test.ts
import { handleClassroomRoles } from "../../supabase/functions/_shared/classroomRolesServer.ts";
import { createPayloadCrypto } from "../../supabase/functions/_shared/payloadCrypto.ts";
import {
  defaultRoleState,
  parseRoleRoster,
  roleMonthRange,
  roleToday,
} from "../../supabase/functions/_shared/classroomRoles.ts";

const owner = "10000000-0000-4000-8000-000000000001";
const otherOwner = "10000000-0000-4000-8000-000000000002";
const boardId = "20000000-0000-4000-8000-000000000001";
const token = "30000000-0000-4000-8000-000000000001";
const assert = (condition: unknown, message = "Assertion failed") => {
  if (!condition) throw new Error(message);
};
const respond = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

async function fixture(
  run: (ctx: Awaited<ReturnType<typeof createFixture>>) => Promise<void>,
) {
  const oldFetch = globalThis.fetch;
  const variables = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLASSROOM_ROLES_ENCRYPTION_KEY",
  ];
  const previous = variables.map((name) => Deno.env.get(name));
  Deno.env.set("SUPABASE_URL", "https://role-test.invalid");
  Deno.env.set(
    "SUPABASE_SERVICE_ROLE_KEY",
    "test-service-key-not-a-real-secret",
  );
  Deno.env.set("CLASSROOM_ROLES_ENCRYPTION_KEY", "00".repeat(32));
  try {
    await run(await createFixture());
  } finally {
    globalThis.fetch = oldFetch;
    variables.forEach((name, i) =>
      previous[i] === undefined
        ? Deno.env.delete(name)
        : Deno.env.set(name, previous[i]!),
    );
  }
}
async function createFixture() {
  const state = defaultRoleState();
  state.roster = parseRoleRoster("1 가상학생");
  state.settings.schoolDays = [0, 1, 2, 3, 4, 5, 6];
  state.roles[0].weekdays = [0, 1, 2, 3, 4, 5, 6];
  state.periods = [
    {
      id: crypto.randomUUID(),
      ...roleMonthRange(roleToday().slice(0, 7)),
      students: structuredClone(state.roster),
      roles: structuredClone(state.roles),
      assignments: { [state.roster[0].id]: state.roles[0].id },
    },
  ];
  const cryptoStore = createPayloadCrypto(
    "CLASSROOM_ROLES_ENCRYPTION_KEY",
    "test",
  );
  const row = {
    id: boardId,
    owner_id: owner,
    public_token: token,
    version: 1,
    encrypted_payload: await cryptoStore.encryptPayload(state),
  };
  const calls: {
    path: string;
    method: string;
    body?: Record<string, unknown>;
  }[] = [];
  const flags = {
    rateError: false,
    rateAllowed: true,
    conflict: false,
    manyRecords: false,
  };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    assert(url.hostname === "role-test.invalid", "Unexpected network request");
    const body =
      req.method === "POST" || req.method === "PATCH"
        ? await req.json()
        : undefined;
    calls.push({ path: url.pathname + url.search, method: req.method, body });
    if (url.pathname === "/auth/v1/user") {
      const bearer = req.headers.get("authorization");
      if (bearer !== "Bearer teacher-a" && bearer !== "Bearer teacher-b")
        return respond({ message: "invalid token" }, 401);
      return respond({
        id: bearer === "Bearer teacher-a" ? owner : otherOwner,
        aud: "authenticated",
        role: "authenticated",
        created_at: new Date().toISOString(),
      });
    }
    if (url.pathname.endsWith("/rpc/consume_registry_rate_limit"))
      return flags.rateError
        ? respond({ message: "db unavailable" }, 500)
        : respond(flags.rateAllowed);
    if (url.pathname.endsWith("/rpc/write_classroom_role_record"))
      return respond(!flags.conflict);
    if (url.pathname.endsWith("/classroom_role_boards")) {
      if (req.method === "PATCH")
        return respond(
          flags.conflict
            ? []
            : [{ id: boardId, version: 2, public_token: token }],
        );
      const allowed =
        url.searchParams.get("owner_id") === `eq.${owner}` ||
        url.searchParams.get("public_token") === `eq.${token}`;
      return respond(allowed ? [row] : []);
    }
    if (url.pathname.endsWith("/classroom_role_records")) {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      return respond(
        flags.manyRecords
          ? Array.from(
              { length: Math.max(0, Math.min(500, 1050 - offset)) },
              (_, i) => ({
                period_id: state.periods[0].id,
                student_id: state.roster[0].id,
                record_date: roleToday(),
                status: "done",
                source: "student",
                updated_at: String(offset + i),
              }),
            )
          : [],
      );
    }
    throw new Error(`Unexpected fake endpoint ${url.pathname}`);
  };
  const call = (body: object, publicRequest = false, bearer = "teacher-a") =>
    handleClassroomRoles(
      new Request("https://handler.invalid/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(body),
      }),
      publicRequest,
    );
  return { state, row, calls, flags, call, cryptoStore };
}

Deno.test("admin requires a real authenticated user before board queries", () =>
  fixture(async ({ call, calls }) => {
    assert((await call({ action: "load" }, false, "")).status === 401);
    assert((await call({ action: "load" }, false, "invalid")).status === 401);
    assert(!calls.some((c) => c.path.includes("classroom_role_boards")));
  }),
);
Deno.test(
  "owner filter comes from authenticated user, never caller boardId or ownerId",
  () =>
    fixture(async ({ call, calls }) => {
      const response = await call(
        {
          action: "records",
          boardId,
          ownerId: owner,
          ...roleMonthRange(roleToday().slice(0, 7)),
        },
        false,
        "teacher-b",
      );
      assert(response.status === 404);
      assert(calls.some((c) => c.path.includes(`owner_id=eq.${otherOwner}`)));
      assert(!calls.some((c) => c.path.includes("classroom_role_records")));
    }),
);
Deno.test("public unknown token returns 404; cannot invoke admin actions", () =>
  fixture(async ({ call }) => {
    assert(
      (await call({ action: "view", token: crypto.randomUUID() }, true, ""))
        .status === 404,
    );
    assert((await call({ action: "save", token }, true, "")).status === 400);
    assert((await call({ action: "records", token }, true, "")).status === 400);
  }),
);
Deno.test(
  "public response contains no secret token, history, owner or ciphertext",
  () =>
    fixture(async ({ call }) => {
      const response = await call({ action: "view", token }, true, "");
      assert(response.status === 200);
      const text = await response.text();
      assert(
        !/public_token|encrypted_payload|owner_id|periods|source|updated_at/.test(
          text,
        ),
      );
      assert(response.headers.get("Cache-Control") === "no-store");
    }),
);
Deno.test(
  "public submit accepts today and rejects date/status/student tampering",
  () =>
    fixture(async ({ call, state, calls }) => {
      const request = {
        action: "record",
        token,
        periodId: state.periods[0].id,
        studentId: state.roster[0].id,
        date: roleToday(),
        status: "done",
      };
      assert((await call(request, true, "")).status === 200);
      for (const patch of [
        { date: "2020-01-01" },
        { status: "exempt" },
        { studentId: crypto.randomUUID() },
        { periodId: crypto.randomUUID() },
      ])
        assert((await call({ ...request, ...patch }, true, "")).status === 400);
      const writes = calls.filter((c) =>
        c.path.endsWith("/rpc/write_classroom_role_record"),
      );
      assert(writes.length === 1);
      assert(
        writes[0].body?.p_board_id === boardId &&
          writes[0].body?.p_source === "student",
      );
    }),
);
Deno.test(
  "disabled public board cannot disclose roster or accept submissions",
  () =>
    fixture(async ({ call, state, row, cryptoStore }) => {
      state.settings.publicEnabled = false;
      row.encrypted_payload = await cryptoStore.encryptPayload(state);
      const response = await call({ action: "view", token }, true, "");
      const view = await response.json();
      assert(view.students.length === 0 && view.periodId === null);
      const submit = await call(
        {
          action: "record",
          token,
          periodId: state.periods[0].id,
          studentId: state.roster[0].id,
          date: roleToday(),
          status: "done",
        },
        true,
        "",
      );
      assert(submit.status === 400);
    }),
);
Deno.test("rate limiter fails closed before any board access", () =>
  fixture(async ({ call, flags, calls }) => {
    flags.rateError = true;
    assert((await call({ action: "view", token }, true, "")).status === 503);
    flags.rateError = false;
    flags.rateAllowed = false;
    assert((await call({ action: "view", token }, true, "")).status === 429);
    assert(!calls.some((c) => c.path.includes("classroom_role_boards")));
  }),
);
Deno.test("configuration and record conflicts are surfaced as 409", () =>
  fixture(async ({ call, flags, state }) => {
    assert((await call({ action: "save", version: 0, state })).status === 409);
    flags.conflict = true;
    assert((await call({ action: "save", version: 1, state })).status === 409);
    assert(
      (
        await call({
          action: "record",
          version: 1,
          periodId: state.periods[0].id,
          studentId: state.roster[0].id,
          date: roleToday(),
          status: "done",
        })
      ).status === 409,
    );
  }),
);
Deno.test("monthly history paginates beyond PostgREST 1000 row defaults", () =>
  fixture(async ({ call, flags, calls }) => {
    flags.manyRecords = true;
    const response = await call({
      action: "records",
      ...roleMonthRange(roleToday().slice(0, 7)),
    });
    assert(response.status === 200);
    assert((await response.json()).length === 1050);
    assert(
      calls.filter((c) => c.path.includes("classroom_role_records")).length ===
        3,
    );
  }),
);
Deno.test(
  "missing encryption key, oversized input and malformed JSON fail safely",
  () =>
    fixture(async ({ call }) => {
      Deno.env.delete("CLASSROOM_ROLES_ENCRYPTION_KEY");
      assert((await call({ action: "load" })).status === 503);
      const large = await handleClassroomRoles(
        new Request("https://handler.invalid/", {
          method: "POST",
          body: "x".repeat(1_500_001),
        }),
        true,
      );
      assert(large.status === 413);
      const bad = await handleClassroomRoles(
        new Request("https://handler.invalid/", { method: "POST", body: "{" }),
        true,
      );
      assert(bad.status === 400);
    }),
);
