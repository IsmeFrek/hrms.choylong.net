const s1 = '​S1452';
const s2 = 'S1452';

console.log('s1:', s1);
for(let i=0; i<s1.length; i++) {
  console.log('s1 char', i, ':', s1.charCodeAt(i).toString(16), s1[i]);
}

console.log('s2:', s2);
for(let i=0; i<s2.length; i++) {
  console.log('s2 char', i, ':', s2.charCodeAt(i).toString(16), s2[i]);
}
