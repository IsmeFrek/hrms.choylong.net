import React, { useState, useEffect } from 'react';
import { positionAPI } from '../services/positionAPI';
import usePermission from '../hooks/usePermission';

export default function PositionPage() {
  const perms = usePermission();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newId, setNewId] = useState('');
  const [newKh, setNewKh] = useState('');
  const [newEn, setNewEn] = useState('');
  const [newOther, setNewOther] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editId, setEditId] = useState('');
  const [editKh, setEditKh] = useState('');
  const [editEn, setEditEn] = useState('');
  const [editOther, setEditOther] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState('Position_Id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (perms.canViewPositions) fetchPositions();
  }, [perms.canViewPositions]);

  const fetchPositions = async () => {
    if (!perms.canViewPositions) return;
    setLoading(true);
    try {
      const res = await positionAPI.getPositions();
      let arr = [];
      if (Array.isArray(res.data)) {
        arr = res.data;
      } else if (Array.isArray(res.data.positions)) {
        arr = res.data.positions;
      }
      setPositions(arr);
    } catch (err) {
      setPositions([]);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    if (!perms.canEditPositions) return;
    setNewId(''); setNewKh(''); setNewEn(''); setNewOther('');
    setShowAddModal(true);
  };
  const closeAddModal = () => {
    setShowAddModal(false);
  };
  const openEditModal = (pos) => {
    setEditingId(pos._id);
    setEditId(pos.Position_Id || pos.positions_id || pos.positions_Id || '');
    setEditKh(pos.Position_Kh || pos.positions_Kh || '');
    setEditEn(pos.Position_En || pos.positions_En || '');
    setEditOther(pos.Other || pos.other || '');
    setShowEditModal(true);
  };
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!perms.canEditPositions) return;
    if (!newEn.trim() || !newKh.trim()) return;
    await positionAPI.createPosition({ Position_Id: newId, Position_En: newEn, Position_Kh: newKh, Other: newOther });
    setShowAddModal(false);
    fetchPositions();
  };

  const handleUpdate = async () => {
    if (!perms.canEditPositions) return;
    await positionAPI.updatePosition(editingId, { Position_Id: editId, Position_En: editEn, Position_Kh: editKh, Other: editOther });
    setShowEditModal(false);
    setEditingId(null);
    fetchPositions();
  };

  const handleDelete = async (id) => {
    if (!perms.canEditPositions) return;
    if (window.confirm('លុបតួនាទីនេះ?')) {
      await positionAPI.deletePosition(id);
      fetchPositions();
    }
  };

  // Export positions to CSV
  const handleExport = () => {
    const csvRows = [
      ['Position_Id', 'Position_Kh', 'Position_En', 'Other'],
      ...positions.map(pos => [pos.Position_Id ?? pos.positions_id ?? pos.positions_Id ?? '', pos.Position_Kh ?? pos.positions_Kh ?? '', pos.Position_En ?? pos.positions_En ?? '', pos.Other || pos.other || ''])
    ];
    const csvContent = '\uFEFF' + csvRows.map(row => row.map(val => `"${val || ''}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'positions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import positions from CSV
  const handleImport = (e) => {
    if (!perms.canEditPositions) return;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/);
      const [header, ...rows] = lines;
      rows.forEach(row => {
        const cols = row.split(',').map(s => s.replace(/"/g, ''));
        const Position_Id = cols[0] || '';
        const Position_Kh = cols[1] || '';
        const Position_En = cols[2] || '';
        const Other = cols[3] || '';
        if (Position_En && Position_Kh) {
          positionAPI.createPosition({ Position_Id, Position_En, Position_Kh, Other });
        }
      });
      fetchPositions();
    };
    reader.readAsText(file);
  };

  // Sorting
  const sortedPositions = [...positions].sort((a, b) => {
    if (sortField === 'Position_Id') {
      const valA = Number(a.Position_Id ?? a.Position_Id ?? 0) || 0;
      const valB = Number(b.Position_Id ?? b.Position_Id ?? 0) || 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    } else {
      const valA = (a[sortField] || a[sortField.replace('Position_', 'positions_')] || '').toString();
      const valB = (b[sortField] || b[sortField.replace('Position_', 'positions_')] || '').toString();
      if (sortOrder === 'asc') return valA.localeCompare(valB, 'km');
      return valB.localeCompare(valA, 'km');
    }
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtering, Pagination
  const filteredPositions = sortedPositions.filter(pos =>
    (pos.Position_En || pos.positions_En || '').toString().toLowerCase().includes(search.toLowerCase()) ||
    (pos.Position_Kh || pos.positions_Kh || '').toString().toLowerCase().includes(search.toLowerCase()) ||
    (pos.Position_Id || pos.positions_id || pos.positions_Id || '').toString().toLowerCase().includes(search.toLowerCase()) ||
    (pos.Other || pos.other || '').toString().toLowerCase().includes(search.toLowerCase())
  );
  const pagedPositions = filteredPositions.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filteredPositions.length / limit);

  if (!perms.canViewPositions) {
    return <div className="p-6"><h2 className="text-2xl font-bold mb-2 text-gray-900">តួនាទី (Positions)</h2><div className="mt-4 p-3 border rounded bg-yellow-50 text-yellow-800">Requires permission: view:positions</div></div>;
  }

  return (
    <div className="p-6" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
      <h2 className="text-2xl font-bold mb-2 text-gray-900">តួនាទី (Positions)</h2>
      <div className="mb-4 flex items-center">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="ស្វែងរក..."
          className="border px-3 py-3 rounded w-80 mr-6"
        />
        <span className="mr-6 font-semibold">ចំនួនតួនាទី៖ {filteredPositions.length}</span>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="bg-indigo-600 text-white px-7 py-1 rounded mr-5">
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={70}>70</option>
          <option value={100}>100</option>
        </select>
        <button onClick={handleExport} className="bg-green-700 text-white px-7 py-1 rounded mr-5">នាំចេញ</button>
        {perms.canEditPositions && (
          <label className="bg-yellow-700 text-white px-7 py-1 rounded mr-5 cursor-pointer">
            នាំចូល
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        )}
        {perms.canEditPositions && (
          <button onClick={openAddModal} className="bg-indigo-600 text-white px-7 py-1 rounded mr-5">បន្ថែម</button>
        )}
      </div>
      {loading ? (
        <div>កំពុងទាញ...</div>
      ) : (
        <>
          <table className="min-w-full border">
            <thead>
              <tr className="bg-indigo-50">
                <th className="border px-4 py-2 cursor-pointer text-indigo-800" onClick={() => handleSort('Position_Id')}>លេខសម្គាល់ {sortField === 'Position_Id' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer text-indigo-800" onClick={() => handleSort('Position_Kh')}>ឈ្មោះតួនាទី (ខ្មែរ) {sortField === 'Position_Kh' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer text-indigo-800" onClick={() => handleSort('Position_En')}>ឈ្មោះតួនាទី (អង់គ្លេស) {sortField === 'Position_En' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer text-indigo-800" onClick={() => handleSort('Other')}>ព័ត៌មានផ្សេងៗ {sortField === 'Other' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {pagedPositions.map(pos => (
                <tr key={pos._id}>
                  <td className="border px-2 py-1">{pos.Position_Id ?? pos.positions_id ?? pos.positions_Id ?? ''}</td>
                  <td className="border px-2 py-1">{pos.Position_Kh ?? pos.positions_Kh ?? ''}</td>
                  <td className="border px-2 py-1">{pos.Position_En ?? pos.positions_En ?? ''}</td>
                  <td className="border px-2 py-1">{pos.Other || pos.other || ''}</td>
                  <td className="border px-2 py-1">
                    {perms.canEditPositions && (
                      <>
                        <button onClick={() => openEditModal(pos)} className="bg-green-600 text-white px-2 py-1 rounded mr-2">កែ</button>
                        <button onClick={() => handleDelete(pos._id)} className="bg-red-700 text-white px-1 py-1 rounded">លុប</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {pagedPositions.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-gray-500">មិនមានតួនាទី</td></tr>
              )}
            </tbody>
          </table>
          {/* Pagination */}
          <div className="flex justify-center items-center mt-4 gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className={`px-3 py-1 border rounded ${page === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-700 text-white'}`}
            >Prev</button>
            <span className="px-4 py-1 rounded bg-blue-600 text-white font-bold">ទំព័រ {page} / {totalPages}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className={`px-3 py-1 border rounded ${page === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-700 text-white'}`}
            >Next</button>
          </div>
        </>
      )}
      {/* Modal Add */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[350px]">
            <h3 className="text-lg font-bold mb-4 text-indigo-800">បន្ថែមតួនាទី</h3>
            <label className="block mb-1 font-medium text-lg text-blue-600">លេខសម្គាល់</label>
            <input value={newId} onChange={e => setNewId(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះតួនាទី (ខ្មែរ)</label>
            <input value={newKh} onChange={e => setNewKh(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះតួនាទី (អង់គ្លេស)</label>
            <input value={newEn} onChange={e => setNewEn(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ព័ត៌មានផ្សេងៗ</label>
            <input value={newOther} onChange={e => setNewOther(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <div className="flex justify-end mt-4">
              <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-1 rounded mr-2 hover:bg-indigo-700">រក្សាទុក</button>
              <button onClick={closeAddModal} className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600">បោះបង់</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Edit */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[350px]">
            <h3 className="text-lg font-bold mb-4 text-indigo-800">កែប្រែតួនាទី</h3>
            <label className="block mb-1 font-medium text-lg text-blue-600">លេខសម្គាល់</label>
            <input value={editId} onChange={e => setEditId(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះតួនាទី (ខ្មែរ)</label>
            <input value={editKh} onChange={e => setEditKh(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះតួនាទី (អង់គ្លេស)</label>
            <input value={editEn} onChange={e => setEditEn(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ព័ត៌មានផ្សេងៗ</label>
            <input value={editOther} onChange={e => setEditOther(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <div className="flex justify-end mt-4">
              <button onClick={handleUpdate} className="bg-indigo-600 text-white px-4 py-1 rounded mr-2 hover:bg-indigo-700">រក្សាទុក</button>
              <button onClick={closeEditModal} className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600">បោះបង់</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
