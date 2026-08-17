-- 수신자 이름은 암호문으로 두면서 정작 응답 내용은 평문이라 보호 수준이 어긋나 있었다.
-- 회신에는 건강 상태나 가정 사정 같은 서술이 실제로 들어온다.
-- 학생 결과 안내가 쓰는 방식과 같이 AES-GCM 암호문 컬럼을 두고, 복호는 소유자를 확인한
-- Edge Function에서만 한다.
alter table public.consent_responses
  add column if not exists values_ciphertext text;

-- 기존 자료를 옮기는 동안 평문과 암호문이 섞인다. 둘 중 하나만 있으면 되도록 둔다.
alter table public.consent_responses
  alter column values drop not null;

alter table public.consent_responses
  drop constraint if exists consent_responses_payload_check;
alter table public.consent_responses
  add constraint consent_responses_payload_check
  check (values_ciphertext is not null or values is not null) not valid;

comment on column public.consent_responses.values_ciphertext is
  'AES-GCM encrypted JSON of field values. Decrypted only by owner-checked Edge Functions.';
comment on column public.consent_responses.values is
  'Legacy plaintext values. Being migrated into values_ciphertext; do not write new rows here.';

-- 응답 본문은 이제 교사도 직접 읽지 않는다. 함수를 거치지 않으면 암호문만 보인다.
-- 기존 조회 정책은 유지하되, 평문 이전이 끝나면 컬럼 자체가 비워진다.
