const activeUsers = new Map();

/**
 * Update the last seen timestamp, name and page for a user.
 * @param {string} userId - The ID of the user.
 * @param {string} fullName - The name of the user.
 * @param {string} page - The current page URL/path.
 */
export function trackUser(userId, fullName, page) {
  if (!userId) return;
  activeUsers.set(userId.toString(), {
    name: fullName || 'Unknown',
    lastSeen: Date.now(),
    page: page || ''
  });
}

/**
 * Get the list of active users.
 * @param {number} timeoutMs - Activity timeout in milliseconds.
 * @returns {Array} List of active user objects { id, name, lastSeen, page }.
 */
export function getActiveUsers(timeoutMs = 60000) {
  const now = Date.now();
  const list = [];
  for (const [id, data] of activeUsers.entries()) {
    if (now - data.lastSeen < timeoutMs) {
      list.push({ id, name: data.name, lastSeen: data.lastSeen, page: data.page });
    } else {
      activeUsers.delete(id);
    }
  }
  return list;
}
