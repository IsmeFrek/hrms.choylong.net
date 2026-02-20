import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scansDir = path.join(__dirname, '../public/Uploads/scans');

// Ensure scansDir exists
(async () => {
  try {
    await fs.mkdir(scansDir, { recursive: true });
  } catch (e) {
    console.warn('Could not create scans directory', scansDir, e);
  }
})();

// GET /list - list available scanned files (sorted newest first)
router.get('/list', async (req, res, next) => {
  try {
    const files = await fs.readdir(scansDir);
    const items = [];
    for (const f of files) {
      const stat = await fs.stat(path.join(scansDir, f));
      if (stat.isFile()) items.push({ name: f, mtime: stat.mtimeMs, url: `/kshf_hospital_app/scanner/file/${encodeURIComponent(f)}` });
    }
    items.sort((a,b) => b.mtime - a.mtime);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// GET /file/:name - stream a scanned file by name (sanitized)
// If not present in scansDir, try /public/Uploads and /public/Uploads/scans and redirect to the first existing URL.
router.get('/file/:name', async (req, res, next) => {
  try {
    const name = path.basename(req.params.name || '');
    if (!name) return res.status(400).send('Invalid file name');

    // Candidate filesystem locations (prefer scansDir)
    const candidates = [];
    candidates.push({ fsPath: path.join(scansDir, name), url: null, preferSendFile: true });

    // General uploads dir (served at /Uploads)
    const uploadsDir = path.join(__dirname, '../public/Uploads');
    candidates.push({ fsPath: path.join(uploadsDir, name), url: `/Uploads/${encodeURIComponent(name)}`, preferSendFile: false });

    // Also check uploads/scans for files that might have been saved there
    const uploadsScans = path.join(uploadsDir, 'scans');
    candidates.push({ fsPath: path.join(uploadsScans, name), url: `/Uploads/scans/${encodeURIComponent(name)}`, preferSendFile: false });

    // Try candidates in order
    for (const c of candidates) {
      try {
        await fs.access(c.fsPath);
        // If this is the scansDir path, stream directly to avoid extra redirect
        if (c.preferSendFile) {
          return res.sendFile(c.fsPath);
        }
        // Redirect to the static URL served by express.static
        return res.redirect(302, c.url);
      } catch (e) {
        // not found, try next
      }
    }

    // Not found anywhere — return a small friendly HTML response instead of JSON error
    res.status(404).send(`<!doctype html><html><head><meta charset="utf-8"><title>File not found</title></head><body style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222"><h2>ឯកសារមិនមាន</h2><p>ឈ្មោះឯកសារ: <strong>${name}</strong> មិនមាននៅលើម៉ាស៊ីនមេ។</p></body></html>`);
  } catch (err) {
    next(err);
  }
});

// DELETE /file/:name - delete a scanned file
router.delete('/file/:name', async (req, res, next) => {
  try {
    const name = path.basename(req.params.name);
    const filePath = path.join(scansDir, name);
    // ensure file is inside scansDir
    if (!filePath.startsWith(scansDir)) {
      return res.status(400).json({ error: 'invalid-name' });
    }
    // remove file if exists
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // if file did not exist, return 404
      if (err && err.code === 'ENOENT') return res.status(404).json({ error: 'not-found' });
      throw err;
    }
    return res.json({ success: true, name });
  } catch (err) {
    next(err);
  }
});

// GET /check - detect whether NAPS2 CLI is available on the server (naps2.console.exe)
router.get('/check', (req, res) => {
  try {
    let cmd, args;
    if (process.platform === 'win32') {
      cmd = 'where';
      args = ['naps2.console.exe'];
    } else {
      cmd = 'which';
      args = ['naps2.console.exe'];
    }
    const result = spawnSync(cmd, args, { encoding: 'utf8' });
    const found = result && result.status === 0 && result.stdout && result.stdout.trim().length > 0;
    return res.json({ naps2: !!found });
  } catch (err) {
    console.warn('scanner check failed', err);
    return res.json({ naps2: false });
  }
});

// GET /devices - try to enumerate local scanner devices (Windows WIA)
router.get('/devices', (req, res) => {
  // Only supported on Windows for now
  if (process.platform !== 'win32') return res.json({ devices: [] });

  try {
    // PowerShell snippet to enumerate WIA devices and output JSON
    const ps = `try { $dm = New-Object -ComObject WIA.DeviceManager; $out = @(); foreach($i in $dm.DeviceInfos) { $name = ($i.Properties | Where-Object { $_.Name -eq 'Name' }) ; if ($name) { $n = $name.Value } else { $n = $i.DeviceID }; $out += @{ name = $n; id = $i.DeviceID } } $out | ConvertTo-Json -Depth 3 } catch { Write-Error $_; exit 2 }`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    if (result.error) {
      console.warn('powershell devices spawn failed', result.error);
      return res.status(500).json({ devices: [], error: String(result.error) });
    }
    if (result.status !== 0) {
      // Return empty list but include stderr for diagnostics
      const stderr = result.stderr && result.stderr.toString ? result.stderr.toString() : String(result.stderr || '');
      return res.status(200).json({ devices: [], stderr });
    }
    const stdout = result.stdout && result.stdout.toString ? result.stdout.toString().trim() : '';
    if (!stdout) return res.json({ devices: [] });
    let devices;
    try { devices = JSON.parse(stdout); } catch (err) {
      // If output is a single object, ConvertTo-Json may not produce an array
      try { devices = [JSON.parse(stdout)]; } catch (e) { devices = []; }
    }
    // Normalize to array of { name, id }
    devices = Array.isArray(devices) ? devices.map(d => ({ name: d.name || d.Name || '', id: d.id || d.Id || '' })) : [];
    return res.json({ devices });
  } catch (err) {
    console.warn('failed to list devices', err);
    return res.json({ devices: [] });
  }
});

// POST /file/:name/rename - rename a scanned file safely
router.post('/file/:name/rename', async (req, res, next) => {
  try {
    const oldName = path.basename(req.params.name);
    const newNameRaw = (req.body && req.body.newName) ? String(req.body.newName) : '';
    const newName = path.basename(newNameRaw.trim());
    if (!newName) return res.status(400).json({ error: 'invalid-new-name' });

    const oldPath = path.join(scansDir, oldName);
    const newPath = path.join(scansDir, newName);

    // ensure within scansDir
    if (!oldPath.startsWith(scansDir) || !newPath.startsWith(scansDir)) {
      return res.status(400).json({ error: 'invalid-name' });
    }

    // check old exists
    try {
      await fs.access(oldPath);
    } catch (err) {
      return res.status(404).json({ error: 'not-found' });
    }

    // don't overwrite existing
    try {
      await fs.access(newPath);
      return res.status(409).json({ error: 'target-exists' });
    } catch (e) {
      // newPath does not exist — OK
    }

    await fs.rename(oldPath, newPath);

    const stat = await fs.stat(newPath).catch(() => null);
    const item = stat && stat.isFile() ? { name: newName, mtime: stat.mtimeMs, url: `/kshf_hospital_app/scanner/file/${encodeURIComponent(newName)}` } : null;
    return res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
});

// POST /scan - trigger the PowerShell scan helper on the server
router.post('/scan', async (req, res, next) => {
  try {
    // basic safety: prefer local calls only unless explicitly allowed
    const ip = (req.ip || req.connection?.remoteAddress || '').replace(/^::ffff:/, '');
    const allowedLocal = (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '');
    if (!allowedLocal && !process.env.ALLOW_REMOTE_SCAN) {
      console.warn('Blocked scan request from', ip);
      return res.status(403).json({ error: 'forbidden' });
    }

    const scriptPath = path.join(__dirname, '..', '..', 'scan-to-folder.ps1');
    // ensure script exists
    await fs.access(scriptPath);

    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Format', String(req.body && req.body.format ? req.body.format : 'jpg')];
    const child = spawn('powershell.exe', args, { windowsHide: false });
    let stdout = '';
    let stderr = '';
    if (child.stdout) child.stdout.on('data', (d) => { try { stdout += d.toString(); } catch (e) {} });
    if (child.stderr) child.stderr.on('data', (d) => { try { stderr += d.toString(); } catch (e) {} });

    // wait for process to exit (but guard with timeout)
    const exitCode = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { child.kill(); } catch (e) {}
        resolve(124);
      }, 2 * 60 * 1000); // 2 minutes
      child.on('exit', (code) => { clearTimeout(timeout); resolve(code); });
      child.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });

    // return current scans list after running
    const files = await fs.readdir(scansDir);
    const items = [];
    for (const f of files) {
      const stat = await fs.stat(path.join(scansDir, f)).catch(() => null);
      if (stat && stat.isFile()) items.push({ name: f, mtime: stat.mtimeMs, url: `/kshf_hospital_app/scanner/file/${encodeURIComponent(f)}` });
    }
    items.sort((a,b) => b.mtime - a.mtime);

    return res.json({ success: exitCode === 0, exitCode, stdout, stderr, items });
  } catch (err) {
    next(err);
  }
});

// Server-Sent Events stream for new scans
router.get('/stream', (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let closed = false;

  const sendEvent = (obj) => {
    try {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    } catch (e) {
      // ignore
    }
  };

  // Watch the directory for changes. Prefer chokidar for Windows reliability.
  let watcher;
  try {
    // Try dynamic import of chokidar; if not available, fall back to fs.watch
    (async () => {
      let chokidar;
      try {
        chokidar = await import('chokidar');
      } catch (e) {
        chokidar = null;
      }

      if (chokidar && chokidar.watch) {
        // Use chokidar
        watcher = chokidar.watch(scansDir, { persistent: true, ignoreInitial: true, depth: 0 });
        watcher.on('add', async (filePath) => {
          try {
            const filename = path.basename(filePath);
            const stat = await fs.stat(filePath).catch(() => null);
            if (stat && stat.isFile()) {
              const obj = { name: filename, url: `/kshf_hospital_app/scanner/file/${encodeURIComponent(filename)}`, mtime: stat.mtimeMs };
              sendEvent({ type: 'new-scan', item: obj });
            }
          } catch (err) {
            // ignore
          }
        });
        watcher.on('error', (err) => {
          console.warn('chokidar watcher error', err);
        });
      } else {
        // Fallback to fs.watch
        try {
          watcher = fsSync.watch(scansDir, { persistent: true }, async (eventType, filename) => {
            if (!filename) return;
            try {
              const filePath = path.join(scansDir, filename);
              const stat = await fs.stat(filePath).catch(() => null);
              if (stat && stat.isFile()) {
                const obj = { name: filename, url: `/kshf_hospital_app/scanner/file/${encodeURIComponent(filename)}`, mtime: stat.mtimeMs };
                sendEvent({ type: 'new-scan', item: obj });
              }
            } catch (err) {
              // swallow
            }
          });
        } catch (err) {
          console.warn('Failed to watch scans dir with fs.watch', err);
          sendEvent({ type: 'error', message: 'watch-failed' });
        }
      }
    })();
  } catch (err) {
    console.warn('Failed to setup watcher', err);
    sendEvent({ type: 'error', message: 'watch-failed' });
  }

  // heartbeat to keep connection alive
  const interval = setInterval(() => {
    if (closed) return;
    res.write(': ping\n\n');
  }, 20000);

  req.on('close', () => {
    closed = true;
    try { watcher && watcher.close(); } catch (e) {}
    clearInterval(interval);
  });
});

export default router;
