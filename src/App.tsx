import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import StockPage from './pages/StockPage';
import InvoicesPage from './pages/InvoicesPage';
import EmployeesPage from './pages/EmployeesPage';
import AssetsPage from './pages/AssetsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import RepairsPage from './pages/RepairsPage';
import ReportsPage from './pages/ReportsPage';
import AuditPage from './pages/AuditPage';
import LoadingScreen from './components/ui/LoadingScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
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
        <Route path="stock" element={<StockPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="repairs" element={<RepairsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
