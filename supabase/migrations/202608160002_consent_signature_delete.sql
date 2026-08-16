-- 수합을 지우면 서명 이미지도 함께 지워야 한다.
-- DB 행은 on delete cascade로 정리되지만 Storage 객체는 남으므로 삭제 권한을 연다.
drop policy if exists "Teachers delete their consent signature files" on storage.objects;
create policy "Teachers delete their consent signature files" on storage.objects for delete to authenticated
using (
  bucket_id = 'consent-signatures'
  and exists (
    select 1 from public.consent_forms f
    where f.id::text = (storage.foldername(name))[1] and f.owner_id = auth.uid()
  )
);
