import React, { useEffect, useState, useMemo } from 'react';
import { listRoles, listAllPermissions, createRole, updateRole, deleteRole } from '../api/users';
import { useAuth } from '../context/AuthContext';
import usePermission from '../hooks/usePermission';
import { FaShieldAlt, FaKey, FaSave, FaTimes, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';

const PERMISSION_LABELS = {
  // Home / General
  'view:my-hr': 'មើលព័ត៌មានផ្ទាល់ខ្លួន',
  'view:selfservice': 'មើលសេវាផ្ទាល់ខ្លួន',
  'dashboard': 'ផ្ទាំងគ្រប់គ្រង',

  // HR / Setup
  'view:hr': 'មើលព័ត៌មានបុគ្គលិក (HR)',
  'edit:hr': 'កែសម្រួលព័ត៌មានបុគ្គលិក (HR)',
  'approve:hr': 'អនុម័តព័ត៌មានបុគ្គលិក',
  'print:hr': 'បោះពុម្ពព័ត៌មានបុគ្គលិក',
  'view:departments': 'មើលផ្នែក (Departments)',
  'edit:departments': 'កែសម្រួលផ្នែក',
  'view:department-units': 'មើលអង្គភាព (Department Units)',
  'edit:department-units': 'កែសម្រួលអង្គភាព',
  'view:positions': 'មើលតួនាទី',
  'edit:positions': 'កែសម្រួលតួនាទី',
  'view:skills': 'មើលជំនាញ / ជំនាញក្រសួង',
  'edit:skills': 'កែសម្រួលជំនាញ',
  'view:setup': 'មើលការកំណត់ (Setup)',
  'view:settings': 'មើលការកំណត់ (Settings / ទីតាំងស្កេន)',
  'geo-fence': 'កំណត់ទីតាំងស្កេន (Geo-fence)',
  'view:employees': 'មើលបុគ្គលិក',
  'edit:employees': 'កែសម្រួលបុគ្គលិក',
  'view:employee-id-docs': 'មើលអត្តសញ្ញាណប័ណ្ណ / ឯកសារផ្សេងៗ',
  'edit:employee-id-docs': 'កែប្រែអត្តសញ្ញាណប័ណ្ណ / ឯកសារផ្សេងៗ',

  // Documents / Missions
  'view:missions': 'មើលលិខិតបញ្ជាបេសកកម្ម (Missions)',
  'edit:missions': 'កែសម្រួលលិខិតបញ្ជាបេសកកម្ម',
  'view:kamprak': 'មើលការគ្រប់គ្រងកាំប្រាក់',
  'edit:kamprak': 'កែសម្រួលការគ្រប់គ្រងកាំប្រាក់',
  'view:files': 'មើលឯកសារ',
  'view:signSchemas': 'មើលគ្រប់គ្រងហត្ថលេខា',
  'create:signSchemas': 'បង្កើតគ្រប់គ្រងហត្ថលេខា',
  'edit:signSchemas': 'កែសម្រួលគ្រប់គ្រងហត្ថលេខា',
  'delete:signSchemas': 'លុបគ្រប់គ្រងហត្ថលេខា',
  'delete:fileTransfers': 'លុបការផ្ទេរឯកសារ',
  'edit:fileTransfers': 'កែសម្រួលការផ្ទេរឯកសារ',
  'reply:fileTransfers': 'ឆ្លើយតបការផ្ទេរឯកសារ',
  'view:fileTransfers': 'មើលផ្ទេរឯកសារ / ស្ថិតិឯកសារ',
  'view:fileTransfersOutgoing': 'មើលឯកសារចេញ',
  'edit:fileTransfersOutgoing': 'កែសម្រួលឯកសារចេញ',

  // Attendance
  'view:attendance': 'មើលវត្តមាន',
  'edit:attendance': 'កែសម្រួលវត្តមាន',
  'attendance:edit': 'កែសម្រួលវត្តមាន',
  'attendance:delete': 'លុបវត្តមាន',
  'addattendance:approve': 'អនុម័តការបន្ថែមវត្តមាន',
  'view:work-schedule': 'មើលប្រតិទិនការងារ',
  'edit:work-schedule': 'កែសម្រួលប្រតិទិនការងារ',
  'view:shifts': 'មើលវេនការងារ (Shifts)',
  'edit:shifts': 'កែសម្រួលវេនការងារ (Shifts)',
  'view:shift-groups': 'មើលក្រុមវេនការងារ (Shift Groups)',
  'edit:shift-groups': 'កែសម្រួលក្រុមវេនការងារ (Shift Groups)',
  'view:group-timetables': 'មើលគ្រប់គ្រងម៉ោងក្រុម',
  'edit:group-timetables': 'កែសម្រួលគ្រប់គ្រងម៉ោងក្រុម',

  // Reports
  'view:report.employee': 'មើលរបាយការណ៍បុគ្គលិក',
  'edit:report.employee': 'កែសម្រួលរបាយការណ៍បុគ្គលិក',
  'view:report.newEmployeesThisMonth': 'មើលរបាយការណ៍បុគ្គលិកថ្មី',
  'edit:report.newEmployeesThisMonth': 'កែសម្រួលរបាយការណ៍បុគ្គលិកថ្មី',
  'view:report.officialDelisted': 'មើលរបាយការណ៍មន្ត្រីឈប់ពីការងារ',
  'edit:report.officialDelisted': 'កែសម្រួលរបាយការណ៍មន្ត្រីឈប់ពីការងារ',
  'view:report.studyLeave': 'មើលរបាយការណ៍មន្ត្រីទៅសិក្សា',
  'edit:report.studyLeave': 'កែសម្រួលរបាយការណ៍មន្ត្រីទៅសិក្សា',
  'view:report.unpaidLeave': 'មើលរបាយការណ៍ទំនេរគ្មានបៀវត្ស',
  'edit:report.unpaidLeave': 'កែសម្រួលរបាយការណ៍ទំនេរគ្មានបៀវត្ស',
  'view:report.retirement': 'មើលរបាយការណ៍ចូលនិវត្តន៍',
  'edit:report.retirement': 'កែសម្រួលរបាយការណ៍ចូលនិវត្តន៍',
  'view:report.maternityLeave': 'មើលរបាយការណ៍មាតុភាព (Maternity Leave)',
  'view:report.daily': 'មើលរបាយការណ៍ប្រចាំថ្ងៃ',
  'edit:report.daily': 'កែសម្រួលរបាយការណ៍ប្រចាំថ្ងៃ',
  'view:report.group': 'មើលរបាយការណ៍តាមក្រុម',
  'edit:report.group': 'កែសម្រួលរបាយការណ៍តាមក្រុម',
  'view:report.officeHead': 'មើលរបាយការណ៍ម្ចាស់ការិយាល័យ',
  'edit:report.officeHead': 'កែសម្រួលរបាយការណ៍ម្ចាស់ការិយាល័យ',
  'view:report.sectionHead': 'មើលរបាយការណ៍ប្រធានផ្នែក',
  'edit:report.sectionHead': 'កែសម្រួលរបាយការណ៍ប្រធានផ្នែក',
  'view:report.department': 'មើលរបាយការណ៍តាមផ្នែក',
  'edit:report.department': 'កែសម្រួលរបាយការណ៍តាមផ្នែក',
  'view:hr-role-summary': 'មើលសង្ខេបតួនាទី HR',
  'edit:hr-role-summary': 'កែសម្រួលសង្ខេបតួនាទី HR',
  'view:hr-skill-summary': 'មើលសង្ខេបជំនាញ HR',
  'edit:hr-skill-summary': 'កែសម្រួលសង្ខេបជំនាញ HR',
  'view:hr-display': 'មើលការបង្ហាញ HR',
  'edit:hr-display': 'កែសម្រួលការបង្ហាញ HR',
  'view:report.promotionRotation': 'មើលរបាយការណ៍ប្តូរវេន',
  'view:report.promotionHonor': 'មើលរបាយការណ៍គ្រឿងឥស្សរិយយស',
  'view:report.promotionDiploma': 'មើលរបាយការណ៍សញ្ញាបត្រ',
  'view:report.transformation': 'មើលរបាយការណ៍ប្តូរទម្រង់',

  // Admin / Users
  'manage:users': 'គ្រប់គ្រងអ្នកប្រើប្រាស់',
  'manage:roles': 'គ្រប់គ្រងតួនាទី',
  'view:roles': 'មើលតួនាទី',

  // Leave Requests
  'view:leaveRequests': 'មើលបញ្ជីសំណើច្បាប់',
  'edit:leaveRequests': 'កែសម្រួលសំណើច្បាប់',
  'approve:leaveRequests': 'អនុម័តសំណើច្បាប់',
  'delete:leaveRequests': 'លុបសំណើច្បាប់',

  // Face / Other
  'face:enroll': 'ចុះឈ្មោះផ្ទៃមុខ',
  'face:match': 'ផ្ទៀងផ្ទាត់ផ្ទៃមុខ',
  'face:delete': 'លុបផ្ទៃមុខ',
  'send:feedback': 'ផ្ញើមតិយោបល់',
  'send:telegram': 'ផ្ញើតេឡេក្រាម',
  'view:letter.resignation': 'មើលលិខិតឈប់ពីការងារ',
  'edit:letter.resignation': 'កែសម្រួលលិខិតឈប់ពីការងារ',
  'view:letter.onboarding': 'មើលលិខិតចូលបុគ្គលិកថ្មី',
  'edit:letter.onboarding': 'កែសម្រួលលិខិតចូលបុគ្គលិកថ្មី',
  'view:letter.appointment': 'មើលលិខិតតែងតាំង',
  'edit:letter.appointment': 'កែសម្រួលលិខិតតែងតាំង',
  'view:letter.termination': 'មើលលិខិតបញ្ចប់មុខតំណែង',
  'edit:letter.termination': 'កែសម្រួលលិខិតបញ្ចប់មុខតំណែង',
  'view:letter.others': 'មើលលិខិតផ្សេងៗ',
  'edit:letter.others': 'កែសម្រួលលិខិតផ្សេងៗ',
  // New Granular Permissions
  'scan:qr': 'ស្កេន QR/Barcode',
  'scan:face': 'ស្កេនមុខ (Single)',
  'scan:face_group': 'ស្កេនមុខ (Group)',
  'view:absence': 'វត្តមាន',
  'view:attendance_report': 'របាយការណ៍វត្តមាន',
  'view:attendance_daily': 'វត្តមានប្រចាំថ្ងៃ',
  'view:attendance_monthly': 'វត្តមានប្រចាំខែ',
  'view:attendance_sum_day_report': 'វត្តមានថវិកា',
  'view:report.attendanceMonthlyData': 'សរុបវត្តមានចន្លោះថ្ងៃ',
  'view:report.attendanceMonthly': 'រ_វត្តមានក្រសួង',
  'view:attendance_day_data': 'ទិន្នន័យវត្តមានថ្ងៃ',
  'view:attendance_monthly_data': 'ទិន្នន័យវត្តមានខែ',
  'view:attendance_audit': 'វត្តមានអូឌិត',
  'view:attendance_ministry': 'វត្តមានក្រសួង',
  'view:attendance_daily_checkinme': 'Daily Report Checkinme',
  'view:employee_evaluation': 'វាយតំលៃបុគ្គលិក'
};

// Group permissions by category (outside component to avoid recreation on each render)
const groupPermissions = (permissions) => {
  const groups = {
    'ទំព័រដើម': { view: [], action: [] },
    'កំណត់': { view: [], action: [] },
    'ឯកសារ': { view: [], action: [] },
    'លិខិតបង្គាប់ការ': { view: [], action: [] },
    'ស្កែនវត្តមាន': { view: [], action: [] },
    'វត្តមាន': { view: [], action: [] },
    'កាលវិភាគការងារ': { view: [], action: [] },
    'របាយការណ៍': { view: [], action: [] },
    'កាំប្រាក់': { view: [], action: [] },
    'ច្បាប់': { view: [], action: [] },
    'គ្រប់គ្រងអ្នកប្រើ & តួនាទី': { view: [], action: [] }
  };

  permissions.forEach(perm => {
    let targetGroup = 'ផ្សេងៗ';
    if (perm.includes('manage:users') || perm.includes('manage:roles') || perm.includes('view:roles')) {
      targetGroup = 'គ្រប់គ្រងអ្នកប្រើ & តួនាទី';
    } else if (perm.includes('view:hr') || perm.includes('edit:hr') || perm.includes('approve:hr') || perm.includes('print:hr') ||
      perm.includes('department') || perm.includes('positions') || perm.includes('skills') || perm.includes('view:setup') ||
      perm.includes('view:settings') || perm.includes('geo-fence')) {
      targetGroup = 'កំណត់';
    } else if (perm.includes('letter') || perm.includes('report.maternityLeave')) {
      targetGroup = 'លិខិតបង្គាប់ការ';
    } else if (perm.includes('file') || perm.includes('document') || perm.includes('signSchema') || perm.includes('mission') || perm.includes('employee-id-docs')) {
      targetGroup = 'ឯកសារ';
    } else if (perm.includes('scan') || perm.includes('face')) {
      targetGroup = 'ស្កែនវត្តមាន';
    } else if (perm.includes('work-schedule') || perm.includes('shifts') || perm.includes('shift-groups') || perm.includes('group-timetables')) {
      targetGroup = 'កាលវិភាគការងារ';
    } else if (perm.includes('attendance') || perm.includes('view:absence') || perm.includes('employee_evaluation')) {
      targetGroup = 'វត្តមាន';
    } else if (perm.includes('report')) {
      targetGroup = 'របាយការណ៍';
    } else if (perm.includes('promotion') || perm.includes('kamprak')) {
      targetGroup = 'កាំប្រាក់';
    } else if (perm.includes('leave')) {
      targetGroup = 'ច្បាប់';
    } else if (perm.includes('dashboard') || perm.includes('view:my-hr')) {
      targetGroup = 'ទំព័រដើម';
    }

    if (!groups[targetGroup]) groups[targetGroup] = { view: [], action: [] };

    // Categorize by View or Action
    const isView = perm.startsWith('view:');
    if (isView) {
      groups[targetGroup].view.push(perm);
    } else {
      groups[targetGroup].action.push(perm);
    }
  });

  return groups;
};

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newRole, setNewRole] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  // Memoize grouped permissions to avoid unnecessary recalculations
  const groupedPerms = useMemo(() => groupPermissions(availablePermissions), [availablePermissions]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [r, p] = await Promise.all([listRoles(), listAllPermissions()]);
      const basePerms = Array.isArray(p) ? p.slice() : [];
      // Ensure our important permissions are available in the list
      ['delete:fileTransfers', 'send:feedback', 'reply:fileTransfers', 'view:departments', 'edit:departments', 'view:setup', 'view:signSchemas', 'create:signSchemas', 'edit:signSchemas', 'delete:signSchemas',
        'view:report.newEmployeesThisMonth', 'edit:report.newEmployeesThisMonth',
        'view:report.officialDelisted', 'edit:report.officialDelisted',
        'view:report.studyLeave', 'edit:report.studyLeave',
        'view:missions', 'edit:missions',
        'view:employee-id-docs', 'edit:employee-id-docs',
        'view:fileTransfersOutgoing', 'edit:fileTransfersOutgoing',
        'view:letter.resignation', 'edit:letter.resignation', 'view:letter.onboarding', 'edit:letter.onboarding', 'view:letter.appointment', 'edit:letter.appointment', 'view:letter.termination', 'edit:letter.termination', 'view:letter.others', 'edit:letter.others',
        'view:report.unpaidLeave', 'edit:report.unpaidLeave',
        'view:report.retirement', 'edit:report.retirement',
        'view:report.employee', 'edit:report.employee',
        'view:report.daily', 'edit:report.daily',
        'view:report.group', 'edit:report.group',
        'view:report.officeHead', 'edit:report.officeHead',
        'view:report.sectionHead', 'edit:report.sectionHead',
        'view:report.department', 'edit:report.department',
        'view:hr-role-summary', 'edit:hr-role-summary',
        'view:hr-skill-summary', 'edit:hr-skill-summary',
        'view:hr-display', 'edit:hr-display',
        'view:kamprak', 'edit:kamprak',
        'view:work-schedule', 'edit:work-schedule',
        'view:shifts', 'edit:shifts',
        'view:shift-groups', 'edit:shift-groups',
        'view:group-timetables', 'edit:group-timetables',
        'view:leaveRequests', 'edit:leaveRequests', 'approve:leaveRequests', 'delete:leaveRequests',
        'view:report.promotionDiploma', 'edit:report.promotionDiploma',
        'view:report.promotionHonor', 'edit:report.promotionHonor',
        'view:report.promotionRotation', 'edit:report.promotionRotation',
        'view:report.transformation', 'edit:report.transformation'
      ].forEach(np => {
        if (!basePerms.includes(np)) basePerms.push(np);
      });
      // stable sort for readability
      basePerms.sort();
      setRoles(r || []);
      setAvailablePermissions(basePerms);
      
      // Set default selected role if none selected
      if (r && r.length > 0) {
        setSelectedRoleId(prev => prev || r[0].id);
      }
    } catch (e) { setError(e.message || 'Load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const { user: currentUser } = useAuth() || {};
  const perms = usePermission();
  const isAdmin = perms.isAdmin;

  const add = async (e) => {
    e.preventDefault();
    if (!newRole.trim()) return;
    setSaving(true);
    try { await createRole({ name: newRole.trim(), permissions: [] }); setNewRole(''); await load(); }
    catch (e) { setError(e.message || 'Create failed'); }
    finally { setSaving(false); }
  };

  const togglePerm = async (role, perm) => {
    setSaving(true);
    try {
      const next = role.permissions?.includes(perm)
        ? role.permissions.filter((p) => p !== perm)
        : [...(role.permissions || []), perm];
      await updateRole(role.id, { permissions: next });
      await load();
    } catch (e) { setError(e.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const setAllPerms = async (role, selectAll) => {
    if (!window.confirm(selectAll ? `តើអ្នកចង់ជ្រើសរើសសិទ្ធិទាំងអស់សម្រាប់តួនាទី "${role.name}" មែនទេ?` : `តើអ្នកចង់សម្អាតសិទ្ធិទាំងអស់សម្រាប់តួនាទី "${role.name}" មែនទេ?`)) return;
    setSaving(true);
    try {
      const next = selectAll ? [...availablePermissions] : [];
      await updateRole(role.id, { permissions: next });
      await load();
    } catch (e) { setError(e.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const saveEditName = async () => {
    if (!editingId) return;
    setSaving(true);
    try { await updateRole(editingId, { name: editingName.trim() }); setEditingId(null); setEditingName(''); await load(); }
    catch (e) { setError(e.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const remove = async (role) => {
    if (!window.confirm(`Delete role ${role.name}?`)) return;
    setSaving(true);
    try { await deleteRole(role.id); await load(); }
    catch (e) { setError(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 w-full">
      <h1 className="text-xl font-semibold mb-4">ការគ្រប់គ្រងតួនាទី (Role Management)</h1>

      <form onSubmit={add} className="flex gap-2 mb-4">
        <input className="border rounded px-3 py-2 w-full" placeholder="ឈ្មោះតួនាទីថ្មី" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
        <button disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-2">
          {saving ? 'កំពុងរក្សាទុក...' : <><FaPlus /> បន្ថែម</>}
        </button>
      </form>

      {error && <div className="mb-3 text-red-600">{error}</div>}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="border rounded md:col-span-1 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-semibold text-gray-700">តួនាទី</th>
                <th className="text-right p-3 font-semibold text-gray-700">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-3" colSpan={2}>កំពុងផ្ទុក...</td></tr>
              ) : roles.length === 0 ? (
                <tr><td className="p-3" colSpan={2}>មិនមានតួនាទី</td></tr>
              ) : roles.map(r => (
                <tr 
                  key={r.id} 
                  className={`border-t cursor-pointer hover:bg-blue-50/50 ${selectedRoleId === r.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}
                  onClick={() => setSelectedRoleId(r.id)}
                >
                  <td className="p-3">
                    {editingId === r.id ? (
                      <input className="border rounded px-2 py-1 w-full focus:ring-1 focus:ring-blue-500 outline-none" value={editingName} onChange={(e) => setEditingName(e.target.value)} onClick={(e) => e.stopPropagation()} />
                    ) : (
                      <div className="font-medium text-gray-800">{r.name}</div>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    {editingId === r.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={saveEditName} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700" disabled={saving}>រក្សាទុក</button>
                        <button onClick={() => { setEditingId(null); setEditingName(''); }} className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500" disabled={saving}>បោះបង់</button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setEditingId(r.id); setEditingName(r.name); }} className="px-2 py-1 border border-blue-600 text-blue-600 rounded text-xs hover:bg-blue-600 hover:text-white transition" disabled={saving}>ប្តូរឈ្មោះ</button>
                        <button onClick={() => remove(r)} className="px-2 py-1 border border-red-600 text-red-600 rounded text-xs hover:bg-red-600 hover:text-white transition" disabled={saving}>លុប</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Permissions matrix for selected role */}
        <div className="border rounded p-4 md:col-span-2 bg-white shadow-sm">
          <h2 className="font-semibold mb-3 text-blue-900 border-b pb-2 flex items-center gap-2">
            <FaShieldAlt className="text-blue-600" /> ការកំណត់សិទ្ធិ (Set Permissions)
          </h2>
          
          {roles.find(r => r.id === selectedRoleId) ? (() => {
            const role = roles.find(r => r.id === selectedRoleId);
            return (
              <div key={role.id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200 gap-2">
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    <FaKey className="text-blue-600" /> {role.name}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAllPerms(role, true)}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm"
                    >
                      <FaShieldAlt className="text-xs" /> ជ្រើសរើសទាំងអស់
                    </button>
                    <button
                      onClick={() => setAllPerms(role, false)}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition flex items-center gap-1.5 shadow-sm"
                    >
                      <FaTimes className="text-xs" /> សម្អាតទាំងអស់
                    </button>
                  </div>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                  {Object.entries(groupedPerms).map(([group, split]) =>
                    (split.view.length > 0 || split.action.length > 0) && (
                      <div key={group} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition">
                        <div className="text-sm font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span> {group}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* View Column */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
                            <div className="col-span-full text-[10px] uppercase tracking-wider font-bold text-blue-600 mb-2 flex items-center gap-1.5 px-1">
                              <FaShieldAlt className="text-[10px] opacity-70" /> មើល (Viewing Rights)
                            </div>
                            {split.view.map(p => (
                              <label key={p} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition border border-transparent hover:border-gray-100 group">
                                <input
                                  type="checkbox"
                                  checked={!!role.permissions?.includes(p)}
                                  onChange={() => togglePerm(role, p)}
                                  disabled={saving}
                                  className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm">
                                  <span className="block font-medium text-gray-700 leading-snug">{PERMISSION_LABELS[p] || p}</span>
                                  {PERMISSION_LABELS[p] && <span className="text-[9px] text-gray-400 block leading-tight mt-0.5 group-hover:text-blue-500 transition-colors uppercase">{p}</span>}
                                </span>
                              </label>
                            ))}
                            {split.view.length === 0 && <div className="col-span-full text-[10px] italic text-gray-400 px-3 py-1">មិនមានសិទ្ធមើល</div>}
                          </div>

                          {/* Action Column */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
                            <div className="col-span-full text-[10px] uppercase tracking-wider font-bold text-red-600 mb-2 flex items-center gap-1.5 px-1">
                              <FaKey className="text-[10px] opacity-70" /> កែសម្រួល / សកម្មភាព (Actions)
                            </div>
                            {split.action.map(p => (
                              <label key={p} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition border border-transparent hover:border-gray-100 group">
                                <input
                                  type="checkbox"
                                  checked={!!role.permissions?.includes(p)}
                                  onChange={() => togglePerm(role, p)}
                                  disabled={saving}
                                  className="mt-1 rounded text-red-600 focus:ring-red-500"
                                />
                                <span className="text-sm">
                                  <span className="block font-medium text-gray-700 leading-snug">{PERMISSION_LABELS[p] || p}</span>
                                  {PERMISSION_LABELS[p] && <span className="text-[9px] text-gray-400 block leading-tight mt-0.5 group-hover:text-red-500 transition-colors uppercase">{p}</span>}
                                </span>
                              </label>
                            ))}
                            {split.action.length === 0 && <div className="text-[10px] italic text-gray-400 px-3 py-1">មិនមានសិទ្ធិកែសម្រួល</div>}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="text-center py-12 text-gray-500">
              សូមជ្រើសរើសតួនាទីពីតារាងខាងឆ្វេង ដើម្បីកំណត់សិទ្ធិ។
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
