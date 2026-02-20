import React, { useState } from 'react';
import DateInput from '../DateInput';

const salaryGroups = {
  'ក': [
    { label: 'ក.១', options: ['ក.១', 'ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.៥', 'ក.១.៦'] },
    { label: 'ក.២', options: ['ក.២', 'ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤'] },
    { label: 'ក.៣', options: ['ក.៣', 'ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤'] },
  ],
  'ខ': [
    { label: 'ខ.១', options: ['ខ.១', 'ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦'] },
    { label: 'ខ.២', options: ['ខ.២', 'ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤'] },
    { label: 'ខ.៣', options: ['ខ.៣', 'ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤'] },
  ],
  'គ': [
    { label: 'គ', options: ['គ', 'គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០'] },
  ],
};

export default function WorkTab({
  data,
  setData,
  positions,
  skills,
  departments,
  inputTextClass = 'text-lg',
  degreeLevelOptions = null,
  educationLevelOptions = null,
  hideRetiredThenContract = false,
  hidePartTime = false,
  hideDateJoinedMinistry = false,
  hideLastSalaryIncrementDate = false,
  hideMentorFields = false,
  requiredFields = [],
}) {
  const [salaryMainGroup, setSalaryMainGroup] = useState('');
  const [salarySubGroup, setSalarySubGroup] = useState('');

  // Get subgroups for selected main group
  const subGroups = salaryMainGroup ? salaryGroups[salaryMainGroup] : [];
  // Get options for selected subgroup
  const options = subGroups.find(g => g.label === salarySubGroup)?.options || [];

  const required = Array.isArray(requiredFields) ? requiredFields : [];
  const isMissing = (key) => {
    if (!required.includes(key)) return false;
    const v = data?.[key];
    return v == null || String(v).trim() === '';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">
          ប្រភេទមន្ត្រី{required.includes('officerType') ? <span className="text-red-600">*</span> : null}
        </label>
        <select
          value={data.officerType}
          onChange={e => setData({ ...data, officerType: e.target.value })}
          className={`border-2 ${isMissing('officerType') ? 'border-red-500' : 'border-purple-300'} text-gray-900 ${inputTextClass} px-3 py-2 mb-2 w-full rounded-md`}
        >
          <option value="">-- ជ្រើសរើស --</option>
          <option value="មន្ត្រីរាជការ">មន្ត្រីរាជការ</option>
          <option value="កិច្ចសន្យារដ្ឋ">កិច្ចសន្យារដ្ឋ</option>
          <option value="កិច្ចសន្យាមន្ទីរពេទ្យ">កិច្ចសន្យាមន្ទីរពេទ្យ</option>
        
          <option value="កម្មករកិច្ចសន្យា">កម្មករកិច្ចសន្យា</option>
  </select>
      </div>
      {(!hideRetiredThenContract || !hidePartTime) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!hideRetiredThenContract && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="isRetiredThenContract" type="checkbox" checked={!!data.isRetiredThenContract} onChange={e => setData({ ...data, isRetiredThenContract: e.target.checked })} />
              <label htmlFor="isRetiredThenContract" style={{ fontSize: 14, fontWeight: 600 }}>ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)</label>
            </div>
          )}
          {!hidePartTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="isPartTime" type="checkbox" checked={!!data.isPartTime} onChange={e => setData({ ...data, isPartTime: e.target.checked })} />
              <label htmlFor="isPartTime" style={{ fontSize: 14, fontWeight: 600 }}>កិច្ចសន្យាក្រៅម៉ោង</label>
            </div>
          )}
        </div>
      )}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">តួនាទី</label>
        <select
          value={data.position}
          onChange={e => setData({ ...data, position: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
        >
          <option value="">-- ជ្រើសរើស --</option>
          {(positions && Array.isArray(positions) && positions.length > 0)
            ? positions.map(pos => {
                const label = pos.Position_Kh ?? pos.positions_Kh ?? pos.Position_En ?? '';
                return (
                  <option key={pos._id || label} value={label}>
                    {label}
                  </option>
                );
              })
            : <option disabled>មិនមានទិន្នន័យតួនាទី</option>
          }
        </select>
      </div>
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">កាលបរិច្ឆេទចូលបម្រើការងារ</label>
        <DateInput value={data.joinDate} onChange={v => setData({ ...data, joinDate: v })} className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`} />
      </div>
      {!hideDateJoinedMinistry && (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">កាលបរិច្ឆេទចូលកាន់តំណែងមន្ទីរ</label>
          <DateInput value={data.dateJoinedMinistry} onChange={v => setData({ ...data, dateJoinedMinistry: v })} className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`} />
        </div>
      )}
      {!hideLastSalaryIncrementDate && (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">កាលបរិច្ឆេទបញ្ចប់តំណែងមន្ទីរពេទ្យ</label>
          <DateInput value={data.lastSalaryIncrementDate} onChange={v => setData({ ...data, lastSalaryIncrementDate: v })} className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`} />
        </div>
      )}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">កម្រិតសញ្ញាប័ត្រ</label>
        {(Array.isArray(degreeLevelOptions) && degreeLevelOptions.length > 0) ? (
          <select
            value={data.degreeLevel || ''}
            onChange={e => setData({ ...data, degreeLevel: e.target.value })}
            className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          >
            <option value="">-- ជ្រើសរើស --</option>
            {!!data.degreeLevel && !degreeLevelOptions.includes(data.degreeLevel) && (
              <option value={data.degreeLevel}>{data.degreeLevel}</option>
            )}
            {degreeLevelOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            value={data.degreeLevel}
            onChange={e => setData({ ...data, degreeLevel: e.target.value })}
            className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          />
        )}
      </div>
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">សញ្ញាប័ត្រ</label>
        <input value={data.degree} onChange={e => setData({ ...data, degree: e.target.value })} className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`} />
      </div>
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ជំនាញ</label>
        <select
          value={data.skill}
          onChange={e => setData({ ...data, skill: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
        >
          <option value="">-- ជ្រើសរើស --</option>
          {(skills && Array.isArray(skills) && skills.length > 0)
            ? skills.map(skill => (
                <option key={skill._id || skill.skills_Kh} value={skill.skills_Kh}>
                  {skill.skills_Kh}
                </option>
              ))
            : <option disabled>មិនមានទិន្នន័យជំនាញ</option>
          }
        </select>
      </div>
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ផ្នែក</label>
        <select
          value={data.Department_Kh}
          onChange={e => setData({ ...data, Department_Kh: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
        >
          <option value="">-- ជ្រើសរើស --</option>
          {(departments && Array.isArray(departments) && departments.length > 0)
            ? departments.map(dep => (
                <option key={dep._id || dep.Department_Kh} value={dep.Department_Kh}>
                  {dep.Department_Kh}
                </option>
              ))
            : <option disabled>មិនមានទិន្នន័យផ្នែក</option>
          }
        </select>
      </div>
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">កម្រិតវប្បធម៌</label>
        {(Array.isArray(educationLevelOptions) && educationLevelOptions.length > 0) ? (
          <select
            value={data.educationLevel || ''}
            onChange={e => setData({ ...data, educationLevel: e.target.value })}
            className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          >
            <option value="">-- ជ្រើសរើស --</option>
            {!!data.educationLevel && !educationLevelOptions.includes(data.educationLevel) && (
              <option value={data.educationLevel}>{data.educationLevel}</option>
            )}
            {educationLevelOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            value={data.educationLevel}
            onChange={e => setData({ ...data, educationLevel: e.target.value })}
            className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          />
        )}
      </div>
      {!hideMentorFields && (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះអ្នកណែនាំ</label>
          <input value={data.mentorName} onChange={e => setData({ ...data, mentorName: e.target.value })} className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`} />
        </div>
      )}
      {!hideMentorFields && (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">ថ្ងៃណែនាំ</label>
          <DateInput value={data.mentorDate} onChange={v => setData({ ...data, mentorDate: v })} className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`} />
        </div>
      )}
    </div>
  );
}
