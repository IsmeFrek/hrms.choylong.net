import React, { useState, useEffect } from 'react';
import { ministrySkillAPI } from '../services/api';
import usePermission from '../hooks/usePermission';
import { Trash2, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function MinistrySkillPage() {
  const perms = usePermission();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newID, setNewID] = useState('');
  const [newSkillKh, setNewSkillKh] = useState('');
  const [newMinistry, setNewMinistry] = useState('');
  const [newSkillEn, setNewSkillEn] = useState('');
  const [newOther, setNewOther] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editID, setEditID] = useState('');
  const [editSkillKh, setEditSkillKh] = useState('');
  const [editMinistry, setEditMinistry] = useState('');
  const [editSkillEn, setEditSkillEn] = useState('');
  const [editOther, setEditOther] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState('skills_Id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (perms.canViewSkills) fetchSkills();
  }, [perms.canViewSkills]);

  const fetchSkills = async () => {
    if (!perms.canViewSkills) return;
    setLoading(true);
    try {
      const res = await ministrySkillAPI.getSkills();
      setSkills(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setSkills([]);
    }
    setLoading(false);
  };

  const onDragStart = (e, skill) => {
    setDraggingId(skill._id);
    try { e.dataTransfer.setData('text/plain', skill._id); } catch (err) { }
    e.dataTransfer.effectAllowed = 'move';
    if (e.dataTransfer.setDragImage && e.target) {
      try { const img = document.createElement('canvas'); img.width = 1; img.height = 1; e.dataTransfer.setDragImage(img, 0, 0); } catch (err) { }
    }
  };
  const onDragEnter = (e, skill) => { e.preventDefault(); setDragOverId(skill._id); };
  const onDragOver = (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (err) { } };
  const onDragLeave = (e) => { setDragOverId(null); };
  const onDrop = async (e, targetSkill) => {
    e.preventDefault();
    if (!draggingId) return;
    if (draggingId === targetSkill._id) { setDraggingId(null); setDragOverId(null); return; }
    setReordering(true);
    try {
      const a = skills.find(s => s._id === draggingId);
      const b = skills.find(s => s._id === targetSkill._id);
      if (!a || !b) return;
      const payloadA = { ID_skills: b.skills_Id || b.ID_skills, ministryFunction: b.ministryFunction, amount: b.amount, other: b.other || b.Other, total: b.total ?? b.Total, male: b.male ?? b.Male, female: b.female ?? b.Female };
      const payloadB = { ID_skills: a.skills_Id || a.ID_skills, ministryFunction: a.ministryFunction, amount: a.amount, other: a.other || a.Other, total: a.total ?? a.Total, male: a.male ?? a.Male, female: a.female ?? a.Female };
      await Promise.all([ministrySkillAPI.updateSkill(a._id, payloadA), ministrySkillAPI.updateSkill(b._id, payloadB)]);
      await fetchSkills();
    } catch (err) { console.error('Drag swap failed', err); alert('Swap failed: ' + (err.response?.data?.error || err?.message || err)); }
    finally { setReordering(false); setDraggingId(null); setDragOverId(null); }
  };
  const onDragEnd = () => { setDraggingId(null); setDragOverId(null); };

  const openAddModal = () => { if (!perms.canEditSkills) return; setNewID(''); setNewMinistry(''); setNewSkillEn(''); setNewOther(''); setShowAddModal(true); };
  const closeAddModal = () => setShowAddModal(false);
  const openEditModal = (skill) => { setEditingRowId(skill._id); setEditID(skill.skills_Id || skill.ID_skills); setEditMinistry(skill.ministryFunction || ''); setEditSkillEn(skill.amount || ''); setEditOther(skill.other || skill.Other || ''); setShowEditModal(true); };
  const closeEditModal = () => { setShowEditModal(false); setEditingRowId(null); };

  const handleAddSkill = async () => {
    if (!perms.canEditSkills) return;
    if (!newID.trim() || !newMinistry.trim()) return;
    setAdding(true);
    try {
      await ministrySkillAPI.createSkill({ ID_skills: newID, ministryFunction: newMinistry, amount: newSkillEn || '-', other: newOther });
      setShowAddModal(false);
      fetchSkills();
    } catch (err) {
      alert('មានបញ្ហាក្នុងការបញ្ចូលទិន្នន័យ៖ ' + (err.response?.data?.error || err.message));
    } finally { setAdding(false); }
  };

  const handleUpdateSkill = async () => {
    if (!perms.canEditSkills) return;
    try {
      await ministrySkillAPI.updateSkill(editingRowId, { ID_skills: editID, ministryFunction: editMinistry, amount: editSkillEn || '-', other: editOther });
      setShowEditModal(false); setEditingRowId(null); fetchSkills();
    } catch (err) {
      alert('មានបញ្ហាក្នុងការកែប្រែ៖ ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteSkill = async (id) => { if (!perms.canEditSkills) return; if (window.confirm('លុបជំនាញនេះ?')) { await ministrySkillAPI.deleteSkill(id); fetchSkills(); } };

  const moveSkill = async (skill, dir) => {
    if (!perms.canEditSkills) return; setReordering(true);
    try {
      const full = [...sortedSkills]; const idx = full.findIndex(s => s._id === skill._id); if (idx === -1) return; const j = idx + dir; if (j < 0 || j >= full.length) return;
      const a = full[idx]; const b = full[j];
      const payloadA = { ID_skills: b.skills_Id || b.ID_skills, ministryFunction: b.ministryFunction, amount: b.amount, other: b.other || b.Other, total: b.total ?? b.Total, male: b.male ?? b.Male, female: b.female ?? b.Female };
      const payloadB = { ID_skills: a.skills_Id || a.ID_skills, ministryFunction: a.ministryFunction, amount: a.amount, other: a.other || a.Other, total: a.total ?? a.Total, male: a.male ?? a.Male, female: a.female ?? a.Female };
      await Promise.all([ministrySkillAPI.updateSkill(a._id, payloadA), ministrySkillAPI.updateSkill(b._id, payloadB)]);
      await fetchSkills();
    } catch (err) { console.error('Reorder (swap) failed', err); alert('Swap failed: ' + (err.response?.data?.error || err?.message || err)); }
    finally { setReordering(false); }
  };

  const handleExport = () => {
    const csvRows = [['skills_Id', 'ministryFunction', 'amount', 'other'], ...skills.map(skill => [skill.skills_Id || skill.ID_skills, skill.ministryFunction || '', skill.amount, skill.other || skill.Other])];
    const csvContent = '\uFEFF' + csvRows.map(row => row.map(val => `"${val || ''}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ministry_skills.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const wsData = [
      ['skills_Id', 'ministryFunction', 'amount', 'other'],
      ['S001', 'មន្ត្រីអភិវឌ្ឍន៍កម្មវិធី', '1000', 'ចំណាំផ្សេងៗ'],
      ['S002', 'មន្ត្រីរដ្ឋបាល', '800', '']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Ministry_Skills_Template.xlsx");
  };

  const handleImport = async (e) => {
    if (!perms.canEditSkills) return; 
    const file = e.target.files[0]; 
    if (!file) return; 
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const dataRows = rows.slice(1);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const row of dataRows) {
        if (!row || row.length === 0) continue;
        const skills_Id = (row[0] || '').toString().trim();
        const ministryFunction = (row[1] || '').toString().trim();
        const amount = (row[2] || '').toString().trim();
        const other = (row[3] || '').toString().trim();
        
        if (skills_Id && ministryFunction) {
          try {
            await ministrySkillAPI.createSkill({ ID_skills: skills_Id, ministryFunction, amount: amount || '-', other });
            successCount++;
          } catch (err) {
            console.error(`បរាជ័យក្នុងការបញ្ចូលជួរ ${skills_Id}:`, err);
            errorCount++;
          }
        }
      }
      fetchSkills();
      if (errorCount > 0) {
        alert(`បានបញ្ចូលជោគជ័យ ${successCount} ជួរ និងមានទិន្នន័យជាន់គ្នា ឬមានបញ្ហាចំនួន ${errorCount} ជួរ។`);
      } else {
        alert(`បញ្ចូលទិន្នន័យចំនួន ${successCount} ជួរដោយជោគជ័យ។`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('មានបញ្ហាក្នុងការអានឯកសារ Excel៖ ' + (error.message || error));
    } finally {
      e.target.value = null; // reset input
    }
  };

  const sortedSkills = [...skills].sort((a, b) => {
    if (sortField === 'skills_Id') { const valA = Number(a.skills_Id || a.ID_skills) || 0; const valB = Number(b.skills_Id || b.ID_skills) || 0; return sortOrder === 'asc' ? valA - valB : valB - valA; }
    else { const valA = (a[sortField] || '').toString(); const valB = (b[sortField] || '').toString(); return sortOrder === 'asc' ? valA.localeCompare(valB, 'km') : valB.localeCompare(valA, 'km'); }
  });

  const handleSort = (field) => { if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortOrder('asc'); } };

  const filteredSkills = sortedSkills.filter(skill => ((skill.ministryFunction || '').toLowerCase().includes(search.toLowerCase()) || (skill.amount || '').toLowerCase().includes(search.toLowerCase()) || (skill.other || skill.Other || '').toLowerCase().includes(search.toLowerCase())) && (skill.ministryFunction && skill.ministryFunction.trim() !== ''));
  const pagedSkills = filteredSkills.slice((page - 1) * limit, page * limit);
  const totalPages = Math.max(1, Math.ceil(filteredSkills.length / limit));

  if (!perms.canViewSkills) {
    return <div className="p-6"><h2 className="text-2xl font-bold mb-2 text-gray-900">ជំនាញក្រសួង (Ministry Skills)</h2><div className="mt-4 p-3 border rounded bg-yellow-50 text-yellow-800">Requires permission: view:skills</div></div>;
  }

  return (
    <div className="p-6" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
      <h2 className="text-2xl font-bold mb-2 text-gray-900">ជំនាញក្រសួង (Ministry Skills)</h2>
      <div className="mb-4 flex items-center">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="ស្វែងរក..." className="border px-3 py-3 rounded w-80 mr-6" />
        <span className="mr-6 font-semibold">ចំនួនជំនាញក្រសួង៖ {filteredSkills.length}</span>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="bg-purple-400 text-white px-7 py-1 rounded mr-5">
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={70}>70</option>
          <option value={100}>100</option>
        </select>
        <button onClick={handleExport} className="bg-green-700 text-white px-7 py-1 rounded mr-5">នាំចេញ</button>
        {perms.canEditSkills && (
          <button onClick={handleDownloadTemplate} className="bg-teal-600 text-white px-7 py-1 rounded mr-5">ទាញយកឯកសារគំរូ</button>
        )}
        {perms.canEditSkills && (
          <label className="bg-yellow-700 text-white px-7 py-1 rounded mr-5 cursor-pointer">នាំចូល<input type="file" accept=".csv, .xlsx, .xls" style={{ display: 'none' }} onChange={handleImport} /></label>
        )}
        {perms.canEditSkills && (
          <button onClick={openAddModal} className="bg-blue-600 text-white px-7 py-1 rounded mr-5">បន្ថែម</button>
        )}
      </div>
      {loading ? (<div>កំពុងទាញ...</div>) : (
        <>
          {reordering && <div className="mb-2 text-yellow-700 font-medium">កំពុងរៀបចំលំដាប់...</div>}
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-200">
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('skills_Id')}>លេខសម្គាល់ {sortField === 'skills_Id' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>

                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('ministryFunction')}>មុខងារក្រសួង {sortField === 'ministryFunction' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('amount')}>ទឹកប្រាក់ {sortField === 'amount' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('total')}>សរុប {sortField === 'total' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('male')}>ប្រុស {sortField === 'male' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('female')}>ស្រី {sortField === 'female' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2 cursor-pointer" onClick={() => handleSort('other')}>ព័ត៌មានផ្សេងៗ {sortField === 'other' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                <th className="border px-4 py-2">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {pagedSkills.map((skill) => (
                <tr key={skill._id} draggable={perms.canEditSkills && !reordering} onDragStart={(e) => onDragStart(e, skill)} onDragEnter={(e) => onDragEnter(e, skill)} onDragOver={onDragOver} onDrop={(e) => onDrop(e, skill)} onDragLeave={onDragLeave} onDragEnd={onDragEnd} className={dragOverId === skill._id ? 'bg-yellow-50' : ''}>
                  <td className="border px-2 py-1">{skill.skills_Id || skill.ID_skills}</td>

                  <td className="border px-2 py-1">{skill.ministryFunction || ''}</td>
                  <td className="border px-2 py-1">{skill.amount}</td>
                  <td className="border px-2 py-1">{skill.total ?? skill.Total ?? ''}</td>
                  <td className="border px-2 py-1">{skill.male ?? skill.Male ?? ''}</td>
                  <td className="border px-2 py-1">{skill.female ?? skill.Female ?? ''}</td>
                  <td className="border px-2 py-1">{skill.other}</td>
                  <td className="border px-2 py-1">
                    {perms.canEditSkills && (
                      <>
                        {(() => {
                          const globalIdx = sortedSkills.findIndex(s => s._id === skill._id); const isFirst = globalIdx === 0; const isLast = globalIdx === (sortedSkills.length - 1); return (
                            <span style={{ marginRight: 8 }}>
                              <button type="button" onMouseDown={e => e.preventDefault()} onDragStart={e => e.preventDefault()} onPointerDown={e => e.preventDefault()} onClick={e => { e.stopPropagation(); moveSkill(skill, -1); }} disabled={isFirst || reordering} title="លើ" className={`px-0.5 py-1 border rounded mr-1 ${isFirst || reordering ? 'bg-gray-200 text-gray-400' : 'bg-gray-100'}`}>▲</button>
                              <button type="button" onMouseDown={e => e.preventDefault()} onDragStart={e => e.preventDefault()} onPointerDown={e => e.preventDefault()} onClick={e => { e.stopPropagation(); moveSkill(skill, 1); }} disabled={isLast || reordering} title="ក្រោម" className={`px-0.5 py-1 border rounded mr-2 ${isLast || reordering ? 'bg-gray-200 text-gray-400' : 'bg-gray-100'}`}>▼</button>
                            </span>
                          );
                        })()}
                        <button type="button" onMouseDown={e => e.preventDefault()} onDragStart={e => e.preventDefault()} onPointerDown={e => e.preventDefault()} onClick={e => { e.stopPropagation(); openEditModal(skill); }} disabled={reordering} className={`bg-green-600 text-white px-2 py-1 rounded mr-2 ${reordering ? 'opacity-60 cursor-not-allowed' : ''}`}>កែ</button>
                        <button type="button" onMouseDown={e => e.preventDefault()} onDragStart={e => e.preventDefault()} onPointerDown={e => e.preventDefault()} onClick={e => { e.stopPropagation(); handleDeleteSkill(skill._id); }} disabled={reordering} className={`bg-red-700 text-white px-1 py-1 rounded ${reordering ? 'opacity-60 cursor-not-allowed' : ''}`}>លុប</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {pagedSkills.length === 0 && (
                <tr><td colSpan={9} className="py-6 text-center text-gray-500">មិនមានជំនាញក្រសួង</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex justify-center items-center mt-4 gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page === 1} className={`px-3 py-1 border rounded ${page === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-700 text-white'}`}>Prev</button>
            <span className="px-4 py-1 rounded bg-blue-600 text-white font-bold">ទំព័រ {page} / {totalPages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className={`px-3 py-1 border rounded ${page === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-700 text-white'}`}>Next</button>
          </div>
        </>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[350px]">
            <h3 className="text-lg font-bold mb-4 text-indigo-800">បន្ថែមជំនាញក្រសួង</h3>
            <label className="block mb-1 font-medium text-lg text-blue-600">លេខសម្គាល់</label>
            <input value={newID || ''} onChange={e => setNewID(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />

            <label className="block mb-1 font-medium text-lg text-blue-600">មុខងារក្រសួង</label>
            <input value={newMinistry || ''} onChange={e => setNewMinistry(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ទឹកប្រាក់</label>
            <input value={newSkillEn || ''} onChange={e => setNewSkillEn(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ព័ត៌មានផ្សេងៗ</label>
            <input value={newOther || ''} onChange={e => setNewOther(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <div className="flex justify-end mt-4">
              <button onClick={handleAddSkill} className="bg-indigo-600 text-white px-4 py-1 rounded mr-2 hover:bg-indigo-700">រក្សាទុក</button>
              <button onClick={closeAddModal} className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600">បោះបង់</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[350px]">
            <h3 className="text-lg font-bold mb-4 text-indigo-800">កែប្រែជំនាញក្រសួង</h3>
            <label className="block mb-1 font-medium text-lg text-blue-600">លេខសម្គាល់</label>
            <input value={editID || ''} onChange={e => setEditID(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />

            <label className="block mb-1 font-medium text-lg text-blue-600">មុខងារក្រសួង</label>
            <input value={editMinistry || ''} onChange={e => setEditMinistry(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ទឹកប្រាក់</label>
            <input value={editSkillEn || ''} onChange={e => setEditSkillEn(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block mb-1 font-medium text-lg text-blue-600">ព័ត៌មានផ្សេងៗ</label>
            <input value={editOther || ''} onChange={e => setEditOther(e.target.value)} className="border-2 border-indigo-300 text-gray-900 text-lg px-3 py-2 mb-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <div className="flex justify-end mt-4">
              <button onClick={handleUpdateSkill} className="bg-indigo-600 text-white px-4 py-1 rounded mr-2 hover:bg-indigo-700">រក្សាទុក</button>
              <button onClick={closeEditModal} className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600">បោះបង់</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
