/** 브라우저와 Edge Function이 함께 사용하는 파일·결정 규칙. */
export const DATA_COLLECT_SUBMISSION_LIMIT = 50 * 1024 * 1024;
export const DATA_COLLECT_TEMPLATE_LIMIT = 30 * 1024 * 1024;
export const DATA_COLLECT_EXTENSIONS = [
  "hwp",
  "hwpx",
  "docx",
  "xlsx",
  "pdf",
  "png",
  "jpg",
  "jpeg",
] as const;
export const validDataCollectDecision = (
  hasTemplate: boolean,
  decision: string,
) =>
  hasTemplate
    ? decision === "confirmed" || decision === "corrected"
    : decision === "submitted";
export const dataCollectFileError = async (
  file: Blob,
  name: string,
  template = false,
): Promise<string | null> => {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  if (!(DATA_COLLECT_EXTENSIONS as readonly string[]).includes(extension))
    return "한글, Word, Excel, PDF 또는 이미지 파일만 올릴 수 있습니다.";
  if (!file.size) return "내용이 없는 파일은 올릴 수 없습니다.";
  if (
    file.size >
    (template ? DATA_COLLECT_TEMPLATE_LIMIT : DATA_COLLECT_SUBMISSION_LIMIT)
  )
    return template
      ? "배포 파일은 최대 30MiB입니다."
      : "제출 파일은 최대 50MiB입니다.";
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const starts = (prefix: number[]) =>
    prefix.every((value, index) => bytes[index] === value);
  const valid =
    extension === "pdf"
      ? starts([0x25, 0x50, 0x44, 0x46])
      : extension === "png"
        ? starts([0x89, 0x50, 0x4e, 0x47])
        : extension === "jpg" || extension === "jpeg"
          ? starts([0xff, 0xd8, 0xff])
          : extension === "hwp"
            ? starts([0xd0, 0xcf, 0x11, 0xe0])
            : starts([0x50, 0x4b, 0x03, 0x04]);
  return valid ? null : "파일 확장자와 실제 파일 형식이 일치하지 않습니다.";
};
