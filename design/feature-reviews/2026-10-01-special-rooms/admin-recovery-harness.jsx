import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BoardInfoCard } from '../../../src/features/specialRooms/BoardInfoCard';
import { ClosureCard } from '../../../src/features/specialRooms/ClosureCard';
// 실제 Chrome의 관리 컴포넌트 오류 복구 검사 전용. 운영 API나 SQL 검사가 아니다.
export function mount() {
  document.getElementById('root').style.display = 'none';
  const host = document.createElement('main');
  host.style.cssText = 'max-width:1000px;margin:auto;padding:20px';
  document.body.append(host);
  let shapeCalls = 0, impactCalls = 0, listCalls = 0;
  const board = { id:'20000000-0000-4000-8000-000000000001',title:'가상 관리 복구',description:'',metadataRevision:1,periodCount:9,includeSaturday:true,rooms:[{id:'30000000-0000-4000-8000-000000000001',name:'과학실'}],bookings:[],closures:[] };
  createRoot(host).render(createElement('div', null,
    createElement(BoardInfoCard, { board, onSave: async () => { host.dataset.saved = 'yes'; }, onImpact: async () => {
      if (++shapeCalls === 1) throw new Error('synthetic count failure');
      return {count:1,periods:[{period:9,count:1}],saturdayCount:0};
    }}),
    createElement(ClosureCard, { board, onAdd: async () => { host.dataset.added = 'yes'; }, onRemove: async () => {}, onImpact: async () => {
      if (++impactCalls === 1) throw new Error('synthetic count failure'); return 1;
    }, onList: async () => {
      if (++listCalls === 1) throw new Error('synthetic list failure'); return {items:[],count:0};
    }})
  ));
}
