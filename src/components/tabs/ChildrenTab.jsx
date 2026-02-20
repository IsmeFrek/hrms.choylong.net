import React from 'react';
import DateInput from '../DateInput';

export default function ChildrenTab({ editHR, setEditHR }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState(null);
  const [form, setForm] = React.useState({ name: '', gender: '', dob: '', nid: '', note: '' });

  const list = Array.isArray(editHR && editHR.childrenList) ? editHR.childrenList : [];

  function openAdd() {
    setForm({ name: '', gender: '', dob: '', nid: '', note: '' });
    setEditingIndex(null);
    setIsOpen(true);
  }

  function openEdit(idx) {
    const item = list[idx] || {};
    setForm({
      name: item.name || '',
      gender: item.gender || '',
      dob: item.dob ? String(item.dob).slice(0, 10) : (item.dob || ''),
      nid: item.nid || '',
      note: item.note || ''
    });
    setEditingIndex(idx);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setEditingIndex(null);
    setForm({ name: '', gender: '', dob: '', nid: '', note: '' });
  }

  function saveChild() {
    const newList = [...list];
    const payload = { ...form };
    // ensure blank strings become undefined if empty
    if (!payload.dob) delete payload.dob;
    if (editingIndex === null || editingIndex === undefined) {
      newList.push(payload);
    } else {
      newList[editingIndex] = { ...newList[editingIndex], ...payload };
    }
    setEditHR({ ...editHR, childrenList: newList });
    closeModal();
  }

  function removeAt(idx) {
    const newList = [...list];
    newList.splice(idx, 1);
    setEditHR({ ...editHR, childrenList: newList });
  }

  return (
    <div className="w-full">
      <div className="mb-4 font-bold text-lg text-gray-800">ព័ត៌មានកូន</div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 border">#</th>
              <th className="px-3 py-2 border">ឈ្មោះកូន</th>
              <th className="px-3 py-2 border">ភេទ</th>
              <th className="px-3 py-2 border">ថ្ងៃខែឆ្នាំកំណើត</th>
              <th className="px-3 py-2 border">លេខអត្តសញ្ញាណ</th>
              <th className="px-3 py-2 border">កំណត់សម្គាល់</th>
              <th className="px-3 py-2 border">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">មិនមានទិន្នន័យ</td>
              </tr>
            )}
            {list.map((child, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-3 py-2 border align-top">{idx + 1}</td>
                <td className="px-3 py-2 border align-top">{child.name || '-'}</td>
                <td className="px-3 py-2 border align-top">{child.gender === 'Male' ? 'ប្រុស' : child.gender === 'Female' ? 'ស្រី' : '-'}</td>
                <td className="px-3 py-2 border align-top">{formatDateToDisplay(child.dob)}</td>
                <td className="px-3 py-2 border align-top">{child.nid || '-'}</td>
                <td className="px-3 py-2 border align-top">{child.note || '-'}</td>
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
          <div className="relative mt-16 bg-white rounded shadow-lg p-4 z-50 flex flex-col items-center" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
            <div className="flex items-center justify-between mb-3 w-full">
              <h3 className="text-lg font-semibold">បញ្ចូលព័ត៌មានកូន</h3>
              <button className="text-gray-600 hover:text-gray-900" onClick={closeModal} aria-label="Close">បិទ</button>
            </div>
            <div className="flex flex-col gap-4 items-start w-full">
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">ឈ្មោះកូន</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="border px-3 py-2 rounded w-full" placeholder="ឈ្មោះកូន" />
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">ភេទ</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className="border px-3 py-2 rounded w-full">
                  <option value="">-- ជ្រើសរើស --</option>
                  <option value="Male">ប្រុស</option>
                  <option value="Female">ស្រី</option>
                </select>
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">ថ្ងៃខែឆ្នាំកំណើត</label>
                <DateInput value={form.dob} onChange={v => setForm(f => ({ ...f, dob: v }))} className="border px-3 py-2 rounded w-full" />
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">លេខអត្តសញ្ញាណ</label>
                <input value={form.nid} onChange={e => setForm(f => ({ ...f, nid: e.target.value }))} className="border px-3 py-2 rounded w-full" placeholder="លេខអត្តសញ្ញាណ" />
              </div>
              <div style={{ width: '100%' }}>
                <label className="block mb-1 font-medium text-sm">កំណត់សម្គាល់</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="border px-3 py-2 rounded w-full" rows={3} placeholder="កំណត់សម្គាល់..." />
              </div>
            </div>
            <div className="mt-4 flex gap-2 items-center w-full">
              <button className="bg-indigo-600 text-white px-3 py-1 rounded" onClick={saveChild}>រក្សាទុក</button>
              <button className="bg-gray-400 text-white px-3 py-1 rounded" onClick={closeModal}>បិទ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers: convert ISO yyyy-mm-dd to display dd/mm/yyyy and back.
function formatDateToDisplay(iso) {
  if (!iso) return '';
  // normalize to string
  iso = String(iso);
  // if already in dd/mm/yyyy, return as is
  if (iso.includes('/')) return iso;
  // trim ISO timestamp to date-only if it contains time part
  if (iso.includes('T')) iso = iso.slice(0, 10);
  // accept if in yyyy-mm-dd
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return '';
}

function parseDateFromDisplay(display) {
  if (!display) return '';
  const cleaned = display.trim();
  const parts = cleaned.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d.length >= 1 && m.length >= 1 && y.length === 4) {
      const dd = d.padStart(2, '0');
      const mm = m.padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }
  return '';
}

// Helper: accepts a Date object, an ISO string (yyyy-mm-dd...), or a dd/mm/yyyy string
// Returns { y, m, d } where each is a zero-padded string or empty string when not parseable
function getYMDFromValue(val) {
  if (!val && val !== 0) return { y: '', m: '', d: '' };

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return { y: '', m: '', d: '' };
    const yyyy = String(val.getFullYear());
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return { y: yyyy, m: mm, d: dd };
  }

  if (typeof val === 'string') {
    const isoMatch = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return { y: isoMatch[1], m: isoMatch[2].padStart(2, '0'), d: isoMatch[3].padStart(2, '0') };
    }
    const dmyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      return { y: dmyMatch[3], m: dmyMatch[2].padStart(2, '0'), d: dmyMatch[1].padStart(2, '0') };
    }
  }
  return { y: '', m: '', d: '' };
}
