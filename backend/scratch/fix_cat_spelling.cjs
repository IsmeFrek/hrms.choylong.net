const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetLine = "if (cLower.includes('ក្របខណ្ឌ') || cLower.includes('ក្របខ័ណ្ឌ') || cLower.includes('មន្ត្រីរាជការ') || cLower.includes('civil')) category = 'មន្ត្រីរាជការ';";
const replacementLine = "if (cLower.includes('ក្របខណ្ឌ') || cLower.includes('ក្របខ័ណ្ឌ') || cLower.includes('មន្ត្រីរាជការ') || cLower.includes('មន្រ្តីរាជការ') || cLower.includes('civil')) category = 'មន្ត្រីរាជការ';";

if (content.includes(targetLine)) {
    content = content.replace(targetLine, replacementLine);
    fs.writeFileSync(path, content);
    console.log('Backend Category Normalization Updated (Civil Servant spelling variations)!');
} else {
    console.log('Target line not found in attendance.js');
}
