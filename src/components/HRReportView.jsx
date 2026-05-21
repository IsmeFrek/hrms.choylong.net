import React, { useRef, useState, useMemo, useEffect } from 'react';
import ornamentImg from '../assets/3.JPG';
import api from '../services/api';

// Convert Latin digits to Khmer digits
const toKhmerDigits = (v) => String(v ?? '').replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[Number(d)]);
// Format DOB to Khmer: ថ្ងៃទី២៦ ខែឧសភា ឆ្នាំ១៩៩២
const formatDobKh = (input) => {
  if (!input) return '';
  const months = ['មករា', 'កុម្ភៈ', 'មិនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  let y, m, d;
  const m1 = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) {
    y = Number(m1[1]); m = Number(m1[2]); d = Number(m1[3]);
  } else {
    const dt = new Date(input);
    if (isNaN(dt)) return String(input);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
  }
  const dayKh = toKhmerDigits(d);
  const yearKh = toKhmerDigits(y);
  const monthKh = months[(m - 1) % 12] || '';
  return `ថ្ងៃទី${dayKh} ខែ${monthKh} ឆ្នាំ${yearKh}`;
};

// Format DOB to English: 26 May 1992
const formatDobEn = (input) => {
  if (!input) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let y, m, d;
  const m1 = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) {
    y = Number(m1[1]); m = Number(m1[2]); d = Number(m1[3]);
  } else {
    const dt = new Date(input);
    if (isNaN(dt)) return String(input);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
  }
  const day = String(d);
  const month = months[(m - 1) % 12] || '';
  return `${day} ${month} ${y}`;
};

// Khmer labels for fields
const khLabels = {
  khmerName: 'ឈ្មោះ',
  gender: 'ភេទ',
  dob: 'ថ្ងៃ ខែ ឆ្នាំ កំណើត',
  birthPlace: 'ទីកន្លែងកំណើត',
  currentPlace: 'អាសយដ្ឋានបច្ចុប្បន្ន',
  skill: 'មុខជំនាញ',
  position: 'តួនាទី',
  civilServantId: 'អត្តលេខមន្ត្រីរាជការ',
};

const enLabels = {
  khmerName: 'Name',
  gender: 'Gender',
  dob: 'Date of Birth',
  birthPlace: 'Place of Birth',
  currentPlace: 'Current Address',
  skill: 'Skill',
  position: 'Position',
  civilServantId: 'Civil Servant ID',
};

export default function HRReportView({ hr, onClose, isApprover = false }) {
  const printRef = useRef();
  const [lang, setLang] = useState('km'); // 'km' | 'en'
  // Normalize HR id
  const hrId = useMemo(() => hr?._id || hr?.id || null, [hr]);

  // Build display strings (formatted) from hr once
  const initialDisplay = useMemo(() => ({
    khmerName: String(hr?.khmerName ?? ''),
    dob: formatDobKh(hr?.dob),
    birthPlace: String(hr?.birthPlace ?? '').replace(/\s*\n+\s*/g, ' '),
    currentPlace: String(hr?.currentPlace ?? '').replace(/\s*\n+\s*/g, ' '),
    position: String(hr?.position ?? '').replace(/\s*\n+\s*/g, ' '),
    skill: String(hr?.skill ?? '').replace(/\s*\n+\s*/g, ' '),
    civilServantId: toKhmerDigits(hr?.civilServantId || ''),
  }), [hr]);
  const initialDisplayEn = useMemo(() => ({
    khmerName: String(hr?.khmerName ?? ''),
    dob: formatDobEn(hr?.dob),
    birthPlace: String(hr?.birthPlace ?? '').replace(/\s*\n+\s*/g, ' '),
    currentPlace: String(hr?.currentPlace ?? '').replace(/\s*\n+\s*/g, ' '),
    position: String(hr?.position ?? '').replace(/\s*\n+\s*/g, ' '),
    skill: String(hr?.skill ?? '').replace(/\s*\n+\s*/g, ' '),
    civilServantId: String(hr?.civilServantId ?? ''),
  }), [hr]);

  // Editable display state
  const [display, setDisplay] = useState(initialDisplay);
  const [displayEn, setDisplayEn] = useState(initialDisplayEn);
  const [titleText, setTitleText] = useState('វិញ្ញាបនបត្ររដ្ឋបាល');
  const [subText, setSubText] = useState('នាយកមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត');
  const [titleTextEn, setTitleTextEn] = useState('Certification Letter');
  const [subTextEn, setSubTextEn] = useState('Khmer-Soviet Friendship Hospital');
  const [officerTypeText, setOfficerTypeText] = useState(hr?.officerType || '....................');
  const [departmentText, setDepartmentText] = useState(hr?.Department_Kh || '....................');
  const [officerTypeTextEn, setOfficerTypeTextEn] = useState('....................');
  const [departmentTextEn, setDepartmentTextEn] = useState(hr?.Department_En || hr?.Department_Kh || '....................');
  const [canEdit, setCanEdit] = useState(true);

  // approval flow states
  const [pendingId, setPendingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  // Approval modal state
  const [showApproval, setShowApproval] = useState(false);
  const [files, setFiles] = useState([]); // File[]
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  // If user is approver, load any existing pending request for this HR
  useEffect(() => {
    const loadPending = async () => {
      if (!isApprover || !hrId || pendingId) return;
      try {
        const { data } = await api.get('/approvals', { params: { status: 'pending', targetType: 'hr', targetId: hrId } });
        const list = Array.isArray(data) ? data : [];
        if (list.length > 0) setPendingId(list[0]._id);
      } catch (e) {
        // silent; approvers can still request approval if needed
      }
    };
    loadPending();
  }, [isApprover, hrId]);

  useEffect(() => {
    setDisplay(initialDisplay);
    setDisplayEn(initialDisplayEn);
    setOfficerTypeText(hr?.officerType || '....................');
    setDepartmentText(hr?.Department_Kh || '....................');
    setDepartmentTextEn(hr?.Department_En || hr?.Department_Kh || '....................');
  }, [initialDisplay, initialDisplayEn, hr]);

  // Reusable editable span (uncontrolled; commit onBlur)
  const EditableSpan = ({ value, onChange, className, enabled = canEdit }) => {
    const elRef = useRef(null);
    const draftRef = useRef(value || '');

    // Sync DOM text from props only when not focused
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      if (document.activeElement !== el) {
        if (el.textContent !== value) el.textContent = value || '';
        draftRef.current = value || '';
      }
    }, [value, enabled]);

    return (
      <span
        ref={elRef}
        className={`${className || ''} ${enabled ? 'editable' : ''}`}
        contentEditable={enabled}
        suppressContentEditableWarning
        onInput={(e) => {
          draftRef.current = e.currentTarget.textContent || '';
          // No setState here => keeps focus stable while typing
        }}
        onBlur={() => {
          onChange(draftRef.current);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur(); // triggers onBlur commit
          }
        }}
        spellCheck={false}
      />
    );
  };

  // Print handler
  const buildPrintStyleTag = () => `
      <style>
        @page { size: A4; margin: 20cm; }
        * { box-sizing: border-box; }
        body { font-family: "Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif; color:#111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { padding-top: 3.2cm; }
        .header { margin-bottom: 6px; text-align: center; }
        .header .title { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-size: 20px; margin: 0px 0 5px; }
        .header .sub { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-weight: normal; font-size: 16px; margin-bottom: 10px; }
        .section-title { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-weight: normal; font-size: 16px; margin-bottom: 10px; text-align: left; }
        .info-wrap { display: flex; align-items: flex-start; gap: 24px; }
        .info-grid { flex: 1 1 auto; display: grid; grid-template-columns: 175px 24px 1fr; row-gap: 8px; column-gap: 6px; font-size: 16px; line-height: 1.5; }
        .label { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-weight: normal; font-size: 13px; margin-bottom: 0px; text-align: left; }
        .colon { font-family: "Khmer OS Siemreap","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-weight: normal; font-size: 12px; margin: 0px 0 1px; text-align: center; }
        .value { word-break: break-word; }
        .value.kh-name { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-size: 13px; font-weight: normal; }
        .photo-box { width: 125px; height: 160px; border: 0px solid #888; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #888; background: #fafbfc; margin-left: 12px; overflow: hidden; align-self: flex-start; margin-top: -120px; }
        .photo-box img { width: 100%; height: 100%; object-fit: cover; }
        .notes { margin-top: 22px; font-size: 15px; color: #222; text-align: left; margin-left: 0px; }
        .notes p {
          margin: 6px 0;
          padding-left: 0px;
          text-indent: 50px;
        }
        .muol-12 { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-size: 13px; font-weight: normal; }
        .gender-badge { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 0px solid #888; background: #fff; color: #111; margin-top: 0; white-space: nowrap; }
        .gender-badge .g-label { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-size: 12px; font-weight: normal; }
        .gender-badge .g-colon { font-size: 12px; }
        .gender-badge .g-value { font-size: 14px; }
        .header-ornament { margin: 6px auto 8px; height: 22px; display: flex; align-items: center; justify-content: center; }
        .header-ornament img { height: 100%; width: auto; display: block; }
        .inline-gender { margin-left: 140px; white-space: nowrap; color: #111; }
        .inline-gender .g-label { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-size: 13px; }
        .inline-gender .g-colon { padding: 0 3px; font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif; font-size: 13px; }
        .inline-gender .g-value { font-family: "Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif; font-size: 13px; }
        .section-title, .info-wrap, .notes { padding-left: 40px; }
        .editable, .editable:focus { border: 0 none !important; background: transparent !important; }
      </style>
    `;

  const handlePrint = () => {
    const printContents = printRef.current.innerHTML;
    const styles = buildPrintStyleTag();

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
    iDoc.open();
    iDoc.write(`<!doctype html><html><head><title>Report</title>${styles}</head><body>${printContents}</body></html>`);
    iDoc.close();

    // Print and cleanup
    const doPrint = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        setTimeout(() => document.body.removeChild(iframe), 300);
      }
    };

    // Wait a tick for images/fonts to layout
    setTimeout(doPrint, 300);
  };

  // Export current report content as a Word (.doc) file using HTML
  const handleExportWord = () => {
    if (!printRef?.current) return;
    const content = printRef.current.innerHTML;
    const styles = buildPrintStyleTag();

    // Word-friendly page settings (helps MS Word mirror print layout)
    const wordMeta = `<!--[if gte mso 9]><xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
      </w:WordDocument>
    </xml><![endif]-->`;

    const html = `<!doctype html><html><head>
      <meta charset="utf-8"/>
      ${wordMeta}
      ${styles}
    </head><body>${content}</body></html>`;

    // Create a Blob with Word-compatible MIME (HTML-based .doc)
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const filenameBase = (lang === 'km' ? (hr?.khmerName || 'report') : (hr?.khmerName || 'report'))
      .toString().replace(/[\/:*?"<>|]/g, '_');
    a.href = url;
    a.download = `${filenameBase}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Build payload to send for approval
  const buildProposedChanges = () => ({
    hrId: hrId,
    titleText: lang === 'km' ? titleText : titleTextEn,
    subText: lang === 'km' ? subText : subTextEn,
    fields: {
      ...(lang === 'km' ? display : displayEn), // language specific strings
    },
    notes: {
      officerType: lang === 'km' ? officerTypeText : officerTypeTextEn,
      department: lang === 'km' ? departmentText : departmentTextEn,
    },
    meta: {
      staffNo: hr?.no ?? null,
      staffId: hr?.staffId ?? null,
      lang,
    },
    // add more metadata if needed (userId, timestamp) on backend
  });

  // Open modal to fill reason + attach files
  const requestApproval = () => {
    if (!hrId) { setMessage('HR ID not found'); return; }
    setShowApproval(true);
  };

  // Helper: upload files to /api/upload and return attachments array
  const uploadFiles = async (fs) => {
    if (!fs || fs.length === 0) return [];
    const list = Array.from(fs);
    const results = [];
    for (const f of list) {
      const form = new FormData();
      form.append('file', f);
      const { data } = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      results.push({ url: data?.url, name: f.name, type: f.type, size: f.size });
    }
    return results;
  };

  // Submit approval with attachments (no reason)
  const submitApproval = async () => {
    if (!hrId) { setMessage('HR ID not found'); return; }
    setSaving(true);
    setUploading(true);
    setUploadErr('');
    try {
      const attachments = await uploadFiles(files);
      const payload = buildProposedChanges();
      // send as top-level object with attachments placed in payload
      const body = { ...payload, attachments };
      const { data } = await api.post(`/hr/${hrId}/proposed-changes`, body);
      setPendingId(data.id || data.changeId || null);
      setMessage('បានស្នើសុំអនុម័ត');
      setShowApproval(false);
      setFiles([]);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'បរាជ័យក្នុងការស្នើសុំអនុម័ត';
      setUploadErr(msg);
      setMessage(`បរាជ័យក្នុងការស្នើសុំអនុម័ត: ${msg}`);
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const approveChange = async () => {
    if (!hrId || !pendingId) return;
    setSaving(true);
    setMessage('');
    try {
      await api.post(`/hr/${hrId}/proposed-changes/${pendingId}/approve`);
      setMessage('អនុម័តរួចរាល់');
      setPendingId(null);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'បរាជ័យក្នុងការអនុម័ត';
      setMessage(`បរាជ័យក្នុងការអនុម័ត: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white rounded shadow-lg p-8 min-w-[900px] max-w-[98vw] max-h-[98vh] overflow-auto"
        style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", width: '900px' }}
      >
        {/* Add on-screen CSS so UI = print UI */}
        <style>{`
         
          /* updated: use Muol Light 13px for title and sub */
          .header .title {
            font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
       
            font-size: 22px;
            margin: 1px 0 20px;
          }
          .header .sub {
            font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
      
            font-size: 19px;
            margin-bottom: 18px;
          }
          .ornament-text {
            font-family: "Tacteing", "Tacteing Regular", Arial, sans-serif;
            font-size: 20px;
            font-weight: normal;
            letter-spacing: 1px;
            margin: 6px 0 8px;
            text-align: center;
          }
          .section-title { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
            font-weight: ;font-size: 12px;
            margin: 16px 0 22px; text-align: left; }
          .info-wrap { display: flex; align-items: flex-start; gap: 24px; }
          .info-grid {
            flex: 1 1 auto;
            display: grid;
            grid-template-columns: 175px 24px 1fr;
            row-gap: 8px;
            column-gap: 6px;
            font-size: 16px;
            line-height: 2.1;
          }
          .label { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
            font-weight: ;font-size: 12px;
            margin: 1px 0 2px; text-align: left; }
          .colon { font-family: "Khmer OS Siemreap","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
            font-weight: ;font-size: 12px;
            margin: 1px 0 2px;text-align: center; }
          .value { word-break: break-word; }
          .value.kh-name {
            font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
            font-size: 13px; /* was 12px */
            font-weight: normal;
          }

          .photo-box {
            width: 120px; height: 160px;
            border: 0px solid #fcfbfbff;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; color: #fcf8f8ff; background: #fafbfc;
            margin-left: 12px;
            overflow: hidden;
            align-self: flex-start;         /* new */
            margin-top: -80px;              /* new: adjust as needed, e.g. -48px */
          }
          .photo-box img { width: 100%; height: 100%; object-fit: cover; }

          .notes { margin-top: 22px; font-size: 15px; color: #0a0a0aff; text-align: left; margin-left: 20px; }
          .notes p {
            margin: 15px 0;
            padding-left: 10px;   /* hanging indent width */
            text-indent: -10px;   /* first line shifts back by 10px */
          }

          .muol-12 {
            font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
            font-size: 13px; /* was 12px */
            font-weight: normal;
          }

          .gender-badge {
            align-self: flex-start;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border: 0px solid #888;
            background: #fff;
            color: #111;
            margin-top: 0; /* adjust if needed */
            white-space: nowrap;
          }
          .gender-badge .g-label {
            font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
            font-size: 12px;
            font-weight: normal;
          }
          .gender-badge .g-colon { font-size: 12px; }
          .gender-badge .g-value { font-size: 14px; }

          .header-ornament {
            margin: 6px auto 8px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .header-ornament img { height: 100%; width: auto; display: block; }

          .inline-gender {
            margin-left: 12px;
            white-space: nowrap;
            color: #111;
          }
          .inline-gender .g-label {
            font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
            font-size: 13px;
          }
          .inline-gender .g-colon {
            padding: 0 3px;
            font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer","Noto Sans Khmer",Arial,sans-serif;
            font-size: 13px;
          }
          .inline-gender .g-value {
            font-family: "Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif;
            font-size: 13px;
          }

          /* single-line utility for POB and current home */
          .value.nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          /* footer block not used; content is provided via notes paragraphs to match screenshot */

          /* editable hint (screen only) */
          .editable { border-bottom: 1px dotted #999; cursor: text; }
          .editable:focus { outline: none; background: #fffbe6; border-bottom-color: #666; }
          @media print {
            .editable, .editable:focus { border: 0 none !important; background: transparent !important; cursor: default !important; }
          }
          .note-msg { font-size: 12px; color: #0a0a0a; }
          .note-msg.error { color: #b91c1c; }
          .note-msg.success { color: #065f46; }
        `}</style>

        <div ref={printRef}>
          <div className="page" style={{ paddingTop: '210px' }}>
            {/* Header */}
            <div className="header">
              <div className="title">
                <EditableSpan value={lang === 'km' ? titleText : titleTextEn} onChange={lang === 'km' ? setTitleText : setTitleTextEn} className="" />
              </div>
              <div className="header-ornament">
                <img src={ornamentImg} alt="ornament" />
              </div>
              <div className="sub">
                <EditableSpan value={lang === 'km' ? subText : subTextEn} onChange={lang === 'km' ? setSubText : setSubTextEn} className="" />
              </div>
            </div>

            {/* Section title */}
            <div className="section-title">{lang === 'km' ? 'សូមបញ្ជាក់ថា : ' : 'This is to certify that:'}</div>

            {/* Info section */}
            <div className="info-wrap">
              <div className="info-grid">
                {[
                  'khmerName',
                  'dob',
                  'birthPlace',
                  'currentPlace',
                  'position',
                  'skill',
                  'civilServantId',
                ].map((k) => (
                  <React.Fragment key={k}>
                    <div className="label">{(lang === 'km' ? khLabels : enLabels)[k]}</div>
                    <div className="colon">:</div>
                    <div
                      className={
                        `value ${k === 'khmerName' ? (lang === 'km' ? 'kh-name' : '') : ''} ` +
                        `${(k === 'birthPlace' || k === 'currentPlace') ? 'nowrap' : ''}`
                      }
                    >
                      <EditableSpan
                        value={(lang === 'km' ? display : displayEn)[k]}
                        onChange={(v) => (lang === 'km' ? setDisplay : setDisplayEn)((prev) => ({ ...prev, [k]: v }))}
                        className={k === 'khmerName' ? (lang === 'km' ? 'kh-name' : '') : ''}
                      />
                      {k === 'khmerName' && (
                        <span className="inline-gender">
                          {lang === 'km' ? (
                            <>
                              <span className="g-label">ភេទ</span>
                              <span className="g-colon">:</span>
                              <span className="g-value">{(hr?.gender === 'Male' ? 'ប្រុស' : hr?.gender === 'Female' ? 'ស្រី' : (hr?.gender || '—'))}</span>
                            </>
                          ) : (
                            <>
                              <span className="g-label">Gender</span>
                              <span className="g-colon">:</span>
                              <span className="g-value">{hr?.gender || '—'}</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <div className="photo-box">
                {hr?.image ? <img src={hr.image} alt="profile" /> : <span>4 x 6</span>}
              </div>
            </div>

            {/* Notes */}
            <div className="notes">
              {lang === 'km' ? (
                <>
                  <p>
                    ពិតជា{' '}
                    <EditableSpan
                      value={officerTypeText}
                      onChange={setOfficerTypeText}
                      className="muol-12"
                    />{' '}
                    បំរើការងារនៅ{' '}
                    <EditableSpan
                      value={departmentText}
                      onChange={setDepartmentText}
                    />{' '}
                    នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀតពិតប្រាកដមែន។
                  </p>
                  <p>
                    លិខិតបញ្ជាក់នេះចេញជូនសាមីខ្លួនដោយផ្ទាល់ដៃ ប្រើប្រាស់តាមផ្លូវការស្របតាមគន្លងច្បាប់ ៕
                  </p>
                </>
              ) : (
                <>
                  <p>
                    This is to certify that the officer type of{' '}
                    <EditableSpan
                      value={officerTypeTextEn}
                      onChange={setOfficerTypeTextEn}
                      className="muol-12"
                    />{' '}
                    is currently serving at{' '}
                    <EditableSpan
                      value={departmentTextEn}
                      onChange={setDepartmentTextEn}
                    />{' '}
                    of the Khmer-Soviet Friendship Hospital.
                  </p>
                  <p>
                    This certificate is issued to the bearer for official purposes in accordance with the law.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Edit controls (screen only, not printed) */}
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={canEdit}
              onChange={(e) => setCanEdit(e.target.checked)}
            />
            <span>កែប្រែមុនបោះពុម្ព</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-2">
              <span className="text-sm text-gray-600">Language:</span>
              <button className={`px-2 py-1 rounded border text-sm ${lang === 'km' ? 'bg-gray-800 text-white' : 'bg-white'}`} onClick={() => setLang('km')}>ខ្មែរ</button>
              <button className={`px-2 py-1 rounded border text-sm ${lang === 'en' ? 'bg-gray-800 text-white' : 'bg-white'}`} onClick={() => setLang('en')}>English</button>
            </div>
            <button
              className="px-3 py-1 rounded bg-gray-200"
              onClick={() => {
                setDisplay(initialDisplay);
                setDisplayEn(initialDisplayEn);
                setTitleText('វិញ្ញាបនបត្ររដ្ឋបាល');
                setSubText('នាយកមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត');
                setOfficerTypeText(hr?.officerType || '....................');
                setDepartmentText(hr?.Department_Kh || '....................');
                setTitleTextEn('Certification Letter');
                setSubTextEn('Khmer-Soviet Friendship Hospital');
                setOfficerTypeTextEn('....................');
                setDepartmentTextEn(hr?.Department_En || hr?.Department_Kh || '....................');
              }}
              disabled={saving}
            >
              កំណត់ឡើងវិញ
            </button>
            <button
              className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60"
              onClick={requestApproval}
              disabled={saving}
              title="ស្នើសុំអនុម័តពីអ្នកគ្រប់គ្រង"
            >
              {saving ? 'កំពុងស្នើសុំ...' : 'ស្នើសុំអនុម័ត'}
            </button>
            {isApprover && pendingId && (
              <button
                className="px-3 py-1 rounded bg-green-700 text-white disabled:opacity-60"
                onClick={approveChange}
                disabled={saving}
                title={'អនុម័ត និងរក្សាទុក'}
              >
                {saving ? 'កំពុងអនុម័ត...' : 'អនុម័ត និងរក្សាទុក'}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className={`mt-2 note-msg ${/បរាជ័យ/.test(message) ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <button className="bg-orange-600 text-white px-4 py-2 rounded w-full" onClick={onClose}>
            បិទ
          </button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded w-full" onClick={handleExportWord}>
            ទាញយកជា Word
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded w-full" onClick={handlePrint}>
            បោះពុម្ព
          </button>
        </div>

        {showApproval && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg p-4 w-[520px] max-w-[95vw]">
              <h3 className="text-lg font-semibold mb-3">ស្នើសុំអនុម័ត</h3>
              {uploadErr && <div className="text-red-600 text-sm mb-2">{uploadErr}</div>}
              {/* Reason input removed as per request */}
              <label className="block text-sm text-gray-700 mb-1">ភ្ជាប់ឯកសារ (រូបភាព, ≤2MB)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                className="mb-2"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              {files?.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-gray-700 mb-3 max-h-32 overflow-auto">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.name} <span className="text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span></span>
                      <button className="text-red-600 text-xs" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>ដកចេញ</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-end gap-2 mt-2">
                <button className="px-3 py-1 rounded border" onClick={() => setShowApproval(false)} disabled={uploading || saving}>បោះបង់</button>
                <button className={`px-3 py-1 rounded text-white ${uploading || saving ? 'bg-gray-400' : 'bg-blue-600'}`} onClick={submitApproval} disabled={uploading || saving}>
                  {uploading || saving ? 'កំពុងផ្ញើ...' : 'ផ្ញើសំណើ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
