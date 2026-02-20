import React from 'react';
import api from '../../services/api';
import DateInput from '../DateInput';
import API_BASE from '../../config';

export default function EducationTab({ editHR, setEditHR, skills }) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState(null);
  const [form, setForm] = React.useState({ degreeLevel: '', skill: '', startDate: '', endDate: '', institution: '', fileUrl: '' });
  const [savingEducation, setSavingEducation] = React.useState(false);

  const list = Array.isArray(editHR.educationList) ? editHR.educationList : [];

  function openAdd() {
    setForm({ degreeLevel: '', skill: '', startDate: '', endDate: '', institution: '', fileUrl: '' });
    setEditingIndex(null);
    setIsAdding(true);
  }

  function openEdit(idx) {
    const item = list[idx] || {};
    setForm({
      degreeLevel: item.degreeLevel || '',
      skill: item.skill || '',
      startDate: item.startDate ? String(item.startDate).slice(0, 10) : (item.startDate || ''),
      endDate: item.endDate ? String(item.endDate).slice(0, 10) : (item.endDate || ''),
  institution: item.institution || '',
  fileUrl: item.fileUrl || ''
    });
    setEditingIndex(idx);
    setIsAdding(true);
  }

  function cancelForm() {
    setIsAdding(false);
    setEditingIndex(null);
    setForm({ degreeLevel: '', skill: '', startDate: '', endDate: '', institution: '', fileUrl: '' });
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
      let url = result.url || '';
      if (url && /^https?:\/\//i.test(url)) return url;
      if (url && base) return `${base.replace(/\/+$/,'')}${url}`;
      return url;
    } catch (e) {
      console.error('Upload error:', e);
      return '';
    }
  }

  async function saveForm() {
    const copy = { ...form };
    if (!copy.startDate) delete copy.startDate;
    if (!copy.endDate) delete copy.endDate;
  if (!copy.fileUrl) delete copy.fileUrl;
    const newList = [...list];
    if (editingIndex === null) {
      newList.push(copy);
    } else {
      newList[editingIndex] = { ...newList[editingIndex], ...copy };
    }

    // update locally first
    setEditHR({ ...editHR, educationList: newList });

    // persist immediately if this HR already exists on server
  if (editHR && editHR._id) {
      setSavingEducation(true);
      try {
    // Convert dd/mm/yyyy to yyyy-mm-dd for backend to avoid cast errors in updates
    const payloadList = newList.map(e => ({
      ...e,
      startDate: dmyToISO(e.startDate) || e.startDate || undefined,
      endDate: dmyToISO(e.endDate) || e.endDate || undefined,
    }));
    const { data } = await api.put(`/hr/${editHR._id}`, { educationList: payloadList });
    if (data && (data._id || data.educationList)) setEditHR(data);
      } catch (err) {
        console.error('Error saving educationList', err);
      } finally {
        setSavingEducation(false);
      }
    }

    cancelForm();
  }

  async function removeAt(idx) {
    const newList = [...list];
    newList.splice(idx, 1);
    setEditHR({ ...editHR, educationList: newList });

    // persist delete immediately if HR exists
  if (editHR && editHR._id) {
      setSavingEducation(true);
      try {
    const payloadList = newList.map(e => ({
      ...e,
      startDate: dmyToISO(e.startDate) || e.startDate || undefined,
      endDate: dmyToISO(e.endDate) || e.endDate || undefined,
    }));
    const { data } = await api.put(`/hr/${editHR._id}`, { educationList: payloadList });
    if (data && (data._id || data.educationList)) setEditHR(data);
      } catch (err) {
        console.error('Error persisting removed education', err);
      } finally {
        setSavingEducation(false);
      }
    }
  }

  return (
    <div>
      <div className="mb-2 font-bold text-blue-700">ព័ត៌មានការអប់រំ</div>

      {/* Modal panel rendered at top-level when adding/editing */}
      {isAdding && (
        <div className="fixed inset-0 z-40 flex items-start justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black opacity-40" onClick={cancelForm} />

          {/* Panel */}
          <div className="relative mt-16 bg-white rounded shadow-lg p-4 z-50 flex flex-col items-center" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
            <div className="flex items-center justify-between mb-3 w-full">
              <h3 className="text-lg font-semibold">បញ្ចូលព័ត៌មានការអប់រំ</h3>
              <button className="text-gray-600 hover:text-gray-900" onClick={cancelForm} aria-label="Close">បិទ</button>
            </div>
            <div className="flex flex-col gap-4 items-start w-full">
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">កម្រិតសញ្ញាបត្រ</label>
                <select value={form.degreeLevel} onChange={e => setForm(f => ({ ...f, degreeLevel: e.target.value }))} className="border px-3 py-2 rounded w-full">
                  <option value="">-- ជ្រើសរើស --</option>
                  <option value="មធ្យមសិក្សាបឋមភូមិ">មធ្យមសិក្សាបឋមភូមិ</option>
                  <option value="មធ្យមសិក្សាទុតិយភូមិ">មធ្យមសិក្សាទុតិយភូមិ</option>
                  <option value="បរិញ្ញាបត្ររង">បរិញ្ញាបត្ររង</option>
                  <option value="បរិញ្ញាបត្រ">បរិញ្ញាបត្រ</option>
                  <option value="អនុបណ្ឌិត">អនុបណ្ឌិត</option>
                  <option value="ឱសថការី">ឱសថការី</option>
                  <option value="វេជ្ជបណ្ឌិត">វេជ្ជបណ្ឌិត</option>
                  <option value="ទន្តបណ្ឌិត">ទន្តបណ្ឌិត</option>
                  <option value="វេជ្ជបណ្ឌិតឯកទេស">វេជ្ជបណ្ឌិតឯកទេស</option>
                  <option value="បណ្ឌិត">បណ្ឌិត</option>
                  <option value="សាស្ត្រាចារ្យ">សាស្ត្រាចារ្យ</option>
                </select>
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">សញ្ញាប័ត្រ</label>
                <input
                  type="text"
                  value={form.skill}
                  onChange={e => setForm(f => ({ ...f, skill: e.target.value }))}
                  className="border px-3 py-2 rounded w-full"
                  placeholder="បញ្ចូលសញ្ញាប័ត្រ"
                />
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">សាលា</label>
                <input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} className="border px-3 py-2 rounded w-full" placeholder="ឈ្មោះសាលា" />
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">ថ្ងៃចាប់ផ្ដើម</label>
                <DateInput value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} className="border px-3 py-2 rounded w-full" />
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">ថ្ងៃបញ្ចប់</label>
                <DateInput value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} className="border px-3 py-2 rounded w-full" />
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">ឯកសារ (PDF/រូបភាព)</label>
                <input type="file" accept="image/*,.pdf" onChange={async e => {
                  const url = await handleUpload(e.target.files?.[0]);
                  if (url) setForm(f => ({ ...f, fileUrl: url }));
                }} className="border px-3 py-2 rounded w-full" />
                {form.fileUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <a href={form.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">មើលឯកសារ</a>
                    <button type="button" className="bg-red-500 text-white px-2 py-1 rounded" onClick={() => setForm(f => ({ ...f, fileUrl: '' }))}>លុបឯកសារ</button>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2 items-center w-full">
              <button className="bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-60" onClick={saveForm} disabled={savingEducation}>
                {savingEducation ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
              </button>
              <button className="bg-gray-400 text-white px-3 py-1 rounded" onClick={cancelForm} disabled={savingEducation}>បិទ</button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 border">#</th>
              <th className="px-3 py-2 border">កម្រិតសញ្ញាបត្រ</th>
              <th className="px-3 py-2 border">សញ្ញាប័ត្រ</th>
              <th className="px-3 py-2 border">ថ្ងៃចាប់ផ្ដើម</th>
              <th className="px-3 py-2 border">ថ្ងៃបញ្ចប់</th>
              <th className="px-3 py-2 border">សាលា</th>
              <th className="px-3 py-2 border">ឯកសារ</th>
              <th className="px-3 py-2 border">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">មិនមានទិន្នន័យ</td>
              </tr>
            )}
            {list.map((edu, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-3 py-2 border align-top">{idx + 1}</td>
                <td className="px-3 py-2 border align-top">{edu.degreeLevel || '-'}</td>
                <td className="px-3 py-2 border align-top">{edu.skill || '-'}</td>
                <td className="px-3 py-2 border align-top">{formatDateToDisplay(edu.startDate)}</td>
                <td className="px-3 py-2 border align-top">{formatDateToDisplay(edu.endDate)}</td>
                <td className="px-3 py-2 border align-top">{edu.institution || '-'}</td>
                <td className="px-3 py-2 border align-top">
                  {edu.fileUrl ? (
                    <a href={edu.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">មើល</a>
                  ) : '-'}
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
        <button type="button" className="bg-green-500 text-white px-6 py-2 rounded shadow hover:bg-green-600" onClick={openAdd}>បន្ថែមការអប់រំ</button>
      </div>
    </div>
  );
}

// Helper: format ISO yyyy-mm-dd (or Timestamps) to dd/mm/yyyy for display
function formatDateToDisplay(iso) {
  if (!iso) return '';
  if (typeof iso !== 'string') iso = String(iso);
  if (iso.includes('/')) return iso;
  if (iso.includes('T')) iso = iso.slice(0, 10);
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  return iso;
}

// dd/mm/yyyy -> yyyy-mm-dd ('' if invalid)
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
