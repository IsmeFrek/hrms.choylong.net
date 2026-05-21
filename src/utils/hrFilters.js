// Reusable HR filtering helpers to keep reports consistent
export const isExplicitlyRemoved = (emp) => {
  try {
    const del = emp && emp.delisted ? emp.delisted : {};
    return Boolean(emp.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || emp.dateRemovedFromDataset || emp.removalDate);
  } catch (e) { return false; }
};

export const hasResignData = (emp) => {
  try {
    return Boolean(emp && (
      emp.resignDate || emp.resignReason || emp.resignDocument || emp.resignationDate || emp.resignationReason
      || emp.dateRemoved || emp.dateRemovedFromDataset || emp.removalDate || (emp.delisted && (emp.delisted.dateRemoved || emp.delisted.date_removed))
    ));
  } catch (e) { return false; }
};

export const isPreparedForDeletion = (emp) => {
  try {
    return Boolean(emp && emp.__isPreparedForDeletion);
  } catch (e) { return false; }
};

// Active inclusion rule used across UI: include unless status indicates resigned/deleted
// or the record has resign/removal data that is not prepared-for-deletion.
export const isCountedActive = (emp) => {
  if (!emp) return false;

  const parseDateSafe = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const resDate = parseDateSafe(emp.resignDate || emp.resignationDate || emp.dateRemoved);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If resignation date is in the future, they are still considered active regardless of status string
  if (resDate && resDate > today) return true;

  const s = (emp.status || '').toString().toLowerCase();
  if (s === 'resigned' || s === 'deleted' || s === 'inactive') return false;
  const hasResign = hasResignData(emp);
  const hasExplicitRemoval = isExplicitlyRemoved(emp);
  const prepared = isPreparedForDeletion(emp) && !hasExplicitRemoval;
  if (hasResign && !prepared) return false;
  return true;
};

export default { isExplicitlyRemoved, hasResignData, isPreparedForDeletion, isCountedActive };
