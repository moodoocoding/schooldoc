import { Route, Routes } from 'react-router-dom';
import { SpecialRoomsCreatePage } from './SpecialRoomsCreatePage';
import { SpecialRoomsListPage } from './SpecialRoomsListPage';
import { SpecialRoomsManagePage } from './SpecialRoomsManagePage';
import { SpecialRoomsAuthGate } from './SpecialRoomsAuthGate';

export function SpecialRoomsWorkspace() {
  return (
    <SpecialRoomsAuthGate>
      <Routes>
        <Route path="/tools/special-rooms" element={<SpecialRoomsListPage />} />
        <Route path="/tools/special-rooms/new" element={<SpecialRoomsCreatePage />} />
        <Route path="/tools/special-rooms/:boardId" element={<SpecialRoomsManagePage />} />
      </Routes>
    </SpecialRoomsAuthGate>
  );
}
