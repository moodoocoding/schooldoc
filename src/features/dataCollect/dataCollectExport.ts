import type { DataCollectionExport } from "./types";
import { collectionDecisionLabel } from "./dataCollectUtils";

export const saveDataCollectBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
};
export const safeCollectionFileName = (value: string) =>
  Array.from(value)
    .map((c) => (c.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(c) ? "_" : c))
    .join("")
    .slice(0, 160) || "자료수합";
export const exportDataCollectExcel = async (data: DataCollectionExport) => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = [
    "번호",
    "제출 대상",
    "구분 정보",
    "상태",
    "최근 회신",
    "버전",
    "파일명",
    "전달 사항",
  ];
  await writeXlsxFile(
    [
      header.map((value) => ({
        value,
        fontWeight: "bold" as const,
        backgroundColor: "#F1F5F9",
      })),
      ...data.rows.map((t) => [
        { value: t.rowNumber },
        { value: t.label },
        { value: t.owner },
        {
          value: t.needsRepair
            ? "기록 확인 필요"
            : collectionDecisionLabel(t.submission?.decision, data.hasTemplate),
        },
        {
          value: t.submission
            ? new Date(t.submission.uploadedAt).toLocaleString("ko-KR")
            : "",
        },
        { value: t.submission?.revision ?? "" },
        { value: t.fileName ?? "" },
        { value: t.note ?? "" },
      ]),
    ],
    {
      columns: [
        { width: 8 },
        { width: 20 },
        { width: 16 },
        { width: 18 },
        { width: 26 },
        { width: 8 },
        { width: 30 },
        { width: 48 },
      ],
    },
  ).toFile(safeCollectionFileName(data.title) + "_회신현황.xlsx");
};
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
/** ZIP 저장 방식. 추가 압축 작업/서버 전송 없이 이미 받은 원본을 묶는다. */
export const dataCollectZip = (
  entries: Array<{ name: string; bytes: Uint8Array }>,
) => {
  const parts: ArrayBuffer[] = [],
    directory: ArrayBuffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name),
      crc = crc32(entry.bytes),
      size = entry.bytes.length;
    const local = new Uint8Array(30 + name.length),
      v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint16(12, 33, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, size, true);
    v.setUint32(22, size, true);
    v.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length),
      c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, size, true);
    c.setUint32(24, size, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);
    parts.push(local.buffer, entry.bytes.slice().buffer);
    directory.push(central.buffer);
    offset += local.length + size;
  }
  const directorySize = directory.reduce((n, b) => n + b.byteLength, 0),
    end = new ArrayBuffer(22),
    v = new DataView(end);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, entries.length, true);
  v.setUint16(10, entries.length, true);
  v.setUint32(12, directorySize, true);
  v.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: "application/zip" });
};
