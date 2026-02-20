import React, { useEffect, useState } from 'react';
import api from '../services/api';
import DepartmentBadges from '../components/DepartmentBadges';

export default function ShiftsPage() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ _id: null, title: '', shortTitle: '', color: '#7c3aed', startAt: '06:00', endAt: '15:00', startAt2: '', endAt2: '', notes: '', department: [] });
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Normalize department value to a display string (prefer Department_Kh)
  const normalizeDepartment = (d) => {
    if (d === null || d === undefined) return '';
    if (typeof d === 'string') return d;
    // prefer Khmer name fields (Department_Kh or department_kh), then other common fields
    if (!d) return '';
    return d.Department_Kh || d.department_kh || d.department || d.Department || d.name || d.Department_En || String(d);
  };

  // shared cell style for table headers and cells (adds H and V borders)
  const cellStyle = { padding: 8, border: '1px solid #c2caccff' };

  const load = async () => {
    setLoading(true);
    try {
  const { data } = await api.get('/shift-templates');
  const raw = Array.isArray(data) ? data : [];
  // normalize department field on each shift template so UI can bind to array of strings
  const mapped = raw.map(r => ({
    ...r,
    department: Array.isArray(r.department) ? r.department.map(normalizeDepartment).filter(Boolean) : (r.department ? [normalizeDepartment(r.department)] : [])
  }));
  setList(mapped);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        console.debug('ShiftsPage: fetching departments (try /employees/meta/departments then /departments)');
        let res;
        let d = [];
        try {
          // try the preferred endpoint first
          res = await api.get('/employees/meta/departments');
          d = Array.isArray(res.data) ? res.data : (res.data && res.data.departments ? res.data.departments : []);
          } catch (err) {
          // on error (404, network), try the public fallback endpoint
          console.debug('ShiftsPage: /employees/meta/departments failed, trying /departments/public', err);
          try {
            res = await api.get('/departments/public');
            d = Array.isArray(res.data) ? res.data : (res.data && res.data.departments ? res.data.departments : []);
          } catch (err2) {
            console.debug('ShiftsPage: /departments/public also failed', err2);
            d = [];
          }
        }
        // keep the raw items (strings or objects) so we can render Department_Kh when present
        console.debug('ShiftsPage: departments fetched (raw)', d);
        setDepartments(d || []);
      } catch (e) { console.debug('ShiftsPage: fetchDepartments error', e); setDepartments([]); }
    };
    fetchDepartments();
    // expose a reload function in closure for UI button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // allow manual reload from UI
  const reloadDepartments = async () => {
    try {
      let d = [];
        try {
        const res = await api.get('/employees/meta/departments');
        d = Array.isArray(res.data) ? res.data : (res.data && res.data.departments ? res.data.departments : []);
      } catch (err) {
        console.debug('ShiftsPage: reload /employees/meta/departments failed, trying /departments/public', err);
        try {
          const res2 = await api.get('/departments/public');
          d = Array.isArray(res2.data) ? res2.data : (res2.data && res2.data.departments ? res2.data.departments : []);
        } catch (err2) { console.debug('ShiftsPage: reload /departments/public failed', err2); d = []; }
      }
      console.debug('ShiftsPage: reloadDepartments raw', d);
      setDepartments(d || []);
    } catch (e) { console.debug('ShiftsPage: reloadDepartments error', e); setDepartments([]); }
  };

  const save = async (e) => {
    e?.preventDefault();
    
    // Validate required fields
    if (!form.title || form.title.trim() === '') {
      alert('សូមបញ្ចូលចំណងជើង Shift Template!');
      return;
    }
    
    setSaveLoading(true);
    try {
      console.log('ShiftsPage: attempting to save shift template:', form);
      
      if (form._id) {
        console.log('ShiftsPage: updating existing template with ID:', form._id);
        const response = await api.put(`/shift-templates/${form._id}`, form);
        console.log('ShiftsPage: update response:', response);
      } else {
        console.log('ShiftsPage: creating new template');
        const response = await api.post('/shift-templates', form);
        console.log('ShiftsPage: create response:', response);
      }
  setForm({ _id: null, title: '', shortTitle: '', color: '#7c3aed', startAt: '06:00', endAt: '15:00', startAt2: '', endAt2: '', notes: '', department: [] });
      await load();
      console.log('ShiftsPage: save completed successfully');
      alert('រក្សាទុកបានជោគជ័យ!');
    } catch (err) { 
      console.error('ShiftsPage: save error:', err); 
      alert('មានបញ្ហាក្នុងការរក្សាទុក: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaveLoading(false);
    }
  };

  const remove = async (id) => { try { await api.delete(`/shift-templates/${id}`); await load(); } catch (e) { console.error(e); } };

  const edit = (s) => setForm({ ...s, department: Array.isArray(s.department) ? s.department.map(normalizeDepartment).filter(Boolean) : (s.department ? [normalizeDepartment(s.department)] : []) });

  const filtered = list.filter(s => {
    if (selectedDepartment) {
      const has = Array.isArray(s.department) ? s.department.includes(selectedDepartment) : (s.department || '') === selectedDepartment;
      if (!has) return false;
    }
    return (s.title || '').toLowerCase().includes(query.toLowerCase()) || (s.shortTitle || '').toLowerCase().includes(query.toLowerCase());
  });
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const shown = filtered.slice((page-1)*perPage, page*perPage);

  // normalized department names for the checkbox list
  const departmentNames = (departments || []).map(d => typeof d === 'string' ? d : (d.Department_Kh || d.department_kh || normalizeDepartment(d))).filter(Boolean);

  return (
    <div className="p-6">
      <h3 className="text-2xl font-semibold">បញ្ជីម៉ោង (Shifts)</h3>

      <div style={{display:'flex', gap:12, marginTop:12}}>
        <div style={{flex:1}}>
          <div style={{display:'flex', gap:8, marginBottom:8, alignItems:'center'}}>
              {(() => {
              // Build union of fetched departments (normalize objects to strings) and departments present in shift templates
              const fetched = (departments || []).map(x => normalizeDepartment(x)).filter(Boolean);
              const presentFromShifts = (list || []).flatMap(s => Array.isArray(s.department) ? s.department : (s.department ? [s.department] : []));
              const present = Array.from(new Set([...fetched, ...presentFromShifts].filter(Boolean)));
              const options = present.length ? present : [];
              return (
                <select value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} className="border rounded px-2 py-1">
                  <option value="">-- ទាំងអស់ --</option>
                    {options.map((d, i) => <option key={i} value={d}>{d}</option>)}
                </select>
              );
            })()}
            <input placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} className="border rounded px-2 py-1 w-full" />
            <button className="border px-3 rounded" onClick={() => { setQuery(''); setPage(1); setSelectedDepartment(''); }}>Clear</button>
            <button className="border px-3 rounded" onClick={reloadDepartments} title="Fetch departments from server">Reload Depts</button>
            <span style={{marginLeft:8, color:'#1450c9ff'}}>Depts: {Array.isArray(departments) ? departments.length : 0}</span>
          </div>

          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead style={{background:'#dfebf8ff'}}>
              <tr>
                <th style={{...cellStyle, width:40, minWidth:40}}>#</th>
                <th style={{...cellStyle, width:120, minWidth:150}}>Shift Title</th>
                <th style={{...cellStyle, width:140, minWidth:100}}>Short Title</th>
                <th style={{...cellStyle, width:40, minWidth:40}}>Color</th>
                <th style={{...cellStyle, width:70, minWidth:72}}>Start at</th>
                <th style={{...cellStyle, width:70, minWidth:72}}>End at</th>
                <th style={{...cellStyle, width:110, minWidth:90}}>Start at-2</th>
                <th style={{...cellStyle, width:110, minWidth:90}}>End at-2</th>
                <th style={{...cellStyle, width:250, minWidth:200}}>ផ្នែក</th>
                <th style={{...cellStyle, width:80, minWidth:60}}>សំគាល់</th>
                <th style={{...cellStyle, width:90, minWidth:100}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s,i) => (
                <tr key={s._id} style={{background: i%2===0? '#e3f3f2ff':'#fafafa'}}>
                  <td style={{...cellStyle}}>{(page-1)*perPage + i + 1}</td>
                  <td style={{...cellStyle}}>{s.title}</td>
                  <td style={{...cellStyle}}>{s.shortTitle}</td>
                  <td style={{...cellStyle}}><span style={{display:'inline-block', width:18, height:18, background:s.color || '#7c3aed', borderRadius:9}} /></td>
                  <td style={{...cellStyle}}>{s.startAt}</td>
                  <td style={{...cellStyle}}>{s.endAt}</td>
                  <td style={{...cellStyle}}>{s.startAt2 || 'No Work Time 2'}</td>
                  <td style={{...cellStyle}}>{s.endAt2 || ''}</td>
                  <td style={{...cellStyle, padding: '4px 8px'}}>
                    <DepartmentBadges departments={s.department} maxVisible={2} />
                  </td>
                  <td style={{...cellStyle, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={s.notes || ''}>
                    {s.notes || ''}
                  </td>
                  <td style={{...cellStyle}}>
                    <button className="bg-blue-500 text-white px-2 py-1 rounded mr-2" onClick={() => edit(s)}>Edit</button>
                    <button className="bg-red-500 text-white px-2 py-1 rounded" onClick={() => remove(s._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div>Total: {total} records</div>
            <div>
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <button className="border px-2 py-1 ml-2" onClick={() => setPage(p => Math.max(1, p-1))}>&lt;</button>
              <span style={{padding:'0 8px'}}>{page}</span>
              <button className="border px-2 py-1" onClick={() => setPage(p => Math.min(pages, p+1))}>&gt;</button>
            </div>
          </div>
        </div>

        <form onSubmit={save} style={{width:360, border:'1px solid #e5e7eb', padding:12, borderRadius:6}}>
          <div>
            <label>Shift Title <span style={{color: 'red'}}>*</span></label>
            <input 
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
              className="w-full border px-2 py-1" 
              required
              placeholder="បញ្ចូលចំណងជើង shift..."
            />
          </div>
          <div>
            <label>Short Title</label>
            <input 
              value={form.shortTitle} 
              onChange={e => setForm({...form, shortTitle: e.target.value})} 
              className="w-full border px-2 py-1" 
              placeholder="ឧ. D, E, F, G..."
            />
          </div>
          <div style={{display:'flex', gap:8}}>
            <div>
              <label>Color</label>
              <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} />
            </div>
            <div>
              <label>Start at</label>
              <input type="time" value={form.startAt} onChange={e => setForm({...form, startAt: e.target.value})} />
            </div>
            <div>
              <label>End at</label>
              <input type="time" value={form.endAt} onChange={e => setForm({...form, endAt: e.target.value})} />
            </div>
          </div>
          <div style={{display:'flex', gap:8, marginTop:8}}>
            <div>
              <label>Start at-2</label>
              <input type="time" value={form.startAt2} onChange={e => setForm({...form, startAt2: e.target.value})} />
            </div>
            <div>
              <label>End at-2</label>
              <input type="time" value={form.endAt2} onChange={e => setForm({...form, endAt2: e.target.value})} />
            </div>
          </div>
          <div style={{marginTop:8}}>
            <div style={{marginBottom:8}}>
              <label>ផ្នែក (Department)</label>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                <label style={{display:'flex', alignItems:'center'}}>
                  <input
                    type="checkbox"
                    style={{marginRight:8}}
                    checked={departmentNames.length>0 && departmentNames.every(n => Array.isArray(form.department) && form.department.includes(n))}
                    onChange={e => {
                      if (e.target.checked) {
                        // add all (unique)
                        setForm(f => ({ ...f, department: Array.from(new Set([...(Array.isArray(f.department)?f.department:[]), ...departmentNames])) }));
                      } else {
                        setForm(f => ({ ...f, department: [] }));
                      }
                    }}
                  />
                  Select all
                </label>
                <button type="button" className="border px-2 py-1" onClick={() => setForm(f => ({ ...f, department: [] }))}>Clear</button>
              </div>
              <div style={{maxHeight:500, overflowY:'auto', border:'1px solid #e5e7eb', padding:8, borderRadius:4}}>
                {departmentNames.map((name, i) => {
                  const checked = Array.isArray(form.department) && form.department.includes(name);
                  return (
                    <label key={i} style={{display:'block', marginBottom:6, cursor:'pointer'}}>
                      <input
                        type="checkbox"
                        style={{marginRight:8}}
                        checked={checked}
                        onChange={() => {
                          if (!Array.isArray(form.department)) setForm(f => ({ ...f, department: [name] }));
                          else if (checked) setForm(f => ({ ...f, department: f.department.filter(x => x !== name) }));
                          else setForm(f => ({ ...f, department: [...f.department, name] }));
                        }}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <label>សំគាល់ (Notes)</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full border px-2 py-1" rows={3} />
            </div>
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors" disabled={saveLoading}>
              {saveLoading ? 'កំពុងរក្សាទុក...' : (form._id ? 'កែប្រែ (Update)' : 'បង្កើត (Create)')}
            </button>
            {form._id && (
              <button 
                type="button" 
                onClick={() => setForm({ _id: null, title: '', shortTitle: '', color: '#7c3aed', startAt: '06:00', endAt: '15:00', startAt2: '', endAt2: '', notes: '', department: [] })}
                className="bg-gray-500 text-white px-4 py-2 rounded ml-2 hover:bg-gray-600 transition-colors"
              >
                បោះបង់ (Cancel)
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
