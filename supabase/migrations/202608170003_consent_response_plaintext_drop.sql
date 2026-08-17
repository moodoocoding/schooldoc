-- 평문으로 남은 응답이 없음을 확인한 뒤 과도기를 닫는다.
-- 컬럼을 남겨 두면 언젠가 다시 쓰이므로 아예 없앤다.
alter table public.consent_responses
  drop constraint if exists consent_responses_payload_check;

alter table public.consent_responses
  drop column if exists values;

-- 이제 봉인되지 않은 응답은 저장될 수 없다.
alter table public.consent_responses
  alter column values_ciphertext set not null;
