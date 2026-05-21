import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import usePermission from '../hooks/usePermission';
import { Printer, Download, ArrowLeft, Loader2, Search, User } from 'lucide-react';

/**
 * StaffBiographyPage - A 4-page printable formal document for staff information.
 * Replicates the provided physical paper document layout.
 */
export default function StaffBiographyPage() {
  const { id } = useParams(); // staffId if provided, else current user
  const { user } = useAuth();
  const perms = usePermission();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchId, setSearchId] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    const fetchStaffList = async () => {
      // Don't fetch list for normal staff who can only see themselves
      if (!perms?.canViewHR && !perms?.canViewEmployees) {
        return;
      }
      setListLoading(true);
      try {
        const res = await api.get('/hr');
        setStaffList(res.data || []);
      } catch (err) {
        console.error('Failed to fetch staff list', err);
      } finally {
        setListLoading(false);
      }
    };
    fetchStaffList();
  }, [perms]);

  useEffect(() => {
    const fetchProfile = async () => {
      // If no id provided OR user cannot view all HR records, load self profile
      if (!id || (!perms?.canViewHR && !perms?.canViewEmployees)) {
        setLoading(true);
        setError('');
        try {
          const res = await api.get('/self/hr/me');
          setProfile(res.data);
        } catch (err) {
          const msg = err?.response?.data?.message || err?.response?.data?.error || 'រកមិនឃើញទិន្នន័យបុគ្គលិកនេះទេ';
          setError(msg);
          setProfile(null);
          console.error(err);
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError('');
      try {
        // Fetch from general HR endpoint which supports MongoDB ID, staffId, or No
        const res = await api.get(`/hr/${id}`);
        setProfile(res.data);
      } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || 'រកមិនឃើញទិន្នន័យបុគ្គលិកនេះទេ';
        setError(msg);
        setProfile(null);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id, perms]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600 font-khmer">កំពុងទាញយកទិន្នន័យ...</p>
      </div>
    );
  }

  const toKhmerDigits = (num) => {
    if (!num && num !== 0) return '';
    const digits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
    return String(num).split('').map(d => digits[+d] || d).join('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${toKhmerDigits(d.getDate())}/${toKhmerDigits(d.getMonth() + 1)}/${toKhmerDigits(d.getFullYear())}`;
    } catch {
      return dateStr;
    }
  };

  // Helper for empty fields to maintain layout
  const val = (v) => v || '...................................................';
  const dotLine = (count = 1) => Array(count).fill('.......................................................................................').join('\n');

  const filteredStaff = staffList.filter(s =>
    (s.khmerName || '').toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    (s.staffId || '').toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden print:block print:h-auto print:bg-white">
      {/* Sidebar - Hidden on print and for normal staff */}
      {(perms?.canViewHR || perms?.canViewEmployees) && (
        <aside className="w-80 bg-white border-r flex flex-col print:hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold font-khmer mb-3 text-blue-700">បញ្ជីបុគ្គលិក</h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="ស្វែងរកឈ្មោះ ឬលេខកាត..."
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm font-khmer focus:ring-2 focus:ring-blue-500 outline-none"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                <p className="text-xs text-gray-500 font-khmer">កំពុងទាញយក...</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredStaff.map((staff) => (
                  <button
                    key={staff._id}
                    onClick={() => navigate(`/staff-biography/${staff._id}`)}
                    className={`w-full text-left p-3 hover:bg-blue-50 transition-colors flex items-center gap-3 ${id === staff._id ? 'bg-blue-50 border-r-4 border-blue-600' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm font-khmer truncate">{staff.khmerName}</p>
                      <p className="text-xs text-gray-500 font-khmer">{staff.staffId || 'គ្មានលេខកាត'}</p>
                    </div>
                  </button>
                ))}
                {filteredStaff.length === 0 && !listLoading && (
                  <div className="p-8 text-center text-gray-400 text-sm font-khmer">
                    មិនមានបុគ្គលិកឈ្មោះនេះទេ
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        <div className="min-h-full bg-gray-200 py-8 px-4 print:bg-white print:p-0">
          {/* UI Controls */}
          <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center print:hidden">
            <button onClick={() => navigate(-1)} className="btn bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> ត្រឡប់ក្រោយ
            </button>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                disabled={!profile}
                className={`btn btn-primary flex items-center gap-2 ${!profile ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Printer className="w-4 h-4" /> បោះពុម្ព (Print)
              </button>
            </div>
          </div>

          {/* Biography View or Fetching State */}
          <div className="flex flex-col items-center">
            {loading ? (
              <div className="bg-white p-12 rounded-lg shadow-md flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600 font-khmer">កំពុងទាញយកទិន្នន័យ...</p>
              </div>
            ) : profile ? (
              /* A4 Pages Container */
              <div ref={printRef} className="flex flex-col gap-8 items-center print:gap-0">

                {/* PAGE 1 */}
                <div className="a4-page shadow-xl rounded-sm print:shadow-none print:rounded-none">
                  <div className="p-[10mm] text-sm leading-relaxed font-khmer h-full flex flex-col">
                    {/* Header */}
                    <div className="flex flex-col items-center mb-4">
                      <h1 className="text-base font-muol text-center">ព្រះរាជាណាចក្រកម្ពុជា</h1>
                      <h2 className="text-base font-muol text-center">ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
                      <div className="w-24 h-[1px] bg-black mt-1 mb-1"></div>
                      <div className="flex justify-between w-full mt-4">
                        <div className="text-left">
                          <p className="font-muol text-sm">ក្រសួងសុខាភិបាល</p>
                          <p className="font-muol text-sm">មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</p>

                        </div>
                        <div className="text-right border border-black photo-container w-[35mm] h-[45mm] flex items-center justify-center overflow-hidden">
                          {profile.image ? (
                            <img src={profile.image} alt="Photo" className="w-full h-full object-cover" />
                          ) : (
                            <p className="text-[10px] text-gray-400">រូបថត ៤x៦</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-center mb-6">
                      <h1 className="text-lg font-muol underline">ប្រវត្តិរូបសង្ខេបមន្ត្រីរាជការ</h1>
                    </div>

                    {/* Section A: Personal Information */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">ក-ព័ត៌មានផ្ទាល់ខ្លួន</h3>
                      <div className="space-y-2">
                        <div className="flex">
                          <span className="w-40">- នាមត្រកូល និងនាមខ្លួន:</span>
                          <span className="flex-1 font-bold border-b border-dotted border-black/50">{val(profile.khmerName)}</span>
                          <span className="w-24 ml-4">អក្សរឡាតាំង:</span>
                          <span className="flex-1 font-bold border-b border-dotted border-black/50 uppercase">{val(profile.name)}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32">- ភេទ:</span>
                          <span className="w-24 border-b border-dotted border-black/50">
                            {profile.gender === 'Male' ? 'ប្រុស' : (profile.gender === 'Female' ? 'ស្រី' : val(profile.gender))}
                          </span>
                          <span className="w-24 ml-4">ថ្ងៃខែឆ្នាំកំណើត:</span>
                          <span className="flex-1 border-b border-dotted border-black/50">{formatDate(profile.dob)}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32">- ទីកន្លែងកំណើត:</span>
                          <span className="flex-1 border-b border-dotted border-black/50">{val(profile.birthPlace)}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32">- អត្តសញ្ញាណប័ណ្ណ:</span>
                          <span className="w-48 border-b border-dotted border-black/50">{val(profile.nid)}</span>
                          <span className="w-24 ml-4">លិខិតឆ្លងដែន:</span>
                          <span className="flex-1 border-b border-dotted border-black/50">..................................</span>
                        </div>
                        <div className="flex mt-2">
                          <span className="w-32">- អាសយដ្ឋានបច្ចុប្បន្ន:</span>
                          <div className="flex-1">
                            <p className="border-b border-dotted border-black/50">{val(profile.currentPlace)}</p>
                          </div>
                        </div>
                        <div className="flex">
                          <span className="w-40">- អាសយដ្ឋានអចិន្ត្រៃយ៍:</span>
                          <span className="flex-1 border-b border-dotted border-black/50">{profile.permanentPlace || val(profile.currentPlace)}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32">- ស្ថានភាពគ្រួសារ:</span>
                          <span className="w-48 border-b border-dotted border-black/50">
                            {profile.maritalStatus === 'Single' ? 'នៅលីវ' :
                              (profile.maritalStatus === 'Married' ? 'រៀបការរួច' : val(profile.maritalStatus))}
                          </span>
                          <span className="w-20 ml-4">ទូរស័ព្ទ:</span>
                          <span className="flex-1 border-b border-dotted border-black/50">{val(profile.phone)}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32">- អ៊ីមែល:</span>
                          <span className="flex-1 border-b border-dotted border-black/50">{val(profile.email)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Section B: Education */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">ខ-កម្រិតវប្បធម៌</h3>
                      <div className="space-y-3">
                        <div>
                          <p className="font-bold">១. បំណិនចំណេះដឹងទូទៅ</p>
                          <table className="w-full border-collapse border border-black text-center mt-1">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="border border-black p-1 w-32">កម្រិតវប្បធម៌</th>
                                <th className="border border-black p-1">គ្រឹះស្ថានសិក្សា/ទីតាំង</th>
                                <th className="border border-black p-1 w-24">ចាប់ផ្តើម</th>
                                <th className="border border-black p-1 w-24">បញ្ចប់</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(profile.educationList || []).filter(e => e.type === 'General' || !e.type).map((edu, idx) => (
                                <tr key={idx}>
                                  <td className="border border-black p-1">{edu.degree}</td>
                                  <td className="border border-black p-1">{edu.school}</td>
                                  <td className="border border-black p-1">{formatDate(edu.startDate)}</td>
                                  <td className="border border-black p-1">{formatDate(edu.endDate)}</td>
                                </tr>
                              ))}
                              {/* Placeholder rows if empty */}
                              {Array(Math.max(0, 3 - (profile.educationList || []).length)).fill(0).map((_, i) => (
                                <tr key={`empty-${i}`}>
                                  <td className="border border-black p-3"></td>
                                  <td className="border border-black p-3"></td>
                                  <td className="border border-black p-3"></td>
                                  <td className="border border-black p-3"></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div>
                          <p className="font-bold">២. កម្រិតជំនាញវិជ្ជាជីវៈ (សញ្ញាបត្រខ្ពស់បំផុត)</p>
                          <div className="flex mt-1">
                            <span className="w-32">- សញ្ញាបត្រ:</span>
                            <span className="flex-1 border-b border-dotted border-black/50">{profile.degree || '...................................................'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-32">- ជំនាញ:</span>
                            <span className="flex-1 border-b border-dotted border-black/50">{profile.skill || '...................................................'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto text-right text-xs">
                      ទំព័រ ១/៤
                    </div>
                  </div>
                </div>

                {/* PAGE 2 */}
                <div className="a4-page shadow-xl rounded-sm print:shadow-none print:rounded-none">
                  <div className="p-[10mm] text-sm leading-relaxed font-khmer h-full flex flex-col">
                    {/* Section C: Training */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">គ-សេចក្តីលម្អិតនៃវគ្គបណ្តុះបណ្តាល</h3>
                      <table className="w-full border-collapse border border-black text-center">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-black p-1">វគ្គសិក្សា/សិក្ខាសាលា</th>
                            <th className="border border-black p-1 w-32">ទីកន្លែង/ប្រទេស</th>
                            <th className="border border-black p-1 w-24">ចាប់ផ្តើម</th>
                            <th className="border border-black p-1 w-24">បញ្ចប់</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(profile.trainingList || []).map((t, idx) => (
                            <tr key={idx}>
                              <td className="border border-black p-1">{t.course}</td>
                              <td className="border border-black p-1">{t.place}</td>
                              <td className="border border-black p-1">{formatDate(t.startDate)}</td>
                              <td className="border border-black p-1">{formatDate(t.endDate)}</td>
                            </tr>
                          ))}
                          {Array(Math.max(0, 5 - (profile.trainingList || []).length)).fill(0).map((_, i) => (
                            <tr key={`empty-${i}`}>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Section D: Foreign Languages */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">ឃ-កម្រិតប្រើយុទ្ធភណ្ឌ និងភាសាបរទេស</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-bold">១. ភាសាបរទេស</p>
                          <table className="w-full border-collapse border border-black text-center mt-1">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="border border-black p-1">ភាសា</th>
                                <th className="border border-black p-1">កម្រិត (ស្តាប់/និយាយ/សរសេរ)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(profile.languageList || []).map((l, idx) => (
                                <tr key={idx}>
                                  <td className="border border-black p-1">{l.language}</td>
                                  <td className="border border-black p-1">{l.level}</td>
                                </tr>
                              ))}
                              {Array(Math.max(0, 3 - (profile.languageList || []).length)).fill(0).map((_, i) => (
                                <tr key={`empty-${i}`}>
                                  <td className="border border-black p-3"></td>
                                  <td className="border border-black p-3"></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <p className="font-bold">២. ចំណេះដឹងកុំព្យូទ័រ</p>
                          <div className="border border-black p-2 mt-1 h-20">
                            {profile.computerSkills || '...................................................'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section E: Work Experience */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">ង-ប្រវត្តិការងារ (ចាប់ផ្តើមពីបច្ចុប្បន្នមកក្រោយ)</h3>
                      <table className="w-full border-collapse border border-black text-center">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-black p-1 w-24">កាលបរិច្ឆេទ</th>
                            <th className="border border-black p-1">អង្គភាព/ក្រសួង</th>
                            <th className="border border-black p-1">តួនាទីភារកិច្ច</th>
                            <th className="border border-black p-1 w-20">កាំបៀវត្ស</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Row for current job */}
                          <tr>
                            <td className="border border-black p-1">បច្ចុប្បន្ន</td>
                            <td className="border border-black p-1">{profile.Department_Kh}</td>
                            <td className="border border-black p-1">{profile.position}</td>
                            <td className="border border-black p-1">{profile.salaryLevel}</td>
                          </tr>
                          {(profile.experienceList || []).map((e, idx) => (
                            <tr key={idx}>
                              <td className="border border-black p-1">{formatDate(e.startDate)} - {formatDate(e.endDate)}</td>
                              <td className="border border-black p-1">{e.organization}</td>
                              <td className="border border-black p-1">{e.position}</td>
                              <td className="border border-black p-1">{e.salaryLevel}</td>
                            </tr>
                          ))}
                          {Array(Math.max(0, 8 - (profile.experienceList || []).length - 1)).fill(0).map((_, i) => (
                            <tr key={`empty-${i}`}>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-auto text-right text-xs">
                      ទំព័រ ២/៤
                    </div>
                  </div>
                </div>

                {/* PAGE 3 */}
                <div className="a4-page shadow-xl rounded-sm print:shadow-none print:rounded-none">
                  <div className="p-[10mm] text-sm leading-relaxed font-khmer h-full flex flex-col">
                    {/* Section F: Family Information */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">ច-ព័ត៌មានគ្រួសារ</h3>
                      <div className="mb-4">
                        <p className="font-bold">១. ភរិយា ឬ ស្វាមី</p>
                        <div className="space-y-2 mt-1">
                          <div className="flex">
                            <span className="w-32">- ឈ្មោះ:</span>
                            <span className="flex-1 border-b border-dotted border-black/50">{profile.spouseName || '...................................................'}</span>
                            <span className="w-20 ml-4">ថ្ងៃកំណើត:</span>
                            <span className="w-32 border-b border-dotted border-black/50">{formatDate(profile.spouseDob)}</span>
                          </div>
                          <div className="flex">
                            <span className="w-32">- មុខរបរ:</span>
                            <span className="flex-1 border-b border-dotted border-black/50">{profile.spouseOccupation || '...................................................'}</span>
                            <span className="w-20 ml-4">ទូរស័ព្ទ:</span>
                            <span className="w-32 border-b border-dotted border-black/50">{profile.spousePhone || '...................................................'}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold">២. បុត្រ</p>
                        <table className="w-full border-collapse border border-black text-center mt-1">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-black p-1 w-10">ល.រ</th>
                              <th className="border border-black p-1">ឈ្មោះ</th>
                              <th className="border border-black p-1 w-10">ភេទ</th>
                              <th className="border border-black p-1 w-32">ថ្ងៃកំណើត</th>
                              <th className="border border-black p-1">មុខរបរ/ទីតាំងសិក្សា</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(profile.childrenList || []).map((c, idx) => (
                              <tr key={idx}>
                                <td className="border border-black p-1">{toKhmerDigits(idx + 1)}</td>
                                <td className="border border-black p-1">{c.name}</td>
                                <td className="border border-black p-1">{c.gender}</td>
                                <td className="border border-black p-1">{formatDate(c.dob)}</td>
                                <td className="border border-black p-1">{c.occupation}</td>
                              </tr>
                            ))}
                            {Array(Math.max(0, 10 - (profile.childrenList || []).length)).fill(0).map((_, i) => (
                              <tr key={`empty-${i}`}>
                                <td className="border border-black p-3"></td>
                                <td className="border border-black p-3"></td>
                                <td className="border border-black p-3"></td>
                                <td className="border border-black p-3"></td>
                                <td className="border border-black p-3"></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Section G: Parents Information */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">ឆ-ព័ត៌មានឪពុកម្តាយ</h3>
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <p className="font-bold underline">ឪពុក</p>
                          <div className="space-y-2 mt-2">
                            <div className="flex">
                              <span className="w-16">ឈ្មោះ:</span>
                              <span className="flex-1 border-b border-dotted border-black/50">{profile.fatherName || '..................................'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-16">ថ្ងៃកំណើត:</span>
                              <span className="flex-1 border-b border-dotted border-black/50">{formatDate(profile.fatherDob)}</span>
                            </div>
                            <div className="flex">
                              <span className="w-16">មុខរបរ:</span>
                              <span className="flex-1 border-b border-dotted border-black/50">{profile.fatherOccupation || '..................................'}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="font-bold underline">ម្តាយ</p>
                          <div className="space-y-2 mt-2">
                            <div className="flex">
                              <span className="w-16">ឈ្មោះ:</span>
                              <span className="flex-1 border-b border-dotted border-black/50">{profile.motherName || '..................................'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-16">ថ្ងៃកំណើត:</span>
                              <span className="flex-1 border-b border-dotted border-black/50">{formatDate(profile.motherDob)}</span>
                            </div>
                            <div className="flex">
                              <span className="w-16">មុខរបរ:</span>
                              <span className="flex-1 border-b border-dotted border-black/50">{profile.motherOccupation || '..................................'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto text-right text-xs">
                      ទំព័រ ៣/៤
                    </div>
                  </div>
                </div>

                {/* PAGE 4 */}
                <div className="a4-page shadow-xl rounded-sm print:shadow-none print:rounded-none">
                  <div className="p-[10mm] text-sm leading-relaxed font-khmer h-full flex flex-col">
                    {/* Section H: Siblings */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">ជ-ព័ត៌មានបងប្អូន</h3>
                      <table className="w-full border-collapse border border-black text-center">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-black p-1 w-10">ល.រ</th>
                            <th className="border border-black p-1">ឈ្មោះ</th>
                            <th className="border border-black p-1 w-10">ភេទ</th>
                            <th className="border border-black p-1 w-32">ថ្ងៃកំណើត</th>
                            <th className="border border-black p-1">មុខរបរ/ទីលំនៅ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(profile.siblingList || []).map((s, idx) => (
                            <tr key={idx}>
                              <td className="border border-black p-1">{toKhmerDigits(idx + 1)}</td>
                              <td className="border border-black p-1">{s.name}</td>
                              <td className="border border-black p-1">{s.gender}</td>
                              <td className="border border-black p-1">{formatDate(s.dob)}</td>
                              <td className="border border-black p-1">{s.occupation}</td>
                            </tr>
                          ))}
                          {Array(Math.max(0, 8 - (profile.siblingList || []).length)).fill(0).map((_, i) => (
                            <tr key={`empty-${i}`}>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Section I: Decorations/Medals */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">ឈ-គ្រឿងឥស្សរិយយស (មេដាយដែលទទួលបាន)</h3>
                      <table className="w-full border-collapse border border-black text-center">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-black p-1">ប្រភេទគ្រឿងឥស្សរិយយស</th>
                            <th className="border border-black p-1 w-32">កាលបរិច្ឆេទទទួលបាន</th>
                            <th className="border border-black p-1">យោងលិខិត</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.medalType && (
                            <tr>
                              <td className="border border-black p-1">{profile.medalType}</td>
                              <td className="border border-black p-1">{formatDate(profile.medalReceivedDate)}</td>
                              <td className="border border-black p-1">....</td>
                            </tr>
                          )}
                          {Array(Math.max(0, 4 - (profile.medalType ? 1 : 0))).fill(0).map((_, i) => (
                            <tr key={`empty-${i}`}>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                              <td className="border border-black p-3"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Section J: Disciplines */}
                    <div className="mb-4">
                      <h3 className="font-bold text-base mb-2">ញ-ទណ្ឌកម្មវិន័យ</h3>
                      <div className="border border-black p-2 h-20">
                        {profile.disciplines || val('')}
                      </div>
                    </div>

                    {/* Signature Section */}
                    <div className="mt-8 grid grid-cols-2">
                      <div></div>
                      <div className="text-center">
                        <p>{formatDateKhmer(new Date())}</p>
                        <p className="font-bold mt-1">សាមីខ្លួនផ្ដិតមេដៃ និងចុះហត្ថលេខា</p>
                        <div className="h-24"></div>
                        <p className="font-bold">{profile.khmerName}</p>
                      </div>
                    </div>

                    <div className="mt-auto text-right text-xs">
                      ទំព័រ ៤/៤
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              /* Empty state / Search fallback if no profile loaded */
              <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
                <h2 className="text-xl font-bold font-khmer mb-4 text-center">ជ្រើសរើសបុគ្គលិក</h2>
                {error && <p className="text-red-600 font-khmer mb-4 text-sm bg-red-50 p-2 rounded border border-red-200">{error}</p>}

                <div className="flex flex-col gap-4">
                  <p className="text-gray-600 text-sm font-khmer text-center">
                    សូមជ្រើសរើសបុគ្គលិកពីបញ្ជីខាងឆ្វេង ឬស្វែងរកលេខកាតខាងក្រោម៖
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      placeholder="លេខកាត ឬអត្តលេខ..."
                      className="flex-1 border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => e.key === 'Enter' && searchId && navigate(`/staff-biography/${searchId}`)}
                    />
                    <button
                      onClick={() => searchId && navigate(`/staff-biography/${searchId}`)}
                      className="btn btn-primary"
                    >ស្វែងរក</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .font-khmer {
          font-family: 'Khmer OS Siemreap', 'Khmer OS', Arial, sans-serif;
        }
        .font-muol {
          font-family: 'Khmer OS Muol Light', serif;
        }
        .a4-page {
          width: 210mm;
          height: 297mm;
          background: white;
          margin: 0 auto;
          box-sizing: border-box;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          
          /* Comprehensive Reset for All Parent Containers */
          html, body, #root, [class*="min-h-screen"], [class*="h-screen"], main, section, [class*="flex-1"] {
             width: 100% !important;
             height: auto !important;
             min-height: auto !important;
             max-height: none !important;
             overflow: visible !important;
             margin: 0 !important;
             padding: 0 !important;
             display: block !important;
             position: static !important;
             float: none !important;
          }

          /* Reset Layout specific overrides */
          div[style*="height"], div[style*="marginLeft"] {
            height: auto !important;
            margin-left: 0 !important;
            padding-left: 0 !important;
            overflow: visible !important;
            width: 100% !important;
          }

          /* Hide application UI elements */
          header, aside, footer, .print-hidden, .btn, button, nav { 
             display: none !important; 
          }
          
          /* Container for the pages - NO padding-top here as it overflows the A4 height */
          .flex-col.gap-8 {
            gap: 0 !important;
            padding-top: 0 !important; 
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
          }

          /* Precise A4 pages - locked to exact paper dimensions */
          .a4-page {
            box-shadow: none !important;
            margin: 0 auto !important;
            border: none !important;
            page-break-after: always;
            page-break-before: always;
            page-break-inside: avoid !important;
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important; 
            display: block !important;
            position: relative !important;
            background: white !important;
          }

          /* Ensure the first page starts at the very top of the first sheet */
          .a4-page:first-child {
            page-break-before: avoid;
          }
          
          .a4-page .h-full {
             height: 100% !important;
          }

          .a4-page:last-child {
            page-break-after: avoid;
          }

          /* Specific fix for the photo container */
          .photo-container {
            width: 35mm !important;
            height: 45mm !important;
            min-width: 35mm !important;
            min-height: 45mm !important;
            display: flex !important;
            overflow: hidden !important;
            border: 1px solid black !important;
          }
          
          .photo-container img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

// Helper: format Date -> Khmer digits and text
const _khDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩']
const toKhmerDigits = (num) => String(num).split('').map(ch => (_khDigits[+ch] ?? ch)).join('')

const formatDateKhmer = (d) => {
  if (!d || isNaN(d.getTime())) return 'ថ្ងៃទី...... ខែ...... ឆ្នាំ......'
  const day = toKhmerDigits(d.getDate())
  const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ']
  const month = months[d.getMonth()]
  const year = toKhmerDigits(d.getFullYear())
  return `រាជធានីភ្នំពេញ, ថ្ងៃទី${day} ខែ${month} ឆ្នាំ${year}`
}
