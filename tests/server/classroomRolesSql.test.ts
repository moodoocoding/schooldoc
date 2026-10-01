// In-memory PostgreSQL only. No remote project, keys or real student data.
// npx deno test --no-config --allow-read --allow-env --allow-sys tests/server/classroomRolesSql.test.ts
import { PGlite } from "npm:@electric-sql/pglite@0.5.8";
const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const board = "20000000-0000-4000-8000-000000000001";
const period = "30000000-0000-4000-8000-000000000001";
const student = "40000000-0000-4000-8000-000000000001";
function assert(value: unknown, message = "SQL assertion failed") {
  if (!value) throw new Error(message);
}
Deno.test(
  "classroom roles migration, RLS, privileges and atomic record writes",
  async (t) => {
    const db = await PGlite.create();
    const denied = async (sql: string) => {
      try {
        await db.exec(sql);
      } catch (e) {
        assert(String(e).includes("permission denied"));
        return;
      }
      throw new Error("Expected denied operation");
    };
    try {
      await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated, service_role;
      grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${owner}'), ('${other}');`);
      await t.step("migration applies to PostgreSQL", async () => {
        await db.exec(
          await Deno.readTextFile(
            new URL(
              "../../supabase/migrations/202609270001_classroom_roles.sql",
              import.meta.url,
            ),
          ),
        );
        await db.exec(
          await Deno.readTextFile(
            new URL(
              "../../supabase/migrations/202609280200_classroom_role_period_edits.sql",
              import.meta.url,
            ),
          ),
        );
        await db.exec(
          await Deno.readTextFile(
            new URL(
              "../../supabase/migrations/202610010001_classroom_role_teacher_record_priority.sql",
              import.meta.url,
            ),
          ),
        );
      });
      await db.exec(
        `insert into public.classroom_role_boards(id, owner_id, encrypted_payload) values ('${board}', '${owner}', 'encrypted-test-only'), (gen_random_uuid(), '${other}', 'encrypted-other-test-only');`,
      );
      await t.step("authenticated owner sees only their board", async () => {
        await db.exec(
          `set role authenticated; set request.jwt.claim.sub = '${owner}';`,
        );
        const result = await db.query<{ id: string }>(
          "select id from public.classroom_role_boards",
        );
        assert(result.rows.length === 1 && result.rows[0].id === board);
      });
      await t.step(
        "browser clients cannot write boards or invoke service-only RPC",
        async () => {
          await denied(
            "update public.classroom_role_boards set encrypted_payload = 'tampered'",
          );
          await denied(
            `select public.write_classroom_role_record('${board}', 1, '${period}', '${student}', '2026-09-27', 'done', 'student')`,
          );
          await denied(
            `select public.update_classroom_role_period('${board}', '${owner}', 1, 'tampered', '${period}', null, null)`,
          );
        },
      );
      await t.step("anonymous client has no direct data access", async () => {
        await db.exec("reset role; set role anon;");
        await denied("select * from public.classroom_role_boards");
        await denied("select * from public.classroom_role_records");
      });
      await t.step("duplicate submissions update one row", async () => {
        await db.exec("reset role; set role service_role;");
        const write = (status: string) =>
          db.query<{ ok: boolean }>(
            `select public.write_classroom_role_record($1, 1, $2, $3, '2026-09-27', $4, 'student') as ok`,
            [board, period, student, status],
          );
        assert((await write("done")).rows[0].ok);
        assert((await write("not_done")).rows[0].ok);
        const rows = (
          await db.query<{ status: string }>(
            "select status from public.classroom_role_records",
          )
        ).rows;
        assert(rows.length === 1 && rows[0].status === "not_done");
      });
      await t.step("version conflict does not mutate the record", async () => {
        const result = await db.query<{ ok: boolean }>(
          `select public.write_classroom_role_record($1, 0, $2, $3, '2026-09-27', 'done', 'student') as ok`,
          [board, period, student],
        );
        assert(result.rows[0].ok === false);
        assert(
          (
            await db.query<{ status: string }>(
              "select status from public.classroom_role_records",
            )
          ).rows[0].status === "not_done",
        );
      });
      await t.step("period changes protect recorded days and board ownership", async () => {
        const change = async (
          ownerId: string,
          version: number,
          start: string | null,
          end: string | null,
        ) => {
          const result = await db.query<{ result: string }>(
            "select public.update_classroom_role_period($1, $2, $3, 'encrypted-next', $4, $5, $6) as result",
            [board, ownerId, version, period, start, end],
          );
          return result.rows[0].result;
        };
        assert(await change(other, 1, null, null) === "conflict");
        assert(await change(owner, 0, null, null) === "conflict");
        assert(await change(owner, 1, null, null) === "record_conflict");
        assert(await change(owner, 1, "2026-09-01", "2026-09-26") === "record_conflict");
        assert(await change(owner, 1, "2026-08-01", "2026-09-30") === "updated");
        const after = await db.query<{ version: number; encrypted_payload: string }>(
          `select version, encrypted_payload from public.classroom_role_boards where id = '${board}'`,
        );
        assert(after.rows[0].version === 2 && after.rows[0].encrypted_payload === "encrypted-next");
        assert(await change(owner, 1, "2026-08-01", "2026-09-30") === "conflict");
      });
      await t.step(
        "other teacher cannot see another teacher records",
        async () => {
          await db.exec(
            `reset role; set role authenticated; set request.jwt.claim.sub = '${other}';`,
          );
          assert(
            (await db.query("select * from public.classroom_role_records")).rows
              .length === 0,
          );
          await db.exec(`set request.jwt.claim.sub = '${owner}';`);
          assert(
            (await db.query("select * from public.classroom_role_records")).rows
              .length === 1,
          );
        },
      );
      await t.step(
        "teacher correction cannot be overwritten by a student",
        async () => {
          await db.exec("reset role; set role service_role;");
          const correct = await db.query<{ ok: boolean }>(
            `select public.write_classroom_role_record($1, 2, $2, $3, '2026-09-27', 'exempt', 'teacher') as ok`,
            [board, period, student],
          );
          assert(correct.rows[0].ok);
          const rejected = await db.query<{ ok: boolean }>(
            `select public.write_classroom_role_record($1, 2, $2, $3, '2026-09-27', 'done', 'student') as ok`,
            [board, period, student],
          );
          assert(rejected.rows[0].ok === false);
          const rows = await db.query<{ status: string; source: string }>(
            "select status, source from public.classroom_role_records",
          );
          assert(rows.rows.length === 1 && rows.rows[0].status === "exempt" && rows.rows[0].source === "teacher");
        },
      );
      await t.step(
        "teacher reset removes only the requested record",
        async () => {
          await db.exec("reset role; set role service_role;");
          await db.query(
            `select public.write_classroom_role_record($1, 2, $2, $3, '2026-09-27', 'missing', 'teacher')`,
            [board, period, student],
          );
          assert(
            (await db.query("select * from public.classroom_role_records")).rows
              .length === 0,
          );
          const deleted = await db.query<{ result: string }>(
            "select public.update_classroom_role_period($1, $2, 2, 'encrypted-without-period', $3, null, null) as result",
            [board, owner, period],
          );
          assert(deleted.rows[0].result === "updated");
        },
      );
    } finally {
      await db.close();
    }
  },
);
