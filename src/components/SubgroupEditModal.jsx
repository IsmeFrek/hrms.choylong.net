import React, { useState, useEffect } from 'react';

const SubgroupEditModal = ({ isOpen, onClose, subgroup, onSave, categories = [] }) => {
  const [mode, setMode] = useState('standard'); // 'standard' or 'flexible'
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Standard mode state
  const [standardConfig, setStandardConfig] = useState({
    start: '08:00',
    end: '17:00',
    halfDay: false,
    days: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    }
  });

  // Flexible mode state
  const [flexibleConfig, setFlexibleConfig] = useState({
    monday: { work: true, halfDay: false, start: '08:00', end: '17:00' },
    tuesday: { work: true, halfDay: false, start: '08:00', end: '17:00' },
    wednesday: { work: true, halfDay: false, start: '08:00', end: '17:00' },
    thursday: { work: true, halfDay: false, start: '08:00', end: '17:00' },
    friday: { work: true, halfDay: false, start: '08:00', end: '17:00' },
    saturday: { work: false, halfDay: false, start: '08:00', end: '17:00' },
    sunday: { work: false, halfDay: false, start: '08:00', end: '17:00' },
  });

  useEffect(() => {
    if (isOpen && subgroup) {
      setSelectedCategory(subgroup.categoryId || '');
      if (subgroup.customPattern) {
        setMode(subgroup.customPattern.mode || 'standard');
        if (subgroup.customPattern.mode === 'flexible') {
          setFlexibleConfig(subgroup.customPattern.flexible || flexibleConfig);
        } else {
          setStandardConfig(subgroup.customPattern.standard || standardConfig);
        }
      }
    }
  }, [isOpen, subgroup]);

  if (!isOpen) return null;

  const daysList = [
    { key: 'monday', label: 'Monday', kh: 'ថ្ងៃច័ន្ទ' },
    { key: 'tuesday', label: 'Tuesday', kh: 'ថ្ងៃអង្គារ' },
    { key: 'wednesday', label: 'Wednesday', kh: 'ថ្ងៃពុធ' },
    { key: 'thursday', label: 'Thursday', kh: 'ថ្ងៃព្រហស្បតិ៍' },
    { key: 'friday', label: 'Friday', kh: 'ថ្ងៃសុក្រ' },
    { key: 'saturday', label: 'Saturday', kh: 'ថ្ងៃសៅរ៍' },
    { key: 'sunday', label: 'Sunday', kh: 'ថ្ងៃអាទិត្យ' },
  ];

  const handleSave = () => {
    const pattern = {
      mode,
      standard: standardConfig,
      flexible: flexibleConfig,
    };
    onSave(subgroup.id || subgroup._id, pattern);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </span>
            Edit Group: <span className="text-blue-600">{subgroup?.name}</span>
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          {/* Service Selector */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Service</label>
            <select 
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">Select an option</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.label || `Category ${c.id}`}</option>
              ))}
            </select>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-6 pb-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="radio" 
                className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 transition-all cursor-pointer"
                checked={mode === 'flexible'}
                onChange={() => setMode('flexible')}
              />
              <span className={`text-sm font-bold transition-colors ${mode === 'flexible' ? 'text-gray-900Scale' : 'text-gray-400 group-hover:text-gray-600'}`}>Flexible</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="radio" 
                className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 transition-all cursor-pointer"
                checked={mode === 'standard'}
                onChange={() => setMode('standard')}
              />
              <span className={`text-sm font-bold transition-colors ${mode === 'standard' ? 'text-gray-900Scale' : 'text-gray-400 group-hover:text-gray-600'}`}>Standard</span>
            </label>
          </div>

          <div className="border-t pt-8">
            {mode === 'standard' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Time Setting Card */}
                <div className="bg-white border rounded-xl p-6 shadow-sm relative hover:shadow-md transition-shadow group">
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="std-halfday"
                      checked={standardConfig.halfDay}
                      onChange={e => setStandardConfig(prev => ({ ...prev, halfDay: e.target.checked }))}
                      className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                    />
                    <label htmlFor="std-halfday" className="text-xs font-bold text-gray-600 cursor-pointer">Half Day</label>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mt-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Start Time <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input 
                          type="time" 
                          value={standardConfig.start}
                          onChange={e => setStandardConfig(prev => ({ ...prev, start: e.target.value }))}
                          className="w-full p-3 pl-4 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">End Time</label>
                      <div className="relative">
                        <input 
                          type="time" 
                          value={standardConfig.end}
                          onChange={e => setStandardConfig(prev => ({ ...prev, end: e.target.value }))}
                          className="w-full p-3 pl-4 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Days Selection List */}
                <div className="space-y-3">
                  {daysList.map(day => (
                    <label key={day.key} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100 group">
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${standardConfig.days[day.key] ? 'bg-green-600 border-green-600 shadow-sm' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={standardConfig.days[day.key]}
                          onChange={() => setStandardConfig(prev => ({ 
                            ...prev, 
                            days: { ...prev.days, [day.key]: !prev.days[day.key] } 
                          }))}
                        />
                        {standardConfig.days[day.key] && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                        )}
                      </div>
                      <span className={`text-sm font-bold transition-colors ${standardConfig.days[day.key] ? 'text-gray-900' : 'text-gray-600'} ${day.key === 'sunday' ? 'text-red-500' : ''}`}>
                        {day.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {daysList.map(day => (
                  <div key={day.key} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${day.key === 'sunday' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                        <h4 className={`text-sm font-bold ${day.key === 'sunday' ? 'text-red-600' : 'text-gray-800'}`}>{day.label}</h4>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={flexibleConfig[day.key].halfDay}
                            onChange={() => setFlexibleConfig(prev => ({
                              ...prev,
                              [day.key]: { ...prev[day.key], halfDay: !prev[day.key].halfDay }
                            }))}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300"
                          />
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Half Day</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={flexibleConfig[day.key].work}
                            onChange={() => setFlexibleConfig(prev => ({
                              ...prev,
                              [day.key]: { ...prev[day.key], work: !prev[day.key].work }
                            }))}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300"
                          />
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Work</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 opacity-90">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Start <span className="text-red-400">*</span></label>
                        <input 
                          type="time" 
                          value={flexibleConfig[day.key].start}
                          onChange={e => setFlexibleConfig(prev => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], start: e.target.value }
                          }))}
                          disabled={!flexibleConfig[day.key].work}
                          className="w-full p-2 border border-gray-100 rounded bg-gray-50 text-sm font-medium focus:bg-white transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">End <span className="text-red-400">*</span></label>
                        <input 
                          type="time" 
                          value={flexibleConfig[day.key].end}
                          onChange={e => setFlexibleConfig(prev => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], end: e.target.value }
                          }))}
                          disabled={!flexibleConfig[day.key].work}
                          className="w-full p-2 border border-gray-100 rounded bg-gray-50 text-sm font-medium focus:bg-white transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 px-6">
          <button 
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-white hover:text-gray-800 transition-all shadow-sm"
          >
            × Close
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-md active:transform active:scale-95 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubgroupEditModal;
