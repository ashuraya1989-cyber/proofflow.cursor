import { Navigate, Route, Routes } from "react-router-dom";
import { AdminShell } from "../pages/admin/AdminShell";
import { ShareGallery } from "../pages/share/ShareGallery";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/*" element={<AdminShell />} />
      <Route path="/share/:shareId" element={<ShareGallery />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

