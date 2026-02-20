import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import WeeklyShiftPattern from '../components/WeeklyShiftPattern';

function getDaysArray(start, end) {
  const arr = [];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    arr.push(new Date(d));
  }
  return arr;
}

export default function WorkCalendarPage() {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date(new Date().getTime() + (13*24*60*60*1000)).toISOString().slice(0,10)); // default two-week
  const [schedules, setSchedules] = useState([]);
  const [hrList, setHrList] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), scheduledStart: '07:30', scheduledEnd: '15:30', scheduledGraceMinutes: 15, scheduledEndGraceMinutes: 0, department: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [calendarMode, setCalendarMode] = useState(true);
  const [showWeeklyPattern, setShowWeeklyPattern] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/schedules', { params: { from, to } });
      setSchedules(Array.isArray(data) ? data : []);
    } catch (e) {
      // ignore
    } finally { setLoading(false); }
  };

  const loadHR = async () => {
    try {
      const { data } = await api.get('/hr');
      const items = Array.isArray(data) ? data : [];
      setHrList(items);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => { load(); }, [from, to]);
  useEffect(() => { loadHR(); }, []);

  const save = async () => {
    try {
      const payload = { ...form, date: new Date(form.date).toISOString() };
      await api.post('/schedules', payload);
      await load();
    } catch (e) { console.error(e); }
  };

  const remove = async (id) => {
    try { await api.delete(`/schedules/${id}`); await load(); } catch (e) { console.error(e); }
  };

  const days = useMemo(() => getDaysArray(from, to), [from, to]);

  const findSchedule = (emp, dayDate) => {
    const dayIso = new Date(dayDate).toISOString().slice(0,10);
    // prefer schedules matching employee department, else general schedule
    let match = schedules.find(s => (s.date && new Date(s.date).toISOString().slice(0,10) === dayIso) && (!s.department));
    if (emp) {
      const byDept = schedules.find(s => (s.date && new Date(s.date).toISOString().slice(0,10) === dayIso) && s.department && (s.department === emp.Department_Kh || s.department === emp.department));
      if (byDept) match = byDept;
    }
    return match || null;
  };

  return (
    <div className="p-6">
      <h3 className="text-2xl font-semibold">ប្រតិទិនវេនការងារ</h3>

      <div style={{display:'flex', gap:12, marginTop:12, alignItems:'center'}}>
        <div>
          <label>ពីថ្ងៃ</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label>ដល់ថ្ងៃ</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div style={{marginLeft:8}}>
          <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={load}>បង្ហាញ</button>
        </div>
        <div style={{marginLeft:'auto', display:'flex', gap:8}}>
          <button 
            className="px-3 py-1 border rounded bg-purple-50 text-purple-700 hover:bg-purple-100" 
            onClick={() => setShowWeeklyPattern(true)}
          >
            កំណត់ម៉ូដែលសប្តាហ៍ (Weekly Pattern)
          </button>
          <button className="px-3 py-1 border rounded bg-white">Filter</button>
          <button className="px-3 py-1 border rounded bg-red-50">Clear</button>
          <button className="px-3 py-1 border rounded bg-green-50">Export</button>
          <button className="px-3 py-1 border rounded bg-blue-50">Import</button>
          <button className="px-3 py-1 border rounded bg-gray-100" onClick={() => setCalendarMode(m => !m)}>{calendarMode ? 'List view' : 'Calendar view'}</button>
        </div>
      </div>

      <div style={{marginTop:18}}>
        {calendarMode ? (
          <div style={{overflowX:'auto', border:'1px solid #e5e7eb'}}>
            <table style={{width:'100%', borderCollapse:'collapse', minWidth: 1000}}>
              <thead style={{background:'#fafafa'}}>
                <tr>
                  <th style={{border:'1px solid #e5e7eb', padding:8, width:220}}># / Employee</th>
                  {days.map((d, idx) => (
                    <th key={idx} style={{border:'1px solid #e5e7eb', padding:8, minWidth:120, textAlign:'center'}}>
                      <div style={{fontWeight:700}}>{d.getDate().toString().padStart(2,'0')}</div>
                      <div style={{fontSize:12, color:'#666'}}>{d.toLocaleDateString(undefined,{weekday:'short'})}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(hrList||[]).slice(0,200).map((emp, i) => (
                  <tr key={emp._id || i}>
                    <td style={{border:'1px solid #eaeaea', padding:8, verticalAlign:'top'}}>
                      <div style={{display:'flex', gap:8, alignItems:'center'}}>
                        <img src={emp.photo || '/src/assets/3.JPG'} alt="" style={{width:36, height:36, borderRadius:18, objectFit:'cover'}} />
                        <div>
                          <div style={{fontWeight:600}}>{emp.khmerName || emp.fullName || emp.name || emp.staffName}</div>
                          <div style={{fontSize:12, color:'#666'}}>{emp.staffId || ''}</div>
                        </div>
                      </div>
                    </td>
                    {days.map((d, di) => {
                      const s = findSchedule(emp, d);
                      const isDayOff = s && (s.scheduledStart === 'OFF' || s.scheduledEnd === 'OFF' || (s.notes && String(s.notes).toLowerCase().includes('day off')));
                      return (
                        <td key={di} style={{border:'1px solid #eaeaea', padding:8, verticalAlign:'top', minWidth:120, background: isDayOff ? '#fff7f7' : '#fff'}}>
                          {s ? (
                            <div style={{textAlign:'center'}}>
                              {!isDayOff ? (
                                <div style={{fontWeight:700, color:'#111'}}>{(s.scheduledStart || '07:30') + '-' + (s.scheduledEnd || '15:30')}</div>
                              ) : (
                                <div style={{fontWeight:700, color:'#c92a2a'}}>Day off</div>
                              )}
                              <div style={{fontSize:12, color:'#666', marginTop:6}}>{s.department || ''}</div>
                            </div>
                          ) : (
                            <div style={{textAlign:'center', color:'#999'}}>—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{display:'flex', gap:12}}>
            <div style={{border:'1px solid #e5e7eb', padding:12, borderRadius:6}}>
              <label>កាលបរិច្ឆេទ</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              <div>
                <label>ម៉ោងចូល</label>
                <input type="time" value={form.scheduledStart} onChange={e => setForm({...form, scheduledStart: e.target.value})} />
              </div>
              <div>
                <label>ម៉ោងចេញ</label>
                <input type="time" value={form.scheduledEnd} onChange={e => setForm({...form, scheduledEnd: e.target.value})} />
              </div>
              <div>
                <label>Grace (នាទី)</label>
                <input type="number" value={form.scheduledGraceMinutes} onChange={e => setForm({...form, scheduledGraceMinutes: Number(e.target.value)})} />
              </div>
              <div>
                <label>ផ្នែក</label>
                <input value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
              </div>
              <div style={{marginTop:8}}>
                <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={save}>រក្សាទុក</button>
              </div>
            </div>

            <div style={{flex:1}}>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead style={{background:'#f8fafc'}}>
                  <tr>
                    <th style={{border:'1px solid #e5e7eb', padding:8}}>កាលបរិច្ឆេទ</th>
                    <th style={{border:'1px solid #e5e7eb', padding:8}}>ម៉ោងចូល</th>
                    <th style={{border:'1px solid #e5e7eb', padding:8}}>ម៉ោងចេញ</th>
                    <th style={{border:'1px solid #e5e7eb', padding:8}}>Grace</th>
                    <th style={{border:'1px solid #e5e7eb', padding:8}}>ផ្នែក</th>
                    <th style={{border:'1px solid #e5e7eb', padding:8}}>សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody>
                  {(schedules||[]).map(s => (
                    <tr key={s._id}>
                      <td style={{border:'1px solid #eaeaea', padding:8}}>{new Date(s.date).toLocaleDateString()}</td>
                      <td style={{border:'1px solid #eaeaea', padding:8}}>{s.scheduledStart}</td>
                      <td style={{border:'1px solid #eaeaea', padding:8}}>{s.scheduledEnd}</td>
                      <td style={{border:'1px solid #eaeaea', padding:8}}>{s.scheduledGraceMinutes}</td>
                      <td style={{border:'1px solid #eaeaea', padding:8}}>{s.department}</td>
                      <td style={{border:'1px solid #eaeaea', padding:8}}><button className="bg-red-500 text-white px-2 py-1 rounded" onClick={() => remove(s._id)}>លុប</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Shift Pattern Modal */}
      {showWeeklyPattern && (
        <WeeklyShiftPattern
          onClose={() => setShowWeeklyPattern(false)}
          onSave={() => {
            load(); // Reload the schedules after saving
            setShowWeeklyPattern(false);
          }}
        />
      )}
    </div>
  );
}
