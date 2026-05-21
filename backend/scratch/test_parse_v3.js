
function cleanTimeStr(t) {
  if (!t) return '';
  const lines = String(t).split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return '';
  const firstLine = lines[0];
  if (firstLine === '--' || firstLine === '...' || firstLine === '—') return '';
  const m = firstLine.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  return m ? m[1].trim() : (firstLine.length < 15 ? firstLine.trim() : '');
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

const hasTimes = !!(in1 || out1);

console.log("Name:", "ស៊ឹម ដួងពិសី");
console.log("In1:", JSON.stringify(in1));
console.log("Out1:", JSON.stringify(out1));
console.log("Has Times:", hasTimes);
console.log("Status:", (!hasTimes && (reqType || reqReason)) ? 'leave' : 'present');
console.log("Leave Type:", reqType);
console.log("Leave Reason:", reqReason);
