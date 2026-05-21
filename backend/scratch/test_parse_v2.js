
function cleanTimeStr(t) {
  if (!t) return '';
  const lines = String(t).split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return '';
  const firstLine = lines[0];
  const m = firstLine.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  return m ? m[1].trim() : (firstLine.length < 15 ? firstLine.trim() : '');
}

function extractTimeFlags(t) {
  if (!t) return { isLate: false, isEarly: false };
  const low = String(t).toLowerCase();
  const isLate = low.includes('late') || low.includes('យឺត');
  const isEarly = low.includes('early') || low.includes('មុន');
  return { isLate, isEarly };
}

function cleanNameStr(n) {
  if (!n) return '';
  const lines = String(n).split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
  return lines[0] || '';
}

// Simulated data with Leave info
// No | ID | Name | In | Out | In2 | Out2 | Note | Type | Reason
const sampleRow = "1\tW0078\tស៊ឹម ដួងពិសី\nចុងភៅ\t--\t--\t--\t--\tNote 123\tច្បាប់ឈប់ប្រចាំឆ្នាំ\tឈឺក្បាល";
const cols = sampleRow.split('\t');

const headers = { no: 0, staffId: 1, name: 2, in1: 3, out1: 4, in2: 5, out2: 6, note: 7, type: 8, reason: 9 };

const in1 = cleanTimeStr(cols[headers.in1]);
const out1 = cleanTimeStr(cols[headers.out1]);
const reqType = cols[headers.type]?.trim();
const reqReason = cols[headers.reason]?.trim();

console.log("Name:", cleanNameStr(cols[headers.name]));
console.log("Status:", (!in1 && !out1 && (reqType || reqReason)) ? 'leave' : 'present');
console.log("Leave Type:", reqType);
console.log("Leave Reason:", reqReason);
