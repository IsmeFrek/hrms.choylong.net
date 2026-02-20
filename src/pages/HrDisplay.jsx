import React, { useEffect, useState } from 'react';
import '../App.css';

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', marginBottom: 8 }}>
      <div style={{ width: 220, fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1 }}>{value || '—'}</div>
    </div>
  );
}

export default function HrDisplayPage() {
  const [hrList, setHrList] = useState([]);
  const [hr, setHr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [pageSize, setPageSize] = useState(() => localStorage.getItem('hr.pageSize') || 'A4');

  useEffect(() => {
    const elId = 'hr-page-size-style';
    let el = document.getElementById(elId);
    const sizeMap = { A4: 'A4', Letter: 'Letter', A3: 'A3' };
    const size = sizeMap[pageSize] || 'A4';
    const css = `@page { size: ${size}; margin: 12mm; }`;
    if (!el) {
      el = document.createElement('style');
      el.id = elId;
      document.head.appendChild(el);
    }
    el.innerHTML = css;
    localStorage.setItem('hr.pageSize', pageSize);
  }, [pageSize]);

  useEffect(() => {
    const fetchHr = async () => {
      try {
        setLoading(true);
        let list = [];
        try {
          const auth = JSON.parse(localStorage.getItem('auth') || 'null');
          if (auth && auth.token) {
            const r = await fetch('/api/hr', { headers: { Authorization: `Bearer ${auth.token}` } });
            if (r.ok) list = await r.json();
          } else {
            const r = await fetch('/api/hr/public-sample');
            if (r.ok) list = await r.json();
          }
        } catch (e) {
          try {
            const r2 = await fetch('/api/hr/public-sample');
            if (r2.ok) list = await r2.json();
          } catch (ee) { /* ignore */ }
        }
        setHrList(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length) {
          setHr(list[0]);
          setSelectedId(list[0]._id || list[0].staffId || '');
        }
      } catch (err) {
        setError(err?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchHr();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const found = hrList.find(x => x._id === selectedId || x.staffId === selectedId);
    if (found) setHr(found);
  }, [selectedId, hrList]);

  const fmtDate = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
  };

  if (loading) return <div style={{ padding: 24 }}>កំពុងផ្ទុក...</div>;
  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: 12 }}>
      <div className="no-print" style={{ textAlign: 'right', marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>ទំហំផេក:</label>
        <select value={pageSize} onChange={e => setPageSize(e.target.value)} style={{ marginRight: 12 }}>
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
          <option value="A3">A3</option>
        </select>
        <button onClick={() => window.print()} style={{ padding: '6px 10px', marginRight: 8 }}>Print</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>ជ្រើសបុគ្គលិក: </label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">-- ជ្រើស --</option>
          {hrList.map(h => (
            <option key={h._id || h.staffId} value={h._id || h.staffId}>{h.khmerName || h.name || (h.staffId || h._id)}</option>
          ))}
        </select>
      </div>

      <div className={`a4 page-${pageSize.toLowerCase()}`}>
        <div className="report-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>សហគមន៍/គ្រឹះស្ថាន</div>
              <div style={{ fontSize: 12 }}>ផែនកាន់: ប្រធានការិយាល័យ</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>សេចក្តីប្រកាសព័ត៌មានបុគ្គលិក</h2>
              <div style={{ fontSize: 12 }}>ទំព័រ សម្រាប់ឯកសារ</div>
            </div>
            <div style={{ textAlign: 'right', width: 160 }}>
              <div style={{ border: '1px solid #000', padding: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>លេខបង្កាន់ដៃ</div>
                <div style={{ height: 22 }}>{hr?.staffId || ''}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="report-body">
          <section style={{ paddingTop: 12 }}>
            <div style={{ marginBottom: 8 }}><strong>១. ព័ត៌មានទូទៅ</strong></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
              <div>
                <div>១) ឈ្មោះ និងនាម: {hr?.khmerName || '—'}</div>
                <div>២) ឈ្មោះ (ឡាតាំង): {hr?.name || '—'}</div>
                <div>៣) អត្តសញ្ញាណ: {hr?.nid || hr?.staffId || '—'}</div>
                <div>៤) ភេទ: {hr?.gender || '—'}</div>
                <div>៥) ថ្ងៃកំណើត: {fmtDate(hr?.dob)}</div>
              </div>
              <div>
                <div>៦) ទីកន្លែងកំណើត: {hr?.birthPlace || '—'}</div>
                <div>៧) ទីលំនៅបច្ចុប្បន្ន: {hr?.currentPlace || '—'}</div>
                <div>៨) ទូរស័ព្ទ: {hr?.phone || '—'}</div>
                <div>៩) អ៊ីម៉ែល: {hr?.email || '—'}</div>
              </div>
            </div>
          </section>

          <section style={{ marginTop: 18 }}>
            <div style={{ marginBottom: 8 }}><strong>២. ព័ត៌មានវិជ្ជាជីវៈ</strong></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12, alignItems: 'start', fontSize: 14 }}>
              <div>
                <div>១) ផ្នែក/ដេបាតឺម៉ង់: {hr?.Department_Kh || '—'}</div>
                <div>២) មុខតំណែង: {hr?.position || '—'}</div>
                <div>៣) ជំនាញ: {hr?.skill || '—'}</div>
                <div>៤) កាលបរិច្ឆេទចូលបំពេញការ: {fmtDate(hr?.joinDate)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ border: '1px solid #000', padding: 6, width: 140 }}>ពិន្ទុ/បង្ហាញ</div>
              </div>
            </div>
          </section>

          <section style={{ marginTop: 18 }}>
            <div style={{ fontSize: 14 }}><strong>ព័ត៌មានបន្ថែម</strong></div>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{hr?.other || hr?.reason || '—'}</div>
          </section>
        </div>

        <div className="report-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Prepared by: ______________________</div>
            <div style={{ textAlign: 'right' }}>Date: {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
