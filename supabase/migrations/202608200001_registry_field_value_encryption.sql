-- 등록부 참석자의 항목 값을 암호문으로 옮긴다.
--
-- 이름은 평문으로 남긴다. 참석자가 행사장에서 두 글자만 넣어 자기를 찾는 흐름을 지켜야 하고,
-- 암호문에는 부분 검색이 통하지 않기 때문이다. 소속·직위처럼 이름 옆에 붙어 신원을 좁히는
-- 값만 서버가 풀 수 있게 한다.
--
-- 기존 평문은 지우지 않는다. 함수가 배포되기 전에도 읽히게 두고, 재암호화를 마친 뒤에
-- 별도 마이그레이션으로 비운다.

alter table public.registry_participants
  add column if not exists field_values_ciphertext text;

alter table public.registry_participants
  alter column field_values drop not null;

comment on column public.registry_participants.field_values_ciphertext is
  '항목 값의 AES-GCM 암호문. REGISTRY_ENCRYPTION_KEY를 가진 Edge Function만 풀 수 있다.';

comment on column public.registry_participants.field_values is
  '옛 평문 항목 값. 새로 쓰지 않는다. 재암호화를 마치면 비운다.';

-- 검색은 이름만 훑는다. 항목 값이 암호문이 되어 부분 검색이 통하지 않고,
-- 그대로 두면 암호문 조각에 우연히 걸리는 일이 생긴다.
--
-- 돌려주는 열이 늘어나므로 create or replace로는 바꿀 수 없다. 먼저 지운다.
drop function if exists public.search_registry_participants(uuid, text, integer);

create function public.search_registry_participants(
  p_registry_id uuid,
  p_query text,
  p_limit integer default 10
)
returns table (
  id uuid,
  row_number integer,
  name text,
  field_values jsonb,
  field_values_ciphertext text,
  status text,
  signed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    participant.id,
    participant.row_number,
    participant.name,
    participant.field_values,
    participant.field_values_ciphertext,
    participant.status,
    participant.signed_at
  from public.registry_participants as participant
  where participant.registry_id = p_registry_id
    and participant.name ilike '%' || replace(replace(replace(p_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
  order by participant.row_number
  limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.search_registry_participants(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.search_registry_participants(uuid, text, integer) to service_role;
