
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

// Simulated data from user request
const sampleRow = "1\tW0078\tស៊ឹម ដួងពិសី\nចុងភៅ\t07:22 AM\nLate\t05:30 PM\nEarly\t\t\tNote 123";
const cols = sampleRow.split('\t');

console.log("Cols:", cols);

const headers = { no: 0, staffId: 1, name: 2, in1: 3, out1: 4, in2: 5, out2: 6, note: 7 };

const checkinCell = cols[headers.in1] || '';
const checkoutCell = cols[headers.out1] || '';

console.log("Checkin Cell:", JSON.stringify(checkinCell));
console.log("Checkout Cell:", JSON.stringify(checkoutCell));

const in1 = cleanTimeStr(checkinCell);
const out1 = cleanTimeStr(checkoutCell);
const in1Flags = extractTimeFlags(checkinCell);
const out1Flags = extractTimeFlags(checkoutCell);

console.log("Name:", cleanNameStr(cols[headers.name]));
console.log("In1:", in1, "Late:", in1Flags.isLate);
console.log("Out1:", out1, "Early:", out1Flags.isEarly);
