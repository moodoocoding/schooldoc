import { Route, Routes } from 'react-router-dom';
import { ConsentFormsAuthGate } from './ConsentFormsAuthGate';
import { ConsentFormsCreatePage } from './ConsentFormsCreatePage';
import { ConsentFormsListPage } from './ConsentFormsListPage';
import { ConsentFormsManagePage } from './ConsentFormsManagePage';

export function ConsentFormsWorkspace() {
  return <ConsentFormsAuthGate><Routes><Route path="/tools/consent-forms" element={<ConsentFormsListPage />} /><Route path="/tools/consent-forms/new" element={<ConsentFormsCreatePage />} /><Route path="/tools/consent-forms/:id" element={<ConsentFormsManagePage />} /></Routes></ConsentFormsAuthGate>;
}
