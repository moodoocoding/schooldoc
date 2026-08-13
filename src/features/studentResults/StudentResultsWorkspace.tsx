import { Route, Routes } from 'react-router-dom';
import { StudentResultsAuthGate } from './StudentResultsAuthGate';
import { StudentResultsCreatePage } from './StudentResultsCreatePage';
import { StudentResultsListPage } from './StudentResultsListPage';
import { StudentResultsManagePage } from './StudentResultsManagePage';
import { StudentResultsQrPrintPage } from './StudentResultsQrPrintPage';

export function StudentResultsWorkspace() {
  return (
    <StudentResultsAuthGate>
      <Routes>
        <Route path="/tools/student-results" element={<StudentResultsListPage />} />
        <Route path="/tools/student-results/new" element={<StudentResultsCreatePage />} />
        <Route path="/tools/student-results/:resultId/qr-print" element={<StudentResultsQrPrintPage />} />
        <Route path="/tools/student-results/:resultId" element={<StudentResultsManagePage />} />
      </Routes>
    </StudentResultsAuthGate>
  );
}
