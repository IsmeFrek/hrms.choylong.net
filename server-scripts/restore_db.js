import { Client } from 'ssh2';
import fs from 'fs';

const conn = new Client();
const localZip = 'E:\\db_dump.zip';
const remoteZip = '/tmp/db_dump.zip';

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

conn.on('ready', () => {
  console.log('Client :: ready');
  console.log('Starting SFTP upload...');
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err);
      return conn.end();
    }
    
    // Upload the file
    sftp.fastPut(localZip, remoteZip, async (uploadErr) => {
      if (uploadErr) {
        console.error('Upload failed:', uploadErr);
        conn.end();
        return;
      }
      console.log('Upload successful! Starting restore process...');
      
      try {
        await execCommand('apt-get update && apt-get install -y unzip');
        await execCommand('rm -rf /tmp/db_dump && mkdir -p /tmp/db_dump');
        await execCommand('unzip -o /tmp/db_dump.zip -d /tmp/db_dump');
        await execCommand('mongorestore --drop --db kshf_hospital_app /tmp/db_dump');
        await execCommand('rm -rf /tmp/db_dump /tmp/db_dump.zip');
        console.log('Database restored successfully!');
      } catch (e) {
        console.error('Database restore failed:', e);
      } finally {
        conn.end();
      }
    });
  });
}).connect({
  host: '152.42.206.243',
  port: 22,
  username: 'root',
  password: 'Long265$KK'
});
