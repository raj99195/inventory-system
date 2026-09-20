import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import KitsPage from './pages/KitsPage';
import StockPage from './pages/StockPage';
import InvoicesPage from './pages/InvoicesPage';
import EmployeesPage from './pages/EmployeesPage';
import AssetsPage from './pages/AssetsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import AuditPage from './pages/AuditPage';
import UsersPage from './pages/UsersPage';
import NoAccessPage from './pages/NoAccessPage';
import LoadingScreen from './components/ui/LoadingScreen';
import QuotationsPage from '@/pages/QuotationsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, ready, noAccess } = useAuth();
  if (loading || !ready) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  // Signed in but no user doc → NoAccess page (no Firestore listeners fire = no error spam)
  if (noAccess) return <NoAccessPage />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="kits" element={<KitsPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="/quotations" element={<QuotationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
