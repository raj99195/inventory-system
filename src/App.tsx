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

// ─── Attendance pages ─────────────────────────────────
import AttendanceHomePage from '@/pages/attendance/AttendanceHomePage';
import MarkAttendancePage from '@/pages/attendance/MarkAttendancePage';
import MyAttendancePage from '@/pages/attendance/MyAttendancePage';
import ApplyLeavePage from '@/pages/attendance/ApplyLeavePage';
import MyLeavesPage from '@/pages/attendance/MyLeavesPage';
import AttendanceAdminDashboardPage from '@/pages/attendance/admin/AttendanceAdminDashboardPage';
import AttendanceViewPage from '@/pages/attendance/admin/AttendanceViewPage';
import LeaveApprovalsPage from '@/pages/attendance/admin/LeaveApprovalsPage';
import SchoolsPage from '@/pages/attendance/admin/SchoolsPage';
import SchoolActionPage from '@/pages/attendance/admin/SchoolActionPage';
import AttendanceSettingsPage from '@/pages/attendance/admin/AttendanceSettingsPage';

// ─── Request pages ────────────────────────────────────
import MyRequestsPage from '@/pages/requests/MyRequestsPage';
import RequestAssetPage from '@/pages/requests/RequestAssetPage';
import RequestApprovalsPage from '@/pages/requests/admin/RequestApprovalsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, ready, noAccess } = useAuth();
  if (loading || !ready) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
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

        {/* Inventory */}
        <Route path="products" element={<ProductsPage />} />
        <Route path="kits" element={<KitsPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="quotations" element={<QuotationsPage />} />

        {/* HR + Assets */}
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />

        {/* Admin */}
        <Route path="audit" element={<AuditPage />} />
        <Route path="users" element={<UsersPage />} />

        {/* ─── Attendance (Employee) ─── */}
        <Route path="attendance" element={<AttendanceHomePage />} />
        <Route path="attendance/mark" element={<MarkAttendancePage />} />
        <Route path="attendance/my" element={<MyAttendancePage />} />
        <Route path="attendance/apply-leave" element={<ApplyLeavePage />} />
        <Route path="attendance/leaves" element={<MyLeavesPage />} />

        {/* ─── Attendance (Admin) ─── */}
        <Route path="attendance/admin" element={<AttendanceAdminDashboardPage />} />
        <Route path="attendance/admin/view" element={<AttendanceViewPage />} />
        <Route path="attendance/admin/leaves" element={<LeaveApprovalsPage />} />
        <Route path="attendance/admin/schools" element={<SchoolsPage />} />
        <Route path="attendance/admin/schools/new" element={<SchoolActionPage action="create" />} />
        <Route path="attendance/admin/schools/:schoolId/edit" element={<SchoolActionPage action="edit" />} />
        <Route path="attendance/admin/schools/:schoolId/delete" element={<SchoolActionPage action="delete" />} />
        <Route path="attendance/admin/settings" element={<AttendanceSettingsPage />} />

        {/* ─── Requests ─── */}
        <Route path="requests" element={<MyRequestsPage />} />
        <Route path="requests/new" element={<RequestAssetPage />} />
        <Route path="requests/admin" element={<RequestApprovalsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
