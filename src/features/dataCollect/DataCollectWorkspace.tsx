import { Route, Routes } from 'react-router-dom';
import { DataCollectAuthGate } from './DataCollectAuthGate';
import { DataCollectCreatePage } from './DataCollectCreatePage';
import { DataCollectListPage } from './DataCollectListPage';
import { DataCollectManagePage } from './DataCollectManagePage';

export function DataCollectWorkspace() {
  return <DataCollectAuthGate><Routes><Route path="/tools/data-collect" element={<DataCollectListPage />} /><Route path="/tools/data-collect/new" element={<DataCollectCreatePage />} /><Route path="/tools/data-collect/:id" element={<DataCollectManagePage />} /></Routes></DataCollectAuthGate>;
}
