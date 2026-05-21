import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ScanLine, 
  UserCircle2, 
  CalendarDays, 
  ClipboardList, 
  Bell, 
  Home,
  ChevronRight,
  Info,
  History,
  ShieldCheck,
  Settings,
  HelpCircle,
  LogOut
} from 'lucide-react';
import hospitalLogo from '../assets/3.JPG';

const TelegramPage = () => {
  const navigate = useNavigate();
  const [tgUser, setTgUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    // Initialize Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
      const webapp = window.Telegram.WebApp;
      webapp.ready();
      webapp.expand();
      
      setTgUser(webapp.initDataUnsafe?.user || null);
      setTheme(webapp.colorScheme || 'light');

      // Set Main Button - Premium Style
      webapp.MainButton.setText('បិទកម្មវិធី');
      webapp.MainButton.setParams({
        button_color: '#4f46e5',
        button_text_color: '#ffffff'
      });
      webapp.MainButton.show();
      webapp.MainButton.onClick(() => {
        webapp.close();
      });

      // Handle Theme Changes dynamically
      const handleThemeChange = () => {
        setTheme(webapp.colorScheme);
      };
      webapp.onEvent('themeChanged', handleThemeChange);
      return () => webapp.offEvent('themeChanged', handleThemeChange);
    }
  }, []);

  const menuItems = useMemo(() => [
    {
      title: 'វត្តមាន',
      subtitle: 'Scan & History',
      icon: ScanLine,
      color: 'bg-orange-500',
      path: '/mobileApp/attendance'
    },
    {
      title: 'ស្នើសុំច្បាប់',
      subtitle: 'Apply Leave',
      icon: ClipboardList,
      color: 'bg-blue-600',
      path: '/leave-requests'
    },
    {
      title: 'កាលវិភាគ',
      subtitle: 'My Schedule',
      icon: CalendarDays,
      color: 'bg-indigo-600',
      path: '/work-calendar'
    },
    {
      title: 'គណនី',
      subtitle: 'My Profile',
      icon: UserCircle2,
      color: 'bg-emerald-600',
      path: '/profile'
    }
  ], []);

  const guideItems = [
    { text: 'របៀបឆែកវត្តមាន', icon: ShieldCheck, desc: 'ប្រើ QR Code ដើម្បីស្កេនចូលធ្វើការ' },
    { text: 'របៀបសុំច្បាប់', icon: HelpCircle, desc: 'ជ្រើសរើសថ្ងៃ និងមូលហេតុ រួចចុចស្នើ' },
  ];

  const bgColor = theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50';
  const cardColor = theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-white';
  const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const subTextColor = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`min-h-[100dvh] pb-24 ${bgColor} ${textColor} font-sans selection:bg-indigo-500/30`}>
      {/* Dynamic Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-24 -left-24 h-96 w-96 rounded-full blur-[100px] opacity-20 ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-400'}`}></div>
        <div className={`absolute top-1/2 -right-24 h-64 w-64 rounded-full blur-[100px] opacity-10 ${theme === 'dark' ? 'bg-purple-500' : 'bg-purple-300'}`}></div>
      </div>

      {/* Header Area */}
      <header className="relative z-10 px-6 pt-10 pb-20 overflow-hidden rounded-b-[40px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 shadow-2xl shadow-indigo-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-lg ring-2 ring-white/20">
              <img src={hospitalLogo} alt="KSFH" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white">KSFH Staff</h1>
              <p className="text-[10px] uppercase tracking-widest text-indigo-100/80">Mini App Portal</p>
            </div>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all active:scale-90 hover:bg-white/20">
            <Bell size={20} />
          </button>
        </div>
      </header>

      {/* Floating Status Bar / Profile Card */}
      <div className="relative z-20 -mt-10 px-6">
        <div className={`rounded-[32px] p-5 shadow-2xl backdrop-blur-xl border ${cardColor}`}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 overflow-hidden rounded-2xl bg-indigo-50 shadow-inner">
                {tgUser?.photo_url ? (
                  <img src={tgUser.photo_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-indigo-600">
                    <UserCircle2 size={32} />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white bg-emerald-500 shadow-sm dark:border-slate-800">
                <div className="h-2 w-2 rounded-full bg-white"></div>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-base font-bold leading-tight">
                {tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}` : 'សូមស្វាគមន៍'}
              </div>
              <div className={`text-xs mt-0.5 font-medium ${subTextColor}`}>
                {tgUser?.username ? `@${tgUser.username}` : 'Staff Member'}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">Active</div>
              <div className={`text-[10px] mt-1 font-mono ${subTextColor}`}>ID: {tgUser?.id || '---'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <section className="relative z-10 px-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="h-6 w-1 rounded-full bg-indigo-600"></span>
            មុខងារប្រើប្រាស់
          </h2>
          <button className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">មើលទាំងអស់</button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center p-5 rounded-[28px] border transition-all active:scale-95 group shadow-sm ${cardColor} hover:shadow-indigo-500/10`}
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-3 shadow-lg transition-transform group-hover:-translate-y-1 ${item.color} text-white`}>
                <item.icon size={28} />
              </div>
              <div className="text-sm font-bold">{item.title}</div>
              <div className={`text-[10px] mt-1 ${subTextColor}`}>{item.subtitle}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Guide Section for Staff */}
      <section className="relative z-10 px-6 mt-10">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <span className="h-6 w-1 rounded-full bg-indigo-600"></span>
            មគ្គុទ្ទេសក៍ (Staff Guide)
        </h2>
        
        <div className="space-y-3">
          {guideItems.map((guide, i) => (
            <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border ${cardColor} transition-all`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                <guide.icon size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{guide.text}</div>
                <div className={`text-[11px] mt-0.5 ${subTextColor}`}>{guide.desc}</div>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </div>
          ))}
        </div>
      </section>

      {/* Support Card */}
      <div className="px-6 mt-8 pb-10">
        <div className={`flex items-start gap-4 rounded-[28px] p-5 ${theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'} border`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm text-indigo-600">
            <HelpCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">ជំនួយ និងបច្ចេកទេស</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-indigo-700/80 dark:text-indigo-300/60">
                ប្រសិនបើលោកអ្នកមានបញ្ហាក្នុងការប្រើប្រាស់ សូមទាក់ទងមកក្រុមការងារ IT តាមរយៈ Telegram ជំនួយ។
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar - Mobile Experience */}
      <nav className={`fixed bottom-0 left-0 right-0 z-50 px-6 pb-6 pt-2 transition-all ${theme === 'dark' ? 'bg-slate-950/80' : 'bg-slate-50/80'} backdrop-blur-xl border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1.5 p-2 transition-all ${activeTab === 'home' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
          >
            <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1.5 p-2 transition-all ${activeTab === 'history' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
          >
            <History size={22} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">History</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1.5 p-2 transition-all ${activeTab === 'settings' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
          >
            <Settings size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Config</span>
          </button>
          <button 
            onClick={() => navigate('/profile')}
            className={`flex flex-col items-center gap-1.5 p-2 transition-all text-slate-400`}
          >
            <UserCircle2 size={22} />
            <span className="text-[10px] font-bold">Me</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default TelegramPage;
