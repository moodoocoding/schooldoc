import { supabase } from '../../utils/supabaseClient';
import type {
  Registry,
  RegistryColumn,
  RegistryDraft,
  RegistryLayout,
  RegistryMode,
  RegistryParticipant,
  RegistryStatus,
  SignatureSource,
} from './types';

interface RegistryRow {
  id: string;
  public_token: string;
  mode: RegistryMode;
  title: string;
  left_header: string;
  right_header: string;
  layout: RegistryLayout;
  status: 'draft' | RegistryStatus;
  allow_walk_in: boolean;
  password_digest: string | null;
  created_at: string;
  updated_at: string;
}

interface ColumnRow {
  id: string;
  registry_id: string;
  label: string;
  position: number;
}

interface ParticipantRow {
  id: string;
  registry_id: string;
  row_number: number;
  name: string;
  field_values: Record<string, string> | null;
  status: 'pending' | 'signed';
  signed_at: string | null;
}

interface SignatureRow {
  registry_id: string;
  participant_id: string;
  source: SignatureSource;
  storage_path: string;
  created_at: string;
}

const SIGNATURE_BUCKET = 'registry-signatures';
const CHANGE_EVENT = 'schooldoc-registry-remote-change';
const STORAGE_PAGE = 1000;
const SIGNATURE_REMOVE_CHUNK = 100;

const client = () => {
  if (!supabase) throw new Error('Supabase 연결 정보가 없습니다.');
  return supabase;
};

/** Storage list는 한 번에 일부만 돌려주므로 끝까지 넘긴다. */
const listStorageNames = async (prefix: string) => {
  const names: string[] = [];
  for (let offset = 0; ; offset += STORAGE_PAGE) {
    const page = await client().storage.from(SIGNATURE_BUCKET).list(prefix, { limit: STORAGE_PAGE, offset });
    if (page.error) fail('서명 파일 목록을 확인하지 못했습니다', page.error);
    const entries = page.data ?? [];
    entries.forEach((entry) => names.push(entry.name));
    if (entries.length < STORAGE_PAGE) return names;
  }
};

/** 참석자 한 명의 서명 파일. 경로는 `등록부/참석자/파일` 세 칸이다. */
const listParticipantFilePaths = async (registryId: string, participantId: string) => (
  (await listStorageNames(`${registryId}/${participantId}`))
    .map((file) => `${registryId}/${participantId}/${file}`)
);

/** 등록부 아래 모든 서명 파일. 이전에 지우다 만 것까지 함께 걷힌다. */
const listRegistryFilePaths = async (registryId: string) => {
  const paths: string[] = [];
  for (const participantFolder of await listStorageNames(registryId)) {
    paths.push(...await listParticipantFilePaths(registryId, participantFolder));
  }
  return paths;
};

/**
 * 지운 뒤 실제로 사라졌는지 다시 확인한다.
 *
 * Storage의 remove()는 정책에 막히면 오류 없이 성공한 척하고 파일을 남긴다. 가정통신문에서
 * 실제로 겪은 일이라, 결과를 믿지 않고 목록을 다시 읽어 대조한다. 남아 있으면 여기서 멈춰
 * 호출한 쪽이 행을 지우지 못하게 한다. 행이 사라지면 삭제 정책이 참이 될 수 없어 파일을
 * 두 번 다시 지울 수 없기 때문이다.
 */
const removeSignatureFiles = async (paths: string[], relist: () => Promise<string[]>) => {
  if (paths.length === 0) return;
  for (let index = 0; index < paths.length; index += SIGNATURE_REMOVE_CHUNK) {
    const removed = await client().storage.from(SIGNATURE_BUCKET)
      .remove(paths.slice(index, index + SIGNATURE_REMOVE_CHUNK));
    if (removed.error) fail('서명 이미지를 지우지 못했습니다', removed.error);
  }
  const remaining = await relist();
  if (remaining.length > 0) {
    throw new Error(`서명 이미지 ${remaining.length}건을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.`);
  }
};

const fail = (message: string, error?: { message?: string } | null): never => {
  throw new Error(error?.message ? `${message}: ${error.message}` : message);
};

const notify = () => window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

const loadSignatureUrls = async (rows: SignatureRow[]) => {
  const paths = rows.map((row) => row.storage_path);
  if (paths.length === 0) return new Map<string, string>();

  const { data, error } = await client().storage
    .from(SIGNATURE_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (error) fail('서명 이미지를 불러오지 못했습니다', error);

  return new Map((data ?? []).flatMap((item, index) => (
    item.signedUrl ? [[paths[index], item.signedUrl] as const] : []
  )));
};

const assembleRegistries = async (
  registryRows: RegistryRow[],
  columnRows: ColumnRow[],
  participantRows: ParticipantRow[],
  signatureRows: SignatureRow[],
) => {
  const signatureUrls = await loadSignatureUrls(signatureRows);
  const signaturesByParticipant = new Map(signatureRows.map((row) => [row.participant_id, row]));

  return registryRows.map<Registry>((row) => {
    const columns = columnRows
      .filter((column) => column.registry_id === row.id)
      .toSorted((a, b) => a.position - b.position)
      .map<RegistryColumn>((column) => ({ id: column.id, label: column.label }));
    const participants = participantRows
      .filter((participant) => participant.registry_id === row.id)
      .toSorted((a, b) => a.row_number - b.row_number)
      .map<RegistryParticipant>((participant) => {
        const signature = signaturesByParticipant.get(participant.id);
        const signedUrl = signature ? signatureUrls.get(signature.storage_path) : undefined;
        return {
          id: participant.id,
          rowNumber: participant.row_number,
          name: participant.name,
          values: participant.field_values ?? {},
          signature: signature && signedUrl ? {
            dataUrl: signedUrl,
            source: signature.source,
            signedAt: participant.signed_at ?? signature.created_at,
          } : undefined,
        };
      });

    return {
      id: row.id,
      publicToken: row.public_token,
      title: row.title,
      leftHeader: row.left_header,
      rightHeader: row.right_header,
      mode: row.mode,
      status: row.status === 'draft' ? 'closed' : row.status,
      layout: row.layout,
      allowWalkIn: row.allow_walk_in,
      isPasswordProtected: Boolean(row.password_digest),
      columns,
      participants,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
};

const loadRelatedRows = async (registryRows: RegistryRow[]) => {
  if (registryRows.length === 0) return [];
  const ids = registryRows.map((row) => row.id);
  const [columnsResult, participantsResult, signaturesResult] = await Promise.all([
    client().from('registry_columns').select('id, registry_id, label, position').in('registry_id', ids),
    client().from('registry_participants').select('id, registry_id, row_number, name, field_values, status, signed_at').in('registry_id', ids),
    client().from('registry_signatures').select('registry_id, participant_id, source, storage_path, created_at').in('registry_id', ids),
  ]);
  if (columnsResult.error) fail('등록부 열을 불러오지 못했습니다', columnsResult.error);
  if (participantsResult.error) fail('참석자 명단을 불러오지 못했습니다', participantsResult.error);
  if (signaturesResult.error) fail('서명 현황을 불러오지 못했습니다', signaturesResult.error);

  return assembleRegistries(
    registryRows,
    (columnsResult.data ?? []) as ColumnRow[],
    (participantsResult.data ?? []) as ParticipantRow[],
    (signaturesResult.data ?? []) as SignatureRow[],
  );
};

export const listRemoteRegistries = async () => {
  const { data, error } = await client()
    .from('registries')
    .select('id, public_token, mode, title, left_header, right_header, layout, status, allow_walk_in, password_digest, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) fail('등록부 목록을 불러오지 못했습니다', error);
  return loadRelatedRows((data ?? []) as RegistryRow[]);
};

export const getRemoteRegistry = async (id: string) => {
  const { data, error } = await client()
    .from('registries')
    .select('id, public_token, mode, title, left_header, right_header, layout, status, allow_walk_in, password_digest, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('등록부를 불러오지 못했습니다', error);
  if (!data) return null;
  return (await loadRelatedRows([data as RegistryRow]))[0] ?? null;
};

export const createRemoteRegistry = async (draft: RegistryDraft) => {
  const { data: userData, error: userError } = await client().auth.getUser();
  if (userError) fail('로그인 정보를 확인하지 못했습니다', userError);
  const user = userData.user;
  if (!user) throw new Error('Google 로그인이 필요합니다.');

  const { data, error } = await client().from('registries').insert({
    owner_id: user.id,
    mode: draft.mode,
    title: draft.title,
    left_header: draft.leftHeader,
    right_header: draft.rightHeader,
    layout: draft.layout,
    status: 'open',
    allow_walk_in: draft.allowWalkIn,
  }).select('id').single();
  if (error) fail('등록부를 만들지 못했습니다', error);
  if (!data) throw new Error('생성한 등록부 식별자를 확인하지 못했습니다.');

  const registryId = data.id as string;
  try {
    if (draft.publicPassword) {
      const passwordResult = await client().rpc('set_registry_password', {
        p_registry_id: registryId,
        p_password: draft.publicPassword,
      });
      if (passwordResult.error) fail('공개 비밀번호를 설정하지 못했습니다', passwordResult.error);
    }

    if (draft.columns.length > 0) {
      const { error: columnsError } = await client().from('registry_columns').insert(
        draft.columns.map((column, position) => ({
          id: column.id,
          registry_id: registryId,
          key: column.id,
          label: column.label,
          position,
        })),
      );
      if (columnsError) fail('등록부 열을 저장하지 못했습니다', columnsError);
    }

    if (draft.participants.length > 0) {
      const { error: participantsError } = await client().from('registry_participants').insert(
        draft.participants.map((participant, index) => ({
          registry_id: registryId,
          row_number: index + 1,
          name: participant.name,
          field_values: participant.values,
        })),
      );
      if (participantsError) fail('참석자 명단을 저장하지 못했습니다', participantsError);
    }
  } catch (error) {
    await client().from('registries').delete().eq('id', registryId);
    throw error;
  }

  notify();
  const registry = await getRemoteRegistry(registryId);
  if (!registry) throw new Error('생성한 등록부를 다시 불러오지 못했습니다.');
  return registry;
};

export const updateRemoteRegistry = async (id: string, patch: Partial<Registry>) => {
  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.leftHeader !== undefined) values.left_header = patch.leftHeader;
  if (patch.rightHeader !== undefined) values.right_header = patch.rightHeader;
  if (patch.layout !== undefined) values.layout = patch.layout;
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.allowWalkIn !== undefined) values.allow_walk_in = patch.allowWalkIn;

  if (Object.keys(values).length > 0) {
    const { error } = await client().from('registries').update(values).eq('id', id);
    if (error) fail('등록부를 수정하지 못했습니다', error);
  }
  if (patch.publicPassword !== undefined) {
    const { error } = await client().rpc('set_registry_password', {
      p_registry_id: id,
      p_password: patch.publicPassword,
    });
    if (error) fail('공개 비밀번호를 수정하지 못했습니다', error);
  }
  notify();
  return getRemoteRegistry(id);
};

export const deleteRemoteRegistry = async (id: string) => {
  // 파일을 먼저 지우고 확인한 뒤에야 행을 지운다. 순서가 바뀌면 남은 파일을 못 지운다.
  await removeSignatureFiles(await listRegistryFilePaths(id), () => listRegistryFilePaths(id));

  const { error } = await client().from('registries').delete().eq('id', id);
  if (error) fail('등록부를 삭제하지 못했습니다', error);
  notify();
};

export const addRemoteParticipant = async (
  registryId: string,
  participant: Pick<RegistryParticipant, 'name' | 'values'>,
) => {
  const { data: lastRow, error: rowError } = await client()
    .from('registry_participants')
    .select('row_number')
    .eq('registry_id', registryId)
    .order('row_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rowError) fail('참석자 순서를 확인하지 못했습니다', rowError);

  const { data, error } = await client().from('registry_participants').insert({
    registry_id: registryId,
    row_number: ((lastRow?.row_number as number | undefined) ?? 0) + 1,
    name: participant.name,
    field_values: participant.values,
  }).select('id, row_number').single();
  if (error) fail('참석자를 추가하지 못했습니다', error);
  if (!data) throw new Error('추가한 참석자를 확인하지 못했습니다.');
  notify();
  return {
    id: data.id as string,
    rowNumber: data.row_number as number,
    name: participant.name,
    values: participant.values,
  } satisfies RegistryParticipant;
};

export const removeRemoteParticipant = async (registryId: string, participantId: string) => {
  await removeSignatureFiles(
    await listParticipantFilePaths(registryId, participantId),
    () => listParticipantFilePaths(registryId, participantId),
  );
  const { error } = await client()
    .from('registry_participants')
    .delete()
    .eq('registry_id', registryId)
    .eq('id', participantId);
  if (error) fail('참석자를 삭제하지 못했습니다', error);
  notify();
};

export const clearRemoteSignature = async (registryId: string, participantId: string) => {
  const { data, error } = await client()
    .from('registry_signatures')
    .select('storage_path')
    .eq('registry_id', registryId)
    .eq('participant_id', participantId)
    .maybeSingle();
  if (error) fail('기존 서명을 확인하지 못했습니다', error);
  if (!data) return;

  // 파일을 먼저 지운다. 행을 먼저 지우면 어떤 파일이 남았는지 가리키는 것이 없어진다.
  await removeSignatureFiles(
    await listParticipantFilePaths(registryId, participantId),
    () => listParticipantFilePaths(registryId, participantId),
  );
  const { error: deleteError } = await client()
    .from('registry_signatures')
    .delete()
    .eq('participant_id', participantId);
  if (deleteError) fail('기존 서명을 삭제하지 못했습니다', deleteError);
  notify();
};

export const createRemoteRegistryPdf = async (registryId: string) => {
  const { data, error } = await client().functions.invoke('registry-pdf', {
    body: { registryId },
  });
  if (error) {
    const context = error.context as Response | undefined;
    if (context) {
      try {
        const response = await context.clone().json() as { error?: string };
        if (response.error) throw new Error(response.error);
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message !== 'Unexpected end of JSON input') throw contextError;
      }
    }
    fail('PDF를 만들지 못했습니다', error);
  }
  if (!(data instanceof Blob) || data.type !== 'application/pdf') {
    throw new Error('PDF 서버 응답 형식이 올바르지 않습니다.');
  }
  return data;
};

export const subscribeRemoteRegistries = (listener: () => void) => {
  const onLocalChange = () => listener();
  window.addEventListener(CHANGE_EVENT, onLocalChange);
  const channel = client()
    .channel(`registry-admin-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registries' }, listener)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registry_columns' }, listener)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registry_participants' }, listener)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registry_signatures' }, listener)
    .subscribe();

  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocalChange);
    void client().removeChannel(channel);
  };
};
