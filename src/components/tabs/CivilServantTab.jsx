import React, { useEffect, useState } from 'react';
import DateInput from '../DateInput';
import { departmentAPI } from '../../services/departmentAPI';

export default function CivilServantTab({
  editHR,
  setEditHR,
  hideMinistryDates = false,
  hideExtraOptions = false,
} = {}) {
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await departmentAPI.getDepartments();
        const data = res?.data ?? res;
        if (!mounted) return;
        // if API returns array of strings or objects with name
        if (Array.isArray(data)) {
          setDepartments(data.map(d => (typeof d === 'string' ? d : (d.name || d.Department_Kh || d.Department || ''))).filter(Boolean));
        } else {
          setDepartments([]);
        }
      } catch (e) {
        setDepartments([]);
      }
    })();
    return () => { mounted = false; };
  }, []);
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* អត្តលេខមន្ត្រីរាជការ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">អត្តលេខមន្ត្រីរាជការ</label>
        <input
          value={editHR.civilServantId || ''}
          onChange={e => setEditHR({ ...editHR, civilServantId: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="អត្តលេខ"
        />
      </div>

      {/* មុខងារក្រសួង */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">មុខងារក្រសួង</label>
        <input
          value={editHR.civilServantRole || ''}
          onChange={e => setEditHR({ ...editHR, civilServantRole: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="មុខងារ"
        />
      </div>

      {/* កាំប្រាក់ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">កាំប្រាក់</label>
        <select
          value={editHR.salaryLevel || ''}
          onChange={e => setEditHR({ ...editHR, salaryLevel: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
        >
          <option value="">-- ជ្រើសរើស --</option>
          <optgroup label="ក.១">
            <option value="ក.១.១">ក.១.១</option>
            <option value="ក.១.២">ក.១.២</option>
            <option value="ក.១.៣">ក.១.៣</option>
            <option value="ក.១.៤">ក.១.៤</option>
            <option value="ក.១.៥">ក.១.៥</option>
            <option value="ក.១.៦">ក.១.៦</option>
          </optgroup>
          <optgroup label="ក.២">
            <option value="ក.២.១">ក.២.១</option>
            <option value="ក.២.២">ក.២.២</option>
            <option value="ក.២.៣">ក.២.៣</option>
            <option value="ក.២.៤">ក.២.៤</option>
          </optgroup>
          <optgroup label="ក.៣">
            <option value="ក.៣.១">ក.៣.១</option>
            <option value="ក.៣.២">ក.៣.២</option>
            <option value="ក.៣.៣">ក.៣.៣</option>
            <option value="ក.៣.៤">ក.៣.៤</option>
          </optgroup>
          <optgroup label="ខ.១">
            <option value="ខ.១.១">ខ.១.១</option>
            <option value="ខ.១.២">ខ.១.២</option>
            <option value="ខ.១.៣">ខ.១.៣</option>
            <option value="ខ.១.៤">ខ.១.៤</option>
            <option value="ខ.១.៥">ខ.១.៥</option>
            <option value="ខ.១.៦">ខ.១.៦</option>
          </optgroup>
          <optgroup label="ខ.២">
            <option value="ខ.២.១">ខ.២.១</option>
            <option value="ខ.២.២">ខ.២.២</option>
            <option value="ខ.២.៣">ខ.២.៣</option>
            <option value="ខ.២.៤">ខ.២.៤</option>
          </optgroup>
          <optgroup label="ខ.៣">
            <option value="ខ.៣.១">ខ.៣.១</option>
            <option value="ខ.៣.២">ខ.៣.២</option>
            <option value="ខ.៣.៣">ខ.៣.៣</option>
            <option value="ខ.៣.៤">ខ.៣.៤</option>
          </optgroup>
          <optgroup label="គ">
            <option value="គ.១">គ.១</option>
            <option value="គ.២">គ.២</option>
            <option value="គ.៣">គ.៣</option>
            <option value="គ.៤">គ.៤</option>
            <option value="គ.៥">គ.៥</option>
            <option value="គ.៦">គ.៦</option>
            <option value="គ.៧">គ.៧</option>
            <option value="គ.៨">គ.៨</option>
            <option value="គ.៩">គ.៩</option>
            <option value="គ.១០">គ.១០</option>
          </optgroup>
        </select>
      </div>

      {/* ថ្ងៃចូលក្របខ័ណ្ឌ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ថ្ងៃចូលក្របខ័ណ្ឌ</label>
        <DateInput
          value={editHR.civilServantStartDate || ''}
          onChange={v => setEditHR({ ...editHR, civilServantStartDate: v })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
        />
      </div>

      {/* ថ្ងៃតាំងស៊ប់ (ទំរង់ដូចថ្ងៃចូលក្របខ័ណ្ឌ) */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ថ្ងៃតាំងស៊ប់</label>
        <DateInput
          value={editHR.nominationStartDate || ''}
          onChange={v => setEditHR({ ...editHR, nominationStartDate: v })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
        />
      </div>

      {/* ថ្ងៃចូលកាន់តំណែងពីក្រសួង */}
      {!hideMinistryDates && (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">ថ្ងៃចូលកាន់តំណែងពីក្រសួង</label>
          <DateInput
            value={editHR.dateJoinedMinistry || ''}
            onChange={v => setEditHR({ ...editHR, dateJoinedMinistry: v })}
            className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          />
        </div>
      )}

      {/* ថ្ងៃបញ្ចប់តំណែងពីក្រសួង */}
      {!hideMinistryDates && (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">ថ្ងៃបញ្ចប់តំណែងពីក្រសួង</label>
          <DateInput
            value={editHR.lastSalaryIncrementDate || ''}
            onChange={v => setEditHR({ ...editHR, lastSalaryIncrementDate: v })}
            className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          />
        </div>
      )}

      {/* ថ្ងៃខែឆ្នាំឡើងកាំប្រាក់ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ថ្ងៃខែឆ្នាំឡើងកាំប្រាក់</label>
        <DateInput
          value={editHR.salaryPromotionDate || ''}
          onChange={v => setEditHR({ ...editHR, salaryPromotionDate: v })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
        />
      </div>
      {/* promotion type field removed per request */}

      {/* ប្រភេទមេដៃ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ប្រភេទមេដៃ</label>
        <input
          value={editHR.medalType || ''}
          onChange={e => setEditHR({ ...editHR, medalType: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          placeholder="ប្រភេទមេដៃ"
        />
      </div>

      {/* ថ្ងៃខែឆ្នាំទទួលមេដៃ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ថ្ងៃខែឆ្នាំទទួលមេដៃ</label>
        <DateInput
          value={editHR.medalReceivedDate || ''}
          onChange={v => setEditHR({ ...editHR, medalReceivedDate: v })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
        />
      </div>

      
      {/* មូលហេតុ */}
      <div className="col-span-2">
        <label className="block mb-1 font-medium text-lg text-blue-600">មូលហេតុ</label>
        <textarea
          value={editHR.civilServantReason || ''}
          onChange={e => setEditHR({ ...editHR, civilServantReason: e.target.value })}
          className="border border-gray-300 text-gray-900 text-base px-3 py-2 rounded-md w-full"
          rows={2}
          placeholder="មូលហេតុបម្រើ/បញ្ចប់..."
        />
      </div>

      {/* Retirement exceptions */}
      {!hideExtraOptions && (
        <div className="col-span-2">
          <label className="block mb-2 font-medium text-lg text-blue-600">ជម្រើសបន្ថែម</label>

          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!editHR.isRetiredThenContract}
              onChange={(e) => setEditHR({ ...editHR, isRetiredThenContract: e.target.checked })}
            />
            <span className="text-base text-gray-900">ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!editHR.isPartTime}
              onChange={(e) => setEditHR({ ...editHR, isPartTime: e.target.checked })}
            />
            <span className="text-base text-gray-900">កិច្ចសន្យាក្រៅម៉ោង</span>
          </label>

          <div className="text-sm text-gray-600 mt-2">
            * បើមិនធីកជម្រើសទាំងនេះ ហើយមន្ត្រីរាជការ​មានអាយុគ្រប់ {60} ឆ្នាំ ប្រព័ន្ធនឹងដាក់ស្ថានភាពជា Resigned (ចូលនិវត្តន៍) ស្វ័យប្រវត្តិ។
          </div>
        </div>
      )}
    </div>
  );
}
