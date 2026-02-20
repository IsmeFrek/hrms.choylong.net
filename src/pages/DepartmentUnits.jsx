import React, { useEffect, useState } from 'react';
import usePermission from '../hooks/usePermission';


const DepartmentUnits = () => {
  const perms = usePermission();
  // Support granular department-units permissions; fall back to the broader departments perms
  const canView = perms?.canViewDepartmentUnits || perms?.canViewDepartments;
  const canEdit = perms?.canEditDepartmentUnits || perms?.canEditDepartments;

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '' });
  const [editError, setEditError] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
    // Delete a row
    const handleDelete = async (unit) => {
      if (!window.confirm('តើអ្នកពិតជាចង់លុបអង្គភាពនេះមែនទេ?')) return;
      setDeleteLoadingId(unit._id || unit.id);
      try {
        const res = await fetch(`/api/department-units/${unit._id || unit.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('បរាជ័យក្នុងការលុប');
        fetchUnits();
      } catch (err) {
        alert('បរាជ័យក្នុងការលុប');
      } finally {
        setDeleteLoadingId(null);
      }
    };
  // Start editing a row
  const handleEdit = (unit) => {
    setEditingId(unit._id || unit.id);
    setEditForm({ name: unit.name || '', code: unit.code || '', description: unit.description || '' });
    setEditError(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', code: '', description: '' });
    setEditError(null);
  };

  // Handle edit form change
  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // Save edit
  const handleSaveEdit = async (unit) => {
    setEditError(null);
    if (!editForm.name.trim()) {
      setEditError('សូមបំពេញឈ្មោះអង្គភាព');
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/department-units/${unit._id || unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('បរាជ័យក្នុងការកែប្រែ');
      setEditingId(null);
      setEditForm({ name: '', code: '', description: '' });
      fetchUnits();
    } catch (err) {
      setEditError('បរាជ័យក្នុងការកែប្រែ');
    } finally {
      setEditLoading(false);
    }
  };

  // Calculate paginated units
  // Always sort by order (in case backend returns unordered)
  const sortedUnits = [...units].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const paginatedUnits = sortedUnits.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(sortedUnits.length / pageSize));

  // Move up/down
  const handleMove = async (unit, direction) => {
    const idx = sortedUnits.findIndex(u => (u._id || u.id) === (unit._id || unit.id));
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedUnits.length) return;
    const swapUnit = sortedUnits[swapIdx];
    try {
      await fetch(`/api/department-units/${unit._id || unit.id}/order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOrder: swapUnit.order })
      });
      await fetch(`/api/department-units/${swapUnit._id || swapUnit.id}/order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOrder: unit.order })
      });
      fetchUnits();
    } catch (err) {
      alert('បរាជ័យក្នុងការផ្លាស់ទី');
    }
  };

  const fetchUnits = () => {
    if (!canView) return;
    setLoading(true);
    fetch('/api/department-units')
      .then(res => {
        if (!res.ok) throw new Error(res.statusText || 'Fetch failed');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setUnits(data);
        else if (Array.isArray(data?.units)) setUnits(data.units);
        setLoading(false);
      })
      .catch(err => { setError('មិនមានសិទ្ធិមើលទិន្នន័យ (view:department-units / view:departments)'); setLoading(false); });
  };

  useEffect(() => {
    fetchUnits();
  }, [canView]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('សូមបំពេញឈ្មោះអង្គភាព');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/department-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('បរាជ័យក្នុងការបញ្ចូល');
      setForm({ name: '', code: '', description: '' });
      fetchUnits();
    } catch (err) {
      setFormError('បរាជ័យក្នុងការបញ្ចូល');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">កំពុងទាញយក...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold mb-4">បញ្ជីអង្គភាព</h2>
      {canEdit ? (
        <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap gap-3 items-end bg-gray-50 p-4 rounded">
          <div>
            <label className="block text-xs mb-1">ឈ្មោះអង្គភាព<span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} className="border px-3 py-2 rounded" required />
          </div>
          <div>
            <label className="block text-xs mb-1">កូដ</label>
            <input name="code" value={form.code} onChange={handleChange} className="border px-3 py-2 rounded" />
          </div>
          <div>
            <label className="block text-xs mb-1">ផ្សេងៗ</label>
            <input name="description" value={form.description} onChange={handleChange} className="border px-3 py-2 rounded" />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={submitting}>{submitting ? 'កំពុងបញ្ចូល...' : 'បញ្ចូល'}</button>
          {formError && <div className="text-red-500 text-xs ml-2">{formError}</div>}
        </form>
      ) : (
        <div className="mb-6 text-sm text-gray-600">មិនមានសិទ្ធិកែប្រែ (edit:department-units / edit:departments)</div>
      )}

      {/* Page size selector */}
      <div className="mb-2 flex items-center gap-2">
        <label className="text-xs">បង្ហាញ</label>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="border px-2 py-1 rounded text-xs">
          {[10, 15, 20, 50, 100].map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span className="text-xs">ជួរដេកក្នុងមួយទំព័រ</span>
      </div>

      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2">ល.រ</th>
            <th className="border px-3 py-2">ឈ្មោះអង្គភាព</th>
            <th className="border px-3 py-2">កូដ</th>
            <th className="border px-3 py-2">ផ្សេងៗ</th>
            <th className="border px-3 py-2">សកម្មភាព</th>
          </tr>
        </thead>
        <tbody>
          {paginatedUnits.map((unit, idx) => {
            const globalIdx = sortedUnits.findIndex(u => (u._id || u.id) === (unit._id || unit.id));
            return (
              <tr key={unit._id || unit.id || ((page-1)*pageSize)+idx}>
                <td className="border px-3 py-2 text-center">{(page - 1) * pageSize + idx + 1}</td>
                {editingId === (unit._id || unit.id) && canEdit ? (
                  <>
                    <td className="border px-3 py-2">
                      <input name="name" value={editForm.name} onChange={handleEditChange} className="border px-2 py-1 rounded w-full" />
                    </td>
                    <td className="border px-3 py-2">
                      <input name="code" value={editForm.code} onChange={handleEditChange} className="border px-2 py-1 rounded w-full" />
                    </td>
                    <td className="border px-3 py-2">
                      <input name="description" value={editForm.description} onChange={handleEditChange} className="border px-2 py-1 rounded w-full" />
                    </td>
                    <td className="border px-3 py-2 flex gap-1 items-center">
                      <button type="button" className="bg-green-600 text-white px-2 py-1 rounded text-xs" onClick={() => handleSaveEdit(unit)} disabled={editLoading}>{editLoading ? 'រក្សាទុក...' : 'រក្សាទុក'}</button>
                      <button type="button" className="bg-gray-400 text-white px-2 py-1 rounded text-xs" onClick={handleCancelEdit} disabled={editLoading}>បោះបង់</button>
                      <button type="button" className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs" disabled>⬆</button>
                      <button type="button" className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs" disabled>⬇</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="border px-3 py-2">{unit.name}</td>
                    <td className="border px-3 py-2">{unit.code || ''}</td>
                    <td className="border px-3 py-2">{unit.description || ''}</td>
                    <td className="border px-3 py-2 flex gap-1 items-center">
                      {canEdit ? (
                        <>
                          <button type="button" className="bg-blue-500 text-white px-2 py-1 rounded text-xs" onClick={() => handleEdit(unit)}>កែប្រែ</button>
                          <button type="button" className="bg-red-500 text-white px-2 py-1 rounded text-xs" onClick={() => handleDelete(unit)} disabled={deleteLoadingId === (unit._id || unit.id)}>{deleteLoadingId === (unit._id || unit.id) ? 'លុប...' : 'លុប'}</button>
                          <button type="button" className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs" onClick={() => handleMove(unit, 'up')} disabled={globalIdx === 0}>⬆</button>
                          <button type="button" className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs" onClick={() => handleMove(unit, 'down')} disabled={globalIdx === sortedUnits.length - 1}>⬇</button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">មិនមានសិទ្ធិ</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {editingId && editError && <div className="text-red-500 text-xs mt-1">{editError}</div>}

      {/* Pagination controls */}
      <div className="mt-3 flex gap-2 items-center">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 border rounded disabled:opacity-50">មុន</button>
        <span className="text-xs">ទំព័រ {page} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 border rounded disabled:opacity-50">បន្ទាប់</button>
      </div>
    </div>
  );
};

export default DepartmentUnits;
