-- 가정통신문 재제출 이력의 누적 수를 진행 업무의 현재 응답 수로 표시하지 않는다.
-- 다른 기능의 기존 집계와 권한은 그대로 보존한다.
do $$
declare definition text; changed text;
begin
  definition := pg_get_functiondef('public.get_active_work_summary()'::regprocedure);
  changed := replace(definition, 'form.response_count::bigint', 'form.current_response_count::bigint');
  if changed = definition then raise exception 'consent_active_summary_definition_changed'; end if;
  definition := changed;
  changed := regexp_replace(definition,
    '(where form\.owner_id = auth\.uid\(\)[[:space:]]+and form\.status = ''open'')',
    '\1 and form.publication_state = ''ready''');
  if changed = definition then raise exception 'consent_active_summary_filter_changed'; end if;
  execute changed;
end $$;
