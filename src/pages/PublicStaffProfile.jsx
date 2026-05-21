import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, User, Phone, Mail, MapPin, Briefcase, CheckCircle2, XCircle } from 'lucide-react';

export default function PublicStaffProfile() {
  const { id } = useParams();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        // Use relative URL to leverage Vite/Nginx proxy and avoid port issues on mobile
        // Use the new public-verify endpoint that bypasses auth middleware
        const response = await axios.get(`/api/public-verify/hr/${id}`);
        setStaff(response.data);
      } catch (err) {
        setError('រកមិនឃើញព័ត៌មានបុគ្គលិកនេះទេ ឬមានបញ្ហាបច្ចេកទេស។');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600 font-khmer">កំពុងផ្ទៀងផ្ទាត់ទិន្នន័យ...</p>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 font-khmer mb-2">កំហុសក្នុងការស្វែងរក</h1>
        <p className="text-gray-600 font-khmer max-w-xs">{error || 'Staff not found'}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-full font-khmer shadow-lg"
        >
          ព្យាយាមម្តងទៀត
        </button>
      </div>
    );
  }

  // Handle List View (for 'all')
  if (Array.isArray(staff)) {
    return (
      <div className="min-h-screen bg-gray-100 font-khmer pb-10">
        <div className="bg-blue-700 p-6 text-white text-center shadow-lg">
          <h1 className="text-xl font-bold">បញ្ជីបុគ្គលិកសាធារណៈ</h1>
          <p className="text-sm opacity-80 mt-1">Public Staff Directory ({staff.length})</p>
        </div>
        
        <div className="max-w-md mx-auto p-4 space-y-4">
          {staff.map((s) => (
            <div 
              key={s._id} 
              onClick={() => window.location.href = `/v/${s.staffId || s._id}`}
              className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                {s.image ? (
                  <img src={s.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-full h-full p-2 text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{s.khmerName}</p>
                <p className="text-xs text-gray-500 truncate uppercase">{s.position}</p>
              </div>
              <div className="text-blue-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isActive = staff.status === 'Active' || staff.status === 'នៅធ្វើការ';

  return (
    <div className="min-h-screen bg-gray-100 font-khmer pb-10">
      {/* Header Banner */}
      <div className="h-32 bg-gradient-to-r from-blue-700 to-indigo-800 shadow-lg"></div>
      
      {/* Profile Card */}
      <div className="max-w-md mx-auto -mt-16 px-4">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Photo & Basic Info */}
          <div className="p-6 text-center border-b border-gray-100">
            <div className="relative inline-block">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 mx-auto">
                {staff.image ? (
                  <img src={staff.image} alt={staff.khmerName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-full h-full p-6 text-gray-300" />
                )}
              </div>
              <div className={`absolute bottom-1 right-1 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-md ${isActive ? 'bg-green-500' : 'bg-red-500'}`}>
                {isActive ? <CheckCircle2 className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
              </div>
            </div>
            
            <h1 className="mt-4 text-2xl font-bold text-gray-900">{staff.khmerName}</h1>
            <p className="text-lg text-gray-600 uppercase tracking-wide font-medium mt-1">{staff.name}</p>
            <div className="mt-2 inline-block px-4 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-bold border border-blue-100">
              {staff.position}
            </div>
          </div>
          
          {/* Detailed Info */}
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">អង្គភាព / Department</p>
                <p className="text-gray-800 font-medium">{staff.Department_Kh || 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត'}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">លេខទូរស័ព្ទ / Phone</p>
                <a href={`tel:${staff.phone}`} className="text-blue-600 font-bold text-lg hover:underline">
                  {staff.phone || 'N/A'}
                </a>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">អ៊ីមែល / Email</p>
                <p className="text-gray-800">{staff.email || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">ស្ថានភាព / Status</p>
                <p className={`font-bold ${isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {isActive ? 'កំពុងបម្រើការងារ (Active)' : 'ឈប់បម្រើការងារ (Inactive)'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Footer Call to Action */}
          <div className="p-6 bg-gray-50 text-center">
            <a 
              href={`tel:${staff.phone}`}
              className="block w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <Phone className="w-6 h-6 fill-current" />
              ចុចដើម្បីខល (Call Now)
            </a>
            <p className="mt-4 text-xs text-gray-400">
              ព័ត៌មាននេះត្រូវបានបញ្ជាក់ដោយប្រព័ន្ធគ្រប់គ្រងធនធានមនុស្សមន្ទីរពេទ្យ
            </p>
          </div>
        </div>
      </div>
      
      {/* Logos */}
      <div className="mt-10 flex flex-col items-center gap-4 opacity-40 grayscale">
        <img src="/Uploads/MOH_logo.png" alt="MOH" className="h-10 object-contain" />
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center">
          Khmer-Soviet Friendship Hospital<br/>Human Resources Management
        </p>
      </div>

      <style jsx>{`
        .font-khmer {
          font-family: 'Khmer OS Siemreap', 'Khmer OS', Arial, sans-serif;
        }
      `}</style>
    </div>
  );
}
