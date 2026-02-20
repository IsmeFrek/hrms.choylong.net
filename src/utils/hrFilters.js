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
  const s = (emp.status || '').toString();
  if (s === 'Resigned' || s === 'Deleted' || s === 'resigned' || s === 'deleted') return false;
  const hasResign = hasResignData(emp);
  const hasExplicitRemoval = isExplicitlyRemoved(emp);
  const prepared = isPreparedForDeletion(emp) && !hasExplicitRemoval;
  if (hasResign && !prepared) return false;
  return true;
};

export default { isExplicitlyRemoved, hasResignData, isPreparedForDeletion, isCountedActive };
