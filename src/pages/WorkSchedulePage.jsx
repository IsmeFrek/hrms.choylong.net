import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import api from '../services/api';

export default function WorkSchedulePage() {
  // Export summary report to Excel (for modal)
  const exportSummaryExcel = () => {
    // Prepare summary data
    const totalEmployees = filteredEmployees.length;
    const workingToday = dailyStats.workingToday;
    const dayShift = dailyStats.dayShift;
    const nightShift = dailyStats.nightShift;
    const shift24Hours = dailyStats.shift24Hours;
    const dayOffToday = dailyStats.dayOffToday;
    const noSchedule = dailyStats.noSchedule;

    // Calculate percentages
    const workingPercent = totalEmployees > 0 ? ((workingToday / totalEmployees) * 100).toFixed(1) : '0.0';
    const dayShiftPercent = totalEmployees > 0 ? ((dayShift / totalEmployees) * 100).toFixed(1) : '0.0';
    const nightShiftPercent = totalEmployees > 0 ? ((nightShift / totalEmployees) * 100).toFixed(1) : '0.0';
    const shift24Percent = totalEmployees > 0 ? ((shift24Hours / totalEmployees) * 100).toFixed(1) : '0.0';
    const dayOffPercent = totalEmployees > 0 ? ((dayOffToday / totalEmployees) * 100).toFixed(1) : '0.0';
    const noSchedulePercent = totalEmployees > 0 ? ((noSchedule / totalEmployees) * 100).toFixed(1) : '0.0';

    // Prepare worksheet data for summary
    const worksheetData = [
      ['ប្រភេទបុគ្គលិក', 'ចំនួន (នាក់)', 'ភាគរយ (%)', 'កំណត់សម្គាល់'],
      ['បុគ្គលិកសរុប', totalEmployees, '100.0%', 'ចំនួនបុគ្គលិកសរុបក្នុងបញ្ជី'],
      ['ធ្វើការសរុប', workingToday, workingPercent + '%', 'បុគ្គលិកដែលធ្វើការនៅថ្ងៃនេះ'],
      ['ចូលពេលព្រឹក', dayShift, dayShiftPercent + '%', 'ធ្វើការពេលព្រឹក'],
      ['វេនល្ងាច', nightShift, nightShiftPercent + '%', 'ធ្វើការវេនល្ងាច'],
      ['វេន២៤ម៉ោង', shift24Hours, shift24Percent + '%', 'ធ្វើការវេន២៤ម៉ោង'],
      ['ឈប់សម្រាក', dayOffToday, dayOffPercent + '%', 'បុគ្គលិកឈប់សម្រាក (Day Off)'],
      ['មិនបានកំណត់ម៉ោង', noSchedule, noSchedulePercent + '%', 'មិនមានកាលវិភាគការងារ']
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');

    // Helper to get employees by category
    function getEmployeesByCategory(type) {
      switch(type) {
        case 'morning':
          return filteredEmployees.filter(emp => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
              if (!s.shiftStart || !s.shiftEnd) return false;
              try {
                const startParts = s.shiftStart.split(':');
                const endParts = s.shiftEnd.split(':');
                const startHour = parseInt(startParts[0]);
                const endHour = parseInt(endParts[0]);
                if (startHour < 12 && endHour >= 12) return true;
                if (startHour < 12 && endHour < 12) {
                  const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
                  const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
                  let duration = endMinutes - startMinutes;
                  if (duration <= 0) duration += 24 * 60;
                  return duration < 20 * 60;
                }
                if (startHour >= 12 && endHour >= 12) return true;
                return false;
              } catch (err) {
                return false;
              }
            });
            return schedule !== undefined;
          });
        case 'night':
          return filteredEmployees.filter(emp => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
              if (!s.shiftStart || !s.shiftEnd) return false;
              const startHour = parseInt(s.shiftStart.split(':')[0]);
              const endHour = parseInt(s.shiftEnd.split(':')[0]);
              return startHour >= 12 && endHour < 12;
            });
            return schedule !== undefined;
          });
        case '24hour':
          return filteredEmployees.filter(emp => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
              if (!s.shiftStart || !s.shiftEnd) return false;
              try {
                const startParts = s.shiftStart.split(':');
                const endParts = s.shiftEnd.split(':');
                const startHour = parseInt(startParts[0]);
                const endHour = parseInt(endParts[0]);
                if (startHour < 12 && endHour < 12) {
                  const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
                  const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
                  let duration = endMinutes - startMinutes;
                  if (duration <= 0) duration += 24 * 60;
                  return duration >= 20 * 60;
                }
                return false;
              } catch (err) {
                return false;
              }
            });
            return schedule !== undefined;
          });
        case 'dayoff':
          return filteredEmployees.filter(emp => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              return scheduleEmployeeId === emp._id && schedDate === selectedDayStats && s.shiftTitle === 'Day Off';
            });
            return schedule !== undefined;
          });
        case 'noschedule':
          return filteredEmployees.filter(emp => {
            const hasSchedule = schedules.some(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              return scheduleEmployeeId === emp._id && schedDate === selectedDayStats;
            });
            return !hasSchedule;
          });
        default:
          return [];
      }
    }

    // Add sheets for each category
    const categories = [
      { key: 'morning', title: 'ចូលពេលព្រឹក' },
      { key: 'night', title: 'ចូលវេនល្ងាច' },
      { key: '24hour', title: 'ប្រចាំ24ម៉ោង' },
      { key: 'dayoff', title: 'ឈប់សម្រាក' },
      { key: 'noschedule', title: 'មិនបានកំណត់ម៉ោង' }
    ];
    categories.forEach(cat => {
      const emps = getEmployeesByCategory(cat.key);
      const sheetData = [
        ['ល.រ', 'លេខកាត', 'ឈ្មោះ']
      ];
      emps.forEach((emp, idx) => {
        sheetData.push([
          idx + 1,
          emp.staffId || emp.cardNumber || '-',
          emp.khmerName || emp.name || '-'
        ]);
      });
      const wsCat = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, wsCat, cat.title);
    });

    // Save file
    const dateFormatted = selectedDayStats.replace(/-/g, '');
    const fileName = `Summary_Report_${dateFormatted}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };
  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [hrData, setHrData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState({ employees: [], schedules: [] });
  const [selectedDayStats, setSelectedDayStats] = useState(new Date().toISOString().slice(0, 10));
  const fileInputRef = useRef(null);
  
  // Stats detail modal states
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsModalData, setStatsModalData] = useState({ title: '', employees: [], type: '' });
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Month navigation functions

  // Modal for summary report
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const navigateToPreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const newMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const navigateToNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const newMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  // Format month display in Khmer
  const formatMonthDisplay = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const monthNames = [
      'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
      'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
    ];
    return `${monthNames[month - 1]} ${year}`;
  };

  // Convert Arabic numerals to Khmer numerals
  const toKhmerNumerals = (number) => {
    const arabicToKhmer = {
      '0': '០',
      '1': '១', 
      '2': '២',
      '3': '៣',
      '4': '៤',
      '5': '៥',
      '6': '៦',
      '7': '៧',
      '8': '៨',
      '9': '៩'
    };
    
    return number.toString().replace(/[0-9]/g, (digit) => arabicToKhmer[digit] || digit);
  };
  
  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState('all'); // 'all', 'name', 'cardNumber'
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  
  // Function to format time to AM/PM
  const formatTimeToAMPM = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const min = minutes || '00';
    
    if (hour === 0) return `12:${min}AM`;
    if (hour < 12) return `${hour}:${min}AM`;
    if (hour === 12) return `12:${min}PM`;
    return `${hour - 12}:${min}PM`;
  };
  const [formData, setFormData] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '08:00',
    endTime: '17:00',
    status: 'scheduled',
    notes: ''
  });

  // Get days in month
  const getDaysInMonth = (yearMonth) => {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selectedMonth);
  
  // Create HR lookup map
  const hrLookup = {};
  hrData.forEach(hr => {
    if (hr.staffId) {
      hrLookup[hr.staffId] = hr;
    }
  });

  // Function to get department from HR data
  const getEmployeeDepartment = (employee) => {
    const hr = hrLookup[employee.staffId || employee.cardNumber];
    // First try HR Department_Kh, then fallback to employee position
    return hr?.Department_Kh || employee.position || employee.Position_Kh || 'មិនបានកំណត់';
  };

  // Function to extract number from department name for sorting
  const extractDepartmentNumber = (deptName) => {
    const match = deptName.match(/(\d+)/);
    return match ? parseInt(match[1]) : 999; // Put departments without numbers at the end
  };

  // Function to sort departments by number
  const sortDepartmentsByNumber = (depts) => {
    return depts.sort((a, b) => {
      const numA = extractDepartmentNumber(a);
      const numB = extractDepartmentNumber(b);
      
      // If both have numbers, sort by number
      if (numA !== 999 && numB !== 999) {
        return numA - numB;
      }
      
      // If only one has number, put numbered one first
      if (numA !== 999 && numB === 999) return -1;
      if (numA === 999 && numB !== 999) return 1;
      
      // If neither has numbers, sort alphabetically
      return a.localeCompare(b, 'km');
    });
  };

  // Get departments from Department table first, then fallback to employee data
  let departments = [];
  
  if (departmentData.length > 0) {
    // Sort departments by Department_Id (numeric order)
    const sortedDepts = departmentData.sort((a, b) => {
      const numA = parseInt(a.Department_Id) || 999;
      const numB = parseInt(b.Department_Id) || 999;
      return numA - numB;
    });
    
    // Use Department_Kh names from the department table
    departments = [
      ...sortedDepts.map(dept => dept.Department_Kh).filter(Boolean),
      'មិនបានកំណត់'
    ];
  } else {
    // Fallback to employee-based departments
    departments = [...new Set(employees.map(emp => getEmployeeDepartment(emp)))];
    departments = sortDepartmentsByNumber(departments);
    
    // If still no departments, use default list organized according to names shown in print document
    if (departments.length === 0 || (departments.length === 1 && departments[0] === 'មិនបានកំណត់')) {
      departments = [
        'ម្រុមការងារ និងដោយឡែក',
        'ម្រុមការងារ និងរាជរដ្ឋាភិបាល',
        'ម្រុមការងារទំនាក់ទំនងសាធារណៈ',
        'ម្រុមការងារក្រុមការងារ',
        'ម្រុមការងារកិច្ចការនារី',
        'ម្រុមការងារចិត្តសាស្រ្តផ្នែក',
        'ម្រុមការងារធនធានមនុស្ស',
        'ម្រុមការងារបណ្តុះបណ្ដាល',
        'ម្រុមការងារពាក់ព័ន្ធ',
        'ម្រុមការងារផ្នែកព័ត៌មាន',
        'ម្រុមការងារពាណិជ្ជកម្ម',
        'ម្រុមការងារ និងសេវាកម្ម',
        'ម្រុមការងារស្រាវជ្រាវ',
        'និរតីដ្ឋានធនាគារ',
        'និបន្ធនការគាំទ្រ',
        'មិនបានកំណត់'
      ];
    }
  }
  
  // Debug: log departments
  console.log('Available departments:', departments);
  console.log('HR lookup keys:', Object.keys(hrLookup));
  console.log('Employees count:', employees.length);
  
  // Filter employees based on department and search
  const filteredEmployees = employees.filter(employee => {
    // Department filter
    const employeeDepartment = getEmployeeDepartment(employee);
    const departmentMatch = selectedDepartment === 'all' || employeeDepartment === selectedDepartment;
    
    // Search filter
    let searchMatch = true;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const name = (employee.khmerName || employee.fullName || employee.name || employee.staffName || '').toLowerCase();
      const cardNumber = (employee.staffId || employee.cardNumber || '').toLowerCase();
      const phone = (employee.phoneNumber || employee.phone || '').toLowerCase();
      const position = (employee.position || employee.Position_Kh || '').toLowerCase();
      
      switch (searchBy) {
        case 'name':
          searchMatch = name.includes(searchLower);
          break;
        case 'cardNumber':
          searchMatch = cardNumber.includes(searchLower);
          break;
        case 'phone':
          searchMatch = phone.includes(searchLower);
          break;
        case 'position':
          searchMatch = position.includes(searchLower);
          break;
        default: // 'all'
          searchMatch = name.includes(searchLower) || 
                       cardNumber.includes(searchLower) || 
                       phone.includes(searchLower) || 
                       position.includes(searchLower);
      }
    }
    
    return departmentMatch && searchMatch;
  });
  
  // Pagination calculations
  const totalEmployees = filteredEmployees.length;
  const totalPages = Math.ceil(totalEmployees / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);
  
  // Reset to first page when itemsPerPage changes or search changes
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };
  
  const handleSearchChange = (newSearchTerm) => {
    setSearchTerm(newSearchTerm);
    setCurrentPage(1);
    setSelectedEmployees([]); // Clear selection when search changes
  };
  
  const handleSearchByChange = (newSearchBy) => {
    setSearchBy(newSearchBy);
    setCurrentPage(1);
    setSelectedEmployees([]); // Clear selection when search type changes
  };
  
  const handleDepartmentChange = (newDepartment) => {
    setSelectedDepartment(newDepartment);
    setCurrentPage(1);
    setSelectedEmployees([]); // Clear selection when department changes
  };
  
  // Delete employee function
  const handleDeleteEmployee = async (employeeId, employeeName) => {
    if (!confirm(`តើអ្នកប្រាកដថាចង់លុបបុគ្គលិក "${employeeName}" មែនទេ?\n\nការលុបនេះនឹងលុបទាំងតារាងការងាររបស់គេផងដែរ។`)) {
      return;
    }
    
    setLoading(true);
    try {
      // Delete employee schedules first
      await api.delete(`/work-schedules/employee/${employeeId}`);
      
      // Delete employee
      await api.delete(`/work-schedule-employees/${employeeId}`);
      
      alert('លុបបុគ្គលិកបានជោគជ័យ!');
      
      // Reload data
      await loadEmployees();
      await loadSchedules();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('មានបញ្ហាក្នុងការលុបបុគ្គលិក: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Bulk delete function
  const handleBulkDelete = async () => {
    if (selectedEmployees.length === 0) {
      alert('សូមជ្រើសរើសបុគ្គលិកដែលចង់លុប');
      return;
    }
    
    if (!confirm(`តើអ្នកប្រាកដថាចង់លុបបុគ្គលិកចំនួន ${selectedEmployees.length} នាក់មែនទេ?\n\nការលុបនេះនឹងលុបទាំងតារាងការងាររបស់គេផងដែរ។`)) {
      return;
    }
    
    setLoading(true);
    try {
      // Delete all selected employees
      for (const employeeId of selectedEmployees) {
        // Delete employee schedules first
        await api.delete(`/work-schedules/employee/${employeeId}`);
        // Delete employee
        await api.delete(`/work-schedule-employees/${employeeId}`);
      }
      
      alert(`លុបបុគ្គលិកចំនួន ${selectedEmployees.length} នាក់បានជោគជ័យ!`);
      
      // Clear selection
      setSelectedEmployees([]);
      
      // Reload data
      await loadEmployees();
      await loadSchedules();
    } catch (error) {
      console.error('Error bulk deleting employees:', error);
      alert('មានបញ្ហាក្នុងការលុបបុគ្គលិក: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Handle select all
  const handleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map(emp => emp._id));
    }
  };
  
  // Handle individual selection
  const handleSelectEmployee = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  // Calculate statistics
  const stats = {
    totalEmployees: employees.length,
    totalSchedules: schedules.length,
    totalWorkDays: schedules.filter(s => s.shiftTitle !== 'Day Off').length,
    totalDayOffs: schedules.filter(s => s.shiftTitle === 'Day Off').length,
    monthDayShift: 0,
    monthNightShift: 0,
    monthShift24Hours: 0
  };

  // Calculate monthly shift statistics
  schedules.forEach(s => {
    if (!s.shiftStart || !s.shiftEnd || s.shiftTitle === 'Day Off') return;

    try {
      const startParts = s.shiftStart.split(':');
      const endParts = s.shiftEnd.split(':');
      const startHour = parseInt(startParts[0]);
      const endHour = parseInt(endParts[0]);

      // Day shift: AM → PM
      if (startHour < 12 && endHour >= 12) {
        stats.monthDayShift++;
      }
      // Night shift: PM → AM
      else if (startHour >= 12 && endHour < 12) {
        stats.monthNightShift++;
      }
      // 24-hour shift: AM → AM (≥20 hours)
      else if (startHour < 12 && endHour < 12) {
        const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
        const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
        let duration = endMinutes - startMinutes;
        if (duration <= 0) duration += 24 * 60;
        
        if (duration >= 20 * 60) {
          stats.monthShift24Hours++;
        } else {
          stats.monthDayShift++;
        }
      }
      // PM to PM shift
      else if (startHour >= 12 && endHour >= 12) {
        stats.monthDayShift++;
      }
    } catch (err) {
      // Skip invalid time format
    }
  });

  // Calculate daily statistics based on filtered employees (department selection)
  const dailyStats = {
    totalEmployees: filteredEmployees.length,
    workingToday: schedules.filter(s => {
      if (!s.date || !s.shiftStart || !s.shiftEnd) return false;
      const schedDate = new Date(s.date).toISOString().slice(0, 10);
      if (schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
      
      // Check if this schedule belongs to a filtered employee
      const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
      const employee = filteredEmployees.find(emp => emp._id === scheduleEmployeeId);
      
      return !!employee;
    }).length,
    dayOffToday: schedules.filter(s => {
      if (!s.date) return false;
      const schedDate = new Date(s.date).toISOString().slice(0, 10);
      if (schedDate !== selectedDayStats || s.shiftTitle !== 'Day Off') return false;
      
      // Check if this schedule belongs to a filtered employee
      const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
      const employee = filteredEmployees.find(emp => emp._id === scheduleEmployeeId);
      return !!employee;
    }).length,
    dayShift: 0,      // AM → PM (វេនថ្ងៃ)
    nightShift: 0,    // PM → AM (វេនល្ងាច)
    shift24Hours: 0,  // AM → AM (វេន 24 ម៉ោង)
    noSchedule: 0
  };

  // Calculate day shift, night shift and 24-hour shift
  schedules.forEach(s => {
    if (!s.date || !s.shiftStart || !s.shiftEnd) return;
    const schedDate = new Date(s.date).toISOString().slice(0, 10);
    if (schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return;

    // Check if this schedule belongs to a filtered employee
    const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
    const employee = filteredEmployees.find(emp => emp._id === scheduleEmployeeId);
    if (!employee) return;

    try {
      const startParts = s.shiftStart.split(':');
      const endParts = s.shiftEnd.split(':');
      const startHour = parseInt(startParts[0]);
      const endHour = parseInt(endParts[0]);

      // Day shift: starts AM (0-11) and ends PM (12-23)
      if (startHour < 12 && endHour >= 12) {
        dailyStats.dayShift++;
      }
      // Night shift: starts PM (12-23) and ends AM (0-11)
      else if (startHour >= 12 && endHour < 12) {
        dailyStats.nightShift++;
      }
      // 24-hour shift: starts AM and ends AM next day (span >= 20 hours)
      else if (startHour < 12 && endHour < 12) {
        // Calculate duration
        const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
        const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
        let duration = endMinutes - startMinutes;
        if (duration <= 0) duration += 24 * 60; // Next day
        
        // If duration >= 20 hours, consider it 24-hour shift
        if (duration >= 20 * 60) {
          dailyStats.shift24Hours++;
        } else {
          // Short AM-AM shift (not 24h), count as day shift
          dailyStats.dayShift++;
        }
      }
      // PM to PM shift (rare case) - count as day shift
      else if (startHour >= 12 && endHour >= 12) {
        dailyStats.dayShift++;
      }
      // Any other pattern - count as day shift by default
      else {
        dailyStats.dayShift++;
      }
    } catch (err) {
      // Skip invalid time format
    }
  });

  dailyStats.noSchedule = dailyStats.totalEmployees - dailyStats.workingToday - dailyStats.dayOffToday;

  // Function to test basic PDF generation
  const testBasicPDF = () => {
    try {
      console.log('🔧 Testing basic PDF generation...');
      const doc = new jsPDF();
      doc.text('Test PDF', 20, 20);
      doc.save('test.pdf');
      console.log('✅ Basic PDF test successful');
    } catch (error) {
      console.error('❌ Basic PDF test failed:', error);
    }
  };

  // Function to convert Khmer text to English equivalent
  const convertToEnglishEquivalent = (khmerText) => {
    const translations = {
      'បុគ្គលិកសរុប': 'Total Employees',
      'ធ្វើការសរុប': 'Working Today', 
      'ចូលពេលព្រឹក': 'Day Shift',
      'វេនល្ងាច': 'Night Shift',
      'វេន24ម៉ោង': '24-Hour Shift',
      'ឈប់សម្រាក': 'Day Off',
      'មិនបានកំណត់ម៉ោង': 'No Schedule',
      'ឈប់សម្រាកថ្ងៃនេះ': 'Day Off Today',
      'មិនបានកំណត់': 'Not Specified',
      'មិនបានកំណត់ឈ្មោះ': 'Name Not Set',
      'មិនមាន': 'N/A',
      'កំពុងធ្វើការ': 'Working',
      'មិនបានកំណត់តារាងការងារ': 'No Schedule Set'
    };
    
    // Return English equivalent or fallback to original
    return translations[khmerText] || khmerText;
  };

  // Function to clean text for PDF (remove special chars and convert Khmer)
  const cleanTextForPDF = (text) => {
    if (!text) return 'N/A';
    
    // Convert common Khmer phrases to English
    let cleaned = convertToEnglishEquivalent(text.toString());
    
    // If still contains Khmer characters, use a fallback approach
    if (/[\u1780-\u17FF]/.test(cleaned)) {
      // Extract numbers and English parts only
      const englishParts = cleaned.match(/[a-zA-Z0-9\s\-\.\(\)]+/g) || [];
      const numbers = cleaned.match(/\d+/g) || [];
      
      if (englishParts.length > 0) {
        cleaned = englishParts.join(' ').trim();
      } else if (numbers.length > 0) {
        cleaned = `Dept ${numbers[0]}` || 'Department';
      } else {
        cleaned = 'Khmer Text';
      }
    }
    
    return cleaned.trim() || 'N/A';
  };

  // Function to export stats to PDF
  const exportStatsToPDF = async () => {
    setIsExportingPDF(true);
    try {
      console.log('🔄 Starting PDF export...', {
        title: statsModalData.title,
        employeeCount: statsModalData.employees.length
      });
      
      const doc = new jsPDF();
      
      // Add title (convert to English)
      doc.setFontSize(16);
      const title = cleanTextForPDF(statsModalData.title) || 'Employee Report';
      doc.text(title, 20, 20);
      
      // Add date info
      doc.setFontSize(12);
      const dateFormatted = new Date(selectedDayStats).toLocaleDateString('en-US');
      doc.text(`Date: ${dateFormatted}`, 20, 30);
      doc.text(`Total Count: ${statsModalData.employees.length} employees`, 20, 40);
      
      // Check if we have employees data
      if (statsModalData.employees.length === 0) {
        doc.text('No employees found for this category.', 20, 60);
      } else {
        // Prepare table data with cleaned text - format matching the image
        const tableData = statsModalData.employees.map((emp, index) => [
          (index + 1).toString(), // លេខ (Number)
          cleanTextForPDF(emp.staffId || emp.cardNumber || 'N/A'), // កូដ (Code)
          cleanTextForPDF(emp.khmerName || emp.name), // ឈ្មោះ (Name)
          cleanTextForPDF(getEmployeeDepartment(emp)), // ដេប៉ាតមែន (Department)
          cleanTextForPDF(emp.position || emp.status || 'N/A'), // ឋានានុក្រម (Position)
          cleanTextForPDF(emp.phoneNumber || 'N/A') // លេខទូរស័ព្ទ (Phone)
        ]);
        
        console.log('📊 Table data prepared:', tableData.length, 'rows');
        
        // Add table using autoTable - format matching the image structure
        if (typeof doc.autoTable === 'function') {
          doc.autoTable({
            startY: 50,
            head: [['លេខ', 'កូដ', 'ឈ្មោះ', 'ដេប៉ាតមែន', 'ឋានានុក្រម', 'លេខទូរស័ព្ទ']],
            body: tableData,
            styles: {
              font: 'helvetica',
              fontSize: 9,
              cellPadding: 4,
              lineWidth: 0.5,
              lineColor: [0, 0, 0],
              halign: 'left',
              valign: 'middle'
            },
            headStyles: {
              fillColor: [220, 220, 220], // Light gray background like in image
              textColor: [0, 0, 0], // Black text
              fontStyle: 'bold',
              halign: 'center',
              valign: 'middle'
            },
            bodyStyles: {
              fillColor: [255, 255, 255], // White background
              textColor: [0, 0, 0] // Black text
            },
            alternateRowStyles: {
              fillColor: [250, 250, 250] // Very light gray for alternate rows
            },
            margin: { top: 50 },
            columnStyles: {
              0: { cellWidth: 20, halign: 'center' }, // លេខ - centered
              1: { cellWidth: 25, halign: 'center' }, // កូដ - centered  
              2: { cellWidth: 45, halign: 'left' },   // ឈ្មោះ - left aligned
              3: { cellWidth: 45, halign: 'left' },   // ផ្នែក - left aligned
              4: { cellWidth: 40, halign: 'left' },   // ឋានានុក្រម - left aligned
              5: { cellWidth: 35, halign: 'center' }  // លេខទូរស័ព្ទ - centered
            },
            theme: 'grid' // Grid theme to match table borders in image
          });
        } else {
          // Fallback: simple text if autoTable not working
          let yPos = 60;
          doc.text('Employee List:', 20, yPos);
          statsModalData.employees.forEach((emp, index) => {
            yPos += 10;
            const name = cleanTextForPDF(emp.khmerName || emp.name);
            const id = cleanTextForPDF(emp.staffId || emp.cardNumber);
            const line = `${index + 1}. ${name} - ${id}`;
            doc.text(line, 20, yPos);
          });
        }
      }
      
      // Save PDF
      const cleanTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      const fileName = `${cleanTitle}_${selectedDayStats}.pdf`;
      
      console.log('💾 Saving PDF:', fileName);
      doc.save(fileName);
      
      console.log('✅ PDF exported successfully');
      alert('PDF បានបង្កើតជោគជ័យ!');
    } catch (error) {
      console.error('❌ Error exporting PDF:', error);
      alert(`មានបញ្ហាក្នុងការ export PDF: ${error.message}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Print stats function
  const handlePrintStats = () => {
    if (statsModalData.employees.length === 0) return;
    
    // Sort employees by HR employee number (ល.រ) for matching HR database order
    const sortedEmployees = [...statsModalData.employees].sort((a, b) => {
      // Find HR record by staffId to get 'no' field
      const hrA = hrData.find(hr => hr.staffId === (a.staffId || a.cardNumber));
      const hrB = hrData.find(hr => hr.staffId === (b.staffId || b.cardNumber));
      
      // Sort by 'no' field from HR database which represents HR sequence (1, 2, 3, 4...)
      const numA = parseInt(hrA?.no || a.no || a.employeeNumber) || 999999;
      const numB = parseInt(hrB?.no || b.no || b.employeeNumber) || 999999;
      
      return numA - numB;
    });
    
    // Format current date in Khmer
    const currentDate = new Date();
    const monthsKh = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    const day = toKhmerNumerals(currentDate.getDate().toString().padStart(2, '0'));
    const month = monthsKh[currentDate.getMonth()];
    const year = toKhmerNumerals(currentDate.getFullYear());
    const currentKhmerDate = `ថ្ងៃទី${day} ខែ${month} ឆ្នាំ${year}`;
    
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${statsModalData.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 10px; font-size: 12px; }
            h1 { text-align: center; font-size: 18px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px 6px; text-align: left; line-height: 1.2; }
            th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
            .text-center { text-align: center; }
            .summary { margin-top: 20px; font-weight: bold; }
            @media print {
              body { margin: 10px; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 1px; ">
            <h2 style="margin: 1px 0; font-size: 14px; font-family: 'Khmer OS Muol Light';font-weight: normal">ព្រះរាជាណាចក្រកម្ពុជា</h2>
            <h3 style="margin: 1px 0; font-size: 12px; font-family: 'Khmer OS Muol Light';font-weight: normal">ជាតិ សាសនា ព្រះមហាក្សត្រ</h3>
    
            <div style="margin: 1px 0; border-bottom: 1px solid #000; width: 150px; margin: 1px auto;font-weight: normal"></div>
          </div>

          <h1 style="font-size: 14px; font-family: '!Khmer OS Siemreap';font-weight: bold">របាយការណ៍ ${statsModalData.title} ${currentKhmerDate}</h1>

          <table>
            <thead>
              <tr>
                <th>ល.រ</th>
                <th>លេខកាត</th>
                <th>ឈ្មោះបុគ្គលិក</th>
                <th>តួនាទី</th>
                <th>ផ្នែក</th>
                <th>ផ្សេងៗ</th>
              </tr>
            </thead>
            <tbody>
              ${sortedEmployees.map((emp, index) => `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td class="text-center">${emp.staffId || emp.cardNumber || '-'}</td>
                  <td>${emp.khmerName || emp.name || '-'}</td>
                  <td>${emp.position || emp.status || '-'}</td>
                  <td>${getEmployeeDepartment(emp)}</td>
                  <td></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            សរុប: ${sortedEmployees.length} នាក់
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // Function to export stats to Excel
  const exportStatsToExcel = async () => {
    setIsExportingPDF(true); // Reuse the same loading state
    try {
      console.log('🔄 Starting Excel export...', {
        title: statsModalData.title,
        employeeCount: statsModalData.employees.length
      });

      // Prepare data for Excel
      const worksheetData = [];
      
      // Sort employees by HR employee number (ល.រ) for matching HR database order
      const sortedEmployees = [...statsModalData.employees].sort((a, b) => {
        // Find HR record by staffId to get 'no' field
        const hrA = hrData.find(hr => hr.staffId === (a.staffId || a.cardNumber));
        const hrB = hrData.find(hr => hr.staffId === (b.staffId || b.cardNumber));
        
        // Sort by 'no' field from HR database which represents HR sequence (1, 2, 3, 4...)
        const numA = parseInt(hrA?.no || a.no || a.employeeNumber) || 999999;
        const numB = parseInt(hrB?.no || b.no || b.employeeNumber) || 999999;
        
        return numA - numB;
      });
      
      // Add header row
      worksheetData.push([
        'ល.រ',
        'លេខកាត',
        'ឈ្មោះបុគ្គលិក',
        'តួនាទី',
        'ផ្នែក',
        'ផ្សេងៗ'
      ]);

      // Add employee data
      sortedEmployees.forEach((emp, index) => {
        worksheetData.push([
          index + 1,
          emp.staffId || emp.cardNumber || '-',
          emp.khmerName || emp.name || '-',
          emp.position || emp.status || '-',
          getEmployeeDepartment(emp) || 'មិនបានកំណត់',
          '' // Empty column for "ផ្សេងៗ"
        ]);
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths
      ws['!cols'] = [
        { width: 8 },  // ល.រ
        { width: 12 }, // លេខកាត
        { width: 25 }, // ឈ្មោះបុគ្គលិក
        { width: 20 }, // តួនាទី
        { width: 20 }, // ផ្នែក
        { width: 20 }  // ផ្សេងៗ
      ];

      // Style header row
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "3F51B5" } },
        alignment: { horizontal: "center", vertical: "center" }
      };

      // Apply header style
      for (let col = 0; col < 6; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellRef]) ws[cellRef] = {};
        ws[cellRef].s = headerStyle;
      }

      // Add worksheet to workbook
      const sheetName = cleanTextForPDF(statsModalData.title) || 'Employee Report';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Generate file name
      const dateFormatted = selectedDayStats.replace(/-/g, '');
      const fileName = `${sheetName.replace(/\s+/g, '_')}_${dateFormatted}.xlsx`;

      // Save file
      console.log('💾 Saving Excel:', fileName);
      XLSX.writeFile(wb, fileName);

      console.log('✅ Excel exported successfully');
      alert('Excel បានបង្កើតជោគជ័យ!');
    } catch (error) {
      console.error('❌ Error exporting Excel:', error);
      alert(`មានបញ្ហាក្នុងការ export Excel: ${error.message}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Comprehensive Summary Report
  const handleComprehensiveSummaryReport = () => {
    // Export summary and detailed employee lists to Excel
    const exportSummaryExcel = () => {
      const XLSX = window.XLSX || require('xlsx');
      const wb = XLSX.utils.book_new();

      // 1. Summary Table
      const summarySheet = [];
      summarySheet.push(['ប្រភេទបុគ្គលិក', 'ចំនួន (នាក់)', 'ភាគរយ (%)', 'កំណត់សម្គាល់']);
      summarySheet.push(['បុគ្គលិកសរុប', totalEmployees, '100.0%', 'ចំនួនបុគ្គលិកសរុបក្នុងបញ្ជី']);
      summarySheet.push(['ធ្វើការសរុប', workingToday, workingPercent + '%', 'បុគ្គលិកដែលធ្វើការនៅថ្ងៃនេះ']);
      summarySheet.push(['ចូលពេលព្រឹក', dayShift, dayShiftPercent + '%', 'ធ្វើការពេលព្រឹក']);
      summarySheet.push(['វេនល្ងាច', nightShift, nightShiftPercent + '%', 'ធ្វើការវេនល្ងាច']);
      summarySheet.push(['វេន២៤ម៉ោង', shift24Hours, shift24Percent + '%', 'ធ្វើការវេន២៤ម៉ោង']);
      summarySheet.push(['ឈប់សម្រាក', dayOffToday, dayOffPercent + '%', 'បុគ្គលិកឈប់សម្រាក (Day Off)']);
      summarySheet.push(['មិនបានកំណត់ម៉ោង', noSchedule, noSchedulePercent + '%', 'មិនមានកាលវិភាគការងារ']);
      const wsSummary = XLSX.utils.aoa_to_sheet(summarySheet);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // 2. Detailed Employee Lists (by category, sorted by ascending count)
      const categories = [
        {
          key: 'morning',
          title: 'ចូលពេលព្រឹក',
          filterFn: (emp) => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
              if (!s.shiftStart || !s.shiftEnd) return false;
              try {
                const startParts = s.shiftStart.split(':');
                const endParts = s.shiftEnd.split(':');
                const startHour = parseInt(startParts[0]);
                const endHour = parseInt(endParts[0]);
                if (startHour < 12 && endHour >= 12) return true;
                if (startHour < 12 && endHour < 12) {
                  const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
                  const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
                  let duration = endMinutes - startMinutes;
                  if (duration <= 0) duration += 24 * 60;
                  return duration < 20 * 60;
                }
                if (startHour >= 12 && endHour >= 12) return true;
                return false;
              } catch (err) {
                return false;
              }
            });
            return schedule !== undefined;
          }
        },
        {
          key: 'night',
          title: 'វេនល្ងាច',
          filterFn: (emp) => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
              if (!s.shiftStart || !s.shiftEnd) return false;
              const startHour = parseInt(s.shiftStart.split(':')[0]);
              const endHour = parseInt(s.shiftEnd.split(':')[0]);
              return startHour >= 12 && endHour < 12;
            });
            return schedule !== undefined;
          }
        },
        {
          key: '24hour',
          title: 'វេន២៤ម៉ោង',
          filterFn: (emp) => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
              if (!s.shiftStart || !s.shiftEnd) return false;
              try {
                const startParts = s.shiftStart.split(':');
                const endParts = s.shiftEnd.split(':');
                const startHour = parseInt(startParts[0]);
                const endHour = parseInt(endParts[0]);
                if (startHour < 12 && endHour < 12) {
                  const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
                  const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
                  let duration = endMinutes - startMinutes;
                  if (duration <= 0) duration += 24 * 60;
                  return duration >= 20 * 60;
                }
                return false;
              } catch (err) {
                return false;
              }
            });
            return schedule !== undefined;
          }
        },
        {
          key: 'dayoff',
          title: 'ឈប់សម្រាក (Day Off)',
          filterFn: (emp) => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              return scheduleEmployeeId === emp._id && schedDate === selectedDayStats && s.shiftTitle === 'Day Off';
            });
            return schedule !== undefined;
          }
        },
        {
          key: 'noschedule',
          title: 'មិនបានកំណត់ម៉ោង',
          filterFn: (emp) => {
            const hasSchedule = schedules.some(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              return scheduleEmployeeId === emp._id && schedDate === selectedDayStats;
            });
            return !hasSchedule;
          }
        }
      ];

      // Build category lists with counts
      const categoryLists = categories.map(cat => {
        const categoryEmployees = filteredEmployees.filter(cat.filterFn);
        return {
          ...cat,
          employees: categoryEmployees
        };
      });
      // Sort categories by ascending employee count
      categoryLists.sort((a, b) => a.employees.length - b.employees.length);

      // Add each category as a sheet
      categoryLists.forEach(cat => {
        // Sort employees by HR 'no'
        const sortedEmployees = [...cat.employees].sort((a, b) => {
          const hrA = hrData.find(hr => hr.staffId === (a.staffId || a.cardNumber));
          const hrB = hrData.find(hr => hr.staffId === (b.staffId || b.cardNumber));
          const numA = parseInt(hrA?.no || a.no || a.employeeNumber) || 999999;
          const numB = parseInt(hrB?.no || b.no || b.employeeNumber) || 999999;
          return numA - numB;
        });
        if (sortedEmployees.length === 0) return;
        const sheetData = [];
        sheetData.push(['ល.រ', 'លេខកាត', 'ឈ្មោះបុគ្គលិក', 'តួនាទី', 'ផ្នែក']);
        sortedEmployees.forEach((emp, idx) => {
          sheetData.push([
            idx + 1,
            emp.staffId || emp.cardNumber || '-',
            emp.khmerName || emp.name || '-',
            emp.position || emp.status || '-',
            (typeof getEmployeeDepartment === 'function' ? getEmployeeDepartment(emp) : emp.department) || 'មិនបានកំណត់'
          ]);
        });
        const wsCat = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, wsCat, cat.title);
      });

      // Save file
      const dateFormatted = selectedDayStats.replace(/-/g, '');
      const fileName = `Summary_Report_${dateFormatted}.xlsx`;
      XLSX.writeFile(wb, fileName);
    };
    // Helper function to generate detailed employee lists
    const generateDetailedEmployeeLists = () => {
      // Define categories and their filter functions
      const categories = [
        {
          key: 'morning',
          title: 'ចូលពេលព្រឹក',
          filterFn: (emp) => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
              if (!s.shiftStart || !s.shiftEnd) return false;
              try {
                const startParts = s.shiftStart.split(':');
                const endParts = s.shiftEnd.split(':');
                const startHour = parseInt(startParts[0]);
                const endHour = parseInt(endParts[0]);
                if (startHour < 12 && endHour >= 12) return true;
                if (startHour < 12 && endHour < 12) {
                  const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
                  const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
                  let duration = endMinutes - startMinutes;
                  if (duration <= 0) duration += 24 * 60;
                  return duration < 20 * 60;
                }
                if (startHour >= 12 && endHour >= 12) return true;
                return false;
              } catch (err) {
                return false;
              }
            });
            return schedule !== undefined;
          }
        },
        {
          key: 'night',
          title: 'វេនល្ងាច',
          filterFn: (emp) => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
              if (!s.shiftStart || !s.shiftEnd) return false;
              const startHour = parseInt(s.shiftStart.split(':')[0]);
              const endHour = parseInt(s.shiftEnd.split(':')[0]);
              return startHour >= 12 && endHour < 12;
            });
            return schedule !== undefined;
          }
        },
        {
          key: '24hour',
          title: 'វេន២៤ម៉ោង',
          filterFn: (emp) => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
              if (!s.shiftStart || !s.shiftEnd) return false;
              try {
                const startParts = s.shiftStart.split(':');
                const endParts = s.shiftEnd.split(':');
                const startHour = parseInt(startParts[0]);
                const endHour = parseInt(endParts[0]);
                if (startHour < 12 && endHour < 12) {
                  const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
                  const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
                  let duration = endMinutes - startMinutes;
                  if (duration <= 0) duration += 24 * 60;
                  return duration >= 20 * 60;
                }
                return false;
              } catch (err) {
                return false;
              }
            });
            return schedule !== undefined;
          }
        },
        {
          key: 'dayoff',
          title: 'ឈប់សម្រាក (Day Off)',
          filterFn: (emp) => {
            const schedule = schedules.find(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              return scheduleEmployeeId === emp._id && schedDate === selectedDayStats && s.shiftTitle === 'Day Off';
            });
            return schedule !== undefined;
          }
        },
        {
          key: 'noschedule',
          title: 'មិនបានកំណត់ម៉ោង',
          filterFn: (emp) => {
            const hasSchedule = schedules.some(s => {
              const schedDate = new Date(s.date).toISOString().slice(0, 10);
              const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
              return scheduleEmployeeId === emp._id && schedDate === selectedDayStats;
            });
            return !hasSchedule;
          }
        }
      ];

      // Build category lists with counts
      const categoryLists = categories.map(cat => {
        const categoryEmployees = filteredEmployees.filter(cat.filterFn);
        return {
          ...cat,
          employees: categoryEmployees
        };
      });

      // Sort categories by ascending employee count
      categoryLists.sort((a, b) => a.employees.length - b.employees.length);

      // Render HTML for each category
      let detailsHTML = '<div style="margin-top: 30px; page-break-before: always;">';
      detailsHTML += '<h1 style="text-align: center; font-size: 16px; margin-bottom: 20px;">បញ្ជីលម្អិតឈ្មោះបុគ្គលិក</h1>';
      categoryLists.forEach(cat => {
        // Sort employees by HR 'no'
        const sortedEmployees = [...cat.employees].sort((a, b) => {
          const hrA = hrData.find(hr => hr.staffId === (a.staffId || a.cardNumber));
          const hrB = hrData.find(hr => hr.staffId === (b.staffId || b.cardNumber));
          const numA = parseInt(hrA?.no || a.no || a.employeeNumber) || 999999;
          const numB = parseInt(hrB?.no || b.no || b.employeeNumber) || 999999;
          return numA - numB;
        });
        if (sortedEmployees.length === 0) return;
        detailsHTML += `
          <div style="page-break-inside: avoid; margin-top: 12px;">
            <h2 style="font-size: 14px; background-color: #f5f5f5; padding: 6px 8px; border-left: 4px solid #2196F3; margin-bottom: 6px;">
              ${cat.title} (${sortedEmployees.length} នាក់)
            </h2>
            <table style="font-size: 11px; border-spacing: 0;">
              <thead>
                <tr>
                  <th style="width: 10px; padding-top:2px; padding-bottom:2px;">ល.រ</th>
                  <th style="width: 20px; padding-top:2px; padding-bottom:2px;">លេខកាត</th>
                  <th style="width: 90px; padding-top:2px; padding-bottom:2px;">ឈ្មោះបុគ្គលិក</th>
                  <th style="width: 90px; padding-top:2px; padding-bottom:2px;">តួនាទី</th>
                  <th style="width: 120px; padding-top:2px; padding-bottom:2px;">ផ្នែក</th>
                </tr>
              </thead>
              <tbody>
                ${sortedEmployees.map((emp, index) => `
                  <tr>
                    <td class="text-center" style="padding-top:2px; padding-bottom:2px;">${index + 1}</td>
                    <td class="text-center" style="padding-top:2px; padding-bottom:2px;">${emp.staffId || emp.cardNumber || '-'}</td>
                    <td style="padding-top:1px; padding-bottom:1px;">${emp.khmerName || emp.name || '-'}</td>
                    <td style="padding-top:1px; padding-bottom:1px;">${emp.position || emp.status || '-'}</td>
                    <td style="padding-top:1px; padding-bottom:1px;">${getEmployeeDepartment(emp) || 'មិនបានកំណត់'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      });
      detailsHTML += '</div>';
      return detailsHTML;
    };
    
    // Calculate comprehensive statistics
    const totalEmployees = filteredEmployees.length;
    const workingToday = dailyStats.workingToday;
    const dayShift = dailyStats.dayShift;
    const nightShift = dailyStats.nightShift;
    const shift24Hours = dailyStats.shift24Hours;
    const dayOffToday = dailyStats.dayOffToday;
    const noSchedule = dailyStats.noSchedule;
    
    // Calculate percentages
    const workingPercent = totalEmployees > 0 ? ((workingToday / totalEmployees) * 100).toFixed(1) : '0.0';
    const dayShiftPercent = totalEmployees > 0 ? ((dayShift / totalEmployees) * 100).toFixed(1) : '0.0';
    const nightShiftPercent = totalEmployees > 0 ? ((nightShift / totalEmployees) * 100).toFixed(1) : '0.0';
    const shift24Percent = totalEmployees > 0 ? ((shift24Hours / totalEmployees) * 100).toFixed(1) : '0.0';
    const dayOffPercent = totalEmployees > 0 ? ((dayOffToday / totalEmployees) * 100).toFixed(1) : '0.0';
    const noSchedulePercent = totalEmployees > 0 ? ((noSchedule / totalEmployees) * 100).toFixed(1) : '0.0';

    // Format date in Khmer with Khmer numerals
    const dateObj = new Date(selectedDayStats);
    const monthsKh = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    const day = toKhmerNumerals(dateObj.getDate().toString().padStart(2, '0'));
    const month = monthsKh[dateObj.getMonth()];
    const year = toKhmerNumerals(dateObj.getFullYear());
    const khmerDate = `ថ្ងៃទី${day} ខែ${month} ឆ្នាំ${year}`;

    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>របាយការណ៍សរុប</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            h1 { text-align: center; font-size: 18px; margin-bottom: 20px; }
            h2 { font-size: 16px; margin: 20px 0 10px 0; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .summary-box { border: 2px solid #333; padding: 15px; margin: 20px 0; }
            .category-title { font-weight: bold; font-size: 14px; margin: 15px 0 5px 0; }
            @media print {
              body { margin: 10px; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 1px; ">
            <h2 style="margin: 1px 0; font-size: 14px; font-family: 'Khmer OS Muol Light';font-weight: normal">ព្រះរាជាណាចក្រកម្ពុជា</h2>
            <h3 style="margin: 1px 0; font-size: 12px; font-family: 'Khmer OS Muol Light';font-weight: normal">ជាតិ សាសនា ព្រះមហាក្សត្រ</h3>
            
            <div style="margin: 10px 0; border-bottom: 1px solid #000; width: 150px; margin: 1px auto;font-weight: normal"></div>
          </div>

          <h1 style="font-size: 12px; font-family: '!Khmer OS Siemreap';font-weight: bold">របាយការណ៍សរុបសម្រាប់ ${khmerDate}</h1>
          </div>
            <table>
              <thead>
                <tr>
                  <th>ប្រភេទបុគ្គលិក</th>
                  <th>ចំនួន (នាក់)</th>
                  <th>ភាគរយ (%)</th>
                  <th>កំណត់សម្គាល់</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background-color: #e3f2fd;">
                  <td><strong>បុគ្គលិកសរុប</strong></td>
                  <td class="text-center"><strong>${totalEmployees}</strong></td>
                  <td class="text-center"><strong>100.0%</strong></td>
                  <td>ចំនួនបុគ្គលិកសរុបក្នុងបញ្ជី</td>
                </tr>
                <tr>
                  <td>ធ្វើការសរុប</td>
                  <td class="text-center">${workingToday}</td>
                  <td class="text-center">${workingPercent}%</td>
                  <td>បុគ្គលិកដែលធ្វើការនៅថ្ងៃនេះ</td>
                </tr>
                <tr>
                  <td>&nbsp;&nbsp;- ចូលពេលព្រឹក</td>
                  <td class="text-center">${dayShift}</td>
                  <td class="text-center">${dayShiftPercent}%</td>
                  <td>ធ្វើការពេលព្រឹក</td>
                </tr>
                <tr>
                  <td>&nbsp;&nbsp;- វេនល្ងាច</td>
                  <td class="text-center">${nightShift}</td>
                  <td class="text-center">${nightShiftPercent}%</td>
                  <td>ធ្វើការវេនល្ងាច</td>
                </tr>
                <tr>
                  <td>&nbsp;&nbsp;- វេន២៤ម៉ោង</td>
                  <td class="text-center">${shift24Hours}</td>
                  <td class="text-center">${shift24Percent}%</td>
                  <td>ធ្វើការវេន២៤ម៉ោង</td>
                </tr>
                <tr style="background-color: #fff3e0;">
                  <td>ឈប់សម្រាក</td>
                  <td class="text-center">${dayOffToday}</td>
                  <td class="text-center">${dayOffPercent}%</td>
                  <td>បុគ្គលិកឈប់សម្រាក (Day Off)</td>
                </tr>
                <tr style="background-color: #fce4ec;">
                  <td>មិនបានកំណត់ម៉ោង</td>
                  <td class="text-center">${noSchedule}</td>
                  <td class="text-center">${noSchedulePercent}%</td>
                  <td>មិនមានកាលវិភាគការងារ</td>
                </tr>
              </tbody>
            </table>
          </div>

          ${generateDetailedEmployeeLists()}

          <div style="margin-top: 30px;">
            <div style="float: left;">
              <p><strong>កាលបរិច្ឆេទបង្កើត:</strong> ${new Date().toLocaleDateString('km-KH')}</p>
            </div>
            <div style="float: right; text-align: center;">
              <p><strong>ហត្ថលេខាអ្នកបង្កើត</strong></p>
              <div style="height: 50px;"></div>
              <p>_____________________</p>
            </div>
            <div style="clear: both;"></div>
            <div style="margin-top: 20px; text-align: center;">
              <!-- Removed Export Summary Excel and Print buttons from print view -->
            </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // Function to show stats detail modal
  const showStatsDetail = (type) => {
    let title = '';
    let employees = [];
    
    switch(type) {
      case 'totalEmployees':
        title = 'បុគ្គលិកសរុប';
        employees = filteredEmployees.map(emp => ({
          ...emp,
          status: 'មានក្នុងបញ្ជី',
          statusColor: 'text-blue-900'
        }));
        break;
        
      case 'workingToday':
        title = 'ធ្វើការថ្ងៃនេះ';
        employees = filteredEmployees.filter(emp => {
          const schedule = schedules.find(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            return scheduleEmployeeId === emp._id && 
                   schedDate === selectedDayStats && 
                   s.shiftTitle !== 'Day Off';
          });
          return schedule;
        }).map(emp => {
          const schedule = schedules.find(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            return scheduleEmployeeId === emp._id && 
                   schedDate === selectedDayStats && 
                   s.shiftTitle !== 'Day Off';
          });
          return {
            ...emp,
            status: schedule ? `${schedule.shiftStart} - ${schedule.shiftEnd}` : 'កំពុងធ្វើការ',
            statusColor: 'text-green-600'
          };
        });
        break;
        
      case 'dayShift':
        title = 'ចូលពេលព្រឹក';
        employees = filteredEmployees.filter(emp => {
          const schedule = schedules.find(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
            
            if (!s.shiftStart || !s.shiftEnd) return false;
            
            try {
              const startParts = s.shiftStart.split(':');
              const endParts = s.shiftEnd.split(':');
              const startHour = parseInt(startParts[0]);
              const endHour = parseInt(endParts[0]);
              
              // Day shift: starts AM (0-11) and ends PM (12-23)
              if (startHour < 12 && endHour >= 12) {
                return true;
              }
              // 24-hour shift: starts AM and ends AM next day (span >= 20 hours) - NOT day shift
              else if (startHour < 12 && endHour < 12) {
                const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
                const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
                let duration = endMinutes - startMinutes;
                if (duration <= 0) duration += 24 * 60;
                
                // If duration >= 20 hours, it's 24-hour shift, NOT day shift
                if (duration >= 20 * 60) {
                  return false;
                } else {
                  // Short AM-AM shift (not 24h), count as day shift
                  return true;
                }
              }
              // PM to PM shift - count as day shift
              else if (startHour >= 12 && endHour >= 12) {
                return true;
              }
              // Night shift: starts PM (12-23) and ends AM (0-11) - NOT day shift
              else if (startHour >= 12 && endHour < 12) {
                return false;
              }
              
              return false;
            } catch (err) {
              return false;
            }
          });
          return schedule;
        }).map(emp => {
          const schedule = schedules.find(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            return scheduleEmployeeId === emp._id && schedDate === selectedDayStats;
          });
          return {
            ...emp,
            status: schedule ? `${schedule.shiftStart} - ${schedule.shiftEnd}` : 'ចូលពេលព្រឹក',
            statusColor: 'text-teal-600'
          };
        });
        break;
        
      case 'nightShift':
        title = 'វេនល្ងាច';
        employees = filteredEmployees.filter(emp => {
          const schedule = schedules.find(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
            
            if (!s.shiftStart || !s.shiftEnd) return false;
            const startHour = parseInt(s.shiftStart.split(':')[0]);
            const endHour = parseInt(s.shiftEnd.split(':')[0]);
            
            // Night shift: starts PM (12-23) and ends AM (0-11)
            return startHour >= 12 && endHour < 12;
          });
          return schedule;
        }).map(emp => {
          const schedule = schedules.find(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            return scheduleEmployeeId === emp._id && schedDate === selectedDayStats;
          });
          return {
            ...emp,
            status: schedule ? `${schedule.shiftStart} - ${schedule.shiftEnd}` : 'វេនល្ងាច',
            statusColor: 'text-indigo-600'
          };
        });
        break;
        
      case 'shift24Hours':
        title = 'វេន24ម៉ោង';
        employees = filteredEmployees.filter(emp => {
          const schedule = schedules.find(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            if (scheduleEmployeeId !== emp._id || schedDate !== selectedDayStats || s.shiftTitle === 'Day Off') return false;
            
            if (!s.shiftStart || !s.shiftEnd) return false;
            const startParts = s.shiftStart.split(':');
            const endParts = s.shiftEnd.split(':');
            const startHour = parseInt(startParts[0]);
            const endHour = parseInt(endParts[0]);
            
            if (startHour < 12 && endHour < 12) {
              const startMinutes = startHour * 60 + parseInt(startParts[1] || 0);
              const endMinutes = endHour * 60 + parseInt(endParts[1] || 0);
              let duration = endMinutes - startMinutes;
              if (duration <= 0) duration += 24 * 60;
              return duration >= 20 * 60;
            }
            return false;
          });
          return schedule;
        }).map(emp => {
          const schedule = schedules.find(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            return scheduleEmployeeId === emp._id && schedDate === selectedDayStats;
          });
          return {
            ...emp,
            status: schedule ? `${schedule.shiftStart} - ${schedule.shiftEnd}` : 'វេន24ម៉ោង',
            statusColor: 'text-yellow-600'
          };
        });
        break;
        
      case 'dayOffToday':
        title = 'ឈប់សម្រាកថ្ងៃនេះ';
        employees = filteredEmployees.filter(emp => {
          const schedule = schedules.find(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            return scheduleEmployeeId === emp._id && 
                   schedDate === selectedDayStats && 
                   s.shiftTitle === 'Day Off';
          });
          return schedule;
        }).map(emp => ({
          ...emp,
          status: 'ឈប់សម្រាក',
          statusColor: 'text-red-600'
        }));
        break;
        
      case 'noSchedule':
        title = 'មិនបានកំណត់ម៉ោង';
        employees = filteredEmployees.filter(emp => {
          const hasSchedule = schedules.some(s => {
            const schedDate = new Date(s.date).toISOString().slice(0, 10);
            const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
            return scheduleEmployeeId === emp._id && schedDate === selectedDayStats;
          });
          return !hasSchedule;
        }).map(emp => ({
          ...emp,
          status: 'មិនបានកំណត់តារាងការងារ',
          statusColor: 'text-gray-600'
        }));
        break;
        
      default:
        return;
    }
    
    setStatsModalData({ title, employees, type });
    setShowStatsModal(true);
  };

  // Load schedules for the month
  const loadSchedules = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      
      // Use new work schedules API
      const { data } = await api.get('/work-schedules', {
        params: { year, month }
      });
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  // Load employees
  const loadEmployees = async () => {
    try {
      console.log('🔄 Loading employees...');
      console.log('🔑 Auth token:', localStorage.getItem('auth') ? 'Present' : 'Missing');
      
      // Try work-schedule-employees first, fallback to regular employees
      let employeeList = [];
      
      try {
        console.log('📡 Trying work-schedule-employees API...');
        const { data: workScheduleEmployees } = await api.get('/work-schedule-employees', {
          params: { 
            limit: 10000,
            page: 1 
          }
        });
        console.log('✅ Work schedule employees loaded:', workScheduleEmployees.length || 0);
        employeeList = Array.isArray(workScheduleEmployees) ? workScheduleEmployees : [];
      } catch (error) {
        console.log('❌ Work schedule employees API failed:', error.message);
        console.log('📡 Trying regular employees API...');
        
        try {
          const { data: regularEmployees } = await api.get('/employees');
          console.log('✅ Regular employees loaded:', regularEmployees.length || 0);
          employeeList = Array.isArray(regularEmployees) ? regularEmployees : [];
        } catch (employeeError) {
          console.error('❌ Both employee APIs failed:', employeeError.message);
        }
      }
      
      setEmployees(employeeList);
      
      // Also load HR data and department data for department information
      await loadHRData();
      await loadDepartments();
    } catch (error) {
      console.error('Error loading employees:', error);
      setEmployees([]);
    }
  };

  // Load HR data
  const loadHRData = async () => {
    try {
      const { data } = await api.get('/hr', {
        params: { 
          limit: 10000,
          page: 1 
        }
      });
      console.log('Loaded HR data:', data);
      console.log('HR data length:', data?.length || 0);
      
      const hrList = Array.isArray(data) ? data : [];
      console.log('HR departments found:', hrList.map(hr => hr.Department_Kh).filter(Boolean));
      setHrData(hrList);
    } catch (error) {
      console.error('Error loading HR data:', error);
      console.log('Falling back to employee position data');
      setHrData([]);
    }
  };

  // Load departments from Department table
  const loadDepartments = async () => {
    try {
      const { data } = await api.get('/departments');
      console.log('Loaded departments:', data);
      const deptList = Array.isArray(data) ? data : [];
      setDepartmentData(deptList);
    } catch (error) {
      console.error('Error loading departments:', error);
      setDepartmentData([]);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [selectedMonth]);

  useEffect(() => {
    loadEmployees();
  }, []);

  // Get schedule for employee on specific day
  const getScheduleForDay = (employeeId, day) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    return schedules.find(s => {
      const scheduleEmployeeId = s.employeeId?._id || s.employeeId;
      return scheduleEmployeeId === employeeId && 
             s.date && 
             new Date(s.date).toISOString().slice(0, 10) === dateStr;
    });
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/work-schedules', {
        employeeId: formData.employeeId,
        date: formData.date,
        shiftTitle: 'Work',
        shiftStart: formData.startTime,
        shiftEnd: formData.endTime,
        shiftColor: '#0b74de',
        notes: formData.notes
      });
      setShowAddModal(false);
      setFormData({
        employeeId: '',
        date: new Date().toISOString().slice(0, 10),
        startTime: '08:00',
        endTime: '17:00',
        status: 'scheduled',
        notes: ''
      });
      await loadSchedules();
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert('មានបញ្ហាក្នុងការរក្សាទុក');
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!confirm('តើអ្នកពិតជាចង់លុបមែនទេ?')) return;
    try {
      await api.delete(`/schedule-overrides/${id}`);
      await loadSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('មានបញ្ហាក្នុងការលុប');
    }
  };

  // Handle Excel file import
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Parse the data
        const parsedData = parseExcelData(data);
        setImportData(parsedData);
        setShowImportModal(true);
      } catch (error) {
        console.error('Error reading file:', error);
        alert('មានបញ្ហាក្នុងការអាន Excel file');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Parse Excel data
  const parseExcelData = (data) => {
    if (data.length < 2) return [];

    const headers = data[0];
    const rows = data.slice(1);

    // Find column indices
    const nameCol = headers.findIndex(h => 
      String(h).includes('ឈ្មោះ') || String(h).toLowerCase().includes('name')
    );
    const phoneCol = headers.findIndex(h => 
      String(h).includes('ទូរស័ព្ទ') || String(h).toLowerCase().includes('phone')
    );
    const cardCol = headers.findIndex(h => 
      String(h).includes('លេខកាត') || String(h).toLowerCase().includes('card') || String(h).toLowerCase().includes('id')
    );
    const positionCol = headers.findIndex(h => 
      String(h).includes('តួនាទី') || String(h).toLowerCase().includes('position')
    );
    const seqCol = headers.findIndex(h => 
      String(h).includes('ល.រ') || String(h).toLowerCase().includes('no')
    );

    // Find where day columns start (look for "ទី1" or "01" or number patterns)
    let firstDayCol = 5; // default
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).trim();
      if (header.match(/^ទី?\d+$/) || header.match(/^\d{2}$/)) {
        firstDayCol = i;
        break;
      }
    }

    const parsed = {
      employees: [],
      schedules: []
    };

    rows.forEach((row, index) => {
      if (!row || row.length === 0) return;

      const employeeName = row[nameCol] || '';
      const phone = row[phoneCol] || '';
      const cardNumber = String(row[cardCol] || index + 1).trim(); // Use index if no card
      const position = row[positionCol] || '';

      if (!employeeName) return; // Skip if no name

      // Add employee to be created/updated
      parsed.employees.push({
        staffId: cardNumber,
        khmerName: employeeName,
        phoneNumber: phone,
        position: position
      });

      // Parse schedule for each day
      for (let day = 1; day <= daysInMonth; day++) {
        const colIndex = firstDayCol + day - 1;
        const cellValue = row[colIndex];

        if (!cellValue) continue;

        const cellStr = String(cellValue).trim().toUpperCase();
        
        // Skip empty or dash
        if (!cellStr || cellStr === '-' || cellStr === '') continue;

        let status = 'scheduled';
        let startTime = '08:00';
        let endTime = '17:00';
        let shiftTitle = 'Work';
        
        // Check for "Day Off"
        if (cellStr.includes('DAY OFF') || cellStr === 'DAY OFF') {
          shiftTitle = 'Day Off';
          startTime = '';
          endTime = '';
        } else {
          // Parse time format like "7:30AM-3" or "7:30AM-3:00PM"
          const timeMatch = cellStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?[-:](\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
          if (timeMatch) {
            let startHour = parseInt(timeMatch[1]);
            const startMin = timeMatch[2] || '00';
            const startPeriod = timeMatch[3] || '';
            let endHour = parseInt(timeMatch[4]);
            const endMin = timeMatch[5] || '00';
            const endPeriod = timeMatch[6] || '';

            // Convert to 24-hour format
            if (startPeriod.toUpperCase() === 'PM' && startHour !== 12) startHour += 12;
            if (startPeriod.toUpperCase() === 'AM' && startHour === 12) startHour = 0;
            if (endPeriod.toUpperCase() === 'PM' && endHour !== 12) endHour += 12;
            if (endPeriod.toUpperCase() === 'AM' && endHour === 12) endHour = 0;
            
            // If no period specified for end time, assume PM if less than start hour
            if (!endPeriod && endHour < 12 && endHour < startHour) endHour += 12;

            startTime = `${String(startHour).padStart(2, '0')}:${startMin}`;
            endTime = `${String(endHour).padStart(2, '0')}:${endMin}`;
          }
        }

        const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
        
        parsed.schedules.push({
          staffId: cardNumber, // Will be replaced with employeeId after import
          date: dateStr,
          shiftTitle: shiftTitle,
          shiftStart: startTime,
          shiftEnd: endTime,
          notes: String(cellValue)
        });
      }
    });

    return parsed;
  };

  // Import schedules to database
  const handleImportConfirm = async () => {
    if (!importData.employees || importData.employees.length === 0) {
      alert('មិនមានទិន្នន័យសម្រាប់ import');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Import employees first
      console.log(`Importing ${importData.employees.length} employees...`);
      const empResponse = await api.post('/work-schedule-employees/bulk', { 
        employees: importData.employees 
      });
      const importedEmployees = empResponse.data.results || [];
      console.log(`Imported ${importedEmployees.length} employees`);

      // Step 2: Create mapping from staffId to employeeId
      const staffIdMap = {};
      importedEmployees.forEach(emp => {
        staffIdMap[emp.staffId] = emp._id;
      });

      // Step 3: Prepare schedules with employeeId references
      const schedules = importData.schedules.map(sched => ({
        employeeId: staffIdMap[sched.staffId],
        date: sched.date,
        shiftTitle: sched.shiftTitle || 'Work',
        shiftStart: sched.shiftStart || '',
        shiftEnd: sched.shiftEnd || '',
        shiftColor: sched.shiftTitle === 'Day Off' ? '#ff0000' : '#0b74de',
        notes: sched.notes || ''
      })).filter(sched => sched.employeeId); // Only include schedules with valid employeeId

      // Step 4: Bulk import schedules
      if (schedules.length > 0) {
        console.log(`Importing ${schedules.length} schedules...`);
        const schedResponse = await api.post('/work-schedules/bulk', { schedules });
        const importedSchedules = schedResponse.data.results || [];
        console.log(`Imported ${importedSchedules.length} schedules`);
        
        alert(`Import បានបញ្ចប់!\nបុគ្គលិក: ${importedEmployees.length}\nតារាងការងារ: ${importedSchedules.length}`);
      } else {
        alert(`Import បានបញ្ចប់!\nបុគ្គលិក: ${importedEmployees.length}\nតារាងការងារ: 0`);
      }

      setShowImportModal(false);
      setImportData({ employees: [], schedules: [] });
      await loadEmployees();
      await loadSchedules();
    } catch (error) {
      console.error('Error importing data:', error);
      alert('មានបញ្ហាក្នុងការ import ទិន្នន័យ: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Export to Excel template
  const handleExportTemplate = () => {
    const templateData = [];
    
    // Headers
    const headers = ['ល.រ', 'ទូរស័ព្ទ', 'លេខកាត', 'ឈ្មោះ', 'តួនាទី'];
    for (let day = 1; day <= daysInMonth; day++) {
      headers.push(`ទី${day}`);
    }
    templateData.push(headers);

    // Employee rows
    employees.forEach((emp, index) => {
      const row = [
        index + 1,
        emp.phoneNumber || emp.phone || '',
        emp.staffId || emp.cardNumber || '',
        emp.khmerName || emp.fullName || emp.name || emp.staffName || '',
        emp.position || emp.Position_Kh || ''
      ];
      
      // Add schedule data for each day
      for (let day = 1; day <= daysInMonth; day++) {
        const schedule = getScheduleForDay(emp._id, day);
        if (schedule) {
          if (schedule.shiftTitle === 'Day Off') {
            row.push('Day Off');
          } else {
            const startTime = schedule.shiftStart || schedule.scheduledStart || schedule.startTime || '07:30';
            const endTime = schedule.shiftEnd || schedule.scheduledEnd || schedule.endTime || '15:30';
            
            // Format time for Excel display with AM/PM
            const formattedStart = formatTimeToAMPM(startTime);
            const formattedEnd = formatTimeToAMPM(endTime);
            const cellValue = `${formattedStart}-${formattedEnd}`;
            row.push(cellValue);
          }
        } else {
          row.push('');
        }
      }
      
      templateData.push(row);
    });

    // Create workbook
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Set column widths
    const colWidths = [
      { wch: 5 },  // ល.រ
      { wch: 12 }, // ទូរស័ព្ទ
      { wch: 10 }, // លេខកាត
      { wch: 20 }, // ឈ្មោះ
      { wch: 15 }  // តួនាទី
    ];
    for (let i = 0; i < daysInMonth; i++) {
      colWidths.push({ wch: 15 }); // Day columns
    }
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ប្រតិទិនការងារ');

    // Download
    XLSX.writeFile(wb, `ប្រតិទិនការងារ_${selectedMonth}.xlsx`);
  };



  return (
    <div className="p-3">
      {/* Header */}
      <div className="mb-1" style={{ fontSize: '18px' }}>
        <h1 className=" font-bold text-gray-800">ប្រតិទិនការងារ</h1>
      
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-2 mb-2" style={{ fontSize: '18px' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ជ្រើសរើសខែ
              </label>
              <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md">
                {/* Previous Month Button */}
                <button
                  onClick={navigateToPreviousMonth}
                  className="p-2 hover:bg-gray-100 rounded-l-md transition-colors"
                  title="ខែមុន"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                {/* Month Display/Input */}
                <div className="flex-1 px-2 py-1 text-center relative">
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {formatMonthDisplay(selectedMonth)}
                  </span>
                </div>
                
                {/* Next Month Button */}
                <button
                  onClick={navigateToNextMonth}
                  className="p-2 hover:bg-gray-100 rounded-r-md transition-colors"
                  title="ខែបន្ទាប់"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          
            <div className="flex flex-wrap items-center gap-3">
              {/* 1. Export Excel - Purple */}
              <button
                onClick={handleExportTemplate}
                className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </button>
              
              {/* 2. Import Excel - Orange */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Import Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {/* 4. បន្ថែមកាលវិភាគការងារ - Green */}
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm"
              >
                + បន្ថែមកាលវិភាគការងារ
              </button>
              
              {/* 5. របាយការណ៍សរុប - Purple */}
              <button
                onClick={() => setShowSummaryModal(true)}
                className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition flex items-center gap-1.5 text-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                របាយការណ៍សរុប
              </button>
      {/* Summary Report Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4 text-center">របាយការណ៍សរុប</h2>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => { exportSummaryExcel(); setShowSummaryModal(false); }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2 font-semibold text-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v16h16V4H4zm8 8v4m0 0l-3-3m3 3l3-3" />
                </svg>
                Export Excel
              </button>
              <button
                onClick={() => { setShowSummaryModal(false); handleComprehensiveSummaryReport(); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 font-semibold text-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                ព្រីន
              </button>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 font-semibold text-lg"
              >បិទ</button>
            </div>
          </div>
        </div>
      )}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Statistics Bar */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-4 mb-3">
          <h3 className="text-lg font-semibold text-gray-800">ស្ថិតិប្រចាំថ្ងៃ</h3>
          <input
            type="date"
            value={selectedDayStats}
            onChange={(e) => setSelectedDayStats(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div className="grid grid-cols-7 gap-3">
          <div 
            className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => showStatsDetail('totalEmployees')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">បុគ្គលិកសរុប</p>
                <p className="text-xl font-bold text-blue-600">{dailyStats.totalEmployees}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">&nbsp;</p>
              </div>
              <div className="bg-blue-100 rounded-full p-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-green-500 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => showStatsDetail('workingToday')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">ធ្វើការសរុប</p>
                <p className="text-xl font-bold text-green-600">{dailyStats.workingToday}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {dailyStats.totalEmployees > 0 
                    ? `${((dailyStats.workingToday / dailyStats.totalEmployees) * 100).toFixed(1)}%` 
                    : '0.0%'}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-teal-500 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => showStatsDetail('dayShift')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">ចូលពេលព្រឹក</p>
                <p className="text-xl font-bold text-teal-600">{dailyStats.dayShift}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {dailyStats.totalEmployees > 0 
                    ? `${((dailyStats.dayShift / dailyStats.totalEmployees) * 100).toFixed(1)}%` 
                    : '0.0%'}
                </p>
              </div>
              <div className="bg-teal-100 rounded-full p-2">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-indigo-500 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => showStatsDetail('nightShift')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">ចូលវេនល្ងាច</p>
                <p className="text-xl font-bold text-indigo-600">{dailyStats.nightShift}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {dailyStats.totalEmployees > 0 
                    ? `${((dailyStats.nightShift / dailyStats.totalEmployees) * 100).toFixed(1)}%` 
                    : '0.0%'}
                </p>
              </div>
              <div className="bg-indigo-100 rounded-full p-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-yellow-500 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => showStatsDetail('shift24Hours')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">ប្រចាំ24ម៉ោង</p>
                <p className="text-xl font-bold text-yellow-600">{dailyStats.shift24Hours}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {dailyStats.totalEmployees > 0 
                    ? `${((dailyStats.shift24Hours / dailyStats.totalEmployees) * 100).toFixed(1)}%` 
                    : '0.0%'}
                </p>
              </div>
              <div className="bg-yellow-100 rounded-full p-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-red-500 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => showStatsDetail('dayOffToday')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">ឈប់សម្រាក</p>
                <p className="text-xl font-bold text-red-600">{dailyStats.dayOffToday}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {dailyStats.totalEmployees > 0 
                    ? `${((dailyStats.dayOffToday / dailyStats.totalEmployees) * 100).toFixed(1)}%` 
                    : '0.0%'}
                </p>
              </div>
              <div className="bg-red-100 rounded-full p-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-gray-500 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => showStatsDetail('noSchedule')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">មិនបានកំណត់ម៉ោង</p>
                <p className="text-xl font-bold text-gray-600">{dailyStats.noSchedule}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {dailyStats.totalEmployees > 0 
                    ? `${((dailyStats.noSchedule / dailyStats.totalEmployees) * 100).toFixed(1)}%` 
                    : '0.0%'}
                </p>
              </div>
              <div className="bg-gray-100 rounded-full p-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Calendar Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            កំពុងផ្ទុក...
          </div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            មិនមានបុគ្គលិក
          </div>
        ) : (
          <div>
            {/* Combined Filter and Search Controls */}
            <div className="p-3 bg-blue-50 border-b">
              <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
                {/* Department Filter */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <label className="text-sm font-medium text-gray-700">ផ្នែក:</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white min-w-48"
                  >
                    <option value="all">ផ្នែកទាំងអស់</option>
                    {departments.map((dept, index) => (
                      <option key={index} value={dept}>{dept}</option>
                    ))}
                  </select>
                  {selectedDepartment !== 'all' && (
                    <button
                      onClick={() => handleDepartmentChange('all')}
                      className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm"
                      title="សម្អាតការជ្រើសរើសផ្នែក"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Search Controls */}
                <div className="flex items-center gap-2 flex-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <label className="text-sm font-medium text-gray-700">ស្វែងរក:</label>
                  <select
                    value={searchBy}
                    onChange={(e) => handleSearchByChange(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">ទាំងអស់</option>
                    <option value="name">ឈ្មោះ</option>
                    <option value="cardNumber">លេខកាត</option>
                    <option value="phone">ទូរស័ព្ទ</option>
                    <option value="position">តួនាទី</option>
                  </select>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder={`ស្វែងរកតាម${searchBy === 'all' ? 'ទាំងអស់' : searchBy === 'name' ? 'ឈ្មោះ' : searchBy === 'cardNumber' ? 'លេខកាត' : searchBy === 'phone' ? 'ទូរស័ព្ទ' : 'តួនាទី'}...`}
                      className="px-3 py-1 pl-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                    <svg className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {searchTerm && (
                    <button
                      onClick={() => handleSearchChange('')}
                      className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm"
                      title="សម្អាតការស្វែងរក"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Status Display */}
                <div className="flex items-center gap-3 text-sm">
                  {selectedDepartment !== 'all' && (
                    <span className="text-green-600">
                      ផ្នែក: <span className="font-semibold">{selectedDepartment}</span>
                    </span>
                  )}
                  {searchTerm && (
                    <span className="text-blue-600">
                      រកឃើញ: <span className="font-semibold">{totalEmployees}</span> នាក់
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    បង្ហាញ <span className="font-semibold text-gray-900">{startIndex + 1}</span> ដល់ <span className="font-semibold text-gray-900">{Math.min(endIndex, totalEmployees)}</span> នៃ <span className="font-semibold text-gray-900">{totalEmployees}</span> នាក់
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">បង្ហាញ:</label>
                    <select 
                      value={itemsPerPage} 
                      onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-sm text-gray-600">នាក់</span>
                  </div>
                  {selectedEmployees.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-blue-600">
                        បានជ្រើស: <span className="font-semibold">{selectedEmployees.length}</span> នាក់ (ពីសរុប {filteredEmployees.length} នាក់)
                      </span>
                      <button
                        onClick={handleBulkDelete}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        លុប
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      &lt;
                    </button>
                    <span className="text-sm text-gray-600">
                      ទំព័រ {currentPage} នៃ {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full border-collapse" style={{ fontSize: '12px' }}>
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold" style={{ minWidth: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4"
                      title="ជ្រើសរើស/បោះបង់ទិន្នន័យទាំងអស់"
                    />
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold" style={{ minWidth: '50px' }}>
                    ល.រ
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold" style={{ minWidth: '100px' }}>
                    ទូរស័ព្ទ
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold" style={{ minWidth: '80px' }}>
                    លេខកាត
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold" style={{ minWidth: '150px' }}>
                    ឈ្មោះ
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold" style={{ minWidth: '120px' }}>
                    តួនាទី
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <th key={day} className="border border-gray-300 px-1 py-2 text-center font-semibold" style={{ minWidth: '40px' }}>
                      ទី{day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((employee, index) => (
                  <tr key={employee._id} className={`hover:bg-gray-50 ${selectedEmployees.includes(employee._id) ? 'bg-blue-50' : ''}`}>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee._id)}
                        onChange={() => handleSelectEmployee(employee._id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      {startIndex + index + 1}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                                      {(() => {
                                        const raw = employee.phoneNumber || employee.phone || '';
                                        try {
                                          // lazy require to avoid circular imports in some builds
                                          const f = require('../utils/formatPhone').formatPhoneDisplay;
                                          return f(raw) || '-';
                                        } catch (e) {
                                          return raw || '-';
                                        }
                                      })()}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      {employee.staffId || employee.cardNumber || '-'}
                    </td>
                    <td className="border border-gray-300 px-2 py-2">
                      <div className="font-medium text-gray-900">
                        {employee.khmerName || employee.fullName || employee.name || employee.staffName || '-'}
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-2">
                      {employee.position || employee.Position_Kh || '-'}
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      const schedule = getScheduleForDay(employee._id, day);
                      return (
                        <td key={day} className="border border-gray-300 px-1 py-1 text-center">
                          {schedule ? (
                            <div className="text-[10px] font-medium" style={{ color: schedule.shiftTitle === 'Day Off' ? '#dc2626' : '#374151' }}>
                              {schedule.shiftTitle === 'Day Off' ? (
                                'Day Off'
                              ) : (
                                schedule.shiftStart || schedule.scheduledStart || schedule.startTime ? 
                                  `${formatTimeToAMPM(schedule.shiftStart || schedule.scheduledStart || schedule.startTime)}-${formatTimeToAMPM(schedule.shiftEnd || schedule.scheduledEnd || schedule.endTime)}` 
                                  : '-'
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            
            {/* Bottom Pagination */}
            <div className="p-3 bg-gray-50 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                បង្ហាញ <span className="font-semibold text-gray-900">{startIndex + 1}</span> ដល់ <span className="font-semibold text-gray-900">{Math.min(endIndex, totalEmployees)}</span> នៃ <span className="font-semibold text-gray-900">{totalEmployees}</span> នាក់
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  មុន
                </button>
                <span className="text-sm text-gray-600">
                  ទំព័រ {currentPage} នៃ {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  បន្ទាប់
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">បន្ថែមតារាងការងារថ្មី</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    បុគ្គលិក
                  </label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">ជ្រើសរើសបុគ្គលិក</option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.khmerName || emp.fullName || emp.name || emp.staffName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    កាលបរិច្ឆេទ
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ម៉ោងចូល
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ម៉ោងចេញ
                    </label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ស្ថានភាព
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="scheduled">បានកំណត់</option>
                    <option value="completed">បានបញ្ចប់</option>
                    <option value="cancelled">បានលុបចោល</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    កំណត់សម្គាល់
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  រក្សាទុក
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">ពិនិត្យមើលទិន្នន័យ Import</h2>
            
            {(!importData.employees || importData.employees.length === 0) ? (
              <div className="text-center py-8 text-gray-500">
                មិនមានទិន្នន័យសម្រាប់ import
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800">
                    រកឃើញ <strong>{importData.employees.length}</strong> បុគ្គលិក និង <strong>{importData.schedules.length}</strong> កំណត់ត្រាតារាងការងារ ពី Excel file
                  </p>
                </div>

                {/* Employee Preview */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">បុគ្គលិក ({importData.employees.length})</h3>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2">ល.រ</th>
                          <th className="border border-gray-300 px-3 py-2">លេខកាត</th>
                          <th className="border border-gray-300 px-3 py-2">ឈ្មោះ</th>
                          <th className="border border-gray-300 px-3 py-2">ទូរស័ព្ទ</th>
                          <th className="border border-gray-300 px-3 py-2">តួនាទី</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.employees.slice(0, 100).map((emp, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2 text-center">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">{emp.staffId}</td>
                            <td className="border border-gray-300 px-3 py-2">{emp.khmerName}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">{(() => {
                              const raw = emp.phoneNumber || '';
                              try { const f = require('../utils/formatPhone').formatPhoneDisplay; return f(raw) || '-'; } catch (e) { return raw || '-'; }
                            })()}</td>
                            <td className="border border-gray-300 px-3 py-2">{emp.position || '-'}</td>
                          </tr>
                        ))}
                        {importData.employees.length > 100 && (
                          <tr>
                            <td colSpan="5" className="border border-gray-300 px-3 py-2 text-center text-gray-500 italic">
                              ... និង {importData.employees.length - 100} បុគ្គលិកទៀត
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Schedule Preview */}
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">តារាងការងារ ({importData.schedules.length})</h3>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2">ល.រ</th>
                          <th className="border border-gray-300 px-3 py-2">លេខកាត</th>
                          <th className="border border-gray-300 px-3 py-2">កាលបរិច្ឆេទ</th>
                          <th className="border border-gray-300 px-3 py-2">ប្រភេទវេន</th>
                          <th className="border border-gray-300 px-3 py-2">ម៉ោងចូល</th>
                          <th className="border border-gray-300 px-3 py-2">ម៉ោងចេញ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.schedules.slice(0, 100).map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2 text-center">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">{item.staffId}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">{item.date}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs ${
                                item.shiftTitle === 'Day Off' ? 'bg-red-100 text-red-800 font-semibold' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {item.shiftTitle || 'Work'}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center">{item.shiftStart || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">{item.shiftEnd || '-'}</td>
                          </tr>
                        ))}
                        {importData.schedules.length > 100 && (
                          <tr>
                            <td colSpan="6" className="border border-gray-300 px-3 py-2 text-center text-gray-500 italic">
                              ... និង {importData.schedules.length - 100} កំណត់ត្រាទៀត
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportData({ employees: [], schedules: [] });
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="button"
                    onClick={handleImportConfirm}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {loading ? 'កំពុង Import...' : 'បញ្ជាក់ Import'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stats Detail Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">{statsModalData.title}</h2>
              <button
                onClick={() => setShowStatsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {statsModalData.employees.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m-2 0l3-3 3 3m0 4.5l.5-.5a2 2 0 011.414 0l3.586 3.586a2 2 0 01 1.414 0L16 15.5" />
                  </svg>
                  <p>មិនមានបុគ្គលិកក្នុងប្រភេទនេះទេ</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    សរុប: {statsModalData.employees.length} នាក់
                  </div>
                  
                  <div className="grid gap-4">
                    {statsModalData.employees.map((employee, index) => (
                      <div key={employee._id || index} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {employee.khmerName ? employee.khmerName.charAt(0) : '#'}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {employee.khmerName || employee.name || 'មិនបានកំណត់ឈ្មោះ'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              លេខកាត: {employee.staffId || employee.cardNumber || 'មិនមាន'}
                            </p>
                            <p className="text-sm text-gray-600">
                              ដេប៉ាតមិន: {getEmployeeDepartment(employee)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className={`font-semibold ${employee.statusColor || 'text-gray-600'}`}>
                            {employee.status}
                          </p>
                          {employee.phoneNumber && (
                            <p className="text-sm text-gray-500">{employee.phoneNumber}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
              <div className="flex gap-3">
                <button
                  onClick={handlePrintStats}
                  disabled={statsModalData.employees.length === 0}
                  className={`px-4 py-2 rounded-md transition flex items-center gap-2 ${
                    statsModalData.employees.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  ព្រីន
                </button>
                
                <button
                  onClick={exportStatsToExcel}
                  disabled={statsModalData.employees.length === 0 || isExportingPDF}
                  className={`px-4 py-2 rounded-md transition flex items-center gap-2 ${
                    statsModalData.employees.length === 0 || isExportingPDF
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isExportingPDF ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      កំពុងបង្កើត...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 16h4m-4 0v-3a1 1 0 011-1h3M9 5a2 2 0 012-2h1a2 2 0 012 2v1a1 1 0 001 1h3a2 2 0 012 2v.5" />
                      </svg>
                      Export Excel
                    </>
                  )}
                </button>
              </div>
              
              <button
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
