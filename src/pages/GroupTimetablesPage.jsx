import React, { useState, useEffect, useMemo } from 'react';
import { departmentAPI } from '../services/departmentAPI';
import { employeeAPI } from '../services/api';
import { 
  Building2, 
  User, 
  Save, 
  ChevronRight, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  LayoutGrid,
  List,
  Search,
  Filter,
  CheckCircle2,
  Users,
  SearchX,
  UserMinus,
  UserPlus
} from 'lucide-react';

const GroupTimetablesPage = () => {
  const [mode, setMode] = useState('department'); // 'department' or 'employee'
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [deptEmployees, setDeptEmployees] = useState([]); 
  const [excludedStaffIds, setExcludedStaffIds] = useState([]); 
  
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [innerSearchQuery, setInnerSearchQuery] = useState(''); 
  
  const [loading, setLoading] = useState(false);
  const [loadingDeptEmployees, setLoadingDeptEmployees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDeptForEmployees, setSelectedDeptForEmployees] = useState(null);
  
  const [activeItem, setActiveItem] = useState(null); 
  const [editMode, setEditMode] = useState('standard'); 
  
  const [standardConfig, setStandardConfig] = useState({
    start: '07:30',
    end: '15:30',
    halfDay: false,
    days: {
      monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false,
    }
  });

  const [flexibleConfig, setFlexibleConfig] = useState({
    monday: { work: true, halfDay: false, start: '07:30', end: '15:30' },
    tuesday: { work: true, halfDay: false, start: '07:30', end: '15:30' },
    wednesday: { work: true, halfDay: false, start: '07:30', end: '15:30' },
    thursday: { work: true, halfDay: false, start: '07:30', end: '15:30' },
    friday: { work: true, halfDay: false, start: '07:30', end: '15:30' },
    saturday: { work: false, halfDay: false, start: '07:30', end: '15:30' },
    sunday: { work: false, halfDay: false, start: '07:30', end: '15:30' },
  });

  const daysList = [
    { key: 'monday', label: 'Monday', kh: 'ថ្ងៃច័ន្ទ' },
    { key: 'tuesday', label: 'Tuesday', kh: 'ថ្ងៃអង្គារ' },
    { key: 'wednesday', label: 'Wednesday', kh: 'ថ្ងៃពុធ' },
    { key: 'thursday', label: 'Thursday', kh: 'ថ្ងៃព្រហស្បតិ៍' },
    { key: 'friday', label: 'Friday', kh: 'ថ្ងៃសុក្រ' },
    { key: 'saturday', label: 'Saturday', kh: 'ថ្ងៃសៅរ៍' },
    { key: 'sunday', label: 'Sunday', kh: 'ថ្ងៃអាទិត្យ' },
  ];

  useEffect(() => {
    loadInitialData();
  }, [mode]);

  useEffect(() => {
    if (activeItem && mode === 'department') {
      loadDeptEmployees(activeItem.Department_Kh);
    }
  }, [activeItem, mode]);

  const loadInitialData = async () => {
    setLoading(true);
    setActiveItem(null);
    setSelectedDeptForEmployees(null);
    try {
      const res = await departmentAPI.getDepartments();
      const list = res.data?.departments || res.data || [];
      setDepartments([...list].sort((a,b) => (parseInt(a.Department_Id)||0) - (parseInt(b.Department_Id)||0)));
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDeptEmployeesForSelection = async (deptKh) => {
    setLoadingDeptEmployees(true);
    try {
      const res = await employeeAPI.getEmployees({ Department_Kh: deptKh, limit: 1000 });
      setEmployees(res.data?.employees || res.data || []);
    } catch (err) {
      console.error('Failed to load employees for selection', err);
    } finally {
      setLoadingDeptEmployees(false);
    }
  };

  const loadDeptEmployees = async (deptKh) => {
    if (!deptKh) return;
    setLoadingDeptEmployees(true);
    try {
      const res = await employeeAPI.getEmployees({ Department_Kh: deptKh, limit: 1000 });
      setDeptEmployees(res.data?.employees || res.data || []);
    } catch (err) {
      console.error('Failed to load department employees', err);
    } finally {
      setLoadingDeptEmployees(false);
    }
  };

  const handleSidebarClick = (item) => {
    if (mode === 'department') {
      startEdit(item);
    } else {
      if (!selectedDeptForEmployees) {
        setSelectedDeptForEmployees(item);
        loadDeptEmployeesForSelection(item.Department_Kh);
      } else {
        startEdit(item);
      }
    }
  }

  const startEdit = (item) => {
    setActiveItem(item);
    setInnerSearchQuery('');
    const pattern = item.customPattern;
    
    if (pattern) {
      setEditMode(pattern.mode || 'standard');
      setExcludedStaffIds(pattern.excludedStaffIds || []);
      if (pattern.mode === 'flexible') {
        setFlexibleConfig(pattern.flexible || flexibleConfig);
      } else {
        setStandardConfig(pattern.standard || standardConfig);
      }
    } else {
      setEditMode('standard');
      setExcludedStaffIds([]);
      setStandardConfig({
        start: '07:30',
        end: '15:30',
        halfDay: false,
        days: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false }
      });
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleEmployeeInclusion = (id) => {
    setExcludedStaffIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!activeItem) return;
    
    setSaving(true);
    try {
      const pattern = {
        mode: editMode,
        standard: standardConfig,
        flexible: flexibleConfig,
        excludedStaffIds: mode === 'department' ? excludedStaffIds : []
      };
      
      const payload = {
        ...activeItem,
        customPattern: pattern
      };
      
      if (mode === 'department') {
        await departmentAPI.updateDepartment(activeItem._id, payload);
        setDepartments(prev => prev.map(d => d._id === activeItem._id ? payload : d));
      } else {
        await employeeAPI.updateEmployee(activeItem._id, payload);
        setEmployees(prev => prev.map(e => e._id === activeItem._id ? payload : e));
      }
      
      setActiveItem(payload);
      alert('បានរក្សាទុកដោយជោគជ័យ!');
    } catch (err) {
      console.error('Save failed', err);
      alert('បរាជ័យក្នុងការរក្សាទុក');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (mode === 'department' || !selectedDeptForEmployees) {
      return departments.filter(d => 
        (d.Department_Kh || d.Department || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.Department_Id || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      return employees.filter(e => {
        return (e.khmerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
               (e.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
               (e.staffId || '').toLowerCase().includes(searchQuery.toLowerCase());
      });
    }
  }, [mode, departments, employees, searchQuery, selectedDeptForEmployees]);

  const innerFilteredEmployees = useMemo(() => {
    return deptEmployees.filter(e => 
      (e.khmerName || '').toLowerCase().includes(innerSearchQuery.toLowerCase()) ||
      (e.staffId || '').toLowerCase().includes(innerSearchQuery.toLowerCase())
    );
  }, [deptEmployees, innerSearchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header - More Compact */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-600 rounded-lg shadow-sm">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">កំណត់ម៉ោងអូតូដំបូង</h1>
                <p className="text-[10px] text-gray-500 font-medium">Auto-Time Setting (Dept/Staff)</p>
              </div>
            </div>

            <div className="bg-gray-100 p-1 rounded-xl flex border border-gray-200">
               <button 
                onClick={() => setMode('department')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'department' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
               >
                 <Building2 className="w-3.5 h-3.5" />
                 តាមផ្នែក
               </button>
               <button 
                onClick={() => setMode('employee')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'employee' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
               >
                 <User className="w-3.5 h-3.5" />
                 តាមបុគ្គលិក
               </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar - Smaller width */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm space-y-3">
               <div className="flex items-center justify-between">
                  {selectedDeptForEmployees && mode === 'employee' ? (
                    <button 
                      onClick={() => { setSelectedDeptForEmployees(null); setSearchQuery(''); }}
                      className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase"
                    >
                      <ChevronRight className="w-3 h-3 rotate-180" />
                      Back to Depts
                    </button>
                  ) : (
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                      {mode === 'department' ? 'Select Department' : 'Select Dept first'}
                    </span>
                  )}
               </div>
               
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="ស្វែងរក..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-xs outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-khmer text-gray-900"
                  />
               </div>
            </div>

            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
              {loading || loadingDeptEmployees ? (
                 <div className="flex flex-col items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                 </div>
              ) : filteredItems.length === 0 ? (
                 <div className="p-8 text-center bg-white rounded-2xl border border-dashed text-gray-300">
                    <SearchX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-[10px] font-bold">គ្មានលទ្ធផល</p>
                 </div>
              ) : filteredItems.map(item => {
                const isSelected = activeItem?._id === item._id;
                const isDept = !item.staffId;
                
                let activePattern = item.customPattern;
                let isInherited = false;

                if (!isDept && !activePattern) {
                  const parentDept = departments.find(d => d.Department_Kh === item.Department_Kh);
                  if (parentDept && parentDept.customPattern) {
                    const exclusions = parentDept.customPattern.excludedStaffIds || [];
                    if (!exclusions.includes(item._id)) {
                      activePattern = parentDept.customPattern;
                      isInherited = true;
                    }
                  }
                }

                let timeLabel = null;
                if (activePattern) {
                  if (activePattern.mode === 'standard' && activePattern.standard) {
                    timeLabel = `${activePattern.standard.start} - ${activePattern.standard.end}`;
                  } else {
                    timeLabel = 'FLEXIBLE';
                  }
                }
                
                return (
                  <button 
                    key={item._id}
                    onClick={() => handleSidebarClick(item)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-500' : 'bg-gray-100 group-hover:bg-blue-100'}`}>
                         {isDept ? (
                            <Building2 className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                         ) : (
                            <User className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                         )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-[11px] truncate leading-tight">
                          {isDept ? (item.Department_Kh || item.Department) : (item.khmerName || item.name)}
                        </h3>
                        <p className={`text-[8px] uppercase font-black tracking-tighter truncate opacity-70`}>
                          {isDept ? `ID: ${item.Department_Id}` : `#${item.staffId}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                       {timeLabel && (
                          <span className={`text-[8px] font-black font-sans px-1.5 py-0.5 rounded-md transition-all ${isSelected ? 'bg-white/20 text-white' : (isInherited ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-100')}`}>
                             {timeLabel}
                          </span>
                       )}
                       <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor Area - Compacted */}
          <div className="lg:col-span-9">
            {activeItem ? (
              <div className="flex flex-col gap-6 max-w-4xl">
                <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-300">
                  {/* Compact Header */}
                  <div className={`px-6 py-5 text-white flex justify-between items-center relative overflow-hidden bg-gradient-to-r ${mode === 'department' ? 'from-blue-700 to-blue-600' : 'from-indigo-700 to-indigo-600'}`}>
                     <div className="relative z-10 flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center p-2 backdrop-blur-sm border border-white/20">
                           {mode === 'department' ? <Building2 className="w-6 h-6 text-white" /> : <User className="w-6 h-6 text-white" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="px-1.5 py-0.5 bg-black/10 rounded text-[8px] font-black uppercase tracking-wider border border-white/20">
                               {mode === 'department' ? 'DEPT CONFIG' : 'STAFF CONFIG'}
                            </span>
                          </div>
                          <h2 className="text-xl font-bold truncate leading-tight">{mode === 'department' ? (activeItem.Department_Kh || activeItem.Department) : (activeItem.khmerName || activeItem.name)}</h2>
                        </div>
                     </div>
                    
                    <button 
                      onClick={handleSave}
                      disabled={saving}
                      className="px-6 py-2 bg-white text-gray-900 rounded-xl font-bold text-xs shadow-md hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                    >
                      {saving ? <div className="w-3.5 h-3.5 border-2 border-black/30 border-b-black rounded-full animate-spin"></div> : <Save className="w-4 h-4" />}
                      រក្សាទុក
                    </button>
                  </div>

                  <div className="p-6 space-y-8">
                     <div className="bg-gray-100 p-1 rounded-xl flex w-fit gap-1 border border-gray-200/50">
                      <button 
                        onClick={() => setEditMode('standard')}
                        className={`px-6 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 ${editMode === 'standard' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <List className="w-3.5 h-3.5" />
                        Standard
                      </button>
                      <button 
                        onClick={() => setEditMode('flexible')}
                        className={`px-6 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 ${editMode === 'flexible' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        Flexible
                      </button>
                    </div>

                    {editMode === 'standard' ? (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                        {/* Time Config */}
                        <div className="md:col-span-12 lg:col-span-5 bg-gray-50 rounded-2xl p-6 border border-gray-100 relative pr-20">
                            <div className="absolute top-6 right-6">
                              <label className="flex items-center gap-2 cursor-pointer scale-90">
                                 <span className="text-[9px] font-black text-gray-400 uppercase">Half Day</span>
                                 <div className={`w-10 h-5 rounded-full transition-all relative ${standardConfig.halfDay ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                    <input 
                                      type="checkbox" 
                                      className="sr-only"
                                      checked={standardConfig.halfDay}
                                      onChange={e => setStandardConfig(prev => ({ ...prev, halfDay: e.target.checked }))}
                                    />
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${standardConfig.halfDay ? 'right-0.5' : 'left-0.5'}`}></div>
                                 </div>
                              </label>
                           </div>

                           <div className="space-y-6">
                              <div className="space-y-1.5">
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Job Start</label>
                                <div className="relative">
                                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                                  <input 
                                    type="time" 
                                    value={standardConfig.start}
                                    onChange={e => setStandardConfig(prev => ({ ...prev, start: e.target.value }))}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 pl-10 text-xl font-bold text-gray-800 outline-none focus:border-blue-300 transition-all shadow-sm"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Job End</label>
                                <div className="relative">
                                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500" />
                                  <input 
                                    type="time" 
                                    value={standardConfig.end}
                                    onChange={e => setStandardConfig(prev => ({ ...prev, end: e.target.value }))}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 pl-10 text-xl font-bold text-gray-800 outline-none focus:border-blue-300 transition-all shadow-sm"
                                  />
                                </div>
                              </div>
                           </div>
                        </div>

                        {/* Working Days Config */}
                        <div className="md:col-span-12 lg:col-span-7">
                           <label className="text-[9px] font-black text-gray-400 mb-2.5 block uppercase tracking-widest ml-2">Working Days (ថ្ងៃធ្វើការ)</label>
                           <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                              {daysList.map(day => (
                                <label key={day.key} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${standardConfig.days[day.key] ? 'bg-gray-900 border-gray-900 text-white shadow-sm' : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'}`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[9px] ${standardConfig.days[day.key] ? 'bg-white/10' : 'bg-gray-50'}`}>
                                       {day.label.substring(0,3).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black truncate leading-tight">{day.kh}</span>
                                      <span className="text-[8px] opacity-40 uppercase tracking-tighter">{day.label}</span>
                                    </div>
                                  </div>
                                  <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${standardConfig.days[day.key] ? 'bg-blue-500 border-white/40' : 'bg-transparent border-gray-100'}`}>
                                     {standardConfig.days[day.key] && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                  </div>
                                  <input type="checkbox" className="sr-only" checked={standardConfig.days[day.key]}
                                    onChange={() => setStandardConfig(prev => ({ ...prev, days: { ...prev.days, [day.key]: !prev.days[day.key] } }))}
                                  />
                                </label>
                              ))}
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {daysList.map(day => (
                          <div key={day.key} className={`bg-white border p-4 rounded-2xl transition-all relative group ${flexibleConfig[day.key].work ? 'border-gray-200' : 'opacity-40 grayscale pointer-events-none'}`}>
                             <div className="absolute top-3 right-3 z-10 pointer-events-auto">
                               <button 
                                 onClick={() => setFlexibleConfig(prev => ({ ...prev, [day.key]: { ...prev[day.key], work: !prev[day.key].work } }))}
                                 className={`px-3 py-1 rounded-lg text-[8px] font-black transition-all ${flexibleConfig[day.key].work ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                               >
                                  {flexibleConfig[day.key].work ? 'WORK' : 'OFF'}
                               </button>
                             </div>

                             <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 ${day.key === 'sunday' ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                   {day.label.substring(0, 1).toUpperCase()}
                                </div>
                                <span className="font-bold text-sm text-gray-800">{day.kh}</span>
                             </div>

                             <div className="grid grid-cols-2 gap-2 mb-3">
                                <input type="time" value={flexibleConfig[day.key].start} onChange={e => setFlexibleConfig(prev => ({ ...prev, [day.key]: { ...prev[day.key], start: e.target.value } }))}
                                  className="w-full bg-gray-50 border-none rounded-lg p-2 text-xs font-bold text-gray-800 focus:ring-1 focus:ring-blue-500/20 transition-all font-sans"
                                />
                                <input type="time" value={flexibleConfig[day.key].end} onChange={e => setFlexibleConfig(prev => ({ ...prev, [day.key]: { ...prev[day.key], end: e.target.value } }))}
                                  className="w-full bg-gray-50 border-none rounded-lg p-2 text-xs font-bold text-gray-800 focus:ring-1 focus:ring-blue-500/20 transition-all font-sans"
                                />
                             </div>
                             
                             <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                                <span className="text-[8px] font-bold text-gray-300 uppercase">Half Day</span>
                                <input type="checkbox" checked={flexibleConfig[day.key].halfDay} onChange={() => setFlexibleConfig(prev => ({ ...prev, [day.key]: { ...prev[day.key], halfDay: !prev[day.key].halfDay } }))}
                                  className="w-3.5 h-3.5 rounded text-emerald-600"
                                />
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inclusion/Exclusion List - More Compact */}
                {mode === 'department' && (
                  <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-5">
                     <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-blue-50 rounded-lg">
                              <Users className="w-5 h-5 text-blue-600" />
                           </div>
                           <h3 className="font-bold text-sm text-gray-900 leading-tight">បុគ្គលិកត្រូវអនុវត្ត</h3>
                        </div>
                        
                        <div className="flex items-center gap-2">
                           <div className="relative group w-[200px]">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="ស្វែងរកក្នុងផ្នែក..."
                                value={innerSearchQuery}
                                onChange={(e) => setInnerSearchQuery(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 pl-9 pr-3 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500/30 transition-all"
                              />
                           </div>
                           <span className="text-[8px] font-black text-gray-400 border px-2 py-1 rounded-lg">
                             {deptEmployees.length - excludedStaffIds.length}/{deptEmployees.length} IN
                           </span>
                        </div>
                     </div>

                     {loadingDeptEmployees ? (
                        <div className="flex items-center justify-center py-6 opacity-20"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div></div>
                     ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar-thin">
                           {innerFilteredEmployees.map(emp => {
                             const isExcluded = excludedStaffIds.includes(emp._id);

                              let empTimeLabel = null;
                              let isOverride = false;
                              if (emp.customPattern) {
                                isOverride = true;
                                if (emp.customPattern.mode === 'standard' && emp.customPattern.standard) {
                                  empTimeLabel = `${emp.customPattern.standard.start} - ${emp.customPattern.standard.end}`;
                                } else {
                                  empTimeLabel = 'FLEXIBLE';
                                }
                              } else if (!isExcluded && activeItem && activeItem.customPattern) {
                                if (activeItem.customPattern.mode === 'standard' && activeItem.customPattern.standard) {
                                  empTimeLabel = `${activeItem.customPattern.standard.start} - ${activeItem.customPattern.standard.end}`;
                                } else {
                                  empTimeLabel = 'FLEXIBLE';
                                }
                              }

                             return (
                               <button 
                                 key={emp._id}
                                 onClick={() => toggleEmployeeInclusion(emp._id)}
                                 className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all group/emp ${isExcluded ? 'bg-gray-50 border-transparent opacity-60' : 'bg-white border-blue-50 hover:border-blue-200 shadow-sm'}`}
                               >
                                  <div className="flex items-center gap-3">
                                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isExcluded ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
                                        <User className="w-4 h-4" />
                                     </div>
                                     <div className="min-w-0 flex flex-col items-start gap-0.5">
                                        <h4 className={`font-bold text-[10px] truncate max-w-[110px] ${isExcluded ? 'text-gray-400' : 'text-gray-900'}`}>{emp.khmerName || emp.name}</h4>
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[8px] font-black uppercase tracking-wider ${isExcluded ? 'text-gray-300' : 'text-blue-500'}`}>#{emp.staffId}</span>
                                          {empTimeLabel && (!isExcluded || isOverride) && (
                                            <span className={`text-[7px] font-black font-sans px-1 rounded-sm ${isOverride ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                                              {empTimeLabel}
                                            </span>
                                          )}
                                        </div>
                                     </div>
                                  </div>
                                  <div className={`w-6 h-6 flex-shrink-0 rounded-md flex items-center justify-center transition-all border-2 ${isExcluded ? 'border-gray-200 bg-transparent' : 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-100'}`}>
                                     {!isExcluded && <CheckCircle2 className="w-4 h-4 text-white" />}
                                  </div>
                               </button>
                             );
                           })}
                        </div>
                     )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[40px] border-4 border-dashed border-gray-100 h-[600px] flex flex-col items-center justify-center p-10 text-center relative overflow-hidden group">
                <div className="w-32 h-32 bg-gray-50 rounded-[40px] flex items-center justify-center mb-6 border border-gray-100 rotate-3 group-hover:rotate-0 transition-all duration-500">
                   {mode === 'department' ? <Building2 className="w-12 h-12 text-gray-200" /> : <Users className="w-12 h-12 text-gray-200" />}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">សូមជ្រើសរើស{mode === 'department' ? 'ផ្នែក' : 'បុគ្គលិក'}</h3>
                <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed italic">
                  ជ្រើសរើសពីបញ្ជីខាងឆ្វេង ដើម្បីចាប់ផ្ដើមកំណត់ម៉ោងអូតូដំបូង។
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar-thin::-webkit-scrollbar { width:3px; }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb { background: #f3f4f6; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default GroupTimetablesPage;
