(() => {
  // Legacy scanner moved to React route: /mobileApp/scan
  // This file is kept as a tiny stub for backward compatibility.
  try {
    // eslint-disable-next-line no-console
    console.warn('mobile_scan.js is deprecated; use /mobileApp/scan');
  } catch {
    // ignore
  }

  /*

    detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    track = stream.getVideoTracks()[0] || null;
    els.video.srcObject = stream;

    scanning = true;
    els.start.disabled = true;
    els.stop.disabled = false;

    // torch support (if available)
    try {
      const caps = track?.getCapabilities?.();
      els.torch.disabled = !(caps && caps.torch);
    } catch {
      els.torch.disabled = true;
    }

    setBadge('Camera រួចរាល់ ✅ សូមស្កេន...', 'ok');
    setResult('');
    scanLoop();
  }

  // Init defaults
  try {
    els.date.value = els.date.value || todayISO();
    els.time.value = els.time.value || nowHM();

    const { mode, slot } = readQuery();
    const normalizedMode = (mode || '').toLowerCase();
    if (normalizedMode === 'checkin' || normalizedMode === 'checkin'.toLowerCase()) {
      els.mode.value = 'checkIn';
    } else if (normalizedMode === 'checkout' || normalizedMode === 'checkout'.toLowerCase()) {
      els.mode.value = 'checkOut';
    } else if (mode === 'checkIn' || mode === 'checkOut') {
      els.mode.value = mode;
    }

    const t = defaultTimeFor(mode || els.mode.value, slot);
    if (t) els.time.value = t;
  } catch {
    // ignore
  }

  function stopCamera() {
    scanning = false;
    els.start.disabled = false;
    els.stop.disabled = true;
    els.torch.disabled = true;

    try { if (els.video) els.video.srcObject = null; } catch {}

    if (stream) {
      for (const t of stream.getTracks()) {
        try { t.stop(); } catch {}
      }
    }
    stream = null;
    track = null;
    detector = null;

    setBadge('Camera បិទ', 'warn');
  }

  async function toggleTorch() {
    if (!track?.applyConstraints) return;
    const state = els.torch.dataset.on === '1';
    try {
      await track.applyConstraints({ advanced: [{ torch: !state }] });
      els.torch.dataset.on = (!state) ? '1' : '0';
      els.torch.textContent = (!state) ? 'ពន្លឺ: ON' : 'ពន្លឺ (Torch)';
    } catch {
      // ignore
    }
  }

  async function scanLoop() {
    if (!scanning || !detector) return;
    const v = els.video;
    if (!v || v.readyState < 2) {
      requestAnimationFrame(scanLoop);
      return;
    }

    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    const c = els.canvas;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });

    // draw mirrored because <video> is mirrored; canvas should match displayed orientation
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(v, -w, 0, w, h);
    ctx.restore();

    try {
      const codes = await detector.detect(c);
      if (codes && codes.length) {
        const raw = codes[0].rawValue || '';
        const now = Date.now();
        if (raw && (raw !== lastValue || (now - lastHitAt) > 2500)) {
          lastValue = raw;
          lastHitAt = now;
          onScan(raw);
        }
      }
    } catch {
      // ignore detection errors per-frame
    }

    requestAnimationFrame(scanLoop);
  }

  function onScan(raw) {
    const parsed = parseScanValue(raw);
    if (!parsed) return;

    els.staffId.value = parsed.staffId || '';
    if (parsed.fullName && !els.fullName.value.trim()) els.fullName.value = parsed.fullName;

    // auto-set time and date
    if (!els.date.value) els.date.value = todayISO();
    els.time.value = nowHM();

    setResult(`ស្កេនបាន ✅\nRaw: ${raw}\nStaff: ${parsed.staffId}${parsed.fullName ? `\nName: ${parsed.fullName}` : ''}`);

    // Optional: auto-save if URL has ?autosave=1
    try {
      const qs = new URLSearchParams(location.search || '');
      if (qs.get('autosave') === '1') {
        saveAttendance().catch((e) => setResult(`កើតបញ្ហា៖ ${e.message || e}`));
      }
    } catch {}
  }

  function initDefaults() {
    els.date.value = todayISO();
    els.time.value = nowHM();

    const supportsCamera = !!navigator.mediaDevices?.getUserMedia;
    const supportsDetector = typeof window.BarcodeDetector !== 'undefined';

    if (supportsCamera && supportsDetector) {
      setBadge('គាំទ្រ camera + barcode ✅', 'ok');
    } else if (supportsCamera && !supportsDetector) {
      setBadge('គាំទ្រ camera ប៉ុន្តែមិនគាំទ្រ barcode — បញ្ចូលដោយដៃ', 'warn');
    } else {
      setBadge('មិនគាំទ្រ camera — បញ្ចូលដោយដៃ', 'err');
    }
  }

  // events
  els.start.addEventListener('click', () => {
    startCamera().catch((e) => {
      setBadge(`បើក camera មិនបាន: ${e.message || e}`, 'err');
      setResult(String(e && (e.stack || e.message) || e));
    });
  });
  els.stop.addEventListener('click', () => stopCamera());
  els.torch.addEventListener('click', () => toggleTorch());

  els.submit.addEventListener('click', () => {
    saveAttendance().catch((e) => {
      setResult(`កើតបញ្ហា៖ ${e.message || e}`);
    });
  });

  els.clear.addEventListener('click', () => {
    els.staffId.value = '';
    els.fullName.value = '';
    els.time.value = nowHM();
    setResult('');
  });

  // keep time fresh when mode changes (small UX)
  els.mode.addEventListener('change', () => {
    els.time.value = nowHM();
  });

  initDefaults();
*/
})();
