import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import usePermission from '../hooks/usePermission';

export default function NewDocumentPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const perms = usePermission();

  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(false);

  const _kh = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
  const toKhmerDigitsString = (s) => {
    if (s === undefined || s === null) return '';
    return String(s).split('').map(ch => (ch >= '0' && ch <= '9') ? _kh[parseInt(ch,10)] : ch).join('');
  };

  const fmtDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleString(); } catch { return d; }
  };

  const loadLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/letters', { headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error('api');
      const data = await res.json();
      setLetters(Array.isArray(data) ? data : data.letters || []);
    } catch (e) {
      try {
        const local = JSON.parse(localStorage.getItem('localLetters') || '[]');
        setLetters(Array.isArray(local) ? local : []);
      } catch (_) { setLetters([]); }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLetters(); }, [token]);

  const onView = (e, l) => { e.stopPropagation(); if (l._id) navigate(`/documents/${l._id}`); else if (l._localId) navigate(`/documents/${l._localId}`); };
  const onEdit = (e, l) => { e.stopPropagation(); try { localStorage.setItem('editLetterPayload', JSON.stringify(l)); } catch{}; navigate('/'); };

  const removeLocal = (match) => {
    try {
      const cur = JSON.parse(localStorage.getItem('localLetters') || '[]');
      const filtered = cur.filter(x => !( (match._localId && x._localId && x._localId === match._localId) || (match.createdAt && match.letterNo && x.createdAt === match.createdAt && x.letterNo === match.letterNo) ));
      localStorage.setItem('localLetters', JSON.stringify(filtered));
    } catch (e) { console.warn('remove local failed', e); }
  };

  const deleteLetter = async (e, l) => {
    e.stopPropagation();
    if (!confirm('លុបឯកសារនេះ?')) return;
    try {
      if (l._id) {
        const res = await fetch('/api/letters/' + l._id, { method: 'DELETE', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!res.ok) throw new Error('delete');
      } else {
        removeLocal(l);
      }
      // remove from UI
      setLetters(s => s.filter(x => !((l._id && x._id === l._id) || (l._localId && x._localId === l._localId) || (l.createdAt && x.createdAt === l.createdAt && x.letterNo === l.letterNo))));
      alert('បានលុប');
    } catch (err) {
      console.error(err);
      alert('លុបមិនបាន');
    }
  };

  // Minimal A4 wrapper for Word export
  const a4Wrapper = (innerHtml) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@page{size:A4;margin:20mm}body{font-family:Khmer OS,Arial,serif;color:#000;margin:0;padding:0} .a4{box-sizing:border-box;width:8.27in;height:11.69in;padding:12mm}</style></head><body><div class="a4">${innerHtml}</div></body></html>`;

  const exportLetterWord = (e, l) => {
    e.stopPropagation();
    try {
      const title = l.subject || 'letter';
      const created = l.createdAt ? new Date(l.createdAt).toLocaleString() : '';
      const attachments = (l.attachments && l.attachments.length) ? `<p><strong>Attachments:</strong> ${String(l.attachments.join(', '))}</p>` : '';
      const inner = `
        <h2 style="font-size:18px;margin:0 0 8px 0">${title}</h2>
        <p style="margin:0 0 6px 0"><strong>លេខលិខិត:</strong> ${l.letterNo ? toKhmerDigitsString(l.letterNo) : '-'}</p>
        <p style="margin:0 0 6px 0"><strong>ផ្នែក:</strong> ${l.requesterSection || '-'}</p>
        <p style="margin:0 0 12px 0"><strong>អ្នកបង្កើត:</strong> ${ (l.createdBy && (l.createdBy.fullName || l.createdBy.name)) || l.createdBy || '-' } — ${created}</p>
        <div style="margin-top:6px;white-space:pre-line">${l.body ? String(l.body) : ''}</div>
        ${attachments}
      `;
      const doc = a4Wrapper(inner);
      const blob = new Blob([doc], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (l.letterNo ? toKhmerDigitsString(l.letterNo) : title || 'letter') + '.doc';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('export failed', err);
      alert('Export failed');
    }
  };

  // Preview state and helpers
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const buildLetterHtml = (l) => {
    const title = l.subject || '';
    const created = l.createdAt ? new Date(l.createdAt).toLocaleString() : '';
    const attachments = (l.attachments && l.attachments.length) ? `<p><strong>Attachments:</strong> ${String(l.attachments.join(', '))}</p>` : '';
    return `
      <div style="font-family:Khmer OS,Arial,serif;color:#000">
        <h2 style="font-size:18px;margin:0 0 8px 0">${title}</h2>
        <p style="margin:0 0 6px 0"><strong>លេខលិខិត:</strong> ${l.letterNo ? toKhmerDigitsString(l.letterNo) : '-'}</p>
        <p style="margin:0 0 6px 0"><strong>ផ្នែក:</strong> ${l.requesterSection || '-'}</p>
        <p style="margin:0 0 12px 0"><strong>អ្នកបង្កើត:</strong> ${ (l.createdBy && (l.createdBy.fullName || l.createdBy.name)) || l.createdBy || '-' } — ${created}</p>
        <div style="margin-top:6px;white-space:pre-line">${l.body ? String(l.body) : ''}</div>
        ${attachments}
      </div>
    `;
  };

  const openPreview = (e, l) => { e.stopPropagation(); setPreviewHtml(a4Wrapper(buildLetterHtml(l))); setPreviewOpen(true); };
  const closePreview = () => setPreviewOpen(false);

  const printPreview = () => {
    if (!previewHtml) return alert('មិនមានអ្វីសម្រាប់ព្រីន');
    const win = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,width=900,height=800');
    if (!win) return alert('Please allow popups');
    win.document.open();
    win.document.write(previewHtml);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch (e) {} }, 300);
  };

  return (
    <div className="p-3">
      <div className="overflow-x-auto w-full px-0">
        <table className="w-full border table-fixed text-sm bg-white">
          <thead>
            <tr className="bg-gray-50 text-sm">
              <th className="border px-3 py-1 text-center text-xs font-semibold text-gray-700">ល.រ</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">ផ្នែក</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">លេខលិខិត</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">កម្មវត្ថុ</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">យោង</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">ខ្លឹមសារ</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">ទីតាំងចុះឈ្មោះ</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">ភ្ជាប់ឯកសារ</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">អ្នកបង្កើត</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">កាលបរិច្ឆេទបង្កើត</th>
              <th className="border px-3 py-2 text-center text-xs font-semibold text-gray-700">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} className="border px-2 py-4 text-center">កំពុងផ្ទុក...</td></tr>}
            {!loading && letters.length === 0 && <tr><td colSpan={11} className="border px-2 py-4 text-center">មិនមានទិន្នន័យ</td></tr>}
            {letters.map((l, idx) => (
              <tr key={l._id || l._localId || idx} className="hover:bg-gray-50 cursor-pointer" onClick={() => { if (perms.canViewDocuments || perms.canViewFiles) { if (l._id) navigate(`/documents/${l._id}`); else navigate(`/documents/${l._localId || ''}`); } }}>
                <td className="border px-3 py-1 align-middle text-sm text-center">{toKhmerDigitsString(idx + 1)}</td>
                <td className="border px-3 py-2 align-middle text-sm">{l.requesterSection || (l.createdBy && (l.createdBy.department || '-')) || '-'}</td>
                <td className="border px-3 py-2 align-middle text-sm text-center">{l.letterNo ? toKhmerDigitsString(l.letterNo) : '-'}</td>
                <td className="border px-3 py-2 align-middle text-sm">{l.subject || '-'}</td>
                <td className="border px-3 py-2 align-middle text-sm">{l.reference || '-'}</td>
                <td className="border px-3 py-2 align-middle text-sm">{l.body ? (String(l.body).length > 120 ? String(l.body).slice(0, 120) + '...' : l.body) : '-'}</td>
                <td className="border px-3 py-2 align-middle text-sm">{l.signPlace || '-'}</td>
                <td className="border px-3 py-2 align-middle text-sm">{(l.attachments && l.attachments.length) ? String(l.attachments[0]).split('/').pop() : '-'}</td>
                <td className="border px-3 py-2 align-middle text-sm">{(l.createdBy && (l.createdBy.fullName || l.createdBy.name)) || l.createdBy || '-'}</td>
                <td className="border px-3 py-2 align-middle text-sm">{fmtDate(l.createdAt)}</td>
                <td className="border px-3 py-2 text-center">
                  <div className="flex gap-2 justify-center items-center">
                    <button onClick={(e) => onEdit(e, l)} className="w-8 h-6 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white text-xs rounded-full">កែ</button>
                    <button title="Word" onClick={(e) => { e.stopPropagation(); navigate('/wordpage/' + (l._id || l._localId || idx)); }} className="w-8 h-6 flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-full">Word</button>
                    {(perms.canViewDocuments || perms.canViewFiles) ? (
                      <button onClick={(e) => onView(e, l)} className="w-8 h-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-full">មើល</button>
                    ) : (
                      <button disabled className="w-8 h-6 flex items-center justify-center bg-gray-300 text-white text-xs rounded-full opacity-50">មើល</button>
                    )}
                    <button onClick={(e) => deleteLetter(e, l)} className="w-8 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white text-xs rounded-full">លុប</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Preview modal (simple) */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white w-11/12 max-w-4xl p-4 rounded shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">មើលទំរង់ Word</h3>
              <div className="flex gap-2">
                <button onClick={printPreview} className="px-3 py-1 bg-gray-600 text-white rounded">Print</button>
                <button onClick={() => { const blob = new Blob([previewHtml], { type: 'application/msword' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'letter.doc'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }} className="px-3 py-1 bg-yellow-500 text-white rounded">Download .doc</button>
                <button onClick={closePreview} className="px-3 py-1 bg-gray-300">Close</button>
              </div>
            </div>
            <div className="overflow-auto border" style={{ height: '70vh' }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
}