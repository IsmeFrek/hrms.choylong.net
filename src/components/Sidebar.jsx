import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  User,
  UserPlus,
  BarChart3,
  Settings,
  Home,
  Calendar,
  FileText,
  Award,
  Clock,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  CalendarCheck,
  ClipboardList,
  ShieldCheck,
  FileSpreadsheet,
  UserCog,
  CheckCircle2,
  FileSearch,
  LayoutList,
  SearchCheck,
  TrendingUp,
  Shield,
  FileSignature,
  CloudDownload,
  Activity,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import usePermission from '../hooks/usePermission';

export default function Sidebar({ activeSection, onSectionChange, isCollapsed = false, onToggle, asHeader = false }) {
  const { user, logout } = useAuth();
  const perms = usePermission() || {};
  const navigate = useNavigate();
  const [activeUsers, setActiveUsers] = useState([]);
  const [showUsersList, setShowUsersList] = useState(false);

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.id = 'sidebar-gradient-animation';
    styleTag.innerHTML = `
      @keyframes gradientMove {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .active-gradient {
        background: linear-gradient(270deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899);
        background-size: 300% 300%;
        animation: gradientMove 6s ease infinite;
      }
    `;
    document.head.appendChild(styleTag);
    return () => {
      const tag = document.getElementById('sidebar-gradient-animation');
      if (tag) tag.remove();
    };
  }, []);

  const formatTimeAgo = (ts) => {
    if (!ts) return '';
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5) return 'ឥឡូវនេះ';
    if (sec < 60) return `${sec} វិនាទីមុន`;
    return '១ នាទីមុន';
  };

  const getPageName = (path) => {
    if (!path) return '';
    const p = path.toLowerCase();
    if (p === '/' || p.includes('dashboard')) return 'ទំព័រដើម';
    if (p.includes('official-delisted-report')) return 'មន្ត្រីឈប់ពីការងារ';
    if (p.includes('attendance-sum-dayreport')) return 'វត្តមានថវិកា';
    if (p.includes('hr')) return 'បញ្ជីបុគ្គលិក';
    if (p.includes('attendance')) return 'វត្តមាន';
    if (p.includes('leave')) return 'ច្បាប់ឈប់សម្រាក';
    if (p.includes('profile')) return 'ប្រវត្តិរូប';
    return path.split('/').pop() || 'កំពុងមើល';
  };

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/active-users', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Page-Path': window.location.pathname
          }
        });
        const data = await res.json();
        if (data && Array.isArray(data.users)) {
          setActiveUsers(data.users);
        }
      } catch (e) { /* ignore */ }
    };
    fetchActive();
    const timer = setInterval(fetchActive, 30000);
    return () => clearInterval(timer);
  }, []);

  // Legacy pages live on the backend Express server (public/*.html).
  // In Vite dev, the frontend runs on :5173, so we infer backend :5000 unless overridden.
  const legacyBase = (() => {
    try {
      const override = import.meta?.env?.VITE_LEGACY_BASE;
      if (override) return String(override).replace(/\/+$/, '');
      if (import.meta?.env?.DEV && window?.location?.port === '5173') {
        return `${window.location.protocol}//${window.location.hostname}:5000`;
      }
    } catch {
      // ignore
    }
    return '';
  })();
  const legacyHref = (path) => (legacyBase ? `${legacyBase}${path}` : path);

  const canViewDeptUnits = perms.canViewDepartmentUnits || perms.canViewDepartments;
  const canViewSetup = perms.canViewHR || perms.canViewDepartments || perms.canViewSkills || perms.canViewPositions || perms.canViewSettings;

  const parentMenuOf = (section) => {
    const map = {
      employees: 'setup', 'add-employee': 'setup', skills: 'setup', 'ministry-skills': 'setup', hr: 'setup',
      departments: 'setup', positions: 'setup',
      documents: 'documents', signatures: 'documents', 'howto-docs': 'documents', 'file-transfer': 'documents', 'file-transfer-outgoing': 'documents', 'file-transfer-stats': 'documents',
      'attendance-scan': 'attendance-scan', 'attendance-scan-qr': 'attendance-scan', 'attendance-scan-face': 'attendance-scan', 'attendance-scan-face-group': 'attendance-scan', 'attendance-face-enroll': 'attendance-scan', 'geo-fence-policies': 'attendance-scan',
      attendance: 'attendance', 'attendance-report': 'attendance', 'attendance-ministry-report': 'attendance',
      'work-schedule': 'calendar-group', 'work-schedule1': 'calendar-group', shifts: 'calendar-group', 'shift-groups': 'calendar-group',
      'employee-report': 'reports', 'department-report': 'reports', 'retirement-report': 'reports',
      'employee-id-docs': 'documents',
      'employee-other-docs': 'documents'
    };
    return map[section] || null;
  };

  const deriveExpanded = useCallback((section, isAdminUser) => {
    const p = parentMenuOf(section);
    const base = p ? [p] : [];
    return isAdminUser ? base : base.filter(id => id !== 'admin');
  }, []);

  const isAdmin = perms.isAdmin;
  const [expandedMenus, setExpandedMenus] = useState(() => deriveExpanded(activeSection, isAdmin));

  useEffect(() => {
    const auto = deriveExpanded(activeSection, isAdmin);
    setExpandedMenus(prev => Array.from(new Set([...prev, ...auto])));
  }, [activeSection, isAdmin, deriveExpanded]);

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]);
  };

  const hasDashboardPerm = perms?.isAdmin || perms?.has?.('view:dashboard');

  const menuItems = [
    ...(hasDashboardPerm ? [{ id: 'dashboard', label: 'ទំព័រដើម', icon: Home, path: 'dashboard', route: '/' }] : []),
    ...(perms.canViewStaffBiography ? [{ id: 'staff-biography', label: 'ប្រវត្តរូបបុគ្គលិក', icon: FileText, path: 'staff-biography', route: '/staff-biography' }] : []),

    // Root level items as per image
    ...(canViewDeptUnits ? [{ id: 'department-units', label: 'អង្គភាព', icon: BarChart3, path: 'department-units', route: '/department-units' }] : []),
    ...(perms.canViewMyHr ? [{ id: 'my-hr', label: 'ព័ត៌មានខ្លួនឯង', icon: User, path: 'my-hr', route: '/my-hr' }] : []),
    ...(perms.canViewSelfService ? [{ id: 'self-service', label: 'សេវា', icon: Users, route: '/self' }] : []),
    { id: 'meeting-rooms', label: 'បន្ទប់ប្រជុំ', icon: ClipboardList, path: 'meeting-rooms', route: '/meeting-rooms' },
    { id: 'meeting-rooms-v2', label: 'បន្ទប់ប្រជុំ V2', icon: ClipboardList, path: 'meeting-rooms-v2', route: '/meeting-rooms-v2' },

    // Group 2: Setup (កំណត់)
    ...(canViewSetup ? [{
      id: 'setup',
      label: 'កំណត់',
      icon: Settings,
      hasSubmenu: true,
      submenu: [
        { id: 'hr', label: 'បញ្ជីបុគ្គលិក', icon: Users, path: 'hr' },
        ...(perms.canViewDepartments ? [{ id: 'departments', label: 'ផ្នែក', icon: BarChart3, path: 'departments' }] : []),
        ...(perms.canViewSkills ? [{ id: 'skills', label: 'ជំនាញ', icon: Award, path: 'skills' }] : []),
        ...(perms.canViewSkills ? [{ id: 'ministry-skills', label: 'ជំនាញក្រសួង', icon: Award, path: 'ministry-skills' }] : []),
        ...(perms.canViewPositions ? [{ id: 'positions', label: 'តួនាទី', icon: UserPlus, path: 'positions' }] : []),
        ...(perms.isAdmin ? [{ id: 'system-settings', label: 'កំណត់ប្រព័ន្ធ', icon: Settings, path: 'system-settings' }] : [])
      ]
    }] : []),

    // Group 3: Documents (ឯកសារ)
    ...(perms.canViewDocuments || perms.canViewFiles ? [{
      id: 'documents',
      label: 'ឯកសារ',
      icon: FileText,
      hasSubmenu: true,
      submenu: [
        ...((perms.canViewSignSchemas || perms.canManageSignSchemas || perms.canEditDocuments) ? [{ id: 'signatures', label: 'គ្រប់គ្រងហត្ថលេខា', icon: FileText, path: 'signatures' }] : []),
        ...(perms.canViewDocuments ? [{ id: 'howto-docs', label: 'ឯកសាររបៀប', icon: FileText, path: 'howto-docs' }] : []),
        ...(perms.canViewMissions ? [{ id: 'missions', label: 'លិខិតបញ្ជាបេសកកម្ម', icon: FileText, route: '/missions', path: 'missions' }] : []),
        ...((perms.canViewFileTransfers || perms.canViewFiles) ? [{ id: 'file-transfer', label: 'ផ្ទេរឯកសារ', icon: FileText, route: '/file-transfer', path: 'file-transfer' }] : []),
        ...(perms.canViewFileTransfersOutgoing ? [{ id: 'file-transfer-outgoing', label: 'ឯកសារចេញ', icon: FileText, route: '/file-transfer-outgoing', path: 'file-transfer-outgoing' }] : []),
        ...((perms.canViewFileTransfers || perms.canViewFiles) ? [{ id: 'file-transfer-stats', label: 'ស្ថិតិឯកសារ', icon: BarChart3, route: '/file-transfer-stats', path: 'file-transfer-stats' }] : []),
        ...(perms.canViewEmployeeIDDocs ? [{ id: 'employee-id-docs', label: 'អត្តសញ្ញាណប័ណ្ណ', icon: CreditCard, path: 'employee-id-docs' }] : []),
        ...(perms.canViewEmployeeIDDocs ? [{ id: 'employee-other-docs', label: 'ឯកសារផ្សេងៗ', icon: FileText, path: 'employee-other-docs' }] : [])
      ]
    }] : []),

    // Group 3.5: Instruction Letters (លិខិតបង្គាប់ការ)
    ...(perms.canViewMaternityLeaveReport || perms.canViewResignationLetter || perms.canViewOnboardingLetter || perms.canViewAppointmentLetter || perms.canViewTerminationLetter || perms.canViewOtherLetters ? [{
      id: 'instruction-letters-group',
      label: 'លិខិតបង្គាប់ការ',
      icon: FileText,
      hasSubmenu: true,
      submenu: [
        ...(perms.canViewMaternityLeaveReport ? [{ id: 'il-maternity', label: 'មាតុភាព', icon: FileText, route: '/maternity-leave-report', path: 'maternity-leave-report' }] : []),
        ...(perms.canViewResignationLetter ? [{ id: 'il-resignation', label: 'ឈប់ពីការងារ', icon: FileText, route: '/instruction-letters?template=resignation', path: 'instruction-letters' }] : []),
        ...(perms.canViewOnboardingLetter ? [{ id: 'il-onboarding', label: 'ចូលបុគ្គលិកថ្មី', icon: FileText, route: '/instruction-letters?template=onboarding', path: 'instruction-letters' }] : []),
        ...(perms.canViewAppointmentLetter ? [{ id: 'il-appointment', label: 'តែងតាំង', icon: FileText, route: '/instruction-letters?template=appointment', path: 'instruction-letters' }] : []),
        ...(perms.canViewTerminationLetter ? [{ id: 'il-termination', label: 'បញ្ចប់មុខតំណែង', icon: FileText, route: '/instruction-letters?template=termination', path: 'instruction-letters' }] : []),
        ...(perms.canViewOtherLetters ? [{ id: 'il-others', label: 'ផ្សេងៗ', icon: FileText, route: '/instruction-letters?template=others', path: 'instruction-letters' }] : []),
      ]
    }] : []),

    // Group 4: Scanning (ស្កេនវត្តមាន)
    ...(perms.canScanQR || perms.canScanFace || perms.canScanFaceGroup ? [{
      id: 'attendance-scan',
      label: 'ស្កេនវត្តមាន',
      icon: Clock,
      hasSubmenu: true,
      submenu: [
        ...(perms.canScanQR ? [{ id: 'attendance-scan-qr', label: 'ស្កេន QR/Barcode', icon: Clock, route: '/mobileApp/attendance' }] : []),
        ...(perms.canScanFace ? [{ id: 'attendance-scan-face', label: 'ស្កេនមុខ', icon: User, legacyUrl: legacyHref('/face_scan.html') }] : []),
        ...(perms.canScanFaceGroup ? [{ id: 'attendance-scan-face-group', label: 'ស្កេនមុខជាក្រុម', icon: Users, legacyUrl: legacyHref('/face_scan_group.html') }] : []),
        ...(perms.canFaceEnroll ? [{ id: 'attendance-face-enroll', label: 'ចុះឈ្មោះមុខ', icon: UserPlus, legacyUrl: legacyHref('/face_enroll.html') }] : []),
        { id: 'attendance-legacy', label: 'បង្កើតវត្តមាន (ផេក)', icon: Clock, legacyUrl: legacyHref('/attendance.html') },
        { id: 'telegram-mini-app', label: '📱 Telegram Mini App', icon: Clock, route: '/telegram-mini-app' },
        ...(perms.canViewSettings ? [{ id: 'geo-fence-policies', label: 'កំណត់ទីតាំងស្កេន', icon: Clock, route: '/geo-fence-policies', path: 'geo-fence-policies' }] : [])
      ]
    }] : []),

    // Group 5: Attendance Documents (វត្តមាន)
    ...(perms.canViewAbsence || perms.canViewAttendanceReport || perms.canViewAttendanceMonthly || perms.canViewAttendanceDaily || perms.canViewAttendanceSumDayReport || perms.canViewAttendanceMonthlyData || perms.canViewAttendanceMonthlyReport || perms.canViewAttendanceDayData || perms.canViewAttendanceMonthlyDataFile || perms.canViewAttendanceAudit || perms.canViewAttendanceMinistry || perms.canViewDailyReportCheckinme || perms.canViewEmployeeEvaluation ? [{
      id: 'attendance',
      label: 'វត្តមាន',
      icon: CalendarCheck,
      hasSubmenu: true,
      submenu: [
        ...(perms.canViewAbsence ? [{ id: 'attendance-list', label: 'វត្តមាន', icon: LayoutList, path: 'attendance' }] : []),
        ...(perms.canViewAttendanceReport ? [{ id: 'attendance-report', label: 'របាយការណ៍វត្តមាន', icon: FileSpreadsheet, path: 'attendance-report' }] : []),
        ...(perms.canViewAttendanceDaily ? [{ id: 'attendance-day-report', label: 'វត្តមានប្រចាំថ្ងៃ', icon: FileSpreadsheet, path: 'attendance-day-report' }] : []),
        ...(perms.canViewAttendanceMonthly ? [{ id: 'attendance-monthly-report', label: 'វត្តមានប្រចាំខែ', icon: FileSpreadsheet, path: 'attendance-monthly-report' }] : []),
        ...(perms.canViewAttendanceSumDayReport ? [{ id: 'attendance-sum-dayreport', label: 'វត្តមានថវិកា', icon: BarChart3, path: 'attendance-sum-dayreport' }] : []),
        ...(perms.canViewAttendanceMonthlyData ? [{ id: 'attendance-sum-day', label: 'សរុបវត្តមានចន្លោះថ្ងៃ', icon: BarChart3, path: 'attendance-sum-day' }] : []),
        ...(perms.canViewAttendanceMonthlyReport ? [
          { id: 'attendance-ministry-report', label: 'រ_វត្តមានក្រសួង', icon: FileSearch, path: 'attendance-ministry-report' }
        ] : []),
        ...(perms.canViewAttendanceDayData ? [
          { id: 'attendance-day-data', label: 'ទិន្នន័យវត្តមានថ្ងៃ', icon: FileSpreadsheet, path: 'attendance-day-data' }
        ] : []),
        ...(perms.canViewAttendanceMonthlyDataFile ? [
          { id: 'attendance-monthly-data', label: 'ទិន្នន័យវត្តមានខែ', icon: FileSpreadsheet, path: 'attendance-monthly-data' }
        ] : []),
        ...(perms.canViewAttendanceAudit ? [
          { id: 'attendance-audit', label: 'វត្តមានអូឌិត', icon: SearchCheck, path: 'attendance-audit' }
        ] : []),
        ...(perms.canViewAttendanceMinistry ? [
          { id: 'attendance-ministry', label: 'វត្តមានក្រសួង', icon: TrendingUp, path: 'attendance-ministry' }
        ] : []),
        ...(perms.canViewDailyReportCheckinme ? [
          { id: 'attendance-daily-report', label: 'Daily Report Checkinme', icon: CloudDownload, route: '/attendance-daily-report' }
        ] : []),
        ...(perms.canViewEmployeeEvaluation ? [{ id: 'employee-evaluation-report', label: 'វាយតំលៃបុគ្គលិក', icon: FileText, route: '/evaluation' }] : [])
      ]
    }] : []),
    ...(perms.canViewLeaveRequests ? [{ id: 'leave-requests', label: 'ច្បាប់', icon: ClipboardList, path: 'leave-requests' }] : []),

    // Group 5: Calendar (ប្រតិទិន)
    ...((perms.canViewWorkSchedule || perms.canViewShifts || perms.canViewShiftGroups || perms.canViewGroupTimetables) ? [{
      id: 'calendar-group',
      label: 'ប្រតិទិន',
      icon: Calendar,
      hasSubmenu: true,
      submenu: [
        ...(perms.canViewWorkSchedule ? [{ id: 'work-schedule', label: 'ប្រតិទិនការងារ', icon: Calendar, route: '/work-schedule', path: 'work-schedule' }] : []),
        ...(perms.canViewWorkSchedule ? [{ id: 'work-schedule1', label: 'ប្រតិទិនការងារ 1', icon: Calendar, route: '/work-schedule1', path: 'work-schedule1' }] : []),
        ...(perms.canViewShifts ? [{ id: 'shifts-att', label: 'Shifts', icon: Calendar, route: '/shifts', path: 'shifts' }] : []),
        ...(perms.canViewShiftGroups ? [{ id: 'shift-groups', label: 'Shift Groups', icon: Calendar, route: '/shift-groups', path: 'shift-groups' }] : []),
        ...(perms.canViewGroupTimetables ? [{ id: 'group-timetables', label: 'គ្រប់គ្រងម៉ោងក្រុម', icon: Clock, route: '/group-timetables', path: 'group-timetables' }] : [])
      ]
    }] : []),

    // Group 6: Reports (របាយការណ៍)
    ...(perms.canViewEmployeeReport || perms.canViewAttendance || perms.canViewRetirementReport ?
      [{
        id: 'reports', label: 'របាយការណ៍', icon: FileText, hasSubmenu: true, submenu: [
          ...(perms.canViewEmployeeReport ? [{ id: 'employee-report', label: 'បុគ្គលិក', icon: FileText, path: 'employee-report' }] : []),
          ...(perms.canViewDailyReport ? [{ id: 'daily-report', label: 'ប្រចាំថ្ងៃ', icon: FileText, path: 'daily-report' }] : []),
          ...(perms.canViewGroupReport ? [{ id: 'group-report', label: 'ក្រុម', icon: FileText, path: 'group-report' }] : []),
          ...(perms.canViewOfficeHeadReport ? [{ id: 'office-head-report', label: 'ម្ចាស់ការិយាល័យ', icon: FileText, path: 'office-head-report' }] : []),
          ...(perms.canViewSectionHeadReport ? [{ id: 'section-head-report', label: 'ប្រធានផ្នែក', icon: FileText, path: 'section-head-report' }] : []),
          ...(perms.canViewRetirementReport ? [{ id: 'retirement-report', label: 'ចូលនិវត្តន៍', icon: FileText, path: 'retirement-report' }] : []),
          ...(perms.canViewUnpaidLeaveReport ? [{ id: 'unpaid-leave-report', label: 'ទំនេរគ្មានបៀវត្ស', icon: FileText, path: 'unpaid-leave-report' }] : []),
          ...(perms.canViewOutOfCadreLeaveReport || perms.canViewEmployeeReport ? [{ id: 'out-of-cadre-report', label: 'ក្រៅក្របខណ្ឌដើម', icon: FileText, path: 'out-of-cadre-report' }] : []),
          ...(perms.canViewOfficialDelistedReport ? [{ id: 'official-delisted-report', label: 'មន្ត្រីឈប់ពីការងារ', icon: FileText, path: 'official-delisted-report' }] : []),
          ...(perms.canViewStudyLeaveReport ? [{ id: 'study-leave-report', label: 'មន្ត្រីទៅសិក្សា', icon: FileText, path: 'study-leave-report' }] : []),
          ...(perms.canViewDepartmentReport ? [{ id: 'department-report', label: 'ផ្នែក', icon: FileText, path: 'department-report' }] : []),
          ...(perms.canViewHRRoleSummary ? [{ id: 'hr-role-summary', label: 'សង្ខេបតួនាទី HR', icon: FileText, route: '/hr-role-summary' }] : []),
          ...(perms.canViewHRSkillSummary ? [{ id: 'hr-skill-summary', label: 'សង្ខេបជំនាញ HR', icon: FileText, route: '/hr-skill-summary' }] : []),
          ...(perms.canViewHRDisplay ? [{ id: 'hr-display', label: 'បង្ហាញ HR', icon: Users, route: '/hr-display' }] : []),
          ...(perms.isAdmin ? [{ id: 'activity-report', label: 'របាយការណ៍សកម្មភាព', icon: Activity, path: 'activity-report' }] : [])
        ]
      }] : []),

    // Group 6: Salary Promotion (កាំប្រាក់)
    ...(perms.canViewKamprak || perms.canViewPromotionByRotationReport || perms.canViewPromotionByDiplomaReport || perms.canViewPromotionByHonorReport ? [{
      id: 'kamprak-root',
      label: 'កាំប្រាក់',
      icon: Award,
      hasSubmenu: true,
      submenu: [
        ...(perms.canViewKamprak ? [{ id: 'kamprak-page', label: 'គ្រប់គ្រងកាំប្រាក់', icon: Settings, route: '/kamprak' }] : []),
        ...(perms.canViewTransformationReport ? [{ id: 'picture-report-k', label: 'របាយការណ៍ប្តូរទម្រង់', icon: FileText, path: 'picture-report' }] : []),
        ...(perms.canViewPromotionByRotationReport ? [{ id: 'promotion-rotation-report', label: 'របាយការណ៍ប្តូរវេន', icon: FileText, path: 'promotion-rotation-report' }] : []),
        ...(perms.canViewPromotionByDiplomaReport ? [{ id: 'promotion-diploma-report', label: 'របាយការណ៍សញ្ញាបត្រ', icon: FileText, path: 'promotion-diploma-report' }] : []),
        ...(perms.canViewPromotionByHonorReport ? [{ id: 'promotion-honor-report', label: 'របាយការណ៍គ្រឿងឥស្សរិយយស', icon: FileText, path: 'promotion-honor-report' }] : [])
      ]
    }] : []),

    // Group 6: Users & Roles (អ្នកប្រើ/តួនាទី)
    ...(perms.canManageUsers || perms.canManageRoles || perms.canViewRoles ? [{
      id: 'user-role-mgmt',
      label: 'អ្នកប្រើ/តួនាទី',
      icon: UserCog,
      hasSubmenu: true,
      submenu: [
        { id: 'manage-users', label: 'គ្រប់គ្រងអ្នកប្រើ', icon: User, path: 'users' },
        { id: 'manage-roles', label: 'គ្រប់គ្រងតួនាទី', icon: ShieldCheck, path: 'roles' }
      ]
    }] : []),

    // Root level Settings

    // Onboarding approvals root
    ...(perms.canApproveHR ? [{ id: 'onboarding-approvals-root', label: 'បញ្ជីបុគ្គលិកចុះឈ្មោះ', icon: UserPlus, route: '/approvals?targetType=user&source=staff_onboarding&status=pending' }] : []),

    // Finally Approvals
    { id: 'approvals', label: 'សំណើអនុម័ត', icon: Clock, path: 'approvals', hidden: !perms.canApproveHR }
  ];

  const renderMenuItem = (item) => {
    const Icon = item.icon;
    const isExpanded = expandedMenus.includes(item.id);
    const isActive = activeSection === item.path;
    const showLabels = !isCollapsed; // hide labels when collapsed (icons-only)

    if (item.hidden) return null;

    if (item.hasSubmenu) {
      return (
        <div key={item.id} className="mb-1">
          <button onClick={() => toggleMenu(item.id)} className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg transition-colors hover:bg-blue-50 text-gray-700 hover:text-blue-600`}>
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 flex-shrink-0" />
              {showLabels && <span className="font-medium truncate whitespace-nowrap overflow-hidden">{item.label}</span>}
            </div>
            {showLabels && (
              <div className="flex-shrink-0">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
            )}
          </button>
          {isExpanded && (
            <div className="ml-6 mt-1 space-y-1">
              {item.submenu.map(subItem => {
                const isSubActive = activeSection === subItem.path;
                return (
                  <button key={subItem.id} onClick={() => {
                    if (subItem.route) { navigate(subItem.route); return; }
                    if (subItem.legacyUrl) { window.location.href = subItem.legacyUrl; return; }
                    if (subItem.path) {
                      if (subItem.path.startsWith('/')) navigate(subItem.path);
                      else navigate(`/${subItem.path}`);
                      if (onSectionChange) onSectionChange(subItem.path);
                      return;
                    }
                    if (onSectionChange) onSectionChange(subItem.path);
                  }} className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${isSubActive ? 'active-gradient text-white font-medium border-l-[3px] border-white rounded-l-none' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                    {subItem.icon && <subItem.icon className="w-4 h-4 flex-shrink-0" />}
                    <span className="text-sm truncate whitespace-nowrap overflow-hidden">{subItem.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <button key={item.id} onClick={() => {
        if (item.route) { navigate(item.route); return; }
        if (item.path) {
          if (item.path.startsWith('/')) navigate(item.path);
          else navigate(`/${item.path}`);
          if (onSectionChange) onSectionChange(item.path);
          return;
        }
        if (onSectionChange) onSectionChange(item.path);
      }} className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors mb-1 ${isActive ? 'active-gradient text-white font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        {showLabels && <span className="font-medium truncate whitespace-nowrap overflow-hidden">{item.label}</span>}
      </button>
    );
  };

  if (asHeader) {
    return (
      <div className="w-full bg-blue-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onToggle} aria-label="Toggle sidebar" className="p-1 rounded-md bg-white/20 hover:bg-white/30 text-blue-600">
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-white" /></div>
          <div className="hidden sm:block"><h1 className="font-bold text-gray-900">HRMS</h1><p className="text-xs text-gray-500">ប្រព័ន្ធគ្រប់គ្រងបុគ្គលិក</p></div>
        </div>

        {/* Active Users Badge */}
        <div className="relative group">
          <div
            onClick={() => setShowUsersList(!showUsersList)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-green-200 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer select-none active:scale-95"
          >
            <div className="relative flex h-2 w-2">
              <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></div>
              <div className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></div>
            </div>
            <span className="text-[11px] font-bold text-green-700 tracking-wide uppercase">
              <span className="hidden xs:inline">អ្នកកំពុងប្រើប្រាស់: </span>
              {activeUsers.length || 1} នាក់
            </span>
          </div>

          {showUsersList && activeUsers.length > 0 && (
            <>
              {/* Click-away overlay */}
              <div className="fixed inset-0 z-40" onClick={() => setShowUsersList(false)} />

              <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="text-[10px] font-bold text-gray-400 mb-2 px-2 py-1 uppercase tracking-wider border-b border-gray-50">
                  អ្នកកំពុងប្រើប្រាស់ ({activeUsers.length})
                </div>
                <div className="max-h-56 overflow-y-auto custom-scrollbar">
                  {activeUsers.map(u => (
                    <div key={u.id} className="flex flex-col py-2 px-2 hover:bg-blue-50 rounded-lg transition-colors group/item border-b border-gray-50 last:border-0">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-2 h-2 bg-green-500 rounded-full group-hover/item:scale-125 transition-transform flex-shrink-0"></div>
                          <div className="text-sm font-bold text-gray-700 truncate">{u.name}</div>
                        </div>
                        <div className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                          {formatTimeAgo(u.lastSeen)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 ml-4">
                        <Activity className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] text-blue-500 font-medium truncate">
                          កំពុងមើល: {getPageName(u.page)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {activeUsers.length === 0 && (
                    <div className="py-4 text-center text-xs text-gray-400">គ្មានអ្នកប្រើប្រាស់ផ្សេងទៀត</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-sm font-medium text-blue-600">{(user?.fullName || user?.email || 'User').substring(0, 2).toUpperCase()}</span></div>
            <div className="min-w-0"><div className="text-sm font-medium text-gray-900">{user?.fullName || '—'}</div><div className="text-xs text-gray-500 truncate">{user?.email || ''}</div></div>
          </div>
          <div className="flex gap-2"><button onClick={() => navigate('/profile')} className="text-xs px-2 py-1 border rounded text-gray-700 hover:bg-gray-100">Profile</button><button onClick={logout} className="text-xs px-2 py-1 border rounded text-gray-700 hover:bg-gray-100">Logout</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isCollapsed ? 'w-18' : 'w-56'} flex flex-col min-h-full pb-12 border-r border-gray-300 bg-blue-50`}>
      {/* spacer/header area removed to avoid duplicate logo when header is shown separately */}
      {isCollapsed ? (
        <nav className="flex-1 p-2 overflow-auto flex flex-col items-center gap-1">
          {menuItems.map(item => {
            if (item.hidden) return null;
            const Icon = item.icon;
            return (
              <div key={item.id} className="w-full flex justify-center">
                <Tippy content={item.label} placement="right" delay={[100, 0]} aria={{ content: 'describedby' }}>
                  <button
                    onClick={() => { if (item.route) return navigate(item.route); if (item.path && item.path.startsWith('/')) return navigate(item.path); return onSectionChange && onSectionChange(item.path); }}
                    className="w-10 h-10 flex items-center justify-center rounded-md text-gray-700 hover:bg-blue-50 focus:outline-none"
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                </Tippy>
              </div>
            );
          })}
        </nav>
      ) : (
        <nav className="flex-1 p-4 overflow-auto"><div className="space-y-1">{menuItems.map(renderMenuItem)}</div></nav>
      )}
    </div>
  );
}