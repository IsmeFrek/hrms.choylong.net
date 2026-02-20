(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    video: $('video'),
    start: $('start'),
    capture: $('capture'),
    stop: $('stop'),
    staffId: $('staffId'),
    fullName: $('fullName'),
    consent: $('consent'),
    deleteBtn: $('delete'),
    support: $('support'),
    result: $('result'),
  };

  let stream = null;
  let track = null;
  let modelsReady = false;

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
    track = stream.getVideoTracks()[0] || null;
    els.video.srcObject = stream;

    els.start.disabled = true;
    els.stop.disabled = false;
    els.capture.disabled = !modelsReady;

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
    track = null;

    els.start.disabled = false;
    els.stop.disabled = true;
    els.capture.disabled = true;
  }

  function toDescriptorArray(desc) {
    // Float32Array -> number[]
    return Array.from(desc, (x) => Number(x));
  }

  async function captureAndEnroll() {
    const staffId = String(els.staffId.value || '').trim();
    const fullName = String(els.fullName.value || '').trim();
    const token = getAuthToken();
    if (!token) throw new Error('សូម Login ជាមុន (token មិនមាន)');
    if (!staffId) throw new Error('សូមបញ្ចូល Staff ID');
    if (!els.consent.checked) throw new Error('សូមធីក Consent មុន');
    if (!modelsReady) throw new Error('Models មិនទាន់ ready');

    setResult('កំពុងស្វែងរកមុខ...');

    const detection = await faceapi
      .detectSingleFace(els.video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) throw new Error('រកមុខមិនឃើញ (សូមពន្លឺល្អ និងមុខត្រង់)');

    const descriptor = toDescriptorArray(detection.descriptor);

    const consentText = 'I consent to store my face template/embedding for attendance identification and understand it can be deleted.';

    setResult('កំពុង Enroll...');

    const r = await fetch('/api/face/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ staffId, fullName, descriptor, consent: true, consentText })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Enroll failed: ${r.status}`);

    setResult(`Enroll រួច ✅\nStaff: ${data.staffId}\nName: ${data.fullName || ''}\nDescriptors: ${data.descriptorsCount}`);
  }

  async function deleteProfile() {
    const staffId = String(els.staffId.value || '').trim();
    const token = getAuthToken();
    if (!token) throw new Error('សូម Login ជាមុន (token មិនមាន)');
    if (!staffId) throw new Error('សូមបញ្ចូល Staff ID ដើម្បីលុប');
    const ok = confirm(`ចង់លុប Face Profile សម្រាប់ ${staffId} មែនទេ?`);
    if (!ok) return;

    setResult('កំពុងលុប...');
    const r = await fetch(`/api/face/staff/${encodeURIComponent(staffId)}`, { method: 'DELETE', headers: { ...authHeaders() } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Delete failed: ${r.status}`);

    setResult(`លុបរួច ✅\nDeleted: ${data.deleted || 0}`);
  }

  els.start.addEventListener('click', () => {
    startCamera().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
  });
  els.stop.addEventListener('click', () => stopCamera());
  els.capture.addEventListener('click', () => {
    captureAndEnroll().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
  });
  els.deleteBtn.addEventListener('click', () => {
    deleteProfile().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
  });

  loadModels();
})();
