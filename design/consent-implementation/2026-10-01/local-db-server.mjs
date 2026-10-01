import EmbeddedPostgres from './.runtime/node_modules/embedded-postgres/dist/index.js';
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes,createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
const root=process.cwd(); const runtime=resolve(root,'design/consent-implementation/2026-10-01/.runtime');
const pg=new EmbeddedPostgres({databaseDir:resolve(runtime,'pgdata'),user:'postgres',password:'isolated-consent-test',port:55432,persistent:true,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:m=>console.error(String(m))});
const existing=await access(resolve(runtime,'pgdata/PG_VERSION')).then(()=>true,()=>false);
if(!existing)await pg.initialise();await pg.start();if(!existing)await pg.createDatabase('consent_test');
const client=pg.getPgClient();await client.connect();await client.end();
const {default:pgModule}=await import('./.runtime/node_modules/pg/lib/index.js');
const db=new pgModule.Client({host:'127.0.0.1',port:55432,user:'postgres',password:'isolated-consent-test',database:'consent_test'});await db.connect();
if(!existing){
await db.query(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
create role authenticator login password 'local-rest-only' noinherit;grant anon,authenticated,service_role to authenticator;
`);
await db.query(await readFile(resolve(root,'design/consent-implementation/2026-10-01/local-bootstrap.sql'),'utf8'));
const files=(await readdir(resolve(root,'supabase/migrations'))).filter(n=>n.includes('consent') && n!=='202610011000_consent_integrity_io.sql').sort();
for(const name of files){await db.query(await readFile(resolve(root,'supabase/migrations',name),'utf8'));console.log('migration',name);}
await db.query(await readFile(resolve(root,'supabase/migrations/202608240001_privacy_retention_lifecycle.sql'),'utf8'));
await db.query(await readFile(resolve(root,'supabase/migrations/202610011000_consent_integrity_io.sql'),'utf8'));
const user='11111111-1111-4111-8111-111111111111';await db.query('insert into auth.users values($1),($2)',[user,'22222222-2222-4222-8222-222222222222']);
const secret=randomBytes(32).toString('hex');const token=(role,sub)=>{const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({role,sub,exp:Math.floor(Date.now()/1000)+86400});return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');};
await writeFile(resolve(runtime,'local.json'),JSON.stringify({user,anon:token('anon'),service:token('service_role'),teacher:token('authenticated',user),secret,encryptionKey:randomBytes(32).toString('hex')}));
await writeFile(resolve(runtime,'postgrest.conf'),`db-uri = "postgres://authenticator:local-rest-only@127.0.0.1:55432/consent_test"
db-schemas = "public"
db-anon-role = "anon"
server-host = "127.0.0.1"
server-port = 55433
jwt-secret = "${secret}"
`);
}
const runtimeConfig=JSON.parse(await readFile(resolve(runtime,'local.json'),'utf8'));
const renewToken=(role,sub)=>{const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({role,sub,exp:Math.floor(Date.now()/1000)+86400});return data+'.'+createHmac('sha256',runtimeConfig.secret).update(data).digest('base64url');};
await writeFile(resolve(runtime,'local.json'),JSON.stringify({...runtimeConfig,anon:renewToken('anon'),service:renewToken('service_role'),teacher:renewToken('authenticated',runtimeConfig.user)}));
await db.end();
const rest=spawn(resolve(runtime,'postgrest/postgrest.exe'),[resolve(runtime,'postgrest.conf')],{windowsHide:true,env:{...process.env,PATH:resolve(runtime,'node_modules/@embedded-postgres/windows-x64/native/bin')+';'+process.env.PATH},stdio:['ignore','pipe','pipe']});rest.stdout.on('data',()=>{});rest.stderr.on('data',d=>console.log(String(d).slice(0,500)));
rest.on('error',()=>console.error('LOCAL_POSTGREST_START_FAILED'));
console.log('LOCAL_DB_READY PostgreSQL 18.4 ports 55432/55433');
process.on('SIGINT',async()=>{rest.kill();await pg.stop();process.exit();});
setInterval(()=>{},60000);
