import React, { useRef } from 'react';

// Trusted Types policy (safe fallback)
if (typeof window !== 'undefined' && window.trustedTypes && !window.__safePolicy) {
    window.__safePolicy = window.trustedTypes.createPolicy('safePolicy', {
        createHTML: s => s,
        createScript: s => s,
        createScriptURL: u => u
    });
}
// safeHTML helper (use if Trusted Types policy added earlier)
const safeHTML = (s) =>
  (typeof window !== 'undefined' && window.trustedTypes && window.__safePolicy)
    ? window.__safePolicy.createHTML(s)
    : s;

// Print CSS: ensure comment sections are visible and not removed in print
const printStyles = `
@media print {
  /* ensure comment blocks are printed */
  .comment-section, [data-comment-sent] { 
    display: block !important;
    visibility: visible !important;
    page-break-inside: avoid;
  }
  /* hide UI that should not be printed */
  .no-print { display: none !important; }
  /* keep background colors/graphics if present */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

// helper: make sent-comments visible before printing
function prepareCommentsForPrint() {
  // mark / show any element that has data-comment-sent attribute
  document.querySelectorAll('[data-comment-sent]').forEach(el => {
    el.classList.add('comment-section');
    // if element was hidden via inline styles, clear them for print
    el.style.display = 'block';
    el.style.visibility = 'visible';
  });
}

const SentComments = ({ comments = [] }) => (
  <div className="sent-comments">
    {comments.length === 0 && <div className="no-comments">គ្មានមតិដាក់ផ្ញើ</div>}
    {comments.map((c, i) => (
      <div key={i} className="comment-box" style={{ border: '1px dashed #666', padding: 12, marginBottom: 12 }}>
        <div className="comment-meta" style={{ fontWeight: 'bold', marginBottom: 6 }}>
          {c.title || 'មតិ'}
        </div>
        <div
          className="comment-body"
          dangerouslySetInnerHTML={{ __html: safeHTML(c.html || c.text || '') }}
          style={{ minHeight: 80 }}
        />
      </div>
    ))}
  </div>
);

export default function Replayfile2Page(props) {
  // assume sentComments comes from props or state; adapt as needed
  const sentComments = props.sentComments || []; 
  return (
    <div className="replayfile2-page">
      {/* inject print styles (use safeHTML to satisfy Trusted Types) */}
      <style dangerouslySetInnerHTML={{ __html: safeHTML(printStyles) }} />
      
      {/* ...existing JSX that renders the page... */}

      {/* Example: ensure comment blocks carry data-comment-sent when a comment was sent */}
      {/* ...existing code... */}
      {/* <div className="feedback-block" data-comment-sent={comment.sent ? 'true' : undefined}>
           {comment.text}
         </div> */}

      {/* Print button (no-print so it won't appear on paper) */}
      <button className="no-print" onClick={handlePrint}>Print</button>
    </div>
  );
}