(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    video: $('video'),
    overlay: $('overlay'),
    scanToggle: $('scanToggle'),
    stop: $('stop'),
    mode: $('mode'),
    date: $('date'),
    threshold: $('threshold'),
    support: $('support'),
    scanCount: $('scanCount'),
    scanList: $('scanList'),
    status: $('status'),
  };

  let stream = null;
  let modelsReady = false;
  let isScanning = false;
  let scanInterval = null;
  
  // Track recently matched staff IDs to avoid duplicate check-ins in the same session
  // Key: staffId, Value: lastMatchTime (timestamp)
  const sessionMatches = new Map();
  const MATCH_COOLDOWN = 10000; // 10 seconds cooldown between scans for the same person

  const MODELS_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

  function getAuthToken() {
    try {
      const raw = localStorage.getItem('auth');
      if (!raw) return null;
      const a = JSON.parse(raw);
      return a && a.token ? String(a.token) : null;
    } catch { return null; }
  }

  function authHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const nowHM = () => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  function setBadge(text, kind) {
    els.support.textContent = text;
    els.support.classList.remove('ok', 'warn', 'err');
    if (kind) els.support.classList.add(kind);
  }

  function setStatus(text) {
    els.status.textContent = String(text || '');
  }

  async function loadModels() {
    try {
      setBadge('កំពុងទាញ face models...', 'warn');
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
      modelsReady = true;
      setBadge('Face models ready ✅', 'ok');
      els.scanToggle.disabled = !stream;
    } catch (e) {
      setBadge('ទាញ models មិនបាន', 'err');
      setStatus(String(e && (e.stack || e.message) || e));
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser មិនគាំទ្រ camera API');

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    els.video.srcObject = stream;
    
    // Resize overlay canvas to match video
    els.video.onloadedmetadata = () => {
       const { videoWidth, videoHeight } = els.video;
       els.overlay.width = videoWidth;
       els.overlay.height = videoHeight;
    };

    els.stop.disabled = false;
    els.scanToggle.disabled = !modelsReady;
    setStatus('');
  }

  function stopCamera() {
    stopScanning();
    try { els.video.srcObject = null; } catch {}
    if (stream) {
      for (const t of stream.getTracks()) {
        try { t.stop(); } catch {}
      }
    }
    stream = null;
    els.stop.disabled = true;
    els.scanToggle.disabled = true;
    els.scanToggle.textContent = 'ចាប់ផ្តើមស្កេនជាក្រុម';
    els.scanToggle.classList.remove('secondary');
    els.scanToggle.classList.add('primary');
  }

  function startScanning() {
    if (!modelsReady || !stream) return;
    isScanning = true;
    els.scanToggle.textContent = 'ឈប់ស្កេន';
    els.scanToggle.classList.remove('primary');
    els.scanToggle.classList.add('secondary');
    
    scanInterval = setInterval(async () => {
      if (!isScanning) return;
      await performGroupScan();
    }, 800); // Scan every 800ms
  }

  function stopScanning() {
    isScanning = false;
    if (scanInterval) clearInterval(scanInterval);
    scanInterval = null;
    els.scanToggle.textContent = 'ចាប់ផ្តើមស្កេនជាក្រុម';
    els.scanToggle.classList.remove('secondary');
    els.scanToggle.classList.add('primary');
    
    // Clear overlay
    const ctx = els.overlay.getContext('2d');
    ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
    els.scanCount.textContent = 'Detecting: 0';
  }

  async function performGroupScan() {
    const displaySize = { width: els.video.videoWidth, height: els.video.videoHeight };
    
    // Detect all faces
    const detections = await faceapi
      .detectAllFaces(els.video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    els.scanCount.textContent = `Detecting: ${detections.length}`;

    const ctx = els.overlay.getContext('2d');
    ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);

    if (detections.length === 0) return;

    // Draw bounding boxes
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    faceapi.draw.drawDetections(els.overlay, resizedDetections);

    const thr = parseFloat(els.threshold.value) || 0.52;

    for (const detection of detections) {
      const descriptor = Array.from(detection.descriptor);
      
      try {
        // Call match API for this face
        const r = await fetch('/api/face/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ descriptor, threshold: thr })
        });
        
        const data = await r.json().catch(() => ({}));
        if (data.matched) {
          const staffId = data.staffId;
          const now = Date.now();
          
          // Check cooldown
          if (!sessionMatches.has(staffId) || (now - sessionMatches.get(staffId) > MATCH_COOLDOWN)) {
            sessionMatches.set(staffId, now);
            await recordMatchedAttendance(data);
          }
        }
      } catch (err) {
        console.error('Match error:', err);
      }
    }
  }

  async function recordMatchedAttendance(matchData) {
    const staffId = matchData.staffId;
    const fullName = matchData.fullName || 'Unknown';
    const mode = els.mode.value;
    const dateIso = todayISO();
    const hm = nowHM();

    const meta = {
        fullName,
        scanMode: mode,
        scanSource: 'face_scan_group',
        matchDistance: matchData.distance,
        threshold: matchData.threshold,
        userAgent: navigator.userAgent,
    };

    try {
        // Add to success list immediately with "Saving..." status
        const rowId = `row-${staffId}-${Date.now()}`;
        const row = document.createElement('tr');
        row.id = rowId;
        row.innerHTML = `
            <td>
                <div class="font-bold">${fullName}</div>
                <div class="mono text-xs text-gray-500">${staffId}</div>
            </td>
            <td class="text-center mono">${hm}</td>
            <td class="text-right text-xs status-wait">Saving...</td>
        `;
        els.scanList.prepend(row);

        // Record attendance
        const r = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
                staffId,
                date: dateIso,
                [mode]: hm,
                notes: JSON.stringify({ faceEvents: [{ at: new Date().toISOString(), ...meta }] })
            })
        });

        const resData = await r.json();
        
        // Update status in tool row
        const statusEl = row.querySelector('.status-wait');
        if (r.ok) {
            statusEl.textContent = 'Success ✅';
            statusEl.classList.remove('status-wait');
            statusEl.classList.add('status-ok');
        } else {
            statusEl.textContent = 'Failed ❌';
            statusEl.classList.remove('status-wait');
            statusEl.classList.add('err');
            console.error('Save failed:', resData);
        }
    } catch (err) {
        console.error('Attendance save error:', err);
    }
  }

  // Event Listeners
  els.scanToggle.addEventListener('click', async () => {
    try {
      if (!stream) {
        await startCamera();
      }
      if (isScanning) {
        stopScanning();
      } else {
        startScanning();
      }
    } catch (e) {
      setStatus(`កើតបញ្ហា៖ ${e.message || e}`);
    }
  });

  els.stop.addEventListener('click', () => stopCamera());

  // Init
  els.date.value = todayISO();
  loadModels();
})();
