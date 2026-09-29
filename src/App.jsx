import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import ProtectedRoute from './components/ProtectedRoute';
import { School, Link as LinkIcon } from 'lucide-react';
import { loadRoute } from './routeLoaders';
import MaintenancePage from './pages/MaintenancePage';
import { isMaintenanceActive, isMaintenanceBypassed } from './config/maintenance';

const Login                    = lazy(() => loadRoute('login'));
const AdminDashboard           = lazy(() => loadRoute('adminDashboard'));
const TeacherPortal            = lazy(() => loadRoute('teacherPortal'));
const StudentResults           = lazy(() => loadRoute('studentResults'));
const GradeManagement          = lazy(() => loadRoute('gradeManagement'));
const StudentAttendance        = lazy(() => loadRoute('studentAttendance'));
const TeacherAttendance        = lazy(() => loadRoute('teacherAttendance'));
const Reports                  = lazy(() => loadRoute('reports'));
const ScheduleManagement       = lazy(() => loadRoute('scheduleManagement'));
const FinanceDashboard         = lazy(() => loadRoute('financeDashboard'));
const ModuleManagement         = lazy(() => loadRoute('moduleManagement'));
const MonthlyAttendance        = lazy(() => loadRoute('monthlyAttendance'));
const MonthlyAttendanceTeachers = lazy(() => loadRoute('monthlyAttendanceTeachers'));
const AccessLogs               = lazy(() => loadRoute('accessLogs'));
const ScheduleGeneration       = lazy(() => loadRoute('scheduleGeneration'));
const ContinuousTrainings      = lazy(() => loadRoute('continuousTrainings'));
const UserManagement           = lazy(() => loadRoute('userManagement'));
const StudentScheduleView      = lazy(() => loadRoute('studentScheduleView'));

const PageLoader = () => (
  <div className="app-loader-shell">
    <div className="app-loader" role="status" aria-label="Chargement">
      <span className="app-loader-ring app-loader-ring-primary" />
      <span className="app-loader-ring app-loader-ring-secondary" />
      <span className="app-loader-core">
        <School size={22} />
      </span>
    </div>
  </div>
);

const isPortailDomain = typeof window !== 'undefined' && window.location.hostname === 'portail-ipfp.web.app';

const PortailBlockedPage = () => (
  <div className="flex-center" style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: 'var(--space-6)' }}>
    <div style={{ textAlign: 'center', maxWidth: '440px' }}>
      <div style={{ width: '80px', height: '80px', background: 'var(--primary-ultra-light)', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: 'var(--shadow-lg)' }}>
        <School size={40} />
      </div>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.04em' }}>
        Portail Académique IPFP
      </h1>
      <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '32px' }}>
        Cet accès est exclusivement réservé aux <strong>formateurs</strong> et aux <strong>stagiaires</strong> munis d'un lien d'accès sécurisé.
      </p>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-pill)', fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
        <LinkIcon size={14} style={{ color: 'var(--primary)' }} />
        <span>portail-ipfp.web.app/portal/token</span>
      </div>
    </div>
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  React.useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const AppContent = () => {
  const { loading, logAppAccess } = useApp();
  const { isAuthenticated: adminAuthIsAuthenticated, loading: authLoading } = useAdminAuth();
  const location = useLocation();
  const isPublicRoute = location.pathname.startsWith('/portal/') || location.pathname.startsWith('/results/') || location.pathname.startsWith('/teacher/') || location.pathname.startsWith('/schedule-view/');
  const isAuthed = adminAuthIsAuthenticated;

  const isBypassed = isMaintenanceBypassed(location.search);
  const isMaintenance = isMaintenanceActive() && !isBypassed;

  React.useEffect(() => {
    if (isMaintenance) return;
    if (loading || !logAppAccess) return;
    const accessType = isPublicRoute ? 'portail' : (isAuthed ? 'admin' : 'public');
    logAppAccess({ path: location.pathname, accessType });
  }, [isAuthed, isPublicRoute, loading, location.pathname, logAppAccess, isMaintenance]);

  if (isMaintenance) {
    return <MaintenancePage />;
  }

  if (isPortailDomain) {
    if (loading) return <PageLoader />;
    if (!isPublicRoute) return <PortailBlockedPage />;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <main style={{ flex: 1 }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/portal/:teacherId" element={<TeacherPortal />} />
              <Route path="/teacher/:teacherId" element={<TeacherPortal />} />
              <Route path="/results/:studentId" element={<StudentResults />} />
              <Route path="/schedule-view/:token" element={<StudentScheduleView />} />
              <Route path="/schedule-view/:diploma/:filiere/:annee" element={<StudentScheduleView />} />
              <Route path="*" element={<PortailBlockedPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    );
  }

  if (authLoading && !isPublicRoute) return <PageLoader />;
  if (!isAuthed && !isPublicRoute && location.pathname !== '/login') return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const appRoutes = (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<ProtectedRoute pageKey="dashboard"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute pageKey="students"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/teachers" element={<ProtectedRoute pageKey="teachers"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/schedules" element={<ProtectedRoute pageKey="schedules"><ScheduleManagement /></ProtectedRoute>} />
        <Route path="/admin/grades" element={<ProtectedRoute pageKey="grades"><GradeManagement /></ProtectedRoute>} />
        <Route path="/admin/attendance-students" element={<ProtectedRoute pageKey="attendance_students"><StudentAttendance /></ProtectedRoute>} />
        <Route path="/admin/monthly-attendance" element={<ProtectedRoute pageKey="attendance_students"><MonthlyAttendance /></ProtectedRoute>} />
        <Route path="/admin/monthly-attendance-teachers" element={<ProtectedRoute pageKey="attendance_teachers"><MonthlyAttendanceTeachers /></ProtectedRoute>} />
        <Route path="/admin/modules" element={<ProtectedRoute pageKey="modules"><ModuleManagement /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute pageKey="reports"><Reports /></ProtectedRoute>} />
        <Route path="/admin/attendance-teachers" element={<ProtectedRoute pageKey="attendance_teachers"><TeacherAttendance /></ProtectedRoute>} />
        <Route path="/admin/finance" element={<ProtectedRoute pageKey="finance"><FinanceDashboard /></ProtectedRoute>} />
        <Route path="/admin/continuous" element={<ProtectedRoute pageKey="continuous"><ContinuousTrainings /></ProtectedRoute>} />
        <Route path="/admin/logs" element={<ProtectedRoute pageKey="logs"><AccessLogs /></ProtectedRoute>} />
        <Route path="/admin/schedule-generation" element={<ProtectedRoute pageKey="schedule_generation"><ScheduleGeneration /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute pageKey="users"><UserManagement /></ProtectedRoute>} />
        <Route path="/admin/access-logs" element={<Navigate to="/admin/logs" replace />} />
        <Route path="/portal/:teacherId" element={<TeacherPortal />} />
        <Route path="/teacher/:teacherId" element={<TeacherPortal />} />
        <Route path="/results/:studentId" element={<StudentResults />} />
        <Route path="/schedule-view/:token" element={<StudentScheduleView />} />
        <Route path="/schedule-view/:diploma/:filiere/:annee" element={<StudentScheduleView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );

  if (!isAuthed || isPublicRoute) return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}><main style={{ flex: 1 }}>{appRoutes}</main></div>;
  return <DashboardLayout>{appRoutes}</DashboardLayout>;
};

const App = () => (
  <>
    <ScrollToTop />
    <PWAUpdatePrompt />
    <AppContent />
  </>
);

export default App;
