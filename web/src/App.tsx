import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Home } from '@/screens/patient/Home';
import { Settings } from '@/screens/patient/Settings';
import { useSourceBinding } from '@/store/useSourceBinding';

export function App() {
  useSourceBinding();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
