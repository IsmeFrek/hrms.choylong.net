
import React, { useState } from 'react';
import DateInput from '../DateInput';

export default function UnionTab({ editHR, setEditHR }) {
  const [unionPhoneError, setUnionPhoneError] = useState('');

  const validatePhone = (val) => {
    if (!val || String(val).trim() === '') return '';
    // Allow optional + and 7-15 digits, no other characters
    const phoneRegex = /^\+?\d{7,15}$/;
    return phoneRegex.test(String(val).replace(/\s|-/g, '')) ? '' : 'លេខទូរស័ព្ទមិនត្រឹមត្រូវ (7–15 លេខ, អាចចាប់ផ្តើមដោយ +)';
  };
  return (
  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      {/* ឈ្មោះសហព័ន្ធ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ឈ្មោះសហព័ន្ធ</label>
        <input
          value={editHR.unionName || ''}
          onChange={e => setEditHR({ ...editHR, unionName: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="ឈ្មោះសហព័ន្ធ"
        />
      </div>
      {/* លេខអត្តសញ្ញាណ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">លេខអត្តសញ្ញាណ</label>
        <input
          value={editHR.unionMemberId || ''}
          onChange={e => setEditHR({ ...editHR, unionMemberId: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="លេខអត្តសញ្ញាណ"
        />
      </div>
      {/* ថ្ងៃចូលសហព័ន្ធ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ថ្ងៃចូលសហព័ន្ធ</label>
        <DateInput
          value={editHR.unionJoinDate || ''}
          onChange={(dmy) => setEditHR({ ...editHR, unionJoinDate: dmy })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
        />
      </div>
      {/* មុខងារ/តួនាទីក្នុងសហព័ន្ធ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">មុខងារ/តួនាទីក្នុងសហព័ន្ធ</label>
        <input
          value={editHR.unionRole || ''}
          onChange={e => setEditHR({ ...editHR, unionRole: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="មុខងារ/តួនាទី"
        />
      </div>
      {/* លេខទូរស័ព្ទ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">លេខទូរស័ព្ទ</label>
        <input
          value={editHR.unionPhone || ''}
          onChange={e => {
            const v = e.target.value;
            setEditHR({ ...editHR, unionPhone: v });
            const err = validatePhone(v);
            setUnionPhoneError(err);
          }}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="លេខទូរស័ព្ទ"
        />
        {unionPhoneError && <div className="text-red-600 text-sm mt-1">{unionPhoneError}</div>}
      </div>
      {/* កំណត់សម្គាល់ */}
  <div className="col-span-1 md:col-span-5">
        <label className="block mb-1 font-medium text-lg text-blue-600">កំណត់សម្គាល់</label>
        <textarea
          value={editHR.unionNote || ''}
          onChange={e => setEditHR({ ...editHR, unionNote: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          rows={2}
          placeholder="កំណត់សម្គាល់..."
        />
      </div>
    </div>
  );
}
 
