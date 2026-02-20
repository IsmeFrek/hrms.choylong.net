import React, { useState, useEffect } from 'react';
import api from '../services/api';

const WeeklyShiftPattern = ({ onClose, onSave }) => {
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [weekPattern, setWeekPattern] = useState({
    monday: { templateId: '', customStart: '07:30', customEnd: '15:30' },
    tuesday: { templateId: '', customStart: '07:30', customEnd: '15:30' },
    wednesday: { templateId: '', customStart: '07:30', customEnd: '15:30' },
    thursday: { templateId: '', customStart: '07:30', customEnd: '15:30' },
    friday: { templateId: '', customStart: '07:30', customEnd: '15:30' },
    saturday: { templateId: '', customStart: '07:30', customEnd: '15:30' },
    sunday: { templateId: '', customStart: '07:30', customEnd: '15:30' }
  });
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1); // Get Monday of current week
    return monday.toISOString().slice(0, 10);
  });
  const [applyWeeks, setApplyWeeks] = useState(1);
  const [loading, setLoading] = useState(false);

  const daysOfWeek = [
    { key: 'monday', label: 'ថ្ងៃច័ន្ទ', enLabel: 'Monday' },
    { key: 'tuesday', label: 'ថ្ងៃអង្គារ', enLabel: 'Tuesday' },
    { key: 'wednesday', label: 'ថ្ងៃពុធ', enLabel: 'Wednesday' },
    { key: 'thursday', label: 'ថ្ងៃព្រហស្បតិ៍', enLabel: 'Thursday' },
    { key: 'friday', label: 'ថ្ងៃសុក្រ', enLabel: 'Friday' },
    { key: 'saturday', label: 'ថ្ងៃសៅរ៍', enLabel: 'Saturday' },
    { key: 'sunday', label: 'ថ្ងៃអាទិត្យ', enLabel: 'Sunday' }
  ];

  useEffect(() => {
    loadShiftTemplates();
    loadDepartments();
  }, []);

  const loadShiftTemplates = async () => {
    try {
      const { data } = await api.get('/shift-templates');
      setShiftTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load shift templates:', e);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data } = await api.get('/departments');
      setDepartments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load departments:', e);
    }
  };

  const handleTemplateChange = (day, templateId) => {
    const template = shiftTemplates.find(t => t._id === templateId);
    setWeekPattern(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        templateId,
        customStart: template ? template.startAt || '07:30' : prev[day].customStart,
        customEnd: template ? template.endAt || '15:30' : prev[day].customEnd
      }
    }));
  };

  const handleTimeChange = (day, field, value) => {
    setWeekPattern(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const copyToAllDays = (sourceDay) => {
    const source = weekPattern[sourceDay];
    const newPattern = {};
    daysOfWeek.forEach(day => {
      newPattern[day.key] = { ...source };
    });
    setWeekPattern(newPattern);
  };

  const applyTemplate = (templateId) => {
    const template = shiftTemplates.find(t => t._id === templateId);
    if (!template) return;
    
    const newPattern = {};
    daysOfWeek.forEach(day => {
      newPattern[day.key] = {
        templateId,
        customStart: template.startAt || '07:30',
        customEnd: template.endAt || '15:30'
      };
    });
    setWeekPattern(newPattern);
  };

  const generateSchedules = () => {
    const schedules = [];
    const start = new Date(startDate);
    
    for (let week = 0; week < applyWeeks; week++) {
      daysOfWeek.forEach((day, dayIndex) => {
        const scheduleDate = new Date(start);
        scheduleDate.setDate(start.getDate() + (week * 7) + dayIndex);
        
        const dayPattern = weekPattern[day.key];
        schedules.push({
          date: scheduleDate.toISOString(),
          scheduledStart: dayPattern.customStart,
          scheduledEnd: dayPattern.customEnd,
          department: selectedDepartment,
          notes: `Auto-generated from weekly pattern - ${day.enLabel}`
        });
      });
    }
    
    return schedules;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const schedules = generateSchedules();
      
      // Use bulk API to save all schedules at once
      await api.post('/schedules/bulk', { schedules });
      
      if (onSave) onSave();
      if (onClose) onClose();
    } catch (e) {
      console.error('Failed to save weekly pattern:', e);
      alert('Failed to save weekly pattern. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">កំណត់ម៉ូដែលវេនសប្តាហ៍ (Weekly Shift Pattern)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">ថ្ងៃចាប់ផ្តើម (Start Date - Monday)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">ចំនួនសប្តាហ៍ (Number of Weeks)</label>
            <input
              type="number"
              min="1"
              max="52"
              value={applyWeeks}
              onChange={(e) => setApplyWeeks(parseInt(e.target.value) || 1)}
              className="w-full p-2 border rounded-md"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">នាយកដ្ឋាន (Department)</label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full p-2 border rounded-md"
          >
            <option value="">ទាំងអស់ (All Departments)</option>
            {departments.map(dept => (
              <option key={dept._id} value={dept.Department_Kh || dept.name}>
                {dept.Department_Kh || dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">អនុវត្តទំព័រទាំងអស់ (Apply Template to All Days)</label>
          <select
            onChange={(e) => e.target.value && applyTemplate(e.target.value)}
            className="w-full p-2 border rounded-md"
            defaultValue=""
          >
            <option value="">ជ្រើសរើសទំព័រ (Select Template)</option>
            {shiftTemplates.map(template => (
              <option key={template._id} value={template._id}>
                {template.title} ({template.startAt} - {template.endAt})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6">
          {daysOfWeek.map(day => (
            <div key={day.key} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">{day.label} ({day.enLabel})</h3>
                <button
                  onClick={() => copyToAllDays(day.key)}
                  className="text-sm bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200"
                >
                  ចម្លងទៅថ្ងៃផ្សេង (Copy to All)
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ទំព័រ (Template)</label>
                  <select
                    value={weekPattern[day.key].templateId}
                    onChange={(e) => handleTemplateChange(day.key, e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">កំណត់ដោយខ្លួនឯង (Custom)</option>
                    {shiftTemplates.map(template => (
                      <option key={template._id} value={template._id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ចាប់ផ្តើម (Start)</label>
                  <input
                    type="time"
                    value={weekPattern[day.key].customStart}
                    onChange={(e) => handleTimeChange(day.key, 'customStart', e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">បញ្ចប់ (End)</label>
                  <input
                    type="time"
                    value={weekPattern[day.key].customEnd}
                    onChange={(e) => handleTimeChange(day.key, 'customEnd', e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            បោះបង់ (Cancel)
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក (Save)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyShiftPattern;