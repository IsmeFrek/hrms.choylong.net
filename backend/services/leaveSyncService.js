import { scrapeCheckinmeLeaves } from './checkinmeService.js';
import LeaveRequest from '../models/LeaveRequest.js';
import HR from '../models/HR.js';

/**
 * Automatically sync leaves from Checkinme for the current year
 */
export async function autoSyncLeaves() {
  try {
    const currentYear = new Date().getFullYear();
    const fromDate = `${currentYear}-01-01`;
    const toDate = `${currentYear}-12-31`;

    console.log(`[AutoSyncLeaves] Scraping leaves from ${fromDate} to ${toDate}...`);
    
    // Scrape from Checkinme
    const scrapedItems = await scrapeCheckinmeLeaves({ fromDate, toDate });
    console.log(`[AutoSyncLeaves] Found ${scrapedItems.length} items on Checkinme.`);

    if (scrapedItems.length === 0) return 0;

    // Build map of HR records for faster lookup
    const hrList = await HR.find({}, 'staffId khmerName name').lean();
    const hrMap = new Map();
    hrList.forEach(h => {
      if (h.staffId) hrMap.set(String(h.staffId), h);
      if (h.khmerName) hrMap.set(h.khmerName.replace(/\s+/g, ''), h);
      if (h.name) hrMap.set(h.name.replace(/\s+/g, ''), h);
    });

    let syncedCount = 0;
    for (const item of scrapedItems) {
      if (!item.checkinmeId) continue;

      // Try to find local HR if staffId is missing from scrape but name is present
      let staffId = item.staffId;
      if (!staffId && item.name) {
        const cleanName = item.name.replace(/\s+/g, '');
        const hr = hrMap.get(cleanName);
        if (hr) staffId = hr.staffId;
      }

      // Find existing leave by checkinmeId
      let leave = await LeaveRequest.findOne({ checkinmeId: item.checkinmeId });

      const leaveData = {
        checkinmeId: item.checkinmeId,
        staffId: staffId || item.staffId,
        staffName: item.name,
        type: item.type,
        startDate: item.startDate ? new Date(item.startDate) : null,
        endDate: item.endDate ? new Date(item.endDate) : null,
        duration: item.amount,
        reason: item.reason,
        status: item.status?.toLowerCase() || 'pending',
        comment: item.comment,
        manager: item.manager,
        department: item.department,
        syncSource: 'checkinme'
      };

      if (leave) {
        // Update existing
        await LeaveRequest.updateOne({ _id: leave._id }, { $set: leaveData });
      } else {
        // Create new
        await LeaveRequest.create(leaveData);
      }
      syncedCount++;
    }

    console.log(`[AutoSyncLeaves] Successfully synced ${syncedCount} leave requests.`);
    return syncedCount;
  } catch (err) {
    console.error('[AutoSyncLeaves] Failed:', err.message);
    throw err;
  }
}
