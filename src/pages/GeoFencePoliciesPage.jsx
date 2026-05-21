import React, { useEffect, useMemo, useState } from 'react';
import {
  createGeoFencePolicy,
  deleteGeoFencePolicy,
  listGeoFencePolicies,
  updateGeoFencePolicy,
  fetchActiveDepartments,
  resolveMapLink,
} from '../api/geoFence';
import usePermission from '../hooks/usePermission';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  ChevronRight,
  RefreshCw,
  Search,
  Shield, 
  Navigation, 
  Target, 
  Layers,
  Info,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Settings2,
  Globe,
  Map as MapIcon,
  Filter,
  RotateCcw,
  Eye,
  Printer
} from 'lucide-react';

const emptyForm = () => ({
  id: null,
  name: '',
  enabled: true,
  priority: 0,
  match: {
    staffId: '',
    department: '',
    skill: '',
    position: '',
    officerType: '',
    role: '',
  },
  fence: {
    centerLat: 11.5369,
    centerLng: 104.9126,
    radiusM: 200,
    maxAccuracyM: 250,
  },
  note: '',
});

const GeoFencePoliciesPage = () => {
  const { has, isAdmin: isSystemAdmin } = usePermission();
  const isAdmin = isSystemAdmin || has('admin:all') || has('manage:geoFence');

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMap, setShowMap] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listGeoFencePolicies();
      // The backend returns { ok: true, items: [...] }
      if (data && Array.isArray(data.items)) {
        setPolicies(data.items);
      } else if (Array.isArray(data)) {
        setPolicies(data);
      } else {
        setPolicies([]);
      }
    } catch (e) {
      console.error('Failed to load policies', e);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetchDepartments();
  }, []);

  const [departments, setDepartments] = useState([]);
  const [manualDept, setManualDept] = useState(false);

  const fetchDepartments = async () => {
    try {
      const data = await fetchActiveDepartments();
      if (Array.isArray(data)) setDepartments(data);
    } catch (e) {
      console.error('Geo-fence Page: Failed to fetch departments', e);
    }
  };

  const filteredPolicies = useMemo(() => {
    if (!searchTerm) return policies;
    const s = searchTerm.toLowerCase();
    return policies.filter(p => 
      p.name?.toLowerCase().includes(s) || 
      p.match?.department?.toLowerCase().includes(s) ||
      p.match?.staffId?.toLowerCase().includes(s)
    );
  }, [policies, searchTerm]);

  const onEdit = (p) => {
    setForm({
      id: p._id,
      name: p.name || '',
      enabled: p.enabled ?? true,
      priority: p.priority || 0,
      match: {
        staffId: p.match?.staffId || '',
        department: p.match?.department || '',
        skill: p.match?.skill || '',
        position: p.match?.position || '',
        officerType: p.match?.officerType || '',
        role: p.match?.role || '',
      },
      fence: {
        centerLat: p.fence?.centerLat || 11.5369,
        centerLng: p.fence?.centerLng || 104.9126,
        radiusM: p.fence?.radiusM || 200,
        maxAccuracyM: p.fence?.maxAccuracyM || 250,
      },
      note: p.note || '',
    });
    setIsModalOpen(true);
    setShowMap(false);
  };

  const onNew = () => {
    setForm(emptyForm());
    setIsModalOpen(true);
    setShowMap(false);
  };

  const onDelete = async (id) => {
    if (!window.confirm('តើអ្នកប្រាកដថាចង់លុបច្បាប់នេះមែនទេ?')) return;
    try {
      await deleteGeoFencePolicy(id);
      load();
    } catch (e) {
      alert('លុបមិនបានសម្រេច៖ ' + e.message);
    }
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: String(form.name || '').trim(),
        enabled: !!form.enabled,
        priority: Number(form.priority || 0),
        match: {
          staffId: String(form.match.staffId || '').trim(),
          department: String(form.match.department || '').trim(),
          skill: String(form.match.skill || '').trim(),
          position: String(form.match.position || '').trim(),
          officerType: String(form.match.officerType || '').trim(),
          role: String(form.match.role || '').trim(),
        },
        fence: {
          centerLat: parseFloat(form.fence.centerLat),
          centerLng: parseFloat(form.fence.centerLng),
          radiusM: parseFloat(form.fence.radiusM),
          maxAccuracyM: parseFloat(form.fence.maxAccuracyM),
        },
        note: String(form.note || '').trim(),
      };

      if (form.id) {
        await updateGeoFencePolicy(form.id, payload);
      } else {
        await createGeoFencePolicy(payload);
      }
      setIsModalOpen(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Map Picker Component
  const LocationPicker = ({ lat, lng, onChange }) => {
    const mapRef = React.useRef(null);
    const markerRef = React.useRef(null);
    const containerRef = React.useRef(null);

    useEffect(() => {
      if (!containerRef.current || !window.L) return;
      const initialLat = parseFloat(lat) || 11.5369;
      const initialLng = parseFloat(lng) || 104.9126;

      if (!mapRef.current) {
        const map = window.L.map(containerRef.current).setView([initialLat, initialLng], 16);
        mapRef.current = map;
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        const marker = window.L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
        markerRef.current = marker;
        marker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          onChange(pos.lat.toFixed(8), pos.lng.toFixed(8));
        });
        map.on('click', (e) => {
          const pos = e.latlng;
          marker.setLatLng(pos);
          onChange(pos.lat.toFixed(8), pos.lng.toFixed(8));
        });
      } else {
        markerRef.current.setLatLng([initialLat, initialLng]);
        mapRef.current.setView([initialLat, initialLng]);
      }
    }, [lat, lng]);

    return <div ref={containerRef} className="w-full h-64 rounded-xl border z-0" />;
  };

  if (!isAdmin) return <div className="p-8 text-center font-bold text-red-500">Access Denied</div>;

  return (
    <div className="min-h-screen bg-[#f4f7f9] p-4 md:p-6 lg:p-8 font-['Hanuman','Khmer_OS_Siemreap','Inter',sans-serif]">
      
      {/* ── Page Header & Controls ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md shadow-blue-100">
              <MapIcon size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">កំណត់ទីតាំងស្កេនវត្តមាន</h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Geofencing Management</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="ស្វែងរក..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all w-full md:w-64"
              />
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-black transition-all shadow-sm">
              <Filter size={14} /> Filter
            </button>
            <button onClick={load} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-black transition-all shadow-sm">
              <RotateCcw size={14} /> Clear
            </button>
            <button onClick={onNew} className="flex items-center gap-1.5 px-4 py-2 bg-[#2b5876] hover:bg-[#4e4376] text-white rounded-lg text-xs font-black transition-all shadow-sm">
              <Plus size={14} /> Add New
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Data Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-wider">
                <th className="px-4 py-4 text-center w-12">#</th>
                <th className="px-4 py-4">ឈ្មោះច្បាប់ / ផ្នែក</th>
                <th className="px-4 py-4">Latitude</th>
                <th className="px-4 py-4">Longitude</th>
                <th className="px-4 py-4 text-center">Distance (m)</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-4 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">កំពុងផ្ទុកទិន្នន័យ...</td></tr>
              ) : filteredPolicies.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">មិនមានទិន្នន័យឡើយ</td></tr>
              ) : filteredPolicies.map((p, i) => (
                <tr key={p._id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-4 text-center text-slate-400 font-black text-xs">{i + 1}</td>
                  <td className="px-4 py-4">
                    <div className="font-black text-slate-700 text-sm">{p.name || 'Untitled'}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{p.match?.department || p.match?.staffId || 'Global / ទាំងអស់'}</div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-600">{p.fence?.centerLat?.toFixed(8)}</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-600">{p.fence?.centerLng?.toFixed(8)}</td>
                  <td className="px-4 py-4 text-center font-black text-blue-600 text-xs">{p.fence?.radiusM}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${p.enabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      {p.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 shadow-sm" title="View"><Eye size={14} /></button>
                      <button className="p-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 shadow-sm" title="Print"><Printer size={14} /></button>
                      <button onClick={() => onEdit(p)} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm" title="Edit"><Edit3 size={14} /></button>
                      <button onClick={() => onDelete(p._id)} className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 shadow-sm" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Editor ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-slate-500" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">{form.id ? 'Edit Department Location' : 'Add New Location'}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={onSave} className="p-6 space-y-6">
              {/* Logo Area */}
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="w-20 h-20 rounded-full border-2 border-slate-100 p-1 flex items-center justify-center bg-white shadow-inner">
                  <img src="https://ksfh.gov.kh/wp-content/uploads/2021/04/logo-ksfh-final-1-1.png" className="w-full h-full object-contain" alt="Logo" />
                </div>
                <button type="button" className="text-[10px] font-black text-slate-400 border border-slate-200 px-3 py-1 rounded hover:bg-slate-50 uppercase tracking-wider">Upload</button>
              </div>

              {/* Name & Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">Name <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <select 
                      required 
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none shadow-sm appearance-none cursor-pointer pr-10" 
                      value={form.name} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(p => ({ 
                          ...p, 
                          name: val,
                          match: { ...p.match, department: val } // Auto-match department too
                        }));
                      }} 
                    >
                      <option value="">-- ជ្រើសរើសផ្នែក --</option>
                      {departments.map(d => (
                        <option key={d._id} value={d.Department_Kh}>{d.Department_Kh}</option>
                      ))}
                      <option value="custom">-- វាយបញ្ចូលឈ្មោះផ្សេង --</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronRight size={14} className="rotate-90" />
                    </div>
                  </div>
                  {form.name === 'custom' && (
                    <input 
                      className="w-full mt-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:bg-white focus:border-blue-500 outline-none animate-in slide-in-from-top-1"
                      placeholder="វាយបញ្ចូលឈ្មោះទីតាំង..."
                      onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">Priority (Code) <span className="text-red-500">*</span></label>
                  <input 
                    required 
                    type="number"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none shadow-sm" 
                    value={form.priority} 
                    onChange={(e) => setForm(p => ({ ...p, priority: e.target.value }))} 
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Latitude & Longitude Combined */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">Latitude & Longitude <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <input 
                    readOnly
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-600 focus:bg-white focus:border-blue-500 outline-none shadow-sm pr-12 cursor-default" 
                    value={`${form.fence.centerLat}, ${form.fence.centerLng}`} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowMap(!showMap)}
                    className={`absolute right-1 top-1 bottom-1 w-10 flex items-center justify-center rounded-md transition-all ${showMap ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:text-blue-500'}`}
                  >
                    <MapPin size={18} />
                  </button>
                </div>
              </div>

              {/* Collapsible Map Picker */}
              {showMap && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ជ្រើសរើសទីតាំងលើផែនទី</span>
                    <button 
                      type="button"
                      onClick={async () => {
                        const url = prompt('សូមផាស Link ពី Google Maps (ឧទាហរណ៍៖ https://maps.app.goo.gl/...):');
                        if (!url) return;
                        try {
                          const coords = await resolveMapLink(url);
                          if (coords.lat && coords.lng) {
                            setForm(p => ({ ...p, fence: { ...p.fence, centerLat: coords.lat, centerLng: coords.lng } }));
                          }
                        } catch (e) { alert('កំហុស៖ ' + e.message); }
                      }}
                      className="text-[10px] font-black text-blue-500 hover:underline"
                    >
                      ផាស Link ផែនទី
                    </button>
                  </div>
                  <LocationPicker 
                    lat={form.fence.centerLat} 
                    lng={form.fence.centerLng} 
                    onChange={(lat, lng) => setForm(p => ({ ...p, fence: { ...p.fence, centerLat: lat, centerLng: lng } }))} 
                  />
                </div>
              )}

              {/* Distance & 2-scans Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">Distance <span className="text-red-500">*</span></label>
                  <input 
                    type="number"
                    required
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none shadow-sm" 
                    value={form.fence.radiusM} 
                    onChange={(e) => setForm(p => ({ ...p, fence: { ...p.fence, radiusM: e.target.value } }))} 
                    placeholder="100"
                  />
                </div>
                <div className="flex items-center gap-3 py-2 px-1">
                  <input 
                    type="checkbox" 
                    id="2-scans-toggle"
                    className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer" 
                    checked={form.note?.includes('2-scans')} 
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setForm(p => {
                        let newNote = p.note || '';
                        if (isChecked) {
                          if (!newNote.includes('2-scans')) newNote = (newNote + ' 2-scans').trim();
                        } else {
                          newNote = newNote.replace('2-scans', '').trim();
                        }
                        return { ...p, note: newNote };
                      });
                    }} 
                  />
                  <div className="flex flex-col">
                    <label htmlFor="2-scans-toggle" className="text-xs font-black text-orange-600 uppercase tracking-widest cursor-pointer">ស្កេនតែ ២ ដង</label>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">2-scans only per day</span>
                  </div>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-3 py-2 px-1">
                <input 
                  type="checkbox" 
                  id="enabled-toggle"
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                  checked={form.enabled} 
                  onChange={(e) => setForm(p => ({ ...p, enabled: e.target.checked }))} 
                />
                <label htmlFor="enabled-toggle" className="text-xs font-black text-slate-600 uppercase tracking-widest cursor-pointer">បើកដំណើរការច្បាប់នេះ</label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-black transition-all"
                >
                  <X size={14} /> Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-[#28a745] hover:bg-[#218838] text-white rounded-lg text-xs font-black transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>

            {error && (
              <div className="m-6 mt-0 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-[11px] font-bold">
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Background Branding ── */}
      <div className="fixed bottom-10 left-10 opacity-[0.03] pointer-events-none -z-10 select-none">
        <div className="flex items-center gap-4">
          <img src="https://ksfh.gov.kh/wp-content/uploads/2021/04/logo-ksfh-final-1-1.png" className="w-24 h-24 object-contain grayscale" alt="B" />
          <div className="uppercase">
            <div className="text-4xl font-black">មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
            <div className="text-2xl font-bold tracking-[0.2em]">Khmer-Soviet Friendship Hospital</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default GeoFencePoliciesPage;
