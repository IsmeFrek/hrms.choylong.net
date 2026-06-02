import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('find / -name "*kshf_hospital_app*" -o -name "*backup*" | grep -iE "(bson|gz|zip|archive|dump|tar)" 2>/dev/null', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('Search finished:\n', out);
      conn.end();
    }).on('data', (data) => {
      out += data;
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '152.42.206.243',
  port: 22,
  username: 'root',
  password: 'Long265$KK'
});
