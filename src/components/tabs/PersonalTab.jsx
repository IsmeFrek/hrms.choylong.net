
import React from 'react';
import API_BASE from '../../config';
import DateInput from '../DateInput';
import { formatPhoneDisplay as formatPhoneUtil } from '../../utils/formatPhone';

export default function PersonalTab({
  data,
  setData,
  isRequiredInvalid,
  noOptions = [],
  takenNos = [],
  hideNo = false,
  hideStaffId = false,
  splitBirthPlace = false,
  splitCurrentPlace = false,
  inputTextClass = 'text-lg',
}) {
  // Today in dd/mm/yyyy for max DOB
  const today = (() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  })();

  // Use shared phone format util
  const formatPhoneDisplay = formatPhoneUtil;

  function handlePhoneChange(e) {
    const v = e.target.value || '';
    let digits = v.replace(/\D/g, '');
    // If user typed 8 digits, assume missing leading zero
    if (digits.length === 8) digits = '0' + digits;
    // allow up to 12 digits
    digits = digits.slice(0, 12);
    setData({ ...data, phone: digits ? digits : '' });
  }

  // NID: allow 9-digit main number (may start with 0) and optional suffix in parentheses
  function formatNidDisplay(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    // If already contains parentheses, keep suffix
    const m = s.match(/^(\D*?)(\d{1,9})(?:\((\d{1,4})\))?$/);
    // fallback: extract digits and optional suffix
    const digits = s.replace(/[^0-9]/g, '').slice(0,9);
    const suffixMatch = s.match(/\((\d{1,4})\)/);
    if (digits === '') return '';
    return suffixMatch ? `${digits}(${suffixMatch[1]})` : digits;
  }

  function handleNidChange(e) {
    const v = e.target.value || '';
    // allow digits and an optional '(xx)'
    const main = v.replace(/[^0-9]/g, '').slice(0,9);
    const suffixMatch = v.match(/\((\d{1,4})\)/);
    const newVal = suffixMatch ? `${main}(${suffixMatch[1]})` : main;
    setData({ ...data, nid: newVal });
  }

  const updatePlaceParts = (key, nextParts) => {
    const safe = nextParts && typeof nextParts === 'object' ? nextParts : {};
    const curr = data?.[key] && typeof data[key] === 'object' ? data[key] : {};
    setData({
      ...data,
      [key]: {
        houseNo: safe.houseNo ?? curr.houseNo ?? '',
        road: safe.road ?? curr.road ?? '',
        village: safe.village ?? curr.village ?? '',
        commune: safe.commune ?? curr.commune ?? '',
        district: safe.district ?? curr.district ?? '',
        province: safe.province ?? curr.province ?? '',
      },
    });
  };

  const PlacePartsGrid = ({ title, valueKey }) => {
    const parts = (data?.[valueKey] && typeof data[valueKey] === 'object') ? data[valueKey] : {};
    return (
      <div className="md:col-span-4">
        <div className="font-medium text-lg text-blue-600 mb-2">{title}</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block mb-1 font-medium text-sm text-gray-700">ផ្ទះលេខ</label>
            <input
              value={parts.houseNo || ''}
              onChange={(e) => updatePlaceParts(valueKey, { ...parts, houseNo: e.target.value })}
              className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 w-full rounded-md`}
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-sm text-gray-700">ផ្លូវ</label>
            <input
              value={parts.road || ''}
              onChange={(e) => updatePlaceParts(valueKey, { ...parts, road: e.target.value })}
              className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 w-full rounded-md`}
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-sm text-gray-700">ភូមិ</label>
            <input
              value={parts.village || ''}
              onChange={(e) => updatePlaceParts(valueKey, { ...parts, village: e.target.value })}
              className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 w-full rounded-md`}
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-sm text-gray-700">ឃុំ/សង្កាត់</label>
            <input
              value={parts.commune || ''}
              onChange={(e) => updatePlaceParts(valueKey, { ...parts, commune: e.target.value })}
              className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 w-full rounded-md`}
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-sm text-gray-700">ស្រុក/ខណ្ឌ</label>
            <input
              value={parts.district || ''}
              onChange={(e) => updatePlaceParts(valueKey, { ...parts, district: e.target.value })}
              className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 w-full rounded-md`}
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-sm text-gray-700">ខេត្ត/ក្រុង</label>
            <input
              value={parts.province || ''}
              onChange={(e) => updatePlaceParts(valueKey, { ...parts, province: e.target.value })}
              className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 w-full rounded-md`}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* ល.រ */}
      {!hideNo && (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">ល.រ</label>
          <input
            type="number"
            inputMode="numeric"
            list="noOptionsList"
            value={data.no ?? ''}
            onChange={e => {
              const v = e.target.value;
              const num = v === '' ? '' : parseInt(v, 10);
              setData({ ...data, no: Number.isFinite(num) ? num : '' });
            }}
            className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-1 w-full rounded-md`}
            placeholder="ជ្រើសឬវាយលេខ"
          />
          <datalist id="noOptionsList">
            {(Array.isArray(noOptions) ? noOptions : []).map(n => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="text-xs text-gray-500">បន្ថែមថ្មី សូមជ្រើសលេខទំនេរ</div>
        </div>
      )}
      {/* លេខកាត* */}
      {!hideStaffId && (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">
            លេខកាត{isRequiredInvalid(data, 'staffId') && <span className="text-red-600">*</span>}
          </label>
          <input
            value={data.staffId}
            onChange={e => setData({ ...data, staffId: e.target.value })}
            className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md ${isRequiredInvalid(data, 'staffId') ? 'border-red-500' : ''}`}
          />
        </div>
      )}
      {/* គោត្តនាម និងមាន* */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">
          គោត្តនាម និងមាន{isRequiredInvalid(data, 'khmerName') && <span className="text-red-600">*</span>}
        </label>
        <input
          value={data.khmerName}
          onChange={e => setData({ ...data, khmerName: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md ${isRequiredInvalid(data, 'khmerName') ? 'border-red-500' : ''}`}
        />
      </div>
      {/* ឡាតាំង* */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">
          ឡាតាំង{isRequiredInvalid(data, 'name') && <span className="text-red-600">*</span>}
        </label>
        <input
          value={data.name}
          onChange={e => setData({ ...data, name: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md ${isRequiredInvalid(data, 'name') ? 'border-red-500' : ''}`}
        />
      </div>
      {/* ភេទ* */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">
          ភេទ{isRequiredInvalid(data, 'gender') && <span className="text-red-600">*</span>}
        </label>
        <select
          value={data.gender}
          onChange={e => setData({ ...data, gender: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md ${isRequiredInvalid(data, 'gender') ? 'border-red-500' : ''}`}
        >
          <option value="">-- ជ្រើសរើស --</option>
          <option value="Male">ប្រុស</option>
          <option value="Female">ស្រី</option>
        </select>
      </div>
      {/* ថ្ងៃកំណើត* */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">
          ថ្ងៃកំណើត{isRequiredInvalid(data, 'dob') && <span className="text-red-600">*</span>}
        </label>
        <DateInput
          value={data.dob}
          onChange={v => setData({ ...data, dob: v })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md ${isRequiredInvalid(data, 'dob') ? 'border-red-500' : ''}`}
          min="01/01/1930"
          max={today}
          placeholder="បញ្ជូលថ្ងៃខែឆ្នាំ (dd/mm/yyyy)"
          shortYear={false}
        />
      </div>
      {/* ទូរស័ព្ទ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">ទូរស័ព្ទ</label>
        <input
          value={formatPhoneDisplay(data.phone || '')}
          onChange={handlePhoneChange}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          placeholder="បញ្ចូលលេខទូរស័ព្ទ (093 301 221)"
        />
      </div>
      {/* អ៊ីមែល */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">អ៊ីមែល</label>
        <input
          value={data.email || ''}
          onChange={e => setData({ ...data, email: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          placeholder="បញ្ចូលអ៊ីមែល"
        />
      </div>
      {/* លេខ បសស */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">លេខ បសស</label>
        <input
          value={data.cardNumber || ''}
          onChange={e => setData({ ...data, cardNumber: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          placeholder="បញ្ចូលលេខ បសស"
        />
      </div>
      {/* លេខអត្តសញ្ញាណប័ណ្ណ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">លេខអត្តសញ្ញាណប័ណ្ណ</label>
        <input
          value={formatNidDisplay(data.nid || '')}
          onChange={handleNidChange}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          placeholder="បញ្ចូលលេខអត្តសញ្ញាណ (e.g. 020956966 or 020956966(01))"
        />
      </div>
      {/* លេខតុងធនាគារ */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">លេខតុងធនាគារ</label>
        <input
          value={data.bankAccount || ''}
          onChange={e => setData({ ...data, bankAccount: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          placeholder="បញ្ចូលលេខតុងធនាគារ"
        />
      </div>
      {/* ស្ថានភាពគ្រួសារ* */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">
          ស្ថានភាពគ្រួសារ{isRequiredInvalid(data, 'maritalStatus') && <span className="text-red-600">*</span>}
        </label>
        <select
          value={data.maritalStatus}
          onChange={e => setData({ ...data, maritalStatus: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md ${isRequiredInvalid(data, 'maritalStatus') ? 'border-red-500' : ''}`}
        >
          <option value="">-- ជ្រើសរើស --</option>
          <option value="Single">លីវ</option>
          <option value="Married">រៀបការហើយ</option>
          <option value="Divorced">ពោះម៉ាយ</option>
          <option value="Widowed">មេម៉ាយ</option>
        </select>
      </div>
      {/* ក្រុមឈាម* */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">
          ក្រុមឈាម{isRequiredInvalid(data, 'bloodGroup') && <span className="text-red-600">*</span>}
        </label>
        <select
          value={data.bloodGroup}
          onChange={e => setData({ ...data, bloodGroup: e.target.value })}
          className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md ${isRequiredInvalid(data, 'bloodGroup') ? 'border-red-500' : ''}`}
        >
          <option value="">-- ជ្រើសរើស --</option>
          <option value="A+">A+</option>
          <option value="A-">A-</option>
          <option value="B+">B+</option>
          <option value="B-">B-</option>
          <option value="AB+">AB+</option>
          <option value="AB-">AB-</option>
          <option value="O+">O+</option>
          <option value="O-">O-</option>
        </select>
      </div>
      {/* ទីកន្លែងកំណើត */}
      {splitBirthPlace ? (
        <PlacePartsGrid title="ទីកន្លែងកំណើត" valueKey="birthPlaceParts" />
      ) : (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">ទីកន្លែងកំណើត</label>
          <input
            value={data.birthPlace || ''}
            onChange={e => setData({ ...data, birthPlace: e.target.value })}
            className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          />
        </div>
      )}
      {/* ទីកន្លែងបច្ចុប្បន្ន */}
      {splitCurrentPlace ? (
        <PlacePartsGrid title="ទីកន្លែងបច្ចុប្បន្ន" valueKey="currentPlaceParts" />
      ) : (
        <div>
          <label className="block mb-1 font-medium text-lg text-blue-600">ទីកន្លែងបច្ចុប្បន្ន</label>
          <input
            value={data.currentPlace || ''}
            onChange={e => setData({ ...data, currentPlace: e.target.value })}
            className={`border-2 border-purple-300 text-gray-900 ${inputTextClass} px-3 py-2 mb-3 w-full rounded-md`}
          />
        </div>
      )}
      {/* រូបភាព */}
      <div>
        <label className="block mb-1 font-medium text-lg text-blue-600">រូបភាព</label>
        <input
          type="file"
          accept="image/*"
          onChange={async e => {
            const file = e.target.files[0];
            const maxSize = 2 * 1024 * 1024;
            if (file) {
              if (!file.type.startsWith("image/")) {
                setData && setData({ ...data, image: '', imageError: 'ប្រភេទរូបភាពមិនគាំទ្រ (ត្រូវជា image/*)' });
                return;
              }
              if (file.size > maxSize) {
                setData && setData({ ...data, image: '', imageError: 'រូបភាពធំពេក (ត្រូវតិចជាង 2MB)' });
                return;
              }
              // Upload to backend (save to public/Uploads)
              const formData = new FormData();
              formData.append('file', file);
              try {
                const res = await fetch(`${API_BASE}/api/upload`, {
                  method: 'POST',
                  body: formData
                });
                if (!res.ok) {
                  // Try to get error message from server
                  let errorMsg = 'Upload មិនបានជោគជ័យ (server error)';
                  try {
                    const errJson = await res.json();
                    if (errJson && errJson.error) {
                      errorMsg += `: ${errJson.error}`;
                    }
                  } catch {
                    // fallback: try text
                    try {
                      const errText = await res.text();
                      if (errText) errorMsg += `: ${errText}`;
                    } catch {}
                  }
                  setData && setData({ ...data, image: '', imageError: errorMsg });
                  // Debug: log error response
                  console.error('Image upload error:', errorMsg);
                  return;
                }
                const result = await res.json();
                if (result.url) {
                  setData && setData({ ...data, image: result.url, imageError: '' });
                } else {
                  setData && setData({ ...data, image: '', imageError: 'Upload មិនបានជោគជ័យ (no url)' });
                }
              } catch (err) {
                setData && setData({ ...data, image: '', imageError: 'បញ្ហា upload (network)' });
                // Debug: log fetch error
                console.error('Image upload network error:', err);
              }
            }
          }}
          className="border-2 border-purple-300 text-gray-900 text-lg px-3 py-2 mb-3 w-full rounded-md"
        />
        {/* Show error if image is too large or wrong type */}
        {data.imageError && (
          <div className="text-red-600 text-sm mb-2">{data.imageError}</div>
        )}
        {/* Show image preview if image is selected */}
        {data.image && (
          <div className="mt-2">
            <label className="block mb-1 font-medium text-lg text-blue-600">មើលរូបភាព៖</label>
            <img src={data.image} alt="Preview" className="w-32 h-32 object-cover rounded shadow" />
            <button
              type="button"
              className="bg-red-500 text-white px-3 py-1 rounded mt-2"
              onClick={() => setData && setData({ ...data, image: '', imageError: '' })}
            >លុបរូបភាព</button>
          </div>
        )}
      </div>
    </div>
  );
}

// removed old date helpers; DateInput handles display and parsing
