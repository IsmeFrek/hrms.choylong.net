import React from 'react';

// Minimal layout used for pages that should render without the app chrome
// (sidebar/header). It centers the page content and provides a clean
// background so pages like the Replay view can be focused and printable.
export default function MinimalLayout({ children, maxWidth = '1200px' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, background: '#f3f4f6' }}>
      <div style={{ width: '100%', maxWidth, boxSizing: 'border-box' }}>
        {children}
      </div>
    </div>
  );
}
