import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

function toKhmerDigits(n) { const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩']; return String(n).replace(/[0-9]/g, d => map[d]); }
const khContains = (text, keywordList) => { if (!text) return false; const s = String(text).toLowerCase(); return keywordList.some(k => s.includes(k)); };
function fmtDateSlash(d) { if (!d) return ''; const dt = new Date(d); if (isNaN(dt.getTime())) return ''; return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`; }
function fmtKhmerLongDate(d) { if (!d) return ''; const dt = new Date(d); if (isNaN(dt.getTime())) return ''; const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ']; return `ថ្ងៃទី ${toKhmerDigits(dt.getDate())} ខែ ${khMonths[dt.getMonth()]} ឆ្នាំ ${toKhmerDigits(dt.getFullYear())}`; }

export default function MaternityLeaveReportPage() {
  const perms = usePermission();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lunarText, setLunarText] = useState('');
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');
  const printRef = useRef();
  const fileInputRef = useRef();

  const [editingHr, setEditingHr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [requestLetterFile, setRequestLetterFile] = useState(null);
  const [returnLetterFile, setReturnLetterFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState(null);
  const [activePrintTemplate, setActivePrintTemplate] = useState(null); // { type: 'app' | 'permission', hr: object }
  const [showBg, setShowBg] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!perms.canViewHR) { setLoading(false); return; }
      setLoading(true); setError('');
      try {
        const { data: hrData } = await api.get('/hr');
        const hrList = Array.isArray(hrData) ? hrData : [];

        let leaveList = [];
        try {
          const leaveRes = await api.get('/leave-requests');
          leaveList = Array.isArray(leaveRes.data) ? leaveRes.data : [];
        } catch (err) {
          console.error('Failed to fetch leave requests:', err);
        }

        const matLeaves = leaveList.filter(l =>
          (String(l.type || '').toLowerCase().includes('maternity') || String(l.type || '').includes('មាតុភាព'))
          && l.status === 'approved'
        );

        if (!mounted) return;

        // Merge data
        const mergedList = hrList.map(h => {
          const leave = matLeaves.find(l => l.staffId === h.staffId);
          let mat = h.maternity || {};
          if (leave && (!h.maternity || !h.maternity.startDate)) {
            mat = {
              startDate: leave.startDate || leave.date,
              endDate: leave.endDate,
              reason: leave.reason || 'ឈប់សម្រាកមាតុភាព',
            };
          }

          // Apply heuristic fix for reversed dates
          if (mat.startDate && mat.endDate) {
            const s = new Date(mat.startDate);
            const e = new Date(mat.endDate);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s > e) {
              const s2 = new Date(s);
              s2.setFullYear(e.getFullYear() - 1);
              if (s2 < e) {
                mat.startDate = s2.toISOString().slice(0, 10);
              }
            }
          }

          return { ...h, maternity: mat };
        });

        setList(mergedList);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [perms.canViewHR]);

  const derived = useMemo(() => {
    const keywords = ['មាតុភាព', 'សម្រាកពល产', 'សម្រាកសម្រាល', 'សម្រាកពោះ'];
    const rows = (list || [])
      .filter(hr => {
        const mat = hr.maternity || {};
        const hasMaternityData = !!(mat.startDate || mat.endDate);
        const reasonMatches = khContains(hr.civilServantReason, keywords);

        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const blob = [
            hr.staffId, hr.STAFFID, hr.staffID, hr.no,
            hr.NAMEKHMER, hr.nameKhmer, hr.khmerName, hr.name,
            hr.civilServantReason, hr.Department_Kh, hr.department
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return blob.includes(q);
        }

        return reasonMatches || hasMaternityData;
      })
      .filter(hr => (dept ? (hr.Department_Kh || '').trim() === dept.trim() : true))
      .sort((a, b) => (a.no || 0) - (b.no || 0));
    const male = rows.filter(r => r.gender === 'Male').length;
    const female = rows.filter(r => r.gender === 'Female').length;
    const departments = Array.from(new Set((list || []).map(x => (x.Department_Kh || '').trim()).filter(Boolean)));
    return { rows, male, female, total: rows.length, departments };
  }, [list, dept, search]);

  const SCREEN_CSS = `.print-scope { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; } .print-scope th, .print-scope td { border: 1px solid #e6dbdbff; padding: 4px 6px; font-size: 12px; } .print-scope th { background: #f3f4f6; } .center { text-align: center; }`;

  const handlePrint = () => {
    if (!lunarText.trim()) { window.alert('សូមបំពេញ "ចន្ទគតិ" មុនបោះពុម្ព'); return; }
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const PRINT_STYLES = `<style>@page { size: A4 landscape; margin: 12mm; } @media print { html, body { width: 297mm; height: 210mm; } } body { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; -webkit-print-color-adjust: exact; print-color-adjust: exact; } table { width: 100%; border-collapse: collapse; } thead { display: table-header-group; } tr, td, th { page-break-inside: avoid; } th, td { border: 1px solid #222; padding: 4px 6px; font-size: 12px; } th { background: #f3f4f6; } .center { text-align: center; }</style>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/>${PRINT_STYLES}</head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const getApplicationHtml = (hr, showBg = true) => {
    const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    const fmtDateKhmer = (dateStr) => {
      if (!dateStr) return '......';
      const d = new Date(dateStr);
      if (isNaN(d)) return '......';
      return `${toKhmerDigits(d.getDate())} ខែ${khMonths[d.getMonth()]} ឆ្នាំ${toKhmerDigits(d.getFullYear())}`;
    };

    const mat = hr.maternity || {};

    return `
      <style>
        @page { size: A4 portrait; margin: 0; }
        body { font-family: "Khmer OS Siemreap", Arial, sans-serif; font-size: 14px; color:#111; background: #f0f2f5; }
        @media print {
          .no-print { display: none !important; }
          .a4-page { margin: 0 auto !important; box-shadow: none !important; border: none !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .a4-page { background: white; }
      </style>
      <div class="a4-page" style="width: 210mm; min-height: 297mm; padding: 20mm; background: white; ${showBg ? `background-image: url('/Uploads/miss.png'); background-repeat: no-repeat; background-position: center; background-size: 100% 100%;` : ''} box-sizing: border-box; margin: 20px auto; box-shadow: 0 0 10px rgba(0,0,0,0.1); position: relative;">
        <div style="margin-top: 190px;"> <!-- Push content down -->
          <div style="width: 100%; text-align: center;">
        <div style="font-family: 'Khmer OS Muol Light', serif; font-size: 16px;">ព្រះរាជាណាចក្រកម្ពុជា</div>
        <div style="font-family: 'Khmer OS Muol Light', serif; font-size: 14px;">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
        <div style="text-align: center; margin-top: 5px;"><img src="/3.JPG" style="width: 150px; height: auto; display: block; margin: 0 auto;" alt=""/></div>
      </div>
      
      <div style="text-align: center; margin-top: 25px; font-family: 'Khmer OS Muol Light', serif; font-size: 18px;">ពាក្យសុំអនុញ្ញាតច្បាប់</div>
      
      <div style="margin-top: 18px; line-height: 1.8;">
        នាងខ្ញុំឈ្មោះ <b>${hr.khmerName || hr.name || '......'}</b> ភេទស្រី កើតនៅថ្ងៃទី <b>${fmtDateKhmer(hr.dob)}</b><br/>
        អាសយដ្ឋានបច្ចុប្បន្ន: <b>${hr.currentPlace || '......'}</b><br/>
        មុខជំនាញបច្ចេកទេស: <b>${hr.civilServantRole || hr.position || '......'}</b> អត្តលេខ: <b>${hr.staffId || hr.no || '......'}</b><br/>
        បម្រើការងារនៅ: <b>${hr.Department_Kh || '......'}</b> នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត។
      </div>
      
      <div style="margin-top: 20px; line-height: 1.8;">
        <div style="display: grid; grid-template-columns: 100px 1fr;">
          <div style="font-family: 'Khmer OS Muol Light', serif;">គោរពជូន:</div>
          <div><b>ឯកឧត្តមសាស្ត្រាចារ្យរដ្ឋមន្ត្រីក្រសួងសុខាភិបាល</b></div>
        </div>
        <div style="display: grid; grid-template-columns: 100px 1fr;">
          <div style="font-family: 'Khmer OS Muol Light', serif;">តាមរយៈ:</div>
          <div><b>លោកនាយកមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</b></div>
        </div>
        <div style="display: grid; grid-template-columns: 100px 1fr;">
          <div style="font-family: 'Khmer OS Muol Light', serif;">កម្មវត្ថុ:</div>
          <div><b>សំណើសុំអនុញ្ញាតច្បាប់ឈប់សម្រាក ចំនួន ៣ខែ</b></div>
        </div>
        <div style="display: grid; grid-template-columns: 100px 1fr;">
          <div style="font-family: 'Khmer OS Muol Light', serif;">មូលហេតុ:</div>
          <div><b>${mat.reason || 'ឈប់សម្រាកមាតុភាព'}</b></div>
        </div>
      </div>
      
      <div style="margin-top: 20px; text-align: justify; line-height: 1.8;">
        សេចក្តីដូចបានជម្រាបជូនក្នុងវត្ថុ និងមូលហេតុខាងលើ នាងខ្ញុំសូម <b>ឯកឧត្តមសាស្ត្រាចារ្យរដ្ឋមន្ត្រី</b> មេត្តាពិនិត្យ និងអនុញ្ញាតច្បាប់ឱ្យនាងខ្ញុំបានឈប់សម្រាកមាតុភាព ចំនួន៣ខែ ចាប់ពីថ្ងៃទី <b>${fmtDateKhmer(mat.startDate)}</b> ដល់ថ្ងៃទី <b>${fmtDateKhmer(mat.endDate)}</b> នេះតទៅ។
      </div>
      
      <div style="margin-top: 20px; text-align: justify; line-height: 1.8;">
        អាស្រ័យដូចបានជម្រាបជូនខាងលើ សូម <b>ឯកឧត្តមសាស្ត្រាចារ្យរដ្ឋមន្ត្រី</b> មេត្តាពិនិត្យ និងអនុញ្ញាតច្បាប់ឱ្យនាងខ្ញុំ ដោយសេចក្តីអនុគ្រោះ។
      </div>
      
      <div style="text-align: right; margin-top: 10px; line-height: 1.8;">
        សូម <b>ឯកឧត្តមសាស្ត្រាចារ្យរដ្ឋមន្ត្រី</b> មេត្តាទទួលនូវការគោរពដ៏ខ្ពង់ខ្ពស់អំពីនាងខ្ញុំ។
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 40px; line-height: 1.8;">
        <div style="width: 45%;">
          <div>បានឃើញ និងគោរពជូន</div>
          <div style="font-family: 'Khmer OS Muol Light', serif;">ឯកឧត្តមសាស្ត្រាចារ្យរដ្ឋមន្ត្រី</div>
          <div>មេត្តាពិនិត្យ និងសម្រេច</div>
          <div>ដោយក្តីអនុគ្រោះ</div>
          <div style="height: 80px;"></div>
          <div style="font-family: 'Khmer OS Muol Light', serif;">សាស្ត្រាចារ្យ ងី ម៉េង</div>
        </div>
        <div style="width: 45%; text-align: right;">
          <div>រាជធានីភ្នំពេញ ថ្ងៃទី... ខែ... ឆ្នាំ...</div>
          <div style="font-family: 'Khmer OS Muol Light', serif; text-align: center;">ហត្ថលេខាសាមីខ្លួន</div>
          <div style="height: 80px;"></div>
          <div style="font-family: 'Khmer OS Muol Light', serif; text-align: center;">${hr.khmerName || hr.name || '......'}</div>
        </div>
      </div>
      </div>
      </div>
      </div>
    `;
  };

  const getContractPermissionHtml = (hr, showBg = true) => {
    const fmtDateKhmer = (dateStr) => {
      if (!dateStr) return '......';
      const d = new Date(dateStr);
      if (isNaN(d)) return '......';
      const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
      return `${toKhmerDigits(d.getDate())} ខែ${khMonths[d.getMonth()]} ឆ្នាំ${toKhmerDigits(d.getFullYear())}`;
    };

    const fmtDateSlash = (dateStr) => {
      if (!dateStr) return '......';
      const d = new Date(dateStr);
      if (isNaN(d)) return '......';
      return `${toKhmerDigits(d.getDate())}/${toKhmerDigits(d.getMonth() + 1)}/${toKhmerDigits(d.getFullYear())}`;
    };

    const mat = hr.maternity || {};
    const year = mat.startDate ? new Date(mat.startDate).getFullYear() : new Date().getFullYear();
    const khmerYear = toKhmerDigits(year);

    let days = '៩០';
    if (mat.startDate && mat.endDate) {
      const start = new Date(mat.startDate);
      const end = new Date(mat.endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      days = toKhmerDigits(diffDays);
    }

    return `
      <style>
        @page { size: A4 portrait; margin: 0; }
        body { font-family: "Khmer OS Siemreap", Arial, sans-serif; font-size: 16px; color:#111; background: #f0f2f5; }
        @media print {
          .no-print { display: none !important; }
          .a4-page { margin: 0 auto !important; box-shadow: none !important; border: none !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .a4-page { background: white; }
      </style>
      <div class="a4-page" style="width: 210mm; min-height: 297mm; padding: 25mm; background: white; ${showBg ? `background-image: url('/Uploads/miss.png'); background-repeat: no-repeat; background-position: center; background-size: 100% 100%;` : ''} box-sizing: border-box; margin: 20px auto; box-shadow: 0 0 10px rgba(0,0,0,0.1); position: relative;">
        <div style="margin-top: 200px;"> <!-- Push content down -->
          <div style="text-align: center; margin-top: 18px;">    
        <div style="font-family: 'Khmer OS Muol Light', serif; font-size: 20px;">លិខិតអនុញ្ញាត</div>
        <div style="text-align: center; margin-top: 5px;"><img src="/3.JPG" style="width: 150px; height: auto; display: block; margin: 0 auto;" alt=""/></div>
      </div>
      
      <div style="margin-top: 30px; margin-left: 50px; line-height: 2.5; font-size: 16px;">
        <div style="display: grid; grid-template-columns: 200px 10px 1fr;">
          <div style="font-weight: bold;">បានអនុញ្ញាតឲ្យ</div>
          <div>:</div>
          <div><b>${hr.khmerName || hr.name || '......'}</b></div>
        </div>
        <div style="display: grid; grid-template-columns: 200px 10px 1fr;">
          <div style="font-weight: bold;">មន្ត្រី</div>
          <div>:</div>
          <div><b>កិច្ចសន្យា</b></div>
        </div>
        <div style="display: grid; grid-template-columns: 200px 10px 1fr;">
          <div style="font-weight: bold;">មុខងារជា</div>
          <div>:</div>
          <div><b>${hr.civilServantRole || hr.position || '......'}</b></div>
        </div>
        <div style="display: grid; grid-template-columns: 200px 10px 1fr;">
          <div style="font-weight: bold;">បម្រើការនៅ</div>
          <div>:</div>
          <div><b>${hr.Department_Kh || '......'}</b></div>
        </div>
        <div style="display: grid; grid-template-columns: 200px 10px 1fr;">
          <div style="font-weight: bold;">ឈប់សម្រាកការងារចំនួន</div>
          <div>:</div>
          <div><b>${days === '៩២' || days === '៩០' || days === '៩១' ? '៣ ខែ' : `${days} ថ្ងៃ`} ចាប់ពីថ្ងៃទី ${fmtDateSlash(mat.startDate)} ដល់ថ្ងៃទី ${fmtDateSlash(mat.endDate)}</b></div>
        </div>
        <div style="display: grid; grid-template-columns: 200px 10px 1fr;">
          <div style="font-weight: bold;">មូលហេតុ</div>
          <div>:</div>
          <div><b>${mat.reason || 'ឈប់សម្រាកមាតុភាព'}</b></div>
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 100px; line-height: 1.8;">
        <div style="width: 45%; font-size: 14px;">
          <div style="font-family: 'Khmer OS Muol Light', serif; text-decoration: underline;">ចម្លងជូន:</div>
          <div>- ការិយាល័យបច្ចេកទេស</div>
          <div>- ការិយាល័យហិរញ្ញវត្ថុ</div>
          <div>- ផ្នែកពាក់ព័ន្ធ (ដើម្បីជ្រាបជាព័ត៌មាន)</div>
          <div>- សាមីខ្លួន (អនុវត្ត)</div>
          <div>- ឯកសារ-កាលប្បវត្តិ</div>
        </div>
        <div style="width: 45%; text-align: center; margin-top: -70px;">
          <div style="font-family: 'Khmer OS Muol Light', serif; font-size: 18px;">នាយកមន្ទីរពេទ្យ</div>
          <div style="height: 100px;margin-top: 100px;"></div>
          <div style="font-size: 12px; color: #555; ">ឆ្នាំ${khmerYear} មិនមានសុំច្បាប់ឈប់សម្រាក។</div>
        </div>
      </div>
      </div>
      </div>
      </div>
    `;
  };

  const handleExportExcel = () => {
    const header = ['ល.រ', 'អត្តលេខមន្រ្តីរាជការ', 'គោត្តនាម-នាម', 'ភេទ', 'ថ្ងៃខែឆ្នាំកំណើត', 'ផ្នែក', 'មុខងារ', 'កាំប្រាក់', 'មូលហេតុ', 'ថ្ងៃចាប់ផ្តើម', 'ថ្ងៃបញ្ចប់'];
    const data = derived.rows.map((hr, idx) => {
      const mat = hr.maternity || {};
      return [
        idx + 1,
        hr.staffId || hr.no || '',
        hr.khmerName || hr.name || '',
        hr.gender === 'Male' ? 'ប' : hr.gender === 'Female' ? 'ស' : '',
        fmtDateSlash(hr.dob),
        hr.Department_Kh || '',
        hr.civilServantRole || hr.position || '',
        hr.salaryLevel || '',
        hr.civilServantReason || '',
        fmtDateSlash(mat.startDate),
        fmtDateSlash(mat.endDate)
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 28 }, { wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `MaternityLeave`);
    XLSX.writeFile(wb, `Maternity_Leave.xlsx`);
  };

  const openEdit = (hr) => {
    const mat = hr.maternity || {};
    setEditingHr({ ...hr, maternity: { ...(mat || {}) } });
  };

  const closeEdit = () => {
    setEditingHr(null);
    setSelectedFile(null);
    setRequestLetterFile(null);
    setReturnLetterFile(null);
    setSelectedPreviewUrl(null);
  };

  const handleEditChange = (field, value) => {
    setEditingHr(prev => {
      const matPrev = (prev && prev.maternity) ? { ...prev.maternity } : {};
      const nextMat = { ...matPrev, [field]: value };

      if (field === 'startDate' && value) {
        const st = new Date(value);
        if (!isNaN(st.getTime())) {
          const end = new Date(st);
          end.setMonth(end.getMonth() + 3);
          nextMat.endDate = end.toISOString().slice(0, 10);
        }
      }

      return { ...prev, maternity: nextMat };
    });
  };

  const handleFileSelect = (file) => {
    try { if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); } } catch (e) { }
    if (!file) {
      setSelectedFile(null);
      setSelectedPreviewUrl(null);
      return;
    }
    setSelectedFile(file);
    try {
      const url = URL.createObjectURL(file);
      setSelectedPreviewUrl(url);
    } catch (e) {
      setSelectedPreviewUrl(null);
    }
  };

  const handleUploadSpecificFile = async (file) => {
    if (!file) return null;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': undefined } });
      if (data && data.url) return data.url;
      return null;
    } catch (err) {
      window.alert('Upload failed: ' + (err?.response?.data?.error || err.message || 'Error'));
      return null;
    }
  };

  const handleSaveEdit = async () => {
    if (!editingHr) return;

    setSaving(true);
    try {
      let uploadedUrl = null;
      if (selectedFile) {
        setUploadingFile(true);
        uploadedUrl = await handleUploadSpecificFile(selectedFile);
        setUploadingFile(false);
        if (!uploadedUrl) { setSaving(false); return; }
      }

      let requestLetterUrl = editingHr.maternity?.requestLetterUrl;
      let returnLetterUrl = editingHr.maternity?.returnLetterUrl;

      if (requestLetterFile) {
        const url = await handleUploadSpecificFile(requestLetterFile);
        if (url) requestLetterUrl = url;
      }
      if (returnLetterFile) {
        const url = await handleUploadSpecificFile(returnLetterFile);
        if (url) returnLetterUrl = url;
      }

      const id = editingHr._id || editingHr.no || editingHr.staffId;
      const matPayload = {
        ...(editingHr.maternity || {}),
        requestLetterUrl,
        returnLetterUrl
      };
      if (uploadedUrl) matPayload.image = uploadedUrl;

      const { data } = await api.put(`/hr/${id}`, { maternity: matPayload });

      // Create a leave request in /leave-requests
      try {
        await api.post('/leave-requests', {
          name: editingHr.khmerName || editingHr.name,
          staffId: editingHr.staffId,
          department: editingHr.Department_Kh || editingHr.position,
          startDate: matPayload.startDate,
          endDate: matPayload.endDate,
          type: 'Maternity Leave',
          reason: matPayload.reason || 'ឈប់សម្រាកមាតុភាព',
          status: 'approved',
          amount: 90,
          date: matPayload.startDate, // Legacy field support
          requestLetterUrl: matPayload.requestLetterUrl,
          returnLetterUrl: matPayload.returnLetterUrl,
        });
      } catch (err) {
        console.error('Failed to sync to leave requests:', err);
      }

      setList(prev => prev.map(h => {
        if (h._id === id || h.staffId === id || h.no === id) {
          return { ...h, maternity: matPayload };
        }
        return h;
      }));
      closeEdit();
    } catch (err) {
      window.alert('រក្សាទុកបរាជ័យ: ' + (err?.response?.data?.message || err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const printIframe = (htmlContent) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  if (activePrintTemplate) {
    const html = activePrintTemplate.type === 'app'
      ? getApplicationHtml(activePrintTemplate.hr, showBg)
      : getContractPermissionHtml(activePrintTemplate.hr, showBg);

    return (
      <div className="p-4 bg-gray-100 min-h-screen">
        <div className="mb-4 flex justify-between items-center no-print">
          <button onClick={() => setActivePrintTemplate(null)} className="px-4 py-2 bg-gray-500 text-white rounded">ត្រឡប់ក្រោយ (Back)</button>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 cursor-pointer text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={showBg}
                onChange={(e) => setShowBg(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              បង្ហាញ Background
            </label>
            <button onClick={() => printIframe(html)} className="px-4 py-2 bg-green-600 text-white rounded">បោះពុម្ព (Print)</button>
          </div>
        </div>
        <div
          contentEditable={true}
          style={{ outline: 'none' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">របាយការណ៍ សម្រាកមាតុភាព</h2>
          <p className="text-sm text-gray-600">បោះពុម្ពតាមគំរូ</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <label className="text-sm">ស្វែងរក (ID ឬ ឈ្មោះ):</label>
          <input
            type="text"
            className="border rounded px-2 py-1 w-48"
            placeholder="ID ឬ ឈ្មោះ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="text-sm">ផ្នែក:</label>
          <select className="border rounded px-2 py-1" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">ទាំងអស់</option>
            {Array.from(new Set((list || []).map(x => (x.Department_Kh || '').trim()).filter(Boolean))).map(d => (<option key={d} value={d}>{d}</option>))}
          </select>
          <label className="text-sm">ចន្ទគតិ*:</label>
          <input type="text" className="border rounded px-2 py-1 w-72" placeholder="ឧ. ថ្ងៃសុក្រ ១៣កើត ខែភទ្របទ ឆ្នាំ..." value={lunarText} onChange={(e) => setLunarText(e.target.value)} />
          <label className="text-sm">ថ្ងៃខែឆ្នាំ:</label>
          <input type="date" className="border rounded px-2 py-1" value={footerDate} onChange={(e) => setFooterDate(e.target.value)} />
          {(!lunarText.trim()) && <span className="text-red-600 text-xs">សូមបំពេញចន្ទគតិ</span>}
          <button className={`border px-2 py-1 rounded ${loading ? 'bg-gray-100 text-gray-300' : 'bg-green-600 text-white border-green-600'}`} onClick={handleExportExcel} disabled={loading}>Export Excel</button>
          <button className={`border px-2 py-1 rounded ${(!lunarText.trim() || loading) ? 'bg-gray-100 text-gray-300' : 'bg-blue-600 text-white border-blue-600'}`} onClick={handlePrint} disabled={!lunarText.trim() || loading}>បោះពុម្ព</button>
        </div>
      </div>

      {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}

      <div ref={printRef} className="bg-white p-4 border rounded print-scope">
        <style dangerouslySetInnerHTML={{ __html: SCREEN_CSS }} />
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '16px' }}>ព្រះរាជាណាចក្រកម្ពុជា</div>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '14px' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
          <div style={{ position: 'relative', textAlign: 'left', padding: '6px 0' }}>
            <img src={headerBg} alt="" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150px', height: 'auto', opacity: 88, pointerEvents: 'none' }} />
            <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12.5px', position: 'relative', zIndex: 1 }}>ក្រសួងសុខាភិបាល</div>
          </div>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'left' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
          <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '13px', marginTop: '4px', fontWeight: 600 }}>បញ្ជីឈ្មោះបុគ្គលិក សម្រាកមាតុភាព</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '35px' }}>ល.រ</th>
              <th style={{ width: '110px' }}>អត្តលេខមន្រ្តីរាជការ</th>
              <th>គោត្តនាម-នាម</th>
              <th style={{ width: '40px' }}>ភេទ</th>
              <th style={{ width: '110px' }}>ថ្ងៃខែឆ្នាំកំណើត</th>
              <th>ផ្នែក</th>
              <th>មុខងារ</th>
              <th>មូលហេតុ</th>
              <th style={{ width: '100px' }}>ថ្ងៃចាប់ផ្តើម</th>
              <th style={{ width: '100px' }}>ថ្ងៃបញ្ចប់</th>
              <th style={{ width: '80px' }}>រយ:ពេល</th>
              <th style={{ width: '100px' }}>ស្ថានភាព</th>
              <th style={{ width: '60px' }}>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {derived.rows.length === 0 ? (
              <tr><td colSpan={13} className="center text-gray-600">មិនមានទិន្នន័យ</td></tr>
            ) : (() => {
              const grouped = derived.rows.reduce((acc, row) => {
                const mat = row.maternity || {};
                let status = 'មិនទាន់មាន';
                if (mat.startDate && mat.endDate) {
                  const now = new Date();
                  const start = new Date(mat.startDate);
                  const end = new Date(mat.endDate);
                  if (now < start) status = 'មិនទាន់ដល់ពេល';
                  else if (now > end) status = 'បានបញ្ចប់';
                  else status = 'កំពុងសម្រាក';
                }
                if (!acc[status]) acc[status] = [];
                acc[status].push(row);
                return acc;
              }, {});

              const order = ['កំពុងសម្រាក', 'មិនទាន់ដល់ពេល', 'បានបញ្ចប់', 'មិនទាន់មាន'];
              let globalIdx = 0;

              return order.map(status => {
                const rows = (grouped[status] || []).sort((a, b) => {
                  const matA = a.maternity || {};
                  const matB = b.maternity || {};
                  const endA = matA.endDate ? new Date(matA.endDate) : new Date(0);
                  const endB = matB.endDate ? new Date(matB.endDate) : new Date(0);
                  return endA - endB;
                });
                if (rows.length === 0) return null;

                return (
                  <React.Fragment key={status}>
                    <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                      <td colSpan={12} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '13px', color: status === 'កំពុងសម្រាក' ? '#16a34a' : status === 'បានបញ្ចប់' ? '#6b7280' : '#1e40af' }}>
                        {status} ({toKhmerDigits(rows.length)})
                      </td>
                    </tr>
                    {rows.map((hr) => {
                      globalIdx++;
                      const mat = hr.maternity || {};

                      let statusText = 'មិនទាន់មាន';
                      let statusColor = 'black';
                      if (mat.startDate && mat.endDate) {
                        const now = new Date();
                        const start = new Date(mat.startDate);
                        const end = new Date(mat.endDate);

                        if (now < start) {
                          statusText = 'មិនទាន់ដល់ពេល';
                          statusColor = 'blue';
                        } else if (now > end) {
                          statusText = 'បានបញ្ចប់';
                          statusColor = 'gray';
                        } else {
                          const diffTime = end - now;
                          const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          statusText = `នៅសល់ ${toKhmerDigits(remainingDays)} ថ្ងៃ`;
                          statusColor = remainingDays <= 5 ? 'red' : 'green';
                        }
                      }

                      let totalDaysText = '';
                      let isRedRow = false;
                      if (mat.startDate && mat.endDate) {
                        const start = new Date(mat.startDate);
                        const end = new Date(mat.endDate);
                        const diffTime = end - start;
                        const totalDays = Math.abs(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                        isRedRow = totalDays < 85 || totalDays > 95;

                        if (totalDays >= 90 && totalDays <= 93) {
                          totalDaysText = '៣ ខែ';
                        } else {
                          totalDaysText = `${toKhmerDigits(totalDays)} ថ្ងៃ`;
                        }
                      }

                      return (
                        <tr key={hr._id || globalIdx} style={{ background: isRedRow ? '#fee2e2' : undefined }}>
                          <td className="center">{toKhmerDigits(globalIdx)}</td>
                          <td className="center">{hr.staffId || hr.no || ''}</td>
                          <td>{hr.khmerName || hr.name || ''}</td>
                          <td className="center">{hr.gender === 'Male' ? 'ប' : hr.gender === 'Female' ? 'ស' : ''}</td>
                          <td className="center">{fmtDateSlash(hr.dob)}</td>
                          <td>{hr.Department_Kh || ''}</td>
                          <td>{hr.civilServantRole || hr.position || ''}</td>
                          <td>{mat.reason || ''}</td>
                          <td className="center">{fmtDateSlash(mat.startDate)}</td>
                          <td className="center">{fmtDateSlash(mat.endDate)}</td>
                          <td className="center">{totalDaysText}</td>
                          <td className="center" style={{ color: statusColor, fontWeight: 600 }}>{statusText}</td>
                          <td className="center">
                            <div className="flex items-center justify-center gap-1">
                              <button className="border px-1 py-1 text-sm rounded bg-yellow-200" title="កែសម្រួល" onClick={() => openEdit(hr)}>Edit</button>
                              <button className="border px-1 py-1 text-sm rounded bg-blue-200" title="លិខិតបង្គាប់ការ ចូលធ្វើការវិញ" onClick={() => window.location.href = '/instruction-letters?template=maternity'}>💼</button>
                              <button className="border px-1 py-1 text-sm rounded bg-green-200" title="បោះពុម្ពពាក្យសុំ (មន្ត្រីរាជការ)" onClick={() => setActivePrintTemplate({ type: 'app', hr })}>📝</button>
                              <button className="border px-1 py-1 text-sm rounded bg-purple-200" title="បោះពុម្ពលិខិតអនុញ្ញាត (មន្ត្រីកិច្ចសន្យា)" onClick={() => setActivePrintTemplate({ type: 'permission', hr })}>📜</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              });
            })()}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '12px' }}>
          <div style={{ width: '33%' }}>
            <div>
              សរុប: {toKhmerDigits(derived.total)} នាក់ ( ប្រុស: {toKhmerDigits(derived.male)} នាក់ — ស្រី: {toKhmerDigits(derived.female)} នាក់ )
            </div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>បានឃើញ</div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>នាយកមន្ទីរពេទ្យ</div>
            <div style={{ height: '64px' }}></div>
            <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
          </div>
          <div style={{ width: '33%', textAlign: 'center' }}>
            <div style={{ marginTop: '16px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>បានពិនិត្យត្រឹមត្រូវ</div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក</div>
            <div style={{ height: '82px' }}></div>
            <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
          </div>
          <div style={{ width: '33%', textAlign: 'right' }}>
            <div style={{ marginTop: '12px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>
              {lunarText && lunarText.trim() ? lunarText : ''}
            </div>
            <div style={{ marginTop: '2px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>
              រាជធានីភ្នំពេញ {fmtKhmerLongDate(footerDate)}
            </div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}> អ្នកធ្វើតារាង</div>
            <div style={{ height: '82px' }}></div>
            <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingHr && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">កែសម្រួលព័ត៌មានមាតុភាព</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-blue-600 mb-1">អត្តលេខមន្រ្តីរាជការ</label>
              <input type="text" className="w-full border rounded px-3 py-2 bg-gray-50" value={editingHr.staffId || editingHr.no || ''} disabled />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">ឈ្មោះ</label>
              <input type="text" className="w-full border rounded px-3 py-2 bg-gray-100" value={editingHr.khmerName || editingHr.name || ''} disabled />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">មូលហេតុ</label>
              <select
                className="w-full border rounded px-3 py-2 mb-2"
                value={editingHr.maternity?.reason === 'ឈប់សម្រាកមាតុភាព' ? 'ឈប់សម្រាកមាតុភាព' : (editingHr.maternity?.reason ? 'ផ្សេងៗ' : '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ផ្សេងៗ') {
                    handleEditChange('reason', '');
                  } else {
                    handleEditChange('reason', val);
                  }
                }}
              >
                <option value="">-- ជ្រើសរើស --</option>
                <option value="ឈប់សម្រាកមាតុភាព">ឈប់សម្រាកមាតុភាព</option>
                <option value="ផ្សេងៗ">ផ្សេងៗ (សរសេរបន្ថែម)</option>
              </select>

              {editingHr.maternity?.reason !== 'ឈប់សម្រាកមាតុភាព' && (
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="សរសេរមូលហេតុបន្ថែម..."
                  value={editingHr.maternity?.reason || ''}
                  onChange={(e) => handleEditChange('reason', e.target.value)}
                />
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">ថ្ងៃចាប់ផ្តើម</label>
              <input type="date" className="w-full border rounded px-3 py-2" value={editingHr.maternity?.startDate ? String(editingHr.maternity.startDate).slice(0, 10) : ''} onChange={(e) => handleEditChange('startDate', e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">ថ្ងៃបញ្ចប់</label>
              <input type="date" className="w-full border rounded px-3 py-2" value={editingHr.maternity?.endDate ? String(editingHr.maternity.endDate).slice(0, 10) : ''} onChange={(e) => handleEditChange('endDate', e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">លិខិតសុំ (Request Letter)</label>
              <input type="file" className="w-full text-sm" onChange={(e) => setRequestLetterFile(e.target.files[0])} />
              {requestLetterFile && <div className="text-xs text-blue-600 mt-1">បានជ្រើសរើសឯកសារ</div>}
              {editingHr.maternity?.requestLetterUrl && !requestLetterFile && <div className="text-xs text-green-600 mt-1">មានឯកសារស្រាប់</div>}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">លិខិតចូលវិញ (Return Letter)</label>
              <input type="file" className="w-full text-sm" onChange={(e) => setReturnLetterFile(e.target.files[0])} />
              {returnLetterFile && <div className="text-xs text-blue-600 mt-1">បានជ្រើសរើសឯកសារ</div>}
              {editingHr.maternity?.returnLetterUrl && !returnLetterFile && <div className="text-xs text-green-600 mt-1">មានឯកសារស្រាប់</div>}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">ឯកសារយោង</label>
              <input type="file" ref={fileInputRef} className="w-full text-sm" onChange={(e) => handleFileSelect(e.target.files[0])} />
              {selectedPreviewUrl && <div className="mt-2 text-xs text-blue-600">ឯកសារត្រូវបានជ្រើសរើស</div>}
              {editingHr.maternity?.image && !selectedFile && <div className="mt-2 text-xs text-green-600">មានឯកសារស្រាប់</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-300 rounded" onClick={closeEdit} disabled={saving}>បោះបង់</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleSaveEdit} disabled={saving || uploadingFile}>{saving ? 'រក្សាទុក...' : 'រក្សាទុក'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
