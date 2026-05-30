import { Client } from 'ssh2';

const conn = new Client();

const execCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('close', (code, signal) => {
        console.log(`Command finished with code ${code}`);
        if (code !== 0) return reject(new Error(`Exit code ${code}`));
        resolve();
      }).on('data', (data) => {
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
    });
  });
};

conn.on('ready', async () => {
  console.log('Client :: ready');
  try {
    const commands = [
      'cd /var/www/hrms && export NODE_OPTIONS="--max-old-space-size=4096" && npm run build',
      'pm2 restart hrms-backend'
    ];
    
    for (const cmd of commands) {
      await execCommand(cmd);
    }
    
    console.log('Deployment completed successfully!');
  } catch (e) {
    console.error('Deployment failed:', e);
  } finally {
    conn.end();
  }
}).connect({
  host: '152.42.206.243',
  port: 22,
  username: 'root',
  password: 'Long265$KK'
});
