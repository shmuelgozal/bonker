import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UnitsList from './pages/UnitsList';
import BunkersList from './pages/BunkersList';
import BunkerDetail from './pages/BunkerDetail';
import AmmoTypes from './pages/AmmoTypes';
import BunkerInventoryAdd from './pages/BunkerInventoryAdd';
import BunkerCountNew from './pages/BunkerCountNew';
import BunkerIssuanceNew from './pages/BunkerIssuanceNew';
import BunkerStandard from './pages/BunkerStandard';
import IssuanceDetail from './pages/IssuanceDetail';
import Settings from './pages/Settings';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/units" element={<UnitsList />} />
          <Route path="/bunkers" element={<BunkersList />} />
          <Route path="/bunkers/:id" element={<BunkerDetail />} />
          <Route path="/bunkers/:id/inventory/add" element={<BunkerInventoryAdd />} />
          <Route path="/bunkers/:id/count/new" element={<BunkerCountNew />} />
          <Route path="/bunkers/:id/issuance/new" element={<BunkerIssuanceNew />} />
          <Route path="/bunkers/:id/issuances/:issuanceId" element={<IssuanceDetail />} />
          <Route path="/bunkers/:id/standard" element={<BunkerStandard />} />
          <Route path="/ammo-types" element={<AmmoTypes />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
