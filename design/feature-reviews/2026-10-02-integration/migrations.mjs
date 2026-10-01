import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const runtime = process.env.REGISTRY_PG_RUNTIME;
assert(runtime, 'REGISTRY_PG_RUNTIME must name the isolated PostgreSQL runtime');
const { PGlite } = await import(pathToFileURL(path.join(runtime, 'node_modules/@electric-sql/pglite/dist/index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(runtime, 'node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
const applied=[];
try {
 await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls; create role authenticator;
  create schema auth; create schema storage; create schema extensions; create schema realtime;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
  create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
  create table realtime.messages(id uuid default gen_random_uuid(),topic text,event text,payload jsonb,extension text default 'broadcast',private boolean);
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
  create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$insert into realtime.messages(topic,event,payload,private) values($3,$2,$1,$4)$$;
  create publication supabase_realtime;
  grant usage on schema public,storage,auth,extensions,realtime to anon,authenticated,service_role;
  alter default privileges in schema public grant all on tables to service_role;
  alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
 `);
 for(const file of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()) {
  await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  applied.push(file);
 }
 const [summary]= (await db.query("select pg_get_functiondef('public.get_active_work_summary()'::regprocedure) as definition")).rows;
 assert(summary.definition.includes('file.collection_id = collection.id and file.is_current'));
 assert(!summary.definition.includes('when collection.mode ='));
 await db.exec(`insert into auth.users(id,raw_user_meta_data) values('10000000-0000-4000-8000-000000000099','{"student_id":"integration-fixture","name":"가상담임"}');
 insert into consent_forms(id,owner_id,title,file_name,source_path,recipient_mode,publication_state,current_response_count,response_count) values
 ('20000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000099','가상 현재 응답','fictional.pdf','fictional/current.pdf','open','ready',1,9),
 ('20000000-0000-4000-8000-000000000098','10000000-0000-4000-8000-000000000099','가상 준비 중','fictional.pdf','fictional/preparing.pdf','open','preparing',0,0);
 select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000099',false);`);
 const consentSummary=(await db.query("select done_count::int as done_count from get_active_work_summary() where tool_id='notice-collect'")).rows;
 assert.deepEqual(consentSummary,[{done_count:1}]);
 const [permissions]=(await db.query(`select
  has_function_privilege('anon','public.registry_commit_signature(uuid,uuid,text,uuid,uuid,timestamptz,text,text,text,text,text,integer,integer,text,boolean)','execute') as registry_submit,
  has_function_privilege('authenticated','public.finalize_data_collection_submission(uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,text,bigint,text,text)','execute') as direct_file_submit,
  has_function_privilege('authenticated','public.commit_consent_response(uuid,uuid,uuid,uuid,text,text,jsonb,integer,uuid)','execute') as direct_consent_submit
 `)).rows;
 assert.deepEqual(permissions,{registry_submit:false,direct_file_submit:false,direct_consent_submit:false});
 const result={engine:'PGlite PostgreSQL with real pgcrypto',applied,summaryCurrentOnly:true,consentSummaryCurrentOnly:true,preparingConsentHidden:true,permissions,limitations:['Auth/Storage/Realtime are schema adapters; not hosted Supabase verification','No multi-connection lock verification']};
 await writeFile('design/feature-reviews/2026-10-02-integration/migrations.json',JSON.stringify(result,null,2));
 console.log('PASS all '+applied.length+' migrations together; current submissions and private RPC privileges retained');
} finally {await db.close();}
