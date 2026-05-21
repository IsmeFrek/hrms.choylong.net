import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Printer, FileText, User, Filter, Download, CreditCard, ShieldCheck, LayoutList, Eye, X, Upload, ImageIcon } from 'lucide-react';
import { API_BASE } from '../config';

export default function EmployeeIDDocsPage() {
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

  const getNidImage = (emp) => {
    if (!emp) return null;
    // 1. Priority: Explicit documents from DB
    if (emp.documents && Array.isArray(emp.documents)) {
      const doc = emp.documents.find(d => d.type === 'អត្តសញ្ញាណប័ណ្ណ' || d.type === 'NID');
      if (doc && doc.fileUrl) return doc.fileUrl;
    }

    // 2. Fallback: Try predicted filename in public/Uploads based on user pattern
    // Pattern: {StaffID}_{KhmerName}_{NID}_{LatinName}.jpg
    if (emp.staffId && emp.khmerName && emp.nid && emp.name) {
      const predictedFilename = `${emp.staffId}_${emp.khmerName}_${emp.nid}_${emp.name.toUpperCase()}.jpg`;
      // Check if this file actually exists in the uploadsList
      if (uploadsList.includes(predictedFilename)) {
        return `/Uploads/${predictedFilename}`;
      }
    }

    return null;
  };

  const getImageUrl = (image) => {
    if (!image) return null;
    if (image.startsWith('data:')) return image;
    // If it's a path like "Uploads/..." ensure it has a leading slash
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
      const nidMatch = String(emp.nid || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSearch = nameMatch || latinMatch || idMatch || nidMatch;
      const matchesDept = selectedDept === '' || emp.Department_Kh === selectedDept;

      let matchesType = true;
      if (filterType === 'has_nid') matchesType = !!emp.nid;
      if (filterType === 'missing_nid') matchesType = !emp.nid;
      if (filterType === 'has_photo') matchesType = !!getNidImage(emp);
      if (filterType === 'missing_photo') matchesType = !getNidImage(emp);

      return matchesSearch && matchesDept && matchesType;
    });
  }, [employees, searchTerm, selectedDept, filterType]);

  // Pagination logic
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDept, filterType]);

  const handleEdit = (emp) => {
    const normalizeDate = (val) => {
      if (!val) return '';
      if (val.includes('-')) return val.split('T')[0]; // yyyy-mm-dd
      if (val.includes('/')) {
        const parts = val.split('/');
        if (parts.length === 3) {
          // dd/mm/yyyy -> yyyy-mm-dd
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return val;
    };

    setEditingEmployee({
      ...emp,
      dob: emp.dob ? new Date(emp.dob).toISOString().split('T')[0] : '',
      reason1: normalizeDate(emp.reason1),
      reason2: normalizeDate(emp.reason2)
    });
    setIsEditModalOpen(true);
  };

  const handleUpload = async (file) => {
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
        const nidDocIndex = existingDocs.findIndex(d => d.type === 'អត្តសញ្ញាណប័ណ្ណ' || d.type === 'NID');

        let newDocs = [...existingDocs];
        if (nidDocIndex >= 0) {
          newDocs[nidDocIndex] = { ...newDocs[nidDocIndex], fileUrl: finalUrl };
        } else {
          newDocs.push({ type: 'អត្តសញ្ញាណប័ណ្ណ', fileUrl: finalUrl });
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
      // Update local state
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

  if (!perms.canViewEmployeeIDDocs) {
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

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen relative">
      <div className="sticky top-0 z-[40] -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-gray-50/95 backdrop-blur-md border-b border-gray-100 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">🪪</span>
              អត្តសញ្ញាប័ណ្ណ
            </h3>
            <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
              <span>គ្រប់គ្រង និងត្រួតពិនិត្យលេខអត្តសញ្ញាណប័ណ្ណ និងកាតបុគ្គលិក</span>
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              ទាំងអស់ ({toKhmerDigits(employees.length)})
            </button>
            <button
              onClick={() => setFilterType('has_nid')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'has_nid' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              មាន NID ({toKhmerDigits(employees.filter(e => e.nid).length)})
            </button>
            <button
              onClick={() => setFilterType('missing_nid')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'missing_nid' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              ខ្វះ NID ({toKhmerDigits(employees.filter(e => !e.nid).length)})
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button
              onClick={() => setFilterType('has_photo')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'has_photo' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              មានរូប ({toKhmerDigits(employees.filter(e => getNidImage(e)).length)})
            </button>
            <button
              onClick={() => setFilterType('missing_photo')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === 'missing_photo' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              អត់រូប ({toKhmerDigits(employees.filter(e => !getNidImage(e)).length)})
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
              placeholder="ស្វែងរកតាម ឈ្មោះ, អត្តលេខ, ឬលេខអត្តសញ្ញាណប័ណ្ណ..."
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
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold overflow-hidden border-2 border-white shadow-md ring-1 ring-gray-100">
                        {emp.image ? (
                          <img
                            src={getImageUrl(emp.image)}
                            className="w-full h-full object-cover"
                            alt=""
                            onError={(e) => {
                              if (emp.image && !emp.image.startsWith('data:') && !e.target.src.includes('/Uploads/')) {
                                e.target.src = `/Uploads/${emp.image.split('/').pop()}`;
                              }
                            }}
                          />
                        ) : (
                          <User className="w-8 h-8 opacity-40" />
                        )}
                      </div>
                      {emp.status === 'Active' && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-base leading-tight group-hover:text-indigo-600 transition-colors">{emp.khmerName}</h3>
                      <p className="text-xs text-gray-400 font-bold mt-0.5 uppercase tracking-wider">{emp.staffId}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{emp.Department_Kh || 'មិនមានផ្នែក'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border transition-all ${emp.nid ? 'bg-green-50/30 border-green-100/50' : 'bg-red-50/30 border-red-100/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">អត្តសញ្ញាណប័ណ្ណ (NID)</div>
                      {emp.nid ? (
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                      ) : (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold italic">ខ្វះទិន្នន័យ</span>
                      )}
                    </div>
                    <div className={`font-mono text-lg font-black tracking-widest ${emp.nid ? 'text-gray-900' : 'text-gray-300'} flex items-center justify-between`}>
                      <span>{emp.nid || '០០០ ០០០ ០០០'}</span>
                      {getNidImage(emp) && (
                        <button
                          onClick={() => setPreviewImage(getNidImage(emp))}
                          className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"
                          title="មើលរូបភាព"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Additional Info Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="text-[9px] font-black uppercase text-gray-400 mb-1">ថ្ងៃកំណើត</div>
                      <div className="text-xs font-bold text-gray-700">
                        {emp.dob ? new Date(emp.dob).toLocaleDateString('km-KH') : '---'}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="text-[9px] font-black uppercase text-gray-400 mb-1">ផុតកំណត់</div>
                      <div className="text-xs font-bold text-red-600">
                        {emp.reason2 || '---'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 mt-0.5 text-gray-300 shrink-0">📍</div>
                      <div className="text-[10px] text-gray-500 line-clamp-1" title={emp.birthPlace}>
                        <span className="font-bold text-gray-700">ទីកន្លែងកំណើត:</span> {emp.birthPlace || '---'}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 mt-0.5 text-gray-300 shrink-0">🏠</div>
                      <div className="text-[10px] text-gray-500 line-clamp-1" title={emp.currentPlace}>
                        <span className="font-bold text-gray-700">បច្ចុប្បន្ន:</span> {emp.currentPlace || '---'}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => navigate(`/hr?search=${emp.staffId}&showIdCard=true`)}
                      className="flex-1 bg-gray-900 text-white py-3 rounded-2xl text-xs font-bold hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" /> បោះពុម្ពកាត
                    </button>
                    <button
                      onClick={() => handleEdit(emp)}
                      className="p-3 bg-white border border-gray-100 text-gray-400 rounded-2xl hover:bg-gray-50 hover:text-indigo-600 transition-all active:scale-95 shadow-sm"
                      title="កែសម្រួលព័ត៌មាន"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  </div>
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
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest w-16">ល.រ</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">បុគ្គលិក</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">អត្តលេខ</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">ផ្នែកការងារ</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">អត្តសញ្ញាណប័ណ្ណ (NID)</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">ថ្ងៃកំណើត</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">ចេញ / ផុតកំណត់</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">ទីកន្លែងកំណើត</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">បច្ចុប្បន្ន</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest text-center">សកម្មភាព</th>
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
                    <td className="px-6 py-4">
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                        {emp.Department_Kh || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-sm font-bold ${emp.nid ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100 italic'}`}>
                        {emp.nid ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {emp.nid}
                            {getNidImage(emp) && (
                              <button
                                onClick={() => setPreviewImage(getNidImage(emp))}
                                className="ml-1 p-1 bg-white/50 text-green-600 rounded hover:bg-white transition-all shadow-sm"
                                title="មើលរូបភាព"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        ) : 'ខ្វះទិន្នន័យ'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-gray-600">
                        {emp.dob ? new Date(emp.dob).toLocaleDateString('km-KH') : '---'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                          {emp.reason1 || '---'}
                        </div>
                        <div className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full block">
                          {emp.reason2 || '---'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] text-gray-500 max-w-[150px] truncate" title={emp.birthPlace}>
                        {emp.birthPlace || '---'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] text-gray-500 max-w-[150px] truncate" title={emp.currentPlace}>
                        {emp.currentPlace || '---'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/hr?search=${emp.staffId}&showIdCard=true`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-xl hover:bg-indigo-600 transition-all shadow-sm active:scale-95 text-[10px] font-bold"
                          title="បោះពុម្ពកាត"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>បោះពុម្ព</span>
                        </button>
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
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
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

      {filteredEmployees.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border border-dashed border-gray-200 shadow-sm mt-12">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Search className="w-10 h-10 text-gray-200" />
          </div>
          <h3 className="text-xl font-bold text-gray-400">មិនមានបុគ្គលិកត្រូវតាមការស្វែងរកទេ</h3>
          <p className="text-gray-300 text-sm mt-1">សូមព្យាយាមផ្លាស់ប្ដូរពាក្យគន្លឹះ ឬតម្រងរបស់អ្នក</p>
          <button
            onClick={() => { setSearchTerm(''); setSelectedDept(''); setFilterType('all'); }}
            className="mt-6 text-indigo-600 font-bold hover:underline underline-offset-4"
          >
            សម្អាតការស្វែងរក
          </button>
        </div>
      )}
      {/* Edit Modal */}
      {isEditModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="bg-indigo-600 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black">កែប្រែព័ត៌មានឯកសារ</h2>
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
              <div className="grid grid-cols-2 gap-4">
                {/* Khmer Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ឈ្មោះខ្មែរ</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                    value={editingEmployee.khmerName || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, khmerName: e.target.value })}
                  />
                </div>
                {/* Latin Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ឈ្មោះឡាតាំង</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase text-sm"
                    value={editingEmployee.name || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  />
                </div>
                {/* Staff ID */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">អត្តលេខ</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                    value={editingEmployee.staffId || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, staffId: e.target.value })}
                  />
                </div>
                {/* Department */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ផ្នែកការងារ</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                    value={editingEmployee.Department_Kh || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, Department_Kh: e.target.value })}
                  />
                </div>
                {/* NID */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">NID</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold tracking-widest text-sm"
                    value={editingEmployee.nid || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, nid: e.target.value })}
                  />
                </div>
                {/* DOB */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ថ្ងៃខែឆ្នាំកំណើត</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                    value={editingEmployee.dob || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, dob: e.target.value })}
                  />
                </div>
                {/* Issue Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ថ្ងៃចេញកាត (Issue)</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                    value={editingEmployee.reason1 || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, reason1: e.target.value })}
                  />
                </div>
                {/* Expiry Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ថ្ងៃផុតកំណត់ (Expiry)</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                    value={editingEmployee.reason2 || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, reason2: e.target.value })}
                  />
                </div>
                {/* NID Image Upload */}
                <div className="col-span-full space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">រូបភាពអត្តសញ្ញាណប័ណ្ណ</label>
                  <div className="flex items-center gap-4">
                    <div className="relative group flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="nid-upload"
                        onChange={(e) => handleUpload(e.target.files[0])}
                      />
                      <label
                        htmlFor="nid-upload"
                        className="flex items-center justify-center gap-2 w-full px-4 py-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all group-hover:scale-[1.01]"
                      >
                        <Upload className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
                        <span className="text-xs font-bold text-gray-500 group-hover:text-indigo-600">ចុចទីនេះដើម្បីប្ដូររូបភាព</span>
                      </label>
                    </div>
                    {getNidImage(editingEmployee) && (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                        <img
                          src={getNidImage(editingEmployee)}
                          alt="NID Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => setPreviewImage(getNidImage(editingEmployee))}
                          className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* POB */}
                <div className="col-span-full space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ទីកន្លែងកំណើត</label>
                  <textarea
                    rows="2"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs"
                    value={editingEmployee.birthPlace || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, birthPlace: e.target.value })}
                  />
                </div>
                {/* Current Address */}
                <div className="col-span-full space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">អាសយដ្ឋានបច្ចុប្បន្ន</label>
                  <textarea
                    rows="2"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs"
                    value={editingEmployee.currentPlace || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, currentPlace: e.target.value })}
                  />
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
                alt="NID Document"
                className="max-h-[80vh] w-auto object-contain rounded-[24px]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
