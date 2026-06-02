import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import usePermission from '../hooks/usePermission';
import { useAuth } from '../context/AuthContext';

const _khDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
const toKhmerNumber = (num) => String(num).split('').map(ch => (_khDigits[+ch] ?? ch)).join('');
const formatDateKhmer = (isoOrDate) => {
  try {
    const d = isoOrDate ? new Date(isoOrDate) : new Date();
    if (isNaN(d)) return '';
    const day = toKhmerNumber(d.getDate());
    const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    const month = months[d.getMonth()] || '';
    const year = toKhmerNumber(d.getFullYear());
    return `ថ្ងៃទី${day} ខែ${month} ឆ្នាំ${year}`;
  } catch (e) {
    return '';
  }
};

const toKhmerDigitsString = (s) => {
  if (!s && s !== 0) return '';
  return String(s).split('').map(ch => {
    if (ch >= '0' && ch <= '9') return _khDigits[parseInt(ch, 10)];
    return ch;
  }).join('');
};

// InstructionLetterPage component — shows documents table first, opens editor+preview on "បង្កើត"
export default function InstructionLetterPage() {
  const { token } = useAuth();
  const contentRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateBg, setShowTemplateBg] = useState(true);

  const [form, setForm] = useState({
    _id: '',
    _localId: '',
    templateType: '',
    officer: '',
    officerId: '',
    letterNo: '',
    dateText: 'ថ្ងៃ...................... ខែ...................ឆ្នាំ..................ព.ស.២៥៦.......',
    ministry: 'ក្រសួងសុខាភិបាល',
    department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
    subject: 'លិខិតបង្គាប់ការ',
    recipient: '- តាមការចាំបាច់របស់មន្ទីរពេទ្យ',
    body: 'ខ្លឹមសារលិខិត...',
    body1: '',
    gender: '',
    title: 'លោក',
    currentRole: '',
    newRole: '',
    signPlace: 'រាជធានីភ្នំពេញ',
    signTitle: 'នាយកមន្ទីរពេទ្យ',
    signName: 'សាស្ត្រាចារ្យ ងី ម៉េង',
    requesterSection: '',
    requesterName: '',
    createdBy: 'Admin',
    createdAt: '',
    reference: '',
    attachments: [],
  });

  const [letters, setLetters] = useState([]);
  const defaultColWidths = [35, 100, 100, 40, 180, 280, 40, 65, 50, 50];
  const [colWidths, setColWidths] = useState(defaultColWidths);
  const resizingRef = useRef(null);
  const [rowHeight, setRowHeight] = useState(48);
  const [autoRowHeight, setAutoRowHeight] = useState(true);
  const [labelColWidth, setLabelColWidth] = useState(70);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [fullView, setFullView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  // Card ID search on table view
  const [cardIdQuery, setCardIdQuery] = useState('');
  const [cardIdDropdownVisible, setCardIdDropdownVisible] = useState(false);
  const [employeesList, setEmployeesList] = useState([]);
  const [searchEmpQuery, setSearchEmpQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateType = searchParams.get('template');
  const perms = usePermission();

  const filteredLetters = useMemo(() => {
    if (!letters) return [];
    let result = letters;
    if (templateType) {
      result = letters.filter((l) => {
        // Primary: check templateType field if it exists
        if (l.templateType && l.templateType === templateType) return true;
        // Fallback: check subject content for backwards compatibility
        const subject = String(l.subject || '').toLowerCase();
        const body = String(l.body || '').toLowerCase();
        const recipient = String(l.recipient || '').toLowerCase();
        if (templateType === 'maternity') {
          return subject.includes('មាតុភាព') || body.includes('មាតុភាព') || recipient.includes('មាតុភាព');
        }
        if (templateType === 'resignation') {
          return subject.includes('ឈប់ពីការងារ') || subject.includes('resignation');
        }
        if (templateType === 'onboarding') {
          return subject.includes('ចូលបុគ្គលិកថ្មី') || subject.includes('onboarding');
        }
        if (templateType === 'appointment') {
          return subject.includes('តែងតាំង') || subject.includes('appointment');
        }
        if (templateType === 'termination') {
          return subject.includes('បញ្ចប់មុខតំណែង') || subject.includes('termination');
        }
        if (templateType === 'adjustment') {
          return subject.includes('កែសម្រួលភារកិច្ច') || subject.includes('adjustment');
        }
        if (templateType === 'others') {
          const isKnown = subject.includes('មាតុភាព') || body.includes('មាតុភាព') || recipient.includes('មាតុភាព') ||
                          subject.includes('ឈប់ពីការងារ') || subject.includes('resignation') ||
                          subject.includes('ចូលបុគ្គលិកថ្មី') || subject.includes('onboarding') ||
                          subject.includes('តែងតាំង') || subject.includes('appointment') ||
                          subject.includes('បញ្ចប់មុខតំណែង') || subject.includes('termination') ||
                          subject.includes('កែសម្រួលភារកិច្ច') || subject.includes('adjustment');
          return !isKnown;
        }
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((l) => {
        const letterNo = String(l.letterNo || '').toLowerCase();
        const department = String(l.department || '').toLowerCase();
        const subject = String(l.subject || '').toLowerCase();
        const recipient = String(l.recipient || '').toLowerCase();
        const body = String(l.body || '').toLowerCase();
        const signName = String(l.signName || '').toLowerCase();
        const officer = String(l.officer || '').toLowerCase();
        const officerId = String(l.officerId || '').toLowerCase();
        return (
          letterNo.includes(q) ||
          department.includes(q) ||
          subject.includes(q) ||
          recipient.includes(q) ||
          body.includes(q) ||
          signName.includes(q) ||
          officer.includes(q) ||
          officerId.includes(q)
        );
      });
    }
    const extractNum = (str) => {
      if (!str) return 0;
      let eng = String(str);
      const khMap = {'០':'0','១':'1','២':'2','៣':'3','៤':'4','៥':'5','៦':'6','៧':'7','៨':'8','៩':'9'};
      for (let k in khMap) { eng = eng.split(k).join(khMap[k]); }
      // Extract the first number found (e.g. "123/24" -> 123, "001" -> 1)
      const match = eng.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    
    result.sort((a, b) => {
      const numA = extractNum(a.letterNo);
      const numB = extractNum(b.letterNo);
      if (numA !== numB) return numB - numA;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    
    return result;
  }, [letters, templateType, searchQuery]);

  const hasAccess = () => {
    if (perms.isAdmin) return true;
    if (!templateType) return perms.canViewDocuments;
    if (templateType === 'maternity') return perms.canViewMaternityLeaveReport;
    if (templateType === 'resignation') return perms.canViewResignationLetter;
    if (templateType === 'onboarding') return perms.canViewOnboardingLetter;
    if (templateType === 'appointment') return perms.canViewAppointmentLetter;
    if (templateType === 'termination') return perms.canViewTerminationLetter;
    if (templateType === 'adjustment') return perms.canViewOtherLetters;
    if (templateType === 'others') return perms.canViewOtherLetters;
    return false;
  };

  const canEditAccess = () => {
    if (perms.isAdmin) return true;
    if (!templateType) return perms.canEditDocuments;
    if (templateType === 'maternity') return perms.canEditMaternityLeaveReport;
    if (templateType === 'resignation') return perms.canEditResignationLetter;
    if (templateType === 'onboarding') return perms.canEditOnboardingLetter;
    if (templateType === 'appointment') return perms.canEditAppointmentLetter;
    if (templateType === 'termination') return perms.canEditTerminationLetter;
    if (templateType === 'adjustment') return perms.canEditOtherLetters;
    if (templateType === 'others') return perms.canEditOtherLetters;
    return false;
  };

  if (!hasAccess()) {
    return (
      <div className="p-6 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12 bg-white px-8 rounded-lg shadow-md border border-red-100">
          <h2 className="text-xl font-semibold text-red-600">គ្មានសិទ្ធិអនុញ្ញាត (Permission required)</h2>
          <p className="text-gray-600 mt-2">អ្នកមិនមានសិទ្ធិមើលឯកសារគំរូនេះទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ។</p>
        </div>
      </div>
    );
  }

  const persistLocalLetters = (letter) => {
    try {
      const cur = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
      const withId = { ...letter, _localId: letter._localId || (Date.now() + '-' + Math.random().toString(36).slice(2, 8)) };
      const idx = cur.findIndex((x) => x._localId && withId._localId && x._localId === withId._localId);
      if (idx >= 0) {
        cur[idx] = withId;
      } else {
        cur.unshift(withId);
      }
      localStorage.setItem('localInstructionLetters', JSON.stringify(cur));
    } catch (err) {
      console.warn('local persist failed', err);
    }
  };

  const updateLocalLetter = (letter) => {
    try {
      const cur = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
      const idx = cur.findIndex((x) => x._localId && letter._localId && x._localId === letter._localId);
      if (idx >= 0) {
        cur[idx] = { ...cur[idx], ...letter };
        localStorage.setItem('localInstructionLetters', JSON.stringify(cur));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('update local failed', e);
      return false;
    }
  };

  const removeLocalLetter = (match) => {
    try {
      const cur = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
      const filtered = cur.filter((x) => {
        if (match._localId && x._localId) return x._localId !== match._localId;
        if (match.createdAt && match.letterNo) return !(x.createdAt === match.createdAt && x.letterNo === match.letterNo);
        return true;
      });
      localStorage.setItem('localInstructionLetters', JSON.stringify(filtered));
    } catch (err) {
      console.warn('remove local failed', err);
    }
  };

  const deleteLetter = async (e, l) => {
    e.stopPropagation();
    if (!confirm('លុបឯកសារនេះ?')) return;
    try {
      if (l._id) {
        const res = await fetch('/api/letters/' + l._id, { method: 'DELETE', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!res.ok) throw new Error('delete failed');
      } else {
        removeLocalLetter(l);
      }
      removeLocalLetter(l);
      setLetters((s) => s.filter((x) => !((l._id && x._id === l._id) || (l._localId && x._localId === l._localId) || (l.createdAt && x.createdAt === l.createdAt && x.letterNo === l.letterNo))));
      alert('បានលុប');
    } catch (err) {
      console.error('delete error', err);
      alert('លុបមិនបាន');
    }
  };

  const loadLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/letters?type=instruction', {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      console.log('[loadLetters] Response status:', res.status);
      if (!res.ok) {
        console.log('[loadLetters] Response not OK, loading from localStorage');
        try {
          const local = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
          console.log('[loadLetters] Loaded from localStorage:', local.length, 'items');
          setLetters(Array.isArray(local) ? local : []);
        } catch (_) {
          setLetters([]);
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      console.log('[loadLetters] Loaded data:', data);
      setLetters(Array.isArray(data) ? data : data.letters || []);
    } catch (e) {
      console.error('Failed to load letters', e);
      try {
        const local = JSON.parse(localStorage.getItem('localInstructionLetters') || '[]');
        setLetters(Array.isArray(local) ? local : []);
      } catch (_) {
        setLetters([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLetters();
  }, [token]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch('/api/hr', {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        if (res.ok) {
          const data = await res.json();
          setEmployeesList(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.warn('Failed to load employees for autocomplete', e);
      }
    };
    if (token) {
      fetchEmployees();
    }
  }, [token]);

  const filteredEmployeesByCardId = useMemo(() => {
    if (!employeesList) return [];
    const q = (cardIdQuery || '').toLowerCase().trim();
    if (!q) return [];
    return employeesList.filter(emp => {
      const sid = String(emp.staffId || '').toLowerCase();
      const cid = String(emp.civilServantId || '').toLowerCase();
      const khName = String(emp.khmerName || emp.name || '').toLowerCase();
      const nid = String(emp.nid || emp.nationalId || emp.cardNumber || '').toLowerCase();
      return sid.includes(q) || cid.includes(q) || khName.includes(q) || nid.includes(q);
    }).slice(0, 10);
  }, [employeesList, cardIdQuery]);

  const filteredEmployees = useMemo(() => {
    if (!employeesList) return [];
    const q = (searchEmpQuery || '').toLowerCase().trim();
    if (!q) return employeesList.slice(0, 10);
    return employeesList.filter(emp => {
      const khName = String(emp.khmerName || emp.name || '').toLowerCase();
      const enName = String(emp.name || '').toLowerCase();
      const sid = String(emp.staffId || '').toLowerCase();
      const cid = String(emp.civilServantId || '').toLowerCase();
      const nid = String(emp.nid || emp.nationalId || emp.identityCard || emp.cardNumber || '').toLowerCase();
      return khName.includes(q) || enName.includes(q) || sid.includes(q) || cid.includes(q) || nid.includes(q);
    }).slice(0, 10);
  }, [employeesList, searchEmpQuery]);

  const selectEmployeeForLetter = (emp) => {
    let name = emp.khmerName || emp.name || '';
    if (emp.khmerName && emp.name && emp.khmerName !== emp.name) {
      name = `${emp.khmerName} (${emp.name})`;
    }
    const dept = emp.Department_Kh || emp.department || '';
    const pos = emp.position || emp.civilServantRole || '';
    const civilType = emp.officerType || emp.civilServantType || emp.employeeType || emp.type || '';
    const isFemale = emp.gender === 'Female' || emp.gender === 'ស្រី' || emp.gender === 'female';
    
    // Determine title
    let prefix = isFemale ? 'លោកស្រី' : 'លោក';
    let title = prefix;
    const textToCheck = [emp.civilServantRole, emp.position, emp.degreeLevel, emp.degree, emp.education, emp.skill, emp.officerType].join(' ').toLowerCase();
    if (textToCheck.includes('សាស្ត្រាចារ្យ') || textToCheck.includes('សាស្រ្តាចារ្យ')) {
      title = prefix + 'សាស្ត្រាចារ្យ';
    } else if (textToCheck.includes('វេជ្ជបណ្ឌិត') || textToCheck.includes('វេជ្ជ.') || textToCheck.includes('ជំនាញ') || textToCheck.includes('អនុបណ្ឌិត')) {
      title = prefix + 'វេជ្ជបណ្ឌិត';
    } else if (textToCheck.includes('ឱសថការី')) {
      title = prefix + 'ឱសថការី';
    } else if (textToCheck.includes('ទន្តបណ្ឌិត')) {
      title = prefix + 'ទន្តបណ្ឌិត';
    }
    
    const cardId = emp.staffId || String(emp.no || '') || emp.officerId || '';
    
    setForm(s => {
      let updated = {
        ...s,
        officer: name,
        officerId: cardId,
        department: dept,
      };
      
      if (name) {
        updated.recipient = (updated.recipient || '')
          .replace('លោក/លោកស្រី ......', `${title} ${name}`)
          .replace('លោកស្រី ......', `${title} ${name}`)
          .replace('លោក ......', `${title} ${name}`);
          
        updated.body = (updated.body || '')
          .replace('លោក/លោកស្រី ......', `${title} ${name}`)
          .replace('លោកស្រី ......', `${title} ${name}`)
          .replace('លោក ......', `${title} ${name}`);
      }
      
      // Auto-fill DOB for templates like resignation that have Date of Birth placeholders
      const dobVal = emp.dob || emp.dateOfBirth;
      if (dobVal) {
        const formattedDob = formatDateKhmer(dobVal);
        if (formattedDob) {
          const cleanDob = formattedDob.replace('ថ្ងៃទី', '').trim();
          updated.body = (updated.body || '').replace('ថ្ងៃទី...... ខែ...... ឆ្នាំ......', cleanDob);
        }
      }
      
      if (pos) {
        if (updated.templateType === 'appointment') {
          updated.currentRole = pos;
          updated.body = (updated.body || '')
            .replace('បច្ចុប្បន្នជា......', `បច្ចុប្បន្នជា ${pos}`)
            .replace('បច្ចុប្បន្នជា ......', `បច្ចុប្បន្នជា ${pos}`);
        } else if (updated.templateType === 'adjustment') {
          updated.currentRole = pos;
          // For adjustment, 'ជា......' is for newRole, so we do not auto-fill it with the current role.
        } else {
          updated.body = (updated.body || '')
            .replace('ជា ......', `ជា ${pos}`)
            .replace('ជា......', `ជា ${pos}`)
            .replace('ឋានៈ......', `ឋានៈ ${pos}`)
            .replace('ឋានៈ ......', `ឋានៈ ${pos}`);
        }
      }
      if (isFemale) {
        updated.gender = 'ស្រី';
      } else {
        updated.gender = 'ប្រុស';
      }
      updated.title = title;
      if (dept) {
        const cleanDept = dept.startsWith('ផ្នែក') ? dept : `ផ្នែក${dept}`;
        updated.body = (updated.body || '')
          .replace('ផ្នែក......', `${cleanDept}`)
          .replace('ផ្នែក ......', `${cleanDept}`)
          .replace('នៅផ្នែក......', `នៅ${cleanDept}`)
          .replace('ផ្នែក \t......', `${cleanDept}`)
          .replace('នៅ......។', `នៅ${cleanDept}។`);
      }
      if (civilType) {
        updated.body = (updated.body || '').replace('(......)', `(${civilType})`);
      }
      
      return updated;
    });
  };

  const uniquePositions = useMemo(() => {
    if (!employeesList) return [];
    const posSet = new Set();
    employeesList.forEach(e => {
      if (e.civilServantRole) posSet.add(e.civilServantRole);
      if (e.position) posSet.add(e.position);
    });
    return Array.from(posSet).filter(Boolean).sort();
  }, [employeesList]);

  const uniqueDepartments = useMemo(() => {
    if (!employeesList) return [];
    const deptSet = new Set();
    employeesList.forEach(e => {
      if (e.Department_Kh) deptSet.add(e.Department_Kh);
      if (e.department) deptSet.add(e.department);
    });
    return Array.from(deptSet).filter(Boolean).sort();
  }, [employeesList]);

  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem('instructionLettersTableColWidths') || 'null');
      const rh = JSON.parse(localStorage.getItem('instructionLettersTableRowHeight') || 'null');
      const lw = JSON.parse(localStorage.getItem('instructionLettersTableLabelWidth') || 'null');
      const ar = JSON.parse(localStorage.getItem('instructionLettersTableAutoRow') || 'null');
      if (Array.isArray(w) && w.length === defaultColWidths.length) setColWidths(w);
      if (typeof rh === 'number') setRowHeight(rh);
      if (typeof lw === 'number') setLabelColWidth(lw);
      if (typeof ar === 'boolean') setAutoRowHeight(ar);
    } catch (e) { }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('instructionLettersTableColWidths', JSON.stringify(colWidths));
      localStorage.setItem('instructionLettersTableRowHeight', JSON.stringify(rowHeight));
      localStorage.setItem('instructionLettersTableLabelWidth', JSON.stringify(labelColWidth));
      localStorage.setItem('instructionLettersTableAutoRow', JSON.stringify(autoRowHeight));
    } catch (e) { }
  }, [colWidths, rowHeight, labelColWidth, autoRowHeight]);

  const startColResize = (index, e) => {
    e.preventDefault();
    resizingRef.current = { index, startX: e.clientX, startWidth: colWidths[index] || 80 };
    window.addEventListener('mousemove', onColMouseMove);
    window.addEventListener('mouseup', onColMouseUp);
  };

  const onColMouseMove = (e) => {
    const info = resizingRef.current;
    if (!info) return;
    const delta = e.clientX - info.startX;
    setColWidths((prev) => {
      const copy = prev.slice();
      copy[info.index] = Math.max(20, Math.round(info.startWidth + delta));
      return copy;
    });
  };

  const onColMouseUp = () => {
    resizingRef.current = null;
    window.removeEventListener('mousemove', onColMouseMove);
    window.removeEventListener('mouseup', onColMouseUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onColMouseMove);
      window.removeEventListener('mouseup', onColMouseUp);
    };
  }, []);

  const autoSizeColumn = (index) => {
    try {
      const table = document.querySelector('table');
      if (!table) return;
      const measure = document.createElement('div');
      measure.style.position = 'absolute';
      measure.style.visibility = 'hidden';
      measure.style.whiteSpace = 'nowrap';
      measure.style.padding = '0';
      measure.style.margin = '0';
      document.body.appendChild(measure);

      let maxW = 0;
      const header = table.querySelectorAll('thead th')[index];
      if (header) {
        const hcs = getComputedStyle(header);
        measure.style.font = hcs.font || `${hcs.fontSize} ${hcs.fontFamily}`;
        measure.innerText = header.innerText || '';
        maxW = Math.max(maxW, measure.offsetWidth + parseFloat(hcs.paddingLeft || 0) + parseFloat(hcs.paddingRight || 0));
      }

      const rows = table.querySelectorAll('tbody tr');
      rows.forEach((r) => {
        const cell = r.children[index];
        if (!cell) return;
        const cs = getComputedStyle(cell);
        measure.style.font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
        measure.innerText = cell.innerText || '';
        const w = measure.offsetWidth + parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
        if (w > maxW) maxW = w;
      });

      document.body.removeChild(measure);
      const final = Math.max(20, Math.min(1200, Math.ceil(maxW) + 8));
      setColWidths((prev) => { const c = prev.slice(); c[index] = final; return c; });
    } catch (e) {
      console.warn('autoSize failed', e);
    }
  };

  const statusLabel = (s) => {
    if (s === 'completed' || s === 'ready') return 'រួចរាល់';
    if (s === 'reviewing') return 'កំពុងពិនិត្យ';
    if (s === 'rejected') return 'បដិសេធ';
    return 'រង់ចាំ';
  };
  const statusStyle = (s) => {
    if (s === 'completed' || s === 'ready') return 'bg-green-100 text-green-800 border border-green-300';
    if (s === 'reviewing') return 'bg-blue-100 text-blue-800 border border-blue-300';
    if (s === 'rejected') return 'bg-red-100 text-red-800 border border-red-300';
    return 'bg-orange-100 text-orange-800 border border-orange-300';
  };

  const deriveStatus = (l) => {
    if (!l) return 'pending';
    if (l.status) return l.status;
    if (l.stage) return l.stage;
    if (l.approvedByAdmin === true) return 'completed';
    return 'pending';
  };

  const saveLetter = async () => {
    setSaving(true);
    try {
      const createdAtIso = form.createdAt && form.createdAt.length === 10 ? new Date(form.createdAt).toISOString() : (form.createdAt || new Date().toISOString());
      const payload = { ...form, createdAt: createdAtIso, type: 'instruction' };
      console.log('[saveLetter] Payload:', payload);

      if (form._id) {
        console.log('[saveLetter] Updating existing letter');
        const res = await fetch('/api/letters/' + form._id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          updateLocalLetter(payload);
          await loadLetters();
          alert('បានកែប្រែ (offline)');
        } else {
          await res.json();
          persistLocalLetters(payload);
          await loadLetters();
          alert('បានកែប្រែ');
        }
        return;
      }

      if (!form._id && form._localId) {
        console.log('[saveLetter] Updating local letter');
        const updated = { ...payload };
        const ok = updateLocalLetter(updated);
        if (!ok) persistLocalLetters(updated);
        await loadLetters();
        alert('បានកែប្រែ (lokal)');
        return;
      }

      console.log('[saveLetter] Creating new letter');
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      console.log('[saveLetter] Response status:', res.status);
      if (!res.ok) {
        persistLocalLetters(payload);
        await loadLetters();
        alert('បានរក្សាទុក (offline)');
      } else {
        const created = await res.json();
        console.log('[saveLetter] Created response:', created);
        const saved = { ...payload, _id: created._id || payload._id };
        persistLocalLetters(saved);
        await loadLetters();
        setForm(saved);
        alert('បានរក្សាទុក');
      }
    } catch (err) {
      console.error('Save error', err);
      try {
        const createdAtIso = form.createdAt && form.createdAt.length === 10 ? new Date(form.createdAt + 'T00:00:00').toISOString() : (form.createdAt || new Date().toISOString());
        const payload = { ...form, createdAt: createdAtIso, type: 'instruction' };
        if (payload._localId) {
          updateLocalLetter(payload);
        } else {
          persistLocalLetters(payload);
        }
        await loadLetters();
        alert('បានរក្សាទុក (offline)');
        return;
      } catch (e2) {
        console.error('offline save failed', e2);
      }
      alert('រក្សាទុកមិនបាន');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const previewEl = contentRef.current;
    if (!previewEl) {
      alert('មិនមានអ្វីធ្វើព្រីន');
      return;
    }
    const content = previewEl.innerHTML;
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(s => s.outerHTML).join('\n');
    let printFrame = document.getElementById('print-iframe-instruction');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'print-iframe-instruction';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }
    const win = printFrame.contentWindow;

    if (win) {
      try {
        win.document.open();
        win.document.write(a4Wrapper(content, styles));
        win.document.close();
        const doPrint = () => {
          try {
            win.focus();
            win.print();
          } catch (e) {
            console.error('Print error:', e);
          }
        };

        try {
          const start = Date.now();
          const poll = setInterval(() => {
            try {
              if (!win || win.closed) return clearInterval(poll);
              if (Date.now() - start > 5000) {
                clearInterval(poll);
                return doPrint();
              }
              const imgs = Array.from(win.document.images || []);
              const allLoaded = imgs.every(img => img.complete && img.naturalWidth > 0);
              if (allLoaded) {
                clearInterval(poll);
                setTimeout(doPrint, 200);
              }
            } catch (e) {
              clearInterval(poll);
              doPrint();
            }
          }, 150);
        } catch (e) {
          doPrint();
        }
        return;
      } catch (e) {
        console.error('Failed to write to iframe:', e);
      }
    }
  };

  const a4Wrapper = (innerHtml, styles = '') => {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@300;400;700&display=swap" rel="stylesheet"><style>
      @page { size: A4; margin: 0; }
      html,body{height:100%; margin:0; padding:0;}
      body{
        font-family:"Noto Sans Khmer", "Khmer OS", Arial, serif;
        color:#000;
        margin:0;
        padding:0;
        display:block;
        background: #fff;
      }
      .a4-container { box-sizing: border-box; width:8.27in; min-height:11.69in; padding: 5mm 18mm 5mm 28mm; background:#fff; margin:0 auto; overflow:hidden; position: relative; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .a4-container .doc-sign, .a4-container p, .a4-container h1, .a4-container h2 { break-inside: avoid; page-break-inside: avoid; }
      @media print {
        html,body { height: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
        .a4-container { box-shadow:none; margin:0; width: 100%; height: 100%; min-height: 100%; overflow: visible; page-break-after:avoid; }
      }
    </style></head><body><div class="a4-container">${innerHtml}</div></body></html>`;
  };

  const templates = [
    {
      id: 1,
      name: 'មាតុភាព (បន្ទាប់ពីមាតុភាពវិញ)',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ',
      recipient: 'លិខិតអនុញ្ញាតលេខ ...... ចុះថ្ងៃ...... ទី...... ខែ...... ឆ្នាំ...... របស់ក្រសួងសុខាភិបាល ស្តីពី “ការអនុញ្ញាតឱ្យសម្រាកលំហែមាតុភាពរបស់ លោកស្រី ...... “។',
      body: '\tលោកស្រី ...... ជា ...... (......) បន្ទាប់ពីសម្រាកលំហែមាតុភាពមក ត្រូវបានចាត់ឲ្យចូលបំរើការនៅ ផ្នែក...... វិញ ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។\n\n\tការិយាល័យរដ្ឋបាល និងបុគ្គលិក-ការិយាល័យបច្ចេកទេស-ការិយាល័យហិរញ្ញវត្ថុ-ផ្នែកពាក់ព័ន្ធនានា-សាមីខ្លួន ត្រូវអនុវត្តតាមលិខិតបង្គាប់ការនេះ ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។\n\nចម្លងជូន:\n- ការិយាល័យទាំងបី\n- ផ្នែកពាក់ព័ន្ធ\n- ផ្នែកសេវា\n    “ជ្រាបជាព័ត៌មាន“\n- សាមីខ្លួន \n    “ដើម្បីអនុវត្ត”\n- ឯកសារ-កាលប្បវត្តិ',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: '',
    },
    {
      id: 2,
      name: 'លិខិតអនុញ្ញាតឲ្យឈប់ពីការងារ',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតអនុញ្ញាតឲ្យឈប់ពីការងារ',
      recipient: '- យោងតាមពាក្យសុំឈប់ពីការងាររបស់សាមីខ្លួនចុះថ្ងៃទី... ខែ... ឆ្នាំ...',
      body: '\tលោក/លោកស្រី ...... កើតនៅថ្ងៃទី...... ខែ...... ឆ្នាំ...... ឋានៈ...... ត្រូវបានអនុញ្ញាតឱ្យឈប់ពីការងារចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: '',
    },
    {
      id: 3,
      name: 'លិខិតបង្គាប់ការ ចូលបុគ្គលិកថ្មី',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ ចូលបុគ្គលិកថ្មី',
      recipient: '- តាមការចាំបាច់របស់មន្ទីរពេទ្យ',
      body: '\tលោក/លោកស្រី ...... ត្រូវបានចាត់ឱ្យចូលបម្រើការងារនៅ ផ្នែក...... ក្នុងឋានៈជា...... ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។',
      body1: '\tការិយាល័យរដ្ឋបាល និងបុគ្គលិក ការិយាល័យបច្ចេកទេស ការិយាល័យហិរញ្ញវត្ថុ ផ្នែកពាក់ព័ន្ធនានា សាមីខ្លួន ត្រូវអនុវត្តតាមលិខិតបង្គាប់ការនេះ ចាប់ពីថ្ងៃចុះហត្ថលេខានេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: '',
    },
    {
      id: 4,
      name: 'លិខិតបង្គាប់ការ តែងតាំង',
      officer: '',
      officerId: '',
      letterNo: '',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ',
      recipient: '- កិច្ចប្រជុំថ្នាក់ដឹកនាំមន្ទីរពេទ្យមិត្តភាព-ខ្មែរសូវៀត ថ្ងៃទី...... ខែ...... ឆ្នាំ......។\n- តាមការចាំបាច់របស់មន្ទីរពេទ្យ។',
      body: '\tលោក/លោកស្រី ...... បច្ចុប្បន្នជា...... ត្រូវបានតែងតាំងជា...... នៅ......។',
      body1: '\tការិយាល័យរដ្ឋបាល និងបុគ្គលិក ការិយាល័យបច្ចេកទេស  ការិយាល័យហិរញ្ញវត្ថុ  ផ្នែកពាក់ព័ន្ធនានា  សាមីខ្លួន ត្រូវអនុវត្តតាមលិខិតបង្គាប់ការនេះ ចាប់ពីថ្ងៃចុះហត្ថលេខានេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: '',
      createdAt: '2026-05-23'
    },
    {
      id: 5,
      name: 'លិខិតបង្គាប់ការ បញ្ចប់មុខតំណែង',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ បញ្ចប់មុខតំណែង',
      recipient: '- យោងតាមការរៀបចំរចនាសម្ព័ន្ធឡើងវិញ',
      body: '\tលោក/លោកស្រី ...... ត្រូវបានបញ្ចប់មុខតំណែងជា...... នៃផ្នែក...... ចាប់ពីថ្ងៃទី...... ខែ...... ឆ្នាំ...... នេះតទៅ។',
      body1: '\tការិយាល័យរដ្ឋបាល និងបុគ្គលិក ការិយាល័យបច្ចេកទេស ការិយាល័យហិរញ្ញវត្ថុ ផ្នែកពាក់ព័ន្ធនានា សាមីខ្លួន ត្រូវអនុវត្តតាមលិខិតបង្គាប់ការនេះ ចាប់ពីថ្ងៃចុះហត្ថលេខានេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: '',
    },
    {
      id: 6,
      name: 'លិខិតបង្គាប់ការ ផ្សេងៗ',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ',
      recipient: '- តាមការចាំបាច់របស់មន្ទីរពេទ្យ',
      body: 'ខ្លឹមសារលិខិតបង្គាប់ការផ្សេងៗ...',
      body1: '\tការិយាល័យរដ្ឋបាល និងបុគ្គលិក ការិយាល័យបច្ចេកទេស ការិយាល័យហិរញ្ញវត្ថុ ផ្នែកពាក់ព័ន្ធនានា សាមីខ្លួន ត្រូវអនុវត្តតាមលិខិតបង្គាប់ការនេះ ចាប់ពីថ្ងៃចុះហត្ថលេខានេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: '',
    },
    {
      id: 7,
      name: 'លិខិតបង្គាប់ការ កែសម្រួលភារកិច្ច',
      officer: '',
      officerId: '',
      letterNo: '',
      ministry: 'ក្រសួងសុខាភិបាល',
      department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: 'លិខិតបង្គាប់ការ',
      recipient: '- កិច្ចប្រជុំថ្នាក់ដឹកនាំមន្ទីរពេទ្យមិត្តភាព-ខ្មែរសូវៀត ថ្ងៃទី...... ខែ...... ឆ្នាំ......។\n- តាមការចាំបាច់របស់មន្ទីរពេទ្យ។',
      body: '\tលោក/លោកស្រី ......  ត្រូវបានកែសម្រួលភារកិច្ចជា...... នៅផ្នែក...... ។',
      body1: '\tការិយាល័យរដ្ឋបាល និងបុគ្គលិក ការិយាល័យបច្ចេកទេស  ការិយាល័យហិរញ្ញវត្ថុ  ផ្នែកពាក់ព័ន្ធនានា  សាមីខ្លួន ត្រូវអនុវត្តតាមលិខិតបង្គាប់ការនេះ ចាប់ពីថ្ងៃចុះហត្ថលេខានេះតទៅ។',
      signPlace: 'រាជធានីភ្នំពេញ',
      signTitle: 'នាយកមន្ទីរពេទ្យ',
      signName: '',
      createdAt: '2026-05-23'
    },
  ];

  const applyTemplate = (t) => {
    setMeetingDate('');
    setEffectiveDate('');
    setForm({
      _id: '',
      _localId: '',
      templateType: getTemplateTypeFromId(t.id),
      officer: t.officer || '',
      officerId: t.officerId || '',
      letterNo: t.letterNo || '',
      dateText: 'ថ្ងៃ...................... ខែ...................ឆ្នាំ..................ព.ស.២៥៦.......',
      ministry: t.ministry || 'ក្រសួងសុខាភិបាល',
      department: t.department || 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
      subject: t.subject || '',
      recipient: t.recipient || '',
      body: t.body || '',
      body1: t.body1 || '',
      gender: t.gender || '',
      title: t.title || 'លោក',
      currentRole: t.currentRole || '',
      newRole: t.newRole || '',
      signPlace: t.signPlace || 'រាជធានីភ្នំពេញ',
      signTitle: t.signTitle || 'នាយកមន្ទីរពេទ្យ',
      signName: t.signName || '',
      requesterSection: '',
      requesterName: '',
      createdBy: 'Admin',
      createdAt: t.createdAt || new Date().toISOString().slice(0, 10),
      reference: '',
      attachments: [],
    });
    setCreating(true);
    setShowPreview(true);
  };

  useEffect(() => {
    if (templateType) {
      const hasEmployeeDetails = searchParams.get('name') || searchParams.get('department') || searchParams.get('position') || searchParams.get('endDate') || searchParams.get('civilType');
      
      if (hasEmployeeDetails) {
        let id = 1;
        if (templateType === 'maternity') id = 1;
        else if (templateType === 'resignation') id = 2;
        else if (templateType === 'onboarding') id = 3;
        else if (templateType === 'appointment') id = 4;
        else if (templateType === 'termination') id = 5;
        else if (templateType === 'others') id = 6;
        
        const t = templates.find((x) => x.id === id);
        if (t) {
          let appliedT = { ...t };
          const name = searchParams.get('name') || '......';
          appliedT.officer = name !== '......' ? name : '';
          const dept = searchParams.get('department') || '......';
          const pos = searchParams.get('position') || '......';
          
          if (name !== '......') {
            appliedT.recipient = appliedT.recipient.replace('លោកស្រី ......', `លោកស្រី ${name}`).replace('លោក/លោកស្រី ......', `លោក ${name}`);
            appliedT.body = appliedT.body.replace('លោកស្រី ......', `លោកស្រី ${name}`).replace('លោក/លោកស្រី ......', `លោក ${name}`);
          }
          if (pos !== '......') {
            if (templateType === 'appointment') {
              appliedT.body = appliedT.body.replace('បច្ចុប្បន្នជា......', `បច្ចុប្បន្នជា ${pos}`).replace('បច្ចុប្បន្នជា ......', `បច្ចុប្បន្នជា ${pos}`);
            } else {
              appliedT.body = appliedT.body.replace('ជា ......', `ជា ${pos}`).replace('ជា......', `ជា ${pos}`);
            }
          }
          if (dept !== '......') {
            const cleanDept = dept.startsWith('ផ្នែក') ? dept : `ផ្នែក${dept}`;
            appliedT.body = appliedT.body.replace('ផ្នែក......', `${cleanDept}`).replace('នៅផ្នែក......', `នៅ${cleanDept}`).replace('នៅ......។', `នៅ${cleanDept}។`);
          }
          
          const civilType = searchParams.get('civilType');
          if (civilType) {
            appliedT.body = appliedT.body.replace('(......)', `(${civilType})`);
          }
          
          const endDateStr = searchParams.get('endDate');
          if (endDateStr && endDateStr !== '......') {
            const endDateObj = new Date(endDateStr);
            if (!isNaN(endDateObj.getTime())) {
              let returnDate = new Date(endDateObj);
              returnDate.setDate(returnDate.getDate() + 1);
              
              while (returnDate.getDay() === 0 || returnDate.getDay() === 6) {
                returnDate.setDate(returnDate.getDate() + 1);
              }
              
              const khDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
              const day = String(returnDate.getDate()).split('').map(ch => (khDigits[+ch] ?? ch)).join('');
              const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
              const month = months[returnDate.getMonth()] || '';
              const year = String(returnDate.getFullYear()).split('').map(ch => (khDigits[+ch] ?? ch)).join('');
              
              appliedT.body = appliedT.body.replace(/ចាប់ពីថ្ងៃទី\.\.\.\.\.\.\s*ខែ\.\.\.\.\.\.\s*ឆ្នាំ\.\.\.\.\.\./g, `ចាប់ពីថ្ងៃទី${day} ខែ${month} ឆ្នាំ${year}`);
            }
          }
          applyTemplate(appliedT);
        }
      }
    }
  }, [templateType, searchParams]);

  const onRowClick = (l) => {
    setMeetingDate('');
    setEffectiveDate('');
    const mapped = {
      _id: l._id || '',
      _localId: l._localId || '',
      templateType: l.templateType || '',
      status: l.status || 'pending',
      officer: l.officer || '',
      officerId: l.officerId || '',
      letterNo: l.letterNo || '',
      dateText: l.dateText || (l.createdAt ? new Date(l.createdAt).toLocaleDateString() : ''),
      ministry: l.ministry || '',
      department: l.department || '',
      subject: l.subject || '',
      recipient: l.recipient || '',
      body: l.body || '',
      body1: l.body1 || '',
      gender: l.gender || '',
      title: l.title || 'លោក',
      currentRole: l.currentRole || '',
      newRole: l.newRole || '',
      signPlace: l.signPlace || '',
      signTitle: l.signTitle || '',
      signName: l.signName || '',
      attachments: l.attachments || [],
      requesterSection: l.requesterSection || '',
      requesterName: l.requesterName || '',
      reference: l.reference || '',
      createdBy: l.createdBy || '',
      createdAt: l.createdAt ? (new Date(l.createdAt)).toISOString().slice(0, 10) : ''
    };
    setForm(mapped);
    setCreating(true);
    setShowPreview(true);
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setForm((s) => ({ ...s, attachments: files.map((f) => f.name) }));
  };

  const handleChange = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const handleMeetingDateChange = (e) => {
    const val = e.target.value;
    setMeetingDate(val);
    if (val) {
      const formatted = formatDateKhmer(val);
      setForm(prev => {
        let newRecipient = prev.recipient || '';
        const dateRegex = /ថ្ងៃទី[.\s]*ខែ[.\s]*ឆ្នាំ[.\s]*/;
        const khmerDateRegex = /ថ្ងៃទី[០-៩]+\s*ខែ[^\s]+\s*ឆ្នាំ[០-៩]+/;
        if (dateRegex.test(newRecipient)) {
          newRecipient = newRecipient.replace(dateRegex, formatted);
        } else if (khmerDateRegex.test(newRecipient)) {
          newRecipient = newRecipient.replace(khmerDateRegex, formatted);
        }
        return { ...prev, recipient: newRecipient };
      });
    }
  };

  const handleEffectiveDateChange = (e) => {
    const val = e.target.value;
    setEffectiveDate(val);
    if (val) {
      const formatted = formatDateKhmer(val);
      setForm(prev => {
        let newBody = prev.body || '';
        const dateRegex = /ថ្ងៃទី[.\s]*ខែ[.\s]*ឆ្នាំ[.\s]*/;
        const khmerDateRegex = /ថ្ងៃទី[០-៩]+\s*ខែ[^\s]+\s*ឆ្នាំ[០-៩]+/;
        if (dateRegex.test(newBody)) {
          newBody = newBody.replace(dateRegex, formatted);
        } else if (khmerDateRegex.test(newBody)) {
          newBody = newBody.replace(khmerDateRegex, formatted);
        }
        return { ...prev, body: newBody };
      });
    }
  };

  const getTemplateTypeFromId = (id) => {
    if (id === 1) return 'maternity';
    if (id === 2) return 'resignation';
    if (id === 3) return 'onboarding';
    if (id === 4) return 'appointment';
    if (id === 5) return 'termination';
    if (id === 7) return 'adjustment';
    return 'others';
  };

  return (
    <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
      {!creating ? (
        <div className="bg-white w-full border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-100">
            {/* Title Section */}
            <div>
              <h3 className="text-lg font-bold text-gray-800 font-khmer">
                {templateType === 'appointment' && 'តារាងលិខិតបង្គាប់ការ - តែងតាំង'}
                {templateType === 'resignation' && 'តារាងលិខិតអនុញ្ញាត - ឈប់ពីការងារ'}
                {templateType === 'onboarding' && 'តារាងលិខិតបង្គាប់ការ - ចូលបុគ្គលិកថ្មី'}
                {templateType === 'termination' && 'តារាងលិខិតបង្គាប់ការ - បញ្ចប់មុខតំណែង'}
                {templateType === 'adjustment' && 'តារាងលិខិតបង្គាប់ការ - កែសម្រួលភារកិច្ច'}
                {templateType === 'maternity' && 'តារាងលិខិតបង្គាប់ការ - ចូលបម្រើការងារវិញ (មាតុភាព)'}
                {templateType === 'others' && 'តារាងលិខិតបង្គាប់ការ - ផ្សេងៗ'}
                {!templateType && 'តារាងលិខិតបង្គាប់ការ'}
                <span className="ml-2 px-2.5 py-0.5 align-middle rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">{filteredLetters.length}</span>
              </h3>
              <p className="text-xs text-gray-500 font-khmer mt-0.5">គ្រប់គ្រង និងស្វែងរកឯកសារបង្គាប់ការផ្លូវការ (សរុប: {filteredLetters.length})</p>
            </div>

            {/* Right Section: Search and Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-4 flex-1">
              {/* Search */}
              <div className="flex items-center gap-2 max-w-md w-full sm:w-auto">
                <label className="text-xs font-semibold text-gray-600 font-khmer whitespace-nowrap hidden sm:block">ស្វែងរក:</label>
                <div className="relative flex gap-2 flex-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-khmer"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCardIdQuery(e.target.value);
                        setCardIdDropdownVisible(true);
                      }}
                      onFocus={() => searchQuery && setCardIdDropdownVisible(true)}
                      onBlur={() => setTimeout(() => setCardIdDropdownVisible(false), 180)}
                      placeholder="D0001 ឬ ឈ្មោះ"
                    />
                    {cardIdDropdownVisible && filteredEmployeesByCardId.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-blue-200 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto">
                        {filteredEmployeesByCardId.map(emp => (
                          <button
                            key={emp._id || emp.staffId}
                            type="button"
                            onMouseDown={() => {
                              const name = emp.khmerName || emp.name || '';
                              const sid = emp.staffId || emp.civilServantId || '';
                              setSearchQuery(name || sid);
                              setCardIdQuery(sid);
                              setCardIdDropdownVisible(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0 font-khmer"
                          >
                            <div className="flex justify-between items-center gap-2">
                              <div>
                                <div className="font-bold text-gray-800">{emp.khmerName || emp.name}</div>
                                <div className="text-blue-600 text-[10px]">
                                  {emp.staffId && <span>ID: {emp.staffId}</span>}
                                  {emp.civilServantId && <span className="ml-1">| CS: {emp.civilServantId}</span>}
                                </div>
                              </div>
                              <span className="text-gray-400 text-[10px] shrink-0">{emp.Department_Kh || emp.department || ''}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cardIdDropdownVisible && searchQuery.trim() && filteredEmployeesByCardId.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 px-3 py-2 text-xs text-gray-400 font-khmer">
                        រកមិនឃើញ
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-all font-khmer"
                    onClick={() => { setSearchQuery(''); setCardIdQuery(''); }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-all font-khmer"
                  onClick={() => {
                    if (templateType === 'maternity') {
                      navigate('/maternity-leave-report');
                    } else {
                      navigate(-1);
                    }
                  }}
                >
                  ត្រឡប់ក្រោយ
                </button>
                {canEditAccess() && (
                  <button
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-all font-khmer shadow-sm"
                    onClick={() => {
                      const activeTId = 
                        templateType === 'maternity' ? 1 :
                        templateType === 'resignation' ? 2 :
                        templateType === 'onboarding' ? 3 :
                        templateType === 'appointment' ? 4 :
                        templateType === 'termination' ? 5 :
                        templateType === 'adjustment' ? 7 :
                        templateType === 'others' ? 6 : null;
                      const currentT = templates.find((x) => x.id === activeTId);
                      if (currentT) {
                        applyTemplate(currentT);
                      } else {
                        setForm({
                          _id: '',
                          _localId: '',
                          templateType: templateType || '',
                          officer: '',
                          letterNo: '',
                          dateText: 'ថ្ងៃ...................... ខែ...................ឆ្នាំ..................ព.ស.២៥៦.......',
                          ministry: 'ក្រសួងសុខាភិបាល',
                          department: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត',
                          subject: 'លិខិតបង្គាប់ការ',
                          recipient: '- តាមការចាំបាច់របស់មន្ទីរពេទ្យ',
                          body: 'ខ្លឹមសារលិខិត...',
                          body1: '',
                          gender: '',
                          title: 'លោក',
                          currentRole: '',
                          newRole: '',
                          signPlace: 'រាជធានីភ្នំពេញ',
                          signTitle: 'នាយកមន្ទីរពេទ្យ',
                          signName: '',
                          requesterSection: '',
                          requesterName: '',
                          createdBy: 'Admin',
                          createdAt: '',
                          reference: '',
                          attachments: [],
                        });
                        setCreating(true);
                        setShowPreview(true);
                      }
                    }}
                  >
                    បង្កើតថ្មី
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mb-6 flex gap-2 items-center flex-wrap border-b border-gray-100 pb-3">
            <span className="text-xs font-bold text-gray-500 font-khmer mr-1">ប្រភេទគំរូ:</span>
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-khmer transition-all ${
                !templateType
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => navigate('/instruction-letters')}
            >
              ទិន្នន័យទាំងអស់
            </button>
            {templates.map((t) => {
              const activeType = getTemplateTypeFromId(t.id);
              const isSelected = templateType === activeType;
              return (
                <button
                  key={t.id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-khmer transition-all ${
                    isSelected
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => navigate(`/instruction-letters?template=${activeType}`)}
                >
                  {t.name}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto w-full border border-gray-200 rounded-lg shadow-sm">
            <table className="w-full border-collapse table-fixed text-sm bg-white" style={{ tableLayout: 'fixed', minWidth: '1200px' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                  {['ល.រ', 'ឈ្មោះមន្ត្រី', 'ផ្នែក', 'លេខលិខិត', 'យោង', 'ខ្លឹមសារ', 'ភ្ជាប់ឯកសារ', 'កាលបរិច្ឆេទបង្កើត', 'ស្ថានភាព', 'សកម្មភាព'].map((h, i) => (
                    <th key={i} className="border-r border-gray-200 px-4 py-3 text-center text-xs font-bold text-gray-600 relative font-khmer" style={{ width: colWidths[i] }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="border px-4 py-6 text-center">Loading...</td></tr>
                ) : filteredLetters.length === 0 ? (
                  <tr><td colSpan={10} className="border px-4 py-6 text-center">មិនមានទិន្នន័យ</td></tr>
                ) : (
                  filteredLetters.map((l, idx) => (
                    <tr key={l._id || idx} className="hover:bg-gray-50 border-b border-gray-100 text-gray-600" style={{ height: rowHeight }}>
                      <td className="border px-4 py-3 align-middle text-sm text-center">{idx + 1}</td>
                      <td className="border px-4 py-3 align-middle text-sm font-semibold text-gray-800 break-words">
                        <div className="line-clamp-2">
                          {l.officer || '-'}
                          {l.officerId && <span className="text-[10px] text-gray-400 font-normal ml-1">({l.officerId})</span>}
                        </div>
                      </td>
                      <td className="border px-4 py-3 align-middle text-sm break-words">
                        <div className="line-clamp-2" title={l.department || ''}>{l.department || '-'}</div>
                      </td>
                      <td className="border px-4 py-3 align-middle text-sm break-words">
                        <div className="line-clamp-2">{l.letterNo ? toKhmerDigitsString(l.letterNo) : '-'}</div>
                      </td>
                      <td className="border px-4 py-3 align-middle text-sm break-words">
                        <div className="line-clamp-2" title={l.recipient || ''}>{l.recipient || '-'}</div>
                      </td>
                      <td className="border px-4 py-3 align-middle text-sm break-words">
                        <div className="line-clamp-2" title={l.body || ''}>{l.body || '-'}</div>
                      </td>
                      <td className="border px-4 py-3 align-middle text-sm break-words">
                        <div className="line-clamp-2" title={(l.attachments || []).join(', ')}>
                          {(l.attachments && l.attachments.length) ? l.attachments.join(', ') : '-'}
                        </div>
                      </td>
                      <td className="border px-4 py-3 align-middle text-sm break-words">
                        {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="border px-4 py-3 align-middle text-sm text-center">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${statusStyle(deriveStatus(l))}`}>
                          {statusLabel(deriveStatus(l))}
                        </span>
                      </td>
                      <td className="border px-4 py-3 text-center">
                        {canEditAccess() && (
                          <div className="flex gap-2 justify-center items-center">
                            <button
                              onClick={() => onRowClick(l)}
                              title="កែប្រែ"
                              className="w-7 h-7 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition-all"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
                                <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => deleteLetter(e, l)}
                              title="លុប"
                              className="w-7 h-7 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-sm transition-all"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
          <div className="mx-auto flex flex-col xl:flex-row gap-6 w-full items-start">
            <div className="bg-white w-full xl:w-[420px] xl:min-w-[420px] border border-gray-200 rounded-xl p-5 md:p-6 shadow-sm font-khmer">
              <h4 className="text-base font-bold text-gray-800 text-center mb-5 pb-3 border-b border-gray-100">បំពេញព័ត៌មាន</h4>

              <div className="flex flex-col gap-3">
                {/* Employee autocomplete selection */}
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1.5 relative flex-1">
                    <label className="text-xs font-semibold text-gray-600 font-khmer">ឈ្មោះមន្ត្រី (សរសេរ ឬជ្រើសរើស) ខ្មែរ (ឡាតាំង)</label>
                    <input 
                      value={form.officer || ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(s => ({ ...s, officer: val }));
                        setSearchEmpQuery(val);
                        setShowDropdown(true);
                      }} 
                      onFocus={() => {
                        setSearchEmpQuery(form.officer || '');
                        setShowDropdown(true);
                      }}
                      placeholder="វាយឈ្មោះដើម្បីស្វែងរក..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-khmer" 
                    />
                    {showDropdown && filteredEmployees.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                          {filteredEmployees.map(emp => (
                            <button
                              key={emp._id || emp.staffId}
                              type="button"
                              onClick={() => {
                                selectEmployeeForLetter(emp);
                                setShowDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0 font-khmer flex justify-between items-center"
                            >
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-gray-800">{emp.khmerName || emp.name}</span>
                                <span className="text-gray-500 text-[10px]">
                                  {emp.staffId ? `អត្តលេខកាត: ${emp.staffId}` : ''}
                                  {emp.civilServantId ? ` | អត្តលេខ: ${emp.civilServantId}` : ''}
                                </span>
                              </div>
                              <span className="text-gray-400 text-[10px] text-right">{emp.civilServantRole || emp.position || ''}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs font-semibold text-gray-600">អត្តលេខកាត (Staff ID)</label>
                    <input value={form.officerId || ''} onChange={handleChange('officerId')} placeholder="អត្តលេខកាតបុគ្គលិក..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-khmer" />
                  </div>
                </div>

                {form.templateType === 'appointment' && (
                  <div className="flex gap-4">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs font-semibold text-blue-600">ភេទ</label>
                      <select 
                        value={form.gender || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const newTitle = val === 'ស្រី' ? 'លោកស្រី' : 'លោក';
                          setForm(s => ({ 
                            ...s, 
                            gender: val, 
                            title: newTitle,
                            body: s.body.replace(/លោក\/លោកស្រី|លោកស្រី|លោក/, newTitle)
                          }));
                        }} 
                        className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-khmer"
                      >
                        <option value="">ជ្រើសរើសភេទ</option>
                        <option value="ប្រុស">ប្រុស</option>
                        <option value="ស្រី">ស្រី</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs font-semibold text-blue-600">ងារ</label>
                      <select 
                        value={form.title || 'លោក'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm(s => ({
                            ...s,
                            title: val,
                            body: s.body.replace(new RegExp(`(${s.title}|លោក/លោកស្រី|លោកស្រី|លោក|លោកវេជ្ជបណ្ឌិត|លោកស្រីវេជ្ជបណ្ឌិត|វេជ្ជបណ្ឌិត|វេជ្ជ\\.|លោកវេជ្ជ\\.|លោកស្រីវេជ្ជ\\.|ទន្តបណ្ឌិត|ឱសថការី|លោកឱសថការី|លោកស្រីឱសថការី|លោកទន្តបណ្ឌិត|លោកស្រីទន្តបណ្ឌិត|លោកសាស្ត្រាចារ្យ|លោកស្រីសាស្ត្រាចារ្យ)(?=សាស្ត្រាចារ្យ|វេជ្ជបណ្ឌិត|វេជ្ជ\\.| )|${s.title}|លោក/លោកស្រី|លោកស្រី|លោក`), val)
                          }));
                        }}
                        className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-khmer"
                      >
                        <option value="លោក">លោក</option>
                        <option value="លោកស្រី">លោកស្រី</option>
                        <option value="វេជ្ជ.">វេជ្ជ.</option>
                        <option value="លោកវេជ្ជ.">លោកវេជ្ជ.</option>
                        <option value="លោកស្រីវេជ្ជ.">លោកស្រីវេជ្ជ.</option>
                        <option value="វេជ្ជបណ្ឌិត">វេជ្ជបណ្ឌិត</option>
                        <option value="លោកវេជ្ជបណ្ឌិត">លោកវេជ្ជបណ្ឌិត</option>
                        <option value="លោកស្រីវេជ្ជបណ្ឌិត">លោកស្រីវេជ្ជបណ្ឌិត</option>
                        <option value="ទន្តបណ្ឌិត">ទន្តបណ្ឌិត</option>
                        <option value="លោកទន្តបណ្ឌិត">លោកទន្តបណ្ឌិត</option>
                        <option value="លោកស្រីទន្តបណ្ឌិត">លោកស្រីទន្តបណ្ឌិត</option>
                        <option value="ឱសថការី">ឱសថការី</option>
                        <option value="លោកឱសថការី">លោកឱសថការី</option>
                        <option value="លោកស្រីឱសថការី">លោកស្រីឱសថការី</option>
                        <option value="សាស្ត្រាចារ្យ">សាស្ត្រាចារ្យ</option>
                        <option value="លោកសាស្ត្រាចារ្យ">លោកសាស្ត្រាចារ្យ</option>
                        <option value="លោកស្រីសាស្ត្រាចារ្យ">លោកស្រីសាស្ត្រាចារ្យ</option>
                        <option value="ឯកឧត្តម">ឯកឧត្តម</option>
                        <option value="លោកជំទាវ">លោកជំទាវ</option>
                      </select>
                    </div>
                  </div>
                )}

                {(form.templateType === 'appointment' || form.templateType === 'adjustment') && (
                  <div className="flex gap-4">
                    <datalist id="role-options">
                      {uniquePositions.map((pos, idx) => (
                        <option key={idx} value={pos} />
                      ))}
                    </datalist>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs font-semibold text-blue-600">តួនាទី</label>
                      <input 
                        list="role-options"
                        value={form.currentRole || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm(s => ({
                            ...s,
                            currentRole: val,
                            body: s.body.replace(new RegExp(`បច្ចុប្បន្នជា\\s*(?:${s.currentRole || '\\.\\.\\.\\.\\.\\.'})`), `បច្ចុប្បន្នជា ${val}`)
                          }));
                        }} 
                        placeholder="តួនាទីបច្ចុប្បន្ន..." 
                        className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-khmer" 
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs font-semibold text-blue-600">តួនាទីថ្មី</label>
                      <input 
                        list="role-options"
                        value={form.newRole || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm(s => {
                            const newBody = s.templateType === 'adjustment'
                              ? s.body.replace(new RegExp(`កែសម្រួលភារកិច្ចជា\\s*(?:${s.newRole || '\\.\\.\\.\\.\\.\\.'})`), `កែសម្រួលភារកិច្ចជា ${val}`)
                              : s.body.replace(new RegExp(`តែងតាំងជា\\s*(?:${s.newRole || '\\.\\.\\.\\.\\.\\.'})`), `តែងតាំងជា ${val}`);
                            return {
                              ...s,
                              newRole: val,
                              body: newBody
                            };
                          });
                        }} 
                        placeholder="តួនាទីថ្មី..." 
                        className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-khmer" 
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs font-semibold text-gray-600">លេខលិខិត( សរសេរ)</label>
                    <input value={form.letterNo} onChange={handleChange('letterNo')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs font-semibold text-gray-600">កម្មវត្ថុ</label>
                    <input value={form.subject} onChange={handleChange('subject')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">យោង</label>
                  <textarea value={form.recipient} onChange={handleChange('recipient')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all h-20" />
                </div>

                {(form.templateType === 'appointment' || form.templateType === 'adjustment') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-blue-600">កាលបរិច្ឆេទ កិច្ចប្រជុំ (យោង)</label>
                    <input type="date" value={meetingDate} onChange={handleMeetingDateChange} className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-khmer" />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">ផ្នែក</label>
                  <input 
                    list="department-options"
                    value={form.department} 
                    onChange={handleChange('department')} 
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                  />
                  <datalist id="department-options">
                    {uniqueDepartments.map((dept, idx) => (
                      <option key={idx} value={dept} />
                    ))}
                  </datalist>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">ខ្លឹមសារ</label>
                  <textarea rows={3} value={form.body} onChange={handleChange('body')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">ខ្លឹមសារ1</label>
                  <textarea rows={3} value={form.body1 || ''} onChange={handleChange('body1')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                {form.templateType === 'appointment' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-blue-600">កាលបរិច្ឆេទ ចូលកាន់តំណែង (ខ្លឹមសារ)</label>
                    <input type="date" value={effectiveDate} onChange={handleEffectiveDateChange} className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-khmer" />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">ភ្ជាប់ឯកសារ</label>
                  <input type="file" multiple onChange={handleFilesChange} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white" />
                  {form.attachments && form.attachments.length > 0 && (
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      ឯកសារដែលបានភ្ជាប់: {form.attachments.join(', ')}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 hidden">
                  <label className="text-xs font-semibold text-gray-600">ទីតាំងចុះឈ្មោះ</label>
                  <input value={form.signPlace} onChange={handleChange('signPlace')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">កាលបរិច្ឆេទបង្កើត</label>
                  <input type="date" value={form.createdAt || ''} onChange={handleChange('createdAt')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>


                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">ថ្ងៃចន្ទគតិ</label>
                  <input value={form.dateText || ''} onChange={handleChange('dateText')} placeholder="ឧ. ថ្ងៃសុក្រ ១៣កើត..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">តំណែងអ្នកចុះឈ្មោះ</label>
                  <input value={form.signTitle} onChange={handleChange('signTitle')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1 hidden">
                  <label className="text-xs font-semibold text-gray-600">ឈ្មោះអ្នកចុះឈ្មោះ</label>
                  <input list="signName-options" value={form.signName} onChange={handleChange('signName')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                  <datalist id="signName-options">
                    <option value="សាស្ត្រាចារ្យ ងី ម៉េង" />
                  </datalist>
                </div>
              </div>
            </div>

            <div className="w-full" style={{ flex: 1 }}>
              {showPreview ? (
                <div>
                  <div className="mb-3 flex gap-4 items-center justify-between sm:justify-end border-b border-gray-200 pb-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer font-khmer">
                      <input
                        type="checkbox"
                        checked={showTemplateBg}
                        onChange={(e) => setShowTemplateBg(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      បង្ហាញ Background
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (templateType === 'maternity') {
                            navigate('/maternity-leave-report');
                          } else {
                            setCreating(false);
                          }
                        }}
                        className="px-3.5 py-1.5 border border-red-600 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-all font-khmer shadow-sm"
                      >
                        បោះបង់
                      </button>
                      <button onClick={handlePrint} className="px-3.5 py-1.5 border border-blue-600 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all font-khmer shadow-sm">បោះពុម្ព (Print)</button>
                      {canEditAccess() && (
                        <button onClick={saveLetter} disabled={saving} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-all font-khmer shadow-sm">{saving ? 'រក្សាទុក...' : 'រក្សាទុក'}</button>
                      )}
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto p-4 bg-gray-200 border border-gray-300 rounded-xl shadow-inner flex justify-start xl:justify-center items-start no-print-scrollbar">
                    <div ref={contentRef} style={{ width: '8.27in', minHeight: '11.69in', background: '#fff', padding: '5mm 18mm 5mm 28mm', boxSizing: 'border-box', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', fontFamily: 'Khmer OS, Arial, serif', color: '#000', position: 'relative', flexShrink: 0 }}>
                      <style>{`
                        .doc-row { display: grid; grid-template-columns: 80px 1fr; margin-top: 20px; }
                        .doc-label { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 16px; }
                        .doc-value { font-family: "Khmer OS Siemreap", Arial, sans-serif; font-size: 16px; line-height: 1.9; text-align: justify; }
                        
                        .doc-body { margin-top: 20px; font-family: "Khmer OS Siemreap", Arial, sans-serif; font-size: 16px; text-align: justify; white-space: pre-line; line-height: 1.9; }
                        
                        .doc-sign { margin-top: 40px; text-align: center; width: fit-content; margin-left: auto; padding-right: 0; margin-right: -10mm; }
                        .place-date { font-family: "Khmer OS Siemreap"; font-size: 16px; }
                        .sign-title { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 16px; margin-top: 5px; }
                        .sign-name { font-family: 'Khmer OS Muol Light', 'Khmer OS', Arial, serif; font-size: 16px; margin-top: 80px; }
                      `}</style>

                      {showTemplateBg && (
                        <img
                          src="/Uploads/miss.png"
                          alt=""
                          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
                          draggable={false}
                        />
                      )}

                      <div className="relative z-10" style={{ marginTop: '200px' }}>
                        {form.letterNo && (
                          <div style={{ position: 'absolute', top: '-110px', left: '0px', paddingTop: '98px', fontFamily: '"Khmer OS Siemreap", Arial, sans-serif', fontSize: '16px' }}>
                            {toKhmerDigitsString(form.letterNo)}
                          </div>
                        )}
                        <div className="text-center font-nomal text-[20px] mb-6" style={{ fontFamily: 'Khmer OS Muol Light', paddingTop: '32px' }}>
                          <div>{form.subject}</div>
                          <div className="flex justify-center mt-1">
                            <img src="/3.JPG" alt="ornament" style={{ height: '15px' }} />
                          </div>
                        </div>

                        <div className="doc-row">
                          <div className="doc-label">យោង៖</div>
                          <div className="doc-value" dangerouslySetInnerHTML={{ __html: (() => {
                            let html = (form.recipient || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>').replace(/\t/g, '<span style="display:inline-block; width:80px;"></span>');
                            const n = form.officer || searchParams.get('name'), d = form.department || searchParams.get('department'), p = searchParams.get('position');
                            if (n && n !== '......') html = html.split(n).join(`<span style="font-family: 'Khmer OS Muol Light'">${n}</span>`);
                            if (d && d !== '......') html = html.split(d).join(`<span style="font-family: 'Khmer OS Muol Light'">${d}</span>`);
                            if (p && p !== '......') html = html.split(p).join(`<span style="font-family: 'Khmer OS Muol Light'">${p}</span>`);
                            return html;
                          })() }} />
                        </div>

                        <div className="doc-body" dangerouslySetInnerHTML={{ __html: (() => {
                            let rawBody = (form.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            if (rawBody.includes('ចម្លងជូន:')) {
                              rawBody = rawBody.split('ចម្លងជូន:')[0];
                            }
                            let htmlBody = rawBody.replace(/\n/g, '<br/>').replace(/\t/g, '<span style="display:inline-block; width:80px;"></span>');
                            
                            const n = form.officer || searchParams.get('name');
                            const d = form.department || searchParams.get('department');
                            const p = searchParams.get('position');
                            const nr = form.newRole;

                            if (n && n !== '......') htmlBody = htmlBody.split(n).join(`<span style="font-family: 'Khmer OS Muol Light'">${n}</span>`);
                            if (d && d !== '......') htmlBody = htmlBody.split(d).join(`<span style="font-family: 'Khmer OS Muol Light'">${d}</span>`);
                            if (p && p !== '......') htmlBody = htmlBody.split(p).join(`<span style="font-family: 'Khmer OS Muol Light'">${p}</span>`);
                            if (nr && nr !== '......') htmlBody = htmlBody.split(nr).join(`<span style="font-family: 'Khmer OS Muol Light'">${nr}</span>`);

                            let htmlBody1 = '';
                            if (form.body1) {
                              let rawBody1 = form.body1.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                              if (rawBody1.includes('ចម្លងជូន:')) {
                                rawBody1 = rawBody1.split('ចម្លងជូន:')[0];
                              }
                              let formattedBody1 = rawBody1.replace(/\n/g, '<br/>').replace(/\t/g, '<span style="display:inline-block; width:80px;"></span>');
                              htmlBody1 = '<br/><br/><span style="font-family: \'Khmer OS Siemreap\', sans-serif;">' + formattedBody1 + '</span>';
                            }
                            return htmlBody + htmlBody1;
                          })() }} />

                        <div className="doc-sign">
                          {templateType !== 'maternity' && (
                            <>
                              {form.dateText && <div className="place-date" style={{ marginBottom: '5px' }}>{form.dateText}</div>}
                              <div className="place-date">{form.signPlace}, {formatDateKhmer(form.createdAt)}</div>
                            </>
                          )}
                          <div className="sign-title">{form.signTitle}</div>
                          {templateType !== 'maternity' && (
                            <div className="sign-name">{form.signName}</div>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const raw = (form.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        if (raw.includes('ចម្លងជូន:')) {
                          const ccPart = 'ចម្លងជូន:' + raw.split('ចម្លងជូន:')[1];
                          return (
                            <div className="absolute" style={{ bottom: '10mm', left: '28mm', fontSize: '10pt', fontFamily: '"Khmer OS Siemreap", Arial, sans-serif', whiteSpace: 'pre-line', lineHeight: '1.4', zIndex: 20 }} dangerouslySetInnerHTML={{ __html: ccPart }} />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">ចុច "បង្កើត" ឬជ្រើសរើសគំរូដើម្បីមើល</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
