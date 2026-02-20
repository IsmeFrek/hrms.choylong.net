const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '..', 'src', 'pages', 'ReplayfilePage.jsx');
const s = fs.readFileSync(p, 'utf8');
let counts = { '(':0, ')':0, '{':0, '}':0, '[':0, ']':0 };
for (let i=0;i<s.length;i++){
  const c=s[i];
  if (counts[c] !== undefined) counts[c]++;
}
console.log('counts', counts);

let cpar=0,cbrace=0,cbrack=0;
for (let i=0;i<s.length;i++){
  const ch=s[i];
  if (ch==='(') cpar++;
  if (ch===')') cpar--;
  if (ch==='{' ) cbrace++;
  if (ch==='}') cbrace--;
  if (ch==='[') cbrack++;
  if (ch===']') cbrack--;
  if (cpar<0 || cbrace<0 || cbrack<0){
    console.log('unbalanced at', i, 'char', ch, 'context', s.slice(Math.max(0,i-40), i+40));
    break;
  }
}

if (cpar!==0 || cbrace!==0 || cbrack!==0){
  console.log('final unbalanced: par, brace, brack', cpar, cbrace, cbrack);
} else {
  console.log('All balanced.');
}
