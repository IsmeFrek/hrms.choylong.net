export const PERMISSIONS = [
  // user/role management
  'manage:users',
  'manage:roles',
  // employees
  'view:employees',
  'edit:employees',
  'view:employee-id-docs',
  'edit:employee-id-docs',
  // HR certificate
  'view:hr',
  'edit:hr',
  'print:hr',
  'approve:hr',   // new: approve HR-related change requests
  // departments
  'view:departments',
  'edit:departments',
  // department units (granular control)
  'view:department-units',
  'edit:department-units',
  // setup overview (UI grouping) - grant to show the Setup menu
  'view:setup',
  // positions
  'view:positions',
  'edit:positions',
  // skills
  'view:skills',
  'edit:skills',
  // documents/files
  'view:documents',
  'edit:documents',
  // file transfers (separate from documents for finer control)
  'view:fileTransfers',
  'edit:fileTransfers',
  'delete:fileTransfers',
  'reply:fileTransfers',
  'send:feedback',
  'send:telegram',
  // per-letter field edit permissions (fine-grained)
  // per-letter field edit permissions (fine-grained)
  // NOTE: detailed per-letter stage edit permissions were removed per request.
  // files (separate from documents, if you want finer control)
  'view:files',
  'edit:files',
  // 'view:audit', // optional: if you add audit logs later
  
  // SignSchemas (Signatures) - granular permissions per role
  'view:signSchemas',
  'create:signSchemas',
  'edit:signSchemas',
  'delete:signSchemas',
  
  // Pages: reports and others
  'view:report.employee',
  'view:report.maternityLeave',
  'view:report.promotionDiploma',
  'view:report.promotionHonor',
  'view:report.promotionRotation',
  'view:report.retirement',
  'view:report.studyLeave',
  'view:report.transformation',
  'view:report.unpaidLeave',
  'view:report.officialDelisted',
  'view:report.newEmployeesThisMonth',
  'view:report.attendanceMonthly',
  'view:report.attendanceMonthlyData',
  // staff self-profile (My HR)
  'view:my-hr',
  'view:selfservice',
  'view:attendance',
  'attendance:edit',
  'attendance:delete',
  'addattendance:approve',
  // Face recognition (biometric) - restrict carefully
  'face:match',
  'face:enroll',
  'face:delete',
  'view:settings',
  'view:roles',
  // Leave Requests
  'view:leaveRequests',
  'edit:leaveRequests',
  'approve:leaveRequests',
  'delete:leaveRequests',
  // Granular Scan & Attendance
  'scan:qr',
  'scan:face',
  'scan:face_group',
  'view:absence',
  'view:attendance_report',
  'view:attendance_monthly',
  'view:attendance_daily',
  'view:attendance_sum_day_report',
  'view:work-schedule',
  'edit:work-schedule',
  'view:shifts',
  'edit:shifts',
  'view:shift-groups',
  'edit:shift-groups',
  'view:group-timetables',
  'edit:group-timetables',
  'view:dashboard',
];
