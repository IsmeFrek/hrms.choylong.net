import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children, activeSection, onSectionChange }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // mobile hidden flag
  const [sidebarCompact, setSidebarCompact] = useState(false); // desktop compact flag
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();

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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header (full width) */}
      <header className="sticky top-0 z-40 bg-blue-300 h-16">
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
          className="flex-shrink-0"
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
          className={`flex-1 flex flex-col transition-all duration-200`}
          style={{ marginLeft: isMobile ? 0 : (sidebarCompact ? '4.5rem' : '14rem') }}
        >
          <main className="flex-1 pb-12 p-4">
            <div className="w-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Footer (below main content) */}
      <footer className="fixed bottom-0 left-0 w-full z-50 bg-blue-300 border-t border-gray-200 h-8 flex items-center justify-center">
        <div className="text-sm text-gray-900">Footer</div>
      </footer>
    </div>
  );
};

export default Layout;
