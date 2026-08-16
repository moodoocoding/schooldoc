alter table public.consent_forms
  add column if not exists page_sizes jsonb not null default '[]'::jsonb
  check (jsonb_typeof(page_sizes) = 'array');
