import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

// Generic permission hook. Assumes auth.user.permissions is an array.
export default function usePermission() {
	const { user } = useAuth();
	const list = Array.isArray(user?.permissions) ? user.permissions : [];

	const has = (perm) => list.includes(perm);
	const any = (...perms) => perms.some((p) => has(p));
	const all = (...perms) => perms.every((p) => has(p));

	// Common helpers for pages
	return useMemo(() => {
		const roles = Array.isArray(user?.roles) ? user.roles.map(r => (r?.name || r).toString()) : [];
		const isAdmin = roles.includes('Admin') || roles.includes('Administrator') || user?.email === 'admin@hospital.com';

		const p = {
			list,
			has,
			any,
			all,
			isAdmin,
			// page-specific
			canViewEmployees: isAdmin || has('view:employees'),
			canEditEmployees: isAdmin || has('edit:employees'),
			canViewHR: isAdmin || has('view:hr'),
			canEditHR: isAdmin || has('edit:hr'),
			canPrintHR: isAdmin || has('print:hr'),
			canApproveHR: isAdmin || has('approve:hr'),
			canViewDepartments: isAdmin || has('view:departments'),
			canEditDepartments: isAdmin || has('edit:departments'),
			canViewPositions: isAdmin || has('view:positions'),
			canEditPositions: isAdmin || has('edit:positions'),
			canViewSkills: isAdmin || has('view:skills'),
			canEditSkills: isAdmin || has('edit:skills'),
			canViewSetup: isAdmin || has('view:setup'),
			canViewDocuments: isAdmin || has('view:documents'),
			canEditDocuments: isAdmin || has('edit:documents'),
			// SignSchemas (Signatures)
			canViewSignSchemas: isAdmin || has('view:signSchemas'),
			canCreateSignSchemas: isAdmin || has('create:signSchemas'),
			canEditSignSchemas: isAdmin || has('edit:signSchemas'),
			canDeleteSignSchemas: isAdmin || has('delete:signSchemas'),
			canManageSignSchemas: isAdmin || any('create:signSchemas', 'edit:signSchemas', 'delete:signSchemas'),
			// FileTransfer specific permissions
			canViewFileTransfers: isAdmin || has('view:fileTransfers'),
			canEditFileTransfers: isAdmin || has('edit:fileTransfers'),
			canViewFileTransfersOutgoing: isAdmin || has('view:fileTransfersOutgoing'),
			canEditFileTransfersOutgoing: isAdmin || has('edit:fileTransfersOutgoing'),
			canViewFiles: isAdmin || has('view:files'),
			canEditFiles: isAdmin || has('edit:files'),
			canManageUsers: isAdmin || has('manage:users'),
			canManageRoles: isAdmin || has('manage:roles'),
			// page-level view perms
			canViewEmployeeReport: isAdmin || has('view:report.employee'),
			canViewMaternityLeaveReport: isAdmin || has('view:report.maternityLeave'),
			canViewPromotionByDiplomaReport: isAdmin || has('view:report.promotionDiploma'),
			canViewPromotionByHonorReport: isAdmin || has('view:report.promotionHonor'),
			canViewPromotionByRotationReport: isAdmin || has('view:report.promotionRotation'),
			canViewRetirementReport: isAdmin || has('view:report.retirement'),
			canViewStudyLeaveReport: isAdmin || has('view:report.studyLeave'),
			canViewTransformationReport: isAdmin || has('view:report.transformation'),
			canViewUnpaidLeaveReport: isAdmin || has('view:report.unpaidLeave'),
			canViewOfficialDelistedReport: isAdmin || has('view:report.officialDelisted'),
			canViewNewEmployeesThisMonthReport: isAdmin || has('view:report.newEmployeesThisMonth'),
			canEditNewEmployeesThisMonthReport: isAdmin || has('edit:report.newEmployeesThisMonth'),
			canViewStaffBiography: isAdmin || has('view:staff-biography'),
			canViewMeetingRooms: isAdmin || has('view:meeting-rooms'),
			canViewAttendanceMonthlyReport: isAdmin || has('view:report.attendanceMonthly'),
			canViewAttendanceMonthlyData: isAdmin || has('view:report.attendanceMonthlyData'),
			canViewDailyReport: isAdmin || has('view:report.daily'),
			canViewGroupReport: isAdmin || has('view:report.group'),
			canViewOfficeHeadReport: isAdmin || has('view:report.officeHead'),
			canViewSectionHeadReport: isAdmin || has('view:report.sectionHead'),
			canViewDepartmentReport: isAdmin || has('view:report.department'),
			canViewHRRoleSummary: isAdmin || has('view:hr-role-summary'),
			canViewHRSkillSummary: isAdmin || has('view:hr-skill-summary'),
			canViewHRDisplay: isAdmin || has('view:hr-display'),
			canViewKamprak: isAdmin || has('view:kamprak'),
			canEditKamprak: isAdmin || has('edit:kamprak'),
			canViewEmployeeIDDocs: isAdmin || has('view:employee-id-docs'),
			canEditEmployeeIDDocs: isAdmin || has('edit:employee-id-docs'),
			canViewMyHr: isAdmin || has('view:my-hr'),
			canViewSelfService: isAdmin || has('view:selfservice'),
			canViewAttendance: isAdmin || has('view:attendance'),
			canViewWorkSchedule: isAdmin || has('view:work-schedule'),
			canEditWorkSchedule: isAdmin || has('edit:work-schedule'),
			canViewShifts: isAdmin || has('view:shifts'),
			canEditShifts: isAdmin || has('edit:shifts'),
			canViewShiftGroups: isAdmin || has('view:shift-groups'),
			canEditShiftGroups: isAdmin || has('edit:shift-groups'),
			canViewGroupTimetables: isAdmin || has('view:group-timetables'),
			canEditGroupTimetables: isAdmin || has('edit:group-timetables'),
			// Face attendance (legacy pages)
			canFaceEnroll: isAdmin || has('face:enroll'),
			canFaceMatch: isAdmin || any('face:match', 'view:attendance'),
			canFaceDelete: isAdmin || has('face:delete'),
			canViewSettings: isAdmin || has('view:settings'),
			canViewRoles: isAdmin || has('view:roles'),
			// Leave Requests
			canViewLeaveRequests: isAdmin || has('view:leaveRequests'),
			canEditLeaveRequests: isAdmin || has('edit:leaveRequests'),
			canApproveLeaveRequests: isAdmin || has('approve:leaveRequests'),
			canDeleteLeaveRequests: isAdmin || has('delete:leaveRequests'),
			// Letter editing permissions by stage (simplified to 4 stages)
			canEditLettersOfficeHead: isAdmin || has('edit:letters.officeHead'),
			canEditLettersDeputy: isAdmin || has('edit:letters.deputy'),
			canEditLettersDirector: isAdmin || has('edit:letters.director'),
			canEditLettersApproved: isAdmin || has('edit:letters.approved'),
			canSendTelegram: isAdmin || has('send:feedback') || has('send:telegram'),
			// Mission specific
			canViewMissions: isAdmin || has('view:missions'),
			canEditMissions: isAdmin || has('edit:missions'),
			// Instruction Letters (Templates)
			canViewResignationLetter: isAdmin || has('view:letter.resignation'),
			canEditResignationLetter: isAdmin || has('edit:letter.resignation'),
			canViewOnboardingLetter: isAdmin || has('view:letter.onboarding'),
			canEditOnboardingLetter: isAdmin || has('edit:letter.onboarding'),
			canViewAppointmentLetter: isAdmin || has('view:letter.appointment'),
			canEditAppointmentLetter: isAdmin || has('edit:letter.appointment'),
			canViewTerminationLetter: isAdmin || has('view:letter.termination'),
			canEditTerminationLetter: isAdmin || has('edit:letter.termination'),
			canViewOtherLetters: isAdmin || has('view:letter.others'),
			canEditOtherLetters: isAdmin || has('edit:letter.others'),
			// Report edit permissions
			canEditEmployeeReport: isAdmin || has('edit:report.employee'),
			canEditMaternityLeaveReport: isAdmin || has('edit:report.maternityLeave'),
			canEditPromotionByDiplomaReport: isAdmin || has('edit:report.promotionDiploma'),
			canEditPromotionByHonorReport: isAdmin || has('edit:report.promotionHonor'),
			canEditPromotionByRotationReport: isAdmin || has('edit:report.promotionRotation'),
			canEditRetirementReport: isAdmin || has('edit:report.retirement'),
			canEditStudyLeaveReport: isAdmin || has('edit:report.studyLeave'),
			canEditTransformationReport: isAdmin || has('edit:report.transformation'),
			canEditUnpaidLeaveReport: isAdmin || has('edit:report.unpaidLeave'),
			canEditOfficialDelistedReport: isAdmin || has('edit:report.officialDelisted'),
			canEditDailyReport: isAdmin || has('edit:report.daily'),
			canEditGroupReport: isAdmin || has('edit:report.group'),
			canEditOfficeHeadReport: isAdmin || has('edit:report.officeHead'),
			canEditSectionHeadReport: isAdmin || has('edit:report.sectionHead'),
			canEditDepartmentReport: isAdmin || has('edit:report.department'),
			canEditHRRoleSummary: isAdmin || has('edit:hr-role-summary'),
			canEditHRSkillSummary: isAdmin || has('edit:hr-skill-summary'),
			canEditHRDisplay: isAdmin || has('edit:hr-display'),
			// Scan Attendance (Specialized)
			canScanQR: isAdmin || has('scan:qr'),
			canScanFace: isAdmin || has('scan:face') || has('face:match'),
			canScanFaceGroup: isAdmin || has('scan:face_group') || has('face:match'),
			// Attendance Groups
			canViewAbsence: isAdmin || has('view:absence'),
			canViewAttendanceReport: isAdmin || has('view:attendance_report'),
			canViewAttendanceDaily: isAdmin || has('view:attendance_daily'),
			canViewAttendanceMonthly: isAdmin || has('view:attendance_monthly'),
			canViewAttendanceSumDayReport: isAdmin || has('view:attendance_sum_day_report'),
			canViewAttendanceDayData: isAdmin || has('view:attendance_day_data'),
			canViewAttendanceMonthlyDataFile: isAdmin || has('view:attendance_monthly_data'),
			canViewAttendanceAudit: isAdmin || has('view:attendance_audit'),
			canViewAttendanceMinistry: isAdmin || has('view:attendance_ministry'),
			canViewDailyReportCheckinme: isAdmin || has('view:attendance_daily_checkinme'),
			canViewEmployeeEvaluation: isAdmin || has('view:employee_evaluation'),
			// User info access
			user: user,
		};
		return p;
	}, [list.join(','), user?.email, JSON.stringify(user?.roles)]);
}
