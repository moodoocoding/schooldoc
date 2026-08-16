-- 서명 이미지는 `{form_id}/{response_id}/{field_id}.{ext}` 경로로 저장한다.
-- 교사 소유 문서의 서명만 내려받을 수 있도록 첫 폴더 조각을 consent_forms와 대조한다.
drop policy if exists "Teachers read their consent signature files" on storage.objects;
create policy "Teachers read their consent signature files" on storage.objects for select to authenticated
using (
  bucket_id = 'consent-signatures'
  and exists (
    select 1 from public.consent_forms f
    where f.id::text = (storage.foldername(name))[1] and f.owner_id = auth.uid()
  )
);
