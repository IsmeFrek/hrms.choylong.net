const f = require('../src/utils/formatPhone').formatPhoneDisplay;
const cases = ['93301221','093301221','0933012211','933012211','78997978'];
cases.forEach(s => console.log(`${s} -> ${f(s)}`));
