import React, { useState } from 'react';

function ImportAttendance() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setPreview([]);
    setResult(null);
    setError(null);

    // Try to show a quick preview for CSV or XLSX using FileReader and simple parsing
    if (!f) return;
    const name = f.name.toLowerCase();
    if (name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const txt = ev.target.result;
        const lines = txt.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1, 6).map(l => {
          const cols = l.split(',');
          const obj = {};
          headers.forEach((h, i) => obj[h] = cols[i] || '');
          return obj;
        });
        setPreview(rows);
      };
      reader.readAsText(f);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      // For XLSX we can't parse fully without adding a client library; show basic filename preview
      setPreview([{ note: `${f.name} ready to upload (preview not available for xlsx)` }]);
    } else {
      setPreview([{ note: 'Unsupported file type for preview' }]);
    }
  };

  const doImport = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch('/api/imports/attendance', { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error || JSON.stringify(json));
      } else {
        setResult(json.results || json);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Import Attendance (Excel/CSV)</h2>
      <p className="no-print">Choose an Excel (.xlsx/.xls) or CSV file exported from your time system. The backend will upsert by staffId + date.</p>

      <div className="no-print" style={{ marginBottom: 12 }}>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Preview:</strong>
        <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #eee', padding: 8, marginTop: 8 }}>
          {preview.length === 0 && <div style={{ color: '#666' }}>No preview available</div>}
          {preview.map((r, i) => (
            <div key={i} style={{ padding: 6, borderBottom: '1px dashed #f0f0f0', fontFamily: 'monospace', fontSize: 13 }}>
              {Object.entries(r).map(([k, v]) => (
                <div key={k}><strong>{k}:</strong> {v}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="no-print" style={{ marginTop: 12 }}>
        <button onClick={doImport} disabled={loading} style={{ marginRight: 8 }}>
          {loading ? 'Importing...' : 'Import'}
        </button>
        <button onClick={() => { setFile(null); setPreview([]); setResult(null); setError(null); }}>Clear</button>
      </div>

      <div style={{ marginTop: 16 }}>
        {error && <div style={{ color: 'crimson' }}><strong>Error:</strong> {error}</div>}
        {result && (
          <div style={{ color: 'green' }}>
            <h4>Import Result</h4>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportAttendance;
