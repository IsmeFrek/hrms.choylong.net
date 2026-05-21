import React, { useState, useEffect } from 'react';
import api from '../services/api';
// Lucide icons removed for troubleshooting

const ManualPasteModal = ({ isOpen, onClose, onSave, date, categoryTypeId, branchId }) => {
  const [pastedText, setPastedText] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setPastedText('');
      setParsedData([]);
      setError(null);
      
      // Auto-read clipboard if available
      const readClipboard = async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
              setPastedText(text);
              parseText(text);
            }
          }
        } catch (err) {
          console.log('Clipboard auto-read failed or permission denied:', err);
        }
      };
      
      // Delay slightly to ensure browser focus
      const timer = setTimeout(readClipboard, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleTextChange = (e) => {
    const text = e.target.value;
    setPastedText(text);
    parseText(text);
  };

  const parseText = (text) => {
    if (!text.trim()) {
      setParsedData([]);
      return;
    }

    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    // Detect headers if present in first line
    const firstLine = lines[0].toLowerCase();
    let startIndex = 0;
    const headers = {
      no: -1,
      staffId: -1,
      name: -1,
      in1: -1,
      out1: -1,
      in2: -1,
      out2: -1,
      type: -1,
      reason: -1,
      department: -1,
      manager: -1,
      note: -1
    };

    const firstRowCols = lines[0].split('\t');
    
    // Heuristic header detection
    firstRowCols.forEach((col, idx) => {
      const c = col.toLowerCase().trim();
      if (c === 'no' || c === 'ល.រ' || c === '#') headers.no = idx;
      else if (c.includes('id') || c.includes('code') || c.includes('អត្តលេខ')) headers.staffId = idx;
      else if (c.includes('p.name') || c.includes('ឈ្មោះ')) headers.name = idx;
      else if (c.includes('in') || c.includes('ចូល') || c.includes('checkin')) {
        if (headers.in1 === -1) headers.in1 = idx;
        else headers.in2 = idx;
      }
      else if (c.includes('out') || c.includes('ចេញ') || c.includes('checkout')) {
        if (headers.out1 === -1) headers.out1 = idx;
        else headers.out2 = idx;
      }
      else if (c.includes('type') || c.includes('ប្រភេទ') || c.includes('ប្រភេទច្បាប់') || c.includes('ច្បាប់')) headers.type = idx;
      else if (c.includes('reason') || c.includes('មូលហេតុ') || c.includes('មូលហេតុច្បាប់') || c.includes('មូលហេតុនៃការឈប់សម្រាក')) headers.reason = idx;
      else if (c.includes('dept') || c.includes('ផ្នែក')) headers.department = idx;
      else if (c.includes('manager') || c.includes('ភ្នាក') || c.includes('អ្នកអនុម័ត')) headers.manager = idx;
      else if (c.includes('note') || c.includes('ចំណាំ') || c.includes('status') || c.includes('ស្ថានភាព')) headers.note = idx;
    });

    // If we found significant headers, skip the first line
    if (headers.staffId !== -1 || headers.name !== -1) {
      startIndex = 1;
    } else {
      // Fallback fixed indices for Checkinme Daily Report default layout
      // No | Staff ID | Name | In | Out | In2 | Out2 | Note
      headers.no = 0;
      headers.staffId = 1;
      headers.name = 2;
      headers.in1 = 3;
      headers.out1 = 4;
      headers.in2 = 5;
      headers.out2 = 6;
      headers.note = 7;
      headers.type = 8;
      headers.reason = 9;
    }

    const cleanTimeStr = (t) => {
      if (!t) return '';
      // Take first line for time
      const lines = String(t).split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return '';
      const firstLine = lines[0];
      if (firstLine === '--' || firstLine === '...' || firstLine === '—') return '';
      // Extract HH:mm AM/PM
      const m = firstLine.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
      return m ? m[1].trim() : (firstLine.length < 15 ? firstLine.trim() : '');
    };

    const extractTimeFlags = (t) => {
      if (!t) return { isLate: false, isEarly: false };
      const low = String(t).toLowerCase();
      // Check for late/early in any part of the cell (often 2nd line)
      const isLate = low.includes('late') || low.includes('យឺត');
      const isEarly = low.includes('early') || low.includes('មុន');
      return { isLate, isEarly };
    };

    const cleanNameStr = (n) => {
      if (!n) return '';
      // Name often has multiple lines (Name, Job, Dept)
      // We take the first non-empty line as the name
      const lines = n.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
      return lines[0] || '';
    };

    const getNameVariants = (n) => {
      if (!n) return [];
      return n.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
    };

    const results = [];
    for (let i = startIndex; i < lines.length; i++) {
        // Handle both Tab and multi-space separators (browser copy fallbacks)
        let cols = lines[i].split('\t');
        if (cols.length < 4) {
          cols = lines[i].split(/\s{4,}/); // Fallback to 4+ spaces
        }
        
        if (cols.length < 2) continue;

        const checkinCell = cols[headers.in1] || '';
        const checkoutCell = cols[headers.out1] || '';
        const checkin2Cell = cols[headers.in2] || '';
        const checkout2Cell = cols[headers.out2] || '';
        
        let in1 = cleanTimeStr(checkinCell);
        let out1 = cleanTimeStr(checkoutCell);
        let in2 = cleanTimeStr(checkin2Cell);
        let out2 = cleanTimeStr(checkout2Cell);

        const in1Flags = extractTimeFlags(checkinCell);
        const out1Flags = extractTimeFlags(checkoutCell);
        // Note: Checkin2/Checkout2 usually don't have separate late/early labels in Checkinme daily report layout
        
        let reqType = headers.type !== -1 ? cols[headers.type]?.trim() : '';
        let reqReason = headers.reason !== -1 ? cols[headers.reason]?.trim() : '';
        let rowNote = (headers.note !== -1 ? cols[headers.note]?.trim() : '') || '';

        // HEURISTIC: If no headers found, and it's an 8-column layout (No|ID|Name|Dept|Mgr|Type|Reason|Status)
        if (headers.staffId === 1 && headers.name === 2 && cols.length === 8 && !in1 && !out1) {
            // This is likely a Request Leave table
            reqType = cols[5]?.trim() || '';
            reqReason = cols[6]?.trim() || '';
            // If the last column is "approved" or "pending", it's a status, not a note.
            const lastCol = cols[7]?.toLowerCase() || '';
            if (lastCol === 'approved' || lastCol === 'pending' || lastCol === 'rejected') {
                rowNote = ''; 
            } else {
                rowNote = cols[7]?.trim() || '';
            }
        }
        
        // Auto-detect status
        let rowStatus = 'present';
        const hasTimes = !!(in1 || out1 || in2 || out2);
        
        if (!hasTimes && (reqType || reqReason)) {
          rowStatus = 'leave';
        } else if (!hasTimes) {
          rowStatus = 'absent';
        }

        const rawNameCell = cols[headers.name] || '';

        results.push({
            no: Number(cols[headers.no]) || undefined,
            staffId: cols[headers.staffId]?.trim() || '',
            name: cleanNameStr(rawNameCell),
            nameVariants: getNameVariants(rawNameCell),
            checkin1: in1,
            checkout1: out1,
            checkin2: in2,
            checkout2: out2,
            isLate: in1Flags.isLate,
            leftEarly: out1Flags.isEarly,
            status: rowStatus,
            leaveType: reqType,
            leaveReason: reqReason,
            note: rowNote
        });
    }

    setParsedData(results);
  };

  const handleSave = async () => {
    if (parsedData.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await onSave(parsedData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save data');
    } finally {
      setLoading(false);
    }
  };

  const handleFastAutoFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/attendance/fast-sync-checkinme', { date, categoryTypeId, branchId });
      if (data.ok) {
        onSave(null, data); // Pass null for records, data for result object
        onClose();
      } else {
        setError(data.message || 'Fast sync failed');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 1000, maxHeight: '90vh', position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        
        {/* Loading Overlay */}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, backdropFilter: 'blur(2px)' }}>
            <span style={{ fontSize: 48, animation: 'spin 1s linear infinite' }}>🔄</span>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: 18, fontWeight: 700 }}>កំពុងទាញយកទិន្នន័យ...</h3>
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}>សូមរង់ចាំពីរបីវិនាទី ប្រព័ន្ធកំពុងទាក់ទងទៅ Checkinme 🚀</p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 ចម្លងទិន្នន័យ (Paste) ឬ ទាញយកអូតូ
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              Paste ទិន្នន័យ ឬចុចប៊ូតុង Rocket ដើម្បីទាញយកអូតូយ៉ាងរហ័ស
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              onClick={handleFastAutoFetch}
              disabled={loading}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.4)', transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {loading ? '🔄' : '🚀'} Fast Auto-Fetch
            </button>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
              <span style={{ fontSize: 20 }}>✖️</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
              បញ្ចូលទិន្នន័យ (Paste here)
            </label>
            <textarea
              autoFocus
              value={pastedText}
              onChange={handleTextChange}
              placeholder="Paste rows from Checkinme here..."
              style={{ width: '100%', height: 150, padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: 12, resize: 'none', outline: 'none', focusBorderColor: '#6366f1' }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 20, padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, color: '#b91c1c', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ {error}
            </div>
          )}

          {parsedData.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                  លទ្ធផលនៃការអាន (Parsed {parsedData.length} records)
                </label>
                <span style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  ✅ ត្រៀមរួចរាល់
                </span>
              </div>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>ID</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>ឈ្មោះ</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>ចូល ១</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>ចេញ ១</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>ស្ថានភាព/ចំណាំ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: idx === 9 || idx === parsedData.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', color: '#1e293b' }}>{row.staffId}</td>
                        <td style={{ padding: '10px 12px', color: '#1e293b' }}>{row.name}</td>
                        <td style={{ padding: '10px 12px', color: '#1e293b' }}>
                          {row.checkin1} {row.isLate && <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 700 }}>(យឺត)</span>}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#1e293b' }}>
                          {row.checkout1} {row.leftEarly && <span style={{ color: '#f97316', fontSize: 10, fontWeight: 700 }}>(មុន)</span>}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>
                          {row.status === 'leave' ? (
                            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>ច្បាប់: {row.leaveType || row.leaveReason}</span>
                          ) : (
                            row.note || (row.status === 'absent' ? 'អវត្តមាន' : '')
                          )}
                        </td>
                      </tr>
                    ))}
                    {parsedData.length > 10 && (
                      <tr style={{ backgroundColor: '#fdfdfd' }}>
                        <td colSpan="5" style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
                          ... និង {parsedData.length - 10} នាក់ទៀត
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 12, backgroundColor: '#f8fafc', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
          >
            បោះបង់
          </button>
          <button
            onClick={handleSave}
            disabled={loading || parsedData.length === 0}
            style={{ 
              padding: '10px 24px', 
              borderRadius: 10, 
              border: 'none', 
              background: parsedData.length > 0 ? '#6366f1' : '#cbd5e1', 
              color: '#fff', 
              fontWeight: 600, 
              cursor: parsedData.length > 0 ? 'pointer' : 'default', 
              fontSize: 14, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              boxShadow: parsedData.length > 0 ? '0 4px 6px -1px rgba(99, 102, 241, 0.4)' : 'none'
            }}
          >
            {loading ? '🔄' : '✅'}
            រក្សាទុកទាំងអស់ ({parsedData.length})
          </button>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
};

export default ManualPasteModal;
