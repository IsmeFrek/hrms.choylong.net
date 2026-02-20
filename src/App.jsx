import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DailyAttendanceReport from './pages/DailyAttendanceReport.jsx';
import ImportAttendance from './pages/ImportAttendance.jsx';
import HRRoleSummaryPage from './pages/HRRoleSummaryPage.jsx';
import HRSkillSummaryPage from './pages/HRSkillSummaryPage.jsx';
import DepartmentUnits from './pages/DepartmentUnits.jsx';
import HrDisplayPage from './pages/HrDisplay.jsx';
import AttendanceMonthlyReportPage from './pages/AttendanceMonthlyReportPage.jsx';
import AttendancedayReportPage from './pages/AttendancedayReportPage.jsx';
import DailyReportsPage from './pages/DailyReportsPage';

import Layout from './components/Layout';
import MinimalLayout from './components/MinimalLayout';
import DepartmentPage from './components/DepartmentPage';
import PositionPage from './components/PositionPage';
import Dashboard from './components/Dashboard';
// Removed employees modules
import SkillPage from './components/SkillPage';
import MinistrySkillPage from './components/MinistrySkillPage';
import HRPage from './components/HRPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import EmployeeReportPage from './pages/EmployeeReportPage';
import EmployeeReport from './pages/EmployeeReport.jsx';
import ShiftsPage from './pages/ShiftsPage';
import RetirementReportPage from './pages/RetirementReportPage';
import TransformationReportPage from './pages/TransformationReportPage';
import PromotionByRotationReportPage from './pages/PromotionByRotationReportPage';
import PromotionByDiplomaReportPage from './pages/PromotionByDiplomaReportPage';
import PromotionByHonorReportPage from './pages/PromotionByHonorReportPage';
import UnpaidLeaveReportPage from './pages/UnpaidLeaveReportPage';
import OfficialDelistedReportPage from './pages/OfficialDelistedReportPage';
import MaternityLeaveReportPage from './pages/MaternityLeaveReportPage';
import StudyLeaveReportPage from './pages/StudyLeaveReportPage';
import AttendancePage from './pages/AttendancePage';
import AttendanceReportPage from './pages/AttendanceReportPage';
import WorkCalendarPage from './pages/WorkCalendarPage';
import WorkSchedulePage from './pages/WorkSchedulePage';
import AttendanceMonthlyDataPage from './pages/AttendanceMonthlyDataPage';
import AttendanceDayAttendanceDataPage from './pages/AttendanceDayAttendanceDataPage';
import GroupReportPage from './pages/GroupReportPage';
// DocumentFlowPage removed
import LetterPage from './pages/LetterPage';
import DirectorReportPage from './pages/DirectorReportPage.jsx';
import DeputyDirectorReportPage from './pages/DeputyDirectorReportPage.jsx';
import OfficeHeadReportPage from './pages/OfficeHeadReportPage.jsx';
import DeputyOfficeHeadReportPage from './pages/DeputyOfficeHeadReportPage.jsx';
import SectionHeadReportPage from './pages/SectionHeadReportPage.jsx';
import DeputySectionHeadReportPage from './pages/DeputySectionHeadReportPage.jsx';
import PrincipalReportPage from './pages/PrincipalReportPage.jsx';
import DeputyPrincipalReportPage from './pages/DeputyPrincipalReportPage.jsx';
import InChargeReportPage from './pages/InChargeReportPage.jsx';
import DocumentViewPage from './pages/DocumentViewPage';
import NewDocumentPage from './pages/NewDocumentPage';
import WordPage from './pages/WordPage';
import FileTransferPage from './pages/FileTransfer.jsx';
import FileTransfer1Page from './pages/FileTransfer1.jsx';
import FileTransferStats from './components/FileTransferStats.jsx';
import SendfeedbackPage from './pages/SendfeedbackPage.jsx';
import TelegramTestPage from './pages/TelegramTestPage.jsx';
import ReplayfilePage from './pages/ReplayfilePage.jsx';
import Replayfile2Page from './pages/Replayfile2Page.jsx';
import MissionsPage from './pages/missionsPage.jsx';
import ApprovalsPage from './pages/ApprovalsPage';
import SelfServicePage from './pages/SelfServicePage';
import ShiftGroupsPage from './pages/ShiftGroups';
import SignaturePage from './components/SignaturePage';
import UserProfilePage from './pages/UserProfilePage';
import LinkTelegramPage from './pages/LinkTelegramPage';
import MyHrPage from './pages/MyHrPage.jsx';
// Removed employeeAPI usage
import { AuthProvider, useAuth } from './context/AuthContext';
import usePermission from './hooks/usePermission';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StaffLoginPage from './pages/StaffLoginPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import StaffOnboardingPage from './pages/StaffOnboardingPage';
import StaffRegisterPage from './pages/StaffRegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MobileApp from './pages/MobileApp.jsx';
import MobileAttendanceData from './pages/MobileAttendanceData.jsx';
import MobileScanPage from './pages/MobileScanPage.jsx';
import MobileFaceEnrollPage from './pages/MobileFaceEnrollPage.jsx';
import GeoFencePoliciesPage from './pages/GeoFencePoliciesPage.jsx';

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const { user } = useAuth();
  const loc = useLocation();
  if (!isAuthenticated) {
    const redirect = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  // Pending accounts (no permissions) should only see the pending approval page
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const isPending = perms.length === 0;
  if (isPending) {
    const allow = new Set(['/pending-approval', '/staff-onboarding']);
    allow.add('/employee-register');
    if (!allow.has(loc.pathname)) return <Navigate to="/pending-approval" replace />;
  }
  return children;
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const isPending = perms.length === 0;
  if (isPending) return <Navigate to="/pending-approval" replace />;

  return <Navigate to="/dashboard" replace />;
}

// Helper: wrap a page with the app Layout so Sidebar/header are present
function LayoutWrapper({ section, children }) {
  const handleSectionChange = () => {};
  return (
    <Layout activeSection={section} onSectionChange={handleSectionChange}>
      {children}
    </Layout>
  );
}

// Simple permission gate wrapper for sections
function PermissionGate({ allow, children }) {
  if (!allow) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Permission required</h2>
          <p className="text-gray-600 mt-2">You don't have access to view this page.</p>
        </div>
      </div>
    );
  }
  return children;
}

// Route component for self-service page with permission guard
function SelfServiceRoute() {
  const perms = usePermission();
  return (
    <PermissionGate allow={perms.canViewSelfService}>
      <SelfServicePage />
    </PermissionGate>
  );
}

function StaffRegisterRoute() {
  const perms = usePermission();
  return (
    <PermissionGate allow={perms.canManageUsers}>
      <StaffRegisterPage />
    </PermissionGate>
  );
}

// Small wrapper that uses hooks inside a component to guard WorkCalendarPage
function WorkCalendarRoute() {
  const perms = usePermission();
  return (
    <PermissionGate allow={perms.canViewAttendance}>
      <WorkCalendarPage />
    </PermissionGate>
  );
}

// Small wrapper for WorkSchedulePage
function WorkScheduleRoute() {
  const perms = usePermission();
  return (
    <PermissionGate allow={perms.canViewAttendance}>
      <WorkSchedulePage />
    </PermissionGate>
  );
}

// Small wrapper for shifts route
function ShiftsRoute() {
  const perms = usePermission();
  return (
    // allow either settings viewers or HR viewers to manage/view shifts
    <PermissionGate allow={perms.canViewSettings || perms.canViewHR}>
      <ShiftsPage />
    </PermissionGate>
  );
}

// Wrapper for Shift Groups page
function ShiftGroupsRoute() {
  const perms = usePermission();
  return (
    <PermissionGate allow={perms.canViewAttendance}>
      <ShiftGroupsPage />
    </PermissionGate>
  );
}

function GeoFencePoliciesRoute() {
  const perms = usePermission();
  return (
    <PermissionGate allow={perms.canViewSettings}>
      <GeoFencePoliciesPage />
    </PermissionGate>
  );
}

// Protected shell: everything that should only render AFTER login
function ProtectedApp() {
  const perms = usePermission();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const loc = useLocation();
  // Removed employees-related state

  // Removed employees fetch

  // Removed employees effect

  // Removed employees search effect

  // Removed employees form submit handler

  // Removed employees delete handler

  // Removed employees pagination handler

  const handleSectionChange = (section) => {
    setActiveSection(section);
  };

  // Sync activeSection with URL path so direct links / refresh show the correct section
  useEffect(() => {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const isAdmin = roles.some((r) => (r?.name || r) === 'Admin');
    const isStaffOnly = !isAdmin && roles.length === 1 && (roles[0]?.name || roles[0]) === 'User';

    const path = (loc && loc.pathname) ? loc.pathname.replace(/^\//, '') : '';
    if (!path) {
      setActiveSection(isStaffOnly ? 'my-hr' : 'dashboard');
      return;
    }
    // Use first path segment as section id (e.g. 'study-leave-report' from '/study-leave-report')
    const base = path.split('/')[0];
    setActiveSection(base || 'dashboard');
  }, [loc && loc.pathname, user?.roles]);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'employees':
        return (
          <PermissionGate allow={perms.canViewHR}>
            <HRPage />
          </PermissionGate>
        );
  // Removed employees page
      case 'skills':
        return (
          <PermissionGate allow={perms.canViewSkills}>
            <SkillPage />
          </PermissionGate>
        );
      case 'ministry-skills':
        return (
          <PermissionGate allow={perms.canViewSkills}>
            <MinistrySkillPage />
          </PermissionGate>
        );
      case 'hr':
        return (
          <PermissionGate allow={perms.canViewHR}>
            <HRPage />
          </PermissionGate>
        );
      case 'departments':
        return (
          <PermissionGate allow={perms.canViewDepartments}>
            <DepartmentPage />
          </PermissionGate>
        );
      case 'positions':
        return (
          <PermissionGate allow={perms.canViewPositions}>
            <PositionPage />
          </PermissionGate>
        );
      case 'shifts':
        return (
          // allow HR staff to access shifts listing in addition to settings viewers
          <PermissionGate allow={perms.canViewSettings || perms.canViewHR}>
            <ShiftsPage />
          </PermissionGate>
        );
      case 'approvals':
        return (
          <PermissionGate allow={perms.canApproveHR}>
            <ApprovalsPage />
          </PermissionGate>
        );

      case 'my-hr':
        return (
		  <PermissionGate allow={perms.canViewMyHr || perms.canViewSelfService}>
            <MyHrPage />
		  </PermissionGate>
        );
      
      
      case 'signatures':
        return (
          <PermissionGate allow={perms.canViewSignSchemas || perms.canManageSignSchemas || perms.canEditDocuments}>
            <SignaturePage />
          </PermissionGate>
        );
      case 'howto-docs':
        return (
          <LetterPage />
        );
      case 'new-page':
        return (
          <NewDocumentPage />
        );
      case 'attendance':
        return (
          <PermissionGate allow={perms.canViewAttendance}>
            <AttendancePage />
          </PermissionGate>
        );
      case 'work-calendar':
        return (
          <PermissionGate allow={perms.canViewAttendance}>
            <WorkCalendarPage />
          </PermissionGate>
        );
      case 'work-schedule':
        return (
          <PermissionGate allow={perms.canViewAttendance}>
            <WorkSchedulePage />
          </PermissionGate>
        );
      case 'attendance-report':
        return (
          <PermissionGate allow={perms.canViewAttendance}>
            <AttendanceReportPage />
          </PermissionGate>
        );
      case 'employee-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <EmployeeReportPage />
          </PermissionGate>
        );
      /* 'daily-report' removed: DailyReportsPage component deleted */
      case 'group-report':
        return (
          <PermissionGate allow={perms.canViewAttendance}>
            <GroupReportPage />
          </PermissionGate>
        );
      case 'director-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <DirectorReportPage />
          </PermissionGate>
        );
      case 'deputy-director-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <DeputyDirectorReportPage />
          </PermissionGate>
        );
      case 'office-head-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <OfficeHeadReportPage />
          </PermissionGate>
        );
      case 'deputy-office-head-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <DeputyOfficeHeadReportPage />
          </PermissionGate>
        );
      case 'section-head-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <SectionHeadReportPage />
          </PermissionGate>
        );
      case 'deputy-section-head-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <DeputySectionHeadReportPage />
          </PermissionGate>
        );
      case 'principal-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <PrincipalReportPage />
          </PermissionGate>
        );
      case 'deputy-principal-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <DeputyPrincipalReportPage />
          </PermissionGate>
        );
      case 'incharge-report':
        return (
          <PermissionGate allow={perms.canViewEmployeeReport}>
            <InChargeReportPage />
          </PermissionGate>
        );
      case 'picture-report':
        return (
          <PermissionGate allow={perms.canViewTransformationReport}>
            <TransformationReportPage />
          </PermissionGate>
        );
      case 'retirement-report':
        return (
          <PermissionGate allow={perms.canViewRetirementReport}>
            <RetirementReportPage />
          </PermissionGate>
        );
      case 'promotion-rotation-report':
        return (
          <PermissionGate allow={perms.canViewPromotionByRotationReport}>
            <PromotionByRotationReportPage />
          </PermissionGate>
        );
      case 'promotion-diploma-report':
        return (
          <PermissionGate allow={perms.canViewPromotionByDiplomaReport}>
            <PromotionByDiplomaReportPage />
          </PermissionGate>
        );
      case 'promotion-honor-report':
        return (
          <PermissionGate allow={perms.canViewPromotionByHonorReport}>
            <PromotionByHonorReportPage />
          </PermissionGate>
        );
      case 'unpaid-leave-report':
        return (
          <PermissionGate allow={perms.canViewUnpaidLeaveReport}>
            <UnpaidLeaveReportPage />
          </PermissionGate>
        );
      case 'official-delisted-report':
        return (
          <PermissionGate allow={perms.canViewOfficialDelistedReport}>
            <OfficialDelistedReportPage />
          </PermissionGate>
        );
      case 'attendance-monthly-report':
        return (
          <PermissionGate allow={perms.canViewAttendanceMonthlyReport}>
            <AttendanceMonthlyReportPage />
          </PermissionGate>
        );
      case 'attendance-day-report':
        return (
          <PermissionGate allow={perms.canViewAttendanceMonthlyReport}>
            <AttendancedayReportPage />
          </PermissionGate>
        );
      case 'attendance-monthly-data':
        return (
          <PermissionGate allow={perms.canViewAttendanceMonthlyData}>
            <AttendanceMonthlyDataPage />
          </PermissionGate>
        );
      case 'attendance-day-data':
        return (
          <PermissionGate allow={perms.canViewAttendanceMonthlyData}>
            <AttendanceDayAttendanceDataPage />
          </PermissionGate>
        );
      case 'maternity-leave-report':
        return (
          <PermissionGate allow={perms.canViewMaternityLeaveReport}>
            <MaternityLeaveReportPage />
          </PermissionGate>
        );
      case 'study-leave-report':
        return (
          <PermissionGate allow={perms.canViewStudyLeaveReport}>
            <StudyLeaveReportPage />
          </PermissionGate>
        );
      case 'department-report':
        return (
          <div className="p-6">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900">របាយការណ៍ផ្នែក</h2>
              <p className="text-gray-600 mt-2">មុខងារនេះកំពុងបង្កើត...</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <PermissionGate allow={perms.canViewSettings}>
            <div className="p-6">
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold text-gray-900">កំណត់</h2>
                <p className="text-gray-600 mt-2">មុខងារនេះកំពុងបង្កើត...</p>
              </div>
            </div>
          </PermissionGate>
        );
      case 'users':
        return (
          <PermissionGate allow={perms.canManageUsers}>
            <UsersPage />
          </PermissionGate>
        );
      case 'roles':
        return (
          <PermissionGate allow={perms.canManageRoles || perms.canViewRoles}>
            <RolesPage />
          </PermissionGate>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeSection={activeSection} onSectionChange={handleSectionChange}>
  {/* Removed employees header bar */}

      {renderContent()}

  {/* Removed employees modals */}

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
         <Route path="/" element={<RootRedirect />} />
         <Route path="/mobile" element={<MobileApp />} />
         <Route path="/mobileApp" element={<MobileApp />} />
         <Route path="/mobileApp/attendance" element={<MobileAttendanceData />} />
         <Route path="/mobileApp/scan" element={<MobileScanPage />} />
         <Route path="/mobileApp/face-enroll" element={<MobileFaceEnrollPage />} />
         <Route path="/hr-role-summary" element={<RequireAuth><LayoutWrapper section="hr-role-summary"><HRRoleSummaryPage /></LayoutWrapper></RequireAuth>} />
         <Route path="/hr-skill-summary" element={<RequireAuth><LayoutWrapper section="hr-skill-summary"><HRSkillSummaryPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/signup" element={<RegisterPage />} />
          <Route path="/create-account" element={<RegisterPage />} />
          <Route path="/staff-login" element={<StaffLoginPage />} />
          <Route path="/staff-signup" element={<RegisterPage />} />
          <Route path="/staff-onboarding" element={<RequireAuth><StaffOnboardingPage /></RequireAuth>} />
          <Route path="/employee-register" element={<RequireAuth><StaffOnboardingPage /></RequireAuth>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/self" element={<RequireAuth><SelfServiceRoute /></RequireAuth>} />
          <Route path="/staff-register" element={<RequireAuth><LayoutWrapper section="users"><StaffRegisterRoute /></LayoutWrapper></RequireAuth>} />
          <Route path="/pending-approval" element={<RequireAuth><PendingApprovalPage /></RequireAuth>} />
          {/* Employee edit page removed */}
          {/* Protected app (catch-all moved to end to allow explicit routes to match) */}
          <Route path="/documents/:id" element={<RequireAuth><DocumentViewPage /></RequireAuth>} />
          <Route path="/wordpage/:id" element={<RequireAuth><WordPage /></RequireAuth>} />
          <Route path="/newpage" element={<RequireAuth><NewDocumentPage /></RequireAuth>} />
          <Route path="/work-calendar" element={<RequireAuth><LayoutWrapper section="work-calendar"><WorkCalendarRoute /></LayoutWrapper></RequireAuth>} />
          <Route path="/work-schedule" element={<RequireAuth><LayoutWrapper section="work-schedule"><WorkScheduleRoute /></LayoutWrapper></RequireAuth>} />
          <Route path="/shifts" element={<RequireAuth><LayoutWrapper section="shifts"><ShiftsRoute /></LayoutWrapper></RequireAuth>} />
          <Route path="/shift-groups" element={<RequireAuth><LayoutWrapper section="shift-groups"><ShiftGroupsRoute /></LayoutWrapper></RequireAuth>} />
          <Route path="/geo-fence-policies" element={<RequireAuth><LayoutWrapper section="geo-fence-policies"><GeoFencePoliciesRoute /></LayoutWrapper></RequireAuth>} />
          <Route path="/attendance-daily-report" element={<RequireAuth><LayoutWrapper section="attendance-daily-report"><DailyReportsPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/attendance-monthly-data" element={<RequireAuth><LayoutWrapper section="attendance-monthly-data"><AttendanceMonthlyDataPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/attendance-day-data" element={<RequireAuth><LayoutWrapper section="attendance-day-data"><AttendanceDayAttendanceDataPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/import-attendance" element={<RequireAuth><PermissionGate allow={true}><ImportAttendance /></PermissionGate></RequireAuth>} />
          <Route path="/file-transfer" element={<RequireAuth><LayoutWrapper section="file-transfer"><FileTransferPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/missions" element={<RequireAuth><LayoutWrapper section="missions"><MissionsPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/file-transfer-stats" element={<RequireAuth><LayoutWrapper section="file-transfer-stats"><FileTransferStats /></LayoutWrapper></RequireAuth>} />
          <Route path="/send-feedback" element={<RequireAuth><LayoutWrapper section="send-feedback"><SendfeedbackPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/telegram-test" element={<RequireAuth><LayoutWrapper section="telegram-test"><TelegramTestPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/replay-file" element={<RequireAuth><MinimalLayout><ReplayfilePage /></MinimalLayout></RequireAuth>} />
          <Route path="/replay-file2" element={<RequireAuth><MinimalLayout><Replayfile2Page /></MinimalLayout></RequireAuth>} />
          <Route path="/kshf_hospital_app/filetransfers1" element={<RequireAuth><LayoutWrapper section="file-transfer"><FileTransfer1Page /></LayoutWrapper></RequireAuth>} />
          <Route path="/daily-attendance-report" element={<RequireAuth><DailyAttendanceReport /></RequireAuth>} />
          <Route path="/employee-report" element={<RequireAuth><LayoutWrapper section="employee-report"><EmployeeReportPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/employee-grants-report" element={<RequireAuth><LayoutWrapper section="employee-report"><EmployeeReport /></LayoutWrapper></RequireAuth>} />
          <Route path="/retirement-report" element={<RequireAuth><LayoutWrapper section="retirement-report"><RetirementReportPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/official-delisted-report" element={<RequireAuth><LayoutWrapper section="official-delisted-report"><OfficialDelistedReportPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/department-report" element={<RequireAuth><LayoutWrapper section="department-report"><div className="p-6"><div className="text-center py-12"><h2 className="text-xl font-semibold text-gray-900">របាយការណ៍ផ្នែក</h2><p className="text-gray-600 mt-2">មុខងារនេះកំពុងបង្កើត...</p></div></div></LayoutWrapper></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><LayoutWrapper section="profile"><UserProfilePage /></LayoutWrapper></RequireAuth>} />
          <Route path="/link-telegram" element={<RequireAuth><LayoutWrapper section="link-telegram"><LinkTelegramPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/department-units" element={<RequireAuth><LayoutWrapper section="department-units"><DepartmentUnits /></LayoutWrapper></RequireAuth>} />
          <Route path="/hr" element={<RequireAuth><LayoutWrapper section="hr"><HRPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/hr-display" element={<RequireAuth><LayoutWrapper section="hr"><HrDisplayPage /></LayoutWrapper></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><ProtectedApp /></RequireAuth>} />
          {/* catch-all protected app: placed last so explicit client routes above are matched on refresh */}
          <Route
            path="/*"
            element={
              <RequireAuth>
                <ProtectedApp />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
