// Khmer digit mapping
const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
const ARABIC_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Convert Khmer digits to Arabic digits
 * @param {string|number} input - Input with Khmer digits
 * @returns {string} Output with Arabic digits
 */
export function khmerToArabic(input) {
  if (!input) return '';
  let result = String(input);
  KHMER_DIGITS.forEach((khmer, index) => {
    result = result.replace(new RegExp(khmer, 'g'), ARABIC_DIGITS[index]);
  });
  return result;
}

/**
 * Convert Arabic digits to Khmer digits
 * @param {string|number} input - Input with Arabic digits
 * @returns {string} Output with Khmer digits
 */
export function arabicToKhmer(input) {
  if (!input && input !== 0) return '';
  let result = String(input);
  ARABIC_DIGITS.forEach((arabic, index) => {
    result = result.replace(new RegExp(arabic, 'g'), KHMER_DIGITS[index]);
  });
  return result;
}

/**
 * Parse number from input that may contain Khmer or Arabic digits
 * @param {string|number} input - Input that may contain Khmer digits
 * @returns {number|null} Parsed number or null if invalid
 */
export function parseNumber(input) {
  if (!input && input !== 0) return null;
  const normalized = khmerToArabic(String(input));
  const num = parseInt(normalized, 10);
  return Number.isNaN(num) ? null : num;
}
