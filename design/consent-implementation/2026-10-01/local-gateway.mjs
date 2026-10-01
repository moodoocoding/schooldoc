// 검증 전용: PostgreSQL/PostgREST/생산 Edge 함수는 실제 실행한다.
// Auth와 Storage HTTP 인터페이스는 로컬 JWT 검증/디스크 파일 구현이며 hosted Supabase 검증으로 간주하지 않는다.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import pg from './.runtime/node_modules/pg/lib/index.js';
const base=resolve('design/consent-implementation/2026-10-01');const runtime=resolve(base,'.runtime');
const config=JSON.parse(await readFile(resolve(runtime,'local.json'),'utf8'));
const pool=new pg.Pool({host:'127.0.0.1',port:55432,user:'postgres',password:'isolated-consent-test',database:'consent_test'});
const edgeFile=resolve(runtime,'edge-server.ts');
await writeFile(edgeFile,`import {consentPublicHandler} from '../../../../../../supabase/functions/consent-forms-public/index.ts';
import {consentAdminHandler} from '../../../../../../supabase/functions/consent-forms-admin/index.ts';
Deno.serve({hostname:'127.0.0.1',port:55435},req=>req.url.includes('consent-forms-admin')?consentAdminHandler(req):consentPublicHandler(req));
`.replaceAll('../../../../../../','../../../../'));
const edge=spawn(resolve(runtime,'node_modules/@deno/win32-x64/deno.exe'),['run','--no-config','--no-lock','--node-modules-dir=none','--allow-env','--allow-net=127.0.0.1,localhost',edgeFile],{windowsHide:true,env:{...process.env,SUPABASE_URL:'http://127.0.0.1:55434',SUPABASE_SERVICE_ROLE_KEY:config.service,SUPABASE_ANON_KEY:config.anon,CONSENT_FORMS_ENCRYPTION_KEY:config.encryptionKey},stdio:['ignore','pipe','pipe']});
edge.stdout.on('data',()=>{});edge.stderr.on('data',d=>console.log(String(d).slice(0,900)));
const claims=(auth)=>{const token=(auth??'').replace(/^Bearer /,'');const [header,body,signature]=token.split('.');if(!signature)throw new Error('unauthorized');const expected=createHmac('sha256',config.secret).update(header+'.'+body).digest();const actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length || !timingSafeEqual(actual,expected))throw new Error('unauthorized');const decoded=JSON.parse(Buffer.from(body,'base64url'));if(decoded.exp<Date.now()/1000)throw new Error('expired');return decoded;};
const signed=new Map();const counts=new Map();let offlineAdmin=false;let failRemove=false;let loseSubmitAckRemaining=0;
const diskPath=(bucket,path)=>{if(!['consent-documents','consent-signatures'].includes(bucket) || !path || path.split('/').some(p=>p==='..'||p==='.'||!p))throw new Error('invalid path');const target=resolve(runtime,'storage',bucket,path);if(!target.startsWith(resolve(runtime,'storage',bucket)))throw new Error('invalid path');return target;};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-upsert,cache-control,x-supabase-api-version,prefer,content-profile,accept-profile,range,range-unit','Access-Control-Allow-Methods':'GET,POST,DELETE,PUT,PATCH,OPTIONS'};
const send=(res,status,body,headers={})=>{res.writeHead(status,{...cors,'Content-Type':'application/json',...headers});res.end(Buffer.isBuffer(body)?body:JSON.stringify(body));};
const jsonBody=raw=>raw.length?JSON.parse(raw.toString()):{};
const objectRows=async(bucket,prefix)=> (await pool.query('select id,name,metadata from storage.objects where bucket_id=$1 and starts_with(name,$2)',[bucket,prefix?prefix+'/':''])).rows;
const put=async(bucket,path,bytes,mime)=>{const file=diskPath(bucket,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);const id=randomUUID();await pool.query('insert into storage.objects(id,bucket_id,name,metadata) values($1,$2,$3,$4)',[id,bucket,path,JSON.stringify({mimetype:mime,size:bytes.length})]);return{id,Key:bucket+'/'+path};};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:55434');const path=decodeURIComponent(url.pathname);
  if(req.method==='OPTIONS'){res.writeHead(200,cors);res.end('ok');return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks);
  counts.set(`${req.method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g,'<id>')}`,(counts.get(`${req.method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g,'<id>')}`)??0)+1);
  if(path==='/__test/control'){const body=jsonBody(raw);offlineAdmin=Boolean(body.offlineAdmin);failRemove=Boolean(body.failRemove);loseSubmitAckRemaining=body.loseSubmitAckOnce?3:0;send(res,200,{ok:true});return;}
  if(path==='/__test/counts'){send(res,200,Object.fromEntries(counts));return;}
  if(path.startsWith('/rest/v1') || path.startsWith('/functions/v1')){
   if(path.startsWith('/functions/v1/consent-forms-admin') && offlineAdmin){send(res,503,{error:'로컬 검증: 관리 서버 연결이 중단되었습니다. 입력을 유지했습니다.'});return;}
   const target=path.startsWith('/rest/v1')?'http://127.0.0.1:55433'+path.slice('/rest/v1'.length)+url.search:'http://127.0.0.1:55435'+path+url.search;
   const headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length'];
   const response=await fetch(target,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:raw});
   const outHeaders=new Headers(cors);for(const[key,value]of response.headers)outHeaders.set(key,value);const bytes=Buffer.from(await response.arrayBuffer());
   if(loseSubmitAckRemaining>0 && path.includes('consent-forms-public') && jsonBody(raw).action==='submit' && response.ok){loseSubmitAckRemaining-=1;req.socket.destroy();return;}
   res.writeHead(response.status,Object.fromEntries(outHeaders));res.end(bytes);return;
  }
  if(path==='/auth/v1/user'){
   const user=claims(req.headers.authorization);if(!user.sub)throw new Error('unauthorized');
   send(res,200,{id:user.sub,aud:'authenticated',role:'authenticated',email:'fictional-teacher@example.test',app_metadata:{provider:'google'},user_metadata:{full_name:'가상 교사'},created_at:new Date().toISOString()});return;
  }
  if(path.startsWith('/storage/v1/object/sign/') && req.method==='GET'){
   const info=signed.get(url.searchParams.get('token'));if(!info || info.expires<Date.now() || path!=='/storage/v1/object/sign/'+info.bucket+'/'+info.path)throw new Error('expired');
   const file=await readFile(diskPath(info.bucket,info.path));send(res,200,file,{'Content-Type':info.bucket==='consent-documents'?'application/pdf':'image/png'});return;
  }
  const user=claims(req.headers.authorization);const service=user.role==='service_role';
  if(path.startsWith('/storage/v1/object/list/')){
   if(!service)throw new Error('forbidden');const bucket=path.slice('/storage/v1/object/list/'.length);const body=jsonBody(raw);const rows=await objectRows(bucket,body.prefix);
   const entries=new Map();for(const row of rows){const suffix=row.name.slice(body.prefix?body.prefix.length+1:0);const name=suffix.split('/')[0];if(!entries.has(name))entries.set(name,suffix.includes('/')?{name,id:null,metadata:null}:{name,id:row.id,metadata:row.metadata});}
   let list=[...entries.values()].filter(r=>!body.search||r.name.includes(body.search)).sort((a,b)=>a.name.localeCompare(b.name));list=list.slice(body.offset??0,(body.offset??0)+(body.limit??100));send(res,200,list);return;
  }
  if(path.startsWith('/storage/v1/object/sign/') && req.method==='POST'){
   const rest=path.slice('/storage/v1/object/sign/'.length);const slash=rest.indexOf('/');const bucket=slash<0?rest:rest.slice(0,slash);const body=jsonBody(raw);const paths=slash<0?body.paths:[rest.slice(slash+1)];const result=[];
   for(const item of paths){if(!service && !item.startsWith(user.sub+'/'))throw new Error('forbidden');const rows=(await pool.query('select id from storage.objects where bucket_id=$1 and name=$2',[bucket,item])).rows;if(!rows.length){send(res,404,{message:'Object not found',statusCode:'404'});return;}
    const token=randomUUID();signed.set(token,{bucket,path:item,expires:Date.now()+(body.expiresIn??600)*1000});result.push({path:item,signedURL:`/object/sign/${bucket}/${item}?token=${token}`,error:null});}
   send(res,200,slash<0?result:{signedURL:result[0].signedURL});return;
  }
  if(path==='/storage/v1/object/copy'){
   if(!service)throw new Error('forbidden');const body=jsonBody(raw);const bytes=await readFile(diskPath(body.bucketId,body.sourceKey));const result=await put(body.bucketId,body.destinationKey,bytes,'application/pdf');send(res,200,result);return;
  }
  if(path.startsWith('/storage/v1/object/')){
   const rest=path.slice('/storage/v1/object/'.length);const slash=rest.indexOf('/');const bucket=slash<0?rest:rest.slice(0,slash);const item=slash<0?'':rest.slice(slash+1);
   if(req.method==='DELETE'){
    if(!service)throw new Error('forbidden');if(failRemove){send(res,503,{message:'Local disk deletion temporarily unavailable',statusCode:'503'});return;}
    const paths=jsonBody(raw).prefixes;const removed=[];for(const target of paths){await rm(diskPath(bucket,target),{force:true});await pool.query('delete from storage.objects where bucket_id=$1 and name=$2',[bucket,target]);removed.push({name:target});}send(res,200,removed);return;
   }
   if(req.method==='POST'){
    if(!service && !item.startsWith(user.sub+'/'))throw new Error('forbidden');let bytes=raw,mime=req.headers['content-type'];
    if(mime?.includes('multipart/form-data')){const form=await new Request('http://local',{method:'POST',headers:{'content-type':mime},body:raw,duplex:'half'}).formData();const file=[...form.values()].find(v=>typeof v==='object'&&'arrayBuffer'in v);if(!file)throw new Error('invalid file');bytes=Buffer.from(await file.arrayBuffer());mime=file.type;}
    if(bucket==='consent-documents'&&mime!=='application/pdf')throw new Error('invalid file');
    send(res,200,await put(bucket,item,bytes,mime));return;
   }
  }
  send(res,404,{message:'Local route not available'});
 }catch(error){const denied=['unauthorized','expired','forbidden'].includes(error.message);if(!denied)console.error('local gateway',error.message);send(res,denied?401:500,{message:denied?'Access denied':'Local request failed'});}
});
server.listen(55434,'127.0.0.1',()=>console.log('LOCAL_GATEWAY_READY 55434 (Auth/Storage local adapters)'));
process.on('SIGINT',async()=>{edge.kill();server.close();await pool.end();await writeFile(resolve(base,'evidence/http-counts.json'),JSON.stringify(Object.fromEntries(counts),null,2));process.exit();});
