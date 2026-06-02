import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import ExcelRibbon from '../components/ExcelRibbon';

export default function PayrollPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  // Spreadsheet functionality state
  const [selection, setSelection] = useState(null); // { r1, c1, r2, c2 }
  const [isDragging, setIsDragging] = useState(false);
  const [cellStyles, setCellStyles] = useState({});
  const [cellEdits, setCellEdits] = useState({});
  const [colWidths, setColWidths] = useState({});
  const [mergedCells, setMergedCells] = useState({});
  const [hiddenCells, setHiddenCells] = useState(new Set());

  useEffect(() => {
    const fetchPayroll = async () => {
      try {
        setLoading(true);
        // Uses the Vite proxy in development or relative path in production
        const response = await axios.get('/api/payroll');
        setData(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching payroll:', err);
        setError(err.response?.data?.error || 'មានបញ្ហាក្នុងការទាញយកទិន្នន័យ។');
      } finally {
        setLoading(false);
      }
    };
    fetchPayroll();
  }, []);

  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDragging(false);
    document.addEventListener('mouseup', handleMouseUpGlobal);
    return () => document.removeEventListener('mouseup', handleMouseUpGlobal);
  }, []);

  const getColumnName = (index) => {
    let name = '';
    let i = index;
    while (i >= 0) {
      name = String.fromCharCode(65 + (i % 26)) + name;
      i = Math.floor(i / 26) - 1;
    }
    return name;
  };

  const getColumnStyle = (index) => {
    if (colWidths[index]) {
      return { minWidth: colWidths[index], width: colWidths[index], maxWidth: colWidths[index] };
    }
    // Custom widths for specific columns (A=0, B=1, C=2, D=3...)
    switch (index) {
      case 0: return { minWidth: 40, width: 40, maxWidth: 40 };   // A
      case 1: return { minWidth: 110, width: 110, maxWidth: 110 };  // B
      case 2: return { minWidth: 100, width: 100, maxWidth: 100 };  // C
      case 3: return { minWidth: 30, width: 30, maxWidth: 30 };  // D
      default: return {}; // Fit content
    }
  };

  const handleResizeStart = (e, colIndex) => {
    e.preventDefault();
    const startX = e.pageX;
    const th = e.target.closest('th');
    const startWidth = th.getBoundingClientRect().width;

    const handleMouseMove = (moveEvent) => {
      const newWidth = Math.max(20, startWidth + (moveEvent.pageX - startX));
      setColWidths(prev => ({ ...prev, [colIndex]: newWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  let maxCols = 0;
  let currentData = [];
  let totalRows = 0;
  let totalPages = 0;

  if (data && data.data) {
    maxCols = Math.max(...data.data.map(r => r.length), 0);
    totalRows = data.data.length;
    totalPages = Math.ceil(totalRows / limit);
    const startIndex = (page - 1) * limit;
    currentData = data.data.slice(startIndex, startIndex + limit);
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  const handleCellEdit = (row, col, value) => {
    setCellEdits(prev => ({ ...prev, [`${row}-${col}`]: value }));
  };

  const handleToggleStyle = (styleProp, value) => {
    if (!selection) return;
    const minR = Math.min(selection.r1, selection.r2);
    const maxR = Math.max(selection.r1, selection.r2);
    const minC = Math.min(selection.c1, selection.c2);
    const maxC = Math.max(selection.c1, selection.c2);

    setCellStyles(prev => {
      const nextStyles = { ...prev };
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const key = `${r}-${c}`;
          const current = nextStyles[key] || {};
          if (value !== undefined) {
            nextStyles[key] = { ...current, [styleProp]: value };
          } else {
            nextStyles[key] = { ...current, [styleProp]: !current[styleProp] };
          }
        }
      }
      return nextStyles;
    });
  };

  const handleMerge = () => {
    if (!selection) return;
    const minR = Math.min(selection.r1, selection.r2);
    const maxR = Math.max(selection.r1, selection.r2);
    const minC = Math.min(selection.c1, selection.c2);
    const maxC = Math.max(selection.c1, selection.c2);
    
    const rootKey = `${minR}-${minC}`;
    const rowSpan = maxR - minR + 1;
    const colSpan = maxC - minC + 1;
    
    if (rowSpan === 1 && colSpan === 1) return;

    if (mergedCells[rootKey] && mergedCells[rootKey].rowSpan === rowSpan && mergedCells[rootKey].colSpan === colSpan) {
      // Unmerge
      const newMerged = { ...mergedCells };
      delete newMerged[rootKey];
      setMergedCells(newMerged);
      
      const newHidden = new Set(hiddenCells);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (r === minR && c === minC) continue;
          newHidden.delete(`${r}-${c}`);
        }
      }
      setHiddenCells(newHidden);
      return;
    }

    // Merge
    setMergedCells(prev => ({ ...prev, [rootKey]: { rowSpan, colSpan } }));
    
    const newHidden = new Set(hiddenCells);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r === minR && c === minC) continue;
        newHidden.add(`${r}-${c}`);
      }
    }
    setHiddenCells(newHidden);
    handleToggleStyle('align', 'center'); // Auto center on merge
  };

  const handleSave = async () => {
    if (Object.keys(cellEdits).length === 0) {
      alert('មិនមានទិន្នន័យថ្មីត្រូវរក្សាទុកទេ។');
      return;
    }
    
    try {
      setLoading(true);
      await axios.post('/api/payroll/save', { edits: cellEdits });
      alert('ទិន្នន័យត្រូវបានរក្សាទុកដោយជោគជ័យចូលទៅក្នុងឯកសារ Excel!');
      setCellEdits({}); // clear edits after save
    } catch (err) {
      console.error('Save failed:', err);
      alert('បរាជ័យក្នុងការរក្សាទុកទិន្នន័យ។');
    } finally {
      setLoading(false);
    }
  };

  const getCellStyle = (row, col) => {
    const style = cellStyles[`${row}-${col}`] || {};
    return {
      fontWeight: style.bold ? 'bold' : undefined,
      fontStyle: style.italic ? 'italic' : undefined,
      textDecoration: style.underline ? 'underline' : undefined,
      textAlign: style.align || undefined,
      backgroundColor: style.bg || undefined,
      color: style.color || undefined,
      whiteSpace: style.wrapText ? 'normal' : 'nowrap',
    };
  };

  const activeStyles = selection ? (cellStyles[`${selection.r1}-${selection.c1}`] || {}) : {};

  return (
    <div className="p-0 h-full flex flex-col bg-gray-50/50 print:bg-white print:h-auto">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="print:hidden">
        <ExcelRibbon onToggleStyle={handleToggleStyle} activeStyles={activeStyles} onMerge={handleMerge} onSave={handleSave} />
      </div>
      
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#107C41]" />
            {data?.filename || 'តារាងបៀវត្សន៍'}
          </h1>
        </div>
        
        {data && data.data && (
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded shadow-sm border border-gray-200">
            <label className="text-xs text-gray-600 font-medium">បង្ហាញ:</label>
            <select
              value={limit}
              onChange={handleLimitChange}
              className="border border-gray-300 rounded text-xs py-1 pl-2 pr-6 focus:ring-[#107C41] focus:border-[#107C41] outline-none"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span className="text-xs text-gray-500">ជួរ</span>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white shadow-sm border-t border-gray-200 overflow-hidden flex flex-col mx-6 mb-6 print:mx-0 print:border-none print:shadow-none print:overflow-visible">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3 print:hidden">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p>កំពុងទាញយកទិន្នន័យ...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500 p-6 text-center print:hidden">
            <AlertCircle className="w-12 h-12 mb-3 text-red-400" />
            <p className="text-lg font-medium">{error}</p>
            <p className="text-sm text-gray-500 mt-2">សូមប្រាកដថាឯកសារ D:\Gitdb\PAYROLL_MOH_CENTRAL_April2026.xlsx មានពិតប្រាកដ។</p>
          </div>
        ) : data && data.data && data.data.length > 0 ? (
          <div className="flex-1 overflow-auto custom-scrollbar relative print:overflow-visible">
            <table className="w-full text-sm text-left border-collapse border border-gray-300 print:text-black print:border-black">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-20 shadow-sm print:static print:bg-white print:text-black">
                <tr>
                  <th className="px-4 py-2 border border-gray-300 w-12 text-center bg-gray-200 print:bg-white print:border-black">#</th>
                  {Array.from({ length: maxCols }).map((_, index) => (
                    <th key={index} className="px-4 py-2 font-medium border border-gray-300 text-center relative whitespace-nowrap bg-gray-100 print:bg-white print:border-black" style={getColumnStyle(index)}>
                      {getColumnName(index)}
                      <div 
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-400 z-30 print:hidden"
                        onMouseDown={(e) => handleResizeStart(e, index)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, index) => {
                  const actualRowIndex = (page - 1) * limit + index;
                  const isBold = actualRowIndex === 2 || actualRowIndex === 3; // Row 3 and Row 4
                  return (
                    <tr key={actualRowIndex} className={`hover:bg-blue-50/50 transition-colors print:bg-white ${isBold ? 'font-bold text-black' : ''}`}>
                      <td className="px-4 py-2 border border-gray-300 text-center text-gray-700 bg-gray-50 sticky left-0 z-1 font-medium print:static print:bg-white print:border-black">
                        {actualRowIndex + 1}
                      </td>
                      {Array.from({ length: maxCols }).map((_, colIndex) => {
                        const cellKey = `${actualRowIndex}-${colIndex}`;
                        if (hiddenCells.has(cellKey)) return null;

                        const mergeProps = mergedCells[cellKey] || {};
                        let isSelected = false;
                        if (selection) {
                          const minR = Math.min(selection.r1, selection.r2);
                          const maxR = Math.max(selection.r1, selection.r2);
                          const minC = Math.min(selection.c1, selection.c2);
                          const maxC = Math.max(selection.c1, selection.c2);
                          isSelected = actualRowIndex >= minR && actualRowIndex <= maxR && colIndex >= minC && colIndex <= maxC;
                        }

                        const defaultVal = row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : '';
                        const val = cellEdits[cellKey] !== undefined ? cellEdits[cellKey] : defaultVal;
                        
                        return (
                          <td 
                            key={colIndex} 
                            rowSpan={mergeProps.rowSpan || 1}
                            colSpan={mergeProps.colSpan || 1}
                            onMouseDown={() => {
                              setIsDragging(true);
                              setSelection({ r1: actualRowIndex, c1: colIndex, r2: actualRowIndex, c2: colIndex });
                            }}
                            onMouseEnter={() => {
                              if (isDragging) {
                                setSelection(prev => ({ ...prev, r2: actualRowIndex, c2: colIndex }));
                              }
                            }}
                            className={`px-4 py-2 border outline-none print:border-black
                                      ${isSelected ? 'border-2 border-[#107C41] bg-blue-50/30 z-10 print:border print:bg-transparent' : 'border-gray-300'}
                                      focus:bg-white overflow-hidden text-ellipsis`}
                            style={{ ...getCellStyle(actualRowIndex, colIndex), ...(mergeProps.colSpan > 1 ? {} : getColumnStyle(colIndex)) }}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleCellEdit(actualRowIndex, colIndex, e.target.innerText)}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            មិនមានទិន្នន័យបង្ហាញទេ។
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.data && totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between print:hidden">
            <div className="text-sm text-gray-500">
              កំពុងបង្ហាញ {((page - 1) * limit) + 1} ដល់ {Math.min(page * limit, totalRows)} នៃ {totalRows} ជួរ
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ថយក្រោយ
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                បន្ទាប់
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
