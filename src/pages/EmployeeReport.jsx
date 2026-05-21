import React from 'react';

const KHMER_FONT = { fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" };

const sampleData = [
  {
    sr: 1,
    no: '001',
    khmerName: 'ឈ្មោះ ផ្លូវ',
    latinName: 'Chhmoh Phlov',
    gender: 'ស្រី',
    position: 'គ្រូពេទ្យ',
    dob: '1990-05-12',
    bankAccount: 'AC-0123456789',
    role: 'បុគ្កលិក',
    grantAmount: 100000,
  },
  {
    sr: 2,
    no: '002',
    khmerName: 'ម៉ៅ សុភា',
    latinName: 'Mao Sophea',
    gender: 'ស្រី',
    position: 'មន្រ្តីរាជការ',
    dob: '1985-09-03',
    bankAccount: 'AC-9876543210',
    role: 'នារី',
    grantAmount: 100000,
  },
];

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
  } catch { return iso; }
};

const downloadCsv = (rows) => {
  if (!rows || !rows.length) return;
  const headers = ['ស.រ', 'ល.រ', 'គោត្តនាម និងនាម', 'អក្សរឡាតាំង', 'ភេទ', 'តួនាទី', 'ថ្ងៃខែឆ្នាំកណើត', 'លេខធនាគា', 'មុខងារ', 'ប្រាក់ឧបត្ថម្ភ'];
  const csvRows = [headers.join(',')];
  for (const r of rows) {
    const vals = [
      r.sr,
      `"${r.no || ''}"`,
      `"${r.khmerName || ''}"`,
      `"${r.latinName || ''}"`,
      `"${r.gender || ''}"`,
      `"${r.position || ''}"`,
      `"${formatDate(r.dob) || ''}"`,
      `"${r.bankAccount || ''}"`,
      `"${r.role || ''}"`,
      r.grantAmount ?? '',
    ];
    csvRows.push(vals.join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'employee_grants_report.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function EmployeeReport() {
  return (
    <div style={{ ...KHMER_FONT, padding: 16 }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">របាយការណ៍ ប្រាក់ឧបត្ថម្ភ</h2>
          <div className="text-sm text-gray-600">សម្រាប់បុគ្គលិក និងមន្រ្តីរាជការ (ទិវាសិទ្ធិនារីអន្តរជាតិ ៨ មីនា ២០២៥)</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCsv(sampleData)} className="bg-blue-600 text-white px-3 py-1 rounded">Export CSV</button>
          <button onClick={() => window.print()} className="bg-gray-600 text-white px-3 py-1 rounded">Print</button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full border-collapse" style={{ border: '1px solid #ddd' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th className="border px-2 py-1">ស.រ</th>
              <th className="border px-2 py-1">ល.រ</th>
              <th className="border px-2 py-1">គោត្តនាម និងនាម</th>
              <th className="border px-2 py-1">អក្សរឡាតាំង</th>
              <th className="border px-2 py-1">ភេទ</th>
              <th className="border px-2 py-1">តួនាទី</th>
              <th className="border px-2 py-1">ថ្ងៃខែឆ្នាំកណើត</th>
              <th className="border px-2 py-1">លេខធនាគា</th>
              <th className="border px-2 py-1">មុខងារ</th>
              <th className="border px-2 py-1">ប្រាក់ឧបត្ថម្ភ</th>
            </tr>
          </thead>
          <tbody>
            {sampleData.map((r, i) => (
              <tr key={i}>
                <td className="border px-2 py-1 text-center">{r.sr}</td>
                <td className="border px-2 py-1 text-center">{r.no}</td>
                <td className="border px-2 py-1">{r.khmerName}</td>
                <td className="border px-2 py-1">{r.latinName}</td>
                <td className="border px-2 py-1 text-center">{r.gender}</td>
                <td className="border px-2 py-1">{r.position}</td>
                <td className="border px-2 py-1 text-center">{formatDate(r.dob)}</td>
                <td className="border px-2 py-1">{r.bankAccount}</td>
                <td className="border px-2 py-1">{r.role}</td>
                <td className="border px-2 py-1 text-right">{r.grantAmount?.toLocaleString?.() ?? r.grantAmount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
