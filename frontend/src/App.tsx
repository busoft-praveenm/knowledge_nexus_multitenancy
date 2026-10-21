import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Admin } from './pages/Admin';
import { AgentChat } from './pages/AgentChat';
import { AttackLab } from './pages/AttackLab';
import { DataExplorer } from './pages/DataExplorer';
import { Login } from './pages/Login';

function RequireAuth({ children, admin }: { children: JSX.Element; admin?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'platform_admin') return <Navigate to="/data" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/data" element={<DataExplorer />} />
        <Route path="/agent" element={<AgentChat />} />
        <Route path="/attacks" element={<AttackLab />} />
        <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/data" replace />} />
    </Routes>
  );
}
