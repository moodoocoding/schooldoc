import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dataCollectDraftKey,
  readDataCollectDraft,
} from "../../src/features/dataCollect/dataCollectDraft";
import {
  dataCollectFileError,
  DATA_COLLECT_TEMPLATE_LIMIT,
  DATA_COLLECT_SUBMISSION_LIMIT,
  validDataCollectDecision,
} from "../../supabase/functions/_shared/dataCollectRules";
import {
  collectionDecisionLabel,
  collectionStateLabel,
  isCollectionOpen,
} from "../../src/features/dataCollect/dataCollectUtils";
const { overview, list } = vi.hoisted(() => ({
  overview: vi.fn(),
  list: vi.fn(),
}));
vi.mock("../../src/features/dataCollect/dataCollectConfig", () => ({
  isDataCollectDemoMode: false,
}));
vi.mock("../../src/features/dataCollect/dataCollectAdminApi", () => ({
  getRemoteDataCollectionOverview: overview,
  listRemoteDataCollectionSummaries: list,
}));
import {
  clearDataCollectQueryCache,
  getDataCollectionOverview,
  listDataCollectionSummaries,
} from "../../src/features/dataCollect/dataCollectService";
describe("자료 수합 DB 최적화 경계", () => {
  beforeEach(() => {
    clearDataCollectQueryCache();
    overview.mockReset();
    list.mockReset();
  });
  it("A의 저장 초안과 구버전 초안은 B에게 복원되지 않는다", () => {
    const values = new Map([
      [
        dataCollectDraftKey("A"),
        JSON.stringify({ version: 3, ownerId: "A", title: "가상 A" }),
      ],
      [
        "schooldoc_data_collect_create_v2",
        JSON.stringify({ version: 2, title: "legacy" }),
      ],
    ]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    expect(readDataCollectDraft("A", storage)).toMatchObject({
      title: "가상 A",
    });
    expect(readDataCollectDraft("B", storage)).toBe(null);
    values.set(dataCollectDraftKey("B"), values.get(dataCollectDraftKey("A"))!);
    expect(readDataCollectDraft("B", storage)).toBe(null);
  });
  it("원본 30MiB·제출 50MiB 경계를 같은 규칙으로 적용한다", async () => {
    const sized = (size: number) =>
      ({ size, slice: () => new Blob(["%PDF-1.7"]) }) as Blob;
    expect(
      await dataCollectFileError(
        sized(DATA_COLLECT_TEMPLATE_LIMIT),
        "원본.pdf",
        true,
      ),
    ).toBe(null);
    expect(
      await dataCollectFileError(
        sized(DATA_COLLECT_TEMPLATE_LIMIT + 1),
        "원본.pdf",
        true,
      ),
    ).toContain("30MiB");
    expect(
      await dataCollectFileError(
        sized(DATA_COLLECT_SUBMISSION_LIMIT),
        "제출.pdf",
      ),
    ).toBe(null);
    expect(
      await dataCollectFileError(
        sized(DATA_COLLECT_SUBMISSION_LIMIT + 1),
        "제출.pdf",
      ),
    ).toContain("50MiB");
    expect(await dataCollectFileError(sized(0), "빈.pdf")).not.toBe(null);
  });
  it("파일 수합의 confirmed 우회와 경계 시각 제출을 거부한다", () => {
    expect(validDataCollectDecision(false, "confirmed")).toBe(false);
    expect(validDataCollectDecision(false, "submitted")).toBe(true);
    expect(validDataCollectDecision(true, "submitted")).toBe(false);
    expect(collectionDecisionLabel("submitted")).toBe("제출 완료");
    const time = "2026-10-01T00:00:00Z";
    expect(isCollectionOpen("open", time, new Date(time))).toBe(false);
    expect(collectionStateLabel("open", time, Date.parse(time))).toBe(
      "기한 마감",
    );
  });
  it("중복 조회를 합치고 15초 캐시와 수동 갱신을 구분한다", async () => {
    const value = { collection: { id: "C" }, targets: [], nextAfter: null };
    overview.mockResolvedValue(value);
    await Promise.all([
      getDataCollectionOverview("A", "C"),
      getDataCollectionOverview("A", "C"),
    ]);
    await getDataCollectionOverview("A", "C");
    expect(overview).toHaveBeenCalledTimes(1);
    await getDataCollectionOverview("A", "C", 0, false, true);
    expect(overview).toHaveBeenCalledTimes(2);
    await getDataCollectionOverview("B", "C");
    expect(overview).toHaveBeenCalledTimes(3);
  });
  it("목록 수동 갱신 뒤 다른 페이지 캐시를 유지하고 15초 후 재조회한다", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const cursor = { before: "2026-10-01T00:00:00Z", beforeId: "page-2" };
    list.mockResolvedValue({ collections: [], nextCursor: null });
    try {
      await listDataCollectionSummaries("A");
      await listDataCollectionSummaries("A", cursor);
      expect(list).toHaveBeenCalledTimes(2);
      await listDataCollectionSummaries("A", undefined, true);
      expect(list).toHaveBeenCalledTimes(3);
      await listDataCollectionSummaries("A", cursor);
      await listDataCollectionSummaries("A");
      expect(list).toHaveBeenCalledTimes(3);
      clock.mockReturnValue(16_000);
      await listDataCollectionSummaries("A", cursor);
      expect(list).toHaveBeenCalledTimes(4);
      expect(list).toHaveBeenLastCalledWith(cursor);
    } finally {
      clock.mockRestore();
    }
  });
  it("A→B→A 전환 사이에 끝난 오래된 요청은 새 A 캐시에 섞이지 않는다", async () => {
    let finish: (value: unknown) => void = () => {};
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const old = listDataCollectionSummaries("A");
    list.mockResolvedValue({
      collections: [{ title: "new" }],
      nextCursor: null,
    });
    await listDataCollectionSummaries("B");
    await listDataCollectionSummaries("A");
    finish({ collections: [{ title: "old" }], nextCursor: null });
    await old;
    expect(await listDataCollectionSummaries("A")).toMatchObject({
      collections: [{ title: "new" }],
    });
    expect(list).toHaveBeenCalledTimes(3);
  });
});
