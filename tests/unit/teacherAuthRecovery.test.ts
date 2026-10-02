import { describe, expect, it, vi } from "vitest";
import { createTeacherAuthRecovery } from "../../src/auth/teacherAuthRecovery";
const origin = "https://schooldoc-test.invalid";
const url = origin + "/functions/v1/student-results-admin";
const tick = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
const response = (status: number) => new Response(null, { status });
const request = (token = "old") => ({ headers: { Authorization: "Bearer " + token } });
describe("교사 인증 복구", () => {
  it("현재 세션의 401을 서버에서 재확인하고 원래 응답은 그대로 반환한다", async () => {
    const original = response(401);
    const fetch = vi.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(response(403));
    const recovery = createTeacherAuthRecovery(origin, "fixture-anon", fetch);
    const listener = vi.fn(); recovery.subscribe(listener); recovery.trackSession("old");
    expect(await recovery.fetch(url, request())).toBe(original);
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(recovery.trackSession("old")).toBe(false);
    expect(recovery.trackSession("new")).toBe(true);
    expect(fetch.mock.calls[1][0].href).toBe(origin + "/auth/v1/user");
  });
  it.each([200, 500, 429])("인증 서버 응답 %s로는 세션을 해제하지 않는다", async status => {
    const fetch = vi.fn().mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(status));
    const recovery = createTeacherAuthRecovery(origin, "fixture-anon", fetch);
    const listener = vi.fn(); recovery.subscribe(listener); recovery.trackSession("old");
    await recovery.fetch(url, request()); await tick();
    expect(listener).not.toHaveBeenCalled();
    expect(recovery.trackSession("old")).toBe(true);
  });
  it("네트워크 실패는 원래 오류 복구 흐름을 유지한다", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(401)).mockRejectedValueOnce(new TypeError("offline"));
    const recovery = createTeacherAuthRecovery(origin, "fixture-anon", fetch);
    const listener = vi.fn(); recovery.subscribe(listener); recovery.trackSession("old");
    await recovery.fetch(url, request()); await tick();
    expect(listener).not.toHaveBeenCalled();
  });
  it("익명 공개 요청·권한 거절·다른 서버·인증 API에는 재확인을 시작하지 않는다", async () => {
    const fetch = vi.fn(async () => response(401));
    const recovery = createTeacherAuthRecovery(origin, "fixture-anon", fetch);
    recovery.trackSession("old");
    await recovery.fetch(url, request("anon"));
    await recovery.fetch("https://other.invalid/functions/v1/admin", request());
    await recovery.fetch(origin + "/auth/v1/user", request());
    await recovery.fetch(url);
    expect(fetch).toHaveBeenCalledTimes(4);
    fetch.mockResolvedValue(response(403));
    await recovery.fetch(url, request());
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("이전 요청의 늦은 401은 새 로그인이나 갱신 토큰에 적용하지 않는다", async () => {
    let finish!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    const recovery = createTeacherAuthRecovery(origin, "fixture-anon", fetch);
    const listener = vi.fn(); recovery.subscribe(listener); recovery.trackSession("old");
    const pending = recovery.fetch(url, request());
    recovery.trackSession("new"); finish(response(401)); await pending; await tick();
    expect(fetch).toHaveBeenCalledTimes(1); expect(listener).not.toHaveBeenCalled();
  });
  it("재확인 도중 새 로그인이 끝나면 이전 거절을 무시한다", async () => {
    let finish!: (value: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(response(401)).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    const recovery = createTeacherAuthRecovery(origin, "fixture-anon", fetch);
    const listener = vi.fn(); recovery.subscribe(listener); recovery.trackSession("old");
    await recovery.fetch(url, request());
    recovery.trackSession("new"); finish(response(401)); await tick();
    expect(listener).not.toHaveBeenCalled(); expect(recovery.trackSession("new")).toBe(true);
  });
  it("동시 실패는 한 번만 재확인하고 구독 해제한 화면에는 알리지 않는다", async () => {
    let finish!: (value: Response) => void;
    const fetch = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/auth/v1/user")
      ? new Promise<Response>(resolve => { finish = resolve; }) : response(401));
    const recovery = createTeacherAuthRecovery(origin, "fixture-anon", fetch);
    const listener = vi.fn(); const stop = recovery.subscribe(listener); recovery.trackSession("old");
    await Promise.all([recovery.fetch(url, request()), recovery.fetch(new Request(url, request()))]);
    expect(fetch).toHaveBeenCalledTimes(3);
    stop(); finish(response(401)); await tick(); expect(listener).not.toHaveBeenCalled();
    expect(recovery.trackSession("old")).toBe(false);
  });
});
