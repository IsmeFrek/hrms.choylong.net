const fs = require('fs');
const s = fs.readFileSync('d:/DB/web_V4/src/pages/ReplayfilePage.jsx','utf8');
const counts = { '(':0, ')':0, '{':0, '}':0, '[':0, ']':0 };
for (const ch of s) { if (counts.hasOwnProperty(ch)) counts[ch]++; }
console.log('counts', counts);
const lines = s.split('\n');
for (let i=Math.max(0, lines.length-120); i<lines.length; i++) console.log((i+1).toString().padStart(4)+': '+lines[i]);
