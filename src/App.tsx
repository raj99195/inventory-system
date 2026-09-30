import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { usePermission } from './hooks/usePermission';
import LoginPage from './pages/LoginPage';
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const KitsPage = lazy(() => import('./pages/KitsPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const NoAccessPage = lazy(() => import('./pages/NoAccessPage'));
import LoadingScreen from './components/ui/LoadingScreen';
import { hrmsHomePath } from '@/lib/permissions';
const QuotationsPage = lazy(() => import('@/pages/QuotationsPage'));

// ─── Attendance pages ─────────────────────────────────
const HolidayCalendarPage = lazy(() => import('@/pages/attendance/HolidayCalendarPage'));
const AttendanceHomePage = lazy(() => import('@/pages/attendance/AttendanceHomePage'));
const MarkAttendancePage = lazy(() => import('@/pages/attendance/MarkAttendancePage'));
const MyAttendancePage = lazy(() => import('@/pages/attendance/MyAttendancePage'));
const ApplyLeavePage = lazy(() => import('@/pages/attendance/ApplyLeavePage'));
const MyLeavesPage = lazy(() => import('@/pages/attendance/MyLeavesPage'));
const AttendanceAdminDashboardPage = lazy(() => import('@/pages/attendance/admin/AttendanceAdminDashboardPage'));
const AttendanceViewPage = lazy(() => import('@/pages/attendance/admin/AttendanceViewPage'));
const LeaveApprovalsPage = lazy(() => import('@/pages/attendance/admin/LeaveApprovalsPage'));
const SchoolsPage = lazy(() => import('@/pages/attendance/admin/SchoolsPage'));
const SchoolActionPage = lazy(() => import('@/pages/attendance/admin/SchoolActionPage'));
const AttendanceSettingsPage = lazy(() => import('@/pages/attendance/admin/AttendanceSettingsPage'));

// ─── Request pages ────────────────────────────────────
const MyRequestsPage = lazy(() => import('@/pages/requests/MyRequestsPage'));
const RequestAssetPage = lazy(() => import('@/pages/requests/RequestAssetPage'));
const RequestApprovalsPage = lazy(() => import('@/pages/requests/admin/RequestApprovalsPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, ready, noAccess } = useAuth();
  if (loading || !ready) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (noAccess) return <NoAccessPage />;
  return <>{children}</>;
}

function DashboardEntry() {
  const { userDoc } = useAuth();
  return <Navigate to={hrmsHomePath(userDoc)} replace />;
}

function InventoryEntry() {
  const { can } = usePermission();
  if (can('dashboard.view')) return <DashboardPage />;
  const target = [['products.view', '/products'], ['kits.view', '/kits'], ['stock.view', '/stock'], ['assets.view', '/assets'], ['requests.viewOwn', '/requests']].find(([permission]) => can(permission));
  return target ? <Navigate to={target[1]} replace /> : <p>No Inventory access has been assigned to your role.</p>;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardEntry />} />
        <Route path="inventory" element={<InventoryEntry />} />

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
        <Route path="attendance/holidays" element={<HolidayCalendarPage />} />
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
    </Routes></Suspense>
  );
}
