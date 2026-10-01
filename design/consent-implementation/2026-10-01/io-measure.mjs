import pg from './.runtime/node_modules/pg/lib/index.js';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
const base='design/consent-implementation/2026-10-01',cfg=JSON.parse(await readFile(base+'/.runtime/local.json','utf8')),fixtures=JSON.parse(await readFile(base+'/.runtime/fixtures.json','utf8'));
const db=new pg.Client({host:'127.0.0.1',port:55432,user:'postgres',password:'isolated-consent-test',database:'consent_test'});await db.connect();
const key=Buffer.from(cfg.encryptionKey,'hex');const seal=value=>{const iv=Buffer.from(randomUUID().replaceAll('-',''),'hex').subarray(0,12);const cipher=createCipheriv('aes-256-gcm',key,iv);return iv.toString('base64url')+'.'+Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final(),cipher.getAuthTag()]).toString('base64url');};
const open=value=>{const [iv,body]=value.split('.');const bytes=Buffer.from(body,'base64url');const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));decipher.setAuthTag(bytes.subarray(-16));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(0,-16)),decipher.final()]));};
const form=fixtures.max;
const people=(await db.query('select id,token,identity_ciphertext,response_id,submitted_at from consent_recipients where form_id=$1 order by created_at,id',[form.id])).rows;
for(const p of people.slice(0,100))if(!p.response_id)await db.query('select commit_consent_response($1,$2,$3,$4,$5,$6,$7,1,null)',[form.token,p.token,randomUUID(),randomUUID(),'measured',seal({opinion:'측정용 가상 의견 '.repeat(100),no:'true'}),'[]']);
await db.query('analyze consent_recipients;analyze consent_responses;analyze consent_forms;');
const plans={};for(const[name,sql,args]of [
 ['roster_first','select id,token,identity_ciphertext,response_id,submitted_at,created_at from consent_recipients where form_id=$1 order by created_at,id limit 60',[form.id]],
 ['roster_cursor','select id,token,identity_ciphertext,response_id,submitted_at,created_at from consent_recipients where form_id=$1 and (created_at,id)>($2,$3) order by created_at,id limit 60',[form.id,(await db.query('select created_at,id from consent_recipients where form_id=$1 order by created_at,id offset 59 limit 1',[form.id])).rows[0].created_at,people[59].id]],
 ['current_headers','select id,recipient_id,submitted_at from consent_current_responses where form_id=$1 order by submitted_at desc,id desc limit 60',[form.id]]
])plans[name]=(await db.query('explain (analyze,buffers,format json) '+sql,args)).rows[0]['QUERY PLAN'];
const body=JSON.stringify({action:'bundle',formId:form.id});const response=await fetch('http://127.0.0.1:55434/functions/v1/consent-forms-admin',{method:'POST',headers:{Authorization:'Bearer '+cfg.teacher,'Content-Type':'application/json'},body});const newBody=await response.text();if(!response.ok)throw new Error(newBody);const bundle=JSON.parse(newBody);
// 같은 실제 DB 자료를 이전 전체 조회 SQL과 DTO 직렬화로 읽는다. 운영 과금 측정이 아니다.
const oldForm=(await db.query('select * from consent_forms where id=$1',[form.id])).rows[0];delete oldForm.password_digest;
const recipients=(await db.query('select * from consent_recipients where form_id=$1 order by created_at',[form.id])).rows.map(p=>({...open(p.identity_ciphertext),id:p.id,token:p.token,responseId:p.response_id,submittedAt:p.submitted_at}));
const responses=(await db.query('select id,values_ciphertext,submitted_at,recipient_id from consent_responses where form_id=$1 order by submitted_at',[form.id])).rows.map(r=>({id:r.id,submittedAt:r.submitted_at,recipientId:r.recipient_id,values:open(r.values_ciphertext)}));
const oldBytes=Buffer.byteLength(JSON.stringify({form:oldForm,recipients,responses}));const newBytes=Buffer.byteLength(newBody);
const result={fixture:{recipients:people.length,responses:responses.length},initialBefore:{businessCalls:3,bodyBytes:oldBytes,decryptedRecipients:recipients.length,decryptedResponses:responses.length},initialAfter:{businessCalls:1,bodyBytes:newBytes,decryptedRecipients:bundle.recipients.length,decryptedResponses:0,signatureUrls:0},payloadReductionPercent:Number((100*(1-newBytes/oldBytes)).toFixed(2)),plans,note:'실제 로컬 DB의 동일 가상 자료. 이전 SQL/DTO 대비 신규 HTTP API 비교이며 hosted Supabase의 디스크 IOPS·청구 금액 측정은 아님.'};await writeFile(base+'/evidence/io-measurement.json',JSON.stringify(result,null,2));await db.end();console.log('IO_MEASURE',result.initialBefore,result.initialAfter,result.payloadReductionPercent+'%');
