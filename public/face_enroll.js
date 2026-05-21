(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    video: $('video'),
    start: $('start'),
    capture: $('capture'),
    stop: $('stop'), // may be null (button removed)
    upload: $('upload'),
    fileInput: $('fileInput'),
    staffId: $('staffId'),
    fullName: $('fullName'),
    consent: $('consent'),
    deleteBtn: $('delete'),
    fixBtn: $('fixId'),
    support: $('support'),
    result: $('result'),
    profilesList: $('profilesList'), // may be null (old compact list removed)
    profilesShow: $('profilesShow'),
  };

  let stream = null;
  let track = null;
  let modelsReady = false;
  let hrCache = null;
  let profilesCache = [];
  let currentMismatch = null;
  let autoCaptureTimer = null;
  let autoStopTimer = null;

  const AUTO_CAPTURE_DELAY_MS = 3000; // 3 វិនាទី
  const AUTO_STOP_MS = 20000; // បើមិនស្កេនរួច ក្នុង 20 វិនាទី ក៏បិទកាមេរ៉ា

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

  function clearAutoCapture() {
    if (autoCaptureTimer) {
      clearTimeout(autoCaptureTimer);
      autoCaptureTimer = null;
    }
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }
  }

  function scheduleAutoCapture() {
    clearAutoCapture();
    try {
      const staffId = String(els.staffId?.value || '').trim();
      if (!modelsReady || !stream || !staffId || !els.consent?.checked) return;
      setResult(`ស្កេនអូតូក្រោយ 3 វិនាទី...`);
      autoCaptureTimer = setTimeout(() => {
        autoCaptureTimer = null;
        captureAndEnroll().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
      }, AUTO_CAPTURE_DELAY_MS);
      if (!autoStopTimer) {
        autoStopTimer = setTimeout(() => {
          autoStopTimer = null;
          // If still streaming and not yet captured, stop to avoid running forever
          if (stream) {
            setResult('ស្កេនមិនទាន់បាន ក្នុង 20 វិនាទី — បិទកាមេរ៉ាអូតូ');
            stopCamera();
          }
        }, AUTO_STOP_MS);
      }
    } catch (e) {
      // do nothing; auto capture is just a helper
    }
  }

  function captureSnapshot() {
    try {
      if (!els.video || !els.video.videoWidth || !els.video.videoHeight) return '';
      const canvas = document.createElement('canvas');
      canvas.width = els.video.videoWidth;
      canvas.height = els.video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      // Mirror horizontally to match preview
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(els.video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch {
      return '';
    }
  }

  function renderProfiles(items) {
    if (!els.profilesShow && !els.profilesList) return;
    const list = Array.isArray(items) ? items.slice().sort((a, b) => {
      // Show newest (by updatedAt) first; fallback to original order
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    }) : [];
    profilesCache = list;
    if (!list.length) {
      if (els.profilesShow) els.profilesShow.textContent = 'មិនទាន់មាន Face Profile ទេ';
      if (els.profilesList) els.profilesList.textContent = 'មិនទាន់មាន Face Profile ទេ';
      return;
    }
    const rows = list.map((p, idx) => {
      const name = p.hrName || p.fullName || '';
      const descCount = typeof p.descriptorsCount === 'number' ? p.descriptorsCount : '';
      const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '';
      const img = p.snapshot ? `<img src="${p.snapshot}" alt="face" style="height:40px;border-radius:6px;object-fit:cover;" />` : '';
      const faceStaffId = p.faceStaffId || p.staffId || '';

      let actionsHtml = '';
      // Already has Face Profile: show edit + delete
      if (p.hasFace) {
        actionsHtml = `
          <button type="button" data-action="edit-profile" data-staff-id="${p.staffId || ''}" style="flex:1;padding:2px 6px;border-radius:999px;border:1px solid rgba(59,130,246,0.8);background:rgba(37,99,235,0.35);color:#dbeafe;font-size:0.7rem;cursor:pointer;">កែ</button>
          <button type="button" data-action="delete-profile" data-staff-id="${p.staffId || ''}" data-face-staff-id="${faceStaffId}" style="flex:1;padding:2px 6px;border-radius:999px;border:1px solid rgba(248,113,113,0.6);background:rgba(127,29,29,0.4);color:#fecaca;font-size:0.7rem;cursor:pointer;">លុប</button>
        `;
      } else if (p.snapshot) {
        // Has HR image but no Face Profile yet: offer auto-enroll button
        actionsHtml = `
          <button type="button" data-action="auto-enroll" data-staff-id="${p.staffId || ''}" style="flex:1;padding:2px 6px;border-radius:999px;border:1px solid rgba(34,197,94,0.9);background:rgba(22,163,74,0.45);color:#bbf7d0;font-size:0.75rem;cursor:pointer;">Enroll ពី HR</button>
        `;
      } else {
        // No face and no HR image: just allow edit to fill form
        actionsHtml = `
          <button type="button" data-action="edit-profile" data-staff-id="${p.staffId || ''}" style="flex:1;padding:2px 6px;border-radius:999px;border:1px solid rgba(59,130,246,0.8);background:rgba(37,99,235,0.35);color:#dbeafe;font-size:0.7rem;cursor:pointer;">កែ</button>
        `;
      }

      return `
        <tr data-staff-id="${p.staffId || ''}" data-face-staff-id="${faceStaffId}">
          <td style="padding:2px 4px;text-align:right;">${idx + 1}</td>
          <td style="padding:2px 4px;">${p.staffId || ''}</td>
          <td style="padding:2px 4px;">${img}</td>
          <td style="padding:2px 4px;">${name}</td>
          <td style="padding:2px 4px;text-align:center;">${descCount || ''}</td>
          <td style="padding:2px 4px;white-space:normal;">${updated}</td>
          <td style="padding:2px 4px;">
            <div style="display:flex;justify-content:space-between;gap:4px;">
              ${actionsHtml}
            </div>
          </td>
        </tr>`;
    }).join('');

    const tableHtml = `
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem;table-layout:fixed;">
        <thead>
          <tr>
            <th style="padding:2px 4px;text-align:right;border-bottom:1px solid rgba(148,163,184,0.35);">ល.រ</th>
            <th style="padding:2px 4px;text-align:left;border-bottom:1px solid rgba(148,163,184,0.35);">Staff ID</th>
            <th style="padding:2px 4px;text-align:left;border-bottom:1px solid rgba(148,163,184,0.35);">រូប</th>
            <th style="padding:2px 4px;text-align:left;border-bottom:1px solid rgba(148,163,184,0.35);">ឈ្មោះ</th>
            <th style="padding:2px 4px;text-align:center;border-bottom:1px solid rgba(148,163,184,0.35);">Desc</th>
            <th style="padding:2px 4px;text-align:left;border-bottom:1px solid rgba(148,163,184,0.35);white-space:normal;">Updated</th>
            <th style="padding:2px 4px;text-align:center;border-bottom:1px solid rgba(148,163,184,0.35);">សកម្មភាព</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>`;
    if (els.profilesShow) els.profilesShow.innerHTML = tableHtml;
  }

  async function loadProfiles() {
    if (!els.profilesShow && !els.profilesList) return;
    try {
      if (els.profilesShow) els.profilesShow.textContent = 'កំពុងទាញបញ្ជី Face Profiles...';
      // Load HR list and Face Profiles
      const hrList = await getHrList();

      let faceItems = [];
      try {
        const r = await fetch('/api/face/list', { headers: { ...authHeaders() } });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.ok && Array.isArray(data.items)) {
          faceItems = data.items;
        }
      } catch (e) {
        // ignore face list failure; we can still show HR list
        faceItems = [];
      }

      let combined = [];
      if (Array.isArray(hrList) && hrList.length) {
        combined = hrList.map((h) => {
          const face = findFaceForHr(h, faceItems);
          const staffId = getStaffIdFromHr(h) || (face ? face.staffId : '');
          const hrName = h.khmerName || h.name || h.fullName || '';
          const hrDept = h.Department_Kh || h.department || h.unitName || '';
          const hrPos = h.position || h.officerType || '';
          const hasFace = !!face;
          return {
            staffId,
            faceStaffId: face ? face.staffId || staffId : staffId,
            hrName,
            hrDept,
            hrPos,
            fullName: face ? face.fullName : hrName,
            // រូបយកពី Face Profile បើមាន មិនដូច្នោះទេ fallback ទៅ HR.image
            // ដូចនឹងចាស់ (វាលរូបបង្ហាញរូប HR ដដែល)
            snapshot: (face && face.snapshot) || h.image || '',
            // Desc បង្ហាញតែពេលមាន Face Profile ពិតៗ (hasFace)
            descriptorsCount: hasFace && typeof face.descriptorsCount === 'number' ? face.descriptorsCount : '',
            updatedAt: (face && face.updatedAt) || h.updatedAt || h.joinDate || null,
            hasFace
          };
        });
      } else {
        // Fallback: no HR list, just show face items as before
        combined = (faceItems || []).map((f) => ({
          ...f,
          faceStaffId: f.staffId,
        }));
      }

      renderProfiles(combined);
    } catch (e) {
      if (els.profilesShow) els.profilesShow.textContent = String(e && (e.message || e)) || 'error';
    }
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

    if (els.start) els.start.disabled = true;
    if (els.stop) els.stop.disabled = false;
    if (els.capture) els.capture.disabled = !modelsReady;

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
    clearAutoCapture();

    if (els.start) els.start.disabled = false;
    if (els.stop) els.stop.disabled = true;
    if (els.capture) els.capture.disabled = true;
  }

  function toDescriptorArray(desc) {
    // Float32Array -> number[]
    return Array.from(desc, (x) => Number(x));
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onerror = (e) => reject(e);
        reader.onload = (e) => {
          try {
            const dataUrl = e.target && e.target.result;
            if (!dataUrl) return reject(new Error('មិនអាចអានរូបភាពបាន'));
            const img = new Image();
            img.onload = () => resolve({ img, dataUrl });
            img.onerror = (err) => reject(err || new Error('Image load failed'));
            img.src = dataUrl;
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        reject(err);
      }
    });
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      try {
        if (!url) return reject(new Error('URL រូបភាពមិនមាន'));
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas មិនគាំទ្រ'));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            resolve({ img, dataUrl });
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (err) => reject(err || new Error('Image load failed'));
        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  }

  async function getHrList() {
    if (Array.isArray(hrCache)) return hrCache;
    try {
      const r = await fetch('/api/hr', { headers: { ...authHeaders() } });
      const data = await r.json().catch(() => []);
      if (!r.ok || !Array.isArray(data)) return [];
      hrCache = data;
      return hrCache;
    } catch {
      return [];
    }
  }

  // Helper: normalize string equality
  function sameId(a, b) {
    if (!a || !b) return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  // Highlight profile row + show status when a staffId is entered
  function highlightProfileForStaffId(staffId) {
    try {
      const id = String(staffId || '').trim();
      if (!els.profilesShow) return;

      currentMismatch = null;
      if (els.fixBtn) {
        els.fixBtn.disabled = true;
      }

      // Clear previous highlights
      const rows = els.profilesShow.querySelectorAll('tr[data-staff-id]');
      rows.forEach((tr) => {
        tr.style.outline = '';
        tr.style.backgroundColor = '';
      });

      if (!id) return;

      let profile = null;
      if (Array.isArray(profilesCache) && profilesCache.length) {
        profile = profilesCache.find((p) => sameId(p.staffId, id) || sameId(p.faceStaffId, id)) || null;
      }

      const matchRow = Array.from(rows).find((tr) => {
        const rid = tr.getAttribute('data-staff-id') || '';
        const fid = tr.getAttribute('data-face-staff-id') || '';
        return sameId(rid, id) || sameId(fid, id);
      });

      if (matchRow) {
        matchRow.style.backgroundColor = 'rgba(34,197,94,0.12)';
        matchRow.style.outline = '1px solid rgba(34,197,94,0.65)';
        try {
          matchRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
      }

      if (profile && profile.hasFace) {
        const desc = profile.descriptorsCount || '';
        const faceId = profile.faceStaffId || profile.staffId || '';
        const typedId = id || faceId;
        const same = faceId && typedId && sameId(faceId, typedId);
        const idLine = same
          ? `Staff ID: ${faceId}`
          : `Staff ID (បញ្ចូល): ${typedId}\nFace Profile ID (បាន Enroll): ${faceId}`;

        if (!same && faceId && typedId && els.fixBtn) {
          currentMismatch = { typedId, faceId, profile };
          els.fixBtn.disabled = false;
        }
        setResult(`មាន Face Profile រួច ✅\n${idLine}\nName: ${profile.fullName || profile.hrName || ''}\nDesc: ${desc}`);
      } else if (profile && profile.snapshot) {
        setResult(`មានរូប HR សម្រាប់ Staff ID នេះ (មិនទាន់ Face Profile ទេ) — អាចចុច Enroll ពី HR`);
      }
    } catch (e) {
      // non-critical UI helper; ignore errors
    }
  }

  // Helper: choose a primary staffId to display from an HR row
  function getStaffIdFromHr(hr) {
    if (!hr) return '';
    const candidates = [
      hr.staffId,
      hr.cardNumber,
      hr.cardNo,
      hr.staffCode,
      hr.officerId,
      hr.civilServantId,
      hr.no != null ? String(hr.no) : ''
    ];
    for (const v of candidates) {
      if (v && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  // Find matching FaceProfile for a given HR record using multiple ID fields
  function findFaceForHr(hr, faceList) {
    if (!hr || !Array.isArray(faceList) || !faceList.length) return null;
    const ids = [
      hr.staffId,
      hr.cardNumber,
      hr.cardNo,
      hr.staffCode,
      hr.officerId,
      hr.civilServantId,
      hr.no != null ? String(hr.no) : ''
    ].filter(Boolean);
    if (!ids.length) return null;
    for (const p of faceList) {
      if (!p || !p.staffId) continue;
      for (const id of ids) {
        if (sameId(p.staffId, id)) return p;
      }
    }
    return null;
  }

  async function lookupEmployeeByStaffId(staffId) {
    const id = String(staffId || '').trim();
    if (!id) return null;
    const list = await getHrList();
    if (!Array.isArray(list) || !list.length) return null;
    const target = id.toLowerCase();
    const fields = ['staffId', 'cardNumber', 'cardNo', 'staffCode', 'officerId', 'civilServantId', 'no'];

    for (const h of list) {
      for (const f of fields) {
        if (h && Object.prototype.hasOwnProperty.call(h, f)) {
          const v = h[f];
          if (v && String(v).toLowerCase() === target) {
            return h;
          }
        }
      }
    }
    return null;
  }

  async function fixIdMismatch() {
    if (!currentMismatch || !currentMismatch.faceId || !currentMismatch.typedId || !currentMismatch.profile) {
      setResult('មិនមានបញ្ហា ID mismatch សម្រាប់ Staff ID បច្ចុប្បន្នទេ');
      return;
    }

    const typedId = String(currentMismatch.typedId || '').trim();
    const faceId = String(currentMismatch.faceId || '').trim();
    const profile = currentMismatch.profile;
    const snapshotUrl = profile && profile.snapshot;

    const ok = confirm(`កែ Face Profile ពី ID ${faceId} ទៅ ${typedId} មែនទេ?\n(ប្រព័ន្ធនឹងលុប Face Profile ចាស់ ហើយ Enroll ថ្មីសម្រាប់ ID ថ្មី)`);
    if (!ok) return;

    try {
      if (!snapshotUrl) throw new Error('មិនមានរូប (snapshot/HR image) សម្រាប់ Enroll ថ្មីទេ');

      setResult('កំពុង Fix ID mismatch... (លុប Face Profile ចាស់)');

      // Step 1: delete old Face Profile for the previous staffId
      const token = getAuthToken();
      if (!token) throw new Error('សូម Login ជាមុន (token មិនមាន)');
      const delRes = await fetch(`/api/face/staff/${encodeURIComponent(faceId)}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      });
      const delData = await delRes.json().catch(() => ({}));
      if (!delRes.ok) throw new Error(delData?.message || `Delete failed: ${delRes.status}`);

      setResult('កំពុង Fix ID mismatch... (Enroll ថ្មីសម្រាប់ ID ថ្មី)');

      // Step 2: re-enroll using the snapshot/HR image
      const { img, dataUrl } = await loadImageFromUrl(snapshotUrl);

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) throw new Error('រកមុខមិនឃើញក្នុងរូប (snapshot/HR)');

      const descriptor = toDescriptorArray(detection.descriptor);

      if (els.staffId) els.staffId.value = typedId;
      await doEnroll(descriptor, dataUrl);

      currentMismatch = null;
      if (els.fixBtn) els.fixBtn.disabled = true;
      loadProfiles().catch(() => {});
    } catch (e) {
      setResult(`កើតបញ្ហា ពេល Fix ID mismatch: ${e.message || e}`);
    }
  }

  async function handleStaffIdAutoFill() {
    const staffId = String(els.staffId.value || '').trim();
    if (!staffId) {
      // Clear name/consent when ID is empty
      if (els.fullName) els.fullName.value = '';
      if (els.consent) els.consent.checked = false;
      clearAutoCapture();
      highlightProfileForStaffId('');
      return;
    }
    // Whenever Staff ID changes, highlight any existing Face Profile / HR row
    highlightProfileForStaffId(staffId);
    const emp = await lookupEmployeeByStaffId(staffId);
    if (!emp) {
      // If not found in HR, avoid mismatch by clearing name/consent
      if (els.fullName) els.fullName.value = '';
      if (els.consent) els.consent.checked = false;
      clearAutoCapture();
      return;
    }
    const name = emp.khmerName || emp.name || emp.fullName || '';
    if (name && els.fullName) {
      // Always sync name with HR when ID changes
      els.fullName.value = name;
    }
    // Auto-check consent when employee is resolved
    if (els.consent) els.consent.checked = true;
  }

  async function doEnroll(descriptor, snapshot) {
    const staffId = String(els.staffId.value || '').trim();
    const fullName = String(els.fullName.value || '').trim();
    const token = getAuthToken();
    if (!token) throw new Error('សូម Login ជាមុន (token មិនមាន)');
    if (!staffId) throw new Error('សូមបញ្ចូល Staff ID');
    if (!els.consent.checked) throw new Error('សូមធីក Consent មុន');
    const consentText = 'I consent to store my face template/embedding for attendance identification and understand it can be deleted.';
    setResult('កំពុង Enroll...');

    const r = await fetch('/api/face/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ staffId, fullName, descriptor, consent: true, consentText, snapshot })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Enroll failed: ${r.status}`);

    setResult(`Enroll រួច ✅\nStaff: ${data.staffId}\nName: ${data.fullName || ''}\nDescriptors: ${data.descriptorsCount}`);
    loadProfiles().catch(() => {});
  }

  async function captureAndEnroll() {
    clearAutoCapture();
    if (!modelsReady) throw new Error('Models មិនទាន់ ready');
    setResult('កំពុងស្វែងរកមុខពីកាមេរ៉ា...');

    const detection = await faceapi
      .detectSingleFace(els.video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) throw new Error('រកមុខមិនឃើញ (សូមពន្លឺល្អ និងមុខត្រង់)');

    const descriptor = toDescriptorArray(detection.descriptor);
    const snapshot = captureSnapshot();
    await doEnroll(descriptor, snapshot);
  }

  async function enrollFromHrImage() {
    clearAutoCapture();
    if (!modelsReady) throw new Error('Models មិនទាន់ ready');

    const staffId = String(els.staffId.value || '').trim();
    if (!staffId) throw new Error('សូមបញ្ចូល Staff ID');

    setResult('កំពុងយករូបពី HR...');
    const emp = await lookupEmployeeByStaffId(staffId);
    if (!emp) throw new Error('រកមិនឃើញបុគ្គលិកក្នុង HR តាម Staff ID នេះ');

    const imgUrl = emp.image || emp.photoUrl || emp.faceImage || '';
    if (!imgUrl) throw new Error('បុគ្គលិកមិនទាន់មានរូប HR នៅក្នុងប្រព័ន្ធទេ');

    const { img, dataUrl } = await loadImageFromUrl(imgUrl);

    setResult('កំពុងស្វែងរកមុខពីរូប HR...');
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) throw new Error('រកមុខមិនឃើញក្នុងរូប HR (សូមពិនិត្យរូប HR)');

    const descriptor = toDescriptorArray(detection.descriptor);
    await doEnroll(descriptor, dataUrl);
  }

  async function uploadAndEnrollFromFile(file) {
    if (!file) return;
    clearAutoCapture();
    if (!modelsReady) throw new Error('Models មិនទាន់ ready');
    setResult('កំពុងអានរូបភាព...');
    const { img, dataUrl } = await loadImageFromFile(file);

    setResult('កំពុងស្វែងរកមុខពីរូបភាព...');
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) throw new Error('រកមុខមិនឃើញក្នុងរូបភាព (សូមជ្រើសរូបមុខច្បាស់ๆ)');

    const descriptor = toDescriptorArray(detection.descriptor);
    await doEnroll(descriptor, dataUrl);
  }

  async function deleteProfileByStaffId(staffId) {
    const id = String(staffId || '').trim();
    const token = getAuthToken();
    if (!token) throw new Error('សូម Login ជាមុន (token មិនមាន)');
    if (!id) throw new Error('សូមបញ្ចូល ឬជ្រើស Staff ID ដើម្បីលុប');
    const ok = confirm(`ចង់លុប Face Profile សម្រាប់ ${id} មែនទេ?`);
    if (!ok) return;

    setResult('កំពុងលុប...');
    const r = await fetch(`/api/face/staff/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { ...authHeaders() } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Delete failed: ${r.status}`);

    setResult(`លុបរួច ✅\nDeleted: ${data.deleted || 0}`);
    loadProfiles().catch(() => {});
  }

  async function deleteProfile() {
    const staffId = String(els.staffId.value || '').trim();
    await deleteProfileByStaffId(staffId);
  }

  function handleProfilesClick(ev) {
    const t = ev.target;
    if (!t) return;
    const editBtn = t.closest('button[data-action="edit-profile"]');
    const deleteBtn = t.closest('button[data-action="delete-profile"]');
    const autoEnrollBtn = t.closest('button[data-action="auto-enroll"]');

    if (editBtn) {
      const staffId = editBtn.getAttribute('data-staff-id') || '';
      if (staffId && els.staffId) {
        els.staffId.value = staffId;
        // Auto-fill name/consent from HR for this staff
        handleStaffIdAutoFill().catch(() => {});
        // Scroll back up to the form
        try {
          els.staffId.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
      }
      return;
    }

    if (autoEnrollBtn) {
      const staffId = autoEnrollBtn.getAttribute('data-staff-id') || '';
      if (staffId && els.staffId) {
        els.staffId.value = staffId;
      }
      // Auto-fill name + consent from HR then enroll from HR image
      handleStaffIdAutoFill()
        .then(() => enrollFromHrImage())
        .catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
      try {
        els.staffId.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {}
      return;
    }

    if (deleteBtn) {
      const displayId = deleteBtn.getAttribute('data-staff-id') || '';
      const faceId = deleteBtn.getAttribute('data-face-staff-id') || displayId;
      if (displayId && els.staffId) {
        // Keep the visible Staff ID in the input for clarity
        els.staffId.value = displayId;
      }
      // Use the actual face profile staffId for deletion so that
      // even if HR ID and face ID differ, we delete the correct doc.
      deleteProfileByStaffId(faceId).catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
    }
  }

  if (els.start) {
    els.start.addEventListener('click', () => {
      startCamera().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
    });
  }
  if (els.stop) {
    els.stop.addEventListener('click', () => stopCamera());
  }
  els.staffId.addEventListener('blur', () => {
    handleStaffIdAutoFill().catch(() => {});
  });
  els.capture.addEventListener('click', () => {
    enrollFromHrImage().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
  });
  if (els.upload && els.fileInput) {
    els.upload.addEventListener('click', () => {
      els.fileInput.value = '';
      els.fileInput.click();
    });
    els.fileInput.addEventListener('change', () => {
      const file = els.fileInput.files && els.fileInput.files[0];
      uploadAndEnrollFromFile(file).catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
    });
  }
  if (els.consent) {
    els.consent.addEventListener('change', () => {
      if (!els.consent.checked) {
        clearAutoCapture();
      }
    });
  }
  els.deleteBtn.addEventListener('click', () => {
    deleteProfile().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
  });

  if (els.fixBtn) {
    els.fixBtn.addEventListener('click', () => {
      fixIdMismatch().catch(() => {});
    });
  }

  // Delete directly from the Face Profiles tables (both compact and show)
  if (els.profilesShow) {
    els.profilesShow.addEventListener('click', handleProfilesClick);
  }

  // Enroll all profiles that have HR image but no Face Profile yet
  const autoAllBtn = document.getElementById('autoEnrollAll');
  if (autoAllBtn && els.profilesShow) {
    autoAllBtn.addEventListener('click', async () => {
      try {
        const rows = Array.from(els.profilesShow.querySelectorAll('tr'));
        // Filter rows that currently show an auto-enroll button
        const targets = rows.filter((tr) => tr.querySelector('button[data-action="auto-enroll"]'));
        if (!targets.length) {
          setResult('មិនមានបុគ្គលិកដែលត្រូវ Enroll ពី HR ទៀតទេ');
          return;
        }
        autoAllBtn.disabled = true;
        for (const tr of targets) {
          const btn = tr.querySelector('button[data-action="auto-enroll"]');
          if (!btn) continue;
          const staffId = btn.getAttribute('data-staff-id') || tr.getAttribute('data-staff-id') || '';
          if (!staffId) continue;
          if (els.staffId) els.staffId.value = staffId;
          await handleStaffIdAutoFill();
          try {
            await enrollFromHrImage();
          } catch (e) {
            // continue with others even if one fails
            // show last error in result box
            setResult(`កើតបញ្ហា ពេល Enroll ${staffId}: ${e.message || e}`);
          }
        }
        // Reload profiles list at the end
        loadProfiles().catch(() => {});
        autoAllBtn.disabled = false;
      } catch (e) {
        autoAllBtn.disabled = false;
        setResult(`កើតបញ្ហា ពេល Enroll អូតូ: ${e.message || e}`);
      }
    });
  }

  loadModels()
    .then(() => {
      // Enable upload button once models are ready
      if (els.upload) els.upload.disabled = false;
      // Auto-start camera when models are ready
      return startCamera().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
    })
    .catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
  loadProfiles().catch(() => {});
})();
