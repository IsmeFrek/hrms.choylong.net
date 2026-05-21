async function fileToDataURL(file){
  if(!file) return null;
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Small HTML escape helper reused below
function escapeHtml(s){
  return String(s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;' })[c]);
}

// Determine if the current user appears to be an admin from localStorage `auth`.
function isAdminFromAuth(){
  try{
    const raw = localStorage.getItem('auth');
    if(!raw) return false;
    const a = JSON.parse(raw);
    const u = a && a.user;
    if(!u) return false;
    // Common admin indicators: isAdmin, role === 'admin', permissions array containing 'admin'
    if(u.isAdmin || u.is_admin) return true;
    if(u.role && String(u.role).toLowerCase() === 'admin') return true;
    if(Array.isArray(u.permissions) && u.permissions.includes('admin')) return true;
    if(Array.isArray(u.perms) && u.perms.includes('admin')) return true;
    return false;
  }catch(e){ return false; }
}

// Check if the current user has a specific permission string (e.g. 'addattendance:approve')
function hasPermission(perm){
  try{
    const raw = localStorage.getItem('auth');
    if(!raw) return false;
    const a = JSON.parse(raw);
    const u = a && a.user;
    if(!u) return false;
    const list = Array.isArray(u.permissions) ? u.permissions : (Array.isArray(u.perms) ? u.perms : []);
    return list.includes(perm);
  }catch(e){ return false; }
}

// Final admin check: allow forcing via URL `?admin=1` or localStorage `forceAdmin=1` for testing/override
function isAdmin(){
  try {
    // url param override
    const qs = (typeof window !== 'undefined' && window.location && window.location.search) ? window.location.search : '';
    if (qs && /[?&]admin=1(\b|$)/.test(qs)) return true;
    // localStorage override
    if (localStorage && localStorage.getItem && localStorage.getItem('forceAdmin') === '1') return true;
  } catch (e) {}
  return isAdminFromAuth();
}

function formatDateDMY(iso){
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0,10);
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  } catch (e) { return String(iso).slice(0,10); }
}

// Helper: populate the form with a record object and set editing mode
function populateFormFromRecord(rec){
  try{
    const f = document.getElementById('attendanceForm'); if(!f) return;
    f.staffId.value = rec.staffId || '';
    f.fullName.value = rec.fullName || (rec.notes && typeof rec.notes === 'string' ? (JSON.parse(rec.notes).fullName || '') : '');
    if (rec.date) f.date.value = (rec.date || '').slice(0,10);
    f.checkIn.value = rec.checkIn || rec.inTime || '';
    f.checkOut.value = rec.checkOut || rec.outTime || '';
    try { const n = rec.notes ? (typeof rec.notes === 'string' ? JSON.parse(rec.notes) : rec.notes) : null; if (n && n.notes) f.notes.value = n.notes; } catch(e){}
    let editingIdInput = document.getElementById('editingId');
    if (!editingIdInput) { editingIdInput = document.createElement('input'); editingIdInput.type = 'hidden'; editingIdInput.id = 'editingId'; editingIdInput.name = 'editingId'; f.appendChild(editingIdInput); }
    editingIdInput.value = rec._id || rec.id || '';
    const submitBtn = f.querySelector('button[type="submit"]'); if (submitBtn) submitBtn.textContent = 'Update';
    f.scrollIntoView({ behavior: 'smooth' });
  }catch(e){ }
}

// Initialize flatpickr for the date field if available
try {
  const initDatepicker = () => {
    const el = document.querySelector('input[name="date"]');
    if (!el) return;
    if (window.flatpickr) {
      // use ISO value in the underlying input, show dd/mm/yyyy to user
      window.flatpickr(el, {
        dateFormat: 'Y-m-d', // underlying value
        altInput: true,
        altFormat: 'd/m/Y', // displayed to user
        allowInput: true,
        clickOpens: true,
      });
    }
  };
  // If flatpickr already loaded, init immediately; otherwise small timeout
  if (window.flatpickr) initDatepicker(); else setTimeout(initDatepicker, 300);
} catch (e) {
  // ignore
}

// Initialize flatpickr time pickers for checkIn/checkOut
try {
  const initTimepickers = () => {
    if (!window.flatpickr) return;
    const cfg = {
      enableTime: true,
      noCalendar: true,
      dateFormat: 'H:i', // underlying value like 14:30
      time_24hr: true,
      minuteIncrement: 1,
      allowInput: true
    };
    const inEl = document.querySelector('input[name="checkIn"]');
    const outEl = document.querySelector('input[name="checkOut"]');
    if (inEl) window.flatpickr(inEl, cfg);
    if (outEl) window.flatpickr(outEl, cfg);
  };
  if (window.flatpickr) initTimepickers(); else setTimeout(initTimepickers, 350);
} catch (e) {
  // ignore
}

// Initialize flatpickr for checkInDate/checkOutDate
try {
  const initPairDates = () => {
    if (!window.flatpickr) return;
    const els = [document.querySelector('input[name="checkInDate"]'), document.querySelector('input[name="checkOutDate"]')];
    els.forEach(el => {
      if (!el) return;
      window.flatpickr(el, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'd/m/Y',
        allowInput: true,
      });
    });
  };
  if (window.flatpickr) initPairDates(); else setTimeout(initPairDates, 400);
} catch (e) {
  // ignore
}

// មិនបំពេញលេខកាត់បុគ្គលិក និងឈ្មោះពី auth ទៀតទេ។
// វាលទាំងពីរនេះត្រូវបានបំពេញតែនៅពេលស្កេនមុខ match ជាមួយ Face Profile។

// --- Face recognition (for auto-fill from Scan Face) ---
const FACE_MODELS_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
let faceModelsReady = false;
let faceModelsLoading = false;

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

async function ensureFaceModels(){
  if (faceModelsReady || faceModelsLoading) {
    // wait briefly if another call is loading
    while(faceModelsLoading && !faceModelsReady){
      await new Promise(r => setTimeout(r, 100));
    }
    return;
  }
  if (typeof faceapi === 'undefined' || !faceapi.nets) return;
  faceModelsLoading = true;
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL);
    faceModelsReady = true;
  } catch (e) {
    console.error('Failed to load face models', e);
  } finally {
    faceModelsLoading = false;
  }
}

// --- Camera capture for scanIn (face photo) ---
let capturedScanInData = null;
let cameraStream = null;
let faceMatchedForForm = false;
let autoCaptureTimer = null;
let autoCloseTimer = null;
const AUTO_CAPTURE_DELAY_MS = 3000; // 3 វិនាទី
const AUTO_CLOSE_DELAY_MS = 20000; // បើមិនថតរូបរួច ក្នុង 20 វិនាទី បិទម៉ូដាល់

function clearAutoCaptureTimer(){
  if (autoCaptureTimer) {
    clearTimeout(autoCaptureTimer);
    autoCaptureTimer = null;
  }
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
}

async function openCameraForCheckIn() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraPreview');
  const canvas = document.getElementById('cameraCanvas');
  const captureBtn = document.getElementById('cameraCaptureBtn');
  const cancelBtn = document.getElementById('cameraCancelBtn');
  if (!modal || !video || !canvas || !captureBtn || !cancelBtn) return false;

  return new Promise(async (resolve) => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = cameraStream;
    } catch (err) {
      console.error('Unable to open camera', err);
      resolve(false);
      return;
    }

    modal.style.display = 'flex';

    const cleanup = (ok) => {
      try {
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop());
        }
      } catch (e) {}
      cameraStream = null;
      modal.style.display = 'none';
      captureBtn.onclick = null;
      cancelBtn.onclick = null;
      clearAutoCaptureTimer();
      resolve({ ok, canvas: ok ? canvas : null });
    };

    const doCapture = () => {
      try {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 240;
        // Crop center square (focus roughly on face area)
        const size = Math.min(w, h) * 0.8;
        const sx = (w - size) / 2;
        const sy = (h - size) / 2;
        canvas.width = size;
        canvas.height = size;
        // Hint to browser that we'll read pixels frequently (face-api getImageData)
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
        capturedScanInData = canvas.toDataURL('image/jpeg', 0.85);
      } catch (e) {
        console.error('Capture failed', e);
        capturedScanInData = null;
      }
      cleanup(true);
    };

    captureBtn.onclick = () => {
      clearAutoCaptureTimer();
      doCapture();
    };

    cancelBtn.onclick = () => {
      clearAutoCaptureTimer();
      capturedScanInData = null;
      cleanup(false);
    };

    // Auto-capture after delay, and auto-close if still open for too long
    try {
      clearAutoCaptureTimer();
      autoCaptureTimer = setTimeout(() => {
        autoCaptureTimer = null;
        // Only auto-capture if modal still open
        if (modal.style.display === 'flex') {
          doCapture();
        }
      }, AUTO_CAPTURE_DELAY_MS);
      autoCloseTimer = setTimeout(() => {
        autoCloseTimer = null;
        if (modal.style.display === 'flex') {
          capturedScanInData = null;
          cleanup(false);
        }
      }, AUTO_CLOSE_DELAY_MS);
    } catch (e) {}
  });
}

// Quick face-scan button on the attendance form
try {
  const quickFaceScanBtn = document.getElementById('quickFaceScan');
  if (quickFaceScanBtn) {
    quickFaceScanBtn.addEventListener('click', async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('result').textContent = 'Browser មិនគាំទ្រ camera';
        return;
      }
      const captureRes = await openCameraForCheckIn();
      if (!captureRes || !captureRes.ok) {
        document.getElementById('result').textContent = 'បានបោះបង់ថតមុខ';
        faceMatchedForForm = false;
        return;
      }
      const f = document.getElementById('attendanceForm');
      // After successful capture, default check-in time to 07:35 (morning)
      if (f && !f.checkIn.value) {
        f.checkIn.value = '07:35';
      }

      // After capturing the face photo, try to auto-fill staffId + fullName via face match
      try {
        await ensureFaceModels();
        if (!faceModelsReady || typeof faceapi === 'undefined') {
          document.getElementById('result').textContent = 'មិនអាចទាញ face models បាន';
          return;
        }
        const token = getAuthToken();
        if (!token) {
          document.getElementById('result').textContent = 'សូម Login ជាមុន (token មិនមាន)';
          return;
        }
        const canvas = captureRes.canvas;
        if (!canvas) {
          document.getElementById('result').textContent = 'មិនរកទំហំរូបមុខ';
          return;
        }

        document.getElementById('result').textContent = 'កំពុងស្វែងរកមុខ...';

        const detection = await faceapi
          .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          document.getElementById('result').textContent = 'រកមុខមិនឃើញ (សូមពន្លឺល្អ និងមុខត្រង់)';
          faceMatchedForForm = false;
          return;
        }

        const descriptor = Array.from(detection.descriptor, (x) => Number(x));

        const r = await fetch('/api/face/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          // Use a more forgiving threshold for attendance matching
          // (different from enroll duplicate check).
          body: JSON.stringify({ descriptor, threshold: 0.7 })
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          document.getElementById('result').textContent = data && data.message ? data.message : 'Match failed';
          faceMatchedForForm = false;
          return;
        }

        if (!data.matched) {
          const dist = typeof data.distance === 'number' ? data.distance.toFixed(3) : '';
          const thr = typeof data.threshold === 'number' ? data.threshold.toFixed(3) : '';
          document.getElementById('result').textContent = dist
            ? `មិន match ជាមួយ Face Profile ទេ (distance=${dist}, threshold=${thr})`
            : 'មិន match ជាមួយ Face Profile ទេ';
          faceMatchedForForm = false;
          return;
        }

        if (f) {
          if (data.staffId) f.staffId.value = data.staffId;
          if (data.fullName) f.fullName.value = data.fullName;
        }
        faceMatchedForForm = true;
        document.getElementById('result').textContent = `Match ✅ Staff: ${data.staffId || ''} Name: ${data.fullName || ''}`;

        // After a successful match, reveal the form fields and main buttons
        try {
          document.querySelectorAll('.hidden-until-match').forEach(el => el.classList.remove('hidden-until-match'));
          const intro = document.getElementById('preScanIntro');
          if (intro) intro.style.display = 'none';
        } catch (e) {}

        // Automatically show/refresh the recent records table under the form
        try {
          const listEl = document.getElementById('recordsList');
          const btn = document.getElementById('showRecords');
          if (btn && listEl) {
            // If already visible, hide then show again to refresh
            if (listEl.dataset.visible === '1' && listEl.innerHTML.trim()) {
              btn.click();
            }
            btn.click();
          }
        } catch (e) {}
      } catch (err) {
        console.error(err);
        faceMatchedForForm = false;
        document.getElementById('result').textContent = 'កើតបញ្ហា​ពេល match មុខ';
      }
    });
  }
} catch (e) {
  // ignore
}

// Button on the form to go back to the initial scan card
try {
  const backToScan = document.getElementById('backToScan');
  if (backToScan) {
    backToScan.addEventListener('click', () => {
      // Simple reload to restore the first scan card view
      window.location.reload();
    });
  }
} catch (e) {
  // ignore
}

// Toggle hidden file inputs for scans and show filename
try {
  const showScanIn = document.getElementById('showScanIn');
  const showScanOut = document.getElementById('showScanOut');
  const scanInInput = document.querySelector('input[name="scanIn"]');
  const scanOutInput = document.querySelector('input[name="scanOut"]');
  const scanInName = document.getElementById('scanInName');
  const scanOutName = document.getElementById('scanOutName');
  if (showScanIn && scanInInput) {
    showScanIn.addEventListener('click', () => { scanInInput.style.display = 'block'; scanInInput.click(); });
    scanInInput.addEventListener('change', (ev) => {
      const f = ev.target.files && ev.target.files[0];
      scanInName.textContent = f ? f.name : '';
      if (f) showScanIn.textContent = 'ប្តូរ ស្កេនចូល';
    });
  }
  if (showScanOut && scanOutInput) {
    showScanOut.addEventListener('click', () => { scanOutInput.style.display = 'block'; scanOutInput.click(); });
    scanOutInput.addEventListener('change', (ev) => {
      const f = ev.target.files && ev.target.files[0];
      scanOutName.textContent = f ? f.name : '';
      if (f) showScanOut.textContent = 'ប្តូរ ស្កេនចេញ';
    });
  }
} catch (e) {
  // ignore
}

// Check-out tick behavior: when checked, populate current HH:MM and disable input
try{
  const tick = document.getElementById('checkOutTick');
  const coInput = document.querySelector('input[name="checkOut"]');
  if (tick && coInput) {
    tick.addEventListener('change', () => {
      if (tick.checked) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2,'0');
        const mm = String(now.getMinutes()).padStart(2,'0');
        coInput.value = hh + ':' + mm;
        coInput.disabled = true;
      } else {
        coInput.disabled = false;
      }
    });
  }
}catch(e){ }

document.getElementById('attendanceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const resultEl = document.getElementById('result');
  const staffId = f.staffId.value.trim();
  const fullName = f.fullName.value.trim();
  const dateRaw = (f.date.value || '').trim();
  // If flatpickr used with dateFormat 'Y-m-d' the input value will be ISO already.
  // Accept both ISO (yyyy-mm-dd) and dd/mm/yyyy typed by user.
  const parseDMY = (s) => {
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return s.slice(0,10);
    const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dm) {
      const d = dm[1].padStart(2,'0');
      const m = dm[2].padStart(2,'0');
      const y = dm[3];
      return `${y}-${m}-${d}`;
    }
    return null;
  };
  const date = parseDMY(dateRaw);
  // Require that user has successfully scanned face before saving
  if (!faceMatchedForForm) {
    resultEl.textContent = 'សូមស្កេនមុខ (ប៊ូតុង ស្កេនមុខ) ជាមុន មិនទាន់អនុញ្ញាតបញ្ចូលវត្តមានទេ';
    return;
  }

  const checkIn = f.checkIn.value || undefined;
  const checkOut = f.checkOut.value || undefined;
  const checkInDateRaw = (f.checkInDate && f.checkInDate.value) ? f.checkInDate.value.trim() : '';
  const checkOutDateRaw = (f.checkOutDate && f.checkOutDate.value) ? f.checkOutDate.value.trim() : '';
  const approved = (f.approved && f.approved.value) ? f.approved.value : undefined;
  let notesFree = f.notes.value.trim();

  // enforce field max lengths (also configured in HTML via maxlength)
  const MAX = { staffId: 30, fullName: 100, notes: 300 };
  let truncated = [];
  let staffIdSafe = staffId;
  let fullNameSafe = fullName;
  if (staffIdSafe && staffIdSafe.length > MAX.staffId) { staffIdSafe = staffIdSafe.slice(0, MAX.staffId); truncated.push('staffId'); }
  if (fullNameSafe && fullNameSafe.length > MAX.fullName) { fullNameSafe = fullNameSafe.slice(0, MAX.fullName); truncated.push('fullName'); }
  if (notesFree && notesFree.length > MAX.notes) { notesFree = notesFree.slice(0, MAX.notes); truncated.push('notes'); }

  const scanInFile = f.scanIn.files[0];
  const scanOutFile = f.scanOut.files[0];
  const scanInData = capturedScanInData || (await fileToDataURL(scanInFile));
  const scanOutData = await fileToDataURL(scanOutFile);

  // Build notes payload carrying extra fields (server model will persist `notes` string)
  const meta = {
  fullName: fullNameSafe || undefined,
    scanInName: scanInFile ? scanInFile.name : undefined,
    scanOutName: scanOutFile ? scanOutFile.name : undefined,
    // include small data URIs only when file size is small; otherwise omit to avoid huge payloads
    scanInData: scanInData && scanInData.length < 200000 ? scanInData : undefined,
    scanOutData: scanOutData && scanOutData.length < 200000 ? scanOutData : undefined,
    notes: notesFree || undefined,
    checkOutTick: (document.getElementById('checkOutTick') ? !!document.getElementById('checkOutTick').checked : false)
  };

  // Client-side required-field validation (per form UI)
  if (!staffId) {
    document.getElementById('result').textContent = 'សូមបញ្ចូលលេខកាត់បុគ្គលិក';
    return;
  }
  if (!fullName) {
    document.getElementById('result').textContent = 'សូមបញ្ចូលគោត្តមាន និង នាម';
    return;
  }
  if (!date) {
    document.getElementById('result').textContent = 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ - សូមប្រើ dd/mm/yyyy';
    return;
  }
  if (!checkIn) {
    document.getElementById('result').textContent = 'សូមបញ្ចូលម៉ោងចូល (HH:MM)';
    return;
  }

  // parse checkIn/checkOut dates to ISO (if provided)
  const checkInDate = (function(s){
    if (!s) return undefined; const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return s.slice(0,10);
    const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (dm) { const d = dm[1].padStart(2,'0'); const m = dm[2].padStart(2,'0'); const y = dm[3]; return `${y}-${m}-${d}`; } return undefined;
  })(checkInDateRaw);
  const checkOutDate = (function(s){
    if (!s) return undefined; const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return s.slice(0,10);
    const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (dm) { const d = dm[1].padStart(2,'0'); const m = dm[2].padStart(2,'0'); const y = dm[3]; return `${y}-${m}-${d}`; } return undefined;
  })(checkOutDateRaw);

  const payload = {
    staffId: staffIdSafe,
    date,
    checkIn,
    checkOut,
    checkInDate,
    checkOutDate,
    approved,
    notes: JSON.stringify(meta)
  };

  resultEl.textContent = 'កំពុងដាក់ស្នើ...';

  try {
    const resp = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    // Handle duplicate / conflict response specially (409)
    if (resp.status === 409) {
      const msg = data && (data.message || JSON.stringify(data)) || 'Attendance already recorded for this staff and date';
      resultEl.innerHTML = '<div style="color:#b91c1c">កំណត់ត្រា៖ ' + escapeHtml(msg) + '</div>';
      // Try to locate existing record(s) for this staff+date and offer to load it for editing
      try {
        const q = '/api/attendance?staffId=' + encodeURIComponent(staffIdSafe) + '&date=' + encodeURIComponent(date);
        const r2 = await fetch(q);
        if (r2.ok) {
          const arr = await r2.json();
          if (Array.isArray(arr) && arr.length) {
            resultEl.innerHTML += '<div style="margin-top:8px"><button id="loadExisting" class="secondary">ទាញកំណត់ត្រាដែលមាន</button></div>';
            setTimeout(() => { document.getElementById('loadExisting')?.addEventListener('click', () => populateFormFromRecord(arr[0])); }, 50);
          }
        }
      } catch (e) { /* ignore */ }
      return;
    }
    if (!resp.ok) throw new Error(data && data.message ? data.message : JSON.stringify(data));
    // Show a short success message (no long JSON block)
    resultEl.textContent = 'បានរក្សាទុកវត្តមានរួចរាល់';
    if (truncated && truncated.length) {
      const list = truncated.join(', ');
      resultEl.textContent += ' (បានកាត់ខ្លី: ' + list + ')';
    }
    f.reset();

    // Auto-refresh the records table if the button exists
    try {
      const listEl = document.getElementById('recordsList');
      const btn = document.getElementById('showRecords');
      if (btn && listEl) {
        if (listEl.dataset.visible === '1') {
          btn.click(); // hide old list
        }
        btn.click();   // reload list
      }
    } catch (e) {}
  } catch (err) {
    resultEl.textContent = 'កើតបញ្ហា៖ ' + (err.message || err);
  }
});

// Require a simple daily PIN (123) before allowing edit/delete/approval actions
function ensureDailyAdminPin(){
  try{
    const today = new Date().toISOString().slice(0,10);
    const stored = localStorage.getItem('attendanceAdminPinDate');
    if (stored === today) return true; // already unlocked today
    const input = window.prompt('សូមបញ្ចូលលេខកូដ (123) ម្តងក្នុងមួយថ្ងៃ ដើម្បីកែ/លុប ឬផ្តល់មតិរដ្ឋបាល');
    if (input === null) return false;
    if (input === '123'){
      localStorage.setItem('attendanceAdminPinDate', today);
      return true;
    }
    alert('លេខកូដមិនត្រឹមត្រូវ');
    return false;
  }catch(e){
    return false;
  }
}

// Fetch and display recent records (optionally filtered by staffId)
document.getElementById('showRecords')?.addEventListener('click', async () => {
  const out = document.getElementById('recordsList');
  const btn = document.getElementById('showRecords');
  if (!out) return;
  // Base permission checks (PIN will be required later only when user
  // actually clicks approve/edit/delete, not when just opening the list)
  // For this simple view, hide the Actions column (no edit/delete)
  const canEdit = false;
  const canDelete = false;
  const canEditDelete = false;
  // If currently visible, hide and update button text
  if (out.dataset.visible === '1' && out.innerHTML.trim()) {
    out.dataset.visible = '0';
    out.innerHTML = '';
    if (btn) btn.textContent = 'បង្ហាញកំណត់ត្រា';
    return;
  }
  out.textContent = 'កំពុងទាញទិន្នន័យ...';
  try {
    // Only users with permission 'addattendance:approve' or Admin can view all records.
    const canViewAll = isAdmin() || hasPermission('addattendance:approve');
    let staffId = '';
    if (canViewAll) {
      staffId = (document.querySelector('input[name="staffId"]') || {}).value || '';
    } else {
      // restrict to current user's staffId from auth
      try {
        const auth = JSON.parse(localStorage.getItem('auth') || '{}');
        const user = auth.user || {};
        staffId = user.phone || user.phoneNumber || user.mobile || user.staffId || user.id || '';
      } catch (e) { staffId = (document.querySelector('input[name="staffId"]') || {}).value || ''; }
    }
    const url = staffId ? `/api/attendance?staffId=${encodeURIComponent(staffId)}` : '/api/attendance';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Server returned ' + resp.status);
    const data = await resp.json();
    if (!Array.isArray(data)) return out.textContent = 'ទិន្នន័យមិនត្រឹមត្រូវ';
    if (data.length === 0) return out.textContent = 'គ្មានកំណត់ត្រាទេ';
    // Render table with requested columns (Serial, Staff ID, FullName, Date, CreatedAt, In, Out, Notes, Approved)
    // Also show a small link to open the full report page (with CSV/Excel export)
    let html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      + '<div style="font-weight:600;color:#111">បញ្ជីវត្តមាន (ចុងក្រោយ)</div>'
      + '<a href="/attendance_list.html" target="_blank" style="font-size:0.9rem;padding:4px 10px;border-radius:9999px;border:1px solid #0ea5e9;background:#e0f2fe;color:#0369a1;text-decoration:none;white-space:nowrap">Export CSV / Excel</a>'
      + '</div>';
    html += '<div class="table-wrap"><table class="records-table">';
    html += '<thead><tr style="text-align:left">'
      + '<th style="padding:6px;border-bottom:1px solid #eee">ល.រ</th>'
      + '<th style="padding:6px;border-bottom:1px solid #eee">លេខកាត់បុគ្គលិក</th>'
      + '<th style="padding:6px;border-bottom:1px solid #eee">គោត្តមាននិង នាម</th>'
      + '<th style="padding:6px;border-bottom:1px solid #eee">ថ្ងៃខែឆ្នាំ</th>'
      + '<th style="padding:6px;border-bottom:1px solid #eee">ថ្ងៃបង្កើត</th>'
      + '<th style="padding:6px;border-bottom:1px solid #eee">ម៉ោងចូល</th>'
      + '<th style="padding:6px;border-bottom:1px solid #eee">ម៉ោងចេញ</th>'
      + '<th style="padding:6px;border-bottom:1px solid #eee">ផ្សេងៗ / កំណត់សម្គាល់</th>'
      + '<th style="padding:6px;border-bottom:1px solid #eee">មតិរដ្ឋបាល</th>';
    if (canEditDelete) {
      html += '<th style="padding:6px;border-bottom:1px solid #eee;text-align:center">សកម្មភាព</th>';
    }
    html += '</tr></thead>';
    html += '<tbody>';
    let idx = 1;
    for (const r of data.slice(0,200)) {
      const id = r._id || r.id || '';
      let notesObj = {};
      if (r.notes) {
        try { notesObj = typeof r.notes === 'string' ? JSON.parse(r.notes) : r.notes; } catch (e) { notesObj = { notes: r.notes }; }
      }
      const fullName = notesObj.fullName || r.fullName || r.staffName || '';
      const notesText = notesObj.notes || '';
      const approved = r.approved || notesObj.approved || '';
      const created = r.createdAt ? formatDateDMY(r.createdAt) : '';
      let rowHtml = '<tr>'
        + '<td style="padding:6px;border-top:1px solid #f1f1f1;vertical-align:top">' + escapeHtml(String(idx++)) + '</td>'
        + '<td style="padding:6px;border-top:1px solid #f1f1f1;vertical-align:top">' + escapeHtml(r.staffId || '') + '</td>'
        + '<td style="padding:6px;border-top:1px solid #f1f1f1;vertical-align:top">' + escapeHtml(fullName) + '</td>'
        + '<td style="padding:6px;border-top:1px solid #f1f1f1;vertical-align:top">' + escapeHtml(formatDateDMY(r.date)) + '</td>'
        + '<td style="padding:6px;border-top:1px solid #f1f1f1;vertical-align:top">' + escapeHtml(created) + '</td>'
        + '<td style="padding:6px;border-top:1px solid #f1f1f1;vertical-align:top">' + escapeHtml(r.checkIn || r.inTime || '') + '</td>'
        + '<td style="padding:6px;border-top:1px solid #f1f1f1;vertical-align:top">' + escapeHtml(r.checkOut || r.outTime || '') + '</td>'
        + '<td style="padding:6px;border-top:1px solid #f1f1f1;vertical-align:top">' + escapeHtml(notesText) + '</td>'
        + '<td style="padding:6px;border-top:1px solid #f1f1f1;vertical-align:top">'
          + (function(){
            // If current user is admin, show a select with three choices: approved, pending, rejected.
            const admin = isAdmin() || hasPermission('addattendance:approve');
            const prevVal = approved || '';
            if (admin) {
              return '<div class="approveWrap" data-prev="' + escapeHtml(prevVal) + '" style="display:inline-flex;gap:8px;align-items:center">'
                + '<select title="អាចផ្តល់មតិបានដោយអ្នកដែលមានសិទ្ធិ addattendance:approve ឬ អ្នកគ្រប់គ្រង (Admin)" class="approveSelect" data-id="' + escapeHtml(id) + '" style="padding:6px;border-radius:6px;border:1px solid #ccc">'
                  + '<option value="" ' + (prevVal === '' ? 'selected' : '') + '>រង់ចាំមតិ</option>'
                  + '<option value="approved" ' + (prevVal === 'approved' ? 'selected' : '') + '>យល់ព្រម</option>'
                  + '<option value="pending" ' + (prevVal === 'pending' ? 'selected' : '') + '>រង់ចាំសួរផ្នែក</option>'
                  + '<option value="rejected" ' + (prevVal === 'rejected' ? 'selected' : '') + '>មិនព្រម</option>'
                + '</select>'
              + '</div>';
            }
            // Non-admin: show status text only (approved / pending / rejected)
            if (approved === 'approved') return '<div style="min-height:5px"><span style="color:green">យល់ព្រម</span></div>';
            if (approved === 'pending') return '<div style="min-height:5px"><span style="color:orange">រង់ចាំសួរផ្នែក</span></div>';
            if (approved === 'rejected') return '<div style="min-height:5px"><span style="color:red">មិនព្រម</span></div>';
            return '<div style="min-height:5pxស"><span style="color:#666">រង់ចាំមតិ</span></div>';
          })()
        + '</td>';
      if (canEditDelete) {
        rowHtml += '<td style="padding:2px;border-top:1px solid #f1f1f1;vertical-align:top;text-align:center">';
        if (canEdit) {
          rowHtml += '<button type="button" class="editBtn" data-id="' + escapeHtml(id) + '" style="margin-right:8px;background:#2563eb;color:#fff;border:0;padding:2px 2px;border-radius:2px;cursor:pointer">កែ</button>';
        }
        if (canDelete) {
          rowHtml += '<button type="button" class="deleteBtn" data-id="' + escapeHtml(id) + '" style="background:#ef4444;color:#fff;border:0;padding:2px 1px;border-radius:1px;cursor:pointer">លុប</button>';
        }
        rowHtml += '</td>';
      }
      rowHtml += '</tr>';
      html += rowHtml;
    }
    html += '</tbody></table></div>';
    out.innerHTML = html;
    out.dataset.visible = '1';
    if (btn) btn.textContent = 'លាក់កំណត់ត្រា';
    // attach listeners to admin approval selects (admin only)
    Array.from(out.querySelectorAll('.approveSelect')).forEach(sel => {
      sel.addEventListener('change', async (ev) => {
        const s = ev.target;
        const id = s.getAttribute('data-id');
        const newVal = s.value || '';
        const wrap = s.closest('.approveWrap');
        const prev = (wrap && wrap.getAttribute('data-prev')) || '';
        // Require daily PIN only when interacting with admin approval
        if (!ensureDailyAdminPin()) {
          // revert selection if PIN failed/cancelled
          s.value = prev;
          return;
        }
        s.disabled = true;
        try {
          const resp = await fetch('/api/attendance/' + encodeURIComponent(id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approved: newVal })
          });
          if (!resp.ok) throw new Error('Server ' + resp.status);
          if (wrap) wrap.setAttribute('data-prev', newVal);
        } catch (err) {
          // revert select to previous value
          if (wrap) {
            const opts = wrap.querySelectorAll('option');
            opts.forEach(o => o.selected = (o.value === prev));
          } else {
            s.value = prev;
          }
          alert('Failed to update approval: ' + (err.message || err));
        } finally {
          s.disabled = false;
        }
      });
    });
    // attach edit/delete handlers (only when permitted)
    if (canEditDelete) {
      if (canEdit) {
        Array.from(out.querySelectorAll('.editBtn')).forEach(btnEl => {
          btnEl.addEventListener('click', async (ev) => {
        if (!ensureDailyAdminPin()) return;
        const id = btnEl.getAttribute('data-id');
        try {
          const r = await fetch('/api/attendance/' + encodeURIComponent(id));
          if (!r.ok) throw new Error('Server ' + r.status);
          const rec = await r.json();
          const f = document.getElementById('attendanceForm');
          if (!f) return alert('Form not found');
          f.staffId.value = rec.staffId || '';
          f.fullName.value = rec.fullName || '';
          if (rec.date) f.date.value = rec.date.slice(0,10);
          f.checkIn.value = rec.checkIn || '';
          // Sync check-out tick: mark checked and disable input when a check-out exists
          const coVal = rec.checkOut || rec.outTime || '';
          const coTick = document.getElementById('checkOutTick');
          if (coTick) {
            coTick.checked = !!coVal;
            f.checkOut.disabled = !!coVal;
          }
          f.checkOut.value = coVal;
          try {
            const n = rec.notes ? (typeof rec.notes === 'string' ? JSON.parse(rec.notes) : rec.notes) : null;
            if (n && n.notes) f.notes.value = n.notes;
            // also sync checkOutTick when editing
            if (n && typeof n.checkOutTick !== 'undefined') {
              const tickEl = document.getElementById('checkOutTick');
              if (tickEl) tickEl.checked = !!n.checkOutTick;
              // disable input if tick is set
              if (tickEl && tickEl.checked) f.checkOut.disabled = true;
            }
          } catch (e) {}
          let editingIdInput = document.getElementById('editingId');
          if (!editingIdInput) { editingIdInput = document.createElement('input'); editingIdInput.type = 'hidden'; editingIdInput.id = 'editingId'; editingIdInput.name = 'editingId'; f.appendChild(editingIdInput); }
          editingIdInput.value = id;
          const submitBtn = f.querySelector('button[type="submit"]'); if (submitBtn) submitBtn.textContent = 'Update';
          f.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
          alert('Failed to load record for editing: ' + (err.message || err));
        }
      });
        });
      }
      if (canDelete) {
        Array.from(out.querySelectorAll('.deleteBtn')).forEach(btnEl => {
          btnEl.addEventListener('click', async (ev) => {
        if (!ensureDailyAdminPin()) return;
        const id = btnEl.getAttribute('data-id');
        if (!confirm('លុបកំណត់ត្រានេះ?')) return;
        btnEl.disabled = true;
        try {
          const r2 = await fetch('/api/attendance/' + encodeURIComponent(id), { method: 'DELETE' });
          if (!r2.ok) throw new Error('Server ' + r2.status);
          document.getElementById('showRecords')?.click();
        } catch (err) {
          alert('Failed to delete: ' + (err.message || err));
        } finally {
          btnEl.disabled = false;
        }
      });
        });
      }
    }
  } catch (err) {
    out.textContent = 'កើតបញ្ហា: ' + (err.message || err);
  }
});

// Embed full attendance_list.html into this page
document.getElementById('embedList')?.addEventListener('click', async () => {
  const containerId = 'embeddedListContainer';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.marginTop = '18px';
    // place below recordsList if present, otherwise at end of body
    const ref = document.getElementById('recordsList') || document.getElementById('result');
    ref.parentNode.insertBefore(container, ref.nextSibling);
  }
  container.innerHTML = 'កំពុងទាញបញ្ជី...';
  try {
    const r = await fetch('/attendance_list.html');
    if (!r.ok) throw new Error('Failed to load list page: ' + r.status);
    const text = await r.text();
    // parse and extract the main .container content
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const main = doc.querySelector('.container') || doc.body;
    container.innerHTML = '';
    // import styles from fetched doc's head (only style blocks)
    const styleEls = doc.head.querySelectorAll('style,link[rel="stylesheet"]');
    styleEls.forEach(s => {
      // avoid duplicating identical links/styles
      if (s.tagName.toLowerCase() === 'link') {
        const href = s.href;
        if (!document.querySelector('link[href="' + href + '"]')) {
          const nl = document.createElement('link'); nl.rel = 'stylesheet'; nl.href = href; document.head.appendChild(nl);
        }
      } else {
        const ns = document.createElement('style'); ns.textContent = s.textContent; document.head.appendChild(ns);
      }
    });
    // append main content
    Array.from(main.childNodes).forEach(n => container.appendChild(document.importNode(n, true)));

    // load the script if present (/attendance_list.js)
    const scriptSrc = '/attendance_list.js';
    if (!document.querySelector('script[src="' + scriptSrc + '"]')) {
      const s = document.createElement('script'); s.src = scriptSrc; s.defer = true; document.body.appendChild(s);
    } else {
      // If already present, try to call an initialization if available
      if (window.load) window.load({});
    }
  } catch (err) {
    container.textContent = 'កើតបញ្ហា: ' + (err.message || err);
  }
});

// Note: records list will now be shown after a successful face match,
// triggered from the quick face scan handler above.
