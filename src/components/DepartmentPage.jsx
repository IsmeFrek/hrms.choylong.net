import React, { useState, useEffect } from 'react';
import { departmentAPI } from '../services/departmentAPI';
import usePermission from '../hooks/usePermission';

export default function DepartmentPage() {
  const perms = usePermission();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState(''); // Department_Id
  const [newKh, setNewKh] = useState(''); // Department_Kh
  const [newEn, setNewEn] = useState(''); // Department_En
  const [newOther, setNewOther] = useState(''); // Other
  const [editingRowId, setEditingRowId] = useState(null);
  const [editId, setEditId] = useState(''); // Department_Id
  const [editKh, setEditKh] = useState(''); // Department_Kh
  const [editEn, setEditEn] = useState(''); // Department_En
  const [editOther, setEditOther] = useState(''); // Other
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState('Department_Id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (perms.canViewDepartments) fetchDepartments();
  }, [perms.canViewDepartments]);

  const fetchDepartments = async () => {
    if (!perms.canViewDepartments) return;
    setLoading(true);
    try {
      const res = await departmentAPI.getDepartments();
      setDepartments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setDepartments([]);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    if (!perms.canEditDepartments) return;
    setNewId(''); setNewKh(''); setNewEn(''); setNewOther('');
    setShowAddModal(true);
  };
  const closeAddModal = () => {
    setShowAddModal(false);
  };
  const openEditModal = (dep) => {
    setEditingRowId(dep._id);
    setEditId(dep.Department_Id);
    setEditKh(dep.Department_Kh);
    setEditEn(dep.Department_En);
    setEditOther(dep.Other || '');
    setShowEditModal(true);
  };
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingRowId(null);
  };

  const handleAdd = async () => {
    if (!perms.canEditDepartments) return;
    if (!newId.trim() || !newEn.trim() || !newKh.trim()) return;
    await departmentAPI.createDepartment({
      Department_Id: newId,
      Department_En: newEn,
      Department_Kh: newKh,
      Other: newOther
    });
    setShowAddModal(false);
    fetchDepartments();
  };

  const handleUpdate = async () => {
    if (!perms.canEditDepartments) return;
    await departmentAPI.updateDepartment(editingRowId, {
      Department_Id: editId,
      Department_En: editEn,
      Department_Kh: editKh,
      Other: editOther
    });
    setShowEditModal(false);
    setEditingRowId(null);
    fetchDepartments();
  };

  const handleDelete = async (id) => {
    if (!perms.canEditDepartments) return;
    if (window.confirm('លុបផ្នែកនេះ?')) {
      await departmentAPI.deleteDepartment(id);
      fetchDepartments();
    }
  };

  // Export departments to CSV
  const handleExport = () => {
    const csvRows = [
      ['លេខសម្គាល់ផ្នែក', 'ឈ្មោះផ្នែក (ខ្មែរ)', 'ឈ្មោះផ្នែក (អង់គ្លេស)', 'ព័ត៌មានផ្សេងៗ'],
      ...departments.map(dep => [dep.Department_Id, dep.Department_Kh, dep.Department_En, dep.Other])
    ];
    const csvContent = '\uFEFF' + csvRows.map(row => row.map(val => `"${val || ''}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ផ្នែក.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import departments from CSV
  const handleImport = (e) => {
    if (!perms.canEditDepartments) return;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/);
      const [header, ...rows] = lines;
      rows.forEach(row => {
        const [Department_Id, Department_Kh, Department_En, Other] = row.split(',').map(s => s.replace(/"/g, ''));
        if (Department_Id && Department_Kh && Department_En) {
          departmentAPI.createDepartment({ Department_Id, Department_Kh, Department_En, Other });
        }
      });
      fetchDepartments();
    };
    reader.readAsText(file);
  };

  // Count logic for each department
  const getTotal = (dep) => dep.Department_Kh ? 1 : 0;
  const getMale = (dep) => dep.gender === 'ប្រុស' ? 1 : 0;
  const getFemale = (dep) => dep.gender === 'ស្រី' ? 1 : 0;

  const sortedDepartments = [...departments].sort((a, b) => {
    if (sortField === 'Department_Id') {
      const valA = Number(a.Department_Id) || 0;
      const valB = Number(b.Department_Id) || 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    } else {
      const valA = (a[sortField] || '').toString();
      const valB = (b[sortField] || '').toString();
      if (sortOrder === 'asc') {
        return valA.localeCompare(valB, 'km');
      } else {
        return valB.localeCompare(valA, 'km');
      }
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

  const filteredDepartments = sortedDepartments.filter(dep =>
    dep.Department_Id?.toString().includes(search) ||
    dep.Department_Kh?.includes(search) ||
    dep.Department_En?.includes(search) ||
    dep.Other?.includes(search)
  );
  const pagedDepartments = filteredDepartments.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filteredDepartments.length / limit);

  if (!perms.canViewDepartments) {
    return <div className="p-6"><h2 className="text-2xl font-bold mb-2 text-gray-900">ផ្នែក</h2><div className="mt-4 p-3 border rounded bg-yellow-50 text-yellow-800">Requires permission: view:departments</div></div>;
  }

  return (
    <div className="p-6" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
      <h2 className="text-2xl font-bold mb-2 text-gray-900">ផ្នែក</h2>
      <div className="mb-4 flex items-center">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="ស្វែងរក..."
          className="border px-3 py-3 rounded w-80 mr-6"
        />
        <span className="mr-6 font-semibold">ចំនួនផ្នែក៖ {filteredDepartments.length}</span>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="bg-purple-400 text-white px-7 py-1 rounded mr-5">
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={70}>70</option>
          <option value={100}>100</option>
        </select>
        <button onClick={handleExport} className="bg-green-700 text-white px-7 py-1 rounded mr-5">នាំចេញ</button>
        {perms.canEditDepartments && (
          <label className="bg-yellow-700 text-white px-7 py-1 rounded mr-5 cursor-pointer">
            នាំចូល
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        )}
        {perms.canEditDepartments && (
          <button onClick={openAddModal} className="bg-blue-600 text-white px-7 py-1 rounded mr-5">បន្ថែម</button>
        )}
      </div>
      {loading ? (
        <div>កំពុងទាញ...</div>
      ) : (
        <>
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-200">
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('Department_Id')}>លេខសម្គាល់ផ្នែក {sortField === 'Department_Id' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('Department_Kh')}>ឈ្មោះផ្នែក (ខ្មែរ) {sortField === 'Department_Kh' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('Department_En')}>ឈ្មោះផ្នែក (អង់គ្លេស) {sortField === 'Department_En' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2">សរុប</th>
                <th className="border px-4 py-2">ប្រុស</th>
                <th className="border px-4 py-2">ស្រី</th>
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('Other')}>ព័ត៌មានផ្សេងៗ {sortField === 'Other' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {pagedDepartments.map((dep) => (
                <tr key={dep._id}>
                  <td className="border px-2 py-1">{dep.Department_Id}</td>
                  <td className="border px-2 py-1">{dep.Department_Kh}</td>
                  <td className="border px-2 py-1">{dep.Department_En}</td>
                  <td className="border px-2 py-1">{getTotal(dep)}</td>
                  <td className="border px-2 py-1">{getMale(dep)}</td>
                  <td className="border px-2 py-1">{getFemale(dep)}</td>
                  <td className="border px-2 py-1">{dep.Other}</td>
                  <td className="border px-2 py-1">
                    {perms.canEditDepartments && (
                      <>
                        <button onClick={() => openEditModal(dep)} className="bg-green-600 text-white px-2 py-1 rounded mr-2">កែ</button>
                        <button onClick={() => handleDelete(dep._id)} className="bg-red-700 text-white px-1 py-1 rounded">លុប</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
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
            <h3 className="text-lg font-bold mb-4 text-indigo-800">បន្ថែមផ្នែក</h3>
            <label className="block mb-1 font-medium text-lg text-blue-600">លេខសម្គាល់ផ្នែក</label>
            <input value={newId} onChange={e => setNewId(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះផ្នែក (ខ្មែរ)</label>
            <input value={newKh} onChange={e => setNewKh(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះផ្នែក (អង់គ្លេស)</label>
            <input value={newEn} onChange={e => setNewEn(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
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
            <h3 className="text-lg font-bold mb-4 text-indigo-800">កែប្រែផ្នែក</h3>
            <label className="block mb-1 font-medium text-lg text-blue-600">លេខសម្គាល់ផ្នែក</label>
            <input value={editId} onChange={e => setEditId(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះផ្នែក (ខ្មែរ)</label>
            <input value={editKh} onChange={e => setEditKh(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះផ្នែក (អង់គ្លេស)</label>
            <input value={editEn} onChange={e => setEditEn(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
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
