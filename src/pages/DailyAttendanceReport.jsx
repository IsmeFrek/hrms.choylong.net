import React, { useState } from 'react';
import Layout from '../components/Layout';
import headerBg from '../assets/3.JPG'
const sampleData = [
  {
    name: 'ដុំ សុផា',
    gender: 'ប',
    id: '1910300270',
    position: 'គ្រប់គ្រងផ្នែក',
    department: 'កិច្ចការ',
    dob: '',
    startDate: '',
    endDate: '',
    status: 'អវត្តមាន',
  },
  {
    name: 'ចាន់ វិចិត្រ',
    gender: 'ប',
    id: '',
    position: 'លក្ខណៈពិសេស',
    department: 'លក្ខណៈ',
    dob: '',
    startDate: '',
    endDate: '',
    status: 'អវត្តមាន',
  },
];

const DailyAttendanceReport = () => {
  return (
    <Layout activeSection="daily-attendance-report">
      <style>{`
        /* Ensure A4 portrait print and hide print controls while printing */
        @page {
          size: A4 portrait;
          /* top/bottom 1mm, left/right 1mm to reduce side margins by 1mm */
          margin: 1mm 1mm;
        }

        /* Hide elements intended only for screen when printing */
        @media print {
          .no-print {
            display: none !important;
          }
          /* First, hide everything on the page */
          body * {
            visibility: hidden !important;
          }
          /* Then make only the report container visible and printable */
          #a4-page, #a4-page * {
            visibility: visible !important;
          }
          /* Ensure the report sits inside the page margins at the top-left for printing */
          #a4-page {
            position: absolute !important;
            left: 1mm !important; /* reduced left margin */
            top: 1mm !important;
          }
          body, html {
            width: 210mm;
            height: auto;
            margin: 0;
            padding: 0;
            background: white;
          }
          /* Frame the report inside the printable area and respect page margins */
          #a4-page {
            width: calc(210mm - 1mm) !important; /* page width minus left+right margins (1mm each) */
            min-height: calc(297mm - 1mm) !important; /* page height minus top+bottom margins (1mm each) */
            max-width: calc(210mm - 1mm) !important;
            box-sizing: border-box;
            background: white;
            margin: 0 auto;
            padding: 5mm !important;
            border: 1px solid #000 !important; /* printed frame */
            box-shadow: none !important;
          }

          /* Prevent table rows from being split across pages */
          table, tbody, tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Repeat table header on each printed page */
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }

        /* For on-screen view, keep print button visible */
        .no-print {
          display: inline-block;
        }

        /* Screen preview styling: show a framed page with subtle shadow to match preview image */
        #a4-page {
          /* Screen preview uses same reduced side margins */
          width: calc(210mm - 1mm);
          min-height: calc(297mm - 1mm);
          max-width: calc(210mm - 1mm);
          margin: 1px;
          padding: 1mm;
          box-sizing: border-box;
          background: white;
          border: 1px solid rgba(0,0,0,0.12);
          box-shadow: 0 8px 30px rgba(0,0,0,0.08);
        }

        /* Keep table width inside the framed area */
        table.report-table { width: 100%; max-width: 100%; }
      `}</style>
      {/* Print Button */}
      <div style={{ margin: '16px 0', width: '100%', display: 'flex', justifyContent: 'flex-end' }} className="no-print">
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 20px',
            fontFamily: 'Khmer OS Content',
            fontSize: '16px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '40px',
            cursor: 'pointer',
            boxShadow: '0 8px 6px rgba(110, 9, 9, 0.08)'
          }}
        >
          បោះពុម្ព
        </button>
      </div>
      <div
        id="a4-page"
        style={{
          width: '210mm',
          minHeight: '297mm',
          maxWidth: '210mm',
          margin: '0 auto',
          background: 'white',
          boxSizing: 'border-box',
          padding: '0px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}
      >
        {/* Header (left / center / right) */}
  <div className="mb-1 flex justify-between items-start w-full" style={{ position: 'relative' }}>
          {/* Left-aligned ministry info */}
          <div style={{ minWidth: '220px', marginRight: '8px', marginTop: '55px', textAlign: 'left' }}>
            <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '15px', marginBottom: '4px' }}>ក្រសួងសុខាភិបាល</div>
            <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '14px', marginBottom: '4px' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
            <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '13px' }}>ផ្នែក</div>
          </div>

          {/* Centered header block (absolutely centered within header row) */}
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', margin: '0px', fontFamily: 'Khmer OS Muol Light', top: '8px', zIndex: 2 }}>
            <div className="font-normal" style={{ fontSize: '17px', padding:'5px 0'}}>ព្រះរាជាណាចក្រកម្ពុជា</div>
            <div className="font-normal" style={{ fontSize: '16px' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
            <div style={{position:'relative', textAlign:'left', padding:'10px 0'}}>
                          {/* background image behind the text */}
                          <img src={headerBg} alt="" aria-hidden="true"
                               style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', width:'150px', height:'auto', opacity:88, pointerEvents:'none'}} />
                           </div>
            <div className="font-normal text-lg" style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '13px', marginTop: '35px' }}>របាយការណ៍វត្តមានប្រចាំថ្ងៃ</div>
          </div>

          {/* Right-aligned small number */}
          <div className="text-right w-16" style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '14px', marginTop: '20px' }}>33</div>
        </div>
    {/* Table */}
  <div style={{ width: '100%', marginTop: '7mm' }}>
          <table className="border border-black text-center text-sm" style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '210mm', margin: '0 auto' }}>
            <thead>
              <tr className="bg-white">
                <th className="border border-black px-2 py-1" style={{ width: '10mm' }}>ល.រ</th>
                <th className="border border-black px-2 py-1" style={{ width: '80mm' }}>គោត្តនាម និងនាម</th>
                <th className="border border-black px-2 py-1" style={{ width: '5mm' }}>ភេទ</th>
                <th className="border border-black px-2 py-1" style={{ width: '25mm' }}>ប្រភេទមន្រ្តី</th>
                <th className="border border-black px-2 py-1" style={{ width: '100mm' }}>តួនាទី</th>
                <th className="border border-black px-2 py-1" style={{ width: '25mm' }}>ម៉ោងចូល-ចេញ</th>
                <th className="border border-black px-2 py-1" style={{ width: '20mm', padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'break-word' }}>មកយឺត</th>
                <th className="border border-black px-2 py-1" style={{ width: '20mm', padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'break-word' }}>ចេញមុន</th>
                <th className="border border-black px-2 py-1" style={{ width: '40mm' }}>លិខិតបញ្ជាក់</th>
                <th className="border border-black px-2 py-1" style={{ width: '40mm' }}>ផ្សេងៗ</th>
              </tr>
            </thead>
            <tbody>
              {sampleData.map((row, idx) => (
                <tr key={idx} className="bg-white">
                  <td className="border border-black px-2 py-1">{idx + 1}</td>
                  <td className="border border-black px-2 py-1">{row.name}</td>
                  <td className="border border-black px-2 py-1">{row.gender}</td>
                  <td className="border border-black px-2 py-1">{row.id}</td>
                  <td className="border border-black px-2 py-1">{row.position}</td>
                  <td className="border border-black px-2 py-1">{row.department}</td>
                  <td className="border border-black px-2 py-1" style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.dob}</td>
                  <td className="border border-black px-2 py-1" style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.startDate}</td>
                  <td className="border border-black px-2 py-1" style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.endDate}</td>
                  <td className="border border-black px-2 py-1">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Notes and summary below table */}
        <div className="mt-4 w-full flex flex-col items-start text-sm" style={{ fontFamily: 'Khmer OS Content', textAlign: 'center' }}>
          <div className="mb-2">សម្គាល់៖ ចំនួនអ្នកមកធ្វើការត្រឹមពេលកំណត់៖ ៣ នាក់</div>
          
          <div className="flex justify-between w-full mt-4">
            <div>នាយផ្នែក</div>
            <div style={{ fontFamily:'Khmer OS Muol Light' }}>នាយផ្នែក</div>
          </div>
          <div className="flex justify-between w-full mt-2">
            <div>ប្រធានក្រុមការងារ</div>
            <div>ប្រធានក្រុមការងារ និងមន្រ្តី</div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DailyAttendanceReport;
