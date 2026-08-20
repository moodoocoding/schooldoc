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
  metadata: 60,
  unlock: 10,
  search: 30,
  'walk-in': 10,
  submit: 10,
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

const consumeRateLimit = async (request: Request, action: string, token: string) => {
  const ip = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  const key = await hashText(`${ip}:${token}:${action}`);
  const { data, error } = await db.rpc('consume_registry_rate_limit', {
    p_request_key: key,
    p_window_seconds: 60,
    p_max_requests: actionLimits[action] ?? 10,
  });
  if (error) throw error;
  if (!data) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
};

const getRegistry = async (token: string) => {
  const { data, error } = await db
    .from('registries')
    .select('id, public_token, mode, title, left_header, right_header, layout, status, allow_walk_in, password_digest')
    .eq('public_token', token)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '등록부를 찾을 수 없습니다.');
  return data as RegistryRow;
};

const getColumns = async (registryId: string) => {
  const { data, error } = await db
    .from('registry_columns')
    .select('id, label, position')
    .eq('registry_id', registryId)
    .order('position');
  if (error) throw error;
  return (data ?? []) as ColumnRow[];
};

const verifyPassword = async (registry: RegistryRow, password: unknown) => {
  if (!registry.password_digest) return;
  if (typeof password !== 'string' || password.length > 200) {
    throw new HttpError(401, '비밀번호가 맞지 않습니다.');
  }
  const { data, error } = await db.rpc('verify_registry_password', {
    p_registry_id: registry.id,
    p_password: password,
  });
  if (error) throw error;
  if (!data) throw new HttpError(401, '비밀번호가 맞지 않습니다.');
};

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
    if (!Object.hasOwn(actionLimits, action) || !uuidPattern.test(token)) {
      throw new HttpError(400, '요청 형식이 올바르지 않습니다.');
    }

    await consumeRateLimit(request, action, token);
    const registry = await getRegistry(token);
    const columns = await getColumns(registry.id);

    if (action === 'metadata') {
      return response(200, {
        registry: {
          id: registry.id,
          publicToken: registry.public_token,
          title: registry.title,
          leftHeader: registry.left_header,
          rightHeader: registry.right_header,
          mode: registry.mode,
          status: registry.status === 'draft' ? 'closed' : registry.status,
          layout: registry.layout,
          allowWalkIn: registry.allow_walk_in,
          hasPassword: Boolean(registry.password_digest),
          columns: columns.map((column) => ({ id: column.id, label: column.label })),
        },
      });
    }

    await verifyPassword(registry, body.password);
    if (action === 'unlock') return response(200, { ok: true });
    if (registry.status !== 'open') throw new HttpError(409, '서명 수합이 종료되었습니다.');

    if (action === 'search') {
      if (registry.mode !== 'fixed') throw new HttpError(400, '검색할 사전 명단이 없습니다.');
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (query.length < 2 || query.length > 100) throw new HttpError(400, '검색어를 두 글자 이상 입력해 주세요.');
      const { data, error } = await db.rpc('search_registry_participants', {
        p_registry_id: registry.id,
        p_query: query,
        p_limit: 10,
      });
      if (error) throw error;
      const found = await Promise.all((data ?? []).map(async (participant: Record<string, unknown>) => ({
        ...participantResponse(participant),
        values: maskFieldValues(await decodeFieldValues(participant)),
      })));
      return response(200, { participants: found });
    }

    if (action === 'walk-in') {
      if (!registry.allow_walk_in && registry.mode !== 'custom') throw new HttpError(403, '현장 참석자 추가가 허용되지 않습니다.');
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (name.length < 1 || name.length > 100) throw new HttpError(400, '성명을 확인해 주세요.');
      const values = cleanValues(body.values, columns);

      // 행사장에서는 이미 명단에 있는 사람이 자기를 못 찾고 다시 등록하는 일이 잦다.
      // 같은 이름이 있으면 한 번 되묻고, 그래도 등록하겠다면 그때 만든다.
      if (body.confirmDuplicate !== true) {
        const { count, error: duplicateError } = await db
          .from('registry_participants')
          .select('id', { count: 'exact', head: true })
          .eq('registry_id', registry.id)
          .eq('name', name);
        if (duplicateError) throw duplicateError;
        if ((count ?? 0) > 0) return response(200, { duplicateCount: count ?? 0 });
      }

      const { data, error } = await db.rpc('create_registry_walk_in', {
        p_registry_id: registry.id,
        p_name: name,
        p_field_values: {},
      });
      if (error) throw error;
      const created = data as Record<string, unknown>;
      const { error: sealError } = await db.from('registry_participants')
        .update({ field_values: null, field_values_ciphertext: await registryCrypto.encryptPayload(values) })
        .eq('id', created.id as string);
      if (sealError) throw sealError;
      return response(200, {
        participants: [{ ...participantResponse(created), values: maskFieldValues(values) }],
      });
    }

    if (action === 'submit') {
      const participantId = typeof body.participantId === 'string' ? body.participantId : '';
      const source = body.source === 'draw' || body.source === 'photo' ? body.source : null;
      const width = Number(body.width);
      const height = Number(body.height);
      if (!uuidPattern.test(participantId) || !source) throw new HttpError(400, '서명 제출 정보가 올바르지 않습니다.');
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 5000 || height > 5000) {
        throw new HttpError(400, '서명 이미지 크기가 올바르지 않습니다.');
      }

      const { data: participant, error: participantError } = await db
        .from('registry_participants')
        .select('id, registry_id, status, field_values, field_values_ciphertext')
        .eq('id', participantId)
        .eq('registry_id', registry.id)
        .maybeSingle();
      if (participantError) throw participantError;
      if (!participant) throw new HttpError(404, '참석자를 찾을 수 없습니다.');
      if (participant.status === 'signed') throw new HttpError(409, '이미 서명이 제출되었습니다.');

      const values = cleanValues(body.values, columns);
      const signature = parseSignature(body.dataUrl);
      const storagePath = `${registry.id}/${participantId}/${crypto.randomUUID()}.${signature.extension}`;
      const contentHash = await hashBytes(signature.bytes);
      const { error: uploadError } = await db.storage
        .from('registry-signatures')
        .upload(storagePath, signature.bytes, { contentType: signature.contentType, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await db.from('registry_signatures').insert({
        registry_id: registry.id,
        participant_id: participantId,
        source,
        storage_path: storagePath,
        content_hash: contentHash,
        width,
        height,
      });
      if (insertError) {
        await db.storage.from('registry-signatures').remove([storagePath]);
        if (insertError.code === '23505') throw new HttpError(409, '이미 서명이 제출되었습니다.');
        throw insertError;
      }

      // 서명자가 채운 항목만 덮어쓴다. 통째로 바꾸면 교사가 미리 넣어 둔 소속이 지워진다.
      const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''));
      const merged = { ...(await decodeFieldValues(participant)), ...filled };
      const { error: updateError } = await db
        .from('registry_participants')
        .update({ field_values: null, field_values_ciphertext: await registryCrypto.encryptPayload(merged) })
        .eq('id', participantId)
        .eq('registry_id', registry.id);
      if (updateError) throw updateError;
      return response(200, { ok: true });
    }

    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return response(error.status, { error: error.message });
    console.error('registry-public failed', error);
    return response(500, { error: '서명 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});
