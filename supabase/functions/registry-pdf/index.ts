import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import { PDFDocument, PDFImage, PDFFont, PDFPage, rgb } from 'npm:pdf-lib@1.17.1';
import { fitPdfFontSize, getPdfColumnWidths, getPdfPageSettings, paginatePdfRows } from './layout.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const jsonResponse = (status: number, error: string) => new Response(
  JSON.stringify({ error }),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } },
);

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service environment is not configured.');

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 40.5;
const TABLE_TOP = 704;
const TABLE_BOTTOM = 62;
const TABLE_GAP = 12;
const HEADER_HEIGHT = 32;
const BORDER_COLOR = rgb(0.53, 0.58, 0.65);
const TEXT_COLOR = rgb(0.06, 0.09, 0.15);
const MUTED_COLOR = rgb(0.2, 0.25, 0.33);
const HEADER_COLOR = rgb(0.945, 0.957, 0.969);
const BLUE = rgb(0.059, 0.424, 0.741);

interface RegistryRow {
  id: string;
  owner_id: string;
  title: string;
  left_header: string;
  right_header: string;
  layout: 10 | 15 | 20 | 30;
}

interface ColumnRow {
  id: string;
  label: string;
  position: number;
}

interface ParticipantRow {
  id: string;
  row_number: number;
  name: string;
  field_values: Record<string, string> | null;
}

interface SignatureRow {
  participant_id: string;
  storage_path: string;
}

const centeredX = (font: PDFFont, text: string, size: number, x: number, width: number) => (
  x + Math.max(0, (width - font.widthOfTextAtSize(text, size)) / 2)
);

const drawCellText = (
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  preferredSize: number,
  minimumSize: number,
) => {
  if (!text) return;
  const clean = text.replace(/\s+/g, ' ').trim();
  const size = fitPdfFontSize(font.widthOfTextAtSize(clean, 1), width - 8, preferredSize, minimumSize);
  page.drawText(clean, {
    x: centeredX(font, clean, size, x, width),
    y: y + (height - size) / 2 + 1.5,
    size,
    font,
    color: TEXT_COLOR,
  });
};

const drawHeaderText = (
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  width: number,
  align: 'left' | 'right',
) => {
  const lines = text.split(/\r?\n/).slice(0, 2);
  lines.forEach((line, index) => {
    const clean = line.trim();
    const size = fitPdfFontSize(font.widthOfTextAtSize(clean, 1), width, 9.5, 7);
    const textWidth = font.widthOfTextAtSize(clean, size);
    page.drawText(clean, {
      x: align === 'right' ? x + width - textWidth : x,
      y: y - index * 12,
      size,
      font,
      color: MUTED_COLOR,
    });
  });
};

const drawSignature = (
  page: PDFPage,
  image: PDFImage | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  if (!image) return;
  const availableWidth = Math.max(1, width - 8);
  const availableHeight = Math.max(1, height - 8);
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  page.drawImage(image, {
    x: x + (width - imageWidth) / 2,
    y: y + (height - imageHeight) / 2,
    width: imageWidth,
    height: imageHeight,
  });
};

const drawTable = (
  page: PDFPage,
  regularFont: PDFFont,
  boldFont: PDFFont,
  columns: ColumnRow[],
  participants: Array<ParticipantRow | undefined>,
  signatures: Map<string, PDFImage>,
  rowsPerColumn: number,
  compact: boolean,
  x: number,
  width: number,
) => {
  const tableHeight = TABLE_TOP - TABLE_BOTTOM;
  const bodyHeight = tableHeight - HEADER_HEIGHT;
  const rowHeight = bodyHeight / rowsPerColumn;
  const widths = getPdfColumnWidths(width, compact, columns.length);
  const allWidths = [widths.number, widths.name, ...widths.fields, widths.signature];
  const labels = ['연번', '성명', ...columns.map((column) => column.label), '서명'];

  page.drawRectangle({ x, y: TABLE_BOTTOM, width, height: tableHeight, borderWidth: 0.75, borderColor: BORDER_COLOR });
  page.drawRectangle({ x, y: TABLE_TOP - HEADER_HEIGHT, width, height: HEADER_HEIGHT, color: HEADER_COLOR });

  let currentX = x;
  labels.forEach((label, index) => {
    drawCellText(page, boldFont, label, currentX, TABLE_TOP - HEADER_HEIGHT, allWidths[index], HEADER_HEIGHT, compact ? 8 : 9.5, 6.5);
    currentX += allWidths[index];
    if (index < labels.length - 1) {
      page.drawLine({ start: { x: currentX, y: TABLE_BOTTOM }, end: { x: currentX, y: TABLE_TOP }, thickness: 0.75, color: BORDER_COLOR });
    }
  });

  page.drawLine({ start: { x, y: TABLE_TOP - HEADER_HEIGHT }, end: { x: x + width, y: TABLE_TOP - HEADER_HEIGHT }, thickness: 0.75, color: BORDER_COLOR });
  for (let rowIndex = 0; rowIndex < rowsPerColumn; rowIndex += 1) {
    const rowTop = TABLE_TOP - HEADER_HEIGHT - rowIndex * rowHeight;
    const rowBottom = rowTop - rowHeight;
    const participant = participants[rowIndex];
    if (participant) {
      const values = columns.map((column) => participant.field_values?.[column.id] ?? '');
      const cells = [String(participant.row_number), participant.name, ...values];
      let cellX = x;
      cells.forEach((value, index) => {
        drawCellText(page, index === 1 ? boldFont : regularFont, value, cellX, rowBottom, allWidths[index], rowHeight, compact ? 7.5 : 9.5, 5.5);
        cellX += allWidths[index];
      });
      drawSignature(page, signatures.get(participant.id), cellX, rowBottom, widths.signature, rowHeight);
    }
    if (rowIndex < rowsPerColumn - 1) {
      page.drawLine({ start: { x, y: rowBottom }, end: { x: x + width, y: rowBottom }, thickness: 0.75, color: BORDER_COLOR });
    }
  }
};

const loadSignatureImages = async (
  pdf: PDFDocument,
  rows: SignatureRow[],
) => {
  const images = new Map<string, PDFImage>();
  for (const row of rows) {
    const { data, error } = await db.storage.from('registry-signatures').download(row.storage_path);
    if (error || !data) continue;
    const bytes = new Uint8Array(await data.arrayBuffer());
    try {
      const image = data.type === 'image/jpeg' || row.storage_path.toLowerCase().endsWith('.jpg')
        ? await pdf.embedJpg(bytes)
        : await pdf.embedPng(bytes);
      images.set(row.participant_id, image);
    } catch {
      console.warn('Unsupported registry signature image skipped', row.storage_path);
    }
  }
  return images;
};

const createPdf = async (
  registry: RegistryRow,
  columns: ColumnRow[],
  participants: ParticipantRow[],
  signatureRows: SignatureRow[],
) => {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    Deno.readFile(new URL('./assets/NanumGothic-Regular.ttf', import.meta.url)),
    Deno.readFile(new URL('./assets/NanumGothic-Bold.ttf', import.meta.url)),
  ]);
  const [regularFont, boldFont] = await Promise.all([
    pdf.embedFont(regularBytes, { subset: true }),
    pdf.embedFont(boldBytes, { subset: true }),
  ]);
  const signatures = await loadSignatureImages(pdf, signatureRows);
  const settings = getPdfPageSettings(registry.layout);
  const pageSize = settings.tableColumns * settings.rowsPerColumn;
  const pages = paginatePdfRows(participants, pageSize);

  pages.forEach((pageParticipants, pageIndex) => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawLine({ start: { x: PAGE_MARGIN, y: 796 }, end: { x: PAGE_WIDTH - PAGE_MARGIN, y: 796 }, thickness: 3, color: BLUE });

    const title = registry.title.trim();
    const titleSize = fitPdfFontSize(boldFont.widthOfTextAtSize(title, 1), PAGE_WIDTH - PAGE_MARGIN * 2, 18, 11);
    page.drawText(title, {
      x: centeredX(boldFont, title, titleSize, PAGE_MARGIN, PAGE_WIDTH - PAGE_MARGIN * 2),
      y: 756,
      size: titleSize,
      font: boldFont,
      color: TEXT_COLOR,
    });
    const headerWidth = (PAGE_WIDTH - PAGE_MARGIN * 2 - 18) / 2;
    drawHeaderText(page, regularFont, registry.left_header, PAGE_MARGIN, 728, headerWidth, 'left');
    drawHeaderText(page, regularFont, registry.right_header, PAGE_MARGIN + headerWidth + 18, 728, headerWidth, 'right');

    const tableWidth = settings.tableColumns === 2
      ? (PAGE_WIDTH - PAGE_MARGIN * 2 - TABLE_GAP) / 2
      : PAGE_WIDTH - PAGE_MARGIN * 2;
    for (let tableIndex = 0; tableIndex < settings.tableColumns; tableIndex += 1) {
      const tableRows = pageParticipants.slice(
        tableIndex * settings.rowsPerColumn,
        (tableIndex + 1) * settings.rowsPerColumn,
      );
      drawTable(
        page,
        regularFont,
        boldFont,
        columns,
        tableRows,
        signatures,
        settings.rowsPerColumn,
        settings.tableColumns === 2,
        PAGE_MARGIN + tableIndex * (tableWidth + TABLE_GAP),
        tableWidth,
      );
    }

    const footer = `- ${pageIndex + 1} -`;
    page.drawText(footer, {
      x: centeredX(regularFont, footer, 8.5, 0, PAGE_WIDTH),
      y: 34,
      size: 8.5,
      font: regularFont,
      color: MUTED_COLOR,
    });
  });

  pdf.setTitle(registry.title);
  pdf.setCreator('SchoolDoc');
  return pdf.save();
};

const safeFileName = (title: string) => `${title.replace(/[\\/:*?"<>|]/g, '_') || '등록부'}.pdf`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, '허용되지 않은 요청입니다.');

  try {
    const authorization = request.headers.get('Authorization') ?? '';
    const accessToken = authorization.replace(/^Bearer\s+/i, '');
    if (!accessToken) throw new HttpError(401, 'Google 로그인이 필요합니다.');
    const { data: userData, error: userError } = await db.auth.getUser(accessToken);
    if (userError || !userData.user) throw new HttpError(401, '로그인 정보를 확인하지 못했습니다.');

    const body = await request.json() as { registryId?: unknown };
    const registryId = typeof body.registryId === 'string' ? body.registryId : '';
    const { data: registryData, error: registryError } = await db
      .from('registries')
      .select('id, owner_id, title, left_header, right_header, layout')
      .eq('id', registryId)
      .eq('owner_id', userData.user.id)
      .maybeSingle();
    if (registryError) throw registryError;
    if (!registryData) throw new HttpError(404, '등록부를 찾을 수 없거나 접근 권한이 없습니다.');
    const registry = registryData as RegistryRow;

    const [columnsResult, participantsResult, signaturesResult] = await Promise.all([
      db.from('registry_columns').select('id, label, position').eq('registry_id', registry.id).order('position'),
      db.from('registry_participants').select('id, row_number, name, field_values').eq('registry_id', registry.id).order('row_number'),
      db.from('registry_signatures').select('participant_id, storage_path').eq('registry_id', registry.id),
    ]);
    if (columnsResult.error) throw columnsResult.error;
    if (participantsResult.error) throw participantsResult.error;
    if (signaturesResult.error) throw signaturesResult.error;

    const pdfBytes = await createPdf(
      registry,
      (columnsResult.data ?? []) as ColumnRow[],
      (participantsResult.data ?? []) as ParticipantRow[],
      (signaturesResult.data ?? []) as SignatureRow[],
    );
    const fileName = safeFileName(registry.title);
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="registry.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse(error.status, error.message);
    console.error('registry-pdf failed', error);
    return jsonResponse(500, 'PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
});
