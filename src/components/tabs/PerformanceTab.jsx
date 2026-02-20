
import React, { useEffect } from 'react';

export default function PerformanceTab({ editHR, setEditHR }) {
  // Compute totalScore whenever individual scores change
  useEffect(() => {
    const c = Number(editHR.creativityScore) || 0;
    const r = Number(editHR.responsibilityScore) || 0;
    const p = Number(editHR.patriotismScore) || 0;
    const l = Number(editHR.leadershipScore) || 0;
    const e = Number(editHR.ethicsScore) || 0;
    const total = c + r + p + l + e;
    if (editHR.totalScore !== total) {
      setEditHR({ ...editHR, totalScore: total });
    }
  }, [editHR.creativityScore, editHR.responsibilityScore, editHR.patriotismScore, editHR.leadershipScore, editHR.ethicsScore]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ការវាយតម្លៃសមត្ថភាព */}
      <div className="col-span-1">
        <label className="block mb-1 font-medium text-lg text-blue-600">ការវាយតម្លៃសមត្ថភាព</label>
        <textarea
          value={editHR.reason1 || ''}
          onChange={e => setEditHR({ ...editHR, reason1: e.target.value, performanceComment: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          rows={4}
          placeholder="សូមបញ្ចូលការវាយតម្លៃសមត្ថភាព..."
        />
      </div>
      {/* ការវាយតម្លៃចំនួន */}
      <div className="col-span-1 grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">កំណត់សមត្ថភាពការងារ</label>
          <input
            type="number"
            value={editHR.creativityScore ?? ''}
            onChange={e => {
              const v = e.target.value; const val = v === '' ? '' : Number(v);
              setEditHR({ ...editHR, creativityScore: val, performanceAbility: val });
            }}
            className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">ការទទួលខុសត្រូវ</label>
          <input
            type="number"
            value={editHR.responsibilityScore ?? ''}
            onChange={e => {
              const v = e.target.value; const val = v === '' ? '' : Number(v);
              setEditHR({ ...editHR, responsibilityScore: val, performanceResponsibility: val });
            }}
            className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">សមត្ថភាពសហការងារ</label>
          <input
            type="number"
            value={editHR.patriotismScore ?? ''}
            onChange={e => {
              const v = e.target.value; const val = v === '' ? '' : Number(v);
              setEditHR({ ...editHR, patriotismScore: val, performanceCooperation: val });
            }}
            className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">សមត្ថភាពដឹកនាំ</label>
          <input
            type="number"
            value={editHR.leadershipScore ?? ''}
            onChange={e => {
              const v = e.target.value; const val = v === '' ? '' : Number(v);
              setEditHR({ ...editHR, leadershipScore: val, performanceLeadership: val });
            }}
            className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">សមត្ថភាពបញ្ចប់</label>
          <input
            type="number"
            value={editHR.ethicsScore ?? ''}
            onChange={e => {
              const v = e.target.value; const val = v === '' ? '' : Number(v);
              setEditHR({ ...editHR, ethicsScore: val, performanceCompletion: val });
            }}
            className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
            placeholder="0"
          />
        </div>
      </div>
      {/* show computed total score for user */}
      <div className="col-span-1 md:col-span-2">
        <label className="block mb-1 font-medium text-lg text-blue-600">ពិន្ទុសរុប</label>
        <input type="number" readOnly value={editHR.totalScore ?? 0} className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-40" />
      </div>
    </div>
  );
}
