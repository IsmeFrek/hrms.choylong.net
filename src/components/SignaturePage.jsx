import React, { useState, useEffect, useRef } from 'react';
import { Upload, Edit, Search, Plus, Eye, FileImage, Trash2 } from 'lucide-react';
import api from '../services/api';
import { API_BASE } from '../config';

const SignaturePage = () => {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [stats, setStats] = useState({ overview: {}, byType: [] });
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    fullNameKh: '',
    type: 'employee',
    description: '',
    position: '',
    department: '',
    notes: '',
    expiryDate: '',
    filePath: '',
    signatureFile: null
  });

  // Load signatures
  const loadSignatures = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        ...(searchTerm && { search: searchTerm }),
        ...(filterStatus && { status: filterStatus })
      };

      const response = await api.get('/signatures', { params });
      console.log('Signatures response:', response.data);
      setSignatures(response.data.signatures || []);
      setPagination(response.data.pagination || {});
    } catch (error) {
      console.error('Error loading signatures:', error);
      alert('មានបញ្ហាក្នុងការទាញយកបញ្ជីហត្ថលេខា');
    } finally {
      setLoading(false);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const response = await api.get('/signatures/stats/overview');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    loadSignatures();
    loadStats();
  }, [searchTerm, filterStatus]);

  // Reset form
  const resetForm = () => {
    setForm({
      name: '',
      fullNameKh: '',
      type: 'employee',
      description: '',
      position: '',
      department: '',
      notes: '',
      expiryDate: '',
      filePath: '',
      signatureFile: null
    });
    setEditing(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open form for new signature
  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  // Open form for editing
  const openEdit = (signature) => {
    setEditing(signature);
    setForm({
      name: signature.name || '',
      fullNameKh: signature.fullNameKh || '',
      type: signature.type || 'employee',
      description: signature.description || '',
      position: signature.position || '',
      department: signature.department || '',
      notes: signature.notes || '',
      expiryDate: signature.expiryDate ? new Date(signature.expiryDate).toISOString().slice(0, 10) : '',
      filePath: signature.filePath || '',
      signatureFile: null
    });
    setShowForm(true);
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('ត្រឹមតែឯកសាររូបភាពប៉ុណ្ណោះ');
        return;
      }
      
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('ទំហំឯកសារធំពេក (អតិបរមា 10MB)');
        return;
      }

      setForm(prev => ({ ...prev, signatureFile: file }));
    }
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('ត្រូវតែបញ្ចូលឈ្មោះ ឬ លេខកូដ');
      return;
    }

    if (!editing && !form.signatureFile && !form.filePath) {
      alert('ត្រូវតែជ្រើសរើសឯកសារហត្ថលេខា ឬ បញ្ចូលផ្លូវឯកសារ');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      
      // Add form fields
      Object.keys(form).forEach(key => {
        if (key !== 'signatureFile' && form[key]) {
          formData.append(key, form[key]);
        }
      });

      // Add file if selected
      if (form.signatureFile) {
        formData.append('signatureFile', form.signatureFile);
      }

      if (editing) {
        await api.put(`/signatures/${editing._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('កែប្រែហត្ថលេខាបានជោគជ័យ');
      } else {
        await api.post('/signatures', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('បង្កើតហត្ថលេខាបានជោគជ័យ');
      }

      setShowForm(false);
      resetForm();
      loadSignatures();
      loadStats();
    } catch (error) {
      console.error('Error saving signature:', error);
      alert(error.response?.data?.message || 'មានបញ្ហាក្នុងការរក្សាទុកហត្ថលេខា');
    } finally {
      setLoading(false);
    }
  };

  // Delete signature
  const deleteSignature = async (id) => {
    if (!window.confirm('តើអ្នកប្រាកដថាចង់លុបហត្ថលេខានេះមែនទេ?')) {
      return;
    }

    try {
      await api.delete(`/signatures/${id}`);
      alert('លុបហត្ថលេខាបានជោគជ័យ');
      loadSignatures(pagination.page);
    } catch (error) {
      console.error('Error deleting signature:', error);
      alert('មានបញ្ហាក្នុងការលុបហត្ថលេខា');
    }
  };

  // Test signature
  const testSignature = async (name) => {
    try {
      const response = await api.get(`/signatures/search/${encodeURIComponent(name)}`);
      if (response.data) {
        alert(`រកឃើញហត្ថលេខាសម្រាប់ "${name}" ហើយ!\nផ្លូវឯកសារ: ${response.data.filePath}`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        alert(`រកមិនឃើញហត្ថលេខាសម្រាប់ "${name}"`);
      } else {
        alert('មានបញ្ហាក្នុងការស្វែងរក');
      }
    }
  };

  

  const statusOptions = [
    { value: '', label: 'ស្ថានភាពទាំងអស់' },
    { value: 'active', label: 'សកម្ម' },
    { value: 'inactive', label: 'អសកម្ម' },
    { value: 'archived', label: 'បណ្ណសារ' }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">គ្រប់គ្រងហត្ថលេខា</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          បន្ថែមហត្ថលេខាថ្មី
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-blue-600">{stats.overview?.total || 0}</div>
          <div className="text-gray-600">សរុបទាំងអស់</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-green-600">{stats.overview?.active || 0}</div>
          <div className="text-gray-600">សកម្ម</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-yellow-600">{stats.overview?.inactive || 0}</div>
          <div className="text-gray-600">អសកម្ម</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-gray-600">{stats.overview?.archived || 0}</div>
          <div className="text-gray-600">បណ្ណសារ</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ស្វែងរកឈ្មោះ, តួនាទី, ផ្នែក..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <div className="text-sm text-gray-600 flex items-center">
            បង្ហាញ {signatures.length} នៃ {pagination.total}
          </div>
        </div>
      </div>

      {/* Signatures Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ហត្ថលេខា
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ឈ្មោះ/កូដ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ការពិពណ៌នា
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ផ្នែក
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ស្ថានភាព
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  សកម្មភាព
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2">កំពុងទាញយក...</span>
                    </div>
                  </td>
                </tr>
              ) : signatures.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    មិនមានហត្ថលេខាទេ
                  </td>
                </tr>
              ) : (
                signatures.map((signature) => (
                  <tr key={signature._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {signature.filePath ? (
                          <div className="relative">
                            <img
                              src={`${API_BASE}${signature.signatureUrl || signature.filePath}`}
                              alt={signature.name}
                              className="h-12 w-20 object-contain border border-gray-200 rounded cursor-pointer hover:border-blue-400 transition-colors"
                              onClick={() => {
                                // Open image in new tab for larger view
                                window.open(`${API_BASE}${signature.signatureUrl || signature.filePath}`, '_blank');
                              }}
                              onLoad={(e) => {
                                console.log('Image loaded successfully:', e.target.src);
                              }}
                              onError={(e) => {
                                console.log('Image load error:', e.target.src);
                                console.log('Signature data:', signature);
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div className="hidden items-center justify-center h-12 w-20 bg-gray-100 border border-gray-200 rounded">
                              <FileImage className="w-6 h-6 text-gray-400" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-12 w-20 bg-gray-100 border border-gray-200 rounded">
                            <FileImage className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{signature.name}</div>
                      {signature.fullNameKh && (
                        <div className="text-sm text-gray-500">{signature.fullNameKh}</div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap max-w-xs">
                      {signature.description ? (
                        <div
                          className="text-sm text-gray-700 truncate"
                          title={signature.description}
                        >
                          {signature.description.length > 80 ? `${signature.description.slice(0, 80)}...` : signature.description}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {signature.department || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        signature.status === 'active' ? 'bg-green-100 text-green-800' :
                        signature.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {statusOptions.find(s => s.value === signature.status)?.label || signature.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => testSignature(signature.name)}
                        className="text-green-600 hover:text-green-900"
                        title="ទេស្ត"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(signature)}
                        className="text-blue-600 hover:text-blue-900"
                        title="កែប្រែ"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteSignature(signature._id)}
                        className="text-red-600 hover:text-red-900"
                        title="លុប"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => loadSignatures(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                មុន
              </button>
              <button
                onClick={() => loadSignatures(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                បន្ទាប់
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  បង្ហាញ <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> ដល់{' '}
                  <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> នៃ{' '}
                  <span className="font-medium">{pagination.total}</span> លទ្ធផល
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => loadSignatures(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === pagination.page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editing ? 'កែប្រែហត្ថលេខា' : 'បន្ថែមហត្ថលេខាថ្មី'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ឈ្មោះ/លេខកូដ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="D001, នាយកការិយាល័យ, ជាដើម"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ឈ្មោះពេញជាខ្មែរ
                  </label>
                  <input
                    type="text"
                    value={form.fullNameKh}
                    onChange={(e) => setForm(prev => ({ ...prev, fullNameKh: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="លោក សុខ មករា"
                  />
                </div>

                

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ផ្នែក/នាយកដ្ឋាន
                  </label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ផ្នែករដ្ឋបាល, ផ្នែកហិរញ្ញវត្ថុ, ជាដើម"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    កាលបរិច្ឆេទផុតកំណត់
                  </label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ការពិពណ៌នា
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ការពិពណ៌នាខ្លី"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ឯកសារហត្ថលេខា {!editing && <span className="text-red-500">*</span>}
                </label>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-xs text-gray-500">
                    ឬ បញ្ចូលផ្លូវឯកសារដោយដៃ:
                  </div>
                  <input
                    type="text"
                    value={form.filePath}
                    onChange={(e) => setForm(prev => ({ ...prev, filePath: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="/Uploads/signature.jpg"
                  />
                </div>
                {(form.signatureFile || (editing && form.filePath)) && (
                  <div className="mt-2">
                    <div className="text-sm text-gray-600 mb-1">មើលមុន:</div>
                    <img
                      src={form.signatureFile ? URL.createObjectURL(form.signatureFile) : `${API_BASE}${form.filePath}`}
                      alt="Preview"
                      className="h-16 max-w-32 object-contain border border-gray-200 rounded"
                      onError={(e) => {
                        console.log('Preview image error:', e.target.src);
                        console.log('Form filePath:', form.filePath);
                        console.log('API_BASE:', API_BASE);
                      }}
                      onLoad={(e) => {
                        console.log('Preview image loaded successfully:', e.target.src);
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  កំណត់សម្គាល់
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="កំណត់សម្គាល់បន្ថែម..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'កំពុងរក្សាទុក...' : (editing ? 'រក្សាទុក' : 'បង្កើត')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignaturePage;