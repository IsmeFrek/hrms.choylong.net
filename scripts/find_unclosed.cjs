const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '..', 'src', 'pages', 'ReplayfilePage.jsx');
const s = fs.readFileSync(p, 'utf8');
let stack = [];
for (let i=0;i<s.length;i++){
  const ch = s[i];
  if (ch === '{') stack.push(i);
  if (ch === '}') stack.pop();
}
if (stack.length === 0) {
  console.log('No unclosed { found');
} else {
  console.log('Unclosed { count', stack.length);
  const idx = stack[stack.length-1];
  console.log('Last unclosed { at', idx);
  console.log('Context:\n', s.slice(Math.max(0, idx-120), Math.min(s.length, idx+120)));
}
