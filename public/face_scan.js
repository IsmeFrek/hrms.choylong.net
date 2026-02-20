(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    video: $('video'),
    start: $('start'),
    scan: $('scan'),
    save: $('save'),
    stop: $('stop'),
    mode: $('mode'),
    date: $('date'),
    time: $('time'),
    threshold: $('threshold'),
    staffId: $('staffId'),
    fullName: $('fullName'),
    support: $('support'),
    result: $('result'),
  };

  let stream = null;
  let modelsReady = false;
  let lastMatch = null;

  const MODELS_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

  function getAuthToken(){
    try{
      const raw = localStorage.getItem('auth');
      if (!raw) return null;
      const a = JSON.parse(raw);
      return a && a.token ? String(a.token) : null;
    }catch{ return null; }
  }

  function authHeaders(){
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

  function setResult(text) {
    els.result.textContent = String(text || '');
  }

  async function loadModels() {
    try {
      setBadge('កំពុងទាញ face models...', 'warn');
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
      modelsReady = true;
      setBadge('Face models ready ✅', 'ok');
      els.scan.disabled = !stream;
    } catch (e) {
      setBadge('ទាញ models មិនបាន', 'err');
      setResult(String(e && (e.stack || e.message) || e));
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser មិនគាំទ្រ camera API');

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    els.video.srcObject = stream;

    els.start.disabled = true;
    els.stop.disabled = false;
    els.scan.disabled = !modelsReady;

    setResult('');
  }

  function stopCamera() {
    try { els.video.srcObject = null; } catch {}
    if (stream) {
      for (const t of stream.getTracks()) {
        try { t.stop(); } catch {}
      }
    }
    stream = null;

    els.start.disabled = false;
    els.stop.disabled = true;
    els.scan.disabled = true;
  }

  function toDescriptorArray(desc) {
    return Array.from(desc, (x) => Number(x));
  }

  async function doMatch() {
    if (!modelsReady) throw new Error('Models មិនទាន់ ready');
    const token = getAuthToken();
    if (!token) throw new Error('សូម Login ជាមុន (token មិនមាន)');

    setResult('កំពុងស្វែងរកមុខ...');

    const detection = await faceapi
      .detectSingleFace(els.video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) throw new Error('រកមុខមិនឃើញ (សូមពន្លឺល្អ និងមុខត្រង់)');

    const descriptor = toDescriptorArray(detection.descriptor);

    const thr = (() => {
      const v = String(els.threshold.value || '').trim();
      if (!v) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    })();

    setResult('កំពុង match...');

    const r = await fetch('/api/face/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ descriptor, threshold: thr })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Match failed: ${r.status}`);

    lastMatch = data;

    if (!data.matched) {
      els.staffId.value = '';
      els.fullName.value = '';
      els.save.disabled = true;
      setResult(`មិន match ❌\nBestDistance: ${data.distance?.toFixed?.(4) ?? data.distance ?? ''}\nThreshold: ${data.threshold}`);
      return;
    }

    els.staffId.value = data.staffId || '';
    els.fullName.value = data.fullName || '';
    els.save.disabled = false;

    setResult(`Match ✅\nStaff: ${data.staffId}\nName: ${data.fullName || ''}\nDistance: ${Number(data.distance).toFixed(4)}\nThreshold: ${data.threshold}`);
  }

  async function getExistingRecord(staffId, dateIso) {
    const url = `/api/attendance?staffId=${encodeURIComponent(staffId)}&date=${encodeURIComponent(dateIso)}`;
    const r = await fetch(url, { headers: { ...authHeaders() } });
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  }

  function safeNotesMerge(existingNotes, newMeta) {
    const base = (() => {
      if (!existingNotes) return {};
      if (typeof existingNotes === 'object') return existingNotes;
      try { return JSON.parse(existingNotes); } catch { return { notes: String(existingNotes) }; }
    })();

    const merged = { ...base };
    const events = Array.isArray(base.faceEvents) ? base.faceEvents.slice(0) : [];
    events.push({ at: new Date().toISOString(), ...newMeta });
    merged.faceEvents = events.slice(-20);
    if (newMeta.fullName && !merged.fullName) merged.fullName = newMeta.fullName;
    return JSON.stringify(merged);
  }

  async function saveAttendance() {
    const staffId = String(els.staffId.value || '').trim();
    const fullName = String(els.fullName.value || '').trim();
    const dateIso = String(els.date.value || '').trim();
    const hm = String(els.time.value || '').trim();
    const mode = els.mode.value;

    if (!staffId) throw new Error('មិនទាន់មាន staffId (សូម match មុន)');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) throw new Error('កាលបរិច្ឆេទមិនត្រឹមត្រូវ (YYYY-MM-DD)');
    if (!/^\d{2}:\d{2}$/.test(hm)) throw new Error('ម៉ោងមិនត្រឹមត្រូវ (HH:MM)');

    const meta = {
      fullName,
      scanMode: mode,
      scanSource: 'face_scan',
      matchDistance: lastMatch?.distance,
      threshold: lastMatch?.threshold,
      userAgent: navigator.userAgent,
    };

    setResult('កំពុងរក្សាទុកវត្តមាន...');

    const existing = await getExistingRecord(staffId, dateIso);
    const existingRec = existing[0];

    if (existingRec && (existingRec._id || existingRec.id)) {
      const id = existingRec._id || existingRec.id;
      const updates = {};
      if (mode === 'checkIn') updates.checkIn = hm;
      if (mode === 'checkOut') updates.checkOut = hm;
      updates.notes = safeNotesMerge(existingRec.notes, meta);

      const r = await fetch(`/api/attendance/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(updates)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || `Update failed: ${r.status}`);

      setResult(`បានអាប់ដេតវត្តមាន ✅\nID: ${id}\nStaff: ${staffId}\nDate: ${dateIso}\n${mode}: ${hm}`);
      return;
    }

    const payload = {
      staffId,
      date: dateIso,
      notes: safeNotesMerge(null, meta),
    };
    if (mode === 'checkIn') payload.checkIn = hm;
    if (mode === 'checkOut') payload.checkOut = hm;

    const r = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Create failed: ${r.status}`);

    setResult(`បានរក្សាទុកវត្តមាន ✅\nID: ${data._id || data.id || ''}\nStaff: ${staffId}\nDate: ${dateIso}\n${mode}: ${hm}`);
  }

  // events
  els.start.addEventListener('click', () => startCamera().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`)));
  els.stop.addEventListener('click', () => stopCamera());
  els.scan.addEventListener('click', () => doMatch().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`)));
  els.save.addEventListener('click', () => saveAttendance().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`)));

  // defaults
  els.date.value = todayISO();
  els.time.value = nowHM();
  els.threshold.value = '0.52';

  loadModels();
})();
