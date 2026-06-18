import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import SettingsPage from './pages/SettingsPage';
import DialogHost from './components/dialogs/DialogHost';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DialogHost />
    </>
  );
}
