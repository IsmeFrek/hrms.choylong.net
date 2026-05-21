import React, { useEffect, useState } from 'react';

export default function AttendanceEditModal({ open, onClose, record, onSave }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (record) {
      const extractTime = (v) => {
        if (!v && v !== 0) return '';
        try {
          const s = String(v).trim();
          // ISO datetime -> extract time
          if (s.includes('T')) {
            const d = new Date(s);
            if (!isNaN(d.getTime())) {
              // return local time portion (avoid returning UTC time which causes display mismatch)
              const hh = String(d.getHours()).padStart(2, '0');
              const mm = String(d.getMinutes()).padStart(2, '0');
              const ss = String(d.getSeconds()).padStart(2, '0');
              return `${hh}:${mm}:${ss}`;
            }
          }
          // handle 12-hour times with AM/PM like "11:00:00 PM" or "11:00 PM"
          const ampm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
          if (ampm) {
            let hh = parseInt(ampm[1], 10);
            const mm = ampm[2].padStart(2,'0');
            const ss = ampm[3] ? ampm[3].padStart(2,'0') : '00';
            const mer = ampm[4].toUpperCase();
            if (mer === 'PM' && hh !== 12) hh += 12;
            if (mer === 'AM' && hh === 12) hh = 0;
            return String(hh).padStart(2,'0') + ':' + mm + ':' + ss;
          }
          // already short HH:MM or HH:MM:SS
          if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
            // normalize to HH:MM:SS
            const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
            const hh = m ? m[1].padStart(2,'0') : '00';
            const mm = m ? m[2] : '00';
            const ss = m && m[3] ? m[3].padStart(2,'0') : '00';
            return `${hh}:${mm}:${ss}`;
          }
          // try Date parse fallback (browser-specific) and extract local time
          const dt = new Date(s);
          if (!isNaN(dt.getTime())) {
            const hh = String(dt.getHours()).padStart(2, '0');
            const mm = String(dt.getMinutes()).padStart(2, '0');
            const ss = String(dt.getSeconds()).padStart(2, '0');
            return `${hh}:${mm}:${ss}`;
          }
          return '';
        } catch (e) { return ''; }
      };

        setForm({
        staffId: record.staffId || '',
        staffName: record.staffName || (record.staff && (record.staff.fullName || record.staff.name)) || record.khmerName || record.name || '',
        service: record.service || '',
        date: record.date ? new Date(record.date).toISOString().slice(0,10) : '',
        checkIn: extractTime(record.checkIn || record.inTime || record.checkInShort || ''),
        checkOut: extractTime(record.checkOut || record.outTime || record.checkOutShort || ''),
        checkIn2: extractTime(record.checkIn2 || record.inTime2 || record.checkIn2Short || ''),
        checkOut2: extractTime(record.checkOut2 || record.outTime2 || record.checkOut2Short || ''),
        status: record.status || '',
        notes: record.notes || '',
        departmentKh: record.departmentKh || '',
      });
    } else {
      setForm({});
    }
  }, [record]);

  if (!open) return null;

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) onSave(form);
  };

  return (
    <div style={{position:'fixed', left:0, top:0, right:0, bottom:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000}}>
      <form onSubmit={handleSubmit} style={{width:520, maxWidth:'96%', background:'#fff', borderRadius:8, padding:16}}>
        <h3 style={{marginTop:0}}>Edit attendance</h3>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <div>
            <label className="text-sm block">Staff ID</label>
            <input value={form.staffId||''} onChange={e=>update('staffId', e.target.value)} className="border rounded px-2 py-1 w-full" />
            <div style={{marginTop:6}}>
              <label className="text-sm block">Name</label>
              <input value={form.staffName||''} readOnly className="border rounded px-2 py-1 w-full bg-gray-100" />
            </div>
          </div>
          <div>
            <label className="text-sm block">Date</label>
            <input type="date" value={form.date||''} onChange={e=>update('date', e.target.value)} className="border rounded px-2 py-1 w-full" />
            <div style={{marginTop:6}}>
              <label className="text-sm block">Service/Dept (សេវាកម្ម/ផ្នែក)</label>
              <input value={form.service||''} onChange={e=>update('service', e.target.value)} className="border rounded px-2 py-1 w-full" />
            </div>
          </div>

          <div>
            <label className="text-sm block">Check In</label>
            {/* Use native time input with seconds enabled (step=1) so users can pick times */}
            <input type="time" step="1" value={form.checkIn||''} onChange={e=>update('checkIn', e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="text-sm block">Check Out</label>
            <input type="time" step="1" value={form.checkOut||''} onChange={e=>update('checkOut', e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>

          <div>
            <label className="text-sm block">Check In 2</label>
            <input type="time" step="1" value={form.checkIn2||''} onChange={e=>update('checkIn2', e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="text-sm block">Check Out 2</label>
            <input type="time" step="1" value={form.checkOut2||''} onChange={e=>update('checkOut2', e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>

          <div>
            <label className="text-sm block">Status</label>
            <select value={form.status||''} onChange={e=>update('status', e.target.value)} className="border rounded px-2 py-1 w-full">
              <option value="">--</option>
              <option value="present">present</option>
              <option value="late">late</option>
              <option value="absent">absent</option>
              <option value="leave">leave</option>
            </select>
          </div>

          <div style={{gridColumn:'1 / -1'}}>
            <label className="text-sm block">Dept_Kh (ផ្នែកក្នុងប្រព័ន្ធ)</label>
            <input value={form.departmentKh||''} onChange={e=>update('departmentKh', e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>

          <div style={{gridColumn:'1 / -1'}}>
            <label className="text-sm block">Notes</label>
            <input value={form.notes||''} onChange={e=>update('notes', e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
          <button type="button" onClick={onClose} className="border px-3 py-1">Cancel</button>
          <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded">Save</button>
        </div>
      </form>
    </div>
  );
}
