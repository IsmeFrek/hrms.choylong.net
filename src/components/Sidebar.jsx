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
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import usePermission from '../hooks/usePermission';

export default function Sidebar({ activeSection, onSectionChange, isCollapsed = false, onToggle, asHeader = false }) {
  const { user, logout } = useAuth();
  const perms = usePermission() || {};
  const navigate = useNavigate();

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
      documents: 'documents', signatures: 'documents', 'howto-docs': 'documents',
      attendance: 'attendance', 'attendance-report': 'attendance',
      'employee-report': 'reports', 'department-report': 'reports', 'retirement-report': 'reports'
    };
    return map[section] || null;
  };

  const deriveExpanded = useCallback((section, isAdminUser) => {
    const p = parentMenuOf(section);
    const base = p ? [p] : [];
    return isAdminUser ? base : base.filter(id => id !== 'admin');
  }, []);

  const isAdmin = (user?.roles || []).some(r => (r?.name || r) === 'Admin');
  const isStaffOnly = !isAdmin && Array.isArray(user?.roles) && user.roles.length === 1 && (user.roles[0]?.name || user.roles[0]) === 'User';
  const [expandedMenus, setExpandedMenus] = useState(() => deriveExpanded(activeSection, isAdmin));

  useEffect(() => {
    const auto = deriveExpanded(activeSection, isAdmin);
    setExpandedMenus(prev => Array.from(new Set([...prev, ...auto])));
  }, [activeSection, isAdmin, deriveExpanded]);

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]);
  };

  const staffMenuItems = [
    ...((perms.canViewMyHr || perms.canViewSelfService) ? [{ id: 'my-hr', label: 'ព័ត៌មានខ្លួនឯង', icon: User, path: 'my-hr', route: '/my-hr' }] : []),
    ...(perms.canViewSelfService ? [{ id: 'self-service', label: 'សេវា', icon: Users, route: '/self' }] : []),
    ...(perms.canViewAttendance ? [{
      id: 'attendance',
      label: 'វត្តមាន',
      icon: Clock,
      hasSubmenu: true,
      submenu: [
        { id: 'attendance-list', label: 'បញ្ជីវត្តមាន', icon: Calendar, path: 'attendance' },
        { id: 'attendance-scan-qr', label: 'ស្កេន QR/Barcode', icon: Clock, route: '/mobileApp/attendance' },
        ...(perms.canFaceMatch ? [{ id: 'attendance-scan-face', label: 'ស្កេនមុខ', icon: User, legacyUrl: legacyHref('/face_scan.html') }] : []),
        ...(perms.canFaceEnroll ? [{ id: 'attendance-face-enroll', label: 'ចុះឈ្មោះមុខ', icon: UserPlus, legacyUrl: legacyHref('/face_enroll.html') }] : []),
      ]
    }] : []),
  ];

  const menuItems = isStaffOnly ? staffMenuItems : [
    { id: 'dashboard', label: 'ទំព័រដើម', icon: Home, path: 'dashboard', route: '/' },
    ...(canViewDeptUnits ? [{ id: 'department-units', label: 'អង្គភាព', icon: BarChart3, path: 'department-units', route: '/department-units' }] : []),
    ...(((perms.canViewMyHr || perms.canViewSelfService)) ? [{ id: 'my-hr', label: 'ព័ត៌មានខ្លួនឯង', icon: User, path: 'my-hr', route: '/my-hr' }] : []),
    ...(perms.canViewSelfService ? [{ id: 'self-service', label: 'សេវា', icon: Users, route: '/self' }] : []),
    ...(canViewSetup ? [{ id: 'setup', label: 'កំណត់', icon: Settings, hasSubmenu: true, submenu: [
      { id: 'hr', label: 'បញ្ជីបុគ្គលិក', icon: Users, path: 'hr' },
      ...(perms.canViewDepartments ? [{ id: 'departments', label: 'ផ្នែក', icon: BarChart3, path: 'departments' }] : []),
      ...(perms.canViewSkills ? [{ id: 'skills', label: 'ជំនាញ', icon: Award, path: 'skills' }] : []),
      ...(perms.canViewSkills ? [{ id: 'ministry-skills', label: 'ជំនាញក្រសួង', icon: Award, path: 'ministry-skills' }] : []),
      ...(perms.canViewPositions ? [{ id: 'positions', label: 'តួនាទី', icon: UserPlus, path: 'positions' }] : []),
      ...(perms.canViewSettings ? [{ id: 'geo-fence-policies', label: 'Geo-fence', icon: Clock, route: '/geo-fence-policies', path: 'geo-fence-policies' }] : []),
    ] }] : []),
    ...(perms.canViewDocuments || perms.canViewFiles ? [{ id: 'documents', label: 'ឯកសារ', icon: FileText, hasSubmenu: true, submenu: [
      ...((perms.canViewSignSchemas || perms.canManageSignSchemas || perms.canEditDocuments) ? [{ id: 'signatures', label: 'គ្រប់គ្រងហត្ថលេខា', icon: FileText, path: 'signatures' }] : []),
      ...(perms.canViewDocuments ? [{ id: 'howto-docs', label: 'ឯកសាររបៀប', icon: FileText, path: 'howto-docs' }] : []),
      ...(perms.canViewDocuments ? [{ id: 'missions', label: 'លិខិតបញ្ជាបេសកកម្ម', icon: FileText, route: '/missions', path: 'missions' }] : []),
      ...((perms.canViewFileTransfers || perms.canViewFiles) ? [{ id: 'file-transfer', label: 'ផ្ទេរឯកសារ', icon: FileText, route: '/file-transfer', path: 'file-transfer' }] : []),
      ...((perms.canViewFileTransfers || perms.canViewFiles) ? [{ id: 'file-transfer-stats', label: 'ស្ថិតិឯកសារ', icon: BarChart3, route: '/file-transfer-stats', path: 'file-transfer-stats' }] : [])
    ] }] : []),
    ...(perms.canViewAttendance ? [{
      id: 'attendance',
      label: 'វត្តមាន',
      icon: Clock,
      hasSubmenu: true,
      submenu: [
        { id: 'attendance-list', label: 'បញ្ជីវត្តមាន', icon: Calendar, path: 'attendance' },
        { id: 'attendance-report', label: 'របាយការណ៍វត្តមាន', icon: FileText, path: 'attendance-report' },
        ...(perms.canViewAttendance ? [{ id: 'attendance-scan-qr', label: 'ស្កេន QR/Barcode', icon: Clock, route: '/mobileApp/attendance' }] : []),
        ...(perms.canFaceMatch ? [{ id: 'attendance-scan-face', label: 'ស្កេនមុខ', icon: User, legacyUrl: legacyHref('/face_scan.html') }] : []),
        ...(perms.canFaceEnroll ? [{ id: 'attendance-face-enroll', label: 'ចុះឈ្មោះមុខ', icon: UserPlus, legacyUrl: legacyHref('/face_enroll.html') }] : []),
        // Legacy static attendance page (public/attendance.html)
        { id: 'attendance-legacy', label: 'បង្កើតវត្តមាន (ផេក)', icon: Clock, legacyUrl: legacyHref('/attendance.html') },
        { id: 'work-schedule', label: 'ប្រតិទិនការងារ', icon: Calendar, route: '/work-schedule', path: 'work-schedule' },
        // work-calendar removed from Attendance submenu
        ...( (perms.canViewSettings || perms.canViewHR) ? [{ id: 'shifts-att', label: 'Shifts', icon: Calendar, route: '/shifts', path: 'shifts' }] : [] ),
        ...(perms.canViewAttendance ? [{ id: 'attendance-daily-report', label: 'របាយការណ៍វត្តមាន (ថ្ងៃ)', icon: FileText, route: '/attendance-daily-report' }] : []),
        ...(perms.canViewAttendance ? [{ id: 'attendance-daily-report', label: 'របាយការណ៍វត្តមាន (ថ្ងៃ)', icon: FileText, route: '/attendance-daily-report' }] : []),
        ...(perms.canViewAttendance ? [
          { id: 'attendance-monthly-report', label: 'វត្តមានប្រចាំខែ', icon: FileText, path: 'attendance-monthly-report' },
          { id: 'attendance-day-report', label: 'វត្តមានប្រចាំខែ (ល.1)', icon: FileText, path: 'attendance-day-report' }
        ] : []),
        ...(perms.canViewAttendanceMonthlyData ? [{ id: 'attendance-monthly-data', label: 'ទិន្នន័យវត្តមានខែ', icon: FileText, path: 'attendance-monthly-data' }] : []),
        ...(perms.canViewAttendanceMonthlyData ? [{ id: 'attendance-day-data', label: 'ទិន្នន័យវត្តមានថ្ងៃ', icon: FileText, path: 'attendance-day-data' }] : []),
        ...(perms.canViewAttendance ? [{ id: 'shift-groups', label: 'Shift Groups', icon: Calendar, route: '/shift-groups', path: 'shift-groups' }] : []),
        ...(perms.canViewAttendance ? [{ id: 'group-report', label: 'របាយការណ៍ក្រុម', icon: Calendar, path: 'group-report' }] : []),
      ]
    }] : []),
    ...(perms.canViewEmployeeReport || perms.canViewAttendance || perms.canViewRetirementReport || perms.canViewTransformationReport || perms.canViewPromotionByRotationReport || perms.canViewPromotionByDiplomaReport || perms.canViewPromotionByHonorReport || perms.canViewUnpaidLeaveReport || perms.canViewMaternityLeaveReport || perms.canViewStudyLeaveReport ? 
      [{ id: 'reports', label: 'របាយការណ៍', icon: FileText, hasSubmenu: true, submenu: [
      ...(perms.canViewEmployeeReport ? [{ id: 'employee-report', label: 'បុគ្គលិក', icon: FileText, path: 'employee-report' }] : []),
      ...(perms.canViewAttendance ? [{ id: 'daily-report', label: 'ប្រចាំថ្ងៃ', icon: FileText, path: 'daily-report' }, { id: 'group-report', label: 'ក្រុម', icon: FileText, path: 'group-report' }] : []),
      ...(perms.canViewEmployeeReport ? [{ id: 'director-report', label: 'នាយក', icon: FileText, path: 'director-report' }, { id: 'deputy-director-report', label: 'អនុនាយក', icon: FileText, path: 'deputy-director-report' }, 
        { id: 'office-head-report', label: 'ម្ចាស់ការិយាល័យ', icon: FileText, path: 'office-head-report' }, { id: 'deputy-office-head-report', label: 'អនុម្ចាស់ការិយាល័យ', icon: FileText, path: 'deputy-office-head-report' }, { id: 'section-head-report', label: 'ប្រធានផ្នែក', icon: FileText, path: 'section-head-report' }, 
        { id: 'deputy-section-head-report', label: 'អនុប្រធានផ្នែក', icon: FileText, path: 'deputy-section-head-report' }, 
        { id: 'principal-report', label: 'មេទិច', icon: FileText, path: 'principal-report' }, { id: 'deputy-principal-report', label: 'អនុមេទិច', icon: FileText, path: 'deputy-principal-report' }, 
        { id: 'incharge-report', label: 'ទទួលបន្ទុក', icon: FileText, path: 'incharge-report' }] : []),
      ...(perms.canViewTransformationReport ? [{ id: 'picture-report', label: 'ប្តូរទម្រង់', icon: FileText, path: 'picture-report' }] : []),
      ...(perms.canViewRetirementReport ? [{ id: 'retirement-report', label: 'ចូលនិវត្តន៍', icon: FileText, path: 'retirement-report' }] : []),
      ...(perms.canViewPromotionByRotationReport ? [{ id: 'promotion-rotation-report', label: 'ឡើងកាំប្រាក់ (រូតេ)', icon: FileText, path: 'promotion-rotation-report' }] : []),
      ...(perms.canViewPromotionByDiplomaReport ? [{ id: 'promotion-diploma-report', label: 'ឡើងកាំប្រាក់ (ឧត្តមសិទ្ធិ)', icon: FileText, path: 'promotion-diploma-report' }] : []),
      ...(perms.canViewPromotionByHonorReport ? [{ id: 'promotion-honor-report', label: 'ឡើងកាំប្រាក់ (កិត្តិយស)', icon: FileText, path: 'promotion-honor-report' }] : []),
      ...(perms.canViewUnpaidLeaveReport ? [{ id: 'unpaid-leave-report', label: 'ទំនេរគ្មានបៀវត្ស', icon: FileText, path: 'unpaid-leave-report' }] : []),
      ...(perms.canViewOfficialDelistedReport ? [{ id: 'official-delisted-report', label: 'មន្ត្រីលុបឈ្មោះ', icon: FileText, path: 'official-delisted-report' }] : []),
      ...(perms.canViewMaternityLeaveReport ? [{ id: 'maternity-leave-report', label: 'សម្រាល', icon: FileText, path: 'maternity-leave-report' }] : []),
      ...(perms.canViewStudyLeaveReport ? [{ id: 'study-leave-report', label: 'សិក្សា', icon: FileText, path: 'study-leave-report' }] : []),
      { id: 'department-report', label: 'ផ្នែក', icon: FileText, path: 'department-report' },
      ...(perms.canViewHR || perms.canViewSettings ? [
        { id: 'hr-role-summary', label: 'សង្ខេបតួនាទី HR', icon: FileText, route: '/hr-role-summary' },
        { id: 'hr-skill-summary', label: 'សង្ខេបជំនាញ HR', icon: FileText, route: '/hr-skill-summary' },
        { id: 'hr-display', label: 'បង្ហាញ HR', icon: Users, route: '/hr-display' }
      ] : [])
    ] }] : []),
    ...(perms.canViewSettings ? [{ id: 'settings', label: 'កំណត់', icon: Settings, path: 'settings' }] : []),
    ...(perms.canApproveHR ? [{
      id: 'onboarding-approvals',
      label: 'បញ្ជីបុគ្គលិកចុះឈ្មោះ',
      icon: UserPlus,
      route: '/approvals?targetType=user&source=staff_onboarding&status=pending'
    }] : []),
    { id: 'approvals', label: 'សំណើអនុម័ត', icon: Clock, path: 'approvals', hidden: !perms.canApproveHR }
  ];

  // Insert admin menu (Users / Roles) if user has management/view permissions
  const canManageUsers = perms.canManageUsers || false;
  const canManageRoles = perms.canManageRoles || false;
  if (canManageUsers || canManageRoles || perms.canViewRoles) {
    const adminMenu = {
      id: 'admin',
      label: 'អ្នកប្រើ/តួនាទី',
      icon: Users,
      hasSubmenu: true,
      submenu: [
        ...(canManageUsers ? [{ id: 'manage-users', label: 'គ្រប់គ្រងអ្នកប្រើ', icon: Users, path: 'users' }] : []),
        ...((canManageRoles || perms.canViewRoles) ? [{ id: 'manage-roles', label: 'គ្រប់គ្រងតួនាទី', icon: Settings, path: 'roles' }] : []),
      ]
    };

    const settingsIdx = menuItems.findIndex(m => m.id === 'settings');
    if (settingsIdx >= 0) menuItems.splice(settingsIdx, 0, adminMenu);
    else menuItems.push(adminMenu);
  }

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
              {item.submenu.map(subItem => (
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
                }} className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                  {subItem.icon && <subItem.icon className="w-4 h-4 flex-shrink-0" />}
                  <span className="text-sm truncate whitespace-nowrap overflow-hidden">{subItem.label}</span>
                </button>
              ))}
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
      }} className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors mb-1 ${isActive ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}>
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-sm font-medium text-blue-600">{(user?.fullName || user?.email || 'User').substring(0,2).toUpperCase()}</span></div>
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