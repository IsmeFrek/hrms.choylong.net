
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
// Lucide icons replaced with emojis for stability
import api, { employeeAPI } from '../services/api';
import HRAPI from '../services/hrAPI';
import { skillAPI } from '../services/skillAPI';
import { positionAPI } from '../services/positionAPI';
import { isExplicitlyRemoved as _isExplicitlyRemoved, isCountedActive as _isCountedActive, hasResignData as _hasResignData } from '../utils/hrFilters';
import { useNavigate } from 'react-router-dom';
import usePermission from '../hooks/usePermission';

const Dashboard = () => {
  const navigate = useNavigate();

  // Helper: Convert digits to Khmer
  const toKhmerDigits = (n) => {
    if (n === undefined || n === null) return '';
    const khmer = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
    return String(n).replace(/[0-9]/g, (w) => khmer[+w]);
  };
  const perms = usePermission();
  const canViewHR = perms?.isAdmin || perms?.has?.('view:dashboard');

  // Removed inline edit modal; navigate to employee edit listing instead
  // Normalize image path for backend images
  const getImageSrc = (image) => {
    if (!image) return '';
    if (image.startsWith('/uploads/')) {
      return `${API_BASE}${image}`;
    }
    return image;
  };
  const getEmployeeDisplayName = (emp) => {
    if (!emp) return 'គ្មានឈ្មោះ';
    return (
      emp.name || emp.fullName || emp.employeeName || emp.khmerName || emp.khmer_name || emp.displayName || emp.staffName || emp.no || 'គ្មានឈ្មោះ'
    );
  };
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    newThisMonth: 0,
    stoppedThisMonth: 0,
    departments: 0
  });
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [departmentList, setDepartmentList] = useState([]);
  const [metricsExtra, setMetricsExtra] = useState({
    studyLeave: 0,
    vacancies: 0,
    retirements: 0,
    officerTypes: [],
    skills: [],
    positions: [],
    leaveTypes: []
  });
  const [studyStatusCounts, setStudyStatusCounts] = useState({
    preparing: { total: 0, female: 0 },
    studying: { total: 0, female: 0 },
    returned: { total: 0, female: 0 },
    total: 0,
    femaleTotal: 0
  });
  const [vacancyCounts, setVacancyCounts] = useState({ total: 0, female: 0 });
  const [vacancyStatusCounts, setVacancyStatusCounts] = useState({
    preparing: { total: 0, female: 0 },
    ongoing: { total: 0, female: 0 },
    returned: { total: 0, female: 0 },
    total: 0,
    femaleTotal: 0
  });
  const [retirementCounts, setRetirementCounts] = useState({ total: 0, male: 0, female: 0, civil: { total: 0, female: 0 }, contract: { total: 0, female: 0 } });
  const [genderCounts, setGenderCounts] = useState({ male: 0, female: 0, other: 0 });
  const [genderBreakdowns, setGenderBreakdowns] = useState({
    total: { male: 0, female: 0, other: 0 },
    active: { male: 0, female: 0, other: 0 },
    newThisMonth: { male: 0, female: 0, other: 0 },
    stoppedThisMonth: { male: 0, female: 0, other: 0 },
    studyLeave: { male: 0, female: 0, other: 0 },
    vacancies: { male: 0, female: 0, other: 0 },
    retirements: { male: 0, female: 0, other: 0 }
  });
  const [workScheduleDaily, setWorkScheduleDaily] = useState({
    totalSchedules: 0,
    workingToday: 0,
    dayOffToday: 0,
    dayShift: 0,
    nightShift: 0,
    shift24Hours: 0
  });
  const [missingCounts, setMissingCounts] = useState({ phone: 0, position: 0, department: 0, image: 0, signature: 0 });
  const [missionToday, setMissionToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState({
    civil: { joined: 0, stopped: 0 },
    state: { joined: 0, stopped: 0 },
    hospital: { joined: 0, stopped: 0 },
    contract: { joined: 0, stopped: 0 }
  });

  const normSkill = (s) => {
    try { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); } catch { return ''; }
  };
  const normPos = (p) => {
    try { return String(p || '').trim().replace(/\s+/g, ' ').toLowerCase(); } catch { return ''; }
  };
  const [attendanceToday, setAttendanceToday] = useState({
    total: 0,
    present: 0,
    absent: 0,
    eveningPending: 0,
    leave: 0,
    late: 0,
    early: 0
  });
  const [probationStatusCounts, setProbationStatusCounts] = useState({
    ongoing: 0,
    endingSoon: 0,
    completedRecent: 0,
    total: 0
  });
  const [leaveBreakdown, setLeaveBreakdown] = useState({});
  const [deptAttendanceMetrics, setDeptAttendanceMetrics] = useState({});
  const [skillAttendanceMetrics, setSkillAttendanceMetrics] = useState({});
  const [posAttendanceMetrics, setPosAttendanceMetrics] = useState({});

  const [showSkills, setShowSkills] = useState(false);
  const [showPositions, setShowPositions] = useState(false);
  const [showDepartments, setShowDepartments] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [deptSortKey, setDeptSortKey] = useState('absent'); // Default sort by Absent
  const [showRoleEmployeesModal, setShowRoleEmployeesModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [roleEmployees, setRoleEmployees] = useState([]);
  const [showSkillEmployeesModal, setShowSkillEmployeesModal] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [skillEmployees, setSkillEmployees] = useState([]);

  const handleRoleClick = (roleName) => {
    const emps = allEmployees.filter(emp => {
      const pos = emp.Position_Kh || emp.position || '';
      return pos === roleName;
    });
    setRoleEmployees(emps);
    setSelectedRole(roleName);
    setShowRoleEmployeesModal(true);
  };

  const handlePrintRoleEmployees = () => {
    const dateStr = new Date().toLocaleDateString('km-KH', { day: '2-digit', month: 'long', year: 'numeric' });
    const username = localStorage.getItem('username') || 'Admin';

    const tableRows = roleEmployees.map((emp, idx) => `
      <tr>
        <td style="border:1px solid #000; padding:6px; text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #000; padding:6px; font-weight:bold;">${emp.khmerName || emp.fullName || emp.name}</td>
        <td style="border:1px solid #000; padding:6px; text-align:center;">${emp.gender === 'Male' ? 'ប្រុស' : emp.gender === 'Female' ? 'ស្រី' : emp.gender || ''}</td>
        <td style="border:1px solid #000; padding:6px; text-align:center;">${emp.dob ? (() => {
          const d = new Date(emp.dob);
          if (isNaN(d)) return emp.dob;
          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        })() : ''}</td>
        <td style="border:1px solid #000; padding:6px;">${emp.officerType || ''}</td>
        <td style="border:1px solid #000; padding:6px;">${emp.skill || ''}</td>
        <td style="border:1px solid #000; padding:6px;">${emp.Position_Kh || emp.position || ''}</td>
        <td style="border:1px solid #000; padding:6px; text-align:center;">${emp.phone || ''}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>បញ្ជីបុគ្គលិកតាមតួនាទី</title>
      <style>
        @page { size: A4 portrait; margin: 1.5cm; }
        body { font-family: 'Khmer OS Siemreap', sans-serif; font-size: 11px; line-height: 1.4; }
        h1 { font-family: 'Khmer OS Muol Light', serif; font-size: 14px; text-align: center; margin-bottom: 5px; }
        h2 { font-family: 'Khmer OS Muol Light', serif; font-size: 12px; text-align: center; margin-bottom: 20px; }
        h3 { font-size: 12px; font-weight: bold; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f3f4f6; font-weight: bold; text-align: center; }
        .text-center { text-align: center; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; }
        .sig-box { text-align: center; min-width: 200px; }
        .sig-line { margin-top: 60px; border-bottom: 1px dashed #000; }
        @media print {
          body { background: white; }
          button { display: none; }
        }
      </style>
      </head>
      <body>
        <h1>ព្រះរាជាណាចក្រកម្ពុជា</h1>
        <h2>ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
        
        <h3>បញ្ជីរាយនាមបុគ្គលិកតួនាទី៖ ${selectedRole}</h3>
        <p>ចំនួនសរុប៖ ${roleEmployees.length} នាក់</p>
        
        <table>
          <thead>
            <tr>
              <th style="border:1px solid #000; padding:6px;">ល.រ</th>
              <th style="border:1px solid #000; padding:6px;">គោត្តនាម និងនាម</th>
              <th style="border:1px solid #000; padding:6px;">ភេទ</th>
              <th style="border:1px solid #000; padding:6px;">ថ្ងៃខែឆ្នាំកំណើត</th>
              <th style="border:1px solid #000; padding:6px;">ប្រភេទមន្រ្តី</th>
              <th style="border:1px solid #000; padding:6px;">ជំនាញ</th>
              <th style="border:1px solid #000; padding:6px;">តួនាទី</th>
              <th style="border:1px solid #000; padding:6px;">លេខទូរស័ព្ទ</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <div class="footer">
          <div>បោះពុម្ពដោយ: ${username}</div>
          <div class="sig-box">
            <p>${dateStr}</p>
            <p style="font-weight:bold; margin-top:5px;">ហត្ថលេខា និងត្រា</p>
            <div class="sig-line"></div>
          </div>
        </div>
        
        <script>window.onload=()=>{window.print();}</script>
      </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const handlePrintAllRoles = () => {
    const dateStr = new Date().toLocaleDateString('km-KH', { day: '2-digit', month: 'long', year: 'numeric' });
    const username = localStorage.getItem('username') || 'Admin';

    let contentHtml = '';

    metricsExtra.positions.forEach(p => {
      const emps = allEmployees.filter(emp => (emp.Position_Kh || emp.position) === p.type);
      if (emps.length === 0) return;

      const tableRows = emps.map((emp, idx) => `
        <tr>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #000; padding:4px; font-weight:bold;">${emp.khmerName || emp.fullName || emp.name}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${emp.gender === 'Male' ? 'ប្រុស' : emp.gender === 'Female' ? 'ស្រី' : emp.gender || ''}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${emp.dob ? (() => {
            const d = new Date(emp.dob);
            if (isNaN(d)) return emp.dob;
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          })() : ''}</td>
          <td style="border:1px solid #000; padding:4px;">${emp.officerType || ''}</td>
          <td style="border:1px solid #000; padding:4px;">${emp.skill || ''}</td>
          <td style="border:1px solid #000; padding:4px;">${emp.Position_Kh || emp.position || ''}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${emp.phone || ''}</td>
        </tr>
      `).join('');

      contentHtml += `
        <h3 style="margin-top:15px; margin-bottom:5px;">តួនាទី៖ ${p.type} (${emps.length} នាក់)</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px; font-size:10px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="border:1px solid #000; padding:4px;">ល.រ</th>
              <th style="border:1px solid #000; padding:4px;">គោត្តនាម និងនាម</th>
              <th style="border:1px solid #000; padding:4px;">ភេទ</th>
              <th style="border:1px solid #000; padding:4px;">ថ្ងៃខែឆ្នាំកំណើត</th>
              <th style="border:1px solid #000; padding:4px;">ប្រភេទមន្រ្តី</th>
              <th style="border:1px solid #000; padding:4px;">ជំនាញ</th>
              <th style="border:1px solid #000; padding:4px;">តួនាទី</th>
              <th style="border:1px solid #000; padding:4px;">លេខទូរស័ព្ទ</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
    });

    const html = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>បញ្ជីបុគ្គលិកគ្រប់តួនាទី</title>
      <style>
        @page { size: A4 portrait; margin: 1.5cm; }
        body { font-family: 'Khmer OS Siemreap', sans-serif; font-size: 11px; line-height: 1.4; }
        h1 { font-family: 'Khmer OS Muol Light', serif; font-size: 14px; text-align: center; margin-bottom: 5px; }
        h2 { font-family: 'Khmer OS Muol Light', serif; font-size: 12px; text-align: center; margin-bottom: 20px; }
        h3 { font-size: 11px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th { font-weight: bold; text-align: center; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; }
        .sig-box { text-align: center; min-width: 200px; }
        .sig-line { margin-top: 50px; border-bottom: 1px dashed #000; }
        @media print {
          body { background: white; }
          button { display: none; }
          table { page-break-inside: avoid; }
          h3 { page-break-after: avoid; }
        }
      </style>
      </head>
      <body>
        <h1>ព្រះរាជាណាចក្រកម្ពុជា</h1>
        <h2>ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
        
        <h2 style="text-align:center; font-family:'Khmer OS Muol Light'; margin-bottom:15px;">បញ្ជីរាយនាមបុគ្គលិកគ្រប់តួនាទី</h2>
        
        ${contentHtml}
        
        <div class="footer">
          <div>បោះពុម្ពដោយ: ${username}</div>
          <div class="sig-box">
            <p>${dateStr}</p>
            <p style="font-weight:bold; margin-top:5px;">ហត្ថលេខា និងត្រា</p>
            <div class="sig-line"></div>
          </div>
        </div>
        
        <script>window.onload=()=>{window.print();}</script>
      </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const handleSkillClick = (skillName) => {
    const emps = allEmployees.filter(emp => (emp.skill || '') === skillName);
    setSkillEmployees(emps);
    setSelectedSkill(skillName);
    setShowSkillEmployeesModal(true);
  };

  const handlePrintSkillEmployees = () => {
    const dateStr = new Date().toLocaleDateString('km-KH', { day: '2-digit', month: 'long', year: 'numeric' });
    const username = localStorage.getItem('username') || 'Admin';

    const tableRows = skillEmployees.map((emp, idx) => `
      <tr>
        <td style="border:1px solid #000; padding:6px; text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #000; padding:6px; font-weight:bold;">${emp.khmerName || emp.fullName || emp.name}</td>
        <td style="border:1px solid #000; padding:6px; text-align:center;">${emp.gender === 'Male' ? 'ប្រុស' : emp.gender === 'Female' ? 'ស្រី' : emp.gender || ''}</td>
        <td style="border:1px solid #000; padding:6px; text-align:center;">${emp.dob ? (() => {
          const d = new Date(emp.dob);
          if (isNaN(d)) return emp.dob;
          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        })() : ''}</td>
        <td style="border:1px solid #000; padding:6px;">${emp.officerType || ''}</td>
        <td style="border:1px solid #000; padding:6px;">${emp.skill || ''}</td>
        <td style="border:1px solid #000; padding:6px;">${emp.Position_Kh || emp.position || ''}</td>
        <td style="border:1px solid #000; padding:6px; text-align:center;">${emp.phone || ''}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>បញ្ជីបុគ្គលិកតាមជំនាញ</title>
      <style>
        @page { size: A4 portrait; margin: 1.5cm; }
        body { font-family: 'Khmer OS Siemreap', sans-serif; font-size: 11px; line-height: 1.4; }
        h1 { font-family: 'Khmer OS Muol Light', serif; font-size: 14px; text-align: center; margin-bottom: 5px; }
        h2 { font-family: 'Khmer OS Muol Light', serif; font-size: 12px; text-align: center; margin-bottom: 20px; }
        h3 { font-size: 12px; font-weight: bold; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f3f4f6; font-weight: bold; text-align: center; }
        .text-center { text-align: center; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; }
        .sig-box { text-align: center; min-width: 200px; }
        .sig-line { margin-top: 60px; border-bottom: 1px dashed #000; }
        @media print {
          body { background: white; }
          button { display: none; }
        }
      </style>
      </head>
      <body>
        <h1>ព្រះរាជាណាចក្រកម្ពុជា</h1>
        <h2>ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
        
        <h3>បញ្ជីរាយនាមបុគ្គលិកជំនាញ៖ ${selectedSkill}</h3>
        <p>ចំនួនសរុប៖ ${skillEmployees.length} នាក់</p>
        
        <table>
          <thead>
            <tr>
              <th style="border:1px solid #000; padding:6px;">ល.រ</th>
              <th style="border:1px solid #000; padding:6px;">គោត្តនាម និងនាម</th>
              <th style="border:1px solid #000; padding:6px;">ភេទ</th>
              <th style="border:1px solid #000; padding:6px;">ថ្ងៃខែឆ្នាំកំណើត</th>
              <th style="border:1px solid #000; padding:6px;">ប្រភេទមន្រ្តី</th>
              <th style="border:1px solid #000; padding:6px;">ជំនាញ</th>
              <th style="border:1px solid #000; padding:6px;">តួនាទី</th>
              <th style="border:1px solid #000; padding:6px;">លេខទូរស័ព្ទ</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <div class="footer">
          <div>បោះពុម្ពដោយ: ${username}</div>
          <div class="sig-box">
            <p>${dateStr}</p>
            <p style="font-weight:bold; margin-top:5px;">ហត្ថលេខា និងត្រា</p>
            <div class="sig-line"></div>
          </div>
        </div>
        
        <script>window.onload=()=>{window.print();}</script>
      </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const handlePrintAllSkills = () => {
    const dateStr = new Date().toLocaleDateString('km-KH', { day: '2-digit', month: 'long', year: 'numeric' });
    const username = localStorage.getItem('username') || 'Admin';

    let contentHtml = '';

    metricsExtra.skills.forEach(s => {
      const emps = allEmployees.filter(emp => (emp.skill || '') === s.type);
      if (emps.length === 0) return;

      const tableRows = emps.map((emp, idx) => `
        <tr>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #000; padding:4px; font-weight:bold;">${emp.khmerName || emp.fullName || emp.name}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${emp.gender === 'Male' ? 'ប្រុស' : emp.gender === 'Female' ? 'ស្រី' : emp.gender || ''}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${emp.dob ? (() => {
            const d = new Date(emp.dob);
            if (isNaN(d)) return emp.dob;
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          })() : ''}</td>
          <td style="border:1px solid #000; padding:4px;">${emp.officerType || ''}</td>
          <td style="border:1px solid #000; padding:4px;">${emp.skill || ''}</td>
          <td style="border:1px solid #000; padding:4px;">${emp.Position_Kh || emp.position || ''}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${emp.phone || ''}</td>
        </tr>
      `).join('');

      contentHtml += `
        <h3 style="margin-top:15px; margin-bottom:5px;">ជំនាញ៖ ${s.type} (${emps.length} នាក់)</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px; font-size:10px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="border:1px solid #000; padding:4px;">ល.រ</th>
              <th style="border:1px solid #000; padding:4px;">គោត្តនាម និងនាម</th>
              <th style="border:1px solid #000; padding:4px;">ភេទ</th>
              <th style="border:1px solid #000; padding:4px;">ថ្ងៃខែឆ្នាំកំណើត</th>
              <th style="border:1px solid #000; padding:4px;">ប្រភេទមន្រ្តី</th>
              <th style="border:1px solid #000; padding:4px;">ជំនាញ</th>
              <th style="border:1px solid #000; padding:4px;">តួនាទី</th>
              <th style="border:1px solid #000; padding:4px;">លេខទូរស័ព្ទ</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
    });

    const html = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>បញ្ជីបុគ្គលិកគ្រប់ជំនាញ</title>
      <style>
        @page { size: A4 portrait; margin: 1.5cm; }
        body { font-family: 'Khmer OS Siemreap', sans-serif; font-size: 11px; line-height: 1.4; }
        h1 { font-family: 'Khmer OS Muol Light', serif; font-size: 14px; text-align: center; margin-bottom: 5px; }
        h2 { font-family: 'Khmer OS Muol Light', serif; font-size: 12px; text-align: center; margin-bottom: 20px; }
        h3 { font-size: 11px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th { font-weight: bold; text-align: center; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; }
        .sig-box { text-align: center; min-width: 200px; }
        .sig-line { margin-top: 50px; border-bottom: 1px dashed #000; }
        @media print {
          body { background: white; }
          button { display: none; }
          table { page-break-inside: avoid; }
          h3 { page-break-after: avoid; }
        }
      </style>
      </head>
      <body>
        <h1>ព្រះរាជាណាចក្រកម្ពុជា</h1>
        <h2>ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
        
        <h2 style="text-align:center; font-family:'Khmer OS Muol Light'; margin-bottom:15px;">បញ្ជីរាយនាមបុគ្គលិកគ្រប់ជំនាញ</h2>
        
        ${contentHtml}
        
        <div class="footer">
          <div>បោះពុម្ពដោយ: ${username}</div>
          <div class="sig-box">
            <p>${dateStr}</p>
            <p style="font-weight:bold; margin-top:5px;">ហត្ថលេខា និងត្រា</p>
            <div class="sig-line"></div>
          </div>
        </div>
        
        <script>window.onload=()=>{window.print();}</script>
      </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const handlePrintReport = () => {
    const dateStr = new Date().toLocaleDateString('km-KH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const username = localStorage.getItem('username') || 'Admin';

    // --- Helpers ---
    const mkCard = (id, num, icon, title, gradient, bodyHtml, rowCount, cols2 = false) => ({
      id, num, icon, title, gradient,
      rowCount,
      html: `<div class="card">
        <div class="ch" style="background:${gradient}">${icon} ${num}. ${title}</div>
        <div class="cb${cols2 ? ' cols2' : ''}">${bodyHtml}</div>
      </div>`
    });

    const row = (label, value, color = '#1d4ed8', sub = '') =>
      `<div class="r"><span class="rl">${label}</span><strong class="rv" style="color:${color}">${value}</strong></div>${sub ? `<div class="rs">${sub}</div>` : ''}`;

    const subRow = (label, value) =>
      `<div class="r sub"><span class="rl">${label}</span><span class="rv" style="color:#374151">${value}</span></div>`;

    const pair = (L, R) => `
      <div class="row2">
        <div class="col-l">${L}</div>
        <div class="col-r">${R}</div>
        <div style="clear:both"></div>
      </div>`;

    const row3 = (A, B, C) => `
      <div class="row3">
        <div class="col3">${A}</div>
        <div class="col3">${B}</div>
        <div class="col3">${C}</div>
        <div style="clear:both"></div>
      </div>`;

    const full = (C) => `<div class="rowF">${C}</div>`;

    // ---- Build each section + count rows ----

    // Section 1
    const officers = metricsExtra.officerTypesDetailed || metricsExtra.officerTypes;
    const s1body = row('បុគ្គលិករាប់ (Active):', `${stats.activeEmployees} នាក់`, '#1d4ed8') +
      row('ថ្មីខែនេះ:', `+${stats.newThisMonth} នាក់`, '#059669') +
      row('ឈប់ខែនេះ:', `-${stats.stoppedThisMonth} នាក់`, '#dc2626') +
      `<div class="sst">ប្រភេទមន្ត្រី:</div>` +
      officers.map(o => subRow(o.type + ':', `${o.count} នាក់ (ស: ${o.female})`)).join('');
    const c1 = mkCard('s1', '១', '👥', 'ស្ថិតិបុគ្គលិករួម', 'linear-gradient(135deg,#1e40af,#3b82f6)', s1body, 3 + officers.length);

    // Section 2
    const attItems = [
      ['ត្រូវមក', attendanceToday.total, '#374151'], ['វត្តមាន', attendanceToday.present, '#059669'],
      ['អវត្តមាន', attendanceToday.absent, '#dc2626'], ['ច្បាប់', attendanceToday.leave, '#d97706'],
      ['ចូលយឺត', attendanceToday.late, '#ea580c'], ['ចេញមុន', attendanceToday.early, '#ea580c'],
      ['វេនល្ងាច', attendanceToday.eveningPending, '#2563eb'],
    ];
    const c2 = mkCard('s2', '២', '📊', 'វត្តមានបុគ្គលិកប្រចាំថ្ងៃ', 'linear-gradient(135deg,#059669,#0d9488)',
      attItems.map(([l, v, cc]) => row(l + ':', `${v} នាក់`, cc)).join(''), attItems.length);

    // Section 3
    const s3body = row('បេសកកម្មថ្ងៃនេះ:', `${missionToday.length} នាក់`, '#4f46e5',
      missionToday.length > 0 ? missionToday.slice(0, 4).map(m => m.khmerName || m.name).join(', ') + (missionToday.length > 4 ? '...' : '') : '') +
      row('ទៅសិក្សា (សរុប):', `${studyStatusCounts.total} នាក់`, '#7c3aed',
        `កំពុង: ${studyStatusCounts.studying?.total || 0} | ត្រៀម: ${studyStatusCounts.preparing?.total || 0}`) +
      row('ទំនេរគ្មានបៀវត្ស:', `${vacancyStatusCounts.total} នាក់`, '#db2777');
    const c3 = mkCard('s3', '៣', '✈️', 'បេសកកម្ម និងការសិក្សា', 'linear-gradient(135deg,#4f46e5,#7c3aed)', s3body, 3);

    // Section 4
    const sortedDepts = [...departmentList].sort((a, b) => {
      const mA = deptAttendanceMetrics[a.name] || {};
      const mB = deptAttendanceMetrics[b.name] || {};
      const absA = mA.absent || 0;
      const absB = mB.absent || 0;
      if (absB !== absA) return absB - absA;
      const lA = mA.leave || 0;
      const lB = mB.leave || 0;
      if (lB !== lA) return lB - lA;
      return b.count - a.count;
    });

    const deptHtml = sortedDepts.map(d => {
      const m = deptAttendanceMetrics[d.name] || {};
      const metrics = [
        { label: 'អ', val: m.absent || 0, cls: 'r' },
        { label: 'ច', val: m.leave || 0, cls: 'a' },
        { label: 'យ', val: m.late || 0, cls: 'o' },
        { label: 'ម', val: m.early || 0, cls: 'o' }
      ];
      const badges = metrics.map(mt =>
        `<div class="mt-box">${mt.val > 0 ? `<span class="bd ${mt.cls}">${mt.label}:${mt.val}</span>` : `<span class="bd-off">${mt.label}:0</span>`}</div>`
      ).join('');

      return `
        <div class="r">
          <span class="rl" style="font-weight:700;">${d.name}</span>
          <div style="display:flex;align-items:center;gap:0;flex-shrink:0;">
            <div class="bd-skill total" style="width:55px;padding:2px 0;margin-right:2px;"><span style="color:#6b7280;font-weight:normal;">សរុប:</span>${d.count}</div>
            <div class="bd-skill male" style="width:40px;padding:2px 0;margin-right:2px;"><span style="color:#3b82f6;font-weight:normal;">ប:</span>${d.male || 0}</div>
            <div class="bd-skill female" style="width:40px;padding:2px 0;margin-right:8px;"><span style="color:#7e22ce;font-weight:normal;">ស:</span>${d.female || 0}</div>
            ${badges}
          </div>
        </div>`;
    }).join('');
    const c4 = mkCard('s4', '៤', '🏢', `ផ្នែក / ការិយាល័យ (${stats.departments} ផ្នែក)`, 'linear-gradient(135deg,#7c3aed,#9333ea)', deptHtml, departmentList.length, false);

    const skillHtml = metricsExtra.skills.map(s => {
      return `
        <div class="r${s.isGroup ? ' gr' : ''}">
          <span class="rl" style="font-weight:700;">${s.type}</span>
          <div style="display:flex;align-items:center;gap:0;flex-shrink:0;">
            <div class="bd-skill total" style="width:55px;padding:2px 0;margin-right:2px;"><span style="color:#6b7280;font-weight:normal;">សរុប:</span>${s.count}</div>
            <div class="bd-skill male" style="width:40px;padding:2px 0;margin-right:2px;"><span style="color:#3b82f6;font-weight:normal;">ប:</span>${s.male || 0}</div>
            <div class="bd-skill female" style="width:40px;padding:2px 0;margin-right:8px;"><span style="color:#7e22ce;font-weight:normal;">ស:</span>${s.female || 0}</div>
          </div>
        </div>`;
    }).join('');
    const c5 = mkCard('s5', '៥', '🏅', 'សង្ខេបជំនាញ', 'linear-gradient(135deg,#d97706,#f59e0b)', skillHtml, metricsExtra.skills.length, false);

    const posHtml = metricsExtra.positions.map(p => {
      return `
        <div class="r">
          <span class="rl" style="font-weight:700;">${p.type}</span>
          <div style="display:flex;align-items:center;gap:0;flex-shrink:0;">
            <div class="bd-skill total" style="width:55px;padding:2px 0;margin-right:2px;"><span style="color:#6b7280;font-weight:normal;">សរុប:</span>${p.count}</div>
            <div class="bd-skill male" style="width:40px;padding:2px 0;margin-right:2px;"><span style="color:#3b82f6;font-weight:normal;">ប:</span>${p.male || 0}</div>
            <div class="bd-skill female" style="width:40px;padding:2px 0;margin-right:8px;"><span style="color:#7e22ce;font-weight:normal;">ស:</span>${p.female || 0}</div>
          </div>
        </div>`;
    }).join('');
    const c6 = mkCard('s6', '៦', '🎖️', 'សង្ខេបតួនាទី', 'linear-gradient(135deg,#0284c7,#0ea5e9)', posHtml, metricsExtra.positions.length, false);

    // Section 7
    const prob = [['សាកល្បងសរុប', probationStatusCounts.total, '#0284c7'], ['កំពុងសាកល្បង', probationStatusCounts.ongoing, '#374151'], ['ជិតចប់ (30ថ្ងៃ)', probationStatusCounts.endingSoon, '#dc2626'], ['បញ្ចប់ថ្មីៗ', probationStatusCounts.completedRecent, '#059669']];
    const c7 = mkCard('s7', '៧', '⏳', 'ស្ថានភាពសាកល្បងបុគ្គលិក', 'linear-gradient(135deg,#0d9488,#059669)', prob.map(([l, v, cc]) => row(l + ':', `${v} នាក់`, cc)).join(''), prob.length);

    // Section 8-9
    const sched = [['🧑‍💼 ធ្វើការ', workScheduleDaily.workingToday ?? 0, '#1d4ed8'], ['🌅 វេនព្រឹក', workScheduleDaily.dayShift ?? 0, '#d97706'], ['🌙 វេនយប់', workScheduleDaily.nightShift ?? 0, '#7c3aed'], ['🕐 វេន 24h', workScheduleDaily.shift24Hours ?? 0, '#4f46e5'], ['🏖️ Day Off', workScheduleDaily.dayOffToday ?? 0, '#0284c7'], ['⚠️ មិនកំណត់', workScheduleDaily.notScheduled ?? 0, '#dc2626']];
    const c89 = mkCard('s89', '៨-៩', '📅', 'កាលវិភាគការងារ (Work Schedule)', 'linear-gradient(135deg,#1e40af,#4f46e5)', sched.map(([l, v, cc]) => row(l + ':', `${v} នាក់`, cc)).join(''), sched.length);

    // Section 10
    const leaveBody = metricsExtra.leaveTypes.length === 0
      ? '<div style="text-align:center;color:#9ca3af;padding:12px;font-style:italic;">មិនមានច្បាប់ក្នុងខែនេះ</div>'
      : metricsExtra.leaveTypes.map(l => row(l.type + ':', `${l.count} នាក់`, '#d97706', `(ប:${l.male}|ស:${l.female})`)).join('');
    const c10 = mkCard('s10', '១០', '📋', 'ប្រភេទច្បាប់ (ខែនេះ)', 'linear-gradient(135deg,#d97706,#f59e0b)', leaveBody, Math.max(metricsExtra.leaveTypes.length, 1));
    // ---- Layout with Full-Width 4, 5, 6 (as requested) ----
    // ---- Optimized Layout for Data Density ----
    let bodyHtmlContent = '';
    // Row 1: Summary Statistics (Sections 1, 2)
    bodyHtmlContent += pair(c1.html, c2.html);
    // Row 2: Status & Schedule (Sections 7, 8-9, 10)
    bodyHtmlContent += row3(c7.html, c89.html, c10.html);
    // Row 3: Missions (Section 3)
    bodyHtmlContent += full(c3.html);
    // Rows 3-4: Detailed Lists (Sections 4, 6, 5)
    bodyHtmlContent += full(c4.html);
    bodyHtmlContent += pair(c6.html, c5.html);


    const html = `<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8"/>
<title>របាយការណ៍សង្ខេបស្ថានភាពបុគ្គលិក</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@300;400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Khmer OS Siemreap','Noto Sans Khmer',sans-serif;font-size:10px;color:#1f2937;background:#f1f5f9;padding:8px;line-height:1.2;}

  /* Doc header */
  .dh{background:white;border-radius:10px;text-align:center;padding:8px 12px;margin-bottom:8px;border-bottom:3px solid #1e40af;}
  .dh h1{font-family:'Khmer OS Muol Light',serif;font-size:13px;margin-bottom:1px;}
  .dh h2{font-family:'Khmer OS Muol Light',serif;font-size:12px;margin-bottom:4px;}
  .dh h3{font-size:11px;font-weight:700;color:#1e3a8a;}
  .dh p{color:#6b7280;font-size:9px;margin-top:1px;}

  /* KPI strip (float, not grid) */
  .kpi-strip{overflow:hidden;margin-bottom:6px;}
  .kpi{float:left;width:24%;margin-right:1.33%;border-radius:8px;padding:6px 5px;color:white;text-align:center;}
  .kpi:last-child{margin-right:0;}
  .kv{font-size:15px;font-weight:700;line-height:1.1;}
  .kl{font-size:8px;opacity:0.9;margin-top:1px;}

  /* Layout rows — float (NOT grid, avoids page-break between columns) */
  .row2{overflow:hidden;margin-bottom:8px;}
  .col-l{float:left;width:49%;margin-right:2%;}
  .col-r{float:left;width:49%;}
  .row3{overflow:hidden;margin-bottom:8px;}
  .col3{float:left;width:32%;margin-right:2%;}
  .col3:last-child{margin-right:0;}
  .rowF{margin-bottom:8px;}

  /* Card */
  .card{background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;}
  .ch{color:white;padding:6px 10px;font-weight:700;font-size:10.5px;display:flex;align-items:center;gap:4px;}
  .cb{padding:4px 10px 6px;}
  .cb.cols2{column-count:2;column-gap:8px;}
  .cb.cols2 .r{break-inside:avoid;}

  /* Rows */
  .r{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:10.5px;}
  .r:last-child{border-bottom:none;}
  .r.sub{padding:2px 0 2px 10px;opacity:0.85;}
  .r.gr{background:#fffbeb;padding:3px 5px;border-radius:3px;margin:1px 0;}
  .rl{color:#374151;flex:1;padding-right:6px;}
  .rv{font-weight:700;font-size:11px;text-align:right;flex-shrink:0;}
  .rs{font-size:9px;color:#6b7280;padding:1px 0 3px;}
  .sst{font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;margin:5px 0 2px;}
  .gd{color:#9ca3af;font-size:8px;}

  /* Badges */
  .bd{padding:1px 4px;border-radius:3px;font-size:8px;font-weight:700;margin-left:1px;display:inline-block;min-width:26px;text-align:center;border:1px solid transparent;}
  .bd.r{background:#dc2626!important;color:white!important;}
  .bd.a{background:#fbbf24!important;color:white!important;}
  .bd.o{background:#fff7ed!important;color:#ea580c!important;border:1px solid #fed7aa!important;}
  .bd-off{color:#e5e7eb;font-size:8px;font-weight:400;}
  .mt-box{width:32px;text-align:center;display:inline-block;}

  .bd-skill{padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;text-align:center;min-width:40px;border:1px solid #e5e7eb;}
  .bd-skill.total{background:white!important;color:#111827!important;min-width:45px;}
  .bd-skill.male{background:#eff6ff!important;color:#1d4ed8!important;border-color:#dbeafe!important;min-width:35px;}
  .bd-skill.female{background:#f5f3ff!important;color:#7e22ce!important;border-color:#ddd6fe!important;min-width:35px;}

  /* Footer */
  .ft{margin-top:10px;overflow:hidden;background:white;border-radius:8px;padding:10px 14px;border:1px solid #e5e7eb;}
  .ft-l{float:left;font-size:9px;color:#9ca3af;font-style:italic;margin-top:8px;}
  .ft-r{float:right;text-align:center;min-width:180px;}
  .sig-line{margin-top:40px;border-bottom:1px dashed #9ca3af;}

  @media print{
    @page{size:A4 portrait;margin:0.8cm;}
    body{background:white;padding:0;font-size:10.5px;}
    /* Each card: no page-break inside */
    .card{break-inside:avoid!important;page-break-inside:avoid!important;}
    /* Each pair row: allow break between rows but NOT within a row */
    .row2{break-inside:avoid!important;page-break-inside:avoid!important;}
    .kpi-strip{break-inside:avoid!important;page-break-inside:avoid!important;}
    .dh,.ft{break-inside:avoid!important;}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }
</style>
</head>
<body>

<div class="dh">
  <h1>ព្រះរាជាណាចក្រកម្ពុជា</h1>
  <h2>ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
  <div style="width:48px;height:2px;background:#1e40af;margin:5px auto 6px;border-radius:2px;"></div>
  <h3>របាយការណ៍សង្ខេបស្ថានភាពបុគ្គលិក</h3>
  <p>កាលបរិច្ឆេទ: ${dateStr}</p>
</div>

${bodyHtmlContent}

<div class="ft">
  <div class="ft-l">បោះពុម្ពដោយ: ${username}</div>
  <div class="ft-r">
    <p style="font-size:9px;color:#6b7280;">${dateStr}</p>
    <p style="font-weight:700;font-size:10px;margin-top:3px;">ហត្ថលេខា និងត្រា</p>
    <div class="sig-line"></div>
  </div>
  <div style="clear:both"></div>
</div>

<script>window.onload=()=>{window.print();}</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1000,height=900');
    if (win) { win.document.write(html); win.document.close(); }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [canViewHR]);

  const fetchDashboardData = async () => {
    if (!canViewHR && !perms.user?.department) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Fetch HR/employee data (dashboard shows aggregated stats regardless of detailed HR view permission)
      let employees = [];
      try {
        const res = await HRAPI.getAll();
        employees = Array.isArray(res?.data) ? res.data : [];
      } catch (e) {
        // fallback to old employees endpoint if HR API not available
        try {
          const response = await employeeAPI.getEmployees({ limit: 100 });
          employees = (response?.data?.employees) || [];
        } catch (err) {
          employees = [];
        }
      }

      // Filter by department for non-admins
      if (!perms.isAdmin && perms.user?.department) {
        const uDept = perms.user.department.replace(/[\s\u200B]/g, '');
        employees = employees.filter(e => {
          const d = (e.Department_Kh || e.department || '').toString().replace(/[\s\u200B]/g, '');
          return d === uDept;
        });
      }

      setAllEmployees(employees);

      // DEBUG: provide a breakdown of why some employees are excluded from active counts
      try {
        const explicitlyRemovedList = employees.filter(_isExplicitlyRemoved);
        const preparedList = employees.filter(emp => Boolean(emp.__isPreparedForDeletion));
        const activeStatusList = employees.filter(e => (e.status || '').toString().toLowerCase() === 'active');
        const nonActiveList = employees.filter(e => (e.status || '').toString().toLowerCase() !== 'active');
        console.debug('Dashboard debug breakdown', {
          total: employees.length,
          explicitlyRemoved: explicitlyRemovedList.length,
          preparedForDeletion: preparedList.length,
          activeByStatus: activeStatusList.length,
          nonActive: nonActiveList.length
        });
        console.debug('Dashboard samples: explicitlyRemoved', explicitlyRemovedList.slice(0, 5).map(e => ({ _id: e._id, name: e.name, dateRemoved: e.dateRemoved || (e.delisted && (e.delisted.dateRemoved || e.delisted.date_removed)) || e.dateRemovedFromDataset || e.removalDate })));
      } catch (err) { console.debug('Dashboard debug breakdown failed', err); }
      // Calculate stats
      const totalEmployees = employees.length;
      // Exclude prepared-for-deletion or explicit removal from "active" counts
      const isExplicitlyRemoved = _isExplicitlyRemoved;
      // Build a canonical active list used across stats and breakdowns
      const isCountedActive = _isCountedActive;
      const activeList = employees.filter(isCountedActive);
      const activeEmployees = activeList.length;
      try {
        const excludedFromActive = employees.filter(e => !isCountedActive(e));
        console.debug('[Dashboard] excludedFromActive count:', excludedFromActive.length);
        console.debug('[Dashboard] excludedFromActive sample:', (excludedFromActive || []).slice(0, 20).map(e => ({ id: e._id || e.staffId || e.no, name: e.name || e.khmerName || '', status: e.status || '', explicitRemoved: _isExplicitlyRemoved(e), hasResignData: _hasResignData(e), preparedForDeletion: Boolean(e.__isPreparedForDeletion), dateRemoved: e.dateRemoved || (e.delisted && (e.delisted.dateRemoved || e.delisted.date_removed)) || e.dateRemovedFromDataset || e.removalDate, resignDate: e.resignDate || e.resignationDate || e.resignDocument })));
      } catch (err) { console.debug('Dashboard excludedFromActive debug failed', err); }

      // Get employees added this month
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Helpers for month matching (moved to top of scope to avoid ReferenceError)
      const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
      const currentMonthNameKh = khMonths[currentMonth] || '';
      const normalizeText = (v) => {
        try { return String(v || '').replace(/\s+/g, ' ').trim(); } catch { return ''; }
      };
      const noteMatchesThisMonth = (note) => {
        const t = normalizeText(note);
        if (!t) return false;
        if (!currentMonthNameKh) return false;
        // tolerate: "ប្រចាំខែកុម្ភៈ", "ប្រចាំខែ កុម្ភៈ", or any text containing the month name
        return t.includes(currentMonthNameKh);
      };

      const getMonthlyReportNote = (emp) => {
        if (!emp) return '';
        const del = emp.delisted || {};
        return (
          emp.resignationOther ||
          emp.otherReason ||
          emp.additionalInfo ||
          emp.remarks ||
          emp.comments ||
          emp.note ||
          del.note ||
          del.Note ||
          ''
        );
      };

      const isNewThisMonth = (emp) => {
        // Primary source: "ចូលរបាយការណ៍ខែ" (monthly report text) - align with resigned staff logic
        const note = getMonthlyReportNote(emp);
        if (noteMatchesThisMonth(note)) return true;

        // Fallback: join date
        const raw = emp.joinDate || emp.nominationStartDate;
        if (!raw) return false;
        let joinDate = null;
        if (typeof raw === 'string' && raw.includes('/')) {
          const parts = raw.split('/');
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            if (y > 1000) joinDate = new Date(y, m, d);
          }
        }
        if (!joinDate) joinDate = new Date(raw);
        if (!joinDate || Number.isNaN(joinDate.getTime())) return false;
        return joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear;
      };
      const isNewThisMonthList = (employees || []).filter(emp => {
        const status = (emp.status || '').toString().toLowerCase();
        if (status === 'resigned' || status === 'deleted' || status === 'inactive') return false;

        const isClosed = emp.entryClosingDate || (emp.delisted && emp.delisted.entryClosingDate);
        const isRemoved = emp.dateRemoved || (emp.delisted && (emp.delisted.dateRemoved || emp.delisted.date_removed)) || emp.removalDate || emp.dateRemovedFromDataset;
        if (isClosed || isRemoved) return false;
        return isNewThisMonth(emp);
      });
      const newThisMonth = isNewThisMonthList.length;


      const getStoppedDate = (emp) => {
        try {
          const del = emp?.delisted || {};
          const raw =
            emp?.resignDate ||
            emp?.resignationDate ||
            emp?.dateRemoved ||
            emp?.dateRemovedFromDataset ||
            emp?.removalDate ||
            // official-delisted / nested delisted dates
            del?.dateDelisted ||
            del?.date_delisted ||
            del?.date ||
            del?.dateRemoved ||
            del?.date_removed;
          if (!raw) return null;
          const d = new Date(raw);
          if (!Number.isNaN(d.getTime())) return d;

          // Tolerate dd/mm/yyyy or dd-mm-yyyy
          const m = String(raw).trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
          if (!m) return null;
          const dd = Number(m[1]);
          const mm = Number(m[2]);
          const yyyy = Number(m[3]);
          const d2 = new Date(yyyy, mm - 1, dd);
          if (Number.isNaN(d2.getTime())) return null;
          if (d2.getFullYear() !== yyyy || d2.getMonth() !== (mm - 1) || d2.getDate() !== dd) return null;
          return d2;
        } catch {
          return null;
        }
      };


      const stoppedThisMonthList = (employees || []).filter(emp => {
        if (!emp) return false;
        if (emp.__isPreparedForDeletion) return false;

        // Exclude finalized records (those with a closing date)
        if (_isExplicitlyRemoved(emp)) return false;

        // Primary source: "ចូលរបាយការណ៍ខែ" (monthly report text)
        const note = getMonthlyReportNote(emp);
        if (noteMatchesThisMonth(note)) return true;

        // Fallback: stop-date within this month
        const stoppedDate = getStoppedDate(emp);
        if (!stoppedDate) return false;
        return stoppedDate.getMonth() === currentMonth && stoppedDate.getFullYear() === currentYear;
      });
      const stoppedThisMonth = stoppedThisMonthList.length;

      // Get unique departments
      // Backend field for department in model is 'Department_Kh'
      const departments = [...new Set(employees.map(emp => emp.Department_Kh || emp.department || '').filter(Boolean))].length;

      setStats({
        totalEmployees,
        activeEmployees,
        newThisMonth,
        stoppedThisMonth,
        departments
      });

      // Get recent HR records (based on createdAt or joinDate)
      const recent = (employees || []).slice().sort((a, b) => {
        const ta = new Date(a.createdAt || a.joinDate || 0).getTime();
        const tb = new Date(b.createdAt || b.joinDate || 0).getTime();
        return tb - ta;
      }).slice(0, 5);
      setRecentEmployees(recent);

      // Try to fetch department meta from API, fall back to computed list
      // compute department list from HR records
      const map = {};
      employees.forEach(e => {
        const d = (e.Department_Kh || e.department || 'មិនបានកំណត់') || 'មិនបានកំណត់';
        if (!map[d]) map[d] = { count: 0, male: 0, female: 0 };
        map[d].count++;
        const g = e.gender || e.sex || '';
        if (g === 'ស្រី' || g === 'Female' || g === 'F') {
          map[d].female++;
        } else {
          map[d].male++;
        }
      });
      const computed = Object.keys(map).map(k => ({ name: k, count: map[k].count, male: map[k].male, female: map[k].female }));
      setDepartmentList(computed.sort((a, b) => b.count - a.count));

      // Compute missing-data counts (phone, position, department, image, signature)
      try {
        const missingPhone = (employees || []).filter(e => {
          const p = e?.phone || e?.mobile || e?.phoneNumber || e?.telephone || e?.contact || e?.contactPhone || e?.contact_number;
          return !(p !== null && typeof p !== 'undefined' && String(p).trim() !== '');
        }).length;

        const missingPosition = (employees || []).filter(e => {
          const pos = e?.position || e?.civilServantRole || e?.officerType || e?.grade;
          return !(pos !== null && typeof pos !== 'undefined' && String(pos).trim() !== '');
        }).length;

        const missingDepartment = (employees || []).filter(e => {
          const d = e?.Department_Kh || e?.department || e?.departmentName;
          return !(d !== null && typeof d !== 'undefined' && String(d).trim() !== '');
        }).length;

        const missingStaffId = (employees || []).filter(e => {
          const sid = e?.staffId || e?.no || e?.id;
          return !(sid !== null && typeof sid !== 'undefined' && String(sid).trim() !== '');
        }).length;

        const missingNid = (employees || []).filter(e => {
          const nid = e?.nid || e?.nationalId || e?.identityCard || e?.cardNumber;
          return !(nid !== null && typeof nid !== 'undefined' && String(nid).trim() !== '');
        }).length;

        const missingBankAccount = (employees || []).filter(e => {
          const b = e?.bankAccount || e?.bankNo || e?.bank_number;
          return !(b !== null && typeof b !== 'undefined' && String(b).trim() !== '');
        }).length;

        const missingImage = (employees || []).filter(e => {
          const img = e?.image || e?.photo || e?.avatar;
          return !(img !== null && typeof img !== 'undefined' && String(img).trim() !== '');
        }).length;

        const missingSignature = (employees || []).filter(e => {
          const s = e?.signature || e?.signatureFile || e?.signature_url || e?.signatureUrl || e?.signature_image || e?.sign;
          return !(s !== null && typeof s !== 'undefined' && String(s).trim() !== '');
        }).length;

        setMissingCounts({
          phone: missingPhone,
          position: missingPosition,
          department: missingDepartment,
          staffId: missingStaffId,
          nid: missingNid,
          bankAccount: missingBankAccount,
          image: missingImage,
          signature: missingSignature
        });
      } catch (err) { console.debug('Failed to compute missingCounts', err); }

      // Compute mission assignments for today (heuristic: look for mission/missions/assignments with date fields)
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const sameDay = (val) => {
          if (!val) return false;
          try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d.getTime() === today.getTime(); }
            // try dd/mm/yyyy or d/m/yyyy
            const m = String(val).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (m) { const dd = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])); dd.setHours(0, 0, 0, 0); return dd.getTime() === today.getTime(); }
            // try yyyy-mm-dd
            const m2 = String(val).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m2) { const dd = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3])); dd.setHours(0, 0, 0, 0); return dd.getTime() === today.getTime(); }
          } catch (e) { return false; }
          return false;
        };

        const extractDatesFromObj = (obj) => {
          if (!obj) return [];
          const dates = [];
          const keys = ['date', 'missionDate', 'startDate', 'assignedDate', 'dateAssigned', 'date_from', 'date_to', 'start'];
          keys.forEach(k => { if (obj[k]) dates.push(obj[k]); });
          return dates;
        };

        const hasMissionToday = (emp) => {
          if (!emp) return false;
          const check = (v) => {
            if (!v) return false;
            if (Array.isArray(v)) return v.some(item => (typeof item === 'object') ? extractDatesFromObj(item).some(sameDay) : sameDay(item));
            if (typeof v === 'object') return extractDatesFromObj(v).some(sameDay);
            return sameDay(v);
          };

          if (check(emp.missions) || check(emp.mission) || check(emp.assignments) || check(emp.assignedMissions)) return true;
          // root-level date-like fields
          if (sameDay(emp.missionDate) || sameDay(emp.assignedDate) || sameDay(emp.dateAssigned)) return true;
          return false;
        };

        const todays = (employees || []).filter(hasMissionToday);

        // Also include assignments coming from the standalone Missions page (localStorage)
        try {
          const rawM = localStorage.getItem('missions.data.v1');
          const parsedM = rawM ? JSON.parse(rawM) : null;
          const missionsFromStorage = Array.isArray(parsedM) ? parsedM : [];
          const missionEntries = [];
          const existingNames = new Set((todays || []).map(e => (e.name || e.khmerName || '').toString().trim()).filter(Boolean));

          const splitParticipants = (txt) => {
            if (!txt) return [];
            // try splitting on newlines, commas, slashes, or numbered list markers
            return String(txt).split(/\r?\n|\,|\;|\/|\u2022|\(|\)|\d+\)\s*/).map(s => s.trim()).filter(Boolean);
          };

          const missionSameDay = (m) => {
            if (!m) return false;
            if (sameDay(m.date) || sameDay(m.letterDate) || sameDay(m.referenceDate) || sameDay(m.traditionalDate)) return true;
            return false;
          };

          (missionsFromStorage || []).forEach(m => {
            try {
              if (!missionSameDay(m)) return;
              // participants field may contain numbered list or comma-separated names
              const parts = splitParticipants(m.participants || m.assignTo || m.participant || '');
              if (parts.length === 0 && m.assignTo) parts.push(String(m.assignTo).trim());
              parts.forEach(p => {
                const name = p;
                if (!name) return;
                if (existingNames.has(name)) return;
                existingNames.add(name);
                missionEntries.push({ name, khmerName: '', position: '', Department_Kh: '', mission: { title: m.reference || m.location || m.reference || m.content || m.letterNo || '' } });
              });
            } catch (e) { /* ignore mission parse errors */ }
          });

          const combined = [...todays, ...missionEntries];
          setMissionToday((combined || []).slice(0, 50));
        } catch (e) {
          setMissionToday(todays.slice(0, 50));
        }
      } catch (err) { console.debug('Failed to compute missionToday', err); }

      // Extra metrics: study leave, vacancies, retirements, officer types
      const studyKeywords = ['សិក្សា', 'ស្រាវជ្រាវ', 'ហាត់ការងារ', 'បណ្ដុះបណ្ដាល', 'training', 'study', 'scholarship'];
      let studyArr = [];
      let vacancyArr = [];
      let retireArr = [];

      // Officer type breakdown should NOT count resigned/deleted employees.
      // Reuse the dashboard's active inclusion rule, and ignore any prepared-for-deletion placeholders.
      const officerTypeSource = (activeList || []).filter(e => !e?.__isPreparedForDeletion);
      const oMap = {};
      const oGenderMap = {};

      // Exclude resigned/removed/inactive or prepared-for-deletion employees from certain metric counts
      const metricEmployees = employees.filter(e => {
        if (!isCountedActive(e)) return false;
        if (e.__isPreparedForDeletion) return false;
        return true;
      });

      // Debug: counts before/after filtering
      try { console.debug('Dashboard counts: total employees', employees.length, 'metricEmployees', metricEmployees.length); } catch (e) { }
      try { console.debug('[Dashboard] metricEmployees sample:', (metricEmployees || []).slice(0, 10).map(e => ({ id: e._id || e.staffId || e.no, name: e.name || e.khmerName || '', gender: e.gender || '', reason: e.civilServantReason || e.reason || '' }))); } catch (e) { }

      const vacancyKeywords = ['ទំនេរ', 'ទំនេរគ្មានបៀវត្ស', 'unpaid', 'leave without pay', 'leave'];
      const hasUnpaidData = (hr) => {
        const u = hr && hr.unpaid ? hr.unpaid : null;
        if (!u) return false;
        try {
          return Object.keys(u).some(k => {
            const v = u[k];
            return v !== null && typeof v !== 'undefined' && String(v).trim() !== '';
          });
        } catch (e) { return false; }
      };

      metricEmployees.forEach(e => {
        const textFields = [e.civilServantReason, e.reason, e.other, e.workOther, e.civilServantRole, e.position].map(x => (x || '').toString().toLowerCase()).join(' ');
        // study leave heuristic
        if (studyKeywords.some(k => textFields.includes(k))) studyArr.push(e);
        // vacancy/unpaid heuristic: prefer explicit `unpaid` subdocument; fall back to previous heuristics
        if (hasUnpaidData(e) || !(e.staffId || e.no || '').toString().trim() || !(e.position || e.civilServantRole || '').toString().trim() || vacancyKeywords.some(k => textFields.includes(k))) vacancyArr.push(e);
        // retirement heuristic: look for 'retire' or Khmer 'និវត្ត' or 'ចូលនិវត្ត'
        if (/(retir|និវត្ត|ចូលនិវត្ត)/i.test(textFields)) retireArr.push(e);
      });

      // Skill Grouping logic (mirroring EmployeeReportPage)
      const pMap = {};
      const pGenderMap = {};

      // 1. Fetch skills & positions from API for ordering (mirroring EmployeeReportPage)
      let skillsFromAPI = [];
      try {
        const { data: sData } = await skillAPI.getSkills();
        skillsFromAPI = Array.isArray(sData) ? sData : [];
        // Sort by canonical ID
        skillsFromAPI.sort((a, b) => {
          const getV = (x) => {
            const v = x.skills_Id ?? x.no;
            if (v === null || v === undefined || v === '') return 999999;
            const n = parseInt(v.toString().replace(/[^0-9]/g, ''));
            return isNaN(n) ? 999999 : n;
          };
          return getV(a) - getV(b);
        });
      } catch (e) { console.debug('Failed to fetch skills for dashboard', e); }

      let positionsFromAPI = [];
      try {
        const { data: pData } = await positionAPI.getPositions();
        positionsFromAPI = Array.isArray(pData) ? pData : (Array.isArray(pData?.positions) ? pData.positions : []);
        // Sort by canonical ID (matches "លេខសម្គាល់" in management UI)
        positionsFromAPI.sort((a, b) => {
          const getV = (x) => {
            const v = x.Position_Id ?? x.positions_Id ?? x.positions_id ?? x.no;
            if (v === null || v === undefined || v === '') return 999999;
            const n = parseInt(v.toString().replace(/[^0-9]/g, ''));
            return isNaN(n) ? 999999 : n;
          };
          return getV(a) - getV(b);
        });
      } catch (e) { console.debug('Failed to fetch positions for dashboard', e); }


      const skillGroupsRaw = localStorage.getItem('employee_skill_groups');
      const skillGroups = skillGroupsRaw ? JSON.parse(skillGroupsRaw) : [];
      const skillToGroup = {};
      const groupNormSets = skillGroups.map(g => new Set((g.members || []).map(m => normSkill(m))));
      const memberToGroupIdx = new Map();
      skillGroups.forEach((g, gi) => {
        (g.members || []).forEach(m => memberToGroupIdx.set(normSkill(m), gi));
      });

      // helper for per-skill metrics
      const getSkillMetrics = (targetNormSet) => {
        let count = 0, male = 0, female = 0, other = 0;
        officerTypeSource.forEach(e => {
          const s = normSkill(e.skill);
          if (targetNormSet.has(s)) {
            count++;
            const g = (e.gender || '').toString();
            if (g === 'Male' || g === 'ប្រុស') male++;
            else if (g === 'Female' || g === 'ស្រី') female++;
            else other++;
          }
        });
        return { count, male, female, other };
      };

      const finalSkills = [];
      const emittedGroups = new Set();
      const processedSkills = new Set();

      // Compute officer types and basic gender maps in one pass
      officerTypeSource.forEach(e => {
        const ot = (e.officerType || '').toString().trim() || 'មិនបានកំណត់';
        oMap[ot] = (oMap[ot] || 0) + 1;
        const g = (e.gender || '').toString();
        const gKey = g === 'Male' || g === 'ប្រុស' ? 'male' : g === 'Female' || g === 'ស្រី' ? 'female' : 'other';
        oGenderMap[ot] = oGenderMap[ot] || { male: 0, female: 0, other: 0 };
        oGenderMap[ot][gKey] = (oGenderMap[ot][gKey] || 0) + 1;

        const pos = (e.position || e.civilServantRole || '').toString().trim() || 'មិនមាន';
        pMap[pos] = (pMap[pos] || 0) + 1;
        pGenderMap[pos] = pGenderMap[pos] || { male: 0, female: 0, other: 0 };
        pGenderMap[pos][gKey] = (pGenderMap[pos][gKey] || 0) + 1;
      });

      // If we have skills from API, follow that order
      if (skillsFromAPI.length > 0) {
        skillsFromAPI.forEach(s => {
          const sName = (s.skills_Kh || '').toString();
          const sNorm = normSkill(sName);
          if (!sNorm) return;
          processedSkills.add(sNorm);

          if (memberToGroupIdx.has(sNorm)) {
            const gi = memberToGroupIdx.get(sNorm);
            if (!emittedGroups.has(gi)) {
              const m = getSkillMetrics(groupNormSets[gi]);
              finalSkills.push({ type: skillGroups[gi].name, count: m.count, male: m.male, female: m.female, isGroup: true });
              emittedGroups.add(gi);
            }
          } else {
            const m = getSkillMetrics(new Set([sNorm]));
            if (m.count > 0) {
              finalSkills.push({ type: sName, count: m.count, male: m.male, female: m.female, isGroup: false });
            }
          }
        });
      }

      // Collect any remaining skills from employees not in API list
      const rawSkillMap = new Map();
      officerTypeSource.forEach(e => {
        const sName = (e.skill || '').toString().trim() || 'មិនមាន';
        const sNorm = normSkill(sName);
        if (processedSkills.has(sNorm)) return;

        if (memberToGroupIdx.has(sNorm)) {
          const gi = memberToGroupIdx.get(sNorm);
          if (!emittedGroups.has(gi)) {
            const m = getSkillMetrics(groupNormSets[gi]);
            finalSkills.push({ type: skillGroups[gi].name, count: m.count, male: m.male, female: m.female, isGroup: true });
            emittedGroups.add(gi);
          }
          processedSkills.add(sNorm);
          return;
        }

        if (!rawSkillMap.has(sNorm)) rawSkillMap.set(sNorm, { name: sName, count: 0, male: 0, female: 0 });
        const m = rawSkillMap.get(sNorm);
        m.count++;
        const g = (e.gender || '').toString();
        if (g === 'Male' || g === 'ប្រុស') m.male++; else if (g === 'Female' || g === 'ស្រី') m.female++;
        processedSkills.add(sNorm);
      });

      Array.from(rawSkillMap.values()).forEach(m => {
        if (m.count > 0) finalSkills.push({ type: m.name, count: m.count, male: m.male, female: m.female, isGroup: false });
      });

      // Finally, append any groups that weren't emitted because their members were not in the API list or HR records?
      // Actually EmployeeReportPage does this too.
      skillGroups.forEach((g, gi) => {
        if (!emittedGroups.has(gi)) {
          const m = getSkillMetrics(groupNormSets[gi]);
          if (m.count > 0) {
            finalSkills.push({ type: g.name, count: m.count, male: m.male, female: m.female, isGroup: true });
          }
        }
      });

      const officerTypes = Object.keys(oMap).map(k => ({ type: k, count: oMap[k], male: oGenderMap[k].male, female: oGenderMap[k].female })).sort((a, b) => b.count - a.count);
      const skills = finalSkills;

      const finalPositions = [];
      const processedPositions = new Set();

      // Pre-normalize all existing position metrics for faster and more reliable matching
      const normToData = new Map();
      Object.keys(pMap).forEach(rawK => {
        const n = normPos(rawK);
        if (!normToData.has(n)) normToData.set(n, { count: 0, male: 0, female: 0, rawKeys: [] });
        const d = normToData.get(n);
        d.count += pMap[rawK];
        d.male += (pGenderMap[rawK]?.male || 0);
        d.female += (pGenderMap[rawK]?.female || 0);
        d.rawKeys.push(rawK);
      });

      if (positionsFromAPI.length > 0) {
        positionsFromAPI.forEach(p => {
          const pName = (p.Position_Kh || p.positions_Kh || p.name || '').toString().trim();
          const pNorm = normPos(pName);
          if (!pNorm) return;

          if (normToData.has(pNorm)) {
            const d = normToData.get(pNorm);
            finalPositions.push({ type: pName, count: d.count, male: d.male, female: d.female });
            processedPositions.add(pNorm);
          }
        });
      }

      // Collect remaining positions not in API list
      normToData.forEach((d, n) => {
        if (!processedPositions.has(n)) {
          finalPositions.push({ type: d.rawKeys[0], count: d.count, male: d.male, female: d.female });
          processedPositions.add(n);
        }
      });

      const positions = finalPositions;

      // Fetch Leave Requests for current month breakdown
      let leaveTypeSummary = [];
      try {
        const now = new Date();
        const monthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const { data: lData } = await api.get('/leave-requests', { params: { month: monthVal, status: 'approved' } });
        const leaves = Array.isArray(lData) ? lData : [];
        const lM = {};
        leaves.forEach(l => {
          const t = (l.type || 'ផ្សេងៗ').toString().trim();
          if (!lM[t]) lM[t] = { count: 0, male: 0, female: 0 };
          lM[t].count++;
          const g = (l.gender || l.staff?.gender || '').toString();
          if (g === 'Female' || g === 'ស្រី') lM[t].female++;
          else lM[t].male++;
        });
        leaveTypeSummary = Object.keys(lM).map(k => ({ type: k, ...lM[k] })).sort((a, b) => b.count - a.count);
      } catch (e) { console.debug('Failed to fetch monthly leave types', e); }

      setMetricsExtra({ studyLeave: studyArr.length, vacancies: vacancyArr.length, retirements: retireArr.length, officerTypes, skills, positions, leaveTypes: leaveTypeSummary });

      // Vacancy female counts
      const vacancyFemale = (vacancyArr || []).filter(e => {
        const g = (e.gender || '').toString();
        return (g === 'Female' || g === 'ស្រី');
      }).length;
      setVacancyCounts({ total: (vacancyArr || []).length, female: vacancyFemale });
      console.debug('[Dashboard] vacancyArr sample:', (vacancyArr || []).slice(0, 10).map(e => ({ id: e._id || e.staffId || e.no, name: e.name || e.khmerName || '', gender: e.gender || '', reason: e.civilServantReason || e.reason || '' })));

      // Compute vacancy status breakdowns based on unpaid dates when available
      const parseDateSafe = (v) => {
        if (!v) return null;
        try { const d = new Date(v); if (isNaN(d.getTime())) return null; d.setHours(0, 0, 0, 0); return d; } catch { return null; }
      };
      const daysBetween = (a, b) => { if (!a || !b) return null; return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)); };
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const vCounts = { preparing: { total: 0, female: 0 }, ongoing: { total: 0, female: 0 }, returned: { total: 0, female: 0 } };
      (vacancyArr || []).forEach(e => {
        const unpaid = e.unpaid || e.unpaidLeave || e.leave || {};
        const start = parseDateSafe(unpaid.Start || unpaid.start || unpaid.startDate || unpaid.studyStart);
        const end = parseDateSafe(unpaid.End || unpaid.end || unpaid.endDate || unpaid.studyEnd);
        let status = 'returned';
        if (start && start > today) status = 'preparing';
        else if (start && (!end || (end && end >= today))) status = 'ongoing';
        else if (end && end < today) {
          const daysSinceEnd = daysBetween(end, today);
          // treat both recent end and long-end as returned
          status = 'returned';
        }
        const g = (e.gender || '').toString(); const isFemale = (g === 'Female' || g === 'ស្រី');
        if (!vCounts[status]) vCounts[status] = { total: 0, female: 0 };
        vCounts[status].total++;
        if (isFemale) vCounts[status].female++;
      });
      const totalVac = (vCounts.preparing.total || 0) + (vCounts.ongoing.total || 0) + (vCounts.returned.total || 0);
      const femaleVac = (vCounts.preparing.female || 0) + (vCounts.ongoing.female || 0) + (vCounts.returned.female || 0);
      setVacancyStatusCounts({ ...vCounts, total: totalVac, femaleTotal: femaleVac });
      console.debug('[Dashboard] vacancyStatusCounts:', { ...vCounts, total: totalVac, femaleTotal: femaleVac });

      // Compute study status counts (preparing, studying, returned) using study object when available
      const daysDiffFromTodayLocal = (dateLike) => {
        if (!dateLike) return '';
        const d = new Date(dateLike);
        if (isNaN(d.getTime())) return '';
        const today = new Date();
        const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const t1 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const msPerDay = 24 * 60 * 60 * 1000;
        return Math.round((t1 - t0) / msPerDay);
      };

      const computeStudyStatusLocal = (stu) => {
        if (!stu) return null;
        try {
          const startDate = stu.studyStart || stu.startDate;
          const daysToStart = startDate ? daysDiffFromTodayLocal(startDate) : '';
          let validityDays = daysDiffFromTodayLocal(stu.studyEnd || stu.endDate);
          if (validityDays === '' || validityDays == null) {
            const v2 = stu.validity;
            if (v2 !== '' && v2 != null && !isNaN(Number(v2))) validityDays = Number(v2);
            else validityDays = null;
          }
          if (daysToStart !== '' && daysToStart > 0) return 'preparing';
          const nVal = (validityDays !== null && !isNaN(Number(validityDays))) ? Number(validityDays) : null;
          if (nVal !== null && nVal >= 1) return 'studying';
          // treat finished long ago or small negative as returned
          if (nVal !== null) return 'returned';
          return null;
        } catch (e) { return null; }
      };

      const studyCandidates = metricEmployees.filter(e => {
        const textFields = [e.civilServantReason, e.reason, e.other, e.workOther, e.civilServantRole, e.position].map(x => (x || '').toString().toLowerCase()).join(' ');
        const reasonMatches = studyKeywords.some(k => textFields.includes(k));
        const stu = (e.stu || e.study || {});
        const hasStudyData = Boolean(stu && (stu.studyStart || stu.startDate || stu.studyEnd || stu.endDate || stu.studySkill || stu.studyPlace || stu.validity));
        return reasonMatches || hasStudyData;
      });

      const studyCounts = { preparing: { total: 0, female: 0 }, studying: { total: 0, female: 0 }, returned: { total: 0, female: 0 } };
      studyCandidates.forEach(e => {
        const stu = (e.stu || e.study || {});
        const status = computeStudyStatusLocal(stu) || 'returned';
        const g = (e.gender || '').toString();
        const isFemale = (g === 'Female' || g === 'ស្រី');
        if (!studyCounts[status]) studyCounts[status] = { total: 0, female: 0 };
        studyCounts[status].total++;
        if (isFemale) studyCounts[status].female++;
      });
      const totalStudy = (studyCounts.preparing.total || 0) + (studyCounts.studying.total || 0) + (studyCounts.returned.total || 0);
      const femaleStudyTotal = (studyCounts.preparing.female || 0) + (studyCounts.studying.female || 0) + (studyCounts.returned.female || 0);
      setStudyStatusCounts({ ...studyCounts, total: totalStudy, femaleTotal: femaleStudyTotal });

      // Compute retirements for the current year using DOB + 60 years heuristic
      const computeRetirementDate = (dob) => {
        if (!dob) return null;
        try {
          const d = new Date(dob);
          if (isNaN(d.getTime())) return null;
          return new Date(d.getFullYear() + 60, d.getMonth(), d.getDate());
        } catch (e) { return null; }
      };
      const civilTokens = ['មន្ត្រីរាជការ', 'មន្រ្តីរាជការ', 'civil', 'civil servant', 'civilservice'];
      const contractTokens = ['កិច្ចសន្យា', 'contract', 'worker', 'កម្មករ', 'contractor', 'worker'];
      let rTotal = 0, rMale = 0, rFemale = 0;
      const rCivil = { total: 0, female: 0 };
      const rContract = { total: 0, female: 0 };
      (metricEmployees || []).forEach(e => {
        const rDate = computeRetirementDate(e.dob || e.DOB || e.birthDate || e.dateOfBirth);
        if (!rDate) return;
        if (rDate.getFullYear() !== currentYear) return;
        rTotal++;
        const g = (e.gender || '').toString();
        if (g === 'Male' || g === 'ប្រុស') rMale++; else if (g === 'Female' || g === 'ស្រី') rFemale++;
        // combine possible text fields to detect category
        const otRaw = [e.officerType, e.civilServantRole, e.position, e.grade, e.contractType, e.employmentType, e.officerCategory, e.type].filter(Boolean).join(' ');
        const ot = (otRaw || '').toString().toLowerCase();
        const isCivil = civilTokens.some(t => ot.includes(t.toString().toLowerCase()));
        const isContract = contractTokens.some(t => ot.includes(t.toString().toLowerCase()));
        if (isCivil) {
          rCivil.total++; if (g === 'Female' || g === 'ស្រី') rCivil.female++;
        } else if (isContract) {
          rContract.total++; if (g === 'Female' || g === 'ស្រី') rContract.female++;
        } else {
          // fallback: if officerType missing or ambiguous, try looking at other flags, else count as contract fallback
          if (!ot || ot.trim() === '') {
            rContract.total++; if (g === 'Female' || g === 'ស្រី') rContract.female++;
          } else {
            // ambiguous text: don't mis-classify; try a looser heuristic
            const looseCivil = /មន|រាជ|civil/i.test(ot);
            const looseContract = /កិច្ច|contract|worker|កម្មករ/i.test(ot);
            if (looseCivil) { rCivil.total++; if (g === 'Female' || g === 'ស្រី') rCivil.female++; }
            else if (looseContract) { rContract.total++; if (g === 'Female' || g === 'ស្រី') rContract.female++; }
          }
        }
      });
      setRetirementCounts({ total: rTotal, male: rMale, female: rFemale, civil: rCivil, contract: rContract });
      setMetricsExtra(prev => ({ ...prev, retirements: rTotal }));

      // Probation Status Computation
      const probCounts = {
        ongoing: 0, ongoingMale: 0, ongoingFemale: 0,
        endingSoon: 0, endingSoonMale: 0, endingSoonFemale: 0,
        completedRecent: 0, completedRecentMale: 0, completedRecentFemale: 0,
        total: 0
      };
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      activeList.forEach(e => {
        const raw = e.probationEndDate || e.probationEnd || '';
        let pEnd = null;
        if (raw) {
          pEnd = parseDateSafe(raw);
        } else {
          const jdRaw = e.joinDate || e.nominationStartDate || e.contractStartDate || e.nomination_start_date || e.contract_start_date || e.civilServantStartDate || e.dateJoinedMinistry;
          const jd = parseDateSafe(jdRaw);
          if (jd) {
            pEnd = new Date(jd);
            pEnd.setMonth(pEnd.getMonth() + 3);
          }
        }

        if (!pEnd) return;
        pEnd.setHours(0, 0, 0, 0);

        const diffMs = pEnd.getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const g = (e.gender || e.sex || '').toString().toLowerCase();
        const isFemale = (g === 'ស្រី' || g === 'female' || g === 'f');

        if (diffDays > 10) {
          probCounts.ongoing++;
          if (isFemale) probCounts.ongoingFemale++; else probCounts.ongoingMale++;
          probCounts.total++;
        } else if (diffDays > 0 && diffDays <= 10) {
          probCounts.endingSoon++;
          if (isFemale) probCounts.endingSoonFemale++; else probCounts.endingSoonMale++;
          probCounts.total++;
        } else if (diffDays <= 0 && diffDays >= -30) {
          probCounts.completedRecent++;
          if (isFemale) probCounts.completedRecentFemale++; else probCounts.completedRecentMale++;
        }
      });
      setProbationStatusCounts(probCounts);

      // Debug: log metric counts so we can inspect values in browser console
      try {
        console.debug('Dashboard metricsExtra computed:', { studyLeave: studyArr.length, vacancies: vacancyArr.length, retirements: retireArr.length, officerTypesCount: officerTypes.length });
      } catch (e) { }

      // build officer types detailed list with gender breakdowns
      const officerTypesDetailed = Object.keys(oMap).map(k => ({
        type: k,
        count: oMap[k],
        male: (oGenderMap[k] && oGenderMap[k].male) || 0,
        female: (oGenderMap[k] && oGenderMap[k].female) || 0,
        other: (oGenderMap[k] && oGenderMap[k].other) || 0
      })).sort((a, b) => b.count - a.count);
      setDepartmentList(computed.sort((a, b) => b.count - a.count));
      // stash officerTypesDetailed for UI
      setMetricsExtra(prev => ({ ...prev, officerTypesDetailed }));

      // Compute gender breakdown helper
      const countGender = (arr) => {
        const res = { male: 0, female: 0, other: 0 };
        (arr || []).forEach(x => {
          const g = (x.gender || '').toString();
          if (g === 'Male' || g === 'ប្រុស') res.male++;
          else if (g === 'Female' || g === 'ស្រី') res.female++;
          else res.other++;
        });
        return res;
      };

      const totalGender = countGender(employees);
      const activeGender = countGender(activeList);
      const newGender = countGender(isNewThisMonthList);
      const stoppedThisMonthGender = countGender(stoppedThisMonthList);
      const studyGender = countGender(studyArr);
      const vacancyGender = countGender(vacancyArr);
      const retireGender = countGender(retireArr);

      setGenderBreakdowns({
        total: totalGender,
        active: activeGender,
        newThisMonth: newGender,
        stoppedThisMonth: stoppedThisMonthGender,
        studyLeave: studyGender,
        vacancies: vacancyGender,
        retirements: retireGender
      });

      try {
        console.debug('Dashboard genderBreakdowns:', { totalGender, activeGender, newGender, studyGender, vacancyGender, retireGender });
      } catch (e) { }

      // Category counts: map officerType or other flags to categories
      const isJoinedThisMonth = isNewThisMonth;

      const catMap = {
        civil: ['មន្ត្រីរាជការ', 'Civil', 'civil'],
        state: ['កិច្ចសន្យារដ្ឋ', 'State', 'state'],
        hospital: ['កិច្ចសន្យាមន្ទីរពេទ្យ', 'hospital', 'hospitalPlus'],
        contract: ['កិច្ចសន្យា', 'contract', 'កម្មករកិច្ចសន្យា', 'WORKER']
      };

      const counts = { civil: { joined: 0, stopped: 0 }, state: { joined: 0, stopped: 0 }, hospital: { joined: 0, stopped: 0 }, contract: { joined: 0, stopped: 0 } };
      employees.forEach(emp => {
        const ot = (emp.officerType || emp.officerType || '').toString();
        const status = (emp.status || '').toString().toLowerCase();
        const isStopped = status !== 'active' && status !== 'active'; // treat non-active as stopped
        // check which category
        for (const key of Object.keys(catMap)) {
          const matches = catMap[key].some(token => (ot || '').toString().toLowerCase().includes(token.toString().toLowerCase()) || (emp.officerType || '').toString().toLowerCase() === token.toString().toLowerCase());
          if (matches) {
            if (isJoinedThisMonth(emp)) counts[key].joined++;
            if (isStopped) counts[key].stopped++;
            break;
          }
        }
      });
      setCategoryCounts(counts);

      // Daily work-schedule stats (today)
      let todays = [];
      try {
        const now0 = new Date();
        const start = new Date(now0); start.setHours(0, 0, 0, 0);
        const end = new Date(now0); end.setHours(23, 59, 59, 999);
        const { data } = await api.get('/work-schedules', {
          params: { startDate: start.toISOString(), endDate: end.toISOString() }
        });
        const todaysRaw = Array.isArray(data) ? data : [];
        const activeIds = new Set(activeList.map(e => (e._id || e.id || '').toString()));
        todays = todaysRaw.filter(s => {
          const eid = (s.employeeId?._id || s.employeeId || s._id || '').toString();
          return activeIds.has(eid);
        });

        const daily = {
          totalSchedules: todays.length,
          workingToday: 0,
          dayOffToday: 0,
          dayShift: 0,
          nightShift: 0,
          shift24Hours: 0,
          notScheduled: activeList.length - todays.length
        };

        todays.forEach(s => {
          const title = (s?.shiftTitle || '').toString();
          if (title === 'Day Off') {
            daily.dayOffToday++;
            return;
          }
          if (!s?.shiftStart || !s?.shiftEnd) return;
          daily.workingToday++;
          try {
            const startParts = String(s.shiftStart).split(':');
            const endParts = String(s.shiftEnd).split(':');
            const startHour = parseInt(startParts[0], 10);
            const endHour = parseInt(endParts[0], 10);
            if (Number.isNaN(startHour) || Number.isNaN(endHour)) {
              daily.dayShift++;
              return;
            }
            // Day shift: AM → PM
            if (startHour < 12 && endHour >= 12) daily.dayShift++;
            // Night shift: PM → AM
            else if (startHour >= 12 && endHour < 12) daily.nightShift++;
            // 24-hour shift: AM → AM (>= 20h)
            else if (startHour < 12 && endHour < 12) {
              const startMinutes = startHour * 60 + parseInt(startParts[1] || 0, 10);
              const endMinutes = endHour * 60 + parseInt(endParts[1] || 0, 10);
              let duration = endMinutes - startMinutes;
              if (duration <= 0) duration += 24 * 60;
              if (duration >= 20 * 60) daily.shift24Hours++;
              else daily.dayShift++;
            }
            // PM → PM (count as day shift)
            else if (startHour >= 12 && endHour >= 12) daily.dayShift++;
            else daily.dayShift++;
          } catch (e) {
            daily.dayShift++;
          }
        });

        setWorkScheduleDaily(daily);
      } catch (err) {
        setWorkScheduleDaily({ totalSchedules: 0, workingToday: 0, dayOffToday: 0, dayShift: 0, nightShift: 0, shift24Hours: 0 });
      }

      // Fetch today's attendance results and merge with schedules for accuracy
      try {
        const now = new Date();
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

        const [attRes, leaveReqsRes] = await Promise.all([
          api.get('/attendance/daily-report-list', { params: { date: todayStr } }).catch(() => ({ data: [] })),
          api.get('/leave-requests', { params: { from: todayStr, to: todayStr } }).catch(() => ({ data: [] }))
        ]);

        let attRecords = Array.isArray(attRes.data) ? attRes.data : [];
        if (!perms.isAdmin && perms.user?.department) {
          const uDept = perms.user.department.replace(/[\s\u200B]/g, '');
          attRecords = attRecords.filter(r => {
            const d = (r.department || r.Department_Kh || '').toString().replace(/[\s\u200B]/g, '');
            return d === uDept;
          });
        }
        const approvedLeaves = (Array.isArray(leaveReqsRes.data) ? leaveReqsRes.data : []).filter(l => (l.status || '').toLowerCase() === 'approved');

        // Helper to normalize IDs for better matching (e.g., "001" vs "1")
        const normalize = (id) => (id || '').toString().trim().replace(/^0+/, '');

        // Create lookup maps for attendance, leaves, and schedules
        const attMap = new Map();
        attRecords.forEach(r => {
          const sid = (r.staffId || '').toString().trim();
          if (sid) {
            attMap.set(sid, r);
            const norm = normalize(sid);
            if (norm !== sid) attMap.set(norm, r);
          }
        });

        const leaveMap = new Map();
        approvedLeaves.forEach(l => {
          const sid = (l.staffId || l.no || (l.employeeId && (l.employeeId.staffId || l.employeeId.no || l.employeeId._id)) || '').toString().trim();
          if (sid) {
            leaveMap.set(sid, l);
            const norm = normalize(sid);
            if (norm !== sid) leaveMap.set(norm, l);
          }
        });

        // Use the 'todays' filtered work schedules we already have
        const schedMap = new Map();
        todays.forEach(s => {
          const eid = (s.employeeId?._id || s.employeeId || s._id || '').toString();
          if (eid) schedMap.set(eid, s);
        });

        // Loop through the actual Daily Report records (attRecords) to match the report page
        const parseTimeToMinutes = (t) => {
          if (!t) return 0;
          const s = String(t).trim();
          const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
          if (!m) return 0;
          let h = parseInt(m[1], 10);
          const min = parseInt(m[2], 10);
          const ampm = m[3]?.toUpperCase();
          if (ampm === 'PM' && h < 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          return h * 60 + min;
        };

        let present = 0, absent = 0, leave = 0, dayOff = 0, late = 0, early = 0, eveningPending = 0;
        const lMap = {};
        const dMetrics = {};
        const sMetrics = {};
        const pMetrics = {};

        const empLookup = new Map();
        metricEmployees.forEach(e => {
          const eid = (e._id || '').toString();
          if (eid) empLookup.set(eid, e);
          const sid = (e.staffId || e.no || '').toString().trim();
          if (sid) empLookup.set(sid, e);
        });

        attRecords.forEach(att => {
          const dept = (att.department || att.Department_Kh || 'មិនបានកំណត់').toString().trim();
          if (!dMetrics[dept]) {
            dMetrics[dept] = { absent: 0, leave: 0, late: 0, early: 0 };
          }

          const eid = (att.hrId || '').toString();
          const sched = eid ? schedMap.get(eid) : null;
          const emp = eid ? empLookup.get(eid) : null;

          const sNorm = emp ? normSkill(emp.skill || 'មិនមាន') : 'មិនមាន';
          const pNorm = emp ? normPos(emp.position || emp.civilServantRole || 'មិនមាន') : 'មិនមាន';

          if (!sMetrics[sNorm]) sMetrics[sNorm] = { absent: 0, leave: 0, late: 0, early: 0 };
          if (!pMetrics[pNorm]) pMetrics[pNorm] = { absent: 0, leave: 0, late: 0, early: 0 };

          // In attendance-daily-report, the 'status' field contains the finalized status
          const leaveKeywords = ['leave', 'ច្បាប់', 'សុំច្បាប់', 'លាឈប់', 'សម្រាកព្យាបាល', 'មាតុភាព', 'រៀបការ', 'បុណ្យសព'];

          const isPresent = att.status === 'present' || !!(att.checkin1 || att.checkin2 || att.checkIn);
          const isLeave = att.status === 'leave' || (att.status && leaveKeywords.some(k => att.status.toLowerCase().includes(k)));
          const isDayOff = att.status === 'dayoff' || att.status === 'holiday' || (sched?.shiftTitle === 'Day Off');

          if (isPresent) {
            present++;
            // Expand late/early detection to handle various backend field names
            let isLate = att.isLate || att.is_late ||
              Number(att.checkinLateCount || 0) > 0 ||
              Number(att.checkinLateMinutes || 0) > 0 ||
              Number(att.lateMinutes || 0) > 0 ||
              Number(att.late_minutes || 0) > 0;

            let isEarly = att.leftEarly || att.is_early || att.left_early ||
              Number(att.checkoutEarlyCount || 0) > 0 ||
              Number(att.checkoutEarlyMinutes || 0) > 0 ||
              Number(att.earlyMinutes || 0) > 0 ||
              Number(att.early_minutes || 0) > 0;

            // Manual calculation fallback if flags are missing but we have schedule info
            if (!isLate && sched?.shiftStart) {
              try {
                const ciTime = att.checkIn || att.checkin1 || att.checkInTime;
                if (ciTime) {
                  const ciMin = parseTimeToMinutes(ciTime);
                  const sMin = parseTimeToMinutes(sched.shiftStart);
                  const grace = parseInt(sched.gracePeriod ?? 15, 10);
                  if (ciMin > (sMin + grace)) isLate = true;
                }
              } catch (e) { }
            }

            if (!isEarly && sched?.shiftEnd) {
              try {
                const coTime = att.checkOut || att.checkout2 || att.checkOutTime || att.checkout1;
                if (coTime) {
                  const coMin = parseTimeToMinutes(coTime);
                  const eMin = parseTimeToMinutes(sched.shiftEnd);
                  if (coMin > 0 && coMin < eMin) isEarly = true;
                }
              } catch (e) { }
            }

            if (isLate) {
              late++;
              dMetrics[dept].late++;
              sMetrics[sNorm].late++;
              pMetrics[pNorm].late++;
            }
            if (isEarly) {
              early++;
              dMetrics[dept].early++;
              sMetrics[sNorm].early++;
              pMetrics[pNorm].early++;
            }
          } else if (isLeave) {
            leave++;
            dMetrics[dept].leave++;
            sMetrics[sNorm].leave++;
            pMetrics[pNorm].leave++;
            const type = (att.leaveType || att.status || 'ផ្សេងៗ').toString().trim();
            const displayType = (type.toLowerCase() === 'leave' || !type) ? 'ច្បាប់ (មិនបញ្ជាក់)' : type;
            lMap[displayType] = (lMap[displayType] || 0) + 1;
          } else if (isDayOff) {
            dayOff++;
          } else {
            // Check for evening shift pending (Not yet started)
            let isPending = false;
            if (sched?.shiftStart && !sched?.shiftTitle?.includes('Day Off')) {
              try {
                const now = new Date();
                const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
                const startParts = String(sched.shiftStart).split(':');
                const startTotalMinutes = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1] || 0, 10);

                // If current time is BEFORE shift start, it's "Not yet started" (Pending)
                if (currentTotalMinutes < startTotalMinutes) {
                  isPending = true;
                }
              } catch (e) { /* ignore */ }
            }

            if (isPending) {
              eveningPending++;
            } else {
              absent++;
              dMetrics[dept].absent++;
              sMetrics[sNorm].absent++;
              pMetrics[pNorm].absent++;
            }
          }
        });

        setAttendanceToday({
          total: attRecords.length,
          present,
          absent,
          eveningPending,
          leave,
          dayOff,
          late,
          early
        });
        setLeaveBreakdown(lMap);
        setDeptAttendanceMetrics(dMetrics);

      } catch (err) {
        console.error('Failed to fetch attendance summary', err);
      }

      // Fetch server-side gender stats if available
      try {
        const gRes = await HRAPI.getGenderStats();
        const g = gRes?.data || {};
        setGenderCounts({ male: g.male || totalGender.male || 0, female: g.female || totalGender.female || 0, other: g.other || totalGender.other || 0 });
      } catch (err) {
        // fallback to computed gender totals
        setGenderCounts(totalGender);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Export helpers
  const download = (filename, content, mime = 'text/csv') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toCSV = (arr) => {
    if (!arr || arr.length === 0) return '';
    const keys = Object.keys(arr[0]);
    const rows = [keys.join(',')];
    for (const item of arr) {
      rows.push(keys.map(k => `"${(item[k] ?? '').toString().replace(/"/g, '""')}"`).join(','));
    }
    return rows.join('\n');
  };

  const exportEmployees = (format = 'csv') => {
    const data = allEmployees;
    if (!data || data.length === 0) return;
    if (format === 'json') {
      download('employees.json', JSON.stringify(data, null, 2), 'application/json');
    } else {
      download('employees.csv', toCSV(data), 'text/csv');
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, change, meta, compact = false, onClick, accentColor }) => {
    const cursor = onClick ? 'cursor-pointer' : '';
    return (
      <div
        className={`bg-white rounded-xl border border-gray-100 shadow-sm ${compact ? 'p-3' : 'p-4'} hover:shadow-md transition-all duration-200 ${cursor} group relative overflow-hidden`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyPress={onClick ? (e => { if (e.key === 'Enter') onClick(); }) : undefined}
      >
        {/* Top accent line */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${color || 'bg-blue-500'}`} />
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide truncate mb-1" style={{ fontFamily: "'Noto Sans Khmer', sans-serif" }}>{title}</p>
            <p className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 leading-tight`}>
              {value}
            </p>
            {change && (
              <p className="text-[12px] text-emerald-600 mt-0.5 flex items-center gap-1">
                📈
                {change}
              </p>
            )}
            {meta && (
              <div className={`mt-2 text-[12px] text-gray-600`}>
                {meta}
              </div>
            )}
          </div>
          <div className={`${compact ? 'w-9 h-9' : 'w-10 h-10'} rounded-lg flex items-center justify-center flex-shrink-0 ${color} shadow-sm`}>
            <span className="text-white">{typeof Icon === 'string' ? Icon : '📊'}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="spinner"></div>
          <span className="ml-2 text-gray-600">កំពុងទាញយកទិន្នន័យ...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 print:p-0">
      {/* Page Header */}
      <div className="mb-1 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ទំព័រដើម</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Export buttons removed per request */}
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            🏆
            <span className="font-bold whitespace-nowrap">របាយការណ៍សរុប</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-2 print:hidden">
        {/* Replace total-employees card with active-employees as the primary metric */}
        <StatCard
          title="បុគ្គលិកសកម្ម"
          value={stats.activeEmployees}
          icon="➕"
          color="bg-green-500"
          change="+8% ពីខែមុន"
          meta={(
            <>
              <span>បុរស: <strong className="text-gray-900">{genderBreakdowns.active.male}</strong></span>
              <span>ស្រី: <strong className="text-gray-900">{genderBreakdowns.active.female}</strong></span>
            </>
          )}
        />

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 cursor-pointer hover:shadow-md transition-all duration-200 relative overflow-hidden" onClick={() => navigate('/employee-report?group=officertype')}>
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500" />
          <div className="flex items-center justify-between mt-1 mb-1.5">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Noto Sans Khmer', sans-serif" }}>ប្រភេទមន្ត្រី</p>
            <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center shadow-sm flex-shrink-0">
              👥
            </div>
          </div>
          <div className="space-y-0.5">
            {(metricsExtra.officerTypesDetailed || metricsExtra.officerTypes).map((o, idx) => {
              const colors = ['bg-blue-50 text-blue-700 border-blue-100', 'bg-emerald-50 text-emerald-700 border-emerald-100', 'bg-orange-50 text-orange-700 border-orange-100', 'bg-purple-50 text-purple-700 border-purple-100', 'bg-rose-50 text-rose-700 border-rose-100'];
              const c = colors[idx % colors.length];
              return (
                <div key={o.type} className="flex justify-between items-center hover:bg-gray-50 rounded px-0.5 transition-colors cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); navigate(`/employee-report?officerType=${encodeURIComponent(o.type)}`); }}>
                  <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full border truncate max-w-[120px] ${c}`}>{o.type}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[12px] font-bold text-gray-800">{o.count ?? 0} <span className="text-[10px] font-normal text-gray-400">នាក់</span></span>
                    {o.male !== undefined && (
                      <span className="text-[9px] text-gray-400 bg-gray-50 px-1 py-px rounded border border-gray-100 whitespace-nowrap">ប:{o.male} ស:{o.female ?? 0}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {metricsExtra.officerTypes.length === 0 && (
              <div className="text-[12px] text-gray-400 py-2 text-center">មិនមានទិន្នន័យ</div>
            )}
          </div>
        </div>
        <div
          onClick={() => navigate('/official-delisted-report')}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 relative overflow-hidden group cursor-pointer hover:shadow-md hover:border-orange-200 transition-all duration-200"
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-orange-500" />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Noto Sans Khmer', sans-serif" }}>មន្ត្រីថ្មី និង ឈប់ (ខែនេះ)</p>
            <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              📅
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* New Staff Section */}
            <div className="bg-slate-50 group-hover:bg-white p-1.5 rounded-lg border border-slate-100 group-hover:border-orange-100 transition-all">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500 font-medium">មន្ត្រីថ្មី</p>
                📅
              </div>
              <p className="text-xl font-bold text-orange-600">{toKhmerDigits(stats.newThisMonth)}</p>
              <div className="text-[9px] text-gray-400 mt-0.5">ប: {toKhmerDigits(genderBreakdowns.newThisMonth.male)} ស: {toKhmerDigits(genderBreakdowns.newThisMonth.female)}</div>
            </div>
            {/* Resigned Staff Section */}
            <div className="bg-slate-50 group-hover:bg-white p-1.5 rounded-lg border border-slate-100 group-hover:border-rose-100 transition-all">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500 font-medium">មន្ត្រីឈប់</p>
                👤-
              </div>
              <p className="text-xl font-bold text-rose-600">{toKhmerDigits(stats.stoppedThisMonth)}</p>
              <div className="text-[9px] text-gray-400 mt-0.5">ប: {toKhmerDigits(genderBreakdowns.stoppedThisMonth.male)} ស: {toKhmerDigits(genderBreakdowns.stoppedThisMonth.female)}</div>
            </div>
          </div>
          <div className="mt-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] text-blue-600 font-bold flex items-center justify-center gap-1">
              មើលរបាយការណ៍លម្អិត 📈
            </span>
          </div>
        </div>
        <StatCard
          title="វត្តមានថ្ងៃនេះ"
          value={attendanceToday.present}
          icon="⏰"
          color="bg-emerald-500"
          onClick={() => navigate('/attendance-day-report')}
          meta={(
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <span className="text-[12px] whitespace-nowrap">សរុប៖ <strong className="text-gray-900">{attendanceToday.total}</strong></span>
                <span className="text-[12px] whitespace-nowrap">វត្តមាន៖ <strong className="text-emerald-700">{attendanceToday.present}</strong></span>
                <span className="text-[12px] whitespace-nowrap cursor-pointer hover:text-rose-700 transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/attendance-daily-report?filter=absent'); }}>អវត្តមាន៖ <strong className="text-rose-600">{attendanceToday.absent}</strong></span>
                <span className="text-[12px] whitespace-nowrap cursor-pointer hover:text-amber-700 transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/attendance-day-report?filter=leave'); }}>ច្បាប់៖ <strong className="text-amber-600">{attendanceToday.leave}</strong></span>
                <span className="text-[12px] whitespace-nowrap">សម្រាក៖ <strong className="text-sky-600">{attendanceToday.dayOff}</strong></span>
                <span className="text-[12px] whitespace-nowrap">វេនល្ងាច៖ <strong className="text-blue-600">{attendanceToday.eveningPending}</strong></span>
                <span className="text-[10px] whitespace-nowrap">យឺត/មុន៖ <strong className="text-orange-600">{attendanceToday.late}/{attendanceToday.early}</strong></span>
              </div>
            </>
          )}
        />
      </div>

      {/* Extra Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-2 mb-2 print:hidden">
        <StatCard
          title="សពុភាពបុគ្គលិក (សាកល្បង)"
          value={probationStatusCounts.total}
          icon="📈"
          compact={true}
          color="bg-sky-500"
          onClick={() => navigate('/new-employees-this-month?filter=probation')}
          meta={(
            <>
              <div className="text-[12px]">
                <div>កំពុងសាកល្បង: <strong className="text-gray-900">{probationStatusCounts.ongoing}</strong></div>
                <div>ជិតចប់សាកល្បង: <strong className="text-rose-600 font-bold">{probationStatusCounts.endingSoon}</strong></div>
                <div>បញ្ចប់ថ្មីៗ (30ថ្ងៃ): <strong className="text-emerald-600">{probationStatusCounts.completedRecent}</strong></div>
              </div>
            </>
          )}
        />
        <StatCard
          title="ប្រភេទច្បាប់ (ថ្ងៃនេះ)"
          value={attendanceToday.leave}
          icon="📅"
          compact={true}
          color="bg-amber-500"
          onClick={() => { console.log('Navigating to leave report...'); navigate('/attendance-leave-today'); }}
          meta={(
            <>
              <div className="text-[12px] space-y-1">
                {Object.keys(leaveBreakdown).length > 0 ? (
                  Object.entries(leaveBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <div key={type} className="flex justify-between gap-2 border-b border-gray-50 pb-0.5">
                        <span className="truncate">{type}</span>
                        <strong className="text-amber-700">{count}</strong>
                      </div>
                    ))
                ) : (
                  <div className="text-gray-400 italic">គ្មានអ្នកសុំច្បាប់</div>
                )}
              </div>
            </>
          )}
        />
        <StatCard
          title="កំពុងតែសិក្សា"
          value={studyStatusCounts.studying?.total ?? 0}
          icon="⏰"
          compact={true}
          color="bg-indigo-600"
          onClick={() => navigate('/study-leave-report')}
          meta={(
            <>
              <div className="text-[12px]">
                <div>ត្រៀមទៅសិក្សា: <strong className="text-gray-900">{studyStatusCounts.preparing?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{studyStatusCounts.preparing?.female ?? 0}</strong></div>
                <div>កំពុងតែសិក្សា: <strong className="text-gray-900">{studyStatusCounts.studying?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{studyStatusCounts.studying?.female ?? 0}</strong></div>
                <div>ចូលបម្រើការងារវិញ: <strong className="text-gray-900">{studyStatusCounts.returned?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{studyStatusCounts.returned?.female ?? 0}</strong></div>
                <div className="mt-1">សរុប: <strong className="text-gray-900">{studyStatusCounts.total ?? 0}</strong>  •  ស្រីសរុប: <strong className="text-gray-900">{studyStatusCounts.femaleTotal ?? 0}</strong></div>
              </div>
            </>
          )}
        />
        <StatCard
          title="បុគ្គលិកទៅបេសកកម្ម (ថ្ងៃនេះ)"
          value={missionToday.length}
          icon="👥"
          compact={true}
          color="bg-emerald-600"
          onClick={() => navigate('/missions')}
          meta={(
            <>
              <div className="text-[12px] max-w-[220px] truncate">
                {(missionToday || []).slice(0, 6).map((m, idx) => (
                  <div key={m._id || m.id || idx} className="truncate">{m.name || m.khmerName || 'គ្មានឈ្មោះ'}</div>
                ))}
                {(missionToday || []).length > 6 && <div className="text-[12px] text-gray-500">…</div>}
              </div>
            </>
          )}
        />
        <StatCard
          title="កំពុងទំនេរគ្មានបៀវត្ស"
          value={vacancyStatusCounts.ongoing?.total ?? 0}
          icon="👥"
          compact={true}
          color="bg-red-500"
          onClick={() => navigate('/unpaid-leave-report')}
          meta={(
            <>
              <div className="text-[12px]">
                <div>ត្រៀមទំនេរ: <strong className="text-gray-900">{vacancyStatusCounts.preparing?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{vacancyStatusCounts.preparing?.female ?? 0}</strong></div>
                <div>កំពុងទំនេរ: <strong className="text-gray-900">{vacancyStatusCounts.ongoing?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{vacancyStatusCounts.ongoing?.female ?? 0}</strong></div>
                <div>ចូលបម្រើការងារវិញ: <strong className="text-gray-900">{vacancyStatusCounts.returned?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{vacancyStatusCounts.returned?.female ?? 0}</strong></div>
                <div className="mt-1">សរុប: <strong className="text-gray-900">{vacancyStatusCounts.total ?? vacancyCounts.total}</strong>  •  ស្រីសរុប: <strong className="text-gray-900">{vacancyStatusCounts.femaleTotal ?? vacancyCounts.female ?? 0}</strong></div>
              </div>
            </>
          )}
        />
        <StatCard
          title="មន្រ្តីចូលនិវត្ត"
          value={retirementCounts.civil?.total ?? 0}
          icon="🏆"
          compact={true}
          color="bg-yellow-500"
          onClick={() => navigate('/retirement-report')}
          meta={(
            <>
              <div className="text-[12px]">
                <div>សរុប: <strong className="text-gray-900">{retirementCounts.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{retirementCounts.female ?? 0}</strong></div>
                <div>មន្រ្តីរាជការ: <strong className="text-gray-900">{retirementCounts.civil?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{retirementCounts.civil?.female ?? 0}</strong></div>
                <div>កិច្ចសន្យា: <strong className="text-gray-900">{retirementCounts.contract?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{retirementCounts.contract?.female ?? 0}</strong></div>
              </div>
            </>
          )}
        />

        <StatCard
          title="Work Schedule (ថ្ងៃនេះ)"
          value={workScheduleDaily.workingToday}
          icon="📅"
          compact={true}
          color="bg-blue-600"
          onClick={() => navigate('/work-schedule')}
          meta={(
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
              <div className="flex justify-between items-center bg-amber-50 rounded px-1.5 py-0.5">
                <span className="text-gray-500 text-[10px]">🌅 វេនព្រឹក</span>
                <strong className="text-amber-700 text-[12px]">{workScheduleDaily.dayShift ?? 0}</strong>
              </div>
              <div className="flex justify-between items-center bg-purple-50 rounded px-1.5 py-0.5">
                <span className="text-gray-500 text-[10px]">🌙 វេនយប់</span>
                <strong className="text-purple-700 text-[12px]">{workScheduleDaily.nightShift ?? 0}</strong>
              </div>
              <div className="flex justify-between items-center bg-indigo-50 rounded px-1.5 py-0.5">
                <span className="text-gray-500 text-[10px]">🕐 24h</span>
                <strong className="text-indigo-700 text-[12px]">{workScheduleDaily.shift24Hours ?? 0}</strong>
              </div>
              <div className="flex justify-between items-center bg-sky-50 rounded px-1.5 py-0.5">
                <span className="text-gray-500 text-[10px]">🏖️ Day Off</span>
                <strong className="text-sky-700 text-[12px]">{workScheduleDaily.dayOffToday ?? 0}</strong>
              </div>
              {(workScheduleDaily.notScheduled ?? 0) > 0 && (
                <div className="col-span-2 flex justify-between items-center bg-rose-50 rounded px-1.5 py-0.5">
                  <span className="text-rose-500 text-[10px]">⚠️ មិនបានកំណត់</span>
                  <strong className="text-rose-700 text-[12px]">{workScheduleDaily.notScheduled}</strong>
                </div>
              )}
            </div>
          )}
        />
      </div>


      {/* Toggleable Summaries - Horizontal Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:hidden">
        {/* Skills Toggle */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowSkills(!showSkills)}
            className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${showSkills ? 'bg-amber-50 border-b border-amber-100' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center shadow-sm">
                🏆
              </div>
              <p style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", fontWeight: 700, fontSize: 13, margin: 0, color: '#1e3a8a' }}>ជំនាញ (Skills)</p>
              <span className="text-[12px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                {metricsExtra.skills?.length || 0} ប្រភេទ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{showSkills ? 'លាក់' : 'បង្ហាញ'}</span>
              <span className={`inline-block text-gray-400 transition-transform duration-300 ${showSkills ? 'rotate-180' : ''}`}>🔽</span>
            </div>
          </button>
        </div>

        {/* Positions Toggle */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowPositions(!showPositions)}
            className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${showPositions ? 'bg-sky-50 border-b border-sky-100' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center shadow-sm">
                👤+
              </div>
              <p style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", fontWeight: 700, fontSize: 13, margin: 0, color: '#1e3a8a' }}>តួនាទី (Positions)</p>
              <span className="text-[12px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                {metricsExtra.positions?.length || 0} ប្រភេទ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{showPositions ? 'លាក់' : 'បង្ហាញ'}</span>
              <span className={`inline-block text-gray-400 transition-transform duration-300 ${showPositions ? 'rotate-180' : ''}`}>🔽</span>
            </div>
          </button>
        </div>

        {/* Departments Toggle */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowDepartments(!showDepartments)}
            className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${showDepartments ? 'bg-purple-50 border-b border-purple-100' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center shadow-sm">
                🗄️
              </div>
              <p style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", fontWeight: 700, fontSize: 13, margin: 0, color: '#1e3a8a' }}>ផ្នែកនានា (Departments)</p>
              <span className="text-[12px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                {departmentList?.length || 0} ផ្នែក
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{showDepartments ? 'លាក់' : 'បង្ហាញ'}</span>
              <span className={`inline-block text-gray-400 transition-transform duration-300 ${showDepartments ? 'rotate-180' : ''}`}>🔽</span>
            </div>
          </button>
        </div>
      </div>

      {/* Expanded Content Area - Below the buttons */}
      <div className="space-y-4 mb-6 print:hidden">
        {showSkills && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
              <span className="text-white font-bold text-lg">🏆 ៨. សង្ខេបជំនាញ</span>
              <div className="flex items-center gap-2">
                <button onClick={handlePrintAllSkills} className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg flex items-center gap-1 text-[12px] font-bold transition-colors">
                  🖨️ ព្រីនគ្រប់ជំនាញ
                </button>
                <span className="bg-white/20 text-white text-[12px] px-2 py-1 rounded-lg font-bold">{metricsExtra.skills.length} ប្រភេទ</span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-y-2">
                {metricsExtra.skills.map(s => {
                  const m = s.isGroup ?
                    (JSON.parse(localStorage.getItem('employee_skill_groups') || '[]').find(g => g.name === s.type)?.members || []).reduce((acc, mem) => {
                      const mm = skillAttendanceMetrics[normSkill(mem)] || {};
                      acc.absent += mm.absent || 0;
                      acc.leave += mm.leave || 0;
                      acc.late += mm.late || 0;
                      acc.early += mm.early || 0;
                      return acc;
                    }, { absent: 0, leave: 0, late: 0, early: 0 })
                    : (skillAttendanceMetrics[normSkill(s.type)] || {});



                  return (
                    <div key={s.type} className={`flex justify-between items-center py-2 px-3 rounded-xl bg-white border border-gray-100 hover:shadow-sm hover:border-amber-200 transition-all cursor-pointer ${s.isGroup ? 'bg-amber-50 border-amber-100' : ''}`} onClick={() => handleSkillClick(s.type)}>
                      <span className={`truncate flex-1 min-w-0 mr-2 ${s.isGroup ? "text-amber-800 font-bold" : "text-gray-700 font-bold"}`}>{s.type}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* 3 Boxes: Total, Male, Female */}
                        <div className="flex items-center gap-1">
                          <div className="w-[62px] text-center py-1 bg-white border border-gray-200 text-gray-900 rounded-lg text-[10px] font-black shadow-sm flex items-center justify-center gap-1">
                            <span className="text-gray-400 font-normal">សរុប:</span>{s.count}
                          </div>
                          <div className="w-[45px] text-center py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-[10px] font-black flex items-center justify-center gap-1">
                            <span className="text-blue-400 font-normal">ប:</span>{s.male || 0}
                          </div>
                          <div className="w-[45px] text-center py-1 bg-purple-50 border border-purple-100 text-purple-700 rounded-lg text-[10px] font-black flex items-center justify-center gap-1">
                            <span className="text-purple-400 font-normal">ស:</span>{s.female || 0}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showPositions && (
          <div className="bg-white rounded-xl border border-sky-200 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-sky-500 to-cyan-600 px-6 py-4 flex items-center justify-between">
              <span className="text-white font-bold text-lg">🎖️ ៩. សង្ខេបតួនាទី</span>
              <div className="flex items-center gap-2">
                <button onClick={handlePrintAllRoles} className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg flex items-center gap-1 text-[12px] font-bold transition-colors">
                  🖨️ ព្រីនគ្រប់តួនាទី
                </button>
                <span className="bg-white/20 text-white text-[12px] px-2 py-1 rounded-lg font-bold">{metricsExtra.positions.length} ប្រភេទ</span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-y-2">
                {metricsExtra.positions.map(p => {
                  const m = posAttendanceMetrics[normPos(p.type)] || {};


                  return (
                    <div key={p.type} className="flex justify-between items-center py-2 px-3 rounded-xl bg-white border border-gray-100 hover:shadow-sm hover:border-sky-200 transition-all cursor-pointer" onClick={() => handleRoleClick(p.type)}>
                      <span className="truncate flex-1 min-w-0 mr-2 text-gray-700 font-bold">{p.type}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* 3 Boxes: Total, Male, Female */}
                        <div className="flex items-center gap-1">
                          <div className="w-[62px] text-center py-1 bg-white border border-gray-200 text-gray-900 rounded-lg text-[10px] font-black shadow-sm flex items-center justify-center gap-1">
                            <span className="text-gray-400 font-normal">សរុប:</span>{p.count}
                          </div>
                          <div className="w-[45px] text-center py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-[10px] font-black flex items-center justify-center gap-1">
                            <span className="text-blue-400 font-normal">ប:</span>{p.male || 0}
                          </div>
                          <div className="w-[45px] text-center py-1 bg-purple-50 border border-purple-100 text-purple-700 rounded-lg text-[10px] font-black flex items-center justify-center gap-1">
                            <span className="text-purple-400 font-normal">ស:</span>{p.female || 0}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showDepartments && (
          <div className="bg-white rounded-xl border border-purple-200 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
              <span className="text-white font-bold text-lg">🏢 ៧. ផ្នែក / ការិយាល័យ</span>
              <span className="bg-white/20 text-white text-[12px] px-2 py-1 rounded-lg font-bold">{departmentList.length} ផ្នែក</span>
            </div>
            <div className="p-6">
              <div className="mb-4 flex items-center gap-1 bg-purple-50 p-1.5 rounded-xl border border-purple-100 w-fit">
                {[
                  { key: 'total', label: 'សរុប' },
                  { key: 'absent', label: 'អ' },
                  { key: 'leave', label: 'ច' },
                  { key: 'late', label: 'យ' },
                  { key: 'early', label: 'ម' }
                ].map(sk => (
                  <button
                    key={sk.key}
                    onClick={() => setDeptSortKey(sk.key)}
                    className={`px-3 py-1 text-[12px] font-bold rounded-lg transition-all ${deptSortKey === sk.key ? 'bg-purple-600 text-white shadow-sm scale-105' : 'text-purple-600 hover:bg-purple-100'}`}
                  >
                    {sk.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-y-2">
                {[...departmentList].sort((a, b) => {
                  const mA = deptAttendanceMetrics[a.name] || {};
                  const mB = deptAttendanceMetrics[b.name] || {};
                  if (deptSortKey === 'absent') {
                    const valA = mA.absent || 0;
                    const valB = mB.absent || 0;
                    if (valB !== valA) return valB - valA;
                  } else if (deptSortKey === 'leave') {
                    const valA = mA.leave || 0;
                    const valB = mB.leave || 0;
                    if (valB !== valA) return valB - valA;
                  } else if (deptSortKey === 'late') {
                    const valA = mA.late || 0;
                    const valB = mB.late || 0;
                    if (valB !== valA) return valB - valA;
                  } else if (deptSortKey === 'early') {
                    const valA = mA.early || 0;
                    const valB = mB.early || 0;
                    if (valB !== valA) return valB - valA;
                  } else if (deptSortKey === 'total') {
                    if (b.count !== a.count) return b.count - a.count;
                  }
                  return b.count - a.count;
                }).map((d, idx) => {
                  const m = deptAttendanceMetrics[d.name] || {};
                  const metrics = [
                    { label: 'អ', val: m.absent || 0, bg: 'bg-rose-500', text: 'text-white' },
                    { label: 'ច', val: m.leave || 0, bg: 'bg-amber-400', text: 'text-white' },
                    { label: 'យ', val: m.late || 0, bg: 'bg-orange-100', text: 'text-orange-600' },
                    { label: 'ម', val: m.early || 0, bg: 'bg-orange-50', text: 'text-orange-500' }
                  ];

                  return (
                    <div key={d.name || idx} className="flex justify-between items-center py-2 px-3 rounded-xl bg-white border border-gray-100 hover:shadow-sm hover:border-purple-200 transition-all group">
                      <span className="text-[12px] font-bold text-gray-700 truncate flex-1" title={d.name}>{d.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-[62px] text-center py-1 bg-white border border-gray-200 text-gray-900 rounded-lg text-[10px] font-black shadow-sm flex items-center justify-center gap-1">
                            <span className="text-gray-400 font-normal">សរុប:</span>{d.count}
                          </div>
                          <div className="w-[45px] text-center py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-[10px] font-black flex items-center justify-center gap-1">
                            <span className="text-blue-400 font-normal">ប:</span>{d.male || 0}
                          </div>
                          <div className="w-[45px] text-center py-1 bg-purple-50 border border-purple-100 text-purple-700 rounded-lg text-[10px] font-black flex items-center justify-center gap-1">
                            <span className="text-purple-400 font-normal">ស:</span>{d.female || 0}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {metrics.map(mt => (
                            <div
                              key={mt.label}
                              className={`w-9 text-center py-0.5 text-[9px] font-black rounded border border-gray-100 transition-all ${mt.val > 0 ? `${mt.bg} ${mt.text}` : 'bg-gray-50 text-gray-300'}`}
                            >
                              {mt.label}:{mt.val}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Recent Employees (hide details if user lacks HR view permission) */}
        {canViewHR ? (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">របាយការណ៍បេសកកម្ម</h3>
                <p className="text-[12px] text-gray-600 mt-1">បុគ្គលិកដែលត្រូវទៅបេសកកម្មសម្រាប់ថ្ងៃ</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {missionToday.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-lg">មិនមានបុគ្គលិកដែលត្រូវទៅបេសកកម្មសម្រាប់ថ្ងៃនេះ</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-3 py-2 text-[12px] text-gray-600">#</th>
                            <th className="px-3 py-2 text-[12px] text-gray-600">ឈ្មោះ</th>
                            <th className="px-3 py-2 text-[12px] text-gray-600">ឈ្មោះខ្មែរ</th>
                            <th className="px-3 py-2 text-[12px] text-gray-600">មុខតំណែង</th>
                            <th className="px-3 py-2 text-[12px] text-gray-600">ផ្នែក</th>
                            <th className="px-3 py-2 text-[12px] text-gray-600">បេសកកម្ម</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(missionToday || []).map((employee, idx) => {
                            const displayName = getEmployeeDisplayName(employee);
                            const khmerName = employee.khmerName || employee.khmer_name || '';
                            const position = employee.position || employee.officerType || '';
                            const dept = employee.Department_Kh || employee.department || '';
                            const missionTitle = employee.mission?.title || (Array.isArray(employee.missions) && employee.missions[0]?.title) || '';
                            return (
                              <tr key={employee._id || employee.id || displayName} className="border-t">
                                <td className="px-3 py-2 text-[12px] text-gray-700 align-top">{idx + 1}</td>
                                <td className="px-3 py-2 text-[12px] text-gray-900 align-top">{displayName}</td>
                                <td className="px-3 py-2 text-[12px] text-gray-700 align-top">{khmerName}</td>
                                <td className="px-3 py-2 text-[12px] text-gray-700 align-top">{position}</td>
                                <td className="px-3 py-2 text-[12px] text-gray-700 align-top">{dept}</td>
                                <td className="px-3 py-2 text-[12px] text-gray-700 align-top">{missionTitle}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 p-6 bg-white rounded-lg border border-gray-200 text-[12px] text-gray-600">មិនមានសិទ្ធិមើលបុគ្គលិក</div>
        )}

        {/* Quick Actions */}
        <div>
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">សកម្មភាពរហ័ស</h3>
              <p className="text-[12px] text-gray-600 mt-1">ការងារទូទៅ</p>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                <button onClick={() => navigate('/employee-report?group=department')} className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                  🏆
                  <div>
                    <p className="font-medium text-gray-900">សរុបផ្នែក</p>
                    <p className="text-[12px] text-gray-600">{stats.departments} ផ្នែក</p>
                  </div>
                </button>

                <button className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-colors">
                  ⏰
                  <div>
                    <p className="font-medium text-gray-900">វត្តមាន</p>
                    <p className="text-[12px] text-gray-600">គ្រប់គ្រងវត្តមាន</p>
                  </div>
                </button>

                <button className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-300 transition-colors">
                  🏆
                  <div>
                    <p className="font-medium text-gray-900">របាយការណ៍</p>
                    <p className="text-[12px] text-gray-600">មើលរបាយការណ៍</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Missing data overview */}
          <div className="bg-white rounded-lg border border-gray-200 mt-6">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">ទិន្នន័យខ្វះ</h3>
              <p className="text-[12px] text-gray-600 mt-1">បញ្ជីទិន្នន័យដែលគ្មាន</p>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                <button onClick={() => navigate('/employee-report?missing=phone')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-[12px] text-gray-700">ទំនាក់ទំនង (ទូរស័ព្ទ/ម៉ូបៃល៍) ខ្វះ</div>
                  <div className="text-[12px] font-medium text-gray-900">{missingCounts.phone ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=position')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-[12px] text-gray-700">មុខតំណែង / តួនាទី ខ្វះ</div>
                  <div className="text-[12px] font-medium text-gray-900">{missingCounts.position ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=department')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-[12px] text-gray-700">ផ្នែក ខ្វះ</div>
                  <div className="text-[12px] font-medium text-gray-900">{missingCounts.department ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=staffId')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-[12px] text-gray-700">លេខអត្តលេខ ខ្វះ</div>
                  <div className="text-[12px] font-medium text-gray-900">{missingCounts.staffId ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-id-docs?filter=missing_nid')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-[12px] text-gray-700">អត្តសញ្ញាណប័ណ្ណ ខ្វះ</div>
                  <div className="text-[12px] font-medium text-gray-900">{missingCounts.nid ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=bankAccount')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-[12px] text-gray-700">លេខគណនីធនាគារ ខ្វះ</div>
                  <div className="text-[12px] font-medium text-gray-900">{missingCounts.bankAccount ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=image')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-[12px] text-gray-700">រូបថត​(Image) ខ្វះ</div>
                  <div className="text-[12px] font-medium text-gray-900">{missingCounts.image ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=signature')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-[12px] text-gray-700">ហត្ថលេខា (Signature) ខ្វះ</div>
                  <div className="text-[12px] font-medium text-gray-900">{missingCounts.signature ?? 0}</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Summary Report Modal */}
      {showReportModal && (
        <div id="summary-report-modal-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:static print:bg-transparent print:p-0">
          <style media="print">
            {`
              @page { size: A4 portrait; margin: 1cm; }
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              #summary-report-content { overflow: visible !important; max-height: none !important; height: auto !important; }
            `}
          </style>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col print:max-h-none print:shadow-none print:rounded-none print:block">

            {/* Modal Header Bar */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-800 via-blue-700 to-indigo-700 p-4 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  🗄️
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>របាយការណ៍សង្ខេបស្ថានភាពបុគ្គលិក</h2>
                  <p className="text-blue-200 text-[12px]">{new Date().toLocaleDateString('km-KH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg flex items-center gap-2 text-[12px] font-medium transition-colors"
                >
                  📈
                  បោះពុម្ព
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/20 transition-colors"
                >
                  ✖️
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div id="summary-report-content" className="flex-1 overflow-y-auto p-6 print:p-0 space-y-6 bg-gray-50/50 print:overflow-visible print:bg-white">

              {/* Printable Report Header */}
              <div className="text-center pb-5 border-b-2 border-blue-800 print:block hidden">
                <h1 className="text-[17px] font-normal text-gray-900 mb-1" style={{ fontFamily: "'Khmer OS Muol Light'" }}>ព្រះរាជាណាចក្រកម្ពុជា</h1>
                <h2 className="text-[17px] font-normal text-gray-900 mb-3" style={{ fontFamily: "'Khmer OS Muol Light'" }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
                <h3 className="text-lg font-bold text-blue-900">របាយការណ៍សង្ខេបស្ថានភាពបុគ្គលិក</h3>
                <p className="text-gray-600 text-[12px] mt-1">កាលបរិច្ឆេទ: {new Date().toLocaleDateString('km-KH', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>

              {/* Section 1 + 2 side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4">
                {/* Section 1 - Staff Summary */}
                <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 h-[52px] flex items-center gap-2">
                    <span className="text-white font-bold text-[12px]">👥 ១. ស្ថិតិបុគ្គលិករួម</span>
                  </div>
                  <div className="p-2 space-y-0 text-[12px]">
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-900 font-medium">បុគ្គលិករាប់ (Active):</span>
                      <strong className="text-blue-700 text-[12px]">{stats.activeEmployees} នាក់</strong>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-900 font-medium">ថ្មីខែនេះ:</span>
                      <span className="font-semibold text-emerald-600">+{stats.newThisMonth} នាក់</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-900 font-medium">ឈប់ខែនេះ:</span>
                      <span className="font-semibold text-rose-500">-{stats.stoppedThisMonth} នាក់</span>
                    </div>
                    {(metricsExtra.officerTypesDetailed || metricsExtra.officerTypes).length > 0 && (
                      <div className="pt-2">
                        <div className="text-[12px] font-bold text-gray-900 uppercase tracking-wide mb-2">ប្រភេទមន្ត្រី</div>
                        <div className="space-y-1">
                          {(metricsExtra.officerTypesDetailed || metricsExtra.officerTypes).map(o => (
                            <div key={o.type} className="flex justify-between items-center text-[12px] bg-blue-50 rounded px-2 py-0">
                              <span className="text-gray-900 font-medium">{o.type}</span>
                              <span className="font-bold text-blue-700">{o.count} <span className="text-gray-900 font-normal">(ស: {o.female})</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2 - Attendance Today */}
                <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 h-[52px] flex items-center gap-2">
                    <span className="text-white font-bold text-[12px]">📊 ២. វត្តមានប្រចាំថ្ងៃ</span>
                  </div>
                  <div className="p-2 space-y-0 text-[12px]">
                    {[
                      { label: 'ត្រូវមក', value: attendanceToday.total, color: 'text-blue-700' },
                      { label: 'វត្តមាន', value: attendanceToday.present, color: 'text-emerald-600' },
                      { label: 'អវត្តមាន', value: attendanceToday.absent, color: 'text-rose-500' },
                      { label: 'ច្បាប់', value: attendanceToday.leave, color: 'text-amber-600' },
                      { label: 'ចូលយឺត', value: attendanceToday.late, color: 'text-orange-600' },
                      { label: 'ចេញមុន', value: attendanceToday.early, color: 'text-orange-600' },
                      { label: 'វេនល្ងាច', value: attendanceToday.eveningPending, color: 'text-blue-600' },
                    ].map(a => (
                      <div key={a.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-900 font-medium">{a.label}:</span>
                        <strong className={`${a.color} text-[12px]`}>{a.value} នាក់</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>


              {/* Section 7 - Probation (Full Width) */}
              <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-3">
                  <span className="text-white font-bold text-[14px]">⏳ ៣. ស្ថានភាពសាកល្បងបុគ្គលិក</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1">
                    {[
                      { type: 'កំពុងសាកល្បង', count: probationStatusCounts.ongoing || 0, male: probationStatusCounts.ongoingMale || 0, female: probationStatusCounts.ongoingFemale || 0 },
                      { type: 'ជិតចប់ (10ថ្ងៃ)', count: probationStatusCounts.endingSoon || 0, male: probationStatusCounts.endingSoonMale || 0, female: probationStatusCounts.endingSoonFemale || 0 },
                      { type: 'បញ្ចប់ថ្មីៗ (30ថ្ងៃ)', count: probationStatusCounts.completedRecent || 0, male: probationStatusCounts.completedRecentMale || 0, female: probationStatusCounts.completedRecentFemale || 0 },
                      { type: 'សរុបទាំងអស់', count: probationStatusCounts.total || 0, male: (probationStatusCounts.ongoingMale + probationStatusCounts.endingSoonMale) || 0, female: (probationStatusCounts.ongoingFemale + probationStatusCounts.endingSoonFemale) || 0 }
                    ].map(item => (
                      <div key={item.type} className="flex justify-between items-center text-[12px] py-0 border-b border-gray-50 hover:bg-rose-50/40 px-2 rounded transition-colors">
                        <span className="text-gray-700 truncate font-bold mr-2">{item.type}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <div className="w-[62px] text-center py-0.5 bg-white border border-gray-200 text-gray-900 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-gray-400 font-normal">សរុប:</span>{item.count}
                            </div>
                            <div className="w-[45px] text-center py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-blue-400 font-normal">ប:</span>{item.male}
                            </div>
                            <div className="w-[45px] text-center py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-purple-400 font-normal">ស:</span>{item.female}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 8-9 - Work Schedule (Full Width) */}
              <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3">
                  <span className="text-white font-bold text-[14px]">📅 ៤. Work Schedule ប្រចាំថ្ងៃ</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1">
                    {[
                      { label: 'ធ្វើការសរុប', value: workScheduleDaily.workingToday },
                      { label: 'វេនព្រឹក-ថ្ងៃ', value: workScheduleDaily.dayShift },
                      { label: 'វេនយប់', value: workScheduleDaily.nightShift },
                      { label: 'វេន 24h', value: workScheduleDaily.shift24Hours },
                      { label: 'Day Off', value: workScheduleDaily.dayOffToday },
                      { label: 'មិនបានកំណត់', value: workScheduleDaily.notScheduled },
                    ].map(s => (
                      <div key={s.label} className="flex justify-between items-center text-[12px] py-0 border-b border-gray-50 hover:bg-emerald-50/40 px-2 rounded transition-colors">
                        <span className="text-gray-700 truncate font-bold mr-2">{s.label}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <div className="w-[62px] text-center py-0.5 bg-white border border-gray-200 text-gray-900 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-gray-400 font-normal">សរុប:</span>{s.value}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 10 - Leave Types (Monthly Summary) */}
              <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-3">
                  <span className="text-white font-bold text-[14px]">🏥 ៥. ប្រភេទច្បាប់ (ខែនេះ)</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1">
                    {metricsExtra.leaveTypes.map(l => (
                      <div key={l.type} className="flex justify-between items-center text-[12px] py-0 border-b border-gray-50 hover:bg-orange-50/40 px-2 rounded transition-colors">
                        <span className="text-gray-700 truncate font-bold mr-2">{l.type}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <div className="w-[62px] text-center py-0.5 bg-white border border-gray-200 text-gray-900 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-gray-400 font-normal">សរុប:</span>{l.count}
                            </div>
                            <div className="w-[45px] text-center py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-blue-400 font-normal">ប:</span>{l.male || 0}
                            </div>
                            <div className="w-[45px] text-center py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-purple-400 font-normal">ស:</span>{l.female || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Section 3 - Mission & Study (Full Width) */}
              <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3">
                  <span className="text-white font-bold text-[14px]">✈️ ៦. បេសកកម្ម និងការសិក្សា</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1">
                    {[
                      { type: 'បេសកកម្មថ្ងៃនេះ', count: missionToday.length, male: missionToday.filter(m => m.gender === 'M' || m.gender === 'ប្រុស').length, female: missionToday.filter(m => m.gender === 'F' || m.gender === 'ស្រី').length },
                      { type: 'កំពុងសិក្សា', count: studyStatusCounts.studying?.total || 0, male: studyStatusCounts.studying?.male || 0, female: studyStatusCounts.studying?.female || 0 },
                      { type: 'ត្រៀមទៅសិក្សា', count: studyStatusCounts.preparing?.total || 0, male: studyStatusCounts.preparing?.male || 0, female: studyStatusCounts.preparing?.female || 0 },
                      { type: 'ទំនេរគ្មានបៀវត្ស', count: vacancyStatusCounts.total, male: vacancyStatusCounts.male || 0, female: vacancyStatusCounts.female || 0 }
                    ].map(item => (
                      <div key={item.type} className="flex justify-between items-center text-[12px] py-0 border-b border-gray-50 hover:bg-indigo-50/40 px-2 rounded transition-colors">
                        <span className="text-gray-700 truncate font-bold mr-2">{item.type}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <div className="w-[62px] text-center py-0.5 bg-white border border-gray-200 text-gray-900 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-gray-400 font-normal">សរុប:</span>{item.count}
                            </div>
                            <div className="w-[45px] text-center py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-blue-400 font-normal">ប:</span>{item.male}
                            </div>
                            <div className="w-[45px] text-center py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                              <span className="text-purple-400 font-normal">ស:</span>{item.female}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Section 4 - Departments  (Full Width) */}
              <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3 flex items-center justify-between">
                  <span className="text-white font-bold text-[12px]">🏢 ៧. ផ្នែក / ការិយាល័យ</span>
                  <span className="text-purple-200 text-[12px]">{stats.departments} ផ្នែក</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1">
                    {[...departmentList].sort((a, b) => {
                      const absA = deptAttendanceMetrics[a.name]?.absent || 0;
                      const absB = deptAttendanceMetrics[b.name]?.absent || 0;
                      if (absB !== absA) return absB - absA;
                      // secondary sort by leave
                      const lA = deptAttendanceMetrics[a.name]?.leave || 0;
                      const lB = deptAttendanceMetrics[b.name]?.leave || 0;
                      if (lB !== lA) return lB - lA;
                      return b.count - a.count;
                    }).map(d => {
                      const m = deptAttendanceMetrics[d.name] || {};
                      const attMetrics = [
                        { label: 'អ', val: m.absent || 0, bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' },
                        { label: 'ច', val: m.leave || 0, bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
                        { label: 'យ', val: m.late || 0, bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
                        { label: 'ម', val: m.early || 0, bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' }
                      ];
                      return (
                        <div key={d.name} className="flex justify-between items-center text-[12px] py-1.5 border-b border-gray-50 hover:bg-purple-50/40 px-2 rounded transition-colors">
                          <span className="text-gray-700 truncate font-bold mr-2">{d.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <div className="w-[62px] text-center py-0.5 bg-white border border-gray-200 text-gray-900 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                                <span className="text-gray-400 font-normal">សរុប:</span>{d.count}
                              </div>
                              <div className="w-[45px] text-center py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                                <span className="text-blue-400 font-normal">ប:</span>{d.male || 0}
                              </div>
                              <div className="w-[45px] text-center py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                                <span className="text-purple-400 font-normal">ស:</span>{d.female || 0}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {attMetrics.map(mt => (
                                <div key={mt.label} className={`w-[28px] text-center py-0.5 border rounded text-[8px] font-black ${mt.val > 0 ? `${mt.bg} ${mt.text} ${mt.border}` : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                                  {mt.label}:{mt.val}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section 5 - Skills (Full Width) */}
              <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
                  <span className="text-white font-bold text-[12px]">🏅 ៨. សង្ខេបជំនាញ</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1">
                    {metricsExtra.skills.map(s => {
                      return (
                        <div key={s.type} className={`flex justify-between items-center text-[12px] py-1.5 px-2 rounded hover:bg-amber-50 border-b border-gray-50 transition-colors ${s.isGroup ? 'bg-amber-50 font-bold' : ''}`}>
                          <span className={`truncate flex-1 min-w-0 mr-4 ${s.isGroup ? 'text-amber-800' : 'text-gray-700 font-bold'}`}>{s.type}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <div className="w-[62px] text-center py-0.5 bg-white border border-gray-200 text-gray-900 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                                <span className="text-gray-400 font-normal">សរុប:</span>{s.count}
                              </div>
                              <div className="w-[45px] text-center py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                                <span className="text-blue-400 font-normal">ប:</span>{s.male || 0}
                              </div>
                              <div className="w-[45px] text-center py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                                <span className="text-purple-400 font-normal">ស:</span>{s.female || 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section 6 - Positions (Full Width) */}
              <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-sky-500 to-cyan-600 px-4 py-3">
                  <span className="text-white font-bold text-[12px]">🎖️ ៩. សង្ខេបតួនាទី</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1">
                    {metricsExtra.positions.map(p => {
                      return (
                        <div key={p.type} className="flex justify-between items-center text-[12px] py-1.5 px-2 rounded hover:bg-sky-50 border-b border-gray-50 transition-colors">
                          <span className="truncate flex-1 min-w-0 mr-2 text-gray-700 font-bold">{p.type}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <div className="w-[62px] text-center py-0.5 bg-white border border-gray-200 text-gray-900 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                                <span className="text-gray-400 font-normal">សរុប:</span>{p.count}
                              </div>
                              <div className="w-[45px] text-center py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                                <span className="text-blue-400 font-normal">ប:</span>{p.male || 0}
                              </div>
                              <div className="w-[45px] text-center py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-md text-[9px] font-black flex items-center justify-center gap-1">
                                <span className="text-purple-400 font-normal">ស:</span>{p.female || 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end px-4 pb-2 print:mt-12 print:border-t print:pt-4">
                <div className="text-[12px] text-gray-400">បោះពុម្ពដោយ: {localStorage.getItem('username') || 'Admin'}</div>
                <div className="text-center min-w-[200px]">
                  <p className="text-[12px] text-gray-500">{new Date().toLocaleDateString('km-KH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="text-[12px] font-bold text-gray-700 mt-1">ហត្ថលេខា និងត្រា</p>
                  <div className="h-16 mt-3 border-b border-dashed border-gray-300"></div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      
      {showRoleEmployeesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-5xl max-h-[80vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Noto Sans Khmer', sans-serif" }}>{selectedRole} ({toKhmerDigits(roleEmployees.length)} នាក់)</h3>
              <div className="flex items-center gap-2">
                <button onClick={handlePrintRoleEmployees} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-[12px] font-medium transition-colors">
                  🖨️ ព្រីន
                </button>
                <button onClick={() => setShowRoleEmployeesModal(false)} className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-[11px]" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="border p-2 text-center">ល.រ</th>
                    <th className="border p-2 text-left">គោត្តនាម និងនាម</th>
                    <th className="border p-2 text-center">ភេទ</th>
                    <th className="border p-2 text-center">ថ្ងៃខែឆ្នាំកំណើត</th>
                    <th className="border p-2 text-left">ប្រភេទមន្រ្តី</th>
                    <th className="border p-2 text-left">ជំនាញ</th>
                    <th className="border p-2 text-left">តួនាទី</th>
                    <th className="border p-2 text-center">លេខទូរស័ព្ទ</th>
                  </tr>
                </thead>
                <tbody>
                  {roleEmployees.map((emp, idx) => (
                    <tr key={emp._id || idx} className="border-t hover:bg-gray-50">
                      <td className="border p-2 text-center">{idx + 1}</td>
                      <td className="border p-2 font-bold">{emp.khmerName || emp.fullName || emp.name}</td>
                      <td className="border p-2 text-center">{emp.gender === 'Male' ? 'ប្រុស' : emp.gender === 'Female' ? 'ស្រី' : emp.gender || ''}</td>
                      <td className="border p-2 text-center">
                        {emp.dob ? (() => {
                          const d = new Date(emp.dob);
                          if (isNaN(d)) return emp.dob;
                          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                        })() : ''}
                      </td>
                      <td className="border p-2">{emp.officerType || ''}</td>
                      <td className="border p-2">{emp.skill || ''}</td>
                      <td className="border p-2">{emp.Position_Kh || emp.position || ''}</td>
                      <td className="border p-2 text-center">{emp.phone || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {roleEmployees.length === 0 && (
                <div className="text-gray-500 text-center py-4">មិនមានបុគ្គលិក</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSkillEmployeesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-5xl max-h-[80vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Noto Sans Khmer', sans-serif" }}>{selectedSkill} ({toKhmerDigits(skillEmployees.length)} នាក់)</h3>
              <div className="flex items-center gap-2">
                <button onClick={handlePrintSkillEmployees} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-[12px] font-medium transition-colors">
                  🖨️ ព្រីន
                </button>
                <button onClick={() => setShowSkillEmployeesModal(false)} className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-[11px]" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="border p-2 text-center">ល.រ</th>
                    <th className="border p-2 text-left">គោត្តនាម និងនាម</th>
                    <th className="border p-2 text-center">ភេទ</th>
                    <th className="border p-2 text-center">ថ្ងៃខែឆ្នាំកំណើត</th>
                    <th className="border p-2 text-left">ប្រភេទមន្រ្តី</th>
                    <th className="border p-2 text-left">ជំនាញ</th>
                    <th className="border p-2 text-left">តួនាទី</th>
                    <th className="border p-2 text-center">លេខទូរស័ព្ទ</th>
                  </tr>
                </thead>
                <tbody>
                  {skillEmployees.map((emp, idx) => (
                    <tr key={emp._id || idx} className="border-t hover:bg-gray-50">
                      <td className="border p-2 text-center">{idx + 1}</td>
                      <td className="border p-2 font-bold">{emp.khmerName || emp.fullName || emp.name}</td>
                      <td className="border p-2 text-center">{emp.gender === 'Male' ? 'ប្រុស' : emp.gender === 'Female' ? 'ស្រី' : emp.gender || ''}</td>
                      <td className="border p-2 text-center">
                        {emp.dob ? (() => {
                          const d = new Date(emp.dob);
                          if (isNaN(d)) return emp.dob;
                          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                        })() : ''}
                      </td>
                      <td className="border p-2">{emp.officerType || ''}</td>
                      <td className="border p-2">{emp.skill || ''}</td>
                      <td className="border p-2">{emp.Position_Kh || emp.position || ''}</td>
                      <td className="border p-2 text-center">{emp.phone || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {skillEmployees.length === 0 && (
                <div className="text-gray-500 text-center py-4">មិនមានបុគ្គលិក</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print-only CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            margin: 1cm;
            size: A4 portrait;
          }
          /* Standard print reset */
          html, body {
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          /* Hide everything first */
          body * {
            visibility: hidden !important;
          }
          /* Show targeted content */
          #summary-report-modal-backdrop,
          #summary-report-modal-backdrop *,
          #summary-report-content,
          #summary-report-content * {
            visibility: visible !important;
          }
          /* Position correctly on the page */
          #summary-report-modal-backdrop {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
          }
          #summary-report-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          /* Hide button UI in modal header during print */
          .print\:hidden {
            display: none !important;
            visibility: hidden !important;
          }
          /* Force colors */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      ` }} />
    </div>
  );
};

export default Dashboard;
