const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '..', 'src', 'pages', 'ReplayfilePage.jsx');
const s = fs.readFileSync(p, 'utf8');
const idx = parseInt(process.argv[2] || '472', 10);
let line = 1; let col = 1; let i=0;
for (; i<idx && i<s.length; i++){
  if (s[i]==='\n'){ line++; col=1;} else col++; }
console.log('index', idx, '-> line', line, 'col', col);
const lines = s.split('\n');
const start = Math.max(0, line-5);
for (let l=start; l<Math.min(lines.length, line+5); l++){
  console.log((l+1)+':', lines[l]);
}
