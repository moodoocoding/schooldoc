import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { consentCrypto } from '../_shared/consentCrypto.ts';
import { ConsentHttpError as HttpError, dbResult, uuidPattern, decryptRecipients, responseDetails, recordCleanup, validateConsentFields } from '../_shared/consentServer.ts';
const corsHeaders = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8'}});
const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
if (!url || !serviceKey) throw new Error('Supabase service environment is not configured.');
const db = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const cleanForm = (form: Record<string, unknown>) => { const {password_digest,...rest} = form; return {...rest,password_enabled:Boolean(password_digest)}; };
const requireUser = async (request: Request) => {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || !anonKey) throw new HttpError(401,'로그인이 필요합니다.');
  const caller = createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
  const result = await caller.auth.getUser();
  if (result.error || !result.data.user) throw new HttpError(401,'로그인 정보를 확인하지 못했습니다.');
  return result.data.user.id;
};
const ownedForm = async (formId: string, userId: string) => {
  const form = dbResult(await db.from('consent_forms').select('*').eq('id',formId).eq('owner_id',userId).maybeSingle());
  if (!form) throw new HttpError(403,'이 가정통신문을 관리할 권한이 없습니다.');
  return form;
};
const requireCrypto = () => { if (!consentCrypto.isConfigured()) throw new HttpError(503,'명단과 응답 암호화 설정을 확인해 주세요. 입력을 유지한 채 다시 시도할 수 있습니다.'); };
const encodeRecipients = async (value: unknown) => {
  if (!Array.isArray(value) || value.length > 2000) throw new HttpError(422,'명단은 2000명까지 저장할 수 있습니다.');
  requireCrypto(); const ids = new Set<string>();
  return await Promise.all(value.map(async item => {
    if (!item || typeof item !== 'object') throw new HttpError(422,'명단 형식을 확인해 주세요.');
    const id = item.id ?? crypto.randomUUID();
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const studentKey = typeof item.studentKey === 'string' ? item.studentKey.trim() : '';
    if (!uuidPattern.test(id) || ids.has(id) || !name || name.length > 60 || studentKey.length > 60) throw new HttpError(422,'수신자 이름과 식별값을 확인해 주세요.');
    ids.add(id);
    return {id,identity_ciphertext:await consentCrypto.encryptPayload({name,studentKey}),name_lookup:await consentCrypto.nameLookup(name),
      identity_lookup:await consentCrypto.nameLookup(JSON.stringify([name,studentKey])),display_hint:name[0]+'○'.repeat(Math.min(name.length-1,3))};
  }));
};
const allPaths = async (bucket: string, prefix: string): Promise<string[]> => {
  const paths: string[] = [];
  for (let offset=0;;offset+=1000) {
    const rows = dbResult(await db.storage.from(bucket).list(prefix,{limit:1000,offset,sortBy:{column:'name',order:'asc'}})) ?? [];
    for (const row of rows) {
      const path = `${prefix}/${row.name}`;
      if (row.id) paths.push(path); else paths.push(...await allPaths(bucket,path));
    }
    if (rows.length < 1000) return paths;
  }
};
const removeVerified = async (bucket: string, paths: string[], prefix: string) => {
  for(let i=0;i<paths.length;i+=100) dbResult(await db.storage.from(bucket).remove(paths.slice(i,i+100)));
  if ((await allPaths(bucket,prefix)).length) throw new HttpError(500,'파일 삭제를 확인하지 못했습니다. 수합을 보존했으며 다시 시도할 수 있습니다.');
};
const purge = async (id: string, userId: string, count: unknown) => {
  if (!Number.isInteger(count) || Number(count)<0) throw new HttpError(409,'파기 대상과 응답 수를 다시 확인해 주세요.');
  const form = dbResult(await db.rpc('begin_consent_purge',{p_form_id:id,p_owner_id:userId,p_expected_count:count}));
  try {
    const signatures = await allPaths('consent-signatures',id);
    const documents = await allPaths('consent-documents',`${userId}/${id}`);
    if(form.purge_file_count===null || form.purge_file_count===undefined) dbResult(await db.from('consent_forms').update({purge_file_count:signatures.length+documents.length}).eq('id',id).is('purge_file_count',null));
    await removeVerified('consent-signatures',signatures,id);
    await removeVerified('consent-documents',documents,`${userId}/${id}`);
    dbResult(await db.rpc('finish_consent_purge',{p_form_id:id,p_owner_id:userId,p_file_count:signatures.length+documents.length}));
    return {id,title:form.title,responseCount:form.response_count,signatureCount:signatures.length};
  } catch(error) {
    await recordCleanup(db,userId,id,'purge',[]);
    throw error;
  }
};
const cursorOf = (value: unknown): {at:string;id:string} | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object') throw new HttpError(400,'조회 위치를 확인해 주세요.');
  const item = value as {at?:unknown;id?:unknown};
  if(typeof item.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T[0-9:.+Z-]+$/.test(item.at) || typeof item.id !== 'string' || !uuidPattern.test(item.id)) throw new HttpError(400,'조회 위치를 확인해 주세요.');
  return {at:item.at,id:item.id};
};
export const consentAdminHandler = async (request: Request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST') return json(405,{error:'허용되지 않은 요청입니다.'});
  try {
    const body = await request.json() as Record<string,unknown>;
    const userId = await requireUser(request); const action = body.action;
    if(action==='forms') {
      let query = db.from('consent_forms').select('id,public_token,title,file_name,description,field_count,recipient_mode,recipient_count,deadline,allow_resubmission,response_count,current_response_count,status,publication_state,closed_at,created_at,retention_months,document_revision,password_enabled:password_digest').eq('owner_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
      const cursor = cursorOf(body.cursor); if(cursor) query=query.or(`created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`);
      const rows = (dbResult(await query) ?? []).map(row=>({...row,password_enabled:Boolean(row.password_enabled)}));
      const last=rows.at(-1); return json(200,{forms:rows,nextCursor:rows.length===100 && last?{at:last.created_at,id:last.id}:null});
    }
    if(action==='purge') {
      const ids = Array.isArray(body.formIds)?body.formIds:[];
      if(!ids.length || ids.length>200) throw new HttpError(422,'파기 대상을 1~200개 선택해 주세요.');
      const counts = (body.expectedCounts ?? {}) as Record<string,unknown>; const purged=[]; const failed=[];
      for(const id of ids) {
        if(typeof id!=='string' || !uuidPattern.test(id)) throw new HttpError(400,'파기 대상을 확인해 주세요.');
        try {purged.push(await purge(id,userId,counts[id]));} catch(error) {failed.push({id,error:error instanceof HttpError?error.message:'파일 삭제를 확인하지 못했습니다. 다시 시도해 주세요.'});}
      }
      return json(200,{purged,failed});
    }
    const id=typeof body.formId==='string'?body.formId:'';
    if(!uuidPattern.test(id)) throw new HttpError(400,'가정통신문을 찾을 수 없습니다.');
    if(action==='bundle') {
      requireCrypto(); const result=dbResult(await db.rpc('consent_management_bundle',{p_form_id:id,p_owner_id:userId}));
      return json(200,{...result,recipients:await decryptRecipients(result.recipients),responses:result.responses.map((r:Record<string,unknown>)=>({id:r.id,recipientId:r.recipient_id,submittedAt:r.submitted_at,values:{},detailsLoaded:false}))});
    }
    const form=await ownedForm(id,userId);
    if(action==='get') return json(200,{form:cleanForm(form)});
    if(action==='finalize' || action==='replace') {
      validateConsentFields(form.fields,form.page_count);
      if(!String(form.source_path).startsWith(`${userId}/${id}/`)) throw new HttpError(400,'원본 저장 위치를 확인해 주세요.');
      dbResult(await db.storage.from('consent-documents').createSignedUrl(form.source_path,60));
      const rows=await encodeRecipients(body.recipients);
      const result=dbResult(await db.rpc('finalize_consent_form',{p_form_id:id,p_owner_id:userId,p_recipients:rows,p_password:body.password || null}));
      return json(200,{form:result,saved:rows.length});
    }
    if(action==='save' || action==='reissue') {
      const input=(body.patch ?? {}) as Record<string,unknown>; const patch:Record<string,unknown>={};
      const allowed=['title','description','deadline','allow_resubmission','status','retention_months','file_name','source_path','fields','page_count','page_sizes','password','password_enabled'];
      for(const key of Object.keys(input)) { if(!allowed.includes(key)) throw new HttpError(400,'수정 항목을 확인해 주세요.'); patch[key]=input[key]; }
      if(patch.fields) validateConsentFields(patch.fields as Array<Record<string,unknown>>,Number(patch.page_count ?? form.page_count));
      if(action==='reissue') {
        if(form.publication_state==='purging') throw new HttpError(409,'파기 중인 수합입니다.');
        const result=dbResult(await db.from('consent_forms').update({public_token:crypto.randomUUID()}).eq('id',id).select('public_token').single());
        return json(200,{publicToken:result!.public_token});
      }
      const saved=dbResult(await db.rpc('save_consent_form',{p_form_id:id,p_owner_id:userId,p_patch:patch}));
      // 버전 교체 후 이전 파일 정리. 이전 경로는 서비스가 읽은 소유 자료만 사용한다.
      if(patch.source_path && patch.source_path!==form.source_path) {
        const removed=await db.storage.from('consent-documents').remove([form.source_path]);
        if(removed.error) await recordCleanup(db,userId,id,'document',[form.source_path]);
      }
      return json(200,{form:saved});
    }
    if(action==='discard-upload') {
      const path=typeof body.path==='string'?body.path:'';
      if(!path.startsWith(`${userId}/${id}/`) || !/^.+\/[0-9a-f-]+\.pdf$/.test(path)) throw new HttpError(400,'파일 경로를 확인해 주세요.');
      if(path===form.source_path) return json(200,{removed:false});
      const removed=await db.storage.from('consent-documents').remove([path]);
      if(removed.error) await recordCleanup(db,userId,id,'document',[path]);
      return json(200,{removed:!removed.error});
    }
    if(action==='duplicate') {
      const copyId=crypto.randomUUID(); const copyPath=`${userId}/${copyId}/${crypto.randomUUID()}.pdf`;
      dbResult(await db.storage.from('consent-documents').copy(form.source_path,copyPath));
      try {
        dbResult(await db.from('consent_forms').insert({id:copyId,owner_id:userId,title:`${form.title} 사본`.slice(0,200),file_name:form.file_name,source_path:copyPath,description:form.description,fields:form.fields,page_count:form.page_count,page_sizes:form.page_sizes,recipient_mode:form.recipient_mode,allow_resubmission:form.allow_resubmission,retention_months:form.retention_months}));
        const people=(dbResult(await db.from('consent_recipients').select('identity_ciphertext,name_lookup,identity_lookup,display_hint').eq('form_id',id).order('created_at').order('id').limit(2000)) ?? []).map(p=>({...p,id:crypto.randomUUID()}));
        dbResult(await db.rpc('finalize_consent_form',{p_form_id:copyId,p_owner_id:userId,p_recipients:people,p_password:null}));
        return json(200,{id:copyId,title:`${form.title} 사본`.slice(0,200),recipientCount:people.length});
      } catch(error) {
        // 준비 중인 사본만 정리한다. 완료 응답 유실은 준비 완료 사본을 보존한다.
        const check=await db.from('consent_forms').select('publication_state').eq('id',copyId).maybeSingle();
        if(!check.error && (!check.data || check.data.publication_state==='preparing')) {
          const removed=await db.storage.from('consent-documents').remove([copyPath]);
          if(!removed.error) await db.from('consent_forms').delete().eq('id',copyId).eq('publication_state','preparing');
          else await recordCleanup(db,userId,copyId,'document',[copyPath]);
        }
        throw error;
      }
    }
    requireCrypto();
    if(action==='list') {
      let query=db.from('consent_recipients').select('id,token,identity_ciphertext,response_id,submitted_at,created_at').eq('form_id',id).order('created_at').order('id').limit(60);
      const cursor=cursorOf(body.cursor); if(cursor) query=query.or(`created_at.gt.${cursor.at},and(created_at.eq.${cursor.at},id.gt.${cursor.id})`);
      const rows=dbResult(await query) ?? []; const last=rows.at(-1);
      return json(200,{recipients:await decryptRecipients(rows),nextCursor:rows.length===60 && last?{at:last.created_at,id:last.id}:null});
    }
    if(action==='detail') {
      if(typeof body.responseId!=='string' || !uuidPattern.test(body.responseId)) throw new HttpError(400,'응답을 확인해 주세요.');
      const rows=dbResult(await db.from('consent_responses').select('id,recipient_id,submitted_at,values_ciphertext').eq('form_id',id).eq('id',body.responseId)) ?? [];
      if(!rows.length) throw new HttpError(404,'응답을 찾을 수 없습니다.');
      const response=(await responseDetails(db,rows))[0];
      const recipient=rows[0].recipient_id ? dbResult(await db.from('consent_recipients').select('identity_ciphertext').eq('id',rows[0].recipient_id).eq('form_id',id).maybeSingle()) : null;
      const identity=recipient ? await consentCrypto.decryptPayload<{name:string}>(recipient.identity_ciphertext) : null;
      return json(200,{response:{...response,recipientName:identity?.name}});
    }
    if(action==='responses' || action==='history' || action==='headers') {
      if(action==='history' && (typeof body.recipientId!=='string' || !uuidPattern.test(body.recipientId))) throw new HttpError(400,'수신자를 확인해 주세요.');
      if(body.version!==undefined && body.version!==form.updated_at) throw new HttpError(409,'내보내기 중 응답이 변경되었습니다. 다시 시작해 주세요.');
      let query=db.from(action==='history'?'consent_responses':'consent_current_responses').select(action==='responses'?'id,recipient_id,submitted_at,values_ciphertext':'id,recipient_id,submitted_at').eq('form_id',id).order('submitted_at',{ascending:false}).order('id',{ascending:false}).limit(60);
      if(action==='history') query=query.eq('recipient_id',body.recipientId);
      const cursor=cursorOf(body.cursor); if(cursor) query=query.or(`submitted_at.lt.${cursor.at},and(submitted_at.eq.${cursor.at},id.lt.${cursor.id})`);
      const rows=dbResult(await query.returns<Array<{id:string;recipient_id:string|null;submitted_at:string;values_ciphertext?:string}>>()) ?? []; const last=rows.at(-1);
      const responses=action!=='responses'?rows.map(r=>({id:r.id,recipientId:r.recipient_id,submittedAt:r.submitted_at,values:{},detailsLoaded:false})):await responseDetails(db,rows);
      // 내보내기 페이지가 변경된 순간의 결과를 섞지 않는다.
      const checked=await ownedForm(id,userId); if(checked.updated_at!==form.updated_at) throw new HttpError(409,'내보내기 중 응답이 변경되었습니다. 다시 시작해 주세요.');
      return json(200,{responses,version:form.updated_at,nextCursor:rows.length===60 && last?{at:last.submitted_at,id:last.id}:null});
    }
    throw new HttpError(400,'지원하지 않는 요청입니다.');
  } catch(error) {
    if(error instanceof HttpError) return json(error.status,{error:error.message});
    console.error('consent admin request failed'); return json(500,{error:'가정통신문 요청을 처리하지 못했습니다. 입력을 유지한 채 다시 시도해 주세요.'});
  }
};
if(import.meta.main) Deno.serve(consentAdminHandler);
