import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Clock, User, LogOut, RefreshCw } from 'lucide-react';

export default function PendingApprovalPage() {
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState('');

  const checkStatus = async () => {
    setChecking(true);
    setNote('');
    try {
      const { data } = await api.get('/auth/me');
      const nextUser = data?.user;
      if (nextUser) {
        login(token, nextUser);
        const perms = Array.isArray(nextUser?.permissions) ? nextUser.permissions : [];
        if (perms.length > 0) {
          navigate('/', { replace: true });
          return;
        }
      }
      setNote('នៅតែរង់ចាំ Admin អនុម័ត...');
    } catch (e) {
      setNote(e?.response?.data?.message || e?.message || 'បរាជ័យក្នុងការពិនិត្យស្ថានភាព');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[550px]">
        
        {/* Left Side: Premium Amber Gradient (Indicates Pending) */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-amber-600 via-amber-500 to-orange-400 p-10 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-white opacity-5 rounded-full -translate-x-20 -translate-y-20"></div>
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-white opacity-5 rounded-full translate-x-20 translate-y-20"></div>
          
          <div>
            <h1 className="text-xl font-bold font-muol mb-2 leading-relaxed">ប្រព័ន្ធគ្រប់គ្រងធនធានមនុស្ស និង លំហូឯកសារ</h1>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-bold tracking-wider font-muol">HRMS & DFS</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">v4.0</span>
            </div>
            <p className="text-xs text-amber-50 font-sans mb-4 leading-relaxed">
              (Human Resources Management System & Document Flow System)
            </p>
            <p className="text-amber-50 font-khmer text-sm leading-relaxed">
              មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត<br />
              Khmer-Soviet Friendship Hospital
            </p>
          </div>

          {/* Animated Clock Area */}
          <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
            <style>{`
              @keyframes pulse-slow {
                0%, 100% { transform: scale(1); opacity: 0.9; }
                50% { transform: scale(1.05); opacity: 1; }
              }
              .animate-pulse-slow {
                animation: pulse-slow 3s ease-in-out infinite;
              }
            `}</style>
            <div className="w-32 h-32 bg-white/15 rounded-full flex items-center justify-center border border-white/20 shadow-lg animate-pulse-slow">
              <Clock className="w-16 h-16 text-white/90" />
            </div>
          </div>

          <div className="mt-auto">
            <div className="flex items-center gap-2 text-sm text-amber-50 font-khmer">
              <span className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></span>
              <span>កំពុងរង់ចាំការអនុម័តពី Admin</span>
            </div>
            <p className="text-xs text-amber-100 mt-2 font-khmer">© ២០២៦ រក្សាសិទ្ធិគ្រប់យ៉ាង</p>
          </div>
        </div>

        {/* Right Side: Status Content */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center bg-white">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 font-khmer mb-1">កំពុងរង់ចាំការអនុម័ត</h2>
            <p className="text-sm text-gray-500 font-khmer">សូមរង់ចាំ Admin បន្ថែមទិន្នន័យរបស់អ្នកទៅក្នុង HR</p>
          </div>

          <div className="text-sm border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-2 mb-4 font-khmer">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">ឈ្មោះ:</span> 
              <span className="font-medium text-gray-800">{user?.fullName || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">លេខទូរស័ព្ទ:</span> 
              <span className="font-medium text-gray-800">{user?.phone || '-'}</span>
            </div>
          </div>

          <div className="text-sm text-gray-600 mb-6 font-khmer leading-relaxed">
            បន្ទាប់ពី Admin អនុម័ត អ្នកអាច Login ម្តងទៀត ដើម្បីប្រើប្រាស់ប្រព័ន្ធ។
          </div>

          {note && (
            <div className="mb-4 text-sm bg-blue-50 text-blue-700 p-3 rounded-lg border border-blue-100 font-khmer">
              {note}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-khmer shadow-md flex items-center justify-center gap-2"
              onClick={checkStatus}
              disabled={checking}
            >
              {checking ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  កំពុងពិនិត្យ...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  ពិនិត្យស្ថានភាព
                </>
              )}
            </button>

            <button
              type="button"
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg py-2.5 border border-gray-300 transition-colors font-khmer flex items-center justify-center gap-2"
              onClick={logout}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <a href="/employee-register" className="text-sm font-medium text-blue-600 hover:text-blue-700 font-khmer">
              Login ចូលកែប្រែទិន្នន័យ
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
