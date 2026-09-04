import { Navigate, Route, Routes } from 'react-router-dom';
import { ReceiptBookCreatePage } from './ReceiptBookCreatePage';
import { ReceiptBookDetailPage } from './ReceiptBookDetailPage';
import { ReceiptBooksListPage } from './ReceiptBooksListPage';

export function ReceiptBooksWorkspace() {
  return <Routes>
    <Route path="/tools/receipts" element={<ReceiptBooksListPage />} />
    <Route path="/tools/receipts/new" element={<ReceiptBookCreatePage />} />
    <Route path="/tools/receipts/:bookId" element={<ReceiptBookDetailPage />} />
    <Route path="*" element={<Navigate to="/tools/receipts" replace />} />
  </Routes>;
}
