import { formatPhoneDisplay } from '../src/utils/formatPhone.js';
const cases = ['93301221','093301221','0933012211','933012211','78997978'];
cases.forEach(s => console.log(`${s} -> ${formatPhoneDisplay(s)}`));
