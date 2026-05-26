import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children, activeSection, onSectionChange }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // mobile hidden flag
  const [sidebarCompact, setSidebarCompact] = useState(false); // desktop compact flag
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();
  const [footerSettings, setFooterSettings] = useState({
    text: 'សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រងបុគ្គលិក (HRMS) នៃមន្ទីរពេទ្យបង្អែកខេត្តកោះកុង | រក្សាសិទ្ធិគ្រប់យ៉ាងដោយមន្ទីរពេទ្យបង្អែកខេត្តកោះកុង (២០២៦) | បច្ចេកវិទ្យាទំនើប ដើម្បីប្រសិទ្ធភាពការងារ',
    speed: 25,
    showLogo: true,
    logoUrl: '/hospital_logo.png'
  });

  const toggleSidebar = () => {
    if (isMobile) {
      setSidebarCollapsed(!sidebarCollapsed);
    } else {
      setSidebarCompact(!sidebarCompact);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768; // tailwind md breakpoint
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(true);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/report-settings/group/ui-settings');
        const data = await res.json();
        if (data && data.settings) {
          setFooterSettings({
            text: data.settings.footer_text || footerSettings.text,
            speed: parseInt(data.settings.footer_speed) || 25,
            showLogo: data.settings.show_footer_logo !== undefined ? data.settings.show_footer_logo : true,
            logoUrl: data.settings.footer_logo_url || '/hospital_logo.png'
          });
        }
      } catch (e) { /* ignore */ }
    };
    fetchSettings();
    // Refresh every 5 minutes
    const timer = setInterval(fetchSettings, 300000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header (full width) */}
      <header className="sticky top-0 z-40 bg-blue-300 h-16 print:hidden">
        <div className="h-16 flex items-center justify-center px-4">
          <Sidebar asHeader activeSection={activeSection} onSectionChange={onSectionChange} isCollapsed={sidebarCompact} onToggle={toggleSidebar} />
        </div>
      </header>

      {/* Middle area: Left sidebar + Main content */}
      <div
        className="flex"
        style={{
          height: 'calc(100vh - 64px - 32px)',
          overflowY: 'auto'
        }}
      >
        {/* mobile overlay when sidebar is open */}
        {isMobile && !sidebarCollapsed && (
          <div
            onClick={toggleSidebar}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 25 }}
          />
        )}
        <aside
          className="flex-shrink-0 print:hidden"
          style={{
            width: sidebarCompact ? '4.5rem' : '14rem',
            position: 'fixed',
            left: 0,
              top: '64px',
              bottom: '32px',
              overflowY: 'auto',
              zIndex: 30,
              transform: isMobile && sidebarCollapsed ? `translateX(-100%)` : 'translateX(0)',
              transition: 'transform 200ms ease'
          }}
        >
          <div className={sidebarCompact ? 'w-18 bg-white h-full' : 'w-56 bg-white h-full'}>
            <Sidebar activeSection={activeSection} onSectionChange={onSectionChange} isCollapsed={sidebarCompact} onToggle={toggleSidebar} />
          </div>
        </aside>

        <div
          className={`flex-1 flex flex-col transition-all duration-200 print:ml-0 print:w-full print:max-w-full`}
          style={{ 
            marginLeft: isMobile ? 0 : (sidebarCompact ? '4.5rem' : '14rem'),
            width: isMobile ? '100%' : (sidebarCompact ? 'calc(100% - 4.5rem)' : 'calc(100% - 14rem)'),
            maxWidth: isMobile ? '100%' : (sidebarCompact ? 'calc(100% - 4.5rem)' : 'calc(100% - 14rem)')
          }}
        >
          <main className="flex-1 pb-12 p-4">
            <div className="w-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Footer (below main content) */}
      <footer className="fixed bottom-0 left-0 w-full z-50 bg-blue-600 h-8 flex items-center overflow-hidden border-t border-blue-400 shadow-inner print:hidden">
        <div className="w-full relative flex items-center h-full">
          <div 
            className="flex animate-marquee"
            style={{ animationDuration: `${footerSettings.speed}s` }}
          >
            {/* First copy */}
            <div className="flex-shrink-0 min-w-[100vw] flex items-center justify-around pr-[20vw]">
              <div className="flex items-center gap-3">
                {footerSettings.showLogo && <img src={footerSettings.logoUrl} alt="Logo" className="w-5 h-5 object-contain" />}
                <span className="text-[13px] font-medium text-white whitespace-nowrap">
                  {footerSettings.text}
                </span>
              </div>
            </div>
            {/* Second copy for seamless loop */}
            <div className="flex-shrink-0 min-w-[100vw] flex items-center justify-around pr-[20vw]">
              <div className="flex items-center gap-3">
                {footerSettings.showLogo && <img src={footerSettings.logoUrl} alt="Logo" className="w-5 h-5 object-contain" />}
                <span className="text-[13px] font-medium text-white whitespace-nowrap">
                  {footerSettings.text}
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
