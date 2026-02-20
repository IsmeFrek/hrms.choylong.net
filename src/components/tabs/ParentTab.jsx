
import React from 'react';
import DateInput from '../DateInput';

export default function ParentTab({ editHR, setEditHR }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* ជួឪពុក */}
      <div>
        <label className="block mb-1 font-medium text-base text-blue-600">ឈ្មោះឪពុក</label>
        <input
          value={editHR.fatherName || ''}
          onChange={e => setEditHR({ ...editHR, fatherName: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="ឈ្មោះឪពុក"
        />
        <label className="block mb-1 font-medium text-base text-blue-600 mt-4">ថ្ងៃខែឆ្នាំកំណើតឪពុក</label>
        <DateInput
          value={editHR.fatherDob || ''}
          onChange={v => setEditHR({ ...editHR, fatherDob: v })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
        />
        <label className="block mb-1 font-medium text-base text-blue-600 mt-4">មុខរបរ ឪពុក</label>
        <input
          value={editHR.fatherOccupation || ''}
          onChange={e => setEditHR({ ...editHR, fatherOccupation: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="មុខរបរ"
        />
        <label className="block mb-1 font-medium text-base text-blue-600 mt-4">លេខទូរស័ព្ទ ឪពុក</label>
        <input
          value={editHR.fatherPhone || ''}
          onChange={e => setEditHR({ ...editHR, fatherPhone: e.target.value })}
          onBlur={async e => {
            if (editHR && editHR._id) {
              try {
                await (await import('../../services/api')).default.put(`/hr/${editHR._id}`, { fatherPhone: e.target.value });
              } catch (err) {
                console.error('Save fatherPhone failed', err?.response?.data || err);
              }
            }
          }}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="លេខទូរស័ព្ទ"
          inputMode="tel"
        />
        <label className="block mb-1 font-medium text-base text-blue-600 mt-4">ផ្សេងៗ</label>
        <textarea
          value={editHR.fatherNote || ''}
          onChange={e => setEditHR({ ...editHR, fatherNote: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          rows={2}
          placeholder="មតិឪពុក..."
        />
      </div>
      {/* ជួម្ដាយ */}
      <div>
        <label className="block mb-1 font-medium text-base text-blue-600">ឈ្មោះម្ដាយ</label>
        <input
          value={editHR.motherName || ''}
          onChange={e => setEditHR({ ...editHR, motherName: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="ឈ្មោះម្ដាយ"
        />
        <label className="block mb-1 font-medium text-base text-blue-600 mt-4">ថ្ងៃខែឆ្នាំកំណើតម្ដាយ</label>
        <DateInput
          value={editHR.motherDob || ''}
          onChange={v => setEditHR({ ...editHR, motherDob: v })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
        />
        <label className="block mb-1 font-medium text-base text-blue-600 mt-4">មុខរបរ ម្តាយ</label>
        <input
          value={editHR.motherOccupation || ''}
          onChange={e => setEditHR({ ...editHR, motherOccupation: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="មុខរបរ"
        />
        <label className="block mb-1 font-medium text-base text-blue-600 mt-4">លេខទូរស័ព្ទ ម្តាយ</label>
        <input
          value={editHR.motherPhone || ''}
          onChange={e => setEditHR({ ...editHR, motherPhone: e.target.value })}
          onBlur={async e => {
            if (editHR && editHR._id) {
              try {
                await (await import('../../services/api')).default.put(`/hr/${editHR._id}`, { motherPhone: e.target.value });
              } catch (err) {
                console.error('Save motherPhone failed', err?.response?.data || err);
              }
            }
          }}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="លេខទូរស័ព្ទ"
          inputMode="tel"
        />
        <label className="block mb-1 font-medium text-base text-blue-600 mt-4">ផ្សេងៗ</label>
        <textarea
          value={editHR.motherNote || ''}
          onChange={e => setEditHR({ ...editHR, motherNote: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          rows={2}
          placeholder="មតិម្ដាយ..."
        />
      </div>
    </div>
  );
}

// Removed legacy date helpers; DateInput handles display and parsing
