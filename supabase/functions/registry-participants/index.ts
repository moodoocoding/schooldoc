import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { registryCrypto, type RegistryFieldValues } from '../_shared/registryCrypto.ts';

/**
 * 교사 전용 참석자 창구.
 *
 * 등록부의 나머지 교사 경로는 RLS를 걸고 브라우저가 직접 테이블을 읽는다. 항목 값만
 * 암호문이라 브라우저가 풀 수 없으므로, 값을 읽고 쓰는 세 갈래만 여기를 지난다.
 * 이름은 평문이라 여기서 다루지 않는다.
 *
 * 모든 요청은 호출자가 해당 등록부의 소유자인지 먼저 확인한다.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
if (!url || !serviceKey) throw new Error('Supabase service environment is not configured.');
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PARTICIPANTS = 2_000;

const requireUser = async (request: Request) => {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, '로그인이 필요합니다.');
  if (!anonKey) throw new HttpError(500, 'Supabase anon key is not configured.');
  const caller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) throw new HttpError(401, '로그인 정보를 확인하지 못했습니다.');
  return data.user.id;
};

/** 요청에 담긴 등록부 가운데 실제로 이 사람 것만 남긴다. */
const ownedRegistryIds = async (registryIds: string[], userId: string) => {
  if (registryIds.length === 0) return [];
  const { data, error } = await db.from('registries').select('id').eq('owner_id', userId).in('id', registryIds);
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
};

const requireOwnedRegistry = async (registryId: string, userId: string) => {
  if (!uuidPattern.test(registryId)) throw new HttpError(400, '등록부를 찾을 수 없습니다.');
  const owned = await ownedRegistryIds([registryId], userId);
  if (owned.length === 0) throw new HttpError(403, '이 등록부를 관리할 권한이 없습니다.');
};

const readFieldValues = (value: unknown): RegistryFieldValues => {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, '항목 값 형식이 올바르지 않습니다.');
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
    if (typeof entry !== 'string' || entry.length > 200) throw new HttpError(422, '항목 값을 확인해 주세요.');
    return [key, entry];
  }));
};

/**
 * 암호문이 있으면 풀고, 없으면 옛 평문을 쓴다.
 * 재암호화를 마치기 전까지 두 가지가 섞여 있으므로 읽는 쪽이 둘 다 감당한다.
 */
const decodeFieldValues = async (row: { field_values_ciphertext: string | null; field_values: unknown }) => {
  if (row.field_values_ciphertext) {
    return await registryCrypto.decryptPayload<RegistryFieldValues>(row.field_values_ciphertext);
  }
  return (row.field_values ?? {}) as RegistryFieldValues;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: '허용되지 않은 요청입니다.' });

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const userId = await requireUser(request);
    if (!registryCrypto.isConfigured()) {
      throw new HttpError(503, '등록부 암호화 키가 설정되지 않아 참석자 명단을 쓸 수 없습니다.');
    }

    if (action === 'read') {
      const requested = Array.isArray(body.registryIds)
        ? body.registryIds.filter((value): value is string => typeof value === 'string' && uuidPattern.test(value))
        : [];
      const owned = await ownedRegistryIds(requested, userId);
      if (owned.length === 0) return json(200, { participants: [] });

      const { data, error } = await db.from('registry_participants')
        .select('id, registry_id, row_number, name, field_values, field_values_ciphertext, status, signed_at')
        .in('registry_id', owned)
        .order('row_number');
      if (error) throw error;

      // 브라우저가 테이블에서 직접 읽던 것과 같은 형태로 돌려준다. 푼 값만 갈아 끼운다.
      const participants = await Promise.all((data ?? []).map(async (row) => ({
        id: row.id,
        registry_id: row.registry_id,
        row_number: row.row_number,
        name: row.name,
        field_values: await decodeFieldValues(row),
        status: row.status,
        signed_at: row.signed_at,
      })));
      return json(200, { participants });
    }

    const registryId = typeof body.registryId === 'string' ? body.registryId : '';
    await requireOwnedRegistry(registryId, userId);

    if (action === 'createMany') {
      const entries = Array.isArray(body.participants) ? body.participants : [];
      if (entries.length > MAX_PARTICIPANTS) throw new HttpError(422, `참석자는 한 번에 ${MAX_PARTICIPANTS}명까지 저장할 수 있습니다.`);

      const rows = [];
      for (const [index, entry] of entries.entries()) {
        const item = entry as Record<string, unknown>;
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (!name || name.length > 100) throw new HttpError(422, '참석자 이름을 확인해 주세요.');
        rows.push({
          registry_id: registryId,
          row_number: index + 1,
          name,
          field_values: null,
          field_values_ciphertext: await registryCrypto.encryptPayload(readFieldValues(item.values)),
        });
      }
      if (rows.length > 0) {
        const { error } = await db.from('registry_participants').insert(rows);
        if (error) throw error;
      }
      return json(200, { count: rows.length });
    }

    if (action === 'addOne') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 100) throw new HttpError(422, '참석자 이름을 확인해 주세요.');

      // 연번은 현재 최대값 다음으로 정한다. 현장 등록과 같은 규칙이다.
      const { data: lastRow, error: lastError } = await db.from('registry_participants')
        .select('row_number').eq('registry_id', registryId)
        .order('row_number', { ascending: false }).limit(1).maybeSingle();
      if (lastError) throw lastError;

      const { data, error } = await db.from('registry_participants').insert({
        registry_id: registryId,
        row_number: ((lastRow?.row_number as number | undefined) ?? 0) + 1,
        name,
        field_values: null,
        field_values_ciphertext: await registryCrypto.encryptPayload(readFieldValues(body.values)),
      }).select('id, row_number').single();
      if (error) throw error;

      return json(200, { participant: { id: data.id, rowNumber: data.row_number, name } });
    }

    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    // 함수만 배포하고 마이그레이션을 적용하지 않으면 여기로 온다. 실제로 겪은 일이라,
    // 원인을 모르고 헤매지 않도록 무엇이 빠졌는지 그대로 알린다.
    if ((error as { code?: string }).code === '42703') {
      console.error('registry-participants: migration not applied', error);
      return json(503, { error: '등록부 마이그레이션이 아직 적용되지 않았습니다. 202608200001을 적용해 주세요.' });
    }
    console.error('registry-participants failed', error);
    return json(500, { error: '참석자 명단을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});
