import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Printer, FileText, User, Filter, Download, CreditCard, ShieldCheck, LayoutList, Eye, X, Upload, ImageIcon, Award, Briefcase } from 'lucide-react';
import { API_BASE } from '../config';

export default function EmployeeOtherDocsPage() {
  const perms = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadsList, setUploadsList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Read initial filter from URL params
  const initialFilter = useMemo(() => new URLSearchParams(location.search).get('filter') || 'all', [location.search]);
  const [filterType, setFilterType] = useState(initialFilter);

  useEffect(() => {
    setFilterType(initialFilter);
  }, [initialFilter]);
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const getDocImage = (emp, type) => {
    if (!emp) return null;
    
    // 1. Priority: Explicit documents from DB
    if (emp.documents && Array.isArray(emp.documents)) {
      const doc = emp.documents.find(d => d.type === type);
      if (doc && doc.fileUrl) return doc.fileUrl;
    }

    // 2. Fallback for 'សញ្ញាប័ត្រ' (Degree)
    if (type === 'សញ្ញាប័ត្រ' && emp.staffId) {
      const found = uploadsList.find(f => f.startsWith(`Degree_${emp.staffId}`));
      if (found) return `/Uploads/${found}`;
    }

    // 3. Fallback for 'តុងធនាគារ' (Bank)
    if (type === 'តុងធនាគារ' && emp.staffId) {
      const found = uploadsList.find(f => f.startsWith(`Bank_${emp.staffId}`));
      if (found) return `/Uploads/${found}`;
    }

    // 4. Fallback for 'បសស' (NSSF)
    if (type === 'បសស' && emp.staffId) {
      const found = uploadsList.find(f => f.startsWith(`NSSF_${emp.staffId}`));
      if (found) return `/Uploads/${found}`;
    }

    // 5. Fallback for 'គណៈវិជ្ជាជីវៈ' (Professional)
    if (type === 'គណៈវិជ្ជាជីវៈ' && emp.staffId) {
      const found = uploadsList.find(f => f.startsWith(`Professional_${emp.staffId}`));
      if (found) return `/Uploads/${found}`;
    }

    return null;
  };

  const getImageUrl = (image) => {
    if (!image) return null;
    if (image.startsWith('data:')) return image;
    if (image.startsWith('/')) return image;
    return `/${image}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [hrRes, uploadsRes] = await Promise.all([
          api.get('/hr'),
          api.get('/uploads-list')
        ]);
        setEmployees(hrRes.data || []);
        if (Array.isArray(uploadsRes.data)) {
          setUploadsList(uploadsRes.data);
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.Department_Kh).filter(Boolean));
    return Array.from(depts).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const nameMatch = (emp.khmerName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const latinMatch = (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const idMatch = (emp.staffId || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSearch = nameMatch || latinMatch || idMatch;
      const matchesDept = selectedDept === '' || emp.Department_Kh === selectedDept;

      let matchesType = true;
      if (filterType === 'missing_bank') matchesType = !getDocImage(emp, 'តុងធនាគារ');
      if (filterType === 'missing_nssf') matchesType = !getDocImage(emp, 'បសស');
      if (filterType === 'missing_degree') matchesType = !getDocImage(emp, 'សញ្ញាប័ត្រ');
      if (filterType === 'missing_council') matchesType = !getDocImage(emp, 'គណៈវិជ្ជាជីវៈ');
      if (filterType === 'has_bank') matchesType = !!getDocImage(emp, 'តុងធនាគារ');
      if (filterType === 'has_nssf') matchesType = !!getDocImage(emp, 'បសស');
      if (filterType === 'has_degree') matchesType = !!getDocImage(emp, 'សញ្ញាប័ត្រ');
      if (filterType === 'has_council') matchesType = !!getDocImage(emp, 'គណៈវិជ្ជាជីវៈ');

      return matchesSearch && matchesDept && matchesType;
    });
  }, [employees, searchTerm, selectedDept, filterType]);

  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDept, filterType]);

  const handleEdit = (emp) => {
    setEditingEmployee({ ...emp });
    setIsEditModalOpen(true);
  };

  const handleUpload = async (file, type) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const base = API_BASE || '';
      const endpoint = base ? `${base.replace(/\/+$/, '')}/api/upload` : '/api/upload';
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const result = await res.json();

      let finalUrl = result.url || '';
      if (finalUrl && !/^https?:\/\//i.test(finalUrl) && base) {
        finalUrl = `${base.replace(/\/+$/, '')}${finalUrl}`;
      }

      if (finalUrl) {
        const existingDocs = editingEmployee.documents || [];
        const docIndex = existingDocs.findIndex(d => d.type === type);

        let newDocs = [...existingDocs];
        if (docIndex >= 0) {
          newDocs[docIndex] = { ...newDocs[docIndex], fileUrl: finalUrl };
        } else {
          newDocs.push({ type, fileUrl: finalUrl });
        }

        setEditingEmployee({ ...editingEmployee, documents: newDocs });
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('បរាជ័យក្នុងការបញ្ចូលរូបភាព');
    }
  };

  const handleSave = async () => {
    if (!editingEmployee) return;
    setSaving(true);
    try {
      await api.put(`/hr/${editingEmployee._id}`, editingEmployee);
      setEmployees(prev => prev.map(e => e._id === editingEmployee._id ? editingEmployee : e));
      setIsEditModalOpen(false);
      setEditingEmployee(null);
    } catch (err) {
      console.error('Failed to save employee', err);
      alert('បរាជ័យក្នុងការរក្សាទុកទិន្នន័យ');
    } finally {
      setSaving(false);
    }
  };

  const toKhmerDigits = (n) => String(n).replace(/[0-9]/g, (w) => ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'][+w]);

  if (!perms.canViewEmployeeIDDocs) { // Reusing same permission for now
    return (
      <div className="p-8 flex justify-center items-center h-full min-h-screen bg-gray-50">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-red-100">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <X size={40} className="stroke-[3]" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Access Denied</h2>
          <p className="text-gray-500 font-medium">អ្នកមិនមានសិទ្ធិចូលមើលទំព័រនេះទេ។</p>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-purple-700 font-bold">កំពុងផ្ទុកទិន្នន័យ...</p>
      </div>
    </div>
  );

  const docTypes = [
    { key: 'តុងធនាគារ', label: 'តុងធនាគារ', icon: CreditCard },
    { key: 'បសស', label: 'បសស', icon: ShieldCheck },
    { key: 'សញ្ញាប័ត្រ', label: 'សញ្ញាប័ត្រ', icon: Award },
    { key: 'គណៈវិជ្ជាជីវៈ', label: 'គណៈវិជ្ជាជីវៈ', icon: Briefcase }
  ];

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen relative">
      <div className="sticky top-0 z-[40] -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-gray-50/95 backdrop-blur-md border-b border-gray-100 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">📁</span>
              ឯកសារបុគ្គលិក
            </h3>
            <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
              <span>គ្រប់គ្រង និងត្រួតពិនិត្យឯកសារធនាគារ បសស សញ្ញាប័ត្រ និងគណៈវិជ្ជាជីវៈ</span>
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
            {/* Row 1: All and Missing */}
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              ទាំងអស់ ({toKhmerDigits(employees.length)})
            </button>
            <button
              onClick={() => setFilterType('missing_bank')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'missing_bank' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              ខ្វះធនាគារ ({toKhmerDigits(employees.filter(e => !getDocImage(e, 'តុងធនាគារ')).length)})
            </button>
            <button
              onClick={() => setFilterType('missing_nssf')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'missing_nssf' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              ខ្វះបសស ({toKhmerDigits(employees.filter(e => !getDocImage(e, 'បសស')).length)})
            </button>
            <button
              onClick={() => setFilterType('missing_degree')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'missing_degree' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              ខ្វះសញ្ញាប័ត្រ ({toKhmerDigits(employees.filter(e => !getDocImage(e, 'សញ្ញាប័ត្រ')).length)})
            </button>
            <button
              onClick={() => setFilterType('missing_council')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'missing_council' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              ខ្វះគណៈវិជ្ជាជីវៈ ({toKhmerDigits(employees.filter(e => !getDocImage(e, 'គណៈវិជ្ជាជីវៈ')).length)})
            </button>

            {/* Row 2: Spacer and Have */}
            <div /> {/* Spacer for All button column */}
            <button
              onClick={() => setFilterType('has_bank')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'has_bank' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              មានធនាគារ ({toKhmerDigits(employees.filter(e => getDocImage(e, 'តុងធនាគារ')).length)})
            </button>
            <button
              onClick={() => setFilterType('has_nssf')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'has_nssf' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              មានបសស ({toKhmerDigits(employees.filter(e => getDocImage(e, 'បសស')).length)})
            </button>
            <button
              onClick={() => setFilterType('has_degree')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'has_degree' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              មានសញ្ញាប័ត្រ ({toKhmerDigits(employees.filter(e => getDocImage(e, 'សញ្ញាប័ត្រ')).length)})
            </button>
            <button
              onClick={() => setFilterType('has_council')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'has_council' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              មានគណៈវិជ្ជាជីវៈ ({toKhmerDigits(employees.filter(e => getDocImage(e, 'គណៈវិជ្ជាជីវៈ')).length)})
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-gray-400 hover:bg-gray-50'}`}
              title="Grid View"
            >
              <LayoutList className="w-5 h-5 rotate-90" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-gray-400 hover:bg-gray-50'}`}
              title="List View"
            >
              <LayoutList className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="ស្វែងរកតាម ឈ្មោះ ឬអត្តលេខ..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              className="w-full pl-12 pr-10 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium appearance-none"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="">គ្រប់ផ្នែកទាំងអស់</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Employees Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedEmployees.map(emp => (
            <div key={emp._id} className="group bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold overflow-hidden border-2 border-white shadow-md ring-1 ring-gray-100">
                        {emp.image ? (
                          <img
                            src={getImageUrl(emp.image)}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <User className="w-6 h-6 opacity-40" />
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors">{emp.khmerName}</h3>
                      <p className="text-xs text-gray-400 font-bold mt-0.5 uppercase tracking-wider">{emp.staffId}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {docTypes.map(doc => {
                    const hasDoc = !!getDocImage(emp, doc.key);
                    const Icon = doc.icon;
                    return (
                      <div key={doc.key} className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${hasDoc ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                        <Icon className={`w-4 h-4 mb-1 ${hasDoc ? 'text-green-500' : 'text-red-400'}`} />
                        <span className="text-[9px] font-bold text-gray-600">{doc.label}</span>
                        {hasDoc && (
                          <button
                            onClick={() => setPreviewImage(getDocImage(emp, doc.key))}
                            className="mt-1 p-0.5 bg-white text-green-600 rounded-md hover:bg-green-100 transition-all shadow-sm"
                            title="មើលរូបភាព"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(emp)}
                    className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> កែប្រែឯកសារ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-indigo-500 sticky top-0 z-20 shadow-md">
                <tr>
                  <th className="px-6 py-4 text-[15px] font-black text-white uppercase tracking-widest w-16">ល.រ</th>
                  <th className="px-6 py-4 text-[15px] font-black text-white uppercase tracking-widest">បុគ្គលិក</th>
                  <th className="px-6 py-4 text-[15px] font-black text-white uppercase tracking-widest">អត្តលេខ</th>
                  <th className="px-6 py-4 text-[15px] font-black text-white uppercase tracking-widest">តុងធនាគារ</th>
                  <th className="px-6 py-4 text-[15px] font-black text-white uppercase tracking-widest">បសស</th>
                  <th className="px-6 py-4 text-[15px] font-black text-white uppercase tracking-widest">សញ្ញាប័ត្រ</th>
                  <th className="px-6 py-4 text-[15px] font-black text-white uppercase tracking-widest">គណៈវិជ្ជាជីវៈ</th>
                  <th className="px-6 py-4 text-[15px] font-black text-white uppercase tracking-widest text-center">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedEmployees.map((emp, idx) => (
                  <tr key={emp._id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4 text-xs font-bold text-gray-400">{toKhmerDigits(idx + 1)}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{emp.khmerName}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{emp.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-gray-600">{emp.staffId}</td>
                    
                    {docTypes.map(doc => {
                      const img = getDocImage(emp, doc.key);
                      return (
                        <td key={doc.key} className="px-6 py-4">
                          {img ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">មាន</span>
                              <button
                                onClick={() => setPreviewImage(img)}
                                className="p-1 bg-white border border-gray-200 text-green-600 rounded hover:bg-green-50 transition-all shadow-sm"
                                title="មើលរូបភាព"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">ខ្វះ</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(emp)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95 text-[10px] font-bold"
                          title="កែសម្រួល"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>កែប្រែ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredEmployees.length > itemsPerPage && (
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-[24px] shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500">
            បង្ហាញ {toKhmerDigits((currentPage - 1) * itemsPerPage + 1)} ដល់ {toKhmerDigits(Math.min(currentPage * itemsPerPage, filteredEmployees.length))} ក្នុងចំណោម {toKhmerDigits(filteredEmployees.length)} នាក់
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${currentPage === 1 ? 'text-gray-300 bg-gray-50' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`}
            >
              ត្រឡប់ក្រោយ
            </button>
            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {toKhmerDigits(pageNum)}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${currentPage === totalPages ? 'text-gray-300 bg-gray-50' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`}
            >
              បន្ទាប់
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredEmployees.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border border-dashed border-gray-200 shadow-sm mt-12">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Search className="w-10 h-10 text-gray-200" />
          </div>
          <h3 className="text-xl font-bold text-gray-400">មិនមានបុគ្គលិកត្រូវតាមការស្វែងរកទេ</h3>
          <p className="text-gray-300 text-sm mt-1">សូមព្យាយាមផ្លាស់ប្ដូរពាក្យគន្លឹះ ឬតម្រងរបស់អ្នក</p>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="bg-indigo-600 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black">កែប្រែឯកសារបុគ្គលិក</h2>
                <p className="text-indigo-100 text-[10px] mt-0.5">អត្តលេខ៖ {editingEmployee.staffId}</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <p className="font-bold text-gray-900">{editingEmployee.khmerName}</p>
                  <p className="text-xs text-gray-500">{editingEmployee.Department_Kh}</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {docTypes.map(doc => {
                    const img = getDocImage(editingEmployee, doc.key);
                    const Icon = doc.icon;
                    return (
                      <div key={doc.key} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className="w-5 h-5 text-indigo-500" />
                            <span className="text-xs font-black text-gray-700">{doc.label}</span>
                          </div>
                          {img && (
                            <button
                              onClick={() => setPreviewImage(img)}
                              className="text-indigo-600 text-xs font-bold hover:underline"
                            >
                              មើលរូបភាព
                            </button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="relative group flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id={`upload-${doc.key}`}
                              onChange={(e) => handleUpload(e.target.files[0], doc.key)}
                            />
                            <label
                              htmlFor={`upload-${doc.key}`}
                              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                            >
                              <Upload className="w-4 h-4 text-gray-400" />
                              <span className="text-xs font-bold text-gray-500">ចុចទីនេះដើម្បីបញ្ចូលឯកសារ</span>
                            </label>
                          </div>
                          {img && (
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                              <img
                                src={img}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 flex gap-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all active:scale-95 text-xs"
              >
                បោះបង់
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>រក្សាទុក</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative max-w-4xl w-full flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="bg-white p-2 rounded-[32px] shadow-2xl overflow-hidden">
              <img
                src={previewImage}
                alt="Document"
                className="max-h-[80vh] w-auto object-contain rounded-[24px]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
