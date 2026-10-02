import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { invoke, getUser, upload } = vi.hoisted(() => ({ invoke: vi.fn(), getUser: vi.fn(), upload: vi.fn() }));
vi.mock("../../src/utils/supabaseClient", () => ({
  supabase: { auth: { getUser }, functions: { invoke }, storage: { from: () => ({ uploadToSignedUrl: upload }) } },
}));
import { createRemoteDataCollection, updateRemoteDataCollectionDue } from "../../src/features/dataCollect/dataCollectAdminApi";
const draft = { title: "가상 수합", description: "", kind: "custom" as const, mode: "custom" as const, allowResubmit: true, dueAt: "2026-10-09T17:00", password: "", retentionMonths: 12, targets: [] };
describe("자료 수합 관리 API의 마감 전송", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
    invoke.mockReset(); getUser.mockReset(); upload.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "virtual-teacher" } }, error: null });
    invoke.mockResolvedValue({ data: { id: "virtual-collection" }, error: null });
  });
  afterEach(() => vi.useRealTimers());
  it("생성과 변경은 같은 현지 시각을 UTC로 전송한다", async () => {
    const utc = new Date(2026, 9, 9, 17).toISOString();
    await createRemoteDataCollection(draft);
    expect(invoke.mock.calls[0][1].body).toMatchObject({ action: "create", dueAt: utc });
    await updateRemoteDataCollectionDue("virtual-collection", draft.dueAt);
    expect(invoke.mock.calls[1][1].body).toMatchObject({ action: "due", dueAt: utc });
  });
  it("이미 UTC인 변경 값과 기한 없음은 그대로 보존한다", async () => {
    await updateRemoteDataCollectionDue("virtual-collection", "2026-10-09T08:00:00.000Z");
    expect(invoke.mock.calls[0][1].body.dueAt).toBe("2026-10-09T08:00:00.000Z");
    await createRemoteDataCollection({ ...draft, dueAt: "" });
    expect(invoke.mock.calls[1][1].body.dueAt).toBe("");
  });
  it("잘못되거나 지난 마감은 인증·업로드·생성 요청 전에 거절한다", async () => {
    const file = new File(["%PDF-1.7"], "가상.pdf", { type: "application/pdf" });
    for (const dueAt of ["2026-02-30T17:00", "2026-10-01T17:00"]) {
      await expect(createRemoteDataCollection({ ...draft, dueAt }, file)).rejects.toThrow("마감");
    }
    expect(getUser).not.toHaveBeenCalled(); expect(invoke).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
    expect(() => updateRemoteDataCollectionDue("virtual-collection", "bad")).toThrow("마감");
  });
});
