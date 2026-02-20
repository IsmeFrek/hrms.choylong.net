import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermission from '../hooks/usePermission';

export default function WordPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth() || {};
  const perms = usePermission() || new Set();

  const ref = useRef(null);
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewBadge, setIsNewBadge] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);

  // small helpers / fallbacks used by the JSX below
  const toKh = (v) => (v == null ? '' : String(v));
  const resolveSignatureUrl = (v) => (v ? v : null);
  const formatKhmerLongDate = (d) => {
    if (!d) return '';
    try { const dt = new Date(d); return dt.toLocaleDateString(); } catch (e) { return String(d); }
  };
  const formatKhmerDate = (d) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      const day = dt.getDate();
      const month = dt.getMonth() + 1;
      const year = dt.getFullYear();
  const khDigits = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
  const toKh = (n) => String(n).split('').map(ch => (khDigits[Number(ch)] ?? ch)).join('');
  const monthsKh = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
  const monthName = monthsKh[(month - 1) % 12] || month;
  return `ថ្ងៃទី ${toKh(day)} ខែ ${monthName} ឆ្នាំ ${toKh(year)}`;
    } catch (e) { return String(d); }
  };
  const getDisplayName = (u) => {
    if (!u) return '';
    if (typeof u === 'string') return u;
    return u.name || u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim();
  };
  const autoResize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(500, el.scrollHeight) + 'px';
  };

  useEffect(() => {
    // simple load for the letter when id present
    let mounted = true;
    const load = async () => {
      if (!id) { setLoading(false); return; }
      try {
        const res = await fetch('/api/letters/' + id, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setLetter(data);
          // check if letter is new compared to last seen
          try {
            const ts = (data && (data.updatedAt || data.createdAt)) ? new Date(data.updatedAt || data.createdAt).getTime() : 0;
            const seenKey = `lastSeenLetter_${id}`;
            const seen = Number(localStorage.getItem(seenKey) || '0');
            setIsNewBadge(ts > 0 && ts > seen);
          } catch (e) { /* ignore */ }
        }
      } catch (e) {
        // ignore
      }
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [id, token]);

  // ensure existing textarea contents are sized on load
  useEffect(() => {
    if (!ref.current) return;
    const nodes = ref.current.querySelectorAll && ref.current.querySelectorAll('textarea.kh-textarea');
    if (!nodes) return;
    nodes.forEach(n => autoResize(n));
  }, [letter]);

  // if a signature already exists but no date is present, auto-fill deputyAdminDate = today
  useEffect(() => {
    if (!letter) return;
    try {
      const sig = letter.deputyAdminSignature || letter.signatureUrl || null;
      if (sig && !letter.deputyAdminDate) {
        const today = new Date().toISOString();
        setLetter(s => ({ ...s, deputyAdminDate: today }));
      }
    } catch (e) { /* ignore */ }
  }, [letter && (letter.deputyAdminSignature || letter.signatureUrl)]);

  // permissions for specific fields: allow editing when explicit perm exists or fallback to canEditDocuments
  const canEditOfficeHead = (perms.has && perms.has('edit:letters.officeHead')) || perms.canEditDocuments;
  const canEditDirector = (perms.has && perms.has('edit:letters.director')) || perms.canEditDocuments;
  const canEditDeputy5 = (perms.has && perms.has('edit:letters.deputyDirector5')) || perms.canEditDocuments;
  const canEditDeputy9 = (perms.has && perms.has('edit:letters.deputyDirector9')) || perms.canEditDocuments;
  const canEditOfficer = (perms.has && perms.has('edit:letters.officer')) || perms.canEditDocuments;
  const canEditDeputyAdmin = (perms.has && perms.has('edit:letters.deputyAdmin')) || perms.canEditDocuments;

  const removeDeputySignature = () => {
    if (!letter) return;
    setLetter(s => ({ ...s, deputyAdminSignature: null }));
  };

  const handleSignatureFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingSig(true);
    try {
      // upload file to server
      let uploadedUrl = null;
      try {
        const form = new FormData();
        form.append('file', file);
  const upl = await fetch('/api/upload', { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (upl.ok) {
          const body = await upl.json();
          // common response shapes: { url } or { path }
          uploadedUrl = body && (body.url || body.path || body.file || body.fileUrl || body.location) || null;
        } else {
          const txt = await upl.text().catch(() => null);
          console.error('Signature upload failed', upl.status, txt);
        }
      } catch (e) {
        console.error('Upload error', e);
      }
      // fallback to local preview URL if upload didn't return a URL
      if (!uploadedUrl) uploadedUrl = URL.createObjectURL(file);

  const newLetter = { ...(letter || {}), deputyAdminSignature: uploadedUrl, deputyAdminDate: (letter && letter.deputyAdminDate) || new Date().toISOString(), deputyAdminSigner: (letter && letter.deputyAdminSigner) || user, deputyAdminSignerName: (letter && letter.deputyAdminSignerName) || getDisplayName(user) };
      setLetter(newLetter);
      // auto-save after upload so signature persists server-side
      try { await saveLetter(newLetter); } catch (e) { console.error('Auto-save after upload failed', e); }
    } finally {
      setUploadingSig(false);
    }
  };

  const saveLetter = async (overrideLetter) => {
    const toSave = overrideLetter || letter;
    if (!toSave) return;
    try {
      if (toSave._id) {
        const isAdmin = perms.canEditDocuments;
        const isOwner = !!(toSave.createdBy && user && (String(toSave.createdBy) === String(user._id || user.id)));

        // If not admin and not owner, only send per-field allowed workflow updates
        let bodyPayload = null;
        if (isAdmin || isOwner) {
          bodyPayload = toSave; // full update allowed (use the object we're saving)
        } else {
          const workflowFields = [
            'officer','deputyAdmin','deputyAdminSignature','officeHead','deputyDirector1','deputyDirector2','deputyDirector3','deputyDirector4','deputyDirector5','deputyDirector6','deputyDirector7','deputyDirector8','deputyDirector9','director'
          ];
          const payload = {};
          workflowFields.forEach((f) => {
            try {
              if (Object.prototype.hasOwnProperty.call(toSave, f) && (perms.has && perms.has(`edit:letters.${f}`) || perms.canEditDocuments)) {
                payload[f] = toSave[f];
              }
            } catch (e) { /* ignore */ }
          });
          ['deputyDirector9Date','deputyDirector5Date','deputyAdminDate'].forEach(dk => {
            if (Object.prototype.hasOwnProperty.call(toSave, dk)) payload[dk] = toSave[dk];
          });

          if (Object.keys(payload).length === 0) {
            alert('រក្សាទុកមិនបាន: អ្នកមិនមានសិទ្ធិផ្លាស់ប្តូរបណ្ដាលើវាលទាំងនេះ។');
            return;
          }
          bodyPayload = payload;
        }

        const res = await fetch('/api/letters/' + toSave._id, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }, body: JSON.stringify(bodyPayload) });
        if (res.ok) {
          const updated = await res.json().catch(() => null);
          // merge server response into local state if saving current letter
          if (!overrideLetter && updated) {
            try { setLetter(updated); } catch (e) { /* ignore */ }
          }
          alert('បានរក្សាទុក');
          return updated || toSave;
        }
        let msg = `Save failed (status ${res.status})`;
        try {
          const data = await res.json();
          if (data && data.message) msg = `${msg}: ${data.message}`;
        } catch (e) {
          try { const txt = await res.text(); if (txt) msg = `${msg}: ${txt}`; } catch (e) { /* ignore */ }
        }
        console.error('Save (PUT) failed:', { status: res.status, msg });
        try {
          const cur = JSON.parse(localStorage.getItem('localLetters')||'[]');
          const idx = cur.findIndex(x => (toSave._localId && x._localId && x._localId === toSave._localId) || (toSave._id && x._id && x._id === toSave._id));
          if (idx >= 0) { cur[idx] = toSave; } else { cur.unshift(toSave); }
          localStorage.setItem('localLetters', JSON.stringify(cur));
          alert(msg + '\nបានរក្សាទុក (offline)');
          return;
        } catch (e) {
          console.error('Local fallback failed', e);
          alert(msg);
          return;
        }
      }
      try {
        const cur = JSON.parse(localStorage.getItem('localLetters')||'[]');
        const idx = cur.findIndex(x => (toSave._localId && x._localId && x._localId === toSave._localId));
        if (idx >= 0) { cur[idx] = toSave; } else { cur.unshift(toSave); }
        localStorage.setItem('localLetters', JSON.stringify(cur));
        alert('បានរក្សាទុក (offline)');
        return toSave;
      } catch (e) { console.error('local save failed', e); alert('រក្សាទុកមិនបាន'); }
    } catch (err) {
      console.error(err);
      alert('រក្សាទុកមិនបាន');
    }
  };

  const a4Wrapper = (content) => `<!doctype html><html><head><meta charset="utf-8"><title>Document</title></head><body>${content}</body></html>`;

  const handlePrint = () => {
    if (!ref.current) return alert('nothing to print');
    const content = ref.current.innerHTML;
    const win = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,width=900,height=800');
    if (!win) return alert('Please allow popups');
    win.document.open();
    win.document.write(a4Wrapper(content));
    win.document.close();
    setTimeout(() => { try { win.print(); } catch (e){} }, 300);
  };

  const handleDownload = () => {
    if (!ref.current) return alert('nothing to download');
    const content = ref.current.innerHTML;
    const doc = a4Wrapper(content);
    const blob = new Blob([doc], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (letter && (letter.letterNo ? toKh(letter.letterNo) : 'letter')) + '.doc';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6">កំពុងផ្ទុក...</div>;
  if (!letter) return <div className="p-6">មិនឃើញឯកសារ <button className="ml-2 px-2 py-1 bg-blue-600 text-white rounded" onClick={() => navigate(-1)}>Back</button></div>;

  // A4 layout roughly matching the attached screenshot
  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="mb-3 flex justify-between items-center">
        <div>
          <button onClick={() => {
            // mark as seen when navigating back
            try { localStorage.setItem(`lastSeenLetter_${id}`, String((letter && (letter.updatedAt || letter.createdAt)) ? new Date(letter.updatedAt || letter.createdAt).getTime() : Date.now())); } catch (e) {}
            setIsNewBadge(false);
            navigate(-1);
          }} className="px-3 py-1 bg-gray-300 rounded mr-2">Back</button>
          <button onClick={handlePrint} className="px-3 py-1 bg-gray-600 text-white rounded mr-2">Print</button>
          <button onClick={handleDownload} className="px-3 py-1 bg-yellow-500 text-white rounded mr-2">Download .doc</button>
          <button onClick={async () => {
            const saved = await saveLetter();
            // mark as seen after saving using server-returned timestamps when available
            try {
              const ts = (saved && (saved.updatedAt || saved.createdAt)) ? new Date(saved.updatedAt || saved.createdAt).getTime() : ((letter && (letter.updatedAt || letter.createdAt)) ? new Date(letter.updatedAt || letter.createdAt).getTime() : Date.now());
              localStorage.setItem(`lastSeenLetter_${id}`, String(ts));
            } catch (e) {}
            setIsNewBadge(false);
          }} className="px-3 py-1 bg-green-600 text-white rounded">Save</button>
          {isNewBadge && (
            <span title="ថ្មី" style={{ display: 'inline-block', marginLeft: 8 }}>
              <span style={{
                display: 'inline-block',
                background: '#e11d48',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                boxShadow: '0 0 0 rgba(225,29,72,0.7)',
                animation: 'pulseBadge 1.6s infinite'
              }}>ថ្មី</span>
              <style>{`@keyframes pulseBadge { 0% { box-shadow: 0 0 0 0 rgba(225,29,72,0.6); } 70% { box-shadow: 0 0 0 10px rgba(225,29,72,0); } 100% { box-shadow: 0 0 0 0 rgba(225,29,72,0); } }`}</style>
            </span>
          )}
        </div>
      </div>

      <div ref={ref} style={{ width: '8.27in', minHeight: '11.69in', padding: '12mm', margin: '0 auto', background: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.08)', boxSizing: 'border-box', fontFamily: 'Khmer OS, Arial, serif' }}>
        <style>{`
          :root{--kh-input-font:16px;--kh-input-line:1.3;--kh-input-padding:8px;--kh-placeholder:#999}
          .kh-input{width:100%;border:none;padding:var(--kh-input-padding);background:transparent;outline:none;font-size:var(--kh-input-font);line-height:var(--kh-input-line);}
          .kh-input.sm{font-size:14px;padding:6px}
          .kh-box{border:1px solid #ccc;padding:8px;min-height:46px;box-sizing:border-box}
          .kh-bigbox{border:1px solid #030303;padding:8px;min-height:100px;box-sizing:border-box}
          textarea.kh-textarea{white-space:pre-wrap;text-align:left;text-indent:28px}
          input[type=date].kh-input{padding:6px 4px}
          ::placeholder{color:var(--kh-placeholder)}
          /* hide interactive controls when printing */
          @media print { .no-print{ display: none !important } }
        `}</style>
        <div style={{ textAlign: 'center', marginBottom: 6, fontWeight: 700 }}>
          <div style={{ fontSize: 18, fontFamily: 'Khmer OS Muol Light, "Khmer OS", Arial, serif' }}>ព្រះរាជាណាចក្រកម្ពុជា</div>
          <div style={{ fontSize: 17, fontFamily: 'Khmer OS Muol Light, "Khmer OS", Arial, serif' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
          <div style={{ fontSize: 16, fontFamily: 'Khmer OS Muol Light, "Khmer OS", Arial, serif',textAlign: 'left' }}>ក្រសួងសុខាភិបាល</div>
          <div style={{ fontSize: 15,fontFamily: 'Khmer OS Muol Light, "Khmer OS", Arial, serif',textAlign: 'left', marginTop: 6 }}>{letter.ministry || 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត'}</div>
          <div style={{ fontSize: 15, fontFamily: 'Khmer OS Muol Light, "Khmer OS", Arial, serif'}}>កំណត់បង្ហាញ</div>
        </div>

        <div style={{ border: '0px dashed #999', padding: 8, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 120 }}><strong>លេខលិខិតចូល:</strong></div>
            <div style={{ flex: 1 }}>{letter.letterNo ? toKh(letter.letterNo) : '..............'}</div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <div style={{ width: 120 }}><strong>មកពី:</strong></div>
            <div style={{ flex: 1 }}>{letter.department || ''}</div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <div style={{ width: 120 }}><strong>កម្មវត្ថុ:</strong></div>
            <div style={{ flex: 1 }}>{letter.subject || ''}</div>
          </div>

          <div style={{ fontSize: 15, marginTop: 6, textAlign: 'center', fontFamily: 'Khmer OS muol light' }}> យោបល់ការិយាល័យ</div>

          <div style={{ marginTop: 8 }}>
            {/* reserve extra bottom padding when signature is present so signature sits inside the box */}
            <div className="kh-bigbox" style={{ position: 'relative', paddingBottom: (resolveSignatureUrl(letter.deputyAdminSignature || letter.signatureUrl || null) ? 120 : 8) }}>
              { canEditDeputyAdmin ? (
                <textarea value={letter.deputyAdmin || ''} onChange={(e) => { setLetter(s => ({ ...s, deputyAdmin: e.target.value })); autoResize(e.target); }} className="kh-input kh-textarea" placeholder="ការិយាល័យ" style={{ resize: 'none', overflow: 'hidden' }} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{letter.deputyAdmin || ''}</div>
              ) }

              {/* absolute signature block inside the box at bottom-right (nudged to the right, right-aligned) */}
              <div style={{ position: 'absolute', right: 8, bottom: 8, textAlign: 'right' }}>
                {(() => {
                  const sigUrl = resolveSignatureUrl(letter.deputyAdminSignature || letter.signatureUrl || null);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 160 }}>
                      { sigUrl ? (
                        <>
                          <div style={{ marginBottom: 6, fontSize: 13 }}>{ formatKhmerDate(letter.deputyAdminDate || letter.deputyAdminSignedAt || letter.createdAt) }</div>
                          <img src={sigUrl} alt="ហត្ថលេខា" style={{ maxWidth: 180, maxHeight: 80, objectFit: 'contain', display: 'block' }} />
                          <div style={{ marginTop: 4, fontWeight: 600, fontSize: 14, fontFamily: 'Khmer OS Muol Light, "Khmer OS", Arial, serif' }}>
                            { canEditDeputyAdmin ? (
                              <input
                                value={letter.deputyAdminSignerName || getDisplayName(user) || ''}
                                onChange={(e) => setLetter(s => ({ ...s, deputyAdminSignerName: e.target.value }))}
                                style={{ fontSize: 14, fontFamily: 'Khmer OS Muol Light, "Khmer OS", Arial, serif', border: 'none', borderBottom: '1px dotted #ccc', background: 'transparent', padding: '2px 4px' }}
                              />
                            ) : (
                              (letter.deputyAdminSignerName && letter.deputyAdminSignerName) || getDisplayName(user) || getDisplayName(letter.deputyAdminSigner || letter.signedBy) || '\u00A0'
                            ) }
                          </div>
                        </>
                      ) : (
                        <div style={{ width: 180, height: 80 }} />
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* interactive controls moved outside the table/box and hidden from print */}
            <div className="no-print" style={{ marginTop: 6, textAlign: 'right' }}>
              { canEditDeputyAdmin && (
                <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={removeDeputySignature}>Remove</button>
                  <label style={{ cursor: 'pointer', fontSize: 13, color: '#0b66d0', display: 'inline-block', textDecoration: 'underline' }}>
                    { uploadingSig ? 'Uploading...' : 'Upload signature' }
                    <input type="file" accept="image/*" onChange={handleSignatureFileChange} style={{ display: 'none' }} />
                  </label>
                </div>
              ) }
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="kh-bigbox">
              { canEditDeputy9 ? (
                <textarea value={letter.deputyDirector9 || ''} onChange={(e) => { setLetter(s => ({ ...s, deputyDirector9: e.target.value })); autoResize(e.target); }} className="kh-input kh-textarea" placeholder="នាយករងទី៩" style={{ resize: 'none', overflow: 'hidden' }} />
              ) : (
                <>នាយករងទី៩ {letter.deputyDirector9 || ''}</>
              ) }
            </div>
            <div style={{ marginTop: 8 }}>កាលបរិច្ឆេទ៖ {letter.deputyDirector9Date || (letter.createdAt ? new Date(letter.createdAt).toLocaleDateString() : '')}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="kh-bigbox">
              { canEditDeputy5 ? (
                <textarea value={letter.deputyDirector5 || ''} onChange={(e) => { setLetter(s => ({ ...s, deputyDirector5: e.target.value })); autoResize(e.target); }} className="kh-input kh-textarea" placeholder="នាយករងទី៥" style={{ resize: 'none', overflow: 'hidden' }} />
              ) : (
                <>នាយករងទី៥ {letter.deputyDirector5 || ''}</>
              ) }
            </div>
            <div style={{ marginTop: 8 }}>កាលបរិច្ឆេទ៖ {letter.deputyDirector5Date || (letter.createdAt ? new Date(letter.createdAt).toLocaleDateString() : '')}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="kh-bigbox">
            <center>
              { canEditDirector ? (
                <textarea value={letter.director || ''} onChange={(e) => { setLetter(s => ({ ...s, director: e.target.value })); autoResize(e.target); }} className="kh-input kh-textarea" style={{ textAlign: 'center', resize: 'none', overflow: 'hidden' }} placeholder="នាយក" />
              ) : (
                <>នាយក {letter.director || ''}</>
              ) }
            </center>
          </div>
        </div>
      </div>
    </div>
  );
}
