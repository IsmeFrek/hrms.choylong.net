import AuditLog from '../models/AuditLog.js';

/**
 * Record a user action in the audit log.
 * @param {Object} params
 * @param {string} params.userId - The ID of the user performing the action.
 * @param {string} params.userName - The name of the user.
 * @param {string} params.action - The type of action (CREATE, UPDATE, DELETE, etc.)
 * @param {string} params.resource - The entity being affected (Employee, User, etc.)
 * @param {string} params.details - A human-readable description of the action.
 * @param {Object} [params.metadata] - Optional technical details.
 * @param {string} [params.ip] - The IP address of the user.
 */
export async function recordLog({ userId, userName, action, resource, details, metadata, ip }) {
  try {
    console.log('[AuditService] Recording log:', { action, resource, userId: String(userId) });
    const log = await AuditLog.create({
      userId,
      userName,
      action,
      resource,
      details,
      metadata,
      ip,
      timestamp: new Date()
    });
    console.log('[AuditService] Log created with ID:', log._id);
  } catch (err) {
    console.error('[AuditService] Failed to record log:', err);
  }
}
