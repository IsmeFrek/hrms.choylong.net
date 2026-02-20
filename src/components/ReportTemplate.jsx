import React, { useMemo } from 'react';

function exportCsv(rows, filename = 'report.csv') {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] ?? '')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ReportTemplate({ roleLabel, sampleData }) {
  const rows = useMemo(() => sampleData || [], [sampleData]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900">របាយការណ៍ - {roleLabel}</h2>
      <p className="text-gray-600 mt-2">របាយការណ៍សម្រាប់តួនាទី: {roleLabel}</p>

      <div className="mt-6 bg-white border rounded shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div>
            <label className="block text-sm text-gray-600">ថ្ងៃចាប់ផ្តើម</label>
            <input type="date" className="mt-1 border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">ថ្ងៃបញ្ចប់</label>
            <input type="date" className="mt-1 border rounded px-2 py-1" />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600">ផ្នែក</label>
            <select className="mt-1 border rounded px-2 py-1 w-full">
              <option value="">-- រើស --</option>
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => exportCsv(rows, `${roleLabel || 'report'}.csv`)}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              Export CSV
            </button>
            <button className="px-3 py-2 border rounded">Search</button>
          </div>
        </div>

        <div className="mt-6 overflow-auto">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-gray-500">មិនមានទិន្នន័យសម្រាប់បង្ហាញ</div>
          ) : (
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {Object.keys(rows[0]).map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs text-gray-600 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {Object.keys(rows[0]).map(h => (
                      <td key={h} className="px-3 py-2 text-sm text-gray-800 border-b">{r[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
