
import React from 'react';

export default function OtherTab({ editHR, setEditHR }) {
  return (
    <div>
      <div className="font-bold text-blue-700">ព័ត៌មានផ្សេងៗ</div>
      <div className="mt-3">
        <label className="block mb-1 font-medium text-base text-blue-600">កំណត់សម្គាល់ / ផ្សេងៗ</label>
        <textarea
          value={editHR.other || ''}
          onChange={(e) => setEditHR({ ...editHR, other: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          rows={5}
          placeholder="បញ្ចូលព័ត៌មានផ្សេងៗ..."
        />
      </div>
    </div>
  );
}
