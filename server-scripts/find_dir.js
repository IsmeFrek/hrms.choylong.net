import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      try {
        const apps = JSON.parse(out);
        apps.forEach(app => console.log(app.name, app.pm2_env.pm_cwd));
      } catch (e) {
        console.log('Not valid JSON pm2 output:', out);
      }
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
