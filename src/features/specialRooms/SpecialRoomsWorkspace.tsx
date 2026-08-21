import { Route, Routes } from 'react-router-dom';
import { SpecialRoomsCreatePage } from './SpecialRoomsCreatePage';
import { SpecialRoomsListPage } from './SpecialRoomsListPage';
import { SpecialRoomsManagePage } from './SpecialRoomsManagePage';

export function SpecialRoomsWorkspace() {
  return (
    <Routes>
      <Route path="/tools/special-rooms" element={<SpecialRoomsListPage />} />
      <Route path="/tools/special-rooms/new" element={<SpecialRoomsCreatePage />} />
      <Route path="/tools/special-rooms/:boardId" element={<SpecialRoomsManagePage />} />
    </Routes>
  );
}
