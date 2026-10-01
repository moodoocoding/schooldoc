import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { RegistryParticipant } from '../../src/features/registry/types';
const mocks = vi.hoisted(() => {
  const rpc=vi.fn(),invoke=vi.fn(),signedUrls=vi.fn();
  const callbacks:Array<()=>void>=[],filters:Array<Record<string,unknown>>=[];
  const channel={on:vi.fn((_:string,filter:Record<string,unknown>,callback:()=>void)=>{filters.push(filter);callbacks.push(callback);return channel;}),subscribe:vi.fn(()=>channel)};
  return {rpc,invoke,signedUrls,callbacks,filters,channel,removeChannel:vi.fn()};
});
vi.mock('../../src/utils/supabaseClient',()=>({supabase:{rpc:mocks.rpc,functions:{invoke:mocks.invoke},storage:{from:()=>({createSignedUrls:mocks.signedUrls})},channel:()=>mocks.channel,removeChannel:mocks.removeChannel}}));
import { getRemoteRegistry, listRemoteRegistrySummaries, loadParticipantImages, subscribeRemoteRegistries } from '../../src/features/registry/registryRepository';

beforeEach(()=>{vi.clearAllMocks();mocks.callbacks.length=0;mocks.filters.length=0;});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
test('목록은 요약 RPC 한 번만 호출하고 명단·서명 URL을 읽지 않는다',async()=>{
  mocks.rpc.mockResolvedValue({data:[{id:'r',title:'가상등록부',left_header:'',right_header:'',mode:'fixed',status:'open',participant_count:1500,signed_count:1200,updated_at:'now'}],error:null});
  const rows=await listRemoteRegistrySummaries();
  expect(rows[0].participantCount).toBe(1500);expect(rows[0]).not.toHaveProperty('participants');
  expect(mocks.rpc).toHaveBeenCalledOnce();expect(mocks.rpc).toHaveBeenCalledWith('registry_owner_summaries');
  expect(mocks.invoke).not.toHaveBeenCalled();expect(mocks.signedUrls).not.toHaveBeenCalled();
});
test('상세 snapshot 한 번으로 완료 상태를 보존하며 파일 URL은 요청하지 않는다',async()=>{
  mocks.invoke.mockResolvedValue({data:{registry:{id:'r',public_token:'token',title:'가상등록부',status:'open',mode:'fixed'},columns:[],participants:[{id:'p',registry_id:'r',row_number:1,name:'가상교사',status:'signed',signed_at:'now',field_values:{}}],signatures:[]},error:null});
  const row=await getRemoteRegistry('r');expect(row?.participants[0].signature).toBeDefined();
  expect(row?.participants[0].signature?.dataUrl).toBe('');expect(mocks.invoke).toHaveBeenCalledOnce();expect(mocks.signedUrls).not.toHaveBeenCalled();
});
test('현재 쪽 서명만 한 URL 묶음으로 발급하며 누락 파일은 완료 상태와 분리한다',async()=>{
  mocks.signedUrls.mockResolvedValue({data:[{signedUrl:'https://image.invalid/signed'}],error:null});
  const signature={dataUrl:'',source:'draw' as const,signedAt:'now'};
  const participants:RegistryParticipant[]=[{id:'p1',rowNumber:1,name:'가상1',values:{},signature,signaturePath:'r/p1/file.png'},{id:'p2',rowNumber:2,name:'가상2',values:{},signature},{id:'p3',rowNumber:3,name:'가상3',values:{}}];
  const loaded=await loadParticipantImages(participants);
  expect(mocks.signedUrls).toHaveBeenCalledOnce();expect(mocks.signedUrls).toHaveBeenCalledWith(['r/p1/file.png'],3600);
  expect(loaded[0].signature?.dataUrl).toBe('https://image.invalid/signed');expect(loaded[1].imageError).toBe(true);expect(loaded[1].signature).toBeDefined();expect(loaded[2].signature).toBeUndefined();
});
test('실시간 변경은 등록부 범위를 지키고 350ms마다 한 번 갱신하며 종료 시 예약을 취소한다',()=>{
  vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());
  vi.stubGlobal('document',Object.assign(new EventTarget(),{visibilityState:'visible'}));
  const listener=vi.fn(),stop=subscribeRemoteRegistries(listener,'r');
  expect(mocks.filters).toHaveLength(6);expect(mocks.filters.every(f=>f.filter==='id=eq.r'||f.filter==='registry_id=eq.r')).toBe(true);
  expect(mocks.filters.every(f=>f.table!=='registry_signatures')).toBe(true);
  mocks.callbacks[0]();vi.advanceTimersByTime(200);mocks.callbacks[1]();vi.advanceTimersByTime(150);
  expect(listener).toHaveBeenCalledOnce();
  mocks.callbacks[2]();mocks.callbacks[3]();vi.advanceTimersByTime(350);expect(listener).toHaveBeenCalledTimes(2);
  mocks.callbacks[0]();stop();vi.advanceTimersByTime(350);expect(listener).toHaveBeenCalledTimes(2);expect(mocks.removeChannel).toHaveBeenCalledOnce();
});
