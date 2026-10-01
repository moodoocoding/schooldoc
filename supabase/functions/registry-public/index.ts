import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { registryCrypto, type RegistryFieldValues } from '../_shared/registryCrypto.ts';

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

const response = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } },
);

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service environment is not configured.');

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actionLimits: Record<string, number> = {
  metadata: 360,
  unlock: 180,
  search: 360,
  'walk-in': 180,
  submit: 180,
};

interface RegistryRow {
  id: string;
  public_token: string;
  mode: 'fixed' | 'custom';
  title: string;
  left_header: string;
  right_header: string;
  layout: 10 | 15 | 20 | 30;
  status: 'draft' | 'open' | 'closed';
  allow_walk_in: boolean;
  password_digest: string | null;
}

interface ColumnRow {
  id: string;
  label: string;
  position: number;
}

const hashBytes = async (value: BufferSource) => {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const hashText = (value: string) => hashBytes(new TextEncoder().encode(value));

const cleanValues = (
  value: unknown,
  columns: ColumnRow[],
) => {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, '참석자 정보 형식이 올바르지 않습니다.');
  const allowed = new Set(columns.map((column) => column.id));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, fieldValue]) => {
    if (!allowed.has(key) || typeof fieldValue !== 'string' || fieldValue.length > 200) {
      throw new HttpError(400, '참석자 정보에 허용되지 않은 값이 있습니다.');
    }
    return [key, fieldValue.trim()];
  }));
};

const parseSignature = (dataUrl: unknown) => {
  if (typeof dataUrl !== 'string' || dataUrl.length > 800_000) {
    throw new HttpError(400, '서명 이미지가 너무 큽니다.');
  }
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new HttpError(400, '서명 이미지 형식이 올바르지 않습니다.');

  let bytes: Uint8Array;
  try {
    const binary = atob(match[2]);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new HttpError(400, '서명 이미지를 읽지 못했습니다.');
  }
  if (bytes.length < 16 || bytes.length > 512_000) throw new HttpError(400, '서명 이미지는 500KB 이하만 제출할 수 있습니다.');

  const type = match[1] as 'png' | 'jpeg' | 'webp';
  const validMagic = type === 'png'
    ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    : type === 'jpeg'
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
        && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!validMagic) throw new HttpError(400, '서명 이미지 내용이 올바르지 않습니다.');

  return {
    bytes,
    extension: type === 'jpeg' ? 'jpg' : type,
    contentType: `image/${type}`,
  };
};

/**
 * 공개 화면으로 나가는 이름과 항목 값은 서버에서 가린다.
 *
 * 예전에는 원문을 보내고 브라우저가 별표로 덮어 보여줬다. 화면만 가려질 뿐 응답에는 원문이
 * 그대로 있어, 링크를 아는 사람이 검색을 반복하면 명단을 통째로 긁을 수 있었다.
 */
const maskName = (name: string) => {
  if (name.length <= 1) return '*';
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${'*'.repeat(name.length - 2)}${name.at(-1)}`;
};

const maskValue = (value: string) => {
  if (!value) return '';
  if (value.length <= 2) return `${value[0]}*`;
  return `${value.slice(0, 2)}${'*'.repeat(Math.min(4, value.length - 2))}`;
};

const maskFieldValues = (values: unknown) => Object.fromEntries(
  Object.entries((values ?? {}) as Record<string, unknown>)
    .map(([key, value]) => [key, maskValue(typeof value === 'string' ? value : '')]),
);

/**
 * 암호문이 있으면 풀고, 없으면 옛 평문을 쓴다.
 * 재암호화를 마치기 전까지 두 가지가 섞여 있으므로 읽는 쪽이 둘 다 감당한다.
 */
const decodeFieldValues = async (participant: Record<string, unknown>): Promise<RegistryFieldValues> => {
  const ciphertext = participant.field_values_ciphertext;
  if (typeof ciphertext === 'string' && ciphertext) {
    return await registryCrypto.decryptPayload<RegistryFieldValues>(ciphertext);
  }
  return (participant.field_values ?? {}) as RegistryFieldValues;
};

const participantResponse = (participant: Record<string, unknown>) => ({
  id: participant.id,
  rowNumber: participant.row_number,
  name: maskName(String(participant.name ?? '')),
  values: maskFieldValues(participant.field_values),
  signed: participant.status === 'signed',
  signedAt: participant.signed_at ?? undefined,
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: '허용되지 않은 요청입니다.' });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const token = typeof body.token === 'string' ? body.token : '';
    if (!Object.hasOwn(actionLimits, action) || !uuidPattern.test(token)) throw new HttpError(400, '요청 형식이 올바르지 않습니다.');
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length > 200) throw new HttpError(400, '비밀번호 길이를 확인해 주세요.');
    const participantId = typeof body.participantId === 'string' && uuidPattern.test(body.participantId) ? body.participantId : null;
    if (action === 'search' && (query.length < 2 || query.length > 100)) throw new HttpError(400, '검색어를 두 글자 이상 입력해 주세요.');
    const code = typeof body.code === 'string' ? body.code : '';
    if (code.length > 100) throw new HttpError(400, '확인 코드를 확인해 주세요.');
    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { data: context, error: contextError } = await db.rpc('registry_public_context', {
      p_token: token, p_action: action, p_ip_key: await hashText(ip), p_password: password,
      p_query: action === 'walk-in' ? name : query, p_participant_id: participantId, p_code: code,
    });
    if (contextError) throw contextError;
    if (context.error) throw new HttpError(context.status, context.error);
    const registry = context.registry as RegistryRow & { owner_id: string };
    const columns = context.columns as ColumnRow[];
    if (action === 'metadata') return response(200, { registry: {
      id: registry.id, publicToken: registry.public_token, title: registry.title,
      leftHeader: registry.left_header, rightHeader: registry.right_header, mode: registry.mode,
      status: registry.status === 'draft' ? 'closed' : registry.status, layout: registry.layout,
      allowWalkIn: registry.allow_walk_in, hasPassword: Boolean(context.has_password),
      columns: columns.map((c) => ({ id: c.id, label: c.label })),
    }});
    if (action === 'unlock') return response(200, { ok: true });
    if (action === 'search') {
      if (registry.mode !== 'fixed') throw new HttpError(400, '검색할 사전 명단이 없습니다.');
      const found = await Promise.all(context.participants.map(async (p: Record<string, unknown>) => ({
        ...participantResponse(p), values: maskFieldValues(await decodeFieldValues(p)),
        requiresIdentity: p.requires_identity === true, requiresCode: p.requires_code === true,
      })));
      return response(200, { participants: found });
    }
    if (action === 'walk-in') {
      if (!registry.allow_walk_in && registry.mode !== 'custom') throw new HttpError(403, '현장 참석자 추가가 허용되지 않습니다.');
      if (name.length < 1 || name.length > 100) throw new HttpError(400, '성명을 확인해 주세요.');
      const values = cleanValues(body.values, columns);
      if (context.duplicate_count > 0 && body.confirmDuplicate !== true) return response(200, { duplicateCount: context.duplicate_count });
      // 최종 제출 전에는 참석자 행을 만들지 않는다. 취소한 초안은 이 브라우저 메모리에만 있다.
      return response(200, { participants: [{ id: crypto.randomUUID(), rowNumber: 0, name: maskName(name), values: maskFieldValues(values), signed: false }] });
    }
    if (action === 'submit') {
      if (!participantId) throw new HttpError(400, '참석자를 확인해 주세요.');
      const source = body.source === 'draw' || body.source === 'photo' ? body.source : null;
      const width = Number(body.width), height = Number(body.height);
      if (!source || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 5000 || height > 5000) throw new HttpError(400, '서명 이미지 크기가 올바르지 않습니다.');
      const requestId = typeof body.requestId === 'string' && uuidPattern.test(body.requestId) ? body.requestId : crypto.randomUUID();
      const signature = parseSignature(body.dataUrl);
      const contentHash = await hashBytes(new Uint8Array(signature.bytes).buffer);
      const canonical = (value: unknown) => Object.fromEntries(Object.entries((value ?? {}) as Record<string, unknown>).toSorted(([a],[b]) => a.localeCompare(b)));
      const requestDigest = await hashText(JSON.stringify([participantId, contentHash, source, width, height, canonical(body.values), body.walkInName ?? '', canonical(body.walkInValues), body.confirmDuplicate === true]));
      const participant = context.participant as Record<string, unknown> | null;
      const previous = context.prior_signature;
      if (previous) {
        if (previous.request_id === requestId && previous.content_hash === contentHash && previous.request_digest === requestDigest) return response(200, { ok: true });
        throw new HttpError(409, '이미 서명이 제출되었습니다.');
      }
      const walkInName = typeof body.walkInName === 'string' ? body.walkInName.trim() : '';
      if (!participant && !walkInName) throw new HttpError(404, '참석자를 찾을 수 없습니다.');
      const submitted = cleanValues(body.values, columns);
      const initial = participant ? await decodeFieldValues(participant) : cleanValues(body.walkInValues, columns);
      const peers = context.peers as Record<string, unknown>[];
      if (participant && (peers.length > 1 || participant.requires_code)) {
        if (participant.requires_code) {
          if (participant.code_valid !== true) throw new HttpError(401, '교사가 안내한 본인 확인 코드를 입력해 주세요.');
        } else {
          const verify = cleanValues(body.verificationValues, columns);
          const verifyName = typeof body.verifyName === 'string' ? body.verifyName.trim() : '';
          if (verifyName !== participant.name || columns.length === 0) throw new HttpError(401, '동명이인은 성명과 소속을 확인하거나 교사에게 확인 코드를 요청해 주세요.');
          const matches = [];
          for (const peer of peers) {
            const actual = await decodeFieldValues(peer);
            if (columns.every((c) => actual[c.id]?.trim() === verify[c.id]?.trim() && Boolean(verify[c.id]))) matches.push(peer.id);
          }
          if (matches.length !== 1 || matches[0] !== participantId) throw new HttpError(401, '본인 정보로 구분하지 못했습니다. 교사에게 확인 코드를 요청해 주세요.');
        }
      }
      const filled = Object.fromEntries(Object.entries(submitted).filter(([, v]) => v !== ''));
      // 암호화 실패는 업로드/서명 저장 전에 중단한다.
      const ciphertext = await registryCrypto.encryptPayload({ ...initial, ...filled });
      // HTTP 시도마다 다른 파일을 써서 실패한 재시도가 동시 성공 요청의 파일을 지우지 않는다.
      const storageFileName = `${requestId}-${contentHash}-${crypto.randomUUID()}.${signature.extension}`;
      const storagePath = `${registry.id}/${participantId}/${storageFileName}`;
      const { error: uploadError } = await db.storage.from('registry-signatures').upload(storagePath, signature.bytes, { contentType: signature.contentType, upsert: false });
      if (uploadError) throw uploadError;
      const { data: saved, error: saveError } = await db.rpc('registry_commit_signature', {
        p_registry_id: registry.id, p_token: token, p_password: password, p_participant_id: participantId,
        p_request_id: requestId, p_expected_updated_at: participant?.updated_at ?? null,
        p_name: participant ? null : walkInName, p_ciphertext: ciphertext, p_source: source,
        p_path: storagePath, p_hash: contentHash, p_width: width, p_height: height,
        p_request_digest: requestDigest, p_confirm_duplicate: body.confirmDuplicate === true,
      });
      const cleanAttemptUpload = async () => {
        const removed = await db.storage.from('registry-signatures').remove([storagePath]);
        const { data: remaining, error: listError } = await db.storage.from('registry-signatures').list(`${registry.id}/${participantId}`);
        if (removed.error || listError || remaining?.some((f) => f.name === storageFileName)) {
          const { error: recordError } = await db.from('registry_cleanup_attempts').insert({ owner_id: registry.owner_id, registry_id: registry.id, purpose: 'upload', file_count: 1 });
          if (recordError) throw recordError;
        }
      };
      if (saved?.replayed) {
        await cleanAttemptUpload();
        return response(200, { ok: true });
      }
      if (saveError) {
        // 응답 유실일 수 있으므로 파일을 먼저 지우지 않는다. 저장 결과를 확인한다.
        const { data: persisted, error: verifyError } = await db.from('registry_signatures').select('request_id,content_hash,request_digest,storage_path').eq('participant_id',participantId).eq('registry_id',registry.id).maybeSingle();
        if (!verifyError && persisted?.request_id === requestId && persisted.content_hash === contentHash && persisted.request_digest === requestDigest) {
          if (persisted.storage_path !== storagePath) await cleanAttemptUpload();
          return response(200, { ok: true });
        }
        if (verifyError) {
          const { error: recordError } = await db.from('registry_cleanup_attempts').insert({ owner_id: registry.owner_id, registry_id: registry.id, purpose: 'upload', file_count: 1 });
          if (recordError) throw recordError;
          throw saveError;
        }
      }
      if (saveError || saved?.error) {
        await cleanAttemptUpload();
        if (saved?.error) throw new HttpError(saved.status, saved.error);
        throw saveError;
      }
      return response(200, { ok: true });
    }
    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return response(error.status, { error: error.message });
    console.error('registry-public request failed');
    return response(500, { error: '서명 요청을 처리하지 못했습니다. 입력과 서명을 유지한 채 다시 시도해 주세요.' });
  }
});
