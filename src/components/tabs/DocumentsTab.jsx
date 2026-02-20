
import React from 'react';
import api from '../../services/api';
import DateInput from '../DateInput';
import API_BASE from '../../config';

export default function DocumentsTab({ editHR, setEditHR }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState(null);
  const [form, setForm] = React.useState({ type: '', startDate: '', expiryDate: '', other: '', fileUrl: '' });
  const [previewUrl, setPreviewUrl] = React.useState('');

  const list = Array.isArray(editHR?.documents) ? editHR.documents : [];

  function openAdd() {
    setForm({ type: '', startDate: '', expiryDate: '', other: '', fileUrl: '' });
    setEditingIndex(null);
    setIsOpen(true);
  }

  function openEdit(idx) {
    const item = list[idx] || {};
    setForm({
      type: item.type || '',
      startDate: formatDateToDisplay(item.startDate),
      expiryDate: formatDateToDisplay(item.expiryDate),
      other: item.other || '',
      fileUrl: item.fileUrl || ''
    });
    setEditingIndex(idx);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setEditingIndex(null);
    setForm({ type: '', startDate: '', expiryDate: '', other: '', fileUrl: '' });
  }

  async function handleUpload(file) {
    if (!file) return '';
    const formData = new FormData();
    formData.append('file', file);
    try {
      const base = (typeof window !== 'undefined' && window.__API_BASE__) || API_BASE || '';
      const endpoint = base ? `${base.replace(/\/+$/,'')}/api/upload` : '/api/upload';
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      if (!res.ok) {
        console.error('Upload failed:', res.status, await res.text());
        return '';
      }
      const result = await res.json();
      // If backend returned an absolute URL, use it; else build against base or relative
      let url = result.url || '';
      if (url && /^https?:\/\//i.test(url)) return url;
      if (url && base) return `${base.replace(/\/+$/,'')}${url}`;
      return url;
    } catch (e) {
      console.error('Upload error:', e);
      return '';
    }
  }

  async function saveDocument() {
    const newList = [...list];
    const entry = { ...form };
    if (!entry.startDate) delete entry.startDate;
    if (!entry.expiryDate) delete entry.expiryDate;
    if (!entry.other) delete entry.other;
    if (!entry.fileUrl) delete entry.fileUrl;
    if (editingIndex === null || editingIndex === undefined) newList.push(entry);
    else newList[editingIndex] = { ...newList[editingIndex], ...entry };
    setEditHR({ ...editHR, documents: newList });
    // Auto-persist to backend for existing HR
    if (editHR && editHR._id) {
      try {
        const payloadDocs = newList.map(d => ({
          ...d,
          startDate: dmyToISO(d.startDate) || d.startDate || undefined,
          expiryDate: dmyToISO(d.expiryDate) || d.expiryDate || undefined
        }));
        await api.put(`/hr/${editHR._id}`, { documents: payloadDocs });
      } catch (err) {
        console.error('Failed to save documents:', err?.response?.data || err?.message);
      }
    }
    closeModal();
  }

  async function removeAt(idx) {
    const newList = [...list];
    newList.splice(idx, 1);
    setEditHR({ ...editHR, documents: newList });
    if (editHR && editHR._id) {
      try {
        const payloadDocs = newList.map(d => ({
          ...d,
          startDate: dmyToISO(d.startDate) || d.startDate || undefined,
          expiryDate: dmyToISO(d.expiryDate) || d.expiryDate || undefined
        }));
        await api.put(`/hr/${editHR._id}`, { documents: payloadDocs });
      } catch (err) {
        console.error('Failed to remove document:', err?.response?.data || err?.message);
      }
    }
  }

  return (
    <div className="w-full">
      <div className="mb-4 font-bold text-lg text-gray-800">ឯកសារបុគ្គលិក</div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 border">#</th>
              <th className="px-3 py-2 border">ប្រភេទឯកសារ</th>
              <th className="px-3 py-2 border">ថ្ងៃចាប់ផ្ដើម</th>
              <th className="px-3 py-2 border">កាលបរិច្ឆេទផុតកំណត់</th>
              <th className="px-3 py-2 border">ផ្សេងៗ</th>
              <th className="px-3 py-2 border">ឯកសារ</th>
              <th className="px-3 py-2 border">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">មិនមានទិន្នន័យ</td>
              </tr>
            )}
            {list.map((doc, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-3 py-2 border align-top">{idx + 1}</td>
                <td className="px-3 py-2 border align-top">{doc.type || '-'}</td>
                <td className="px-3 py-2 border align-top">{formatDateToDisplay(doc.startDate) || '-'}</td>
                <td className="px-3 py-2 border align-top">
                  <div>{formatDateToDisplay(doc.expiryDate) || '-'}</div>
                  <div className="text-xs text-gray-600 mt-1">{computeExpiryStatus(doc.expiryDate)}</div>
                </td>
                <td className="px-3 py-2 border align-top">{doc.other || '-'}</td>
                <td className="px-3 py-2 border align-top">
                  {doc.fileUrl ? (
                    <div className="flex items-center gap-2">
                      <button type="button" className="bg-blue-600 text-white px-2 py-1 rounded" onClick={() => setPreviewUrl(doc.fileUrl)}>មើល</button>
                      <a className="text-blue-600 underline" href={doc.fileUrl} target="_blank" rel="noreferrer">បើកក្នុងផ្ទាំងថ្មី</a>
                    </div>
                  ) : '-' }
                </td>
                <td className="px-3 py-2 border align-top">
                  <button className="bg-blue-500 text-white px-2 py-1 rounded mr-2" onClick={() => openEdit(idx)}>កែ</button>
                  <button className="bg-red-500 text-white px-2 py-1 rounded" onClick={() => removeAt(idx)}>លុប</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-6">
        <button type="button" className="bg-green-500 text-white px-6 py-2 rounded shadow hover:bg-green-600" onClick={openAdd}>បន្ថែម</button>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeModal} />
          <div className="relative mt-16 bg-white rounded shadow-lg p-4 z-50 flex flex-col items-center" style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>
            <div className="flex items-center justify-between mb-3 w-full">
              <h3 className="text-lg font-semibold">បញ្ចូលឯកសារ</h3>
              <button className="text-gray-600 hover:text-gray-900" onClick={closeModal} aria-label="Close">បិទ</button>
            </div>
            <div className="flex flex-col gap-4 items-start w-full">
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">ប្រភេទឯកសារ</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="border px-3 py-2 rounded w-full">
                  <option value="">-- ជ្រើសរើស --</option>
                  <option value="កំណើត">កំណើត</option>
                  <option value="អត្តសញ្ញាណប័ណ្ណ">អត្តសញ្ញាណប័ណ្ណ</option>
                  <option value="សញ្ញាប័ត្រ">សញ្ញាប័ត្រ</option>
                  <option value="លិខិតបង្គាប់ការ">លិខិតបង្គាប់ការ</option>
                  <option value="គណៈវិជ្ជាជីវៈ">គណៈវិជ្ជាជីវៈ</option>
                  <option value="ផ្សេងៗ">ផ្សេងៗ</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div>
                  <label className="block mb-1 font-medium text-sm">ថ្ងៃចាប់ផ្ដើម</label>
                  <DateInput value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} className="border px-3 py-2 rounded w-full" />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-sm">កាលបរិច្ឆេទផុតកំណត់</label>
                  <DateInput value={form.expiryDate} onChange={v => setForm(f => ({ ...f, expiryDate: v }))} className="border px-3 py-2 rounded w-full" />
                </div>
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">ផ្សេងៗ (note)</label>
                <input value={form.other} onChange={e => setForm(f => ({ ...f, other: e.target.value }))} className="border px-3 py-2 rounded w-full" placeholder="ផ្សេងៗ..." />
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">ឯកសារ</label>
                <input type="file" accept="image/*,.pdf" onChange={async e => {
                  const url = await handleUpload(e.target.files?.[0]);
                  if (url) setForm(f => ({ ...f, fileUrl: url }));
                }} className="border px-3 py-2 rounded w-full" />
                {form.fileUrl && (
                  <div className="mt-2">
                    <a href={form.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">មើលឯកសារ</a>
                    <button type="button" className="bg-red-500 text-white px-2 py-1 rounded ml-2" onClick={() => setForm(f => ({ ...f, fileUrl: '' }))}>លុបឯកសារ</button>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2 items-center w-full">
              <button className="bg-indigo-600 text-white px-3 py-1 rounded" onClick={saveDocument}>រក្សាទុក</button>
              <button className="bg-gray-400 text-white px-3 py-1 rounded" onClick={closeModal}>បិទ</button>
            </div>
          </div>
        </div>
      )}
      {/* Preview modal for PDF/Image */}
      {previewUrl && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-60" onClick={() => setPreviewUrl('')} />
          <div className="relative bg-white rounded shadow-lg z-50 w-[92vw] h-[84vh] p-2 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-gray-800 truncate">មើលឯកសារ</div>
              <div className="flex items-center gap-2">
                <a href={previewUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">បើកក្នុងផ្ទាំងថ្មី</a>
                <a href={previewUrl} download className="text-green-700 underline">ទាញយក</a>
                <button className="bg-gray-500 text-white px-3 py-1 rounded" onClick={() => setPreviewUrl('')}>បិទ</button>
              </div>
            </div>
            <div className="flex-1 border rounded overflow-hidden bg-gray-50">
              {isPDF(previewUrl) ? (
                <iframe title="pdf-preview" src={previewUrl} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-2">
                  {/* Try image preview; otherwise fallback text */}
                  <img src={previewUrl} alt="preview" className="max-w-full max-h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function computeExpiryStatus(val) {
  if (!val) return 'មិនមានកាលបរិច្ឆេទផុតកំណត់';
  // Accept Date, ISO string, or dd/mm/yyyy
  let dt = null;
  if (val instanceof Date) dt = val;
  else if (typeof val === 'string') {
    const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) dt = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    else {
      const dmy = val.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (dmy) dt = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00Z`);
    }
  }
  if (!dt || isNaN(dt.getTime())) return 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ';
  // Compare to today (UTC date)
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const expiry = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `ផុតកំណត់ (${Math.abs(diffDays)} ថ្ងៃមុន)`;
  if (diffDays === 0) return 'ផុតកំណត់ ថ្ងៃនេះ';
  if (diffDays <= 7) return `ជិតដល់ (${diffDays} ថ្ងៃសល់)`;
  return `នៅមានសុពលភាព (${diffDays} ថ្ងៃសល់)`;
}

// Helper: convert dd/mm/yyyy -> yyyy-mm-dd; returns '' for invalid/empty
function dmyToISO(val) {
  if (!val) return '';
  const m = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3];
  const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (dt && dt.getFullYear() === Number(yyyy) && dt.getMonth() === Number(mm) - 1 && dt.getDate() === Number(dd)) {
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

// Helper: ISO -> dd/mm/yyyy (or pass-through if already dd/mm/yyyy)
function formatDateToDisplay(iso) {
  if (!iso) return '';
  iso = String(iso);
  if (iso.includes('/')) return iso; // already display
  if (iso.includes('T')) iso = iso.slice(0, 10);
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  return '';
}

function isPDF(u) {
  return /\.pdf(\?|$)/i.test(String(u || ''));
}
