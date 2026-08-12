import { Route, Routes } from 'react-router-dom';
import { RegistryAuthGate } from './RegistryAuthGate';
import { RegistryCreatePage } from './RegistryCreatePage';
import { RegistryListPage } from './RegistryListPage';
import { RegistryManagePage } from './RegistryManagePage';

export function RegistryWorkspace() {
  return (
    <RegistryAuthGate>
      <Routes>
        <Route path="/tools/registry-sign" element={<RegistryListPage />} />
        <Route path="/tools/registry-sign/new" element={<RegistryCreatePage />} />
        <Route path="/tools/registry-sign/:registryId" element={<RegistryManagePage />} />
      </Routes>
    </RegistryAuthGate>
  );
}
