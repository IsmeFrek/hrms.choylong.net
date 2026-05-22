import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import usePermission from '../hooks/usePermission';
import { useAuth } from '../context/AuthContext';

// InstructionLetterPage component — shows documents table first, opens editor+preview on "បង្កើត"
export default function InstructionLetterPage() {
  const { token } = useAuth();
  const contentRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateBg, setShowTemplateBg] = useState(true);

  const [form, setForm] = useState({
    _id: '',
    _localId: '',
    letterNo: '',
    dateText: '',
    ministry: 'ក្រសួងសុខាភិបាល',
    department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
    subject: 'លិខិតបង្គាប់ការ',
    recipient: '- តាមការចាំបាច់របស់មន្ទីរពេទ្យ',
    body: 'ខ្លឹមសារលិខិត...',
    signPlace: 'រាជធានីភ្នំពេញ',
    signTitle: 'នាយកមន្ទីរពេទ្យ',
    signName: 'សាស្ត្រាចារ្យ ងី ម៉េង',
    requesterSection: '',
    requesterName: '',
    createdBy: 'Admin',
    createdAt: '',
    reference: '',
    attachments: [],
  });

  const [letters, setLetters] = useState([]);
  const defaultColWidths = [40, 160, 120, 180, 150, 260, 140, 160, 140, 180, 100, 150];
  const [colWidths, setColWidths] = useState(defaultColWidths);
  const resizingRef = useRef(null);
  const [rowHeight, setRowHeight] = useState(48);
  const [autoRowHeight, setAutoRowHeight] = useState(true);
  const [labelColWidth, setLabelColWidth] = useState(70);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [fullView, setFullView] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateType = searchParams.get('template');
  const perms = usePermission();

  const hasAccess = () => {
    if (perms.isAdmin) return true;
    if (!templateType) return perms.canViewDocuments;
    if (templateType === 'maternity') return perms.canViewMaternityLeaveReport;
    if (templateType === 'resignation') return perms.canViewResignationLetter;
    if (templateType === 'onboarding') return perms.canViewOnboardingLetter;
    if (templateType === 'appointment') return perms.canViewAppointmentLetter;
    if (templateType === 'termination') return perms.canViewTerminationLetter;
    if (templateType === 'others') return perms.canViewOtherLetters;
    return false;
  };

  const canEditAccess = () => {
    if (perms.isAdmin) return true;
    if (!templateType) return perms.canEditDocuments;
    if (templateType === 'maternity') return perms.canEditMaternityLeaveReport;
    if (templateType === 'resignation') return perms.canEditResignationLetter;
    if (templateType === 'onboarding') return perms.canEditOnboardingLetter;
    if (templateType === 'appointment') return perms.canEditAppointmentLetter;
    if (templateType === 'termination') return perms.canEditTerminationLetter;
    if (templateType === 'others') return perms.canEditOtherLetters;
    return false;
  };

  if (!hasAccess()) {
    return (
      <div className="p-6 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12 bg-white px-8 rounded-lg shadow-md border border-red-100">
          <h2 className="text-xl font-semibold text-red-600">គ្មានសិទ្ធិអនុញ្ញាត (Permission required)</h2>
          <p className="text-gray-600 mt-2">អ្នកមិនមានសិទ្ធិមើលឯកសារគំរូនេះទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ។</p>
        </div>
      </div>
    );
  }

  const persistLocalLetters = (letter) => {
    try {
      const cur = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
      const withId = { ...letter, _localId: letter._localId || (Date.now() + '-' + Math.random().toString(36).slice(2, 8)) };
      const idx = cur.findIndex((x) => x._localId && withId._localId && x._localId === withId._localId);
      if (idx >= 0) {
        cur[idx] = withId;
      } else {
        cur.unshift(withId);
      }
      localStorage.setItem('localInstructionLetters', JSON.stringify(cur));
    } catch (err) {
      console.warn('local persist failed', err);
    }
  };

  const updateLocalLetter = (letter) => {
    try {
      const cur = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
      const idx = cur.findIndex((x) => x._localId && letter._localId && x._localId === letter._localId);
      if (idx >= 0) {
        cur[idx] = { ...cur[idx], ...letter };
        localStorage.setItem('localInstructionLetters', JSON.stringify(cur));
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
      const cur = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
      const filtered = cur.filter((x) => {
        if (match._localId && x._localId) return x._localId !== match._localId;
        if (match.createdAt && match.letterNo) return !(x.createdAt === match.createdAt && x.letterNo === match.letterNo);
        return true;
      });
      localStorage.setItem('localInstructionLetters', JSON.stringify(filtered));
    } catch (err) {
      console.warn('remove local failed', err);
    }
  };

  const deleteLetter = async (e, l) => {
    e.stopPropagation();
    if (!confirm('លុបឯកសារនេះ?')) return;
    try {
      if (l._id) {
        const res = await fetch('/api/letters/' + l._id, { method: 'DELETE', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!res.ok) throw new Error('delete failed');
      } else {
        removeLocalLetter(l);
      }
      removeLocalLetter(l);
      setLetters((s) => s.filter((x) => !((l._id && x._id === l._id) || (l._localId && x._localId === l._localId) || (l.createdAt && x.createdAt === l.createdAt && x.letterNo === l.letterNo))));
      alert('បានលុប');
    } catch (err) {
      console.error('delete error', err);
      alert('លុបមិនបាន');
    }
  };

  const loadLetters = async () => {
    setLoading(true);
    try {
      // For now, we use the same letters API but we could filter by type or use a different endpoint
      const res = await fetch('/api/letters?type=instruction', {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        try {
          const local = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
          setLetters(Array.isArray(local) ? local : []);
        } catch (_) {
          setLetters([]);
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setLetters(Array.isArray(data) ? data : data.letters || []);
    } catch (e) {
      console.error('Failed to load letters', e);
      try {
        const local = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
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

  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem('instructionLettersTableColWidths') || 'null');
      const rh = JSON.parse(localStorage.getItem('instructionLettersTableRowHeight') || 'null');
      const lw = JSON.parse(localStorage.getItem('instructionLettersTableLabelWidth') || 'null');
      const ar = JSON.parse(localStorage.getItem('instructionLettersTableAutoRow') || 'null');
      if (Array.isArray(w) && w.length === defaultColWidths.length) setColWidths(w);
      if (typeof rh === 'number') setRowHeight(rh);
      if (typeof lw === 'number') setLabelColWidth(lw);
      if (typeof ar === 'boolean') setAutoRowHeight(ar);
    } catch (e) { }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('instructionLettersTableColWidths', JSON.stringify(colWidths));
      localStorage.setItem('instructionLettersTableRowHeight', JSON.stringify(rowHeight));
      localStorage.setItem('instructionLettersTableLabelWidth', JSON.stringify(labelColWidth));
      localStorage.setItem('instructionLettersTableAutoRow', JSON.stringify(autoRowHeight));
    } catch (e) { }
  }, [colWidths, rowHeight, labelColWidth, autoRowHeight]);

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
      window.removeEventListener('mousemove', onColMouseMove);
      window.removeEventListener('mouseup', onColMouseUp);
    };
  }, []);

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

  const toKhmerDigitsString = (s) => {
    if (!s && s !== 0) return '';
    return String(s).split('').map(ch => {
      if (ch >= '0' && ch <= '9') return _khDigits[parseInt(ch, 10)];
      return ch;
    }).join('');
  };

  const statusLabel = (s) => (s === 'completed' || s === 'ready' ? 'រួចរាល់' : 'រង់ចាំ');
  const statusStyle = (s) => (s === 'completed' || s === 'ready'
    ? 'bg-green-100 text-green-800 border border-green-300'
    : 'bg-orange-100 text-orange-800 border border-orange-300');

  const deriveStatus = (l) => {
    if (!l) return 'pending';
    if (l.status) return l.status;
    if (l.stage) return l.stage;
    if (l.approvedByAdmin === true) return 'completed';
    return 'pending';
  };

  const saveLetter = async () => {
    setSaving(true);
    try {
      const createdAtIso = form.createdAt && form.createdAt.length === 10 ? new Date(form.createdAt).toISOString() : (form.createdAt || new Date().toISOString());
      const payload = { ...form, createdAt: createdAtIso, type: 'instruction' };

      if (form._id) {
        const res = await fetch('/api/letters/' + form._id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          updateLocalLetter(payload);
          await loadLetters();
          setCreating(false);
          setShowPreview(false);
          alert('បានកែប្រែ (offline)');
        } else {
          await res.json();
          persistLocalLetters(payload);
          await loadLetters();
          setCreating(false);
          setShowPreview(false);
          alert('បានកែប្រែ');
        }
        return;
      }

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

      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        persistLocalLetters(payload);
        await loadLetters();
        setCreating(false);
        setShowPreview(false);
        alert('បានរក្សាទុក (offline)');
      } else {
        const created = await res.json();
        const saved = { ...payload, _id: created._id || payload._id };
        persistLocalLetters(saved);
        await loadLetters();
        setCreating(false);
        setShowPreview(false);
        alert('បានរក្សាទុក');
      }
    } catch (err) {
      console.error('Save error', err);
      try {
        const createdAtIso = form.createdAt && form.createdAt.length === 10 ? new Date(form.createdAt + 'T00:00:00').toISOString() : (form.createdAt || new Date().toISOString());
        const payload = { ...form, createdAt: createdAtIso, type: 'instruction' };
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
    const content = previewEl.innerHTML;
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(s => s.outerHTML).join('\n');
    const win = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,width=900,height=800');
    if (win) {
      try {
        win.document.open();
        win.document.write(a4Wrapper(content, styles));
        win.document.close();
        win.focus();
        setTimeout(() => {
          try { win.print(); } catch (e) { }
          try { win.close(); } catch (_) { }
        }, 300);
        return;
      } catch (e) {
        try { win.close(); } catch (_) { }
      }
    }
  };

  const a4Wrapper = (innerHtml, styles = '') => {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@300;400;700&display=swap" rel="stylesheet"><style>
      @page { size: A4; margin: 0; }
      html,body{height:100%; margin:0; padding:0;}
      body{
        font-family:"Noto Sans Khmer", "Khmer OS", Arial, serif;
        color:#000;
        margin:0;
        padding:0;
        display:block;
        background: #fff;
      }
      .a4-container { box-sizing: border-box; width:8.27in; min-height:11.69in; padding: 5mm 18mm 5mm 28mm; background:#fff; margin:0 auto; overflow:hidden; position: relative; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .a4-container .doc-sign, .a4-container p, .a4-container h1, .a4-container h2 { break-inside: avoid; page-break-inside: avoid; }
      @media print {
        html,body { height: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
        .a4-container { box-shadow:none; margin:0; width: 100%; height: 100%; min-height: 100%; overflow: visible; page-break-after:avoid; }
      }
    </style></head><body><div class="a4-container">${innerHtml}</div></body></html>`;
  };

  const templates = [
    {
      id: 1,
      name: 'មាតុភាព (បន្ទាប់ពីមាតុភាពវិញ)',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ',
      recipient: 'លិខិតអនុញ្ញាតលេខ ...... ចុះថ្ងៃ...... ទី...... ខែ...... ឆ្នាំ...... របស់ក្រសួងសុខាភិបាល ស្តីពី “ការអនុញ្ញាតឱ្យសម្រាកលំហែមាតុភាពរបស់ លោកស្រី ...... “។',
      body: '\tលោកស្រី ...... ជា ...... (......) បន្ទាប់ពីសម្រាកលំហែមាតុភាពមក ត្រូវបានចាត់ឲ្យចូលបំរើការនៅ ផ្នែក...... វិញ ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។\n\n\tការិយាល័យរដ្ឋបាល និងបុគ្គលិក-ការិយាល័យបច្ចេកទេស-ការិយាល័យហិរញ្ញវត្ថុ-ផ្នែកពាក់ព័ន្ធនានា-សាមីខ្លួន ត្រូវអនុវត្តតាមលិខិតបង្គាប់ការនេះ ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។\n\nចម្លងជូន:\n- ការិយាល័យទាំងបី\n- ផ្នែកពាក់ព័ន្ធ\n- ផ្នែកសេវា\n    “ជ្រាបជាព័ត៌មាន“\n- សាមីខ្លួន \n    “ដើម្បីអនុវត្ត”\n- ឯកសារ-កាលប្បវត្តិ',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: 'សាស្ត្រាចារ្យ ងី ម៉េង',
    },
    {
      id: 2,
      name: 'លិខិតអនុញ្ញាតឲ្យឈប់ពីការងារ',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតអនុញ្ញាតឲ្យឈប់ពីការងារ',
      recipient: '- យោងតាមពាក្យសុំឈប់ពីការងាររបស់សាមីខ្លួនចុះថ្ងៃទី... ខែ... ឆ្នាំ...',
      body: 'លោក/លោកស្រី ...... កើតនៅថ្ងៃទី...... ខែ...... ឆ្នាំ...... ឋានៈ...... ត្រូវបានអនុញ្ញាតឱ្យឈប់ពីការងារចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: 'សាស្ត្រាចារ្យ ងី ម៉េង',
    },
    {
      id: 3,
      name: 'លិខិតបង្គាប់ការ ចូលបុគ្គលិកថ្មី',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ ចូលបុគ្គលិកថ្មី',
      recipient: '- តាមការចាំបាច់របស់មន្ទីរពេទ្យ',
      body: 'លោក/លោកស្រី ...... ត្រូវបានចាត់ឱ្យចូលបម្រើការងារនៅ ផ្នែក...... ក្នុងឋានៈជា...... ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: 'សាស្ត្រាចារ្យ ងី ម៉េង',
    },
    {
      id: 4,
      name: 'លិខិតបង្គាប់ការ តែងតាំង',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ តែងតាំង',
      recipient: '- យោងតាមតម្រូវការចាំបាច់របស់អង្គភាព',
      body: 'លោក/លោកស្រី ...... ត្រូវបានតែងតាំងជា...... នៃផ្នែក...... ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: 'សាស្ត្រាចារ្យ ងី ម៉េង',
    },
    {
      id: 5,
      name: 'លិខិតបង្គាប់ការ បញ្ចប់មុខតំណែង',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ បញ្ចប់មុខតំណែង',
      recipient: '- យោងតាមការរៀបចំរចនាសម្ព័ន្ធឡើងវិញ',
      body: 'លោក/លោកស្រី ...... ត្រូវបានបញ្ចប់មុខតំណែងជា...... នៃផ្នែក...... ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: 'សាស្ត្រាចារ្យ ងី ម៉េង',
    },
    {
      id: 6,
      name: 'លិខិតបង្គាប់ការ ផ្សេងៗ',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ',
      recipient: '- តាមការចាំបាច់របស់មន្ទីរពេទ្យ',
      body: 'ខ្លឹមសារលិខិតបង្គាប់ការផ្សេងៗ...',
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

  useEffect(() => {
    if (templateType) {
      let id = 1;
      if (templateType === 'maternity') id = 1;
      else if (templateType === 'resignation') id = 2;
      else if (templateType === 'onboarding') id = 3;
      else if (templateType === 'appointment') id = 4;
      else if (templateType === 'termination') id = 5;
      else if (templateType === 'others') id = 6;
      
      const t = templates.find((x) => x.id === id);
      if (t) {
        let appliedT = { ...t };
        if (templateType === 'maternity') {
          const name = searchParams.get('name') || '......';
          const dept = searchParams.get('department') || '......';
          const pos = searchParams.get('position') || '......';
          
          if (name !== '......') {
            appliedT.recipient = appliedT.recipient.replace('លោកស្រី ......', `លោកស្រី ${name}`);
            appliedT.body = appliedT.body.replace('លោកស្រី ......', `លោកស្រី ${name}`);
          }
          if (pos !== '......') {
            appliedT.body = appliedT.body.replace('ជា ......', `ជា ${pos}`);
          }
          if (dept !== '......') {
            appliedT.body = appliedT.body.replace('ផ្នែក......', `ផ្នែក${dept}`);
          }
          
          const civilType = searchParams.get('civilType');
          if (civilType) {
            appliedT.body = appliedT.body.replace('(......)', `(${civilType})`);
          }
          
          const endDateStr = searchParams.get('endDate');
          if (endDateStr && endDateStr !== '......') {
            const endDateObj = new Date(endDateStr);
            if (!isNaN(endDateObj.getTime())) {
              let returnDate = new Date(endDateObj);
              returnDate.setDate(returnDate.getDate() + 1);
              
              // Skip weekends (0 = Sunday, 6 = Saturday)
              while (returnDate.getDay() === 0 || returnDate.getDay() === 6) {
                returnDate.setDate(returnDate.getDate() + 1);
              }
              
              // Format date into Khmer digits and text
              const khDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
              const day = String(returnDate.getDate()).split('').map(ch => (khDigits[+ch] ?? ch)).join('');
              const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
              const month = months[returnDate.getMonth()] || '';
              const year = String(returnDate.getFullYear()).split('').map(ch => (khDigits[+ch] ?? ch)).join('');
              
              appliedT.body = appliedT.body.replace(/ចាប់ពីថ្ងៃទី\.\.\.\.\.\.\s*ខែ\.\.\.\.\.\.\s*ឆ្នាំ\.\.\.\.\.\./g, `ចាប់ពីថ្ងៃទី${day} ខែ${month} ឆ្នាំ${year}`);
            }
          }
        }
        applyTemplate(appliedT);
      }
    }
  }, [templateType]);

  const onRowClick = (l) => {
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
      requesterSection: l.requesterSection || '',
      requesterName: l.requesterName || '',
      reference: l.reference || '',
      createdBy: l.createdBy || '',
      createdAt: l.createdAt ? (new Date(l.createdAt)).toISOString().slice(0, 10) : ''
    };
    setForm(mapped);
    setCreating(true);
    setShowPreview(true);
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setForm((s) => ({ ...s, attachments: files.map((f) => f.name) }));
  };

  const handleChange = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="p-2 bg-gray-400 min-h-screen">
      {!creating ? (
        <div className="bg-white w-full border border-gray-100 mx-0 px-2 py-3 shadow-md" style={{ borderRadius: 4 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">តារាងលិខិតបង្គាប់ការ</h2>
            <div className="flex gap-2">
              {templateType === 'maternity' && (
                <button
                  className="px-3 py-1 bg-gray-600 text-white rounded"
                  onClick={() => navigate('/maternity-leave-report')}
                >
                  ត្រឡប់ក្រោយ
                </button>
              )}
              {canEditAccess() && (
                <button
                  className="px-3 py-1 bg-green-600 text-white rounded"
                  onClick={() => {
                    setCreating(true);
                    setShowPreview(true);
                  }}
                >
                  បង្កើត
                </button>
              )}
            </div>
          </div>

          <div className="mb-4 flex gap-2 items-center flex-wrap">
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

          <div className="overflow-x-auto w-full px-2">
            <table className="w-full border table-fixed text-sm bg-white" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="bg-gray-50 text-sm">
                  {['ល.រ', 'ផ្នែក', 'លេខលិខិត', 'កម្មវត្ថុ', 'យោង', 'ខ្លឹមសារ', 'ទីតាំងចុះឈ្មោះ', 'ភ្ជាប់ឯកសារ', 'ហត្ថលេខា', 'កាលបរិច្ឆេទបង្កើត', 'ស្ថានភាព', 'សកម្មភាព'].map((h, i) => (
                    <th key={i} className="border px-4 py-3 text-center text-sm font-semibold text-gray-700 relative" style={{ width: colWidths[i] }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="border px-4 py-6 text-center">Loading...</td></tr>
                ) : letters.length === 0 ? (
                  <tr><td colSpan={12} className="border px-4 py-6 text-center">មិនមានទិន្នន័យ</td></tr>
                ) : (
                  letters.map((l, idx) => (
                    <tr key={l._id || idx} className="hover:bg-gray-50" style={{ height: rowHeight }}>
                      <td className="border px-4 py-3 align-middle text-sm text-center">{idx + 1}</td>
                      <td className="border px-4 py-3 align-middle text-sm">{l.department || '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm">{l.letterNo ? toKhmerDigitsString(l.letterNo) : '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm">{l.subject || '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm">{l.recipient || '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm">{l.body ? (l.body.length > 50 ? l.body.slice(0, 50) + '...' : l.body) : '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm">{l.signPlace || '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm">{(l.attachments && l.attachments.length) ? l.attachments.join(', ') : '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm">{l.signName || '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm">{l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '-'}</td>
                      <td className="border px-4 py-3 align-middle text-sm text-center">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${statusStyle(deriveStatus(l))}`}>
                          {statusLabel(deriveStatus(l))}
                        </span>
                      </td>
                      <td className="border px-4 py-3 text-center">
                        {canEditAccess() && (
                          <div className="flex gap-2 justify-center items-center">
                            <button onClick={() => onRowClick(l)} className="w-8 h-6 flex items-center justify-center bg-green-600 text-white text-xs rounded-full">កែ</button>
                            <button onClick={(e) => deleteLetter(e, l)} className="w-8 h-6 flex items-center justify-center bg-red-600 text-white text-xs rounded-full">លុប</button>
                          </div>
                        )}
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
          <div className="mx-auto flex gap-8 w-full items-start">
            <div className="bg-white w-full border border-gray-100 mx-2 px-4 py-4 shadow-md" style={{ width: '390px', minWidth: '400px', minHeight: '11.69in' }}>
              <h4 className="text-sm block mb-3 text-blue-900 font-bold text-center" style={{ fontSize: '22px' }}>បំពេញព័ត៌មាន</h4>

              <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>លេខលិខិត</label>
              <input value={form.letterNo} onChange={handleChange('letterNo')} className="w-full border p-2 mb-3" />

              <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>ផ្នែក</label>
              <input value={form.department} onChange={handleChange('department')} className="w-full border p-2 mb-3" />

              <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>កម្មវត្ថុ</label>
              <input value={form.subject} onChange={handleChange('subject')} className="w-full border p-2 mb-3" />

              <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>យោង</label>
              <textarea value={form.recipient} onChange={handleChange('recipient')} className="w-full border p-2 mb-3 h-20" />

              <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>ខ្លឹមសារ</label>
              <textarea value={form.body} onChange={handleChange('body')} className="w-full border p-2 mb-3 h-32" />

              <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>ទីតាំងចុះឈ្មោះ</label>
              <input value={form.signPlace} onChange={handleChange('signPlace')} className="w-full border p-2 mb-3" />

              <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>កាលបរិច្ឆេទបង្កើត</label>
              <input type="date" value={form.createdAt || ''} onChange={handleChange('createdAt')} className="w-full border p-2 mb-3" />

              <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>តំណែងអ្នកចុះឈ្មោះ</label>
              <input value={form.signTitle} onChange={handleChange('signTitle')} className="w-full border p-2 mb-3" />

              <label className="text-sm block mb-1 text-blue-900 font-bold" style={{ fontSize: '18px' }}>ឈ្មោះអ្នកចុះឈ្មោះ</label>
              <input value={form.signName} onChange={handleChange('signName')} className="w-full border p-2 mb-3" />

              <div className="flex gap-2 mt-4">
                <button onClick={() => {
                  if (templateType === 'maternity') {
                    navigate('/maternity-leave-report');
                  } else {
                    setCreating(false);
                  }
                }} className="px-4 py-2 bg-blue-600 text-white">បោះបង់</button>
              </div>
            </div>

            <div className="self-start" style={{ flex: 1 }}>
              {showPreview ? (
                <div>
                  <div className="mb-2 flex gap-4 items-center justify-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTemplateBg}
                        onChange={(e) => setShowTemplateBg(e.target.checked)}
                        className="h-4 w-4"
                      />
                      បង្ហាញ Background
                    </label>
                    <div className="flex gap-2">
                      <button onClick={handlePrint} className="px-3 py-1 bg-gray-600 text-white rounded">Print</button>
                      {canEditAccess() && (
                        <button onClick={saveLetter} disabled={saving} className="px-3 py-1 bg-green-600 text-white rounded">{saving ? 'Saving...' : 'រក្សាទុក'}</button>
                      )}
                    </div>
                  </div>

                  <div className="w-full flex justify-center">
                    <div ref={contentRef} style={{ width: '8.27in', minHeight: '11.69in', background: '#fff', padding: '5mm 18mm 5mm 28mm', boxSizing: 'border-box', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', fontFamily: 'Khmer OS, Arial, serif', color: '#000', position: 'relative' }}>
                      <style>{`
                        .doc-row { display: grid; grid-template-columns: 80px 1fr; margin-top: 20px; }
                        .doc-label { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 16px; }
                        .doc-value { font-family: "Khmer OS Siemreap", Arial, sans-serif; font-size: 16px; line-height: 1.9; text-align: justify; }
                        
                        .doc-body { margin-top: 20px; font-family: "Khmer OS Siemreap", Arial, sans-serif; font-size: 16px; text-align: justify; white-space: pre-line; line-height: 1.9; }
                        
                        .doc-sign { margin-top: 40px; text-align: center; width: fit-content; margin-left: auto; padding-right: 25mm; }
                        .place-date { font-family: "Khmer OS Siemreap"; font-size: 16px; }
                        .sign-title { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 16px; margin-top: 5px; }
                        .sign-name { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 16px; margin-top: 80px; }
                      `}</style>

                      {showTemplateBg && (
                        <img
                          src="/Uploads/miss.png"
                          alt=""
                          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
                          draggable={false}
                        />
                      )}

                      <div className="relative z-10" style={{ marginTop: '200px' }}>
                        <div className="text-center font-nomal text-[20px] mb-6" style={{ fontFamily: 'Khmer OS Muol Light', paddingTop: '32px' }}>
                          <div>{form.subject}</div>
                          <div className="flex justify-center mt-1">
                            <img src="/3.JPG" alt="ornament" style={{ height: '15px' }} />
                          </div>
                        </div>

                        <div className="doc-row">
                          <div className="doc-label">យោង៖</div>
                          <div className="doc-value" dangerouslySetInnerHTML={{ __html: (() => {
                            let html = (form.recipient || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>').replace(/\t/g, '<span style="display:inline-block; width:80px;"></span>');
                            const n = searchParams.get('name'), d = searchParams.get('department'), p = searchParams.get('position');
                            if (n && n !== '......') html = html.split(n).join(`<span style="font-family: 'Khmer OS Muol Light'">${n}</span>`);
                            if (d && d !== '......') html = html.split(d).join(`<span style="font-family: 'Khmer OS Muol Light'">${d}</span>`);
                            if (p && p !== '......') html = html.split(p).join(`<span style="font-family: 'Khmer OS Muol Light'">${p}</span>`);
                            return html;
                          })() }} />
                        </div>

                        <div className="doc-body" dangerouslySetInnerHTML={{ __html: (() => {
                            let raw = (form.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            if (raw.includes('ចម្លងជូន:')) {
                              raw = raw.split('ចម្លងជូន:')[0];
                            }
                            let html = raw.replace(/\n/g, '<br/>').replace(/\t/g, '<span style="display:inline-block; width:80px;"></span>');
                            const n = searchParams.get('name'), d = searchParams.get('department'), p = searchParams.get('position');
                            if (n && n !== '......') html = html.split(n).join(`<span style="font-family: 'Khmer OS Muol Light'">${n}</span>`);
                            if (d && d !== '......') html = html.split(d).join(`<span style="font-family: 'Khmer OS Muol Light'">${d}</span>`);
                            if (p && p !== '......') html = html.split(p).join(`<span style="font-family: 'Khmer OS Muol Light'">${p}</span>`);
                            return html;
                          })() }} />

                        <div className="doc-sign">
                          {templateType !== 'maternity' && (
                            <div className="place-date">{form.signPlace}, {formatDateKhmer(form.createdAt)}</div>
                          )}
                          <div className="sign-title">{form.signTitle}</div>
                          {templateType !== 'maternity' && (
                            <div className="sign-name">{form.signName}</div>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const raw = (form.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        if (raw.includes('ចម្លងជូន:')) {
                          const ccPart = 'ចម្លងជូន:' + raw.split('ចម្លងជូន:')[1];
                          return (
                            <div className="absolute" style={{ bottom: '10mm', left: '28mm', fontSize: '10pt', fontFamily: '"Khmer OS Siemreap", Arial, sans-serif', whiteSpace: 'pre-line', lineHeight: '1.4', zIndex: 20 }} dangerouslySetInnerHTML={{ __html: ccPart }} />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">ចុច "បង្កើត" ឬជ្រើសរើសគំរូដើម្បីមើល</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
