import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SignSchemasPage() {
  const { user } = useAuth();
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    fullNameKh: '',
    type: 'employee',
    description: '',
    position: '',
    department: '',
    notes: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

  // Check if user has permissions
  const canView = (user?.permissions || []).includes('view:signSchemas');
  const canCreate = (user?.permissions || []).includes('create:signSchemas');
  const canEdit = (user?.permissions || []).includes('edit:signSchemas');
  const canDelete = (user?.permissions || []).includes('delete:signSchemas');

  const loadSchemas = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/signatures?limit=200');
      setSchemas(res?.data?.signatures || res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load signatures');
      setSchemas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) loadSchemas();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate) {
      setError('You do not have permission to create signatures');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const form = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key]) form.append(key, formData[key]);
      });
      if (selectedFile) form.append('signatureFile', selectedFile);

      await api.post('/signatures', form);
      setSuccess('Signature created successfully!');
      setFormData({
        name: '',
        fullNameKh: '',
        type: 'employee',
        description: '',
        position: '',
        department: '',
        notes: ''
      });
      setSelectedFile(null);
      await loadSchemas();
    } catch (err) {
      setError(err.message || 'Failed to create signature');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this signature?')) return;
    if (!canDelete) {
      setError('You do not have permission to delete signatures');
      return;
    }

    setError('');
    setSuccess('');
    try {
      await api.delete(`/signatures/${id}`);
      setSuccess('Signature deleted successfully!');
      await loadSchemas();
    } catch (err) {
      setError(err.message || 'Failed to delete signature');
    }
  };

  if (!canView) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-300 rounded text-red-700">
          You do not have permission to view SignSchemas. Contact your administrator.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📝 SignSchemas Management</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded text-green-700">
          {success}
        </div>
      )}

      {/* Create Form */}
      {canCreate && (
        <div className="mb-6 p-4 border rounded bg-blue-50">
          <h2 className="text-lg font-semibold mb-4">Create New Signature</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name (Code) *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., sig001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Full Name (Khmer)</label>
              <input
                type="text"
                name="fullNameKh"
                value={formData.fullNameKh}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
                placeholder="ឈ្មោះពេញលេញ"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
              >
                <option value="employee">Employee</option>
                <option value="director">Director</option>
                <option value="deputy">Deputy</option>
                <option value="office">Office</option>
                <option value="admin">Admin</option>
                <option value="khmer">Khmer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
                placeholder="Job title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
                placeholder="Department"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description/Role</label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
                placeholder="Role or title for feedback"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
                rows="3"
                placeholder="Additional notes"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Signature Image File *</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {uploading ? 'Creating...' : 'Create Signature'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="border rounded overflow-hidden">
        <div className="bg-gray-50 p-4 border-b">
          <h2 className="text-lg font-semibold">Existing Signatures</h2>
        </div>

        {loading ? (
          <div className="p-4 text-center text-gray-600">Loading...</div>
        ) : schemas.length === 0 ? (
          <div className="p-4 text-center text-gray-600">No signatures found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Full Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Position</th>
                  <th className="text-left p-3">Department</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-left p-3">Status</th>
                  {(canEdit || canDelete) && <th className="text-center p-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {schemas.map(schema => (
                  <tr key={schema._id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{schema.name}</td>
                    <td className="p-3">{schema.fullNameKh || '-'}</td>
                    <td className="p-3">
                      <span className="inline-block px-2 py-1 bg-gray-200 rounded text-xs">
                        {schema.type}
                      </span>
                    </td>
                    <td className="p-3">{schema.position || '-'}</td>
                    <td className="p-3">{schema.department || '-'}</td>
                    <td className="p-3 max-w-xs truncate">{schema.description || '-'}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs ${
                        schema.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {schema.status}
                      </span>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="p-3 text-center">
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(schema._id)}
                            className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-xs"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permission Info */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700">
        <h3 className="font-semibold mb-2">Your Permissions:</h3>
        <ul className="list-disc ml-5">
          <li>{canView ? '✓' : '✗'} View SignSchemas</li>
          <li>{canCreate ? '✓' : '✗'} Create SignSchemas</li>
          <li>{canEdit ? '✓' : '✗'} Edit SignSchemas</li>
          <li>{canDelete ? '✓' : '✗'} Delete SignSchemas</li>
        </ul>
      </div>
    </div>
  );
}
