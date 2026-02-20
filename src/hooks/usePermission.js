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
	return useMemo(() => ({
		list,
		has,
		any,
		all,
		// page-specific
		canViewEmployees: has('view:employees'),
		canEditEmployees: has('edit:employees'),
		canViewHR: has('view:hr'),
		canEditHR: has('edit:hr'),
		canPrintHR: has('print:hr'),
		canApproveHR: has('approve:hr'),
		canViewDepartments: has('view:departments'),
		canEditDepartments: has('edit:departments'),
		canViewPositions: has('view:positions'),
		canEditPositions: has('edit:positions'),
		canViewSkills: has('view:skills'),
		canEditSkills: has('edit:skills'),
		canViewSetup: has('view:setup'),
		canViewDocuments: has('view:documents'),
		canEditDocuments: has('edit:documents'),
		// SignSchemas (Signatures)
		canViewSignSchemas: has('view:signSchemas'),
		canCreateSignSchemas: has('create:signSchemas'),
		canEditSignSchemas: has('edit:signSchemas'),
		canDeleteSignSchemas: has('delete:signSchemas'),
		canManageSignSchemas: any('create:signSchemas', 'edit:signSchemas', 'delete:signSchemas'),
		// FileTransfer specific permissions
		canViewFileTransfers: has('view:fileTransfers'),
		canEditFileTransfers: has('edit:fileTransfers'),
		canViewFiles: has('view:files'),
		canEditFiles: has('edit:files'),
		canManageUsers: has('manage:users'),
		canManageRoles: has('manage:roles'),
		// page-level view perms
		canViewEmployeeReport: has('view:report.employee'),
		canViewMaternityLeaveReport: has('view:report.maternityLeave'),
		canViewPromotionByDiplomaReport: has('view:report.promotionDiploma'),
		canViewPromotionByHonorReport: has('view:report.promotionHonor'),
		canViewPromotionByRotationReport: has('view:report.promotionRotation'),
		canViewRetirementReport: has('view:report.retirement'),
		canViewStudyLeaveReport: has('view:report.studyLeave'),
		canViewTransformationReport: has('view:report.transformation'),
		canViewUnpaidLeaveReport: has('view:report.unpaidLeave'),
		canViewOfficialDelistedReport: has('view:report.officialDelisted'),
		canViewAttendanceMonthlyReport: has('view:report.attendanceMonthly'),
		canViewAttendanceMonthlyData: has('view:report.attendanceMonthlyData'),
		canViewMyHr: has('view:my-hr'),
		canViewSelfService: has('view:selfservice'),
		canViewAttendance: has('view:attendance'),
		// Face attendance (legacy pages)
		canFaceEnroll: has('face:enroll'),
		canFaceMatch: any('face:match', 'view:attendance'),
		canFaceDelete: has('face:delete'),
		canViewSettings: has('view:settings'),
		canViewRoles: has('view:roles'),
		// Letter editing permissions by stage (simplified to 4 stages)
		canEditLettersOfficeHead: has('edit:letters.officeHead'),
		canEditLettersDeputy: has('edit:letters.deputy'),
		canEditLettersDirector: has('edit:letters.director'),
		canEditLettersApproved: has('edit:letters.approved'),
		canSendTelegram: has('send:feedback') || has('send:telegram'),
		// User info access
		user: user,
	}), [list.join(',')]);
}
