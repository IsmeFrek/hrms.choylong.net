import React, { useState, useEffect, useRef } from 'react';
import HRAPI from '../services/hrAPI';
import StaftPage from './StaftPage';
import { MdVisibility, MdPerson, MdEdit, MdDelete, MdAssignmentInd, MdGroup } from 'react-icons/md';

// Fix for "Failed to resolve import 'react-icons/md'":
// You must install react-icons in your project folder.
// In your terminal, run one of these commands inside d:\app9a:

// Recommended (avoids most peer dependency issues):
//   npm install react-icons --legacy-peer-deps

// If you still get errors, try:
//   npm install react-icons --force

// After successful install, restart your dev server (e.g., npm run dev).
// The import will then work and the error will be resolved.

// Required npm packages for this file:
// 1. react-icons
//    Install with:
//      npm install react-icons --legacy-peer-deps
//
// If you use FontAwesome icons (the <i className="fas fa-user ..."/>), you may also want:
// 2. @fortawesome/fontawesome-free
//    Install with:
//      npm install @fortawesome/fontawesome-free
//
// For everything else in this file, no additional packages are needed.

export default function HRPage() {
  const [hrList, setHRList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newHR, setNewHR] = useState({
    no: '', staffId: '', khmerName: '', name: '', gender: '', dob: '', maritalStatus: '', bloodGroup: '',
    phone: '', birthPlace: '', currentPlace: '', officerType: '', position: '', skill: '', Department_Kh: '',
    joinDate: '', dateJoinedMinistry: '', lastSalaryIncrementDate: '', workOther: '',
    degreeLevel: '', degree: '', educationLevel: '',
    officerId: '', cardNumber: '', nid: '', bankAccount: '',
    civilServantId: '', yearsInCurrentRank: '', rankExitReason: '', rankExitDuration: '', grade: '',
    proposedBy: '', yearsInRank: '', totalYearsWorked: '', asOfDate: '', salaryLevel: '', mentorName: '', mentorDate: '',
    creativityScore: '', responsibilityScore: '', patriotismScore: '', leadershipScore: '', ethicsScore: '', totalScore: '',
    reason1: '', reason2: '', reason3: '', reason4: '', reason5: '', reason6: '',
    status: 'Active', image: '', other: ''
  });
  const [editHR, setEditHR] = useState({ ...newHR });
  const [editingId, setEditingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState('staffId');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [visibleFields, setVisibleFields] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [reviewImage, setReviewImage] = useState(null);

  const allFields = [
    { key: 'no', label: 'ល.រ' },
    { key: 'staffId', label: 'លេខកាត' },
    { key: 'khmerName', label: 'គោត្តនាម និងនាម' },
    { key: 'name', label: 'ឡាតាំង' },
    { key: 'gender', label: 'ភេទ' },
    { key: 'dob', label: 'ថ្ងៃកំណើត' },
    { key: 'maritalStatus', label: 'ស្ថានភាពគ្រួសារ' },
    { key: 'bloodGroup', label: 'ក្រុមឈាម' },
    { key: 'phone', label: 'ទូរស័ព្ទ' },
    { key: 'birthPlace', label: 'ទីកន្លែងកំណើត' },
    { key: 'currentPlace', label: 'ទីកន្លែងបច្ចុប្បន្ន' },
    { key: 'officerType', label: 'ប្រភេទមន្ត្រី' },
    { key: 'position', label: 'តួនាទី' },
    { key: 'skill', label: 'ជំនាញ' },
    { key: 'Department_Kh', label: 'ផ្នែក' },
    { key: 'joinDate', label: 'កាលបរិច្ឆេទចូលបម្រើការងារ' },
    { key: 'dateJoinedMinistry', label: 'កាលបរិច្ឆេទចូលកាន់តំណែងមន្ទីរ' },
    { key: 'lastSalaryIncrementDate', label: 'កាលបរិច្ឆេទបញ្ចប់តំណែង' },
    { key: 'workOther', label: 'ផ្សេងៗការងារ' },
    { key: 'degreeLevel', label: 'កម្រិតសញ្ញាប័ត្រ' },
    { key: 'degree', label: 'សញ្ញាប័ត្រ' },
    { key: 'educationLevel', label: 'កម្រិតវប្បធម៌' },
    { key: 'officerId', label: 'លេខមន្ត្រី' },
    { key: 'cardNumber', label: 'លេខកាត' },
    { key: 'nid', label: 'លេខអត្តសញ្ញាណ' },
    { key: 'bankAccount', label: 'លេខគណនីធនាគារ' },
    { key: 'civilServantId', label: 'លេខមន្ត្រីរាជការ' },
    { key: 'yearsInCurrentRank', label: 'ឆ្នាំក្នុងថ្នាក់បច្ចុប្បន្ន' },
    { key: 'rankExitReason', label: 'មូលហេតុចាកចេញពីថ្នាក់' },
    { key: 'rankExitDuration', label: 'រយៈពេលចាកចេញ' },
    { key: 'grade', label: 'ថ្នាក់' },
    { key: 'proposedBy', label: 'ស្នើដោយ' },
    { key: 'yearsInRank', label: 'ឆ្នាំក្នុងថ្នាក់' },
    { key: 'totalYearsWorked', label: 'ចំនួនឆ្នាំធ្វើការ' },
    { key: 'asOfDate', label: 'ថ្ងៃបច្ចុប្បន្ន' },
    { key: 'salaryLevel', label: 'កាំប្រាក់' },
    { key: 'mentorName', label: 'ឈ្មោះអ្នកណែនាំ' },
    { key: 'mentorDate', label: 'ថ្ងៃណែនាំ' },
    { key: 'creativityScore', label: 'ពិន្ទុសិល្បៈ' },
    { key: 'responsibilityScore', label: 'ពិន្ទុទទួលខុសត្រូវ' },
    { key: 'patriotismScore', label: 'ពិន្ទុស្មោះត្រង់' },
    { key: 'leadershipScore', label: 'ពិន្ទុភាពជាអ្នកដឹកនាំ' },
    { key: 'ethicsScore', label: 'ពិន្ទុសីលធម៌' },
    { key: 'totalScore', label: 'ពិន្ទុសរុប' },
    { key: 'reason1', label: 'មូលហេតុ១' },
    { key: 'reason2', label: 'មូលហេតុ២' },
    { key: 'reason3', label: 'មូលហេតុ៣' },
    { key: 'reason4', label: 'មូលហេតុ៤' },
    { key: 'reason5', label: 'មូលហេតុ៥' },
    { key: 'reason6', label: 'មូលហេតុ៦' },
    { key: 'image', label: 'រូបភាព' },
    { key: 'other', label: 'ផ្សេងៗ' },
    { key: 'status', label: 'ស្ថានភាព' }
  ];

  useEffect(() => {
    setVisibleFields(allFields.map(f => f.key));
    fetchHR();
  }, []);

  // Re-fetch HRs after closing Add/Edit modal to ensure new data is shown
  useEffect(() => {
    if (!showAddModal && !showEditModal) {
      fetchHR();
    }
  }, [showAddModal, showEditModal]);

  const fetchHR = async () => {
    setLoading(true);
    try {
      const res = await HRAPI.getAll();
      setHRList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setHRList([]);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setNewHR({
      no: '', staffId: '', khmerName: '', name: '', gender: '', dob: '', maritalStatus: '', bloodGroup: '',
      phone: '', birthPlace: '', currentPlace: '', officerType: '', position: '', skill: '', Department_Kh: '',
      joinDate: '', dateJoinedMinistry: '', lastSalaryIncrementDate: '', workOther: '',
      degreeLevel: '', degree: '', educationLevel: '',
      officerId: '', cardNumber: '', nid: '', bankAccount: '',
      civilServantId: '', yearsInCurrentRank: '', rankExitReason: '', rankExitDuration: '', grade: '',
      proposedBy: '', yearsInRank: '', totalYearsWorked: '', asOfDate: '', salaryLevel: '', mentorName: '', mentorDate: '',
      creativityScore: '', responsibilityScore: '', patriotismScore: '', leadershipScore: '', ethicsScore: '', totalScore: '',
      reason1: '', reason2: '', reason3: '', reason4: '', reason5: '', reason6: '',
      status: 'Active', image: '', other: ''
    });
    setShowAddModal(true);
  };
  const closeAddModal = () => { setShowAddModal(false); };
  const openEditModal = (hr) => {
    setEditingId(hr._id);
    setEditHR({ ...hr });
    setShowEditModal(true);
  };
  const closeEditModal = () => { setShowEditModal(false); setEditingId(null); };

  const handleAdd = async () => {
    if (!newHR.staffId.trim() || !newHR.khmerName.trim() || !newHR.name.trim()) return;
    await HRAPI.create(newHR); // newHR មាន field image (base64 string)
    setShowAddModal(false);
    await fetchHR();
  };
  const handleUpdate = async () => {
    await HRAPI.update(editingId, editHR);
    setShowEditModal(false);
    setEditingId(null);
  await fetchHR();
  };
  const handleDelete = async (id) => {
    if (window.confirm('លុបបុគ្គលិក HR នេះ?')) {
      await HRAPI.delete(id);
      fetchHR();
    }
  };

  // Sorting
  const sortedHR = [...hrList].sort((a, b) => {
    const valA = (a[sortField] || '').toString();
    const valB = (b[sortField] || '').toString();
    if (sortOrder === 'asc') return valA.localeCompare(valB, 'km');
    return valB.localeCompare(valA, 'km');
  });

  // Filtering, Pagination
  const filteredHR = sortedHR.filter(hr =>
    (hr.staffId || '').toLowerCase().includes(search.toLowerCase()) ||
    (hr.khmerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (hr.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (hr.position || '').toLowerCase().includes(search.toLowerCase())
  );
  const pagedHR = filteredHR.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filteredHR.length / limit);

  const handleSort = (field) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  // Export HRs to CSV
  const handleExport = () => {
    const fields = ['staffId','khmerName','name','gender','dob','position','phone','status','image','other'];
    const csvRows = [fields];
    hrList.forEach(hr => {
      csvRows.push(fields.map(f => JSON.stringify(hr[f] ?? '')));
    });
    const csvContent = '\uFEFF' + csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hr.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import HRs from CSV
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/);
      const [header, ...rows] = lines;
      const fields = header.split(',').map(h => h.replace(/"/g, ''));
      rows.forEach(row => {
        const values = row.split(',').map(v => v.replace(/"/g, ''));
        if (values.length === fields.length) {
          const hrObj = {};
          fields.forEach((f, i) => { hrObj[f] = values[i]; });
          HRAPI.create(hrObj);
        }
      });
      fetchHR();
    };
    reader.readAsText(file);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Tab state for column selection
  const [colTab, setColTab] = useState('personal');
  const [initialFieldsSet, setInitialFieldsSet] = useState(false);

  useEffect(() => {
    if (!initialFieldsSet) {
      setVisibleFields(tabFields.personal.map(f => f.key));
      setInitialFieldsSet(true);
      fetchHR();
    }
  }, [initialFieldsSet]);

  useEffect(() => {
    // Show only 'personal' fields by default on first load
    setVisibleFields(tabFields.personal.map(f => f.key));
    fetchHR();
  }, []);

  // Split fields by tab (example: personal, work, other)
  const tabFields = {
    all: allFields,
    personal: allFields.filter(f =>
      ['no', 'staffId', 'khmerName', 'name', 'gender', 'dob', 'maritalStatus', 'bloodGroup', 'phone', 'birthPlace', 'currentPlace'].includes(f.key)
    ),
    work: allFields.filter(f =>
      ['officerType', 'position', 'skill', 'Department_Kh', 'joinDate', 'dateJoinedMinistry', 'lastSalaryIncrementDate', 'workOther', 'degreeLevel', 'degree', 'educationLevel', 'salaryLevel', 'mentorName', 'mentorDate'].includes(f.key)
    ),
    score: allFields.filter(f =>
      ['creativityScore', 'responsibilityScore', 'patriotismScore', 'leadershipScore', 'ethicsScore', 'totalScore'].includes(f.key)
    ),
    other: allFields.filter(f =>
      ['officerId', 'cardNumber', 'nid', 'bankAccount', 'civilServantId', 'dateJoinedGov', 'yearsInCurrentRank', 'rankExitReason', 'rankExitDuration', 'grade', 'proposedBy', 'yearsInRank', 'totalYearsWorked', 'asOfDate', 'reason1', 'reason2', 'reason3', 'reason4', 'reason5', 'reason6', 'status', 'image', 'other'].includes(f.key)
    )
  };

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="p-6" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
      <h2 className="text-2xl font-bold mb-2 text-gray-900">បុគ្គលិក HR</h2>
      <div className="mb-4 flex items-center">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="ស្វែងរក..."
          className="border px-3 py-3 rounded w-80 mr-6"
        />
        <span className="mr-6 font-semibold">ចំនួនបុគ្គលិក៖ {filteredHR.length}</span>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="bg-purple-400 text-white px-7 py-1 rounded mr-5">
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={70}>70</option>
          <option value={100}>100</option>
        </select>
        <button onClick={handleExport} className="bg-green-700 text-white px-7 py-1 rounded mr-5">នាំចេញ</button>
        <label className="bg-yellow-700 text-white px-7 py-1 rounded mr-5 cursor-pointer">
          នាំចូល
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
        </label>
        <button onClick={openAddModal} className="bg-blue-600 text-white px-7 py-1 rounded mr-2">បន្ថែម</button>
        {/* Tabbed panel for column selection */}
        <div className="relative inline-block">
          <button
            className="border px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
            onClick={() => setShowDropdown(v => !v)}
            type="button"
          >
            ជ្រើសរើសបង្ហាញ Fields
          </button>
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute z-10 bg-white border rounded shadow-lg mt-2 min-w-[260px] right-0"
              style={{ maxHeight: '350px', overflowY: 'auto' }}
            >
              <div className="flex border-b mb-2">
                <button
                  className={`flex-1 px-2 py-1 text-xs ${colTab === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setColTab('all')}
                  type="button"
                >ទាំងអស់</button>
                <button
                  className={`flex-1 px-2 py-1 text-xs ${colTab === 'personal' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setColTab('personal')}
                  type="button"
                >ផ្ទាល់ខ្លួន</button>
                <button
                  className={`flex-1 px-2 py-1 text-xs ${colTab === 'work' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setColTab('work')}
                  type="button"
                >ការងារ</button>
                <button
                  className={`flex-1 px-2 py-1 text-xs ${colTab === 'score' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setColTab('score')}
                  type="button"
                >ពិន្ទុ</button>
                <button
                  className={`flex-1 px-2 py-1 text-xs ${colTab === 'other' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setColTab('other')}
                  type="button"
                >ផ្សេងៗ</button>
              </div>
              {/* Select All Checkbox */}
              <label className="flex items-center gap-2 py-1 text-sm font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleFields.length === tabFields[colTab].length}
                  onChange={e => {
                    if (e.target.checked) {
                      // Add all fields in tab
                      const newFields = Array.from(new Set([...visibleFields, ...tabFields[colTab].map(f => f.key)]));
                      setVisibleFields(newFields);
                    } else {
                      // Remove all fields in tab
                      setVisibleFields(visibleFields.filter(k => !tabFields[colTab].map(f => f.key).includes(k)));
                    }
                  }}
                />
                ជ្រើសរើសទាំងអស់
              </label>
              <hr className="my-2" />
              {tabFields[colTab].map(f => (
                <label key={f.key} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleFields.includes(f.key)}
                    onChange={e => {
                      if (e.target.checked) setVisibleFields([...visibleFields, f.key]);
                      else setVisibleFields(visibleFields.filter(k => k !== f.key));
                    }}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      {loading ? (
        <div>កំពុងទាញ...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr className="bg-purple-50">
              <th className="border px-4 py-2">សកម្មភាព</th>
              <th className="border px-4 py-2">រូបភាព</th>
              {allFields.filter(f => visibleFields.includes(f.key)).map(f => (
                <th
                  key={f.key}
                  className="border px-4 py-2 cursor-pointer text-purple-800"
                  onClick={() => handleSort(f.key)}
                >
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedHR.map((hr, rowIndex) => (
              <tr key={hr._id}>
                {/* Action icons shown only when toggle is active */}
                <td className="border px-2 py-1 text-center">
                  <ActionIcons hrId={hr._id} openEditModal={() => openEditModal(hr)} handleDelete={() => handleDelete(hr._id)} />
                </td>
                <td className="border px-2 py-1 text-center">
                  {hr.image ? (
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full overflow-hidden p-0 border-0 bg-transparent mx-auto flex items-center justify-center"
                      onClick={() => setReviewImage(hr.image)}
                      style={{ cursor: 'pointer' }}
                    >
                      <img src={hr.image} alt="profile" className="w-10 h-10 object-cover rounded-full" />
                    </button>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                      <i className="fas fa-user text-gray-400 text-xl"></i>
                    </div>
                  )}
                </td>
                {allFields.filter(f => visibleFields.includes(f.key)).map(f => (
                  <td key={f.key} className="border px-2 py-1">
                    {(() => {
                      // Render dynamic row number based on current paging and index so numbering stays contiguous after deletes
                      if (f.key === 'no') {
                        return (page - 1) * limit + rowIndex + 1;
                      }
                      if (f.key === 'dob') {
                        return formatDate(hr[f.key]);
                      }
                      if (f.key === 'gender') {
                        return hr.gender === 'Male' ? 'ប្រុស' : hr.gender === 'Female' ? 'ស្រី' : hr.gender;
                      }
                      if (f.key === 'maritalStatus') {
                        return hr.maritalStatus === 'Single' ? 'លីវ'
                          : hr.maritalStatus === 'Married' ? 'រៀបការហើយ'
                          : hr.maritalStatus === 'Divorced' ? 'ពោះម៉ាយ'
                          : hr.maritalStatus === 'Widowed' ? 'មេម៉ាយ'
                          : hr.maritalStatus;
                      }
                      return hr[f.key];
                    })()}
                  </td>
                ))}
              </tr>
            ))}
            {pagedHR.length === 0 && (
              <tr>
                <td colSpan={visibleFields.length + 2} className="py-6 text-center text-gray-500">
                  មិនមានបុគ្គលិក HR
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
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
      {/* Modal Add & Edit moved to StaftPage */}
      <StaftPage
        showAddModal={showAddModal}
        showEditModal={showEditModal}
        newHR={newHR}
        editHR={editHR}
        setNewHR={setNewHR}
        setEditHR={setEditHR}
        handleAdd={handleAdd}
        handleUpdate={handleUpdate}
        closeAddModal={closeAddModal}
        closeEditModal={closeEditModal}
      />
      {reviewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 flex flex-col items-center">
            <h3 className="text-lg font-bold mb-2 text-blue-700">មើលរូបភាព</h3>
            <img src={reviewImage} alt="Review" className="w-80 h-80 object-contain rounded mb-4" />
            <button
              className="bg-red-600 text-white px-4 py-2 rounded"
              onClick={() => setReviewImage(null)}
            >
              បិទ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionIcons({ hrId, openEditModal, handleDelete }) {
  const [showIcons, setShowIcons] = React.useState(false);
  const iconsRef = React.useRef(null);

  // Hide action icons when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (iconsRef.current && !iconsRef.current.contains(event.target)) {
        setShowIcons(false);
      }
    }
    if (showIcons) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIcons]);

  return (
    <div className="flex flex-col items-center relative" ref={iconsRef}>
      <button
        className="w-7 h-7 bg-green-600 rounded flex items-center justify-center focus:outline-none border border-green-700 shadow"
        onClick={() => setShowIcons(v => !v)}
        title="Show Actions"
      >
        {/* Main grid icon */}
        <span className="w-4 h-4 flex items-center justify-center">
          <svg width="16" height="16" fill="white"><rect x="2" y="2" width="4" height="4"/><rect x="10" y="2" width="4" height="4"/><rect x="2" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/></svg>
        </span>
      </button>
      {showIcons && (
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 flex gap-1 px-1 py-1 rounded shadow-lg bg-white border z-20"
          style={{
            minWidth: 'max-content',
            maxWidth: '140px',
            width: '140px',
            marginLeft: '1px'
          }}
        >
          {/* Only keep the needed buttons: View, Edit, Profile, Delete, Team */}
          <button title="View" className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-700 text-white">
            <MdVisibility className="w-4 h-4" />
          </button>
          <button title="Edit" onClick={openEditModal} className="w-6 h-6 flex items-center justify-center rounded bg-green-600 hover:bg-green-700 text-white">
            <MdEdit className="w-4 h-4" />
          </button>
          <button title="Profile" className="w-6 h-6 flex items-center justify-center rounded bg-gray-500 hover:bg-gray-600 text-white">
            <MdPerson className="w-4 h-4" />
          </button>
          <button title="Delete" onClick={handleDelete} className="w-6 h-6 flex items-center justify-center rounded bg-red-600 hover:bg-red-700 text-white">
            <MdDelete className="w-4 h-4" />
          </button>
          <button title="Team" className="w-6 h-6 flex items-center justify-center rounded bg-green-500 hover:bg-green-600 text-white">
            <MdGroup className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}