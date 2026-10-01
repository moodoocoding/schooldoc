import { beforeEach, describe, expect, it, vi } from "vitest";
const { invoke, upload } = vi.hoisted(() => ({
  invoke: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../../src/utils/supabaseClient", () => ({
  supabase: {
    functions: { invoke },
    storage: { from: () => ({ uploadToSignedUrl: upload }) },
  },
}));
import { submitRemoteDataCollectReview } from "../../src/features/dataCollect/dataCollectPublicApi";
const goodFile = () =>
  new File(["%PDF-1.7\nvirtual\n%%EOF"], "가상.pdf", {
    type: "application/pdf",
  });
describe("자료 수합 전송 재시도", () => {
  beforeEach(() => {
    invoke.mockReset();
    upload.mockReset();
    upload.mockResolvedValue({ error: null });
  });
  it("응답이 실패해도 같은 요청 ID와 이미 올린 파일을 재사용한다", async () => {
    const id = crypto.randomUUID(),
      file = goodFile();
    invoke.mockImplementation(async (_name, { body }) => {
      if (body.action === "prepare-upload")
        return {
          data: {
            path: "C/pending/" + id + "/file.pdf",
            token: "virtual-upload-token",
            personalToken: "P",
          },
          error: null,
        };
      if (
        invoke.mock.calls.filter((c) => c[1].body.action === "submit")
          .length === 1
      )
        return {
          error: {
            context: new Response(JSON.stringify({ error: "일시적인 실패" }), {
              status: 500,
            }),
          },
        };
      return {
        data: {
          submitted: true,
          revision: 1,
          decision: "submitted",
          personalToken: "P",
        },
        error: null,
      };
    });
    await expect(
      submitRemoteDataCollectReview(
        "C",
        "P",
        "submitted",
        "",
        file,
        "가상 메모",
        "가상 이름",
        id,
      ),
    ).rejects.toThrow("일시적인 실패");
    await expect(
      submitRemoteDataCollectReview(
        "C",
        "P",
        "submitted",
        "",
        file,
        "가상 메모",
        "가상 이름",
        id,
      ),
    ).resolves.toMatchObject({ revision: 1 });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(
      invoke.mock.calls.filter((c) => c[1].body.action === "prepare-upload"),
    ).toHaveLength(1);
    const submits = invoke.mock.calls
      .filter((c) => c[1].body.action === "submit")
      .map((c) => c[1].body);
    expect(submits[0]).toEqual(submits[1]);
    expect(submits[0].requestId).toBe(id);
  });
  it("위장 파일은 업로드 예약과 실제 Storage 전송 전에 거부한다", async () => {
    await expect(
      submitRemoteDataCollectReview(
        "C",
        "P",
        "submitted",
        "",
        new File(["bad"], "위장.pdf"),
      ),
    ).rejects.toThrow("실제 파일 형식");
    expect(invoke).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});
