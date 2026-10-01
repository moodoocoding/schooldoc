import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
process.loadEnvFile('.env.production.local');
const url=process.env.VITE_SUPABASE_URL;
const anon=process.env.VITE_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname,'jhystopaacyfvjxhnpyd.supabase.co');
assert(anon && !anon.includes('SENSITIVE'));
const token='00000000-0000-4000-8000-000000000000';
const results=[];
const call=async(name,body,expected)=>{
 const r=await fetch(`${url}/functions/v1/${name}`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${anon}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const response=await r.json().catch(()=>({}));
 results.push({function:name,action:body.action,status:r.status,expected,hasError:typeof response.error==='string'});
 assert.equal(r.status,expected,`${name} ${body.action}`);
 assert(typeof response.error==='string',`${name} must return a controlled error`);
};
for(const name of ['consent-forms-public','registry-public','data-collect-public','special-rooms-public']) {
 await call(name,{action:'metadata',token},404);
 await call(name,{action:'metadata',token:'invalid-token'},400);
}
for(const [name,body] of [
 ['consent-forms-admin',{action:'list'}],
 ['registry-participants',{action:'snapshot',registryId:token}],
 ['registry-pdf',{registryId:token}],
 ['data-collect-admin',{action:'list'}],
 ['special-rooms-admin',{action:'calendar',boardId:token}],
]) await call(name,body,401);
for(const resource of ['consent_forms','registries','data_collections','special_room_boards']) {
 const r=await fetch(`${url}/rest/v1/${resource}?select=id&limit=1`,{headers:{apikey:anon,Authorization:`Bearer ${anon}`},signal:AbortSignal.timeout(30000)});
 const data=await r.json();
 assert([200,401,403].includes(r.status));
 if(r.ok) assert.deepEqual(data,[],`${resource} anonymous data must be empty`);
 results.push({resource,status:r.status,anonymousRows:r.ok?data.length:null});
}
await writeFile('design/feature-reviews/2026-10-02-integration/remote-api.json',JSON.stringify({project:'jhystopaacyfvjxhnpyd',mode:'read and rejection only; no business records created or deleted',results},null,2));
console.log('PASS '+results.length+' deployed API/rejection/RLS checks, no business data changed');
