import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import usePermission from '../hooks/usePermission';
import { useAuth } from '../context/AuthContext';

// Minimal, clean LetterPage component — shows documents table first, opens editor+preview on "បង្កើត"
export default function LetterPage() {
  const { token } = useAuth();
  const contentRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [form, setForm] = useState({
    _id: '',
    _localId: '',
    letterNo: '',
    dateText: '',
    ministry: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
    department: 'អគ្គនាយកដ្ឋាន',
    subject: 'សំណើ/សេចក្តីស្នើ',
    recipient: 'លោកនាយកមន្ទីរពេទ្យ',
    body: 'ដោយយោងដល់បទបញ្ជា និងការស្នើររបស់ផ្នែក សូមអញ្ជើញពិនិត្យ និងអនុម័ត​ការស្នើរនេះ​ដោយមានការ​ពិចារណា។',
    signPlace: 'ភ្នំពេញ',
    signTitle: 'នាយក',
    signName: 'ហេង ស៊ីណាត',
    requesterSection: '',
    requesterName: '',
    createdBy: 'Admin',
    createdAt: '',
    reference: '',
    attachments: [],
  });

  const [letters, setLetters] = useState([]);
  // resizable table columns (px) and row height
  const defaultColWidths = [40, 160, 120, 180, 150, 260, 140, 160, 140, 180, 100, 150]; // roughly match columns (added status column)
  const [colWidths, setColWidths] = useState(defaultColWidths);
  const resizingRef = useRef(null); // { index, startX, startWidth }
  const [rowHeight, setRowHeight] = useState(48);
  const [autoRowHeight, setAutoRowHeight] = useState(true);
  // preview label column width (for .doc-row grid)
  const [labelColWidth, setLabelColWidth] = useState(70);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [fullView, setFullView] = useState(false);
  const navigate = useNavigate();
  const perms = usePermission();

  // local persistence fallback when backend unavailable
  const persistLocalLetters = (letter) => {
    try {
      const cur = JSON.parse(localStorage.getItem('localLetters') || '[]');
      // ensure a local id for deletion/tracking and avoid duplicates on edit
      const withId = { ...letter, _localId: letter._localId || (Date.now() + '-' + Math.random().toString(36).slice(2, 8)) };
      const idx = cur.findIndex((x) => x._localId && withId._localId && x._localId === withId._localId);
      if (idx >= 0) {
        cur[idx] = withId; // replace existing local entry when editing
      } else {
        cur.unshift(withId);
      }
      localStorage.setItem('localLetters', JSON.stringify(cur));
    } catch (err) {
      console.warn('local persist failed', err);
    }
  };

  const updateLocalLetter = (letter) => {
    try {
      const cur = JSON.parse(localStorage.getItem('localLetters') || '[]');
      const idx = cur.findIndex((x) => x._localId && letter._localId && x._localId === letter._localId);
      if (idx >= 0) {
        cur[idx] = { ...cur[idx], ...letter };
        localStorage.setItem('localLetters', JSON.stringify(cur));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('update local failed', e);
      return false;
    }
  };

  const removeLocalLetter = (match) => {
    try {
      const cur = JSON.parse(localStorage.getItem('localLetters') || '[]');
      const filtered = cur.filter((x) => {
        if (match._localId && x._localId) return x._localId !== match._localId;
        // fallback: compare createdAt and letterNo
        if (match.createdAt && match.letterNo) return !(x.createdAt === match.createdAt && x.letterNo === match.letterNo);
        return true;
      });
      localStorage.setItem('localLetters', JSON.stringify(filtered));
    } catch (err) {
      console.warn('remove local failed', err);
    }
  };

  const deleteLetter = async (e, l) => {
    // prevent row click
    e.stopPropagation();
    if (!confirm('លុបឯកសារនេះ?')) return;
    try {
      if (l._id) {
        const res = await fetch('/api/letters/' + l._id, { method: 'DELETE', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!res.ok) throw new Error('delete failed');
      } else {
        // local only
        removeLocalLetter(l);
      }
      // also remove from local storage in case it existed there
      removeLocalLetter(l);
      // update UI
      setLetters((s) => s.filter((x) => !((l._id && x._id === l._id) || (l._localId && x._localId === l._localId) || (l.createdAt && x.createdAt === l.createdAt && x.letterNo === l.letterNo))));
      alert('បានលុប');
    } catch (err) {
      console.error('delete error', err);
      alert('លុបមិនបាន');
    }
  };

  // load letters (extracted so other handlers can refresh)
  const loadLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/letters', {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        // try local fallback
        try {
          const local = JSON.parse(localStorage.getItem('localLetters') || '[]');
          setLetters(Array.isArray(local) ? local : []);
        } catch (_) {
          setLetters([]);
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      // assume API returns array of letters
      setLetters(Array.isArray(data) ? data : data.letters || []);
    } catch (e) {
      console.error('Failed to load letters', e);
      // try loading from localStorage as fallback
      try {
        const local = JSON.parse(localStorage.getItem('localLetters') || '[]');
        setLetters(Array.isArray(local) ? local : []);
      } catch (_) {
        setLetters([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLetters();
  }, [token]);

  // load persisted layout
  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem('lettersTableColWidths') || 'null');
      const rh = JSON.parse(localStorage.getItem('lettersTableRowHeight') || 'null');
      const lw = JSON.parse(localStorage.getItem('lettersTableLabelWidth') || 'null');
      const ar = JSON.parse(localStorage.getItem('lettersTableAutoRow') || 'null');
      if (Array.isArray(w) && w.length === defaultColWidths.length) setColWidths(w);
      if (typeof rh === 'number') setRowHeight(rh);
      if (typeof lw === 'number') setLabelColWidth(lw);
      if (typeof ar === 'boolean') setAutoRowHeight(ar);
    } catch (e) { /* ignore */ }
  }, []);

  // persist layout changes
  useEffect(() => {
    try {
      localStorage.setItem('lettersTableColWidths', JSON.stringify(colWidths));
      localStorage.setItem('lettersTableRowHeight', JSON.stringify(rowHeight));
      localStorage.setItem('lettersTableLabelWidth', JSON.stringify(labelColWidth));
      localStorage.setItem('lettersTableAutoRow', JSON.stringify(autoRowHeight));
    } catch (e) { }
  }, [colWidths, rowHeight, labelColWidth, autoRowHeight]);

  // column resize mouse handlers
  const startColResize = (index, e) => {
    e.preventDefault();
    resizingRef.current = { index, startX: e.clientX, startWidth: colWidths[index] || 80 };
    window.addEventListener('mousemove', onColMouseMove);
    window.addEventListener('mouseup', onColMouseUp);
  };

  const onColMouseMove = (e) => {
    const info = resizingRef.current;
    if (!info) return;
    const delta = e.clientX - info.startX;
    setColWidths((prev) => {
      const copy = prev.slice();
      copy[info.index] = Math.max(20, Math.round(info.startWidth + delta));
      return copy;
    });
  };

  const onColMouseUp = () => {
    resizingRef.current = null;
    window.removeEventListener('mousemove', onColMouseMove);
    window.removeEventListener('mouseup', onColMouseUp);
  };

  useEffect(() => {
    return () => {
      // cleanup on unmount
      window.removeEventListener('mousemove', onColMouseMove);
      window.removeEventListener('mouseup', onColMouseUp);
    };
  }, []);

  // auto-size a column to fit the widest text (header + body) on single line
  const autoSizeColumn = (index) => {
    try {
      const table = document.querySelector('table');
      if (!table) return;
      const measure = document.createElement('div');
      measure.style.position = 'absolute';
      measure.style.visibility = 'hidden';
      measure.style.whiteSpace = 'nowrap';
      measure.style.padding = '0';
      measure.style.margin = '0';
      document.body.appendChild(measure);

      let maxW = 0;
      const header = table.querySelectorAll('thead th')[index];
      if (header) {
        const hcs = getComputedStyle(header);
        measure.style.font = hcs.font || `${hcs.fontSize} ${hcs.fontFamily}`;
        measure.innerText = header.innerText || '';
        maxW = Math.max(maxW, measure.offsetWidth + parseFloat(hcs.paddingLeft || 0) + parseFloat(hcs.paddingRight || 0));
      }

      const rows = table.querySelectorAll('tbody tr');
      rows.forEach((r) => {
        const cell = r.children[index];
        if (!cell) return;
        const cs = getComputedStyle(cell);
        measure.style.font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
        measure.innerText = cell.innerText || '';
        const w = measure.offsetWidth + parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
        if (w > maxW) maxW = w;
      });

      document.body.removeChild(measure);
      const final = Math.max(20, Math.min(1200, Math.ceil(maxW) + 8));
      setColWidths((prev) => { const c = prev.slice(); c[index] = final; return c; });
    } catch (e) {
      console.warn('autoSize failed', e);
    }
  };

  // helper: format Date -> Khmer (e.g. "១៤ សីហា ២០២៥")
  const _khDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  const toKhmerNumber = (num) => String(num).split('').map(ch => (_khDigits[+ch] ?? ch)).join('');
  const formatDateKhmer = (isoOrDate) => {
    try {
      const d = isoOrDate ? new Date(isoOrDate) : new Date();
      if (isNaN(d)) return '';
      const day = toKhmerNumber(d.getDate());
      const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
      const month = months[d.getMonth()] || '';
      const year = toKhmerNumber(d.getFullYear());
      return `ថ្ងៃទី${day} ខែ${month} ឆ្នាំ${year}`;
    } catch (e) {
      return '';
    }
  };

  // helper: convert an Arabic-digit string to Khmer digits (leave non-digits unchanged)
  const toKhmerDigitsString = (s) => {
    if (!s && s !== 0) return '';
    return String(s).split('').map(ch => {
      if (ch >= '0' && ch <= '9') return _khDigits[parseInt(ch, 10)];
      return ch;
    }).join('');
  };

  // Derived status label for letters: treat 'completed' or truthy completed flag as ready
  const statusLabel = (s) => (s === 'completed' || s === 'ready' ? 'រួចរាល់' : 'រង់ចាំ');
  const statusStyle = (s) => (s === 'completed' || s === 'ready'
    ? 'bg-green-100 text-green-800 border border-green-300'
    : 'bg-orange-100 text-orange-800 border border-orange-300');

  const deriveStatus = (l) => {
    if (!l) return 'pending';
    // prefer explicit status if backend provides it
    if (l.status) return l.status;
    if (l.stage) return l.stage;
    // check common backend admin approval fields
    if (l.approvedByAdmin === true) return 'completed';
    if (l.adminApproved === true) return 'completed';
    if (l.approvedByAdminId) return 'completed';
    if (l.approvedAt) return 'completed';
    if (l.approvedBy && typeof l.approvedBy === 'object' && (l.approvedBy.role === 'admin' || l.approvedBy.isAdmin)) return 'completed';

    // explicit completed flag without admin approval is not sufficient
    return 'pending';
  };

  // Approve a letter as admin
  const approveLetter = async (ev, l) => {
    ev.stopPropagation();
    if (!l || !l._id) return alert('Cannot approve local item');
    if (!confirm('អនុម័តឯកសារនេះដោយជាអូបអាមីន?')) return;
    try {
      const res = await fetch('/api/letters/' + l._id + '/approve-admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ approvedByAdmin: true }) });
      if (!res.ok) throw new Error('approve failed');
      // refresh list
      await loadLetters();
      alert('បានអនុម័ត');
    } catch (err) {
      console.error('approve error', err);
      // fallback: if backend not available, mark locally
      try {
        const ok = updateLocalLetter({ ...l, approvedByAdmin: true });
        if (!ok) persistLocalLetters({ ...l, approvedByAdmin: true });
        await loadLetters();
        alert('បានអនុម័ត (offline)');
        return;
      } catch (e2) {
        console.error('local approve failed', e2);
      }
      alert('អនុម័តមិនបាន');
    }
  };

  // Save letter to backend (basic POST, attachments handled as names)
  const saveLetter = async () => {
    setSaving(true);
    try {
      const createdAtIso = form.createdAt && form.createdAt.length === 10 ? new Date(form.createdAt).toISOString() : (form.createdAt || new Date().toISOString());
      const payload = { ...form, createdAt: createdAtIso };

      // If editing an existing backend letter, use PUT to update
      if (form._id) {
        const res = await fetch('/api/letters/' + form._id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          // fallback to local update if backend update fails
          updateLocalLetter(payload);
          await loadLetters();
          setCreating(false);
          setShowPreview(false);
          alert('បានកែប្រែ (offline)');
        } else {
          await res.json();
          // update local store too (replace or add)
          persistLocalLetters(payload);
          await loadLetters();
          setCreating(false);
          setShowPreview(false);
          alert('បានកែប្រែ');
        }
        return;
      }

      // If this is a local-only item being edited (has _localId but no _id), update localStorage
      if (!form._id && form._localId) {
        const updated = { ...payload };
        const ok = updateLocalLetter(updated);
        if (!ok) persistLocalLetters(updated);
        await loadLetters();
        setCreating(false);
        setShowPreview(false);
        alert('បានកែប្រែ (lokal)');
        return;
      }

      // Otherwise create new
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // backend failed; persist locally and show as saved locally
        persistLocalLetters(payload);
        await loadLetters();
        setCreating(false);
        setShowPreview(false);
        alert('បានរក្សាទុក (offline)');
      } else {
        const created = await res.json();
        // if backend returned an id, attach it to local copy
        const saved = { ...payload, _id: created._id || payload._id };
        persistLocalLetters(saved);
        await loadLetters();
        setCreating(false);
        setShowPreview(false);
        alert('បានរក្សាទុក');
      }
    } catch (err) {
      console.error('Save error', err);
      // attempt local persist on unexpected error
      try {
        const createdAtIso = form.createdAt && form.createdAt.length === 10 ? new Date(form.createdAt + 'T00:00:00').toISOString() : (form.createdAt || new Date().toISOString());
        const payload = { ...form, createdAt: createdAtIso };
        // when error, update local copy if editing, else persist
        if (payload._localId) {
          updateLocalLetter(payload);
        } else {
          persistLocalLetters(payload);
        }
        await loadLetters();
        setCreating(false);
        setShowPreview(false);
        alert('បានរក្សាទុក (offline)');
        return;
      } catch (e2) {
        console.error('offline save failed', e2);
      }
      alert('រក្សាទុកមិនបាន');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const previewEl = contentRef.current;
    if (!previewEl) {
      alert('មិនមានអ្វីធ្វើព្រីន');
      return;
    }
    // use innerHTML so wrapper provides the exact A4 panel (avoid nested A4 sizing)
    const content = previewEl.innerHTML;

    const win = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,width=900,height=800');
    if (win) {
      try {
        win.document.open();
        win.document.write(a4Wrapper(content));
        win.document.close();
        win.focus();
        // allow render then print
        setTimeout(() => {
          try { win.print(); } catch (e) { console.error('print error', e); }
          try { win.close(); } catch (_) { }
        }, 300);
        return;
      } catch (e) {
        console.error('Popup print failed', e);
        try { win.close(); } catch (_) { }
      }
    }

    // fallback iframe (also uses innerHTML)
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);
      const idoc = iframe.contentDocument || iframe.contentWindow.document;
      idoc.open();
      idoc.write(a4Wrapper(content));
      idoc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error('Iframe print failed', err);
          alert('Print failed — please allow popups or try Export Word.');
        }
        setTimeout(() => { try { iframe.remove(); } catch (_) { } }, 700);
      }, 400);
    } catch (err) {
      console.error('Print fallback failed', err);
      alert('Print failed — please allow popups or try Export Word.');
    }
  };

  // shared A4 wrapper used for printing/exporting so pages render on A4 with margins
  const a4Wrapper = (innerHtml) => {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@300;400;700&display=swap" rel="stylesheet"><style>
      @page { size: A4; margin: 20mm; }
      html,body{height:100%; margin:0; padding:0;}
      body{
        font-family:"Noto Sans Khmer", "Khmer OS", Arial, serif;
        color:#000;
        margin:0;
        padding:0;
        display:block;
        background: #fff;
      }
      /* exact A4 panel: use fixed height so print shows one page */
      .a4-container { box-sizing: border-box; width:8.27in; height:11.69in; padding:12mm; background:#fff; margin:0 auto; overflow:hidden; }
      /* ensure important blocks don't break */
      .a4-container .doc-sign, .a4-container p, .a4-container h1, .a4-container h2 { break-inside: avoid; page-break-inside: avoid; }
      @media print {
        html,body { height: auto; }
        .a4-container { box-shadow:none; margin:0; page-break-after:avoid; }
      }
    </style></head><body><div class="a4-container">${innerHtml}</div></body></html>`;
  };

  // letter templates (គំរូ លិខិត) — user wants 4 templates
  const templates = [
    {
      id: 1,
      name: 'ផ្នែកស្នើ',
      ministry: '',
      department: '',
      subject: '',
      recipient: '',
      body: '',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកផ្នែក',
      signName: '',
    },
    {
      id: 2,
      name: 'លិខិតទី២',
      ministry: 'ក្រសួង B',
      department: 'អង្គភាព B',
      subject: 'សេចក្តីព្រោងចិត្ត B',
      recipient: 'អភិបាល',
      body: 'ខ្លឹមសារលិខិតទី២...',
      signPlace: 'កំពង់ឆ្នាំង',
      signTitle: 'អនុប្រធាន',
      signName: 'ជា សុផល',
    },
    {
      id: 3,
      name: 'លិខិតទី៣',
      ministry: 'ក្រសួង C',
      department: 'អង្គភាព C',
      subject: 'ការណែនាំ C',
      recipient: 'ប្រធាន',
      body: 'ខ្លឹមសារលិខិតទី៣...',
      signPlace: 'សៀមរាប',
      signTitle: 'ប្រធាន',
      signName: 'លី សុភាព',
    },
    {
      id: 4,
      name: 'លិខិតទី៤',
      ministry: 'ក្រសួង D',
      department: 'អង្គភាព D',
      subject: 'សេចក្តីប្រកាស D',
      recipient: 'នាយកដ្ឋាន',
      body: 'ខ្លឹមសារលិខិតទី៤...',
      signPlace: 'បាត់ដំបង',
      signTitle: 'នាយក',
      signName: 'ស៊ិន សុផល',
    },
    {
      id: 5,
      name: 'លិខិតបង្គាប់ការ (មាតុភាព)',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ',
      recipient: '- លិខិតអនុញ្ញាតលេខ ...... ចុះថ្ងៃទី... ខែ... ឆ្នាំ... \n- តាមការចាំបាច់របស់មន្ទីរពេទ្យ',
      body: 'លោកស្រី ...... ជា...... បន្ទាប់ពីសម្រាកលំហែមាតុភាព ត្រូវបានចាត់ឱ្យចូលបម្រើការនៅ ផ្នែក...... វិញចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។\n\nការិយាល័យរដ្ឋបាលនិងបុគ្គលិក - ការិយាល័យបច្ចេកទេស - ការិយាល័យហិរញ្ញវត្ថុ - ផ្នែកពាក់ព័ន្ធនានា - សាមីខ្លួន ត្រូវអនុវត្តតាមលិខិតបង្គាប់ការនេះ ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: 'សាស្ត្រាចារ្យ ងី ម៉េង',
    },
  ];

  const applyTemplate = (t) => {
    setForm((s) => ({ ...s, letterNo: '', dateText: 'ថ្ងៃ...... ខែ...... ឆ្នាំ......', ...t, attachments: [] }));
    setCreating(true);
    setShowPreview(true);
  };

  const onRowClick = (l) => {
    // map backend letter to form shape (preserve ids when present)
    const mapped = {
      _id: l._id || '',
      _localId: l._localId || '',
      letterNo: l.letterNo || '',
      dateText: l.dateText || (l.createdAt ? new Date(l.createdAt).toLocaleDateString() : ''),
      ministry: l.ministry || '',
      department: l.department || '',
      subject: l.subject || '',
      recipient: l.recipient || '',
      body: l.body || '',
      signPlace: l.signPlace || '',
      signTitle: l.signTitle || '',
      signName: l.signName || '',
      attachments: l.attachments || [],
      requesterSection: l.requesterSection || (l.createdBy && (l.createdBy.department || '')) || '',
      requesterName: l.requesterName || (l.createdBy && (l.createdBy.fullName || l.createdBy.name)) || '',
      reference: l.reference || '',
      createdBy: l.createdBy || '',
      createdAt: l.createdAt ? (new Date(l.createdAt)).toISOString().slice(0, 10) : ''
    };
    setForm(mapped);
    setCreating(true);
    setShowPreview(true);
    // mark as seen when opening the preview/editor
    try {
      const id = l && (l._id || l._localId || l.id);
      if (id) {
        const ts = (l && (l.updatedAt || l.createdAt)) ? new Date(l.updatedAt || l.createdAt).getTime() : Date.now();
        localStorage.setItem(`lastSeenLetter_${id}`, String(ts));
      }
    } catch (e) { /* ignore */ }
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    // store names locally; real upload handled separately when saving
    setForm((s) => ({ ...s, attachments: files.map((f) => f.name) }));
  };

  const refreshPreview = () => {
    // force a remount of the preview content so printed/exported HTML uses latest state
    setShowPreview(false);
    setTimeout(() => {
      setPreviewKey((k) => k + 1);
      setShowPreview(true);
    }, 0);
  };

  // REPLACE handleExportWord to use innerHTML (exact preview content only)
  const handleExportWord = () => {
    try {
      const previewEl = contentRef.current;
      const content = previewEl ? previewEl.innerHTML : (contentRef.current?.innerHTML || '');
      const doc = a4Wrapper(content);
      const blob = new Blob([doc], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (toKhmerDigitsString(form.letterNo) || 'letter') + '.doc';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Export failed');
    }
  };

  const handleChange = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="p-2 bg-gray-400 min-h-screen">
      {!creating ? (
        <div className="bg-white w-full border border-gray-100 mx-0 px-2 py-3 shadow-md" style={{ borderRadius: 4 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">តារាងឯកសារ</h2>
            <button
              className="px-3 py-1 bg-green-600 text-white rounded"
              onClick={() => {
                setCreating(true);
                setShowPreview(true);
              }}
            >
              បង្កើត
            </button>
          </div>

          {/* Template selector: click to apply a template and open editor/preview */}
          <div className="mb-4 flex gap-2 items-center">
            <span className="font-medium">គំរូលិខិត:</span>
            {templates.map((t) => (
              <button
                key={t.id}
                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                onClick={() => applyTemplate(t)}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center gap-4">
            <label className="text-sm">Row height:</label>
            <input type="range" min={28} max={120} value={rowHeight} disabled={autoRowHeight} onChange={(e) => setRowHeight(Number(e.target.value))} />
            <span className="text-xs">{rowHeight}px</span>
            <label className="ml-2 text-sm flex items-center"><input type="checkbox" checked={autoRowHeight} onChange={(e) => setAutoRowHeight(e.target.checked)} className="mr-1" />Auto row height</label>
            <label className="ml-4 text-sm">Preview label width:</label>
            <input type="range" min={40} max={180} value={labelColWidth} onChange={(e) => setLabelColWidth(Number(e.target.value))} />
            <span className="text-xs">{labelColWidth}px</span>
            <button className="ml-4 px-2 py-1 bg-gray-200 rounded text-sm" onClick={() => {
              setColWidths(defaultColWidths.slice());
              setRowHeight(40);
              setLabelColWidth(70);
              setAutoRowHeight(true);
            }}>Reset layout</button>
          </div>

          <div className="overflow-x-auto w-full px-2">
            <table className="w-full border table-fixed text-sm bg-white" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="bg-gray-50 text-sm">
                  {['ល.រ', 'ផ្នែក', 'លេខលិខិត', 'កម្មវត្ថុ', 'យោង', 'ខ្លឹមសារ', 'ទីតាំងចុះឈ្មោះ', 'ភ្ជាប់ឯកសារ', 'ហត្ថលេខា', 'កាលបរិច្ឆេទបង្កើត', 'ស្ថានភាព', 'សកម្មភាព'].map((h, i) => (
                    <th
                      key={i}
                      className="border px-4 py-3 text-center text-sm font-semibold text-gray-700 relative"
                      style={{ width: colWidths[i] }}
                      title={`Double-click to auto-size column to content`}
                      onDoubleClick={() => autoSizeColumn(i)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div>{h}</div>
                      </div>
                      {/* resizer handle */}
                      <div
                        onMouseDown={(e) => startColResize(i, e)}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'col-resize', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <div style={{ width: 2, height: '60%', background: 'rgba(0,0,0,0.12)', borderRadius: 1 }} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="border px-4 py-6 text-center">Loading...</td>
                  </tr>
                ) : letters.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="border px-4 py-6 text-center">មិនមានទិន្នន័យ</td>
                  </tr>
                ) : (
                  letters.map((l, idx) => (
                    <tr key={l._id || idx} className="hover:bg-gray-50" style={autoRowHeight ? {} : { height: rowHeight }}>
                      <td className="border px-4 py-3 align-middle text-sm text-center" style={{ width: colWidths[0] }}>{idx + 1}</td>
                      <td className="border px-4 py-3 align-middle text-sm" style={{ width: colWidths[1] }}>{l.department || '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm" style={{ width: colWidths[2] }}>{l.letterNo ? toKhmerDigitsString(l.letterNo) : '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm" style={{ width: colWidths[3] }}>{l.subject || '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm" style={{ width: colWidths[4] }}>{l.recipient || '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm" style={{ width: colWidths[5], overflowWrap: 'break-word', whiteSpace: autoRowHeight ? 'normal' : 'nowrap', textOverflow: 'ellipsis' }}>{l.body ? (l.body.length > 120 ? l.body.slice(0, 120) + '...' : l.body) : '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm" style={{ width: colWidths[6] }}>{l.signPlace || '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm" style={{ width: colWidths[7] }}>{(l.attachments && l.attachments.length) ? l.attachments.join(', ') : '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm" style={{ width: colWidths[8] }}>{(l.signName || '-')}</td>
                      <td className="border px-4 py-3 align-middle text-sm" style={{ width: colWidths[9] }}>{l.createdAt ? new Date(l.createdAt).toLocaleString() : '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm text-center" style={{ width: colWidths[10] }}>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${statusStyle(deriveStatus(l))}`}>
                          {statusLabel(deriveStatus(l))}
                        </span>
                      </td>
                      <td className="border px-4 py-3 text-center" style={{ width: colWidths[11] }}>
                        <div className="flex gap-2 justify-center items-center">
                          <button onClick={(ev) => { ev.stopPropagation(); onRowClick(l); }} title="កែ" className="w-8 h-6 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white text-xs rounded-full">កែ</button>
                          {(perms.canViewDocuments || perms.canViewFiles) ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <button onClick={(ev) => { ev.stopPropagation(); try { const id = l && (l._id || l._localId || l.id); if (id) { const ts = (l && (l.updatedAt || l.createdAt)) ? new Date(l.updatedAt || l.createdAt).getTime() : Date.now(); localStorage.setItem(`lastSeenLetter_${id}`, String(ts)); } } catch (e) { }; navigate('/documents/' + (l._id || l._localId)); }} title="មើល" className="w-8 h-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-full">មើល</button>
                              {/* New badge: shown when this letter's timestamp is newer than last seen */}
                              {(() => {
                                try {
                                  const id = l && (l._id || l._localId || l.id);
                                  if (!id) return null;
                                  const ts = (l && (l.updatedAt || l.createdAt)) ? new Date(l.updatedAt || l.createdAt).getTime() : 0;
                                  const seen = Number(localStorage.getItem(`lastSeenLetter_${id}`) || '0');
                                  if (ts > 0 && ts > seen) {
                                    return (
                                      <span title="ថ្មី" style={{ position: 'absolute', top: -6, right: -6, display: 'inline-block' }}>
                                        <span style={{ display: 'inline-block', background: '#e11d48', color: '#fff', padding: '2px 6px', borderRadius: 12, fontSize: 11, fontWeight: 700, boxShadow: '0 0 0 rgba(225,29,72,0.7)', animation: 'pulseBadgeLetter 1.6s infinite' }}>ថ្មី</span>
                                        <style>{`@keyframes pulseBadgeLetter { 0% { box-shadow: 0 0 0 0 rgba(225,29,72,0.6); } 70% { box-shadow: 0 0 0 8px rgba(225,29,72,0); } 100% { box-shadow: 0 0 0 0 rgba(225,29,72,0); } }`}</style>
                                      </span>
                                    );
                                  }
                                } catch (e) { /* ignore */ }
                                return null;
                              })()}
                            </div>
                          ) : (
                            <button disabled title="មើល" className="w-8 h-6 flex items-center justify-center bg-gray-300 text-white text-xs rounded-full opacity-50">មើល</button>
                          )}
                          {/* Approve button visible to admins */}
                          {(perms.canManageUsers || perms.canApproveHR) && deriveStatus(l) !== 'completed' && (
                            <button onClick={(ev) => approveLetter(ev, l)} title="អនុម័ត" className="w-8 h-6 flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-full">អនុម័ត</button>
                          )}
                          <button onClick={(ev) => deleteLetter(ev, l)} title="លុប" className="w-8 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white text-xs rounded-full">លុប</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gray-400 min-h-screen">
          <div className={`mx-auto flex gap-8 w-full ${fullView ? '' : 'max-wl'} items-start`}>
            {!fullView && (
              <div className="bg-white w-full border border-gray-100 mx-2 px-4 py-4 shadow-md" style={{ width: '390px', minWidth: '660px', minHeight: '11.69in', overflowY: 'auto' }}>
                <h4 className="text-sm block mb-3 text-blue-900 font-bold text-center" style={{ fontSize: '22px' }}>បំពេញព័ត៍មាន</h4>

                <label className="text-sm block mb- text-blue-900 font-bold " style={{ fontSize: '18px' }}>លេខលិខិត</label>
                <input value={form.letterNo} onChange={handleChange('letterNo')} className="w-full border p-3 mb-3" />

                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>ផ្នែក</label>
                <input value={form.department} onChange={handleChange('department')} className="w-full border p-3 mb-3" />

                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>កម្មវត្ថុ</label>
                <input value={form.subject} onChange={handleChange('subject')} className="w-full border p-3 mb-3" />

                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>យោង</label>
                <input value={form.recipient} onChange={handleChange('recipient')} className="w-full border p-3 mb-3" />

                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>ខ្លឹមសារ</label>
                <textarea value={form.body} onChange={handleChange('body')} className="w-full border p-3 mb-3 h-32" />
                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>ទីតាំងចុះឈ្មោះ</label>
                <input value={form.signPlace} onChange={handleChange('signPlace')} className="w-full border p-3 mb-3" />
                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>កាលបរិច្ឆេទបង្កើត</label>
                <input type="date" value={form.createdAt || ''} onChange={handleChange('createdAt')} className="w-full border p-3 mb-3" />
                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>តំណែងអ្នកចុះឈ្មោះ (sign title)</label>
                <input value={form.signTitle} onChange={handleChange('signTitle')} className="w-full border p-3 mb-3" />

                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>ឈ្មោះអ្នកចុះឈ្មោះ (sign name)</label>
                <input value={form.signName} onChange={handleChange('signName')} className="w-full border p-3 mb-3" />

                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>ភ្ជាប់ឯកសារ</label>
                <input type="file" multiple onChange={handleFilesChange} className="w-full mb-3" />

                <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>អ្នកបង្កើត</label>
                <input value={form.createdBy} onChange={handleChange('createdBy')} className="w-full border p-3 mb-3" />



                <div className="flex gap-2 mt-4">
                  <button onClick={() => setCreating(false)} className="px-4 py-2 bg-blue-600 text-white">បោះបង់</button>

                </div>
              </div>
            )}

            <div className="self-start" style={{ flex: 1, paddingRight: '10px' }}>
              {showPreview ? (
                <div>
                  <div className="mb-2 flex gap-2 justify-end no-print">
                    <button onClick={handlePrint} className="px-3 py-1 bg-gray-600 text-white rounded">Print</button>
                    <button onClick={saveLetter} disabled={saving} className="px-3 py-1 bg-green-600 text-white rounded">{saving ? 'Saving...' : 'រក្សាទុក'}</button>
                    <button onClick={handleExportWord} className="px-3 py-1 bg-indigo-600 text-white rounded">Export Word (.doc)</button>
                  </div>

                  <div className="w-full flex justify-center">
                    <div
                      key={previewKey}
                      ref={contentRef}
                      style={{
                        width: '8.27in',
                        minHeight: '11.69in',
                        background: '#fcfbfbff',
                        padding: '10mm',
                        boxSizing: 'border-box',
                        margin: '0',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                        fontFamily: 'Khmer OS, Arial, serif',
                        color: '#000',
                      }}
                    >
                      {/* Inline styles included so export/print keep layout */}
                      <style>{`
                    .doc-header { text-align: center; font-weight: normal; padding: 0px 0px; }
                    .doc-top { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 17px; }
                    .doc-top1 { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 16px; padding: 4px 6px; }
                    .doc-top2 {text-align: left;padding: 0;font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif;align-self: start;font-size: 15px; text-align: left;padding: 0px 0px;}
                    .doc-top3 { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 15px; text-align: left;padding: 2px 0px; }
                    .doc-top5 { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 15px; text-align: center;padding: 5px 6px; }
                    .doc-title { margin-top: 8px; font-size: 15px; }

                    /* NEW: use grid so labels and values align vertically */
                    .doc-row {
                      display: grid;
                      grid-template-columns: ${labelColWidth}px 1fr; /* adjustable label column */
                      column-gap: 0px;
                      row-gap: 6px;
                      margin-top: 20px;
                      align-items: start;
                    }
                    .doc-label {
                      text-align: left;
                      padding: 0;
                      font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif;
                      font-size: 16px;
                      align-self: start;
                    }
                    .doc-value1, .doc-value {padding: 0;margin: 0;font-family: "Khmer OS Siemreap","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
                      font-size: 18px;text-align: justify;overflow-wrap: break-word;word-break: break-word;
                    }

                    /* Hanging-indent / safe-wrap for body paragraphs (keep previous behavior) */
                    .doc-body { padding-left: 3px; text-indent: ${labelColWidth}px; font-family: "Khmer OS Siemreap","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-weight: normal; font-size: 18px; margin: 0px 0 px; text-align: justify;padding: 20px 1px;  }
                    .doc-value2 { padding-left: 3px; text-indent: -7px; font-family: "Khmer OS Siemreap","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-weight: normal; font-size: 18px; margin: 0px 0 px; text-align: justify;padding: 5px 1px;  }
                    .doc-value3 { padding-left: 3px; text-indent: -7px; font-family: "Khmer OS Siemreap","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-weight: bold; font-size: 16px; margin: 0px 0 px; text-align: justify;padding: 5px 1px;  }
                    .doc-body1 { padding-left: 3px; text-indent: 70px; font-family: "Khmer OS Siemreap","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-weight: normal; font-size: 18px; margin: 0px 0 px; text-align: justify;padding: px 1px;  }
                    /* Center place/date and signature block for print layout (force center) */
                    .doc-sign {
                      margin-top: 20px;
                      display: block;
                      width: 100%;
                      text-align: right !important;
                      margin-left: auto;
                      margin-right: auto;
                    }
                    .doc-sign .place-date {font-family: "Khmer OS Siemreap"; text-indent: ${labelColWidth * 4}px; margin-bottom: 8px; text-align: center !important; display:block; width:100%; }
                    .doc-sign .sign-title {font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif;
                      font-size: 16px; text-indent: ${labelColWidth * 4}px; margin-top: 0px; font-weight: normal; text-align: center !important; display:block; width:100%; }
                    .doc-sign .sign-name {font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif;
                      font-size: 16px; text-indent: ${labelColWidth * 4}px; margin-top: 110px; text-align: center !important; display:block; width:100%; }
                    .doc-strong { font-weight: 800; }
                  `}</style>

                      <div className="doc-header">
                        <div className="doc-top">ព្រះរាជាណាចក្រកម្ពុជា</div>
                        <div className="doc-top1">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                        <div className="doc-top2">មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
                        <div className="doc-top3" style={{ fontSize: 15 }}>{form.department}</div>
                        <div className="doc-top3">លេខ <span className="doc-value3">{form.letterNo ? toKhmerDigitsString(form.letterNo) : '...........'}</span></div>
                        <div className="doc-top5" style={{ fontSize: 15 }}>{form.department}</div>
                        <div className="doc-top5">សូមគោរពជូន</div>
                        <div className="doc-top5">លោកនាយកមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
                      </div>

                      <div className="doc-row">
                        <div className="doc-label">កម្មវត្ថុ៖</div>
                        <div className="doc-value1">{form.subject}</div>
                      </div>

                      <div className="doc-row">
                        <div className="doc-label">យោង៖</div>
                        <div className="doc-value1">{form.recipient}</div>
                      </div>

                      <div className="doc-body">
                        {/* Use pre-line so line breaks in body are preserved */}
                        <div style={{ whiteSpace: 'pre-line' }}>សេចក្ដីដូចមានចែងក្នុងកម្មវត្ថុ និងយោងខាងលើ ខ្ញុំបាទសូមគោរពជម្រាបជូន លោកនាយក មេត្តាជ្រាបថា ៖ {form.body}</div>
                      </div>
                      <div className="doc-body1">
                        <p>
                          អាស្រ័យដូចបានគោរពជម្រាបជូនខាងលើសូម លោកនាយក មេត្តាពិនិត្យនិងសម្រេចដោយក្តីអនុគ្រោះ។
                        </p>
                        <p style={{ padding: '15px 0px' }}>
                          សូម លោកនាយក មេត្តាទទួលនូវការគោរពដ៏ខ្ពង់ខ្ពស់ពីខ្ញុំបាទ ។
                        </p>
                      </div>
                      <div className="doc-sign">
                        <div className="place-date">{form.signPlace}, {formatDateKhmer(form.createdAt)}</div>
                        <div className="sign-title">{form.signTitle}</div>
                        <div className="sign-name">{form.signName}</div>
                      </div>

                      {form.attachments && form.attachments.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                          <strong>ភ្ជាប់ឯកសារ:</strong>
                          <ul>
                            {form.attachments.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* buttons moved above preview for easier access */}
                </div>
              ) : (
                <div className="p-8 text-center">ចុច "បង្ហាញទិន្នន័យ" ដើម្បីមើល</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

