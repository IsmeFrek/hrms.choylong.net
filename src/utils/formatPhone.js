// Format phone numbers for display: keep leading zeros and show 3-3-3 groups
export function formatPhoneDisplay(raw) {
  if (!raw && raw !== 0) return '';
  const s = String(raw).trim();
  // If contains non-digit formatting, extract digits
  let digits = s.replace(/\D/g, '');
  if (!digits) return '';
  // If user typed 8 digits (missing leading zero), prepend a 0
  if (digits.length === 8) digits = '0' + digits;
  // Limit to reasonable max (e.g., 12)
  digits = digits.slice(0, 12);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)} ${digits.slice(3)}`;
  // 7+ digits: group as 3-3-rest (rest can be 1..)
  return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
}
