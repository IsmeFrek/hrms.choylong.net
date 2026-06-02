import usePermission from '../hooks/usePermission';
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { getFileTransfer, updateFileTransfer } from '../api/fileTransfer';
import { API_BASE } from '../config';
import logo3 from '../assets/3.JPG';

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
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-comment-sent]').forEach(el => {
    el.classList.add('comment-section');
    // if element was hidden via inline styles, clear them for print
    el.style.display = 'block';
    el.style.visibility = 'visible';
  });
}
// inject minimal styles and our print CSS
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
  const { user: currentUser } = useAuth() || {};
  const perms = usePermission();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get && searchParams.get('recordId');
  const [record, setRecord] = useState(null);
  const meta = record && (record.meta || {});
  const stages = meta && (meta.feedbackStages || {});
  const [signaturesMap, setSignaturesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePrint = () => {
    prepareCommentsForPrint();
    if (typeof window !== 'undefined') window.print();
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!recordId) return;
      setLoading(true);
      try {
        if (!recordId) return;
        // Use legacy file-transfer API helper to fetch the record
        const data = await getFileTransfer(recordId).catch(e => { throw e; });
        if (mounted) setRecord(data || null);
      } catch (e) {
        console.error('load record error', e);
      } finally {
        setLoading(false);
      }

    };
    load();
    return () => { mounted = false; };
  }, [recordId]);
  // helper: map stage role codes to readable labels
  // Prefer per-record (meta.feedbackStageRoles) mappings when available,
  // otherwise fall back to the built-in map or the raw role code.
  const getRoleLabel = (role) => {
    if (!role && role !== 0) return '';
    const key = String(role).toLowerCase();

    try {
      const roles = meta && meta.feedbackStageRoles;
      if (roles && typeof roles === 'object' && roles[key]) return roles[key];
    } catch (e) {
      // ignore and fall back to static map
    }

    const map = {
      s: 'មន្រ្តីទទួលបន្ទុក',
      s1: 'យោបល់ប្រធានការិយាល័យបច្ចេកទេស',
      s2: 'យោបល់ប្រធានការិយាល័យហិរញ្ញវត្ថុ',
      s3: 'យោបល់ប្រធានការិយាល័យរដ្ឋបាលបុគ្គលិក',
      s4: 'យោបល់នាយករងមន្ទីរពេទ្យ',
      s5: 'យោបល់នាយករងមន្ទីរពេទ្យ',
      s6: 'យោបល់នាយកមន្ទីរពេទ្យ',
      dir: 'យោបល់នាយករងមន្ទីរពេទ្យ',
      ho: 'យោបល់នាយករងមន្ទីរពេទ្យ'
    };

    return map[key] || role;
  };

  // helper: return the preferred initial left/course1 note from meta
  const firstCourse1Note = (m) => {
    try {
      if (!m || typeof m !== 'object') return '';
      // prefer CourseNote, then Course1Note, then centerNote as fallback
      return (m.CourseNote || m.Course1Note || m.centerNote || '') || '';
    } catch (e) { return ''; }
  };

  const [leftContent, setLeftContent] = useState(firstCourse1Note(meta) || '');
  const [s1Content, setS1Content] = useState((meta && meta.Course1Note) || '');
  const [centerContent, setCenterContent] = useState((meta && meta.centerNote) || '');
  const [rightContent, setRightContent] = useState((meta && meta.rightNote) || '');
  const [deptContent, setDeptContent] = useState((meta && meta.Course2Note) || '');
  const [content3, setContent3] = useState((meta && meta.Course3Note) || '');
  const [content4, setContent4] = useState((meta && meta.Course4Note) || '');
  const [content5, setContent5] = useState((meta && meta.Course5Note) || '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveMessageStage, setSaveMessageStage] = useState(null);
  const STAGE_KEYS_BY_META = {
    CourseNote: 'S',
    Course1Note: 'S1',
    Course2Note: 'S2',
    Course3Note: 'S3',
    Course4Note: 'S4',
    Course5Note: 'S5',
    Course6Note: 'S6'
  };
  const stageKeyByMeta = (metaKey) => STAGE_KEYS_BY_META[metaKey] || null;
  const setStageMessage = (message, stageKey = null) => {
    setSaveMessage(message);
    setSaveMessageStage(message ? stageKey : null);
  };
  const clearStageMessage = (stageKey) => {
    if (!stageKey || saveMessageStage === stageKey) {
      setSaveMessage('');
      setSaveMessageStage(null);
    }
  };
  const stageMessageFor = (stageKey) => (saveMessageStage === stageKey ? saveMessage : '');
  const [sendingStage, setSendingStage] = useState(null);
  const autosaveTimer = useRef(null);
  const autosaveTimerDept = useRef(null);
  const autosaveTimerDeputy = useRef(null);
  const autosaveTimerDeputyRight = useRef(null);
  const autosaveTimerHeadOffice = useRef(null);
  const autosaveTimerDirector = useRef(null);
  const autosaveTimer3 = useRef(null);
  const autosaveTimer4 = useRef(null);
  const autosaveTimer5 = useRef(null);
  const initialLoad = useRef(true);
  const courseNoteRef = useRef(null);
  const s1TextareaRef = useRef(null);
  const deptTextareaRef = useRef(null);
  const deputyTextareaRef = useRef(null);
  const deputyRightTextareaRef = useRef(null);
  const directorTextareaRef = useRef(null);
  const headOfficeTextareaRef = useRef(null);
  const textarea3Ref = useRef(null);
  const textarea4Ref = useRef(null);
  const textarea5Ref = useRef(null);
  const [deputyContent, setDeputyContent] = useState((meta && meta.Course3Note) || '');
  const [deputyRightContent, setDeputyRightContent] = useState((meta && meta.Course4Note) || '');
  const [headOfficeContent, setHeadOfficeContent] = useState((meta && meta.Course6Note) || '');
  const [directorContent, setDirectorContent] = useState((meta && meta.Course5Note) || '');
  const [directorStageSel, setDirectorStageSel] = useState(() => {
    try {
      if (!normalizedStages) return '';
      const raw = normalizedStages['S5'] || normalizedStages['DIR'] || normalizedStages['SDIR'];
      if (!raw) return '';
      if (typeof raw === 'object') return raw._id || raw.id || raw.signatureId || raw.senderId || raw.senderName || raw.sender || '';
      return raw;
    } catch (e) { return ''; }
  });
  const [directorOfficeName, setDirectorOfficeName] = useState('');
  const [capturedDate, setCapturedDate] = useState(null);
  const [refUrls, setRefUrls] = useState([]);
  const [selectedRef, setSelectedRef] = useState(null);
  const refIframe = useRef(null);
  const [showLargePreview, setShowLargePreview] = useState(false);
  const sheetRef = useRef(null);
  const refPreviewWrapper = useRef(null);

  // when Course3Note (deputy) is present, avoid showing the centered watermark
  // so it doesn't cover note text in that area
  const showCourse3Note = Boolean((meta && meta.Course3Note) || (deputyContent && deputyContent.trim() !== ''));

  // UI controls for adjusting font size and spacing for print/layout
  const [uiFontSize, setUiFontSize] = useState(15);
  const [isPrinting, setIsPrinting] = useState(false);
  const [uiLineHeight, setUiLineHeight] = useState(1.8);
  const [uiParaBefore, setUiParaBefore] = useState(1); // px
  const [uiParaAfter, setUiParaAfter] = useState(1); // px
  const [hideWatermark, setHideWatermark] = useState(false);
  const [uiPaddingTop, setUiPaddingTop] = useState(5); // mm
  const [uiPaddingLeft, setUiPaddingLeft] = useState(0); // mm
  const [uiPaddingRight, setUiPaddingRight] = useState(10); // mm

  // Display settings (persisted per browser)
  const STAGE_TOGGLE_KEYS = ['S', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  const loadBool = (key, defaultValue) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return defaultValue;
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
      return defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };
  const loadStageSet = (key, defaultStages) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Set(defaultStages);
      const parts = String(raw)
        .split(',')
        .map(s => String(s || '').trim().toUpperCase())
        .filter(Boolean);
      const filtered = parts.filter(s => STAGE_TOGGLE_KEYS.includes(s));
      return new Set(filtered.length ? filtered : defaultStages);
    } catch (e) {
      return new Set(defaultStages);
    }
  };
  const toggleStageInSet = (setState, stageKey) => {
    setState(prev => {
      const next = new Set(prev || []);
      const k = String(stageKey || '').trim().toUpperCase();
      if (!k) return next;
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // default these to false (unchecked) per UX request
  const [showLetterNo, setShowLetterNo] = useState(() => loadBool('replayfile2:showLetterNo', false));
  const [showCreatorName, setShowCreatorName] = useState(() => loadBool('replayfile2:showCreatorName', false));
  // allow manual textarea resize when enabled in settings
  const [manualResizeEnabled, setManualResizeEnabled] = useState(() => loadBool('replayfile2:manualResize', false));
  // Default to hidden for DoAt / Signature / Name stage columns
  const [showDoAtStages, setShowDoAtStages] = useState(() => loadStageSet('replayfile2:showDoAtStages', []));
  const [showSignatureStages, setShowSignatureStages] = useState(() => loadStageSet('replayfile2:showSignatureStages', []));
  const [showNameStages, setShowNameStages] = useState(() => loadStageSet('replayfile2:showNameStages', []));

  useEffect(() => {
    try { localStorage.setItem('replayfile2:showLetterNo', showLetterNo ? '1' : '0'); } catch (e) { }
  }, [showLetterNo]);
  useEffect(() => {
    try { localStorage.setItem('replayfile2:showCreatorName', showCreatorName ? '1' : '0'); } catch (e) { }
  }, [showCreatorName]);
  useEffect(() => {
    try { localStorage.setItem('replayfile2:showDoAtStages', Array.from(showDoAtStages || []).join(',')); } catch (e) { }
  }, [showDoAtStages]);
  useEffect(() => {
    try { localStorage.setItem('replayfile2:showSignatureStages', Array.from(showSignatureStages || []).join(',')); } catch (e) { }
  }, [showSignatureStages]);
  useEffect(() => {
    try { localStorage.setItem('replayfile2:showNameStages', Array.from(showNameStages || []).join(',')); } catch (e) { }
  }, [showNameStages]);

  useEffect(() => {
    try { localStorage.setItem('replayfile2:manualResize', manualResizeEnabled ? '1' : '0'); } catch (e) { }
  }, [manualResizeEnabled]);

  // If the user hasn't selected any toggles yet, treat features as visible by default
  const anyToggleSelected = useMemo(() => {
    try {
      // Only consider per-stage toggles for the "any toggle selected" flag.
      // Toggling LetterNo or CreatorName should not flip stage-default behaviour.
      if (showDoAtStages && showDoAtStages.size > 0) return true;
      if (showSignatureStages && showSignatureStages.size > 0) return true;
      if (showNameStages && showNameStages.size > 0) return true;
    } catch (e) { }
    return false;
  }, [showLetterNo, showCreatorName, showDoAtStages, showSignatureStages, showNameStages]);

  // Do not auto-show fields when nothing is explicitly toggled. All display
  // toggles default to unchecked and must be set by the user.
  const effectiveShowLetterNo = useMemo(() => !!showLetterNo, [showLetterNo]);
  const effectiveShowCreatorName = useMemo(() => !!showCreatorName, [showCreatorName]);
  const effectiveShowDoAt = useCallback((stageKey) => {
    try { return Boolean(showDoAtStages && showDoAtStages.has(stageKey)); } catch (e) { return false; }
  }, [showDoAtStages]);
  const effectiveShowSignature = useCallback((stageKey) => {
    try { return Boolean(showSignatureStages && showSignatureStages.has(stageKey)); } catch (e) { return false; }
  }, [showSignatureStages]);
  const effectiveShowName = useCallback((stageKey) => {
    try { return Boolean(showNameStages && showNameStages.has(stageKey)); } catch (e) { return false; }
  }, [showNameStages]);

  // Migration/initialization: clear legacy `replayfile:` keys and ensure
  // `replayfile2:` keys exist (empty) so new defaults (unchecked) apply
  useEffect(() => {
    try {
      const legacyKeys = ['replayfile:showDoAtStages', 'replayfile:showSignatureStages', 'replayfile:showNameStages', 'replayfile:showLetterNo', 'replayfile:showCreatorName'];
      legacyKeys.forEach(k => { try { if (localStorage.getItem(k) !== null) localStorage.removeItem(k); } catch (e) { } });

      const targets = ['replayfile2:showDoAtStages', 'replayfile2:showSignatureStages', 'replayfile2:showNameStages'];
      targets.forEach(k => { try { if (localStorage.getItem(k) === null) localStorage.setItem(k, ''); } catch (e) { } });

      // ensure the simple boolean keys exist too
      try { if (localStorage.getItem('replayfile2:showLetterNo') === null) localStorage.setItem('replayfile2:showLetterNo', '0'); } catch (e) { }
      try { if (localStorage.getItem('replayfile2:showCreatorName') === null) localStorage.setItem('replayfile2:showCreatorName', '0'); } catch (e) { }
    } catch (e) {
      // ignore storage errors
    }
  }, []);

  // Ensure Ctrl+P (browser print preview) shows the sheet by cloning it into
  // a same-origin iframe right before printing, and removing it after.
  useEffect(() => {
    const onBeforePrint = () => {
      // run async work but don't block the event loop synchronously
      (async () => {
        try {
          const existing = document.getElementById('replay-print-iframe');
          if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
          const el = document.querySelector('.sheet');
          if (!el) return;

          // collect images in the original sheet that use blob: URLs (or relative URLs)
          const imgs = Array.from(el.querySelectorAll('img'));
          const blobMap = {};
          const toConvert = imgs.filter(i => {
            try {
              const s = i.getAttribute && i.getAttribute('src');
              return s && s.startsWith && s.startsWith('blob:');
            } catch (e) { return false; }
          });

          // helper: convert blob: URL to data:URI
          const blobToDataURL = async (blobUrl) => {
            try {
              const res = await fetch(blobUrl);
              const b = await res.blob();
              return await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = reject;
                fr.readAsDataURL(b);
              });
            } catch (e) {
              return null;
            }
          };

          // convert each blob URL to data: URI (in parallel)
          await Promise.all(toConvert.map(async (img) => {
            try {
              const src = img.getAttribute('src');
              const data = await blobToDataURL(src);
              if (data) blobMap[src] = data;
            } catch (e) { }
          }));

          // create iframe for printing
          const iframe = document.createElement('iframe');
          iframe.id = 'replay-print-iframe';
          iframe.style.position = 'fixed';
          iframe.style.left = '50%';
          iframe.style.top = '50%';
          iframe.style.transform = 'translate(-50%, -50%)';
          iframe.style.width = '210mm';
          iframe.style.height = '297mm';
          iframe.style.border = '0';
          iframe.style.zIndex = '2147483646';
          iframe.style.visibility = 'hidden';
          iframe.setAttribute('aria-hidden', 'true');
          document.body.appendChild(iframe);

          const idoc = iframe.contentDocument || iframe.contentWindow.document;
          idoc.open();
          // ensure relative URLs resolve inside the iframe
          try {
            const baseEl = idoc.createElement('base');
            baseEl.href = document.baseURI || window.location.href;
            idoc.head.appendChild(baseEl);
          } catch (e) { }

          // copy stylesheets and inline styles. Recreate <link> elements with
          // absolute `href` so webfonts/CSS referenced by relative paths load
          // correctly inside the iframe. Also clone inline <style> tags.
          try {
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            for (const link of links) {
              try {
                const href = link.getAttribute('href') || '';
                const abs = href && !href.startsWith('data:') && !/^https?:\/\//i.test(href)
                  ? new URL(href, document.baseURI).href
                  : href;

                // try to fetch and inline stylesheet so we can rewrite relative url()s
                try {
                  const res = await fetch(abs, { cache: 'no-store' });
                  if (res && res.ok) {
                    let txt = await res.text();
                    txt = txt.replace(/url\(([^)]+)\)/g, (m, u) => {
                      let url = u.trim().replace(/^['"]|['"]$/g, '');
                      try { if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) url = new URL(url, abs).href; } catch (e) { }
                      return `url('${url}')`;
                    });
                    txt = txt.replace(/@import\s+(?:url\()?['"]?([^'"\)]+)['"]?\)?/g, (m, u) => {
                      try { if (!/^https?:\/\//i.test(u) && !u.startsWith('data:')) u = new URL(u, abs).href; } catch (e) { }
                      return `@import url('${u}')`;
                    });
                    const s = idoc.createElement('style');
                    s.type = 'text/css';
                    s.appendChild(idoc.createTextNode(txt));
                    idoc.head.appendChild(s);
                    continue;
                  }
                } catch (e) {
                  // fetch failed — fall back to link
                }

                const nl = idoc.createElement('link');
                nl.rel = 'stylesheet';
                if (abs) nl.href = abs;
                if (link.media) nl.media = link.media;
                if (link.integrity) nl.integrity = link.integrity;
                try { if (link.crossOrigin) nl.crossOrigin = link.crossOrigin; } catch (e) { }
                idoc.head.appendChild(nl);
              } catch (e) { }
            }
            Array.from(document.querySelectorAll('style')).forEach(s => {
              try { idoc.head.appendChild(s.cloneNode(true)); } catch (e) { }
            });
          } catch (e) { }

          // add a print-only rule to hide everything except the iframe
          const hideStyle = idoc.createElement('style');
          hideStyle.type = 'text/css';
          hideStyle.appendChild(idoc.createTextNode(`
            @media print {
              body > *:not(#replay-print-iframe) { display: none !important; }
              #replay-print-iframe { visibility: visible !important; position: static !important; transform: none !important; width: 210mm !important; height: 297mm !important; }
            }
          `));
          idoc.head.appendChild(hideStyle);

          // clone sheet and replace any blob: image srcs with their data: URIs
          try {
            const clone = el.cloneNode(true);
            try {
              const cloneImgs = Array.from(clone.querySelectorAll('img'));
              cloneImgs.forEach(ci => {
                try {
                  const s = ci.getAttribute && ci.getAttribute('src');
                  if (!s) return;
                  // replace blob: with converted data: URI if available
                  if (blobMap[s]) {
                    ci.setAttribute('src', blobMap[s]);
                  } else if (s && !/^https?:\/\//i.test(s) && !s.startsWith('data:') && document.baseURI) {
                    // make relative src absolute so it resolves inside iframe
                    try { ci.setAttribute('src', new URL(s, document.baseURI).href); } catch (e) { }
                  }
                } catch (e) { }
              });
            } catch (e) { }
            idoc.body.appendChild(clone);
          } catch (e) {
            // fallback: write outerHTML if cloning fails
            try { idoc.body.innerHTML = el.outerHTML; } catch (err) { }
          }

          idoc.close();
        } catch (e) {
          console.warn('onBeforePrint error', e);
        }
      })().catch(e => console.warn('onBeforePrint async error', e));
    };

    const onAfterPrint = () => {
      try { const iframe = document.getElementById('replay-print-iframe'); if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe); } catch (e) { }
    };

    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => { window.removeEventListener('beforeprint', onBeforePrint); window.removeEventListener('afterprint', onAfterPrint); onAfterPrint(); };
  }, [meta, uiFontSize, uiLineHeight, uiPaddingTop]);



  const hasPopulated = useRef(false);

  useEffect(() => {
    if (!record) return;
    if (!hasPopulated.current) {
      setLeftContent(firstCourse1Note(meta) || '');
      setS1Content((meta && meta.Course1Note) || '');
      setCenterContent((meta && meta.centerNote) || '');
      setRightContent((meta && meta.rightNote) || '');
      setDeptContent((meta && meta.Course2Note) || '');
      setContent3((meta && meta.Course3Note) || '');
      setContent4((meta && meta.Course4Note) || '');
      setContent5((meta && meta.Course5Note) || '');
      setDeputyContent((meta && meta.Course3Note) || '');
      setDeputyRightContent((meta && meta.Course4Note) || '');
      setHeadOfficeContent((meta && meta.Course6Note) || '');
      setDirectorContent((meta && meta.Course5Note) || '');
      // skip autosave for the initial population
      initialLoad.current = false;
      hasPopulated.current = true;
    }

    // set captured date from record if available
    if (record && record.date) {
      try {
        const rawDateStr = record.date;
        const parsed = new Date(rawDateStr);
        // Detect date-only strings that use midnight or UTC marker (e.g. "T00:00:00Z" or "+00:00").
        let isDateOnly = false;
        try {
          if (typeof rawDateStr === 'string') {
            if (/T00:00:00(?:\.000)?(?:Z|\+00:00)?$/.test(rawDateStr)) isDateOnly = true;
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateStr)) isDateOnly = true;
          }
        } catch (e) { }

        if (isDateOnly || (parsed.getHours && parsed.getHours() === 0 && parsed.getMinutes && parsed.getMinutes() === 0)) {
          const now = new Date();
          parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        }
        setCapturedDate(parsed);
        // If meta has a per-course saved date (e.g. Course3Date for deputy), prefer it
        if (meta && meta.Course3Date) {
          try {
            const rawM = meta.Course3Date;
            const m = new Date(rawM);
            let isMetaDateOnly = false;
            try {
              if (typeof rawM === 'string') {
                if (/T00:00:00(?:\.000)?(?:Z|\+00:00)?$/.test(rawM)) isMetaDateOnly = true;
                if (/^\d{4}-\d{2}-\d{2}$/.test(rawM)) isMetaDateOnly = true;
              }
            } catch (e) { }
            if (isMetaDateOnly || (m.getHours && m.getHours() === 0 && m.getMinutes && m.getMinutes() === 0)) {
              const now2 = new Date();
              m.setHours(now2.getHours(), now2.getMinutes(), now2.getSeconds());
            }
            setCapturedDate(m);
          } catch (e) { /* ignore */ }
        }
      } catch (e) {
        setCapturedDate(new Date());
      }
    } else {
      setCapturedDate(new Date());
    }
  }, [record]);

  // If `record.createdBy` is a scalar id and not present in signaturesMap,
  // attempt to fetch that single signature so we can show the creator's name.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cb = record && record.createdBy;
        if (!cb || typeof cb === 'object') return;
        if (signaturesMap && signaturesMap[cb]) return; // already have it
        // try to fetch a signature by id
        try {
          const res = await api.get(`/signatures/${encodeURIComponent(cb)}`);
          const sig = res && res.data;
          if (mounted && sig) {
            setSignaturesMap(prev => ({ ...(prev || {}), [cb]: sig }));
          }
        } catch (e) {
          // ignore — not all createdBy values map to signatures
        }
      } catch (e) { }
    })();
    return () => { mounted = false; };
  }, [record && record.createdBy, signaturesMap]);

  // gather candidate reference attachments/URLs from the record
  useEffect(() => {
    if (!record) { setRefUrls([]); setSelectedRef(null); return; }

    const items = [];
    const push = (name, a) => {
      try {
        if (!a && a !== 0) return;
        let url = attachmentUrl(a);
        // if attachmentUrl couldn't build a url, try fallback for plain filenames
        if (!url) {
          const s = (typeof a === 'string') ? a : (a && (a.name || a.filename || a.url || a.filePath || a.path));
          if (s && String(s).trim()) {
            url = `${API_BASE.replace(/\/+$/, '')}/Uploads/${encodeURIComponent(String(s).trim())}`;
          }
        }
        if (!url) return;
        items.push({ name: name || (typeof a === 'string' ? a : (a && (a.name || a.filename || a.url))) || url, url });
      } catch (e) {
        // ignore
      }
    };

    // prioritize explicit attachments/files arrays if present
    if (record.attachments && Array.isArray(record.attachments) && record.attachments.length) {
      record.attachments.forEach(a => push(a.name || a.filename || a.url || a, a));
    }
    if (record.files && Array.isArray(record.files) && record.files.length) {
      record.files.forEach(a => push(a.name || a.filename || a.url || a, a));
    }

    // common single-value fields (explicit mapping)
    const singleFields = ['filePath', 'file', 'attachment', 'url', 'document', 'letterFile', 'filename', 'ref_url', 'reference', 'letterFilePath', 'letterFileUrl'];
    singleFields.forEach(k => {
      if (record[k]) push(k, record[k]);
    });

    // also check meta for attachments
    if (record.meta && typeof record.meta === 'object') {
      const m = record.meta;
      if (m.attachments && Array.isArray(m.attachments)) m.attachments.forEach(a => push(a.name || a.filename || a.url || a, a));
      if (m.files && Array.isArray(m.files)) m.files.forEach(a => push(a.name || a.filename || a.url || a, a));
      if (m.file) push('meta.file', m.file);
      if (m.ref_url) push('meta.ref_url', m.ref_url);
    }

    // deep scan for strings or keys that look like uploads, pdfs or images
    const uploadRegex = /(uploads?\/.+\.(pdf|jpg|jpeg|png|gif|bmp))|(\.pdf$)|(\.(jpg|jpeg|png|gif|bmp)$)|(https?:\/\/)/i;
    const scan = (obj, depth = 0) => {
      if (!obj || depth > 6) return;
      if (typeof obj === 'string') {
        const s = obj.trim();
        if (!s) return;
        // try to capture likely file strings
        if (uploadRegex.test(s) || s.toLowerCase().startsWith('http') || s.toLowerCase().endsWith('.pdf') || s.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/i.test(s))) {
          push(s, s);
        }
        return;
      }
      if (Array.isArray(obj)) return obj.forEach(o => scan(o, depth + 1));
      if (typeof obj === 'object') {
        Object.keys(obj).forEach(k => {
          const v = obj[k];
          // prefer keys that mention file/attach/upload/url/path
          if (/file|attach|upload|url|path|src|document|pdf|image|filename/i.test(k)) {
            if (typeof v === 'string') push(k, v);
            else if (typeof v === 'object' && (v.url || v.filePath || v.path || v.name || v.filename)) {
              push(v.name || v.filename || v.url || v.filePath || v.path, v);
            } else scan(v, depth + 1);
          } else {
            // still scan deeper for any strings that match
            scan(v, depth + 1);
          }
        });
      }
    };
    try { scan(record); } catch (e) { /* ignore */ }

    // dedupe by url
    const uniq = [];
    const seen = new Set();
    for (const it of items) {
      if (!it || !it.url) continue;
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      uniq.push(it);
    }

    // log for debugging
    try {
      console.debug('Replay: found attachment URLs', uniq.map(u => u.url));
    } catch (e) { }

    setRefUrls(uniq);
    setSelectedRef(uniq.length ? uniq[0].url : null);
  }, [record]);

  // expose record for debugging in devtools and log (only in browser)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // expose for quick inspection in browser console
      window.__REPLAY_RECORD = record;
      console.debug('Replay record for debugging:', record);
    } catch (e) {
      // ignore in restricted env
    }
  }, [record]);

  // helper to extract attachment hints for debugging display
  const getAttachmentHints = (r) => {
    if (!r) return [];
    const hints = [];
    const add = (path, val) => {
      try {
        let s = '';
        if (typeof val === 'string') s = val;
        else if (typeof val === 'object') s = JSON.stringify(val).slice(0, 200);
        else s = String(val);
        if (s && (s.includes('/Uploads/') || s.toLowerCase().includes('.pdf') || s.toLowerCase().startsWith('http') || /\.(jpg|jpeg|png|gif|bmp)$/i.test(s))) {
          hints.push({ path, excerpt: s });
        }
      } catch (e) {
        // ignore
      }
    };
    // first-level
    Object.keys(r || {}).forEach(k => add(k, r[k]));
    // meta
    if (r.meta && typeof r.meta === 'object') Object.keys(r.meta).forEach(k => add(`meta.${k}`, r.meta[k]));
    // attachments/files arrays (first 10)
    if (Array.isArray(r.attachments)) r.attachments.slice(0, 10).forEach((a, i) => add(`attachments[${i}]`, a));
    if (Array.isArray(r.files)) r.files.slice(0, 10).forEach((a, i) => add(`files[${i}]`, a));
    return hints;
  };

  // Autosave leftContent after a debounce when the user edits.
  useEffect(() => {
    // clear previous timer
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }

    // don't autosave until initial population has happened
    if (initialLoad.current) return undefined;

    // if there is no record yet or content equals server meta, skip
    if (!record) return undefined;
    const serverNote = (meta && meta.CourseNote) || '';
    if ((leftContent || '') === (serverNote || '')) return undefined;

    // set a debounce timer to autosave
    setStageMessage('កំពុងរក្សាទុក...', 'S');
    autosaveTimer.current = setTimeout(() => {
      // call saveNote (will set messages)
      saveNote();
    }, 1500);

    // cleanup
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [leftContent]);

  // Autosave s1Content (Stage 1) after a debounce when the S1 textarea edits.
  useEffect(() => {
    if (autosaveTimer.current && typeof autosaveTimer.current === 'number') {
      // reuse autosaveTimer for single-field cases; clear if set
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }

    // don't autosave until initial population has happened
    if (initialLoad.current) return undefined;

    if (!record) return undefined;
    const serverNote = (meta && meta.Course1Note) || '';
    if ((s1Content || '') === (serverNote || '')) return undefined;

    setStageMessage('កំពុងរក្សាទុក...', 'S1');
    autosaveTimer.current = setTimeout(() => {
      saveStageNote('Course1Note', s1Content || '');
    }, 1500);

    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [s1Content]);

  // Autosave deptContent after a debounce when the department head edits.
  useEffect(() => {
    if (autosaveTimerDept.current) {
      clearTimeout(autosaveTimerDept.current);
      autosaveTimerDept.current = null;
    }
    if (initialLoad.current) return undefined;
    if (!record) return undefined;
    const serverNote = (meta && meta.Course2Note) || '';
    if ((deptContent || '') === (serverNote || '')) return undefined;
    setStageMessage('កំពុងរក្សាទុក...', 'S2');
    autosaveTimerDept.current = setTimeout(() => {
      saveDeptNote();
    }, 1500);
    return () => {
      if (autosaveTimerDept.current) {
        clearTimeout(autosaveTimerDept.current);
        autosaveTimerDept.current = null;
      }
    };
  }, [deptContent]);

  // Autosave deputyContent after a debounce when the deputy edits.
  useEffect(() => {
    if (autosaveTimerDeputy.current) {
      clearTimeout(autosaveTimerDeputy.current);
      autosaveTimerDeputy.current = null;
    }
    if (initialLoad.current) return undefined;
    if (!record) return undefined;
    const serverNote = (meta && meta.Course3Note) || '';
    if ((deputyContent || '') === (serverNote || '')) return undefined;
    setStageMessage('កំពុងរក្សាទុក...', 'S3');
    autosaveTimerDeputy.current = setTimeout(() => {
      saveCourse3Note();
    }, 1500);
    return () => {
      if (autosaveTimerDeputy.current) {
        clearTimeout(autosaveTimerDeputy.current);
        autosaveTimerDeputy.current = null;
      }
    };
  }, [deputyContent]);

  // Autosave deputyRightContent after a debounce when the right deputy edits.
  useEffect(() => {
    if (autosaveTimerDeputyRight.current) {
      clearTimeout(autosaveTimerDeputyRight.current);
      autosaveTimerDeputyRight.current = null;
    }
    if (initialLoad.current) return undefined;
    if (!record) return undefined;
    const serverNote = (meta && meta.Course4Note) || '';
    if ((deputyRightContent || '') === (serverNote || '')) return undefined;
    setStageMessage('កំពុងរក្សាទុក...', 'S4');
    autosaveTimerDeputyRight.current = setTimeout(() => {
      saveCourse4Note();
    }, 1500);
    return () => {
      if (autosaveTimerDeputyRight.current) {
        clearTimeout(autosaveTimerDeputyRight.current);
        autosaveTimerDeputyRight.current = null;
      }
    };
  }, [deputyRightContent]);

  // Autosave directorContent after a debounce when the director edits.
  useEffect(() => {
    if (autosaveTimerDirector.current) {
      clearTimeout(autosaveTimerDirector.current);
      autosaveTimerDirector.current = null;
    }
    if (initialLoad.current) return undefined;
    if (!record) return undefined;
    const serverNote = (meta && meta.Course5Note) || '';
    if ((directorContent || '') === (serverNote || '')) return undefined;
    setStageMessage('កំពុងរក្សាទុក...', 'S5');
    autosaveTimerDirector.current = setTimeout(() => {
      saveCourse5Note();
    }, 1500);
    return () => {
      if (autosaveTimerDirector.current) {
        clearTimeout(autosaveTimerDirector.current);
        autosaveTimerDirector.current = null;
      }
    };
  }, [directorContent]);

  // Autosave headOfficeContent after a debounce when the head of office edits.
  useEffect(() => {
    if (autosaveTimerHeadOffice.current) {
      clearTimeout(autosaveTimerHeadOffice.current);
      autosaveTimerHeadOffice.current = null;
    }
    if (initialLoad.current) return undefined;
    if (!record) return undefined;
    const serverNote = (meta && meta.Course6Note) || '';
    if ((headOfficeContent || '') === (serverNote || '')) return undefined;
    setStageMessage('កំពុងរក្សាទុក...', 'S6');
    autosaveTimerHeadOffice.current = setTimeout(() => {
      saveCourse6Note();
    }, 1500);
    return () => {
      if (autosaveTimerHeadOffice.current) {
        clearTimeout(autosaveTimerHeadOffice.current);
        autosaveTimerHeadOffice.current = null;
      }
    };
  }, [headOfficeContent]);

  // Autosave content3..6
  useEffect(() => {
    if (autosaveTimer3.current) { clearTimeout(autosaveTimer3.current); autosaveTimer3.current = null; }
    if (initialLoad.current) return undefined;
    if (!record) return undefined;
    const serverNote = (meta && meta.Course3Note) || '';
    if ((content3 || '') === (serverNote || '')) return undefined;
    autosaveTimer3.current = setTimeout(() => { saveStageNote('Course3Note', content3); }, 1500);
    return () => { if (autosaveTimer3.current) { clearTimeout(autosaveTimer3.current); autosaveTimer3.current = null; } };
  }, [content3]);

  useEffect(() => {
    if (autosaveTimer4.current) { clearTimeout(autosaveTimer4.current); autosaveTimer4.current = null; }
    if (initialLoad.current) return undefined;
    if (!record) return undefined;
    const serverNote = (meta && meta.Course4Note) || '';
    if ((content4 || '') === (serverNote || '')) return undefined;
    autosaveTimer4.current = setTimeout(() => { saveStageNote('Course4Note', content4); }, 1500);
    return () => { if (autosaveTimer4.current) { clearTimeout(autosaveTimer4.current); autosaveTimer4.current = null; } };
  }, [content4]);

  useEffect(() => {
    if (autosaveTimer5.current) { clearTimeout(autosaveTimer5.current); autosaveTimer5.current = null; }
    if (initialLoad.current) return undefined;
    if (!record) return undefined;
    const serverNote = (meta && meta.Course5Note) || '';
    if ((content5 || '') === (serverNote || '')) return undefined;
    autosaveTimer5.current = setTimeout(() => { saveStageNote('Course5Note', content5); }, 1500);
    return () => { if (autosaveTimer5.current) { clearTimeout(autosaveTimer5.current); autosaveTimer5.current = null; } };
  }, [content5]);

  useEffect(() => {
    // Course6 is handled by Head of Office (`headOfficeContent`) autosave
  }, []);

  const safeResize = (el) => {
    if (!el || manualResizeEnabled) return;
    const MIN_H = 24;
    // Don't shrink while focused so Khmer IME composition isn't interrupted
    if (document.activeElement !== el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, MIN_H)}px`;
    } else if (el.scrollHeight > el.clientHeight || el.style.height === 'auto' || el.style.height === '') {
      el.style.height = `${Math.max(el.scrollHeight, MIN_H)}px`;
    }
  };

  // Adjust textarea height to fit content (auto-resize) for CourseNote textarea
  useEffect(() => {
    safeResize(courseNoteRef.current);
  }, [leftContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter, manualResizeEnabled]);

  // autosize for S1 textarea (Stage 1)
  useEffect(() => {
    safeResize(s1TextareaRef.current);
  }, [s1Content, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter, manualResizeEnabled]);

  // autosize for department textarea
  useEffect(() => {
    safeResize(deptTextareaRef.current);
  }, [deptContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter, manualResizeEnabled]);

  // autosize for deputy textarea
  useEffect(() => {
    safeResize(deputyTextareaRef.current);
  }, [deputyContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter, manualResizeEnabled]);

  // autosize for deputy-right textarea
  useEffect(() => {
    safeResize(deputyRightTextareaRef.current);
  }, [deputyRightContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter, manualResizeEnabled]);

  // autosize for director textarea
  useEffect(() => {
    safeResize(directorTextareaRef.current);
  }, [directorContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter, manualResizeEnabled]);

  // autosize for head office textarea
  useEffect(() => {
    safeResize(headOfficeTextareaRef.current);
  }, [headOfficeContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter, manualResizeEnabled]);

  const printPage = () => window.print();

  // Shared function to produce the print CSS used by both programmatic prints
  // and the browser's Ctrl+P (beforeprint). Keep in sync with printSheetDirect.
  const getPrintCss = (scale = 1, marginMM = null) => {
    const scaledFontSize = Math.max(8, Math.round(uiFontSize * scale));
    const scaledPaddingTop = Math.max(0, (uiPaddingTop * scale).toFixed(2));
    // if marginMM not provided, derive as average of left/right UI paddings
    const left = Number(uiPaddingLeft || 0);
    const right = Number(uiPaddingRight || 0);
    const mm = (marginMM === null || marginMM === undefined) ? ((left + right) / 2) : Number(marginMM || 0);
    const mmStr = Number(mm || 0).toFixed(2);
    const widthCalc = `calc(210mm - ${Number(mm * 2).toFixed(2)}mm)`;
    return `@page { 
          size: A4; 
          margin: 0mm ${mmStr}mm 3mm ${mmStr}mm; 
        }
        @media print {
          html, body { 
            height: auto !important; 
            background: #fff !important; 
            margin: 0 !important; 
            padding: 0 !important; 
          }
          body * { visibility: hidden !important; }
          .sheet, .sheet * { visibility: visible !important; }
          .sheet { 
            /* place sheet at the very top of the printed page safe area */
            position: absolute !important; 
            left: ${mmStr}mm !important; 
            top: 0mm !important; 
            /* Fit to printable width (account for left+right margins) */
            width: ${widthCalc} !important;
            min-width: 0 !important;
            margin: 0 !important; 
            box-shadow: none !important; 
            padding: 0 !important;
            border: none !important;
            box-sizing: border-box !important;
            display: block !important;
            background: #fff !important;
            /* limit sheet height to printable area (page height minus top+bottom margins and header allowance) */
            max-height: calc(297mm - 13mm) !important;
            page-break-inside: auto !important;
            page-break-after: avoid !important;
            overflow: visible !important;
            transform: none !important;
          }

          .page { 
            height: auto !important; 
            max-height: none !important;
            min-height: auto !important;
            /* ensure page content stays inside horizontal safe area */
            padding: 0mm !important;
            padding-left: 0mm !important;
            padding-right: 0mm !important;
            /* remove top padding for printed output so content sits at the very top */
            padding-top: 0mm !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            page-break-inside: auto !important;
            font-family: 'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif' !important;
            color: #000 !important;
            font-size: ${scaledFontSize}px !important;
            page-break-after: avoid !important;
            line-height: ${uiLineHeight} !important;
          }

          .field { 
            page-break-inside: avoid !important;
          }

          .print-hide { display: none !important; }
          nav, header, footer, .no-print { display: none !important; }
          /* S6 note print helpers: hide screen preview, show print-only centered note */
          .s6-note-screen { display: none !important; }
          .s6-note-print { display: block !important; white-space: pre-wrap !important; word-break: break-all !important; overflow-wrap: anywhere !important; text-align: center !important; }
        }`;
  };

  // Print only the sheet content without opening a new tab/window.
  // We inject a temporary stylesheet that hides all elements except `.sheet` during printing,
  // then call `window.print()` and clean up after printing.
  const printSheet = async () => {
    if (isPrinting) {
      console.log('Print already in progress');
      return;
    }
    setIsPrinting(true);
    try {
      const el = document.querySelector('.sheet');
      if (!el) {
        console.warn('Sheet element not found, using default print');
        setIsPrinting(false);
        return printPage();
      }

      // Open a new window and write the sheet HTML + print CSS there.
      const printWin = window.open('', '_blank');
      if (!printWin) {
        console.warn('Unable to open print window; falling back to in-page print');
        setIsPrinting(false);
        return printPage();
      }

      // Avoid copying the entire page styles (some apps include print rules
      // that hide body content). Use a minimal head and inject our print CSS
      // only so the sheet remains visible in the new window.
      const headHtml = '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>body{margin:0;padding:0;font-family:\'Khmer OS Siemreap\',\'Noto Sans Khmer\',Arial,sans-serif;color:#000;background:#fff}</style>';

      // compute a conservative scale (fallback to 1)
      const computeScale = (targetEl) => {
        try {
          if (!targetEl) return 1;
          const tmp = document.createElement('div');
          tmp.style.position = 'absolute';
          tmp.style.left = '-9999px';
          tmp.style.height = '297mm';
          document.body.appendChild(tmp);
          const pagePx = tmp.getBoundingClientRect().height || (297 * 3.78);
          document.body.removeChild(tmp);
          const printablePx = pagePx - (8 * 2) * (pagePx / 297) - (10 * (pagePx / 297));
          const elH = targetEl.getBoundingClientRect().height || targetEl.offsetHeight || 1;
          const scale = printablePx / elH;
          return Math.min(1, Math.max(0.4, scale));
        } catch (e) { return 1; }
      };

      const scale = computeScale(el);
      const css = getPrintCss(scale);

      // Build the print document via DOM methods to avoid Trusted Types/innerHTML issues
      printWin.document.open();
      const pd = printWin.document;
      // clear any existing content
      try { while (pd.body && pd.body.firstChild) pd.body.removeChild(pd.body.firstChild); } catch (e) { }
      // set basic head/meta
      try {
        pd.title = document.title || '';
        const meta = pd.createElement('meta');
        meta.charset = 'utf-8';
        pd.head.appendChild(meta);
        // base href so relative CSS/IMG URLs continue to work in the new window
        try {
          const base = pd.createElement('base');
          base.href = document.baseURI || window.location.href;
          pd.head.appendChild(base);
        } catch (e) { }
      } catch (e) { }

      // inject minimal styles and our print CSS, then recreate stylesheet links
      try {
        const baseStyle = pd.createElement('style');
        baseStyle.type = 'text/css';
        baseStyle.textContent = "body{margin:0;padding:0;font-family:'Khmer OS Siemreap','Noto Sans Khmer',Arial,sans-serif;color:#000;background:#fff;}";
        pd.head.appendChild(baseStyle);
        const printStyle = pd.createElement('style');
        printStyle.type = 'text/css';
        printStyle.textContent = css;
        pd.head.appendChild(printStyle);

        // recreate stylesheet links as absolute hrefs so fonts and CSS load
        try {
          Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach(link => {
            try {
              const href = link.getAttribute('href') || '';
              const abs = href && !href.startsWith('data:') && !/^https?:\/\//i.test(href)
                ? new URL(href, document.baseURI).href
                : href;
              const nl = pd.createElement('link');
              nl.rel = 'stylesheet';
              if (abs) nl.href = abs;
              if (link.media) nl.media = link.media;
              if (link.integrity) nl.integrity = link.integrity;
              try { if (link.crossOrigin) nl.crossOrigin = link.crossOrigin; } catch (e) { }
              pd.head.appendChild(nl);
            } catch (e) { }
          });
          Array.from(document.querySelectorAll('style')).forEach(s => {
            try { pd.head.appendChild(s.cloneNode(true)); } catch (e) { }
          });
        } catch (e) { }
      } catch (e) { }

      // clone the sheet node into the print document
      try {
        const clone = el.cloneNode(true);
        // remove any data attributes that might cause scripts to run
        try { clone.querySelectorAll && clone.querySelectorAll('[data-reactroot],[data-reactid]').forEach(n => { n.removeAttribute && n.removeAttribute('data-reactroot'); n.removeAttribute && n.removeAttribute('data-reactid'); }); } catch (e) { }
        pd.body.appendChild(clone);
      } catch (e) {
        // fallback: write outerHTML if cloning fails
        try { pd.body.innerHTML = el.outerHTML; } catch (err) { }
      }

      pd.close();
      try { printWin.focus(); } catch (e) { }

      // Wait for all images in the print window to finish loading
      const images = Array.from(pd.images);
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve; // proceed even if image fails to load
        });
      }));

      // Give the new window a moment to render before printing
      setTimeout(() => {
        try {
          printWin.print();
        } catch (e) {
          console.error('Print window error', e);
        }
        // close the window shortly after printing
        setTimeout(() => {
          try { printWin.close(); } catch (e) { }
          setIsPrinting(false);
        }, 800);
      }, 250);
    } catch (e) {
      console.error('Error in printSheet (new-window) function:', e);
      setIsPrinting(false);
      printPage();
    }
  };

  // Inject same print stylesheet for browser-initiated printing (Ctrl+P)
  useEffect(() => {
    const onBefore = () => {
      try {
        let s = document.getElementById('print-sheet-style');
        // compute scale from current sheet to try to fit on one page
        const el = document.querySelector('.sheet');
        const computeScale = (targetEl) => {
          try {
            if (!targetEl) return 1;
            const tmp = document.createElement('div');
            tmp.style.position = 'absolute';
            tmp.style.left = '-9999px';
            tmp.style.height = '297mm';
            document.body.appendChild(tmp);
            const pagePx = tmp.getBoundingClientRect().height || (297 * 3.78);
            document.body.removeChild(tmp);
            const marginMm = 8;
            const headerAllowMm = 10;
            const printablePx = pagePx - (marginMm * 2) * (pagePx / 297) - (headerAllowMm * (pagePx / 297));
            const elH = targetEl.getBoundingClientRect().height || targetEl.offsetHeight || 1;
            const scale = printablePx / elH;
            return Math.min(1, Math.max(0.4, scale));
          } catch (e) { return 1; }
        };

        const scale = computeScale(el);
        if (!s) {
          s = document.createElement('style');
          s.id = 'print-sheet-style';
          s.type = 'text/css';
          s.appendChild(document.createTextNode(getPrintCss(scale)));
          document.head.appendChild(s);
        } else {
          s.textContent = getPrintCss(scale);
        }
      } catch (e) {
        console.warn('beforeprint handler failed to inject print css', e);
      }
    };

    const onAfter = () => {
      try {
        const s = document.getElementById('print-sheet-style');
        if (s && s.parentNode) s.parentNode.removeChild(s);
      } catch (e) {
        console.warn('afterprint cleanup failed', e);
      }
      try {
        const iframe = document.getElementById('print-iframe');
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch (e) { }
      try {
        const hs = document.getElementById('print-hide-everything');
        if (hs && hs.parentNode) hs.parentNode.removeChild(hs);
      } catch (e) { }
    };

    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);

    const mq = window.matchMedia && window.matchMedia('print');
    const mqHandler = (m) => { if (m.matches) onBefore(); else onAfter(); };
    if (mq && mq.addListener) mq.addListener(mqHandler);

    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
      if (mq && mq.removeListener) mq.removeListener(mqHandler);
    };
  }, [uiPaddingTop, uiFontSize, uiLineHeight]);

  const printRef = () => {
    if (!selectedRef) return;
    // Try printing the shown iframe if same-origin
    try {
      if (refIframe && refIframe.current && refIframe.current.contentWindow) {
        try {
          refIframe.current.contentWindow.focus();
          refIframe.current.contentWindow.print();
          return;
        } catch (e) {
          // could be cross-origin; fallthrough to fetch approach
        }
      }
    } catch (e) {
      // ignore and fallback
    }

    // Attempt to fetch the resource and print via a same-origin blob URL iframe
    (async () => {
      try {
        const res = await fetch(selectedRef, { credentials: 'same-origin' });
        if (!res || !res.ok) throw new Error('Fetch failed');
        const ct = res.headers.get('content-type') || '';
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        // create hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '0';
        iframe.style.top = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        iframe.src = url;
        document.body.appendChild(iframe);

        const cleanup = () => {
          try { if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe); } catch (e) { }
          try { URL.revokeObjectURL(url); } catch (e) { }
          window.removeEventListener('message', msgHandler);
        };

        const msgHandler = () => { };

        // when iframe loads, print it
        iframe.onload = () => {
          try {
            const iw = iframe.contentWindow;
            if (iw) {
              iw.focus();
              // attempt to print; some browsers may block or not allow programmatic print for PDFs
              try { iw.print(); } catch (e) { /* ignore */ }
            }
          } catch (e) {
            // ignore
          }
          // schedule cleanup
          setTimeout(cleanup, 1500);
        };
      } catch (e) {
        // fallback: open new tab so user can print manually
        const w = window.open(selectedRef, '_blank');
        if (w) w.focus();
      }
    })();
  };

  const resolveStageId = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val._id || val.id || val.signature || null;
    return null;
  };

  // Normalize `stages` (which may be an object or an array) into a map
  const normalizedStages = useMemo(() => {
    try {
      const s = stages || (meta && meta.feedbackStages) || {};
      if (!s) return {};
      if (Array.isArray(s)) {
        const map = {};
        s.forEach(item => {
          if (!item) return;
          const key = (item._key || item.key || item.stageKey || item.stage || item.name || '').toString().toUpperCase();
          if (key) map[key] = item;
          else if (item._id) map[item._id] = item;
        });
        return map;
      }
      if (typeof s === 'object') {
        // normalize object keys to uppercase so lookups like normalizedStages['S1'] work
        try {
          const map = {};
          Object.keys(s).forEach((k) => {
            try {
              map[String(k).toUpperCase()] = s[k];
            } catch (e) {
              map[k] = s[k];
            }
          });
          return map;
        } catch (e) {
          return s;
        }
      }
      return {};
    } catch (e) {
      return {};
    }
  }, [stages, meta]);

  const sigFor = (stageKey) => {
    const raw = normalizedStages && normalizedStages[stageKey];
    if (!raw) return null;
    const id = resolveStageId(raw);
    if (!id) return null;
    return signaturesMap[id] || null;
  };

  const signatureUrl = (sig) => {
    if (!sig) return null;
    const fp = sig.filePath || sig.file || sig.filePath;
    if (!fp) return null;
    // avoid double slashes if API_BASE already ends with '/'
    return `${API_BASE.replace(/\/$/, '')}${fp.startsWith('/') ? '' : '/'}${fp}`;
  };

  // Helper: resolve a human-friendly sender name for one or more stage keys.
  // Accepts a single key string or an array of keys (in priority order).
  const getStageSenderName = (keys) => {
    try {
      const ks = Array.isArray(keys) ? keys : [keys];
      // If a feedbackSenderName was saved in meta, prefer it for the main 'S' stage.
      try {
        if (meta && meta.feedbackSenderName) {
          const hasS = ks.some(k => String(k).toUpperCase() === 'S');
          if (hasS) return String(meta.feedbackSenderName).replace(/\s*\([^)]+\)\s*$/, '').trim();
        }
      } catch (e) { /* ignore */ }
      for (const k of ks) {
        if (!k) continue;
        const raw = normalizedStages && normalizedStages[k];
        if (raw) {
          if (typeof raw === 'object') {
            const n = raw.senderName || raw.sender || raw.name;
            if (n) return String(n).replace(/\s*\([^)]+\)\s*$/, '').trim();
          }
          const id = resolveStageId(raw);
          if (id && signaturesMap && signaturesMap[id]) {
            const s = signaturesMap[id];
            const n = (s && (s.fullNameKh || s.fullName || s.name));
            if (n) return String(n).replace(/\s*\([^)]+\)\s*$/, '').trim();
          }
        }
        // stage-specific meta fallbacks
        if (k === 'S') {
          if (meta && meta.reporterName) return String(meta.reporterName).replace(/\s*\([^)]+\)\s*$/, '').trim();
        }
        if (k === 'S1') {
          if (s1Content && String(s1Content).trim() !== '') return String(s1Content).replace(/\s*\([^)]+\)\s*$/, '').trim();
          if (stages && stages.s1) return String(stages.s1).replace(/\s*\([^)]+\)\s*$/, '').trim();
        }
        if (k === 'S2') {
          if (meta && meta.departmentHead) return String(meta.departmentHead).replace(/\s*\([^)]+\)\s*$/, '').trim();
        }
        if (k === 'SD' || k === 'S3') {
          if (meta && meta.deputyName) return String(meta.deputyName).replace(/\s*\([^)]+\)\s*$/, '').trim();
        }
        if (k === 'SDR' || k === 'S4') {
          if (meta && meta.deputyRightName) return String(meta.deputyRightName).replace(/\s*\([^)]+\)\s*$/, '').trim();
        }
        if (k === 'S5' || k === 'DIR' || k === 'SDIR') {
          if (meta && meta.directorName) return String(meta.directorName).replace(/\s*\([^)]+\)\s*$/, '').trim();
        }
        if (k === 'S6' || k === 'HO') {
          if (meta && meta.headOfficeName) return String(meta.headOfficeName).replace(/\s*\([^)]+\)\s*$/, '').trim();
        }
      }
    } catch (e) {
      // ignore
    }
    return '';
  };

  // Build a client URL for an attachment name/path
  const attachmentUrl = (a) => {
    if (!a) return null;
    try {
      const s = (typeof a === 'string') ? a : (a.name || a.url || '');
      if (!s) return null;
      if (s.startsWith('http')) return s;
      if (s.startsWith('/')) return `${API_BASE.replace(/\/$/, '')}${s}`;
      const idx = s.indexOf('/Uploads/');
      if (idx >= 0) return `${API_BASE.replace(/\/$/, '')}${s.slice(idx)}`;
      // fallback: assume filename under /Uploads/
      return `${API_BASE.replace(/\/$/, '')}/Uploads/${encodeURIComponent(s)}`;
    } catch (e) {
      return null;
    }
  };

  const saveNote = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta('CourseNote');
    setSaving(true);
    setStageMessage('កំពុងរក្សាទុក...', stageKey);
    try {
      const id = record._id || record.id;
      const now = new Date();
      const newMeta = { ...(meta || {}), CourseNote: leftContent, CourseDate: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      // update local record with returned item if available
      const updated = (res && (res.item || res)) || null;
      if (updated) {
        // some endpoints return { item: updated }
        setRecord(updated.item || updated);
      } else {
        // fallback: update meta locally
        setRecord(r => ({ ...(r || {}), meta: newMeta }));
      }
      setStageMessage('រក្សាទុកបានសម្រេច', stageKey);
      // set captured date to now on successful save
      setCapturedDate(now);
    } catch (err) {
      console.error('Failed to save note', err);
      setStageMessage('រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត', stageKey);
    } finally {
      setSaving(false);
    }
  };

  const saveDeptNote = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta('Course2Note');
    setSaving(true);
    setStageMessage('កំពុងរក្សាទុក...', stageKey);
    try {
      const id = record._id || record.id;
      const now = new Date();
      const newMeta = { ...(meta || {}), Course2Note: deptContent, Course2Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = (res && (res.item || res)) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord(r => ({ ...(r || {}), meta: newMeta }));
      }
      setStageMessage('រក្សាទុកបានសម្រេច', stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error('Failed to save dept note', err);
      setStageMessage('រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត', stageKey);
    } finally {
      setSaving(false);
    }

  };

  // save deputy note (Deputy director)
  const saveCourse3Note = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta('Course3Note');
    setSaving(true);
    setStageMessage('កំពុងរក្សាទុក...', stageKey);
    try {
      const id = record._id || record.id;
      // Save deputy note and record the date it was filled
      const now = new Date();
      const newMeta = { ...(meta || {}), Course3Note: deputyContent, Course3Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = (res && (res.item || res)) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord(r => ({ ...(r || {}), meta: newMeta }));
      }
      setStageMessage('រក្សាទុកបានសម្រេច', stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error('Failed to save deputy note', err);
      setStageMessage('រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត', stageKey);
    } finally {
      setSaving(false);
    }
  };

  const saveCourse4Note = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta('Course4Note');
    setSaving(true);
    setStageMessage('កំពុងរក្សាទុក...', stageKey);
    try {
      const id = record._id || record.id;
      const now = new Date();
      const newMeta = { ...(meta || {}), Course4Note: deputyRightContent, Course4Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = (res && (res.item || res)) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord(r => ({ ...(r || {}), meta: newMeta }));
      }
      setStageMessage('រក្សាទុកបានសម្រេច', stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error('Failed to save deputy right note', err);
      setStageMessage('រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត', stageKey);
    } finally {
      setSaving(false);
    }
  };

  // save Head of Office note
  const saveCourse6Note = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta('Course6Note');
    setSaving(true);
    setStageMessage('កំពុងរក្សាទុក...', stageKey);
    try {
      const id = record._id || record.id;
      const now = new Date();
      const newMeta = { ...(meta || {}), Course6Note: headOfficeContent, Course6Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = (res && (res.item || res)) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord(r => ({ ...(r || {}), meta: newMeta }));
      }
      setStageMessage('រក្សាទុកបានសម្រេច', stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error('Failed to save head office note', err);
      setStageMessage('រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត', stageKey);
    } finally {
      setSaving(false);
    }
  };

  const saveCourse5Note = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta('Course5Note');
    setSaving(true);
    setStageMessage('កំពុងរក្សាទុក...', stageKey);
    try {
      const id = record._id || record.id;
      const now = new Date();
      const newMeta = { ...(meta || {}), Course5Note: directorContent, Course5Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = (res && (res.item || res)) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord(r => ({ ...(r || {}), meta: newMeta }));
      }
      setStageMessage('រក្សាទុកបានសម្រេច', stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error('Failed to save director note', err);
      setStageMessage('រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត', stageKey);
    } finally {
      setSaving(false);
    }
  };

  // generic stage save helper
  const saveStageNote = async (metaKey, content) => {
    if (!record) return;
    const stageKey = stageKeyByMeta(metaKey);
    setSaving(true);
    setStageMessage('កំពុងរក្សាទុក...', stageKey);
    try {
      const id = record._id || record.id;
      const dateKey = metaKey.replace('Note', 'Date');
      const newMeta = { ...(meta || {}), [metaKey]: content, [dateKey]: new Date().toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = (res && (res.item || res)) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord(r => ({ ...(r || {}), meta: newMeta }));
      }
      setStageMessage('រក្សាទុកបានសម្រេច', stageKey);
      setCapturedDate(new Date());
    } catch (err) {
      console.error('Failed to save stage note', err);
      setStageMessage('រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត', stageKey);
    } finally {
      setSaving(false);
    }
  };

  // send saved comment/summary to Telegram for this record
  const sendToTelegram = async () => {
    if (!record) return;
    setSaving(true);
    setStageMessage('', null);
    try {
      const id = record._id || record.id;
      // Default send is for the primary stage (S) so replies map to CourseNote
      const res = await api.post(`/file-transfers/${id}/send-telegram`, { stageKey: 's' });
      if (res && res.data && res.data.success) {
        setStageMessage('បានផ្ញើមតិ', null);
      } else {
        setStageMessage('ផ្ញើមិនបាន — ​​សូមព្យាយាម​ម្ដងទៀត', null);
      }
    } catch (err) {
      console.error('sendToTelegram failed', err);
      setStageMessage('ផ្ញើមិនបាន — សូមព្យាយាមម្ដងទៀត', null);
    } finally {
      setSaving(false);
    }
  };

  // Confirmation modal state for stage send
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmStageKey, setConfirmStageKey] = useState(null);
  const [confirmAdvance, setConfirmAdvance] = useState(true);

  // Show confirmation UI before sending a stage note
  const sendStageToTelegram = (stageKey) => {
    if (!record) return;
    setConfirmStageKey(stageKey);
    setConfirmAdvance(true);
    setConfirmVisible(true);
  };

  const doSendStage = async (stageKey, advance) => {
    if (!record) return;
    setConfirmVisible(false);
    const normalizedStageKey = String(stageKey || '').toLowerCase();
    setSendingStage(normalizedStageKey);
    setStageMessage('', normalizedStageKey);
    try {
      const id = record._id || record.id;
      const payload = { stageKey: normalizedStageKey };
      if (advance) payload.advance = true;
      const res = await api.post(`/file-transfers/${id}/send-telegram`, payload);
      if (res && res.data && res.data.success) {
        setStageMessage('បានផ្ញើមតិ', normalizedStageKey);
        const refreshed = await getFileTransfer(id);
        if (refreshed) setRecord(refreshed.item || refreshed);
      } else {
        setStageMessage('ផ្ញើមិនបាន — សូមព្យាយាមម្ដងទៀត', normalizedStageKey);
      }
    } catch (err) {
      console.error('sendStageToTelegram failed', err);
      setStageMessage('ផ្ញើមិនបាន — សូមព្យាយាមម្ដងទៀត', normalizedStageKey);
    } finally {
      setSendingStage(null);
    }
  };

  // recreate / clear a stage note (useful to reset and start fresh)
  const recreateStageNote = async (metaKey) => {
    if (!record) return;
    const stageKey = stageKeyByMeta(metaKey);
    setSaving(true);
    setStageMessage('', stageKey);
    try {
      const id = record._id || record.id;
      // also clear corresponding date key if present (Course1Date, Course2Date, ...)
      const dateKey = metaKey.replace('Note', 'Date');
      const newMeta = { ...(meta || {}), [metaKey]: '', [dateKey]: null };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = (res && (res.item || res)) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord(r => ({ ...(r || {}), meta: newMeta }));
      }
      setStageMessage('បានកំណត់ឡើងវិញ', stageKey);
      // clear local state for the matching key
      if (metaKey === 'Course1Note') setS1Content('');
      if (metaKey === 'CourseNote') setLeftContent('');
    } catch (err) {
      console.error('Failed to recreate stage note', err);
      setStageMessage('មិនបានកំណត់ឡើងវិញ — សូមព្យាយាមម្ដងទៀត', stageKey);
    } finally {
      setSaving(false);
    }
  };

  // Khmer date formatting helpers
  const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  const KHMER_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const toKhmerDigits = (num) => {
    if (num === null || num === undefined) return '';
    const s = String(num);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      if (ch >= '0' && ch <= '9') out += KHMER_DIGITS[parseInt(ch, 10)];
      else out += ch;
    }
    return out;
  };

  const formatKhmerDate = (d) => {
    if (!d) return '........';
    try {
      const day = toKhmerDigits(d.getDate());
      const month = KHMER_MONTHS[d.getMonth()] || '';
      const year = toKhmerDigits(d.getFullYear());
      return `ថ្ងៃទី ${day}  ខែ ${month}  ឆ្នាំ ${year}`;
    } catch (e) {
      return '........';
    }
  };

  const pad2 = (n) => (n === null || n === undefined ? '' : (n < 10 ? `0${n}` : String(n)));
  const formatKhmerDateTime = (d) => {
    if (!d) return '........';
    try {
      const datePart = formatKhmerDate(d);
      const hh = d.getHours();
      const mm = d.getMinutes();
      return `${datePart}  ម៉ោង ${toKhmerDigits(pad2(hh))}:${toKhmerDigits(pad2(mm))}`;
    } catch (e) {
      return formatKhmerDate(d);
    }
  };

  const applyEntryTime = (baseDate, entryTime) => {
    if (!baseDate) return null;
    const clone = new Date(baseDate);
    if (!entryTime || typeof entryTime !== 'string') return clone;
    const parts = entryTime.split(':').map(p => parseInt(p, 10));
    if (!parts.length) return clone;
    const [hh, mm = 0, ss = 0] = parts;
    if (!Number.isNaN(hh)) clone.setHours(hh, Number.isNaN(mm) ? 0 : mm, Number.isNaN(ss) ? 0 : ss);
    return clone;
  };

  // Parse a raw date (string or Date) and, for date-only / UTC-midnight values,
  // set the time portion to the current local time so printed time is meaningful
  // ONLY when an explicit `entryTime` is not provided. If `entryTime` exists,
  // prefer that value and do not substitute `now`.
  const parsePreferLocalTime = (raw, entryTime) => {
    if (!raw) return null;
    const d = (raw instanceof Date) ? new Date(raw.getTime()) : new Date(raw);
    try {
      let isDateOnly = false;
      if (typeof raw === 'string') {
        if (/T00:00:00(?:\.000)?(?:Z|\+00:00)?$/.test(raw)) isDateOnly = true;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) isDateOnly = true;
      }
      // if it's date-only or midnight UTC, apply local current time only when
      // there is no explicit `entryTime` to apply later. This prevents showing
      // a varying "now" time when an actual recorded `entryTime` exists.
      if (!entryTime && (isDateOnly || (d.getHours && d.getHours() === 0 && d.getMinutes && d.getMinutes() === 0 && /(?:Z|\+00:00)$/.test(String(raw))))) {
        const now = new Date();
        d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      }
    } catch (e) { }
    return d;
  };

  // helper: resolve creator's display name from record
  const creatorName = () => {
    try {
      if (!record) return '';
      // prefer structured `createdBy` object if present
      const cb = record.createdBy;
      if (cb && typeof cb === 'object') {
        return cb.fullName || cb.fullNameKh || cb.name || cb.username || '';
      }
      // if createdBy is a scalar id, try signaturesMap lookup
      if (cb && (typeof cb === 'string' || typeof cb === 'number')) {
        try {
          const sig = signaturesMap && signaturesMap[cb];
          if (sig) return sig.fullNameKh || sig.fullName || sig.name || String(cb);
        } catch (e) { }
      }
      // next prefer explicit createdByName or reporterName in meta
      if (record.createdByName) return record.createdByName;
      if (record.reporter) return record.reporter;
      if (meta && meta.reporterName) return meta.reporterName;
      // fallback to createdBy scalar
      if (record.createdBy) return record.createdBy;
      return '';
    } catch (e) {
      return '';
    }
  };

  // helper: get a Date object from meta for keys like 'Course3Date'
  const dateForMetaKey = (key) => {
    try {
      if (!meta || !key) return null;
      const v = meta[key];
      if (!v) return null;
      const d = new Date(v);
      if (isNaN(d.getTime())) return null;
      return d;
    } catch (e) {
      return null;
    }
  };

  // recipient signature from feedbackStages.S1

  const sigS = sigFor && sigFor('S');
  const sig1 = sigFor && sigFor('S1');
  const sig2 = sigFor && sigFor('S2');
  const sig3 = sigFor && sigFor('S3');
  const sig1Url = signatureUrl(sig1);
  const sigSUrl = signatureUrl(sigS);
  const sig2Url = signatureUrl(sig2);
  const sig3Url = signatureUrl(sig3);
  // deputy signature: prefer 'SD' (deputy) then fallback to S3 if present
  const sigDeputy = sigFor && (sigFor('SD') || sigFor('S3'));
  const sigDeputyUrl = signatureUrl(sigDeputy);
  // right deputy signature: prefer 'SDR' then fallback to S4 or S3
  const sigDeputyRight = sigFor && (sigFor('SDR') || sigFor('S4') || sigFor('S3'));
  const sigDeputyRightUrl = signatureUrl(sigDeputyRight);
  // director signature: prefer 'DIR' or 'SDIR', fallback to S5
  const sigDirector = sigFor && (sigFor('DIR') || sigFor('SDIR') || sigFor('S5'));
  const sigDirectorUrl = signatureUrl(sigDirector);
  // head of office signature: prefer 'HO' then prefer S6 (stage 6), then fallback to S4/S3
  const sigHeadOffice = sigFor && (sigFor('HO') || sigFor('S6') || sigFor('S4') || sigFor('S3'));
  const sigHeadOfficeUrl = signatureUrl(sigHeadOffice);
  const hasCourseNote = Boolean((meta && meta.CourseNote) || (leftContent && leftContent.trim() !== ''));
  const hasCourse1Note = Boolean((meta && meta.Course1Note) || (s1Content && s1Content.trim() !== ''));
  const hasDeptNote = Boolean((meta && meta.Course2Note) || (deptContent && deptContent.trim() !== ''));
  const hasDeputy = Boolean((meta && meta.Course3Note) || (deputyContent && deputyContent.trim() !== ''));
  const hasDeputyRight = Boolean((meta && meta.Course4Note) || (deputyRightContent && deputyRightContent.trim() !== ''));
  const hasHeadOffice = Boolean((meta && meta.Course6Note) || (headOfficeContent && headOfficeContent.trim() !== ''));
  const hasDirector = Boolean((meta && meta.Course5Note) || (directorContent && directorContent.trim() !== ''));

  // If any visible note exists but we don't yet have a captured date, default it to now
  useEffect(() => {
    try {
      if (!capturedDate && (hasCourseNote || hasDeptNote || hasDeputy || hasDeputyRight || hasHeadOffice || hasDirector)) {
        setCapturedDate(new Date());
      }
    } catch (e) {
      // ignore
    }
  }, [capturedDate, hasCourseNote, hasDeptNote, hasDeputy, hasDeputyRight, hasHeadOffice, hasDirector]);

  // Keep the ref-panel preview the same pixel size as the left sheet so zoom/scale match
  useEffect(() => {
    let mounted = true;
    const getSheet = () => (sheetRef && sheetRef.current) || null;
    const getPreview = () => (refPreviewWrapper && refPreviewWrapper.current) || null;

    const syncPreviewSize = () => {
      try {
        const p = getPreview();
        if (!p) return;
        // Keep the preview wrapper sized to A4 CSS dimensions and allow it to expand vertically
        p.style.width = '210mm';
        p.style.height = 'auto';
        p.style.overflow = 'visible';
      } catch (e) {
        // ignore
      }
    };

    // initial sync
    syncPreviewSize();

    // use ResizeObserver when available to detect element resizes (zoom, layout changes)
    let ro = null;
    try {
      if (typeof window !== 'undefined' && window.ResizeObserver) {
        ro = new window.ResizeObserver(() => { if (mounted) syncPreviewSize(); });
        const s = getSheet();
        if (s) ro.observe(s);
      }
    } catch (e) {
      ro = null;
    }

    // window resize handler (viewport resize)
    const onResize = () => { if (mounted) syncPreviewSize(); };
    window.addEventListener('resize', onResize);

    // polling fallback for cases where ResizeObserver or resize events don't catch zoom/scale changes
    let lastRect = null;
    const poll = setInterval(() => {
      try {
        const s = getSheet();
        if (!s) return;
        const r = s.getBoundingClientRect();
        if (!lastRect || r.width !== lastRect.width || r.height !== lastRect.height) {
          lastRect = r;
          if (mounted) syncPreviewSize();
        }
      } catch (e) {
        // ignore
      }
    }, 250);

    return () => {
      mounted = false;
      window.removeEventListener('resize', onResize);
      try { if (ro) ro.disconnect(); } catch (e) { }
      try { clearInterval(poll); } catch (e) { }
    };
  }, [sheetRef, refPreviewWrapper, uiFontSize, uiLineHeight, uiPaddingTop, selectedRef]);

  // Render selected reference PDF into `refPreviewWrapper` as A4 canvases
  useEffect(() => {
    let mounted = true;
    let loadingTask = null;
    const container = (refPreviewWrapper && refPreviewWrapper.current) || null;
    if (!container) return undefined;

    // clear previous preview
    container.innerHTML = '';

    if (!selectedRef) return undefined;
    const isPdf = String(selectedRef).toLowerCase().endsWith('.pdf');
    if (!isPdf) return undefined;

    (async () => {
      try {
        // dynamic import so bundlers handle pdfjs correctly
        const pdfjs = (await import('pdfjs-dist/legacy/build/pdf'));
        const pdfjsLib = pdfjs && (pdfjs.default || pdfjs);

        // Prefer serving the pdf.worker from the same origin to avoid CORS errors
        // (copy `node_modules/pdfjs-dist/build/pdf.worker.min.js` -> `public/pdf.worker.min.js`).
        // If a local worker isn't available, fall back to the CDN worker.
        try {
          if (typeof window !== 'undefined' && window.location && window.location.origin) {
            const localWorker = `${window.location.origin}/pdf.worker.min.js`;
            try {
              const head = await fetch(localWorker, { method: 'HEAD' });
              if (head && head.ok) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = localWorker;
              } else {
                pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc || 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';
              }
            } catch (e) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc || 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';
            }
          } else {
            pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc || 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';
          }
        } catch (e) {
          // ignore
        }

        // Try fetching the PDF as a blob first using CORS (helps avoid worker fetch problems).
        // If the fetch is blocked by CORS or fails, fall back to embedding an iframe so the user can view the PDF.
        let pdf = null;
        try {
          const res = await fetch(selectedRef, { mode: 'cors' });
          if (res && res.ok) {
            const blob = await res.blob();
            const arrayBuf = await blob.arrayBuffer();
            loadingTask = pdfjsLib.getDocument({ data: arrayBuf });
            pdf = await loadingTask.promise;
          } else {
            // if server returned non-OK (e.g. 404/403) or no CORS, fall back to iframe
            const iframe = document.createElement('iframe');
            iframe.src = selectedRef;
            iframe.style.width = '210mm';
            iframe.style.height = '297mm';
            iframe.style.border = '0';
            iframe.style.display = 'block';
            iframe.style.margin = '0 auto 10mm';
            container.appendChild(iframe);
            return;
          }
        } catch (fetchErr) {
          // likely CORS or network error — embed an iframe so the user can still view the PDF
          try {
            const iframe = document.createElement('iframe');
            iframe.src = selectedRef;
            iframe.style.width = '210mm';
            iframe.style.height = '297mm';
            iframe.style.border = '0';
            iframe.style.display = 'block';
            iframe.style.margin = '0 auto 10mm';
            container.appendChild(iframe);
            return;
          } catch (e) {
            // if even iframe insertion fails, propagate original fetchErr
            throw fetchErr;
          }
        }

        for (let p = 1; p <= pdf.numPages; p++) {
          if (!mounted) break;
          const page = await pdf.getPage(p);

          const canvas = document.createElement('canvas');
          canvas.style.width = '210mm';
          canvas.style.height = '297mm';
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 10mm';
          canvas.style.boxSizing = 'border-box';
          canvas.style.pageBreakAfter = 'always';
          container.appendChild(canvas);

          const DPR = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
          const cssWidth = canvas.clientWidth || ((210 / 25.4) * 96);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = cssWidth / baseViewport.width;
          const renderViewport = page.getViewport({ scale });

          canvas.width = Math.max(1, Math.floor(renderViewport.width * DPR));
          canvas.height = Math.max(1, Math.floor(renderViewport.height * DPR));

          const ctx = canvas.getContext('2d');
          if (ctx && ctx.setTransform) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

          await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
        }
      } catch (err) {
        console.warn('Failed to render PDF preview', err);
        if (container && mounted) {
          const msg = (err && err.message) ? String(err.message) : String(err || 'Unknown error');
          const details = `Failed to render PDF preview\nURL: ${selectedRef}\nError: ${msg}`;
          container.innerHTML = `<div style="color:#a00;padding:8px;white-space:pre-wrap">${details}</div>`;
        }
      }
    })();

    return () => {
      mounted = false;
      try { if (loadingTask && loadingTask.destroy) loadingTask.destroy(); } catch (e) { }
    };
  }, [selectedRef]);

  // helper: determine if a stage (or list of stage keys) has a sender name available
  const stageHasSenderForKeys = (keys) => {
    if (!normalizedStages) return false;
    try {
      for (const k of (keys || [])) {
        const raw = normalizedStages[k];
        if (!raw) continue;
        // If the raw stage provides an explicit senderName (text), only
        // consider it visible when the user has enabled name display for
        // that stage.
        if (typeof raw === 'object') {
          if ((raw.senderName || raw.sender || raw.name) && effectiveShowName(k)) return true;
        }
        // resolve id and check signaturesMap for a name. Only treat a
        // signature as a visible sender when the user has enabled the
        // signature column for that stage.
        const id = resolveStageId(raw);
        if (id && signaturesMap && signaturesMap[id] && effectiveShowSignature(k)) {
          const s = signaturesMap[id];
          if (s && (s.fullNameKh || s.fullName || s.name)) return true;
        }
      }
    } catch (e) { }
    return false;
  };

  // map stage keys to meta note keys
  const stageToMetaKey = {
    S: 'CourseNote',
    S1: 'Course1Note',
    S2: 'Course2Note',
    SD: 'Course3Note',
    S3: 'Course3Note',
    SDR: 'Course4Note',
    S4: 'Course4Note',
    S5: 'Course5Note',
    DIR: 'Course5Note',
    SDIR: 'Course5Note',
    S6: 'Course6Note',
    HO: 'Course6Note'
  };

  // Determine which buckets (S, S1..S6) exist and compute which should be visible
  const visibleStages = useMemo(() => {
    try {
      const buckets = [
        { key: 'S', variants: ['S'], metaKey: 'CourseNote', local: leftContent },
        { key: 'S1', variants: ['S1'], metaKey: 'Course1Note', local: s1Content },
        { key: 'S2', variants: ['S2'], metaKey: 'Course2Note', local: deptContent },
        { key: 'S3', variants: ['SD', 'S3'], metaKey: 'Course3Note', local: deputyContent },
        { key: 'S4', variants: ['SDR', 'S4'], metaKey: 'Course4Note', local: deputyRightContent },
        { key: 'S5', variants: ['S5', 'DIR', 'SDIR'], metaKey: 'Course5Note', local: directorContent },
        { key: 'S6', variants: ['S6', 'HO'], metaKey: 'Course6Note', local: headOfficeContent }
      ];

      // Consider a variant "selected" only when the key exists in
      // normalizedStages and its value is meaningful (non-empty string or object).
      // Empty strings should NOT count as an assigned stage.
      const variantSelected = (variants) => {
        try {
          for (const k of (variants || [])) {
            if (!normalizedStages) continue;
            if (!Object.prototype.hasOwnProperty.call(normalizedStages, k)) continue;
            const raw = normalizedStages[k];
            if (raw === null || raw === undefined) continue;
            if (typeof raw === 'object') return true;
            if (String(raw).trim() !== '') return true;
          }
        } catch (e) { }
        return false;
      };

      const localHasNote = (metaKey, localVal) => {
        try {
          if (localVal && String(localVal).trim() !== '') return true;
          const v = meta && meta[metaKey];
          if (v && String(v).trim() !== '') return true;
        } catch (e) { }
        return false;
      };

      // consider telegram feedback as sent for the primary stage (S)
      const hasTelegramFeedback = Array.isArray(meta && meta.telegramFeedback) && meta.telegramFeedback.length > 0;

      // present buckets: those explicitly assigned in feedbackStages
      // Use `variantSelected` so empty-string values are ignored.
      const present = buckets.filter(b => {
        try {
          if (b.key === 'S') return variantSelected(b.variants) || hasTelegramFeedback;
          return variantSelected(b.variants);
        } catch (e) {
          return false;
        }
      });

      if (!present || present.length === 0) return new Set();

      // attach timestamps from meta CourseXDate fields when available
      const withDates = present.map(b => {
        const dateKey = String(b.metaKey).replace(/Note$/i, 'Date');
        let ts = null;
        try {
          const raw = meta && meta[dateKey];
          if (raw) {
            const d = new Date(raw);
            if (!isNaN(d.getTime())) ts = d.getTime();
          }
        } catch (e) { ts = null; }
        return { key: b.key, ts, bucket: b };
      });

      // Decide ordering strategy:
      // - If at least one present bucket has a saved CourseXNote, use timestamps
      //   (CourseXDate) to determine send order.
      // - If no notes exist yet, preserve canonical bucket order so the UI
      //   starts at the first assigned stage (avoid showing S6 first due to
      //   stale/auto timestamps).
      const orderKeys = buckets.map(b => b.key);
      const hasAnySavedNote = present.some(b => {
        try {
          const v = meta && meta[b.metaKey];
          return v && String(v).trim() !== '';
        } catch (e) { return false; }
      });

      if (hasAnySavedNote) {
        withDates.sort((a, z) => {
          if (a.ts !== null && z.ts !== null) return a.ts - z.ts;
          if (a.ts !== null && z.ts === null) return -1;
          if (a.ts === null && z.ts !== null) return 1;
          return orderKeys.indexOf(a.key) - orderKeys.indexOf(z.key);
        });
      } else {
        // preserve canonical order when there are no saved notes
        withDates.sort((a, z) => orderKeys.indexOf(a.key) - orderKeys.indexOf(z.key));
      }

      // Show all present/ordered buckets (do not limit to a single stage)
      const orderedBuckets = withDates.map(x => x.bucket);
      if (!orderedBuckets || orderedBuckets.length === 0) return new Set();
      return new Set(orderedBuckets.map(b => b.key));
    } catch (e) { return new Set(); }
  }, [normalizedStages, leftContent, s1Content, deptContent, deputyContent, deputyRightContent, directorContent, headOfficeContent, signaturesMap, meta]);



  // Stages that have actually sent feedback (note exists)
  const stagesWithFeedback = useMemo(() => {
    try {
      const hasText = (v) => v !== null && v !== undefined && String(v).trim() !== '';
      const sent = new Set();
      const hasTelegramFeedback = Array.isArray(meta && meta.telegramFeedback) && meta.telegramFeedback.length > 0;
      if (hasText(leftContent) || hasText(meta && meta.CourseNote)) sent.add('S');
      // If there are Telegram replies for this record, treat primary stage S as having feedback
      if (hasTelegramFeedback) sent.add('S');
      if (hasText(s1Content) || hasText(meta && meta.Course1Note)) sent.add('S1');
      if (hasText(deptContent) || hasText(meta && meta.Course2Note)) sent.add('S2');
      if (hasText(deputyContent) || hasText(meta && meta.Course3Note)) sent.add('S3');
      if (hasText(deputyRightContent) || hasText(meta && meta.Course4Note)) sent.add('S4');
      if (hasText(directorContent) || hasText(meta && meta.Course5Note)) sent.add('S5');
      if (hasText(headOfficeContent) || hasText(meta && meta.Course6Note)) sent.add('S6');
      return sent;
    } catch (e) {
      return new Set();
    }
  }, [meta, leftContent, s1Content, deptContent, deputyContent, deputyRightContent, directorContent, headOfficeContent]);

  const stageKeysForSettings = useMemo(() => {
    // Always show all stage toggles (S, S1..S6) in the settings panel so
    // the user can control visibility even if a stage hasn't yet sent feedback.
    return STAGE_TOGGLE_KEYS;
  }, []);

  // helper: find the first stage that is assigned but whose corresponding Course note is still empty
  const waitingStageSender = useMemo(() => {
    try {
      if (!normalizedStages) return null;
      const order = ['S', 'S1', 'S2', 'SD', 'SDR', 'S3', 'S4', 'S5', 'S6'];
      for (const k of order) {
        const raw = normalizedStages[k];
        if (!raw) continue;
        const metaKey = stageToMetaKey[k];
        const metaVal = (meta && meta[metaKey]) || '';
        // pick corresponding local content for quick check
        let local = '';
        if (metaKey === 'CourseNote') local = leftContent || '';
        else if (metaKey === 'Course1Note') local = s1Content || '';
        else if (metaKey === 'Course2Note') local = deptContent || '';
        else if (metaKey === 'Course3Note') local = deputyContent || '';
        else if (metaKey === 'Course4Note') local = deputyRightContent || '';
        else if (metaKey === 'Course6Note') local = headOfficeContent || '';
        else if (metaKey === 'Course6Note') local = directorContent || '';

        if (String(metaVal || '').trim() === '' && String(local || '').trim() === '') {
          // this stage is waiting for a note
          // if raw is object, try senderName
          if (typeof raw === 'object') {
            const n = raw.senderName || raw.sender || raw.name;
            if (n) return `${n} (${k})`;
          }
          const id = resolveStageId(raw);
          if (id && signaturesMap && signaturesMap[id]) {
            const s = signaturesMap[id];
            const n = (s && (s.fullNameKh || s.fullName || s.name));
            if (n) return `${n} (${k})`;
          }
          // fallback to stage key if nothing else
          return `Stage ${k}`;
        }
      }
    } catch (e) { }
    return null;
  }, [normalizedStages, meta, leftContent, deptContent, deputyContent, deputyRightContent, directorContent, headOfficeContent, signaturesMap]);

  // A cleaned version of waitingStageSender with any trailing " (Sx)" removed for display
  const waitingStageSenderClean = useMemo(() => {
    try {
      if (!waitingStageSender) return null;
      return String(waitingStageSender).replace(/\s*\([^)]+\)\s*$/, '').trim();
    } catch (e) { return waitingStageSender; }
  }, [waitingStageSender]);

  // helper: check whether the current logged-in user is the assigned sender for any of the given stage keys
  const isAssignedToStage = (keys) => {
    // Admin users may edit all stages
    try {
      if (perms && perms.canEditDocuments) return true;
    } catch (e) {
      // ignore
    }
    try {
      if (!normalizedStages || !currentUser) return false;
      const normalize = (v) => (v || '').toString().normalize ? v.toString().normalize('NFKD').replace(/\p{Diacritic}/gu, '') : (v || '').toString();
      const norm = (v) => normalize(v).toLowerCase().trim();
      const userNames = [currentUser.name, currentUser.fullName, currentUser.fullNameKh].filter(Boolean).map(s => norm(s));

      for (const k of (keys || [])) {
        const raw = normalizedStages[k];
        if (!raw) continue;
        // object with senderName/sender/name
        if (typeof raw === 'object') {
          const candidate = (raw.senderName || raw.sender || raw.name || '').toString();
          if (userNames.includes(norm(candidate))) return true;
        } else {
          // try resolve id -> signature record
          const id = resolveStageId(raw);
          if (id && signaturesMap && signaturesMap[id]) {
            const s = signaturesMap[id];
            const cand = (s.fullNameKh || s.fullName || s.name || '').toString();
            if (userNames.includes(norm(cand))) return true;
          }
          // fallback: compare raw string directly to user names
          if (userNames.includes(norm(raw))) return true;
        }
      }
    } catch (e) {
      // ignore
    }
    return false;
  };


  // When true, show placeholder stage boxes even if no stage assignments or notes exist
  // Set to false so placeholders only appear when feedback stages/notes exist
  // helper: check whether any of the stage dropdowns were actually selected
  const stageSelected = (keys) => {
    if (!normalizedStages) return false;
    for (const k of (keys || [])) {
      if (!Object.prototype.hasOwnProperty.call(normalizedStages, k)) continue;
      const raw = normalizedStages[k];
      if (raw === null || raw === undefined) continue;
      if (typeof raw === 'object') return true;
      if (String(raw).trim() !== '') return true;
    }
    return false;
  };

  // helper: show if meta has a saved note or local content exists
  const hasNote = (metaKey, content) => {
    try {
      if (content && String(content).trim() !== '') return true;
      const v = meta && meta[metaKey];
      if (v && String(v).trim() !== '') return true;
    } catch (e) {
      // ignore
    }
    return false;
  };

  // Show placeholder stage blocks even when no notes exist so the sheet
  // displays the full set of stages (matching the screenshot selection)
  // Set to false: do not show placeholder stages when no feedback/assignment exists
  const alwaysShowPlaceholders = false;
  // Only show blocks for stages that have saved notes — hide placeholders for empty/assigned-only stages
  // Show deputy left when either a note exists or the stage was selected/sent
  const showDeputyLeft = hasNote('Course3Note', deputyContent) || stageSelected(['SD', 'S3']);

  // Right deputy should be shown when it has a saved note or was selected
  const showDeputyRight = hasNote('Course4Note', deputyRightContent) || stageSelected(['SDR', 'S4']);
  // Show HeadOffice when Course6Note exists or S6 was selected
  const showHeadOffice = hasNote('Course6Note', headOfficeContent) || stageSelected(['S6']);
  // Show director block when Course5Note exists or director stage was selected
  const showDirector = hasNote('Course5Note', directorContent) || stageSelected(['DIR', 'SDIR', 'S5']);
  // Show department head when Course2Note exists or S2 was selected
  const showDept = hasNote('Course2Note', deptContent) || stageSelected(['S2']);

  // show recipient (S) when CourseNote has content or S was selected/sent
  const showRecipient = hasNote('CourseNote', leftContent) || stageSelected(['S']);

  // Build deputy block as standalone JSX to avoid complex inline ternaries
  const deputyBlock = useMemo(() => {
    // respect computed visibleStages: only show deputy left/right when their
    // corresponding visibleStage is present. If S4 will be rendered together
    // with S5 (side-by-side), avoid rendering the S4 rightJSX here to prevent duplication.
    const leftVisible = Boolean(visibleStages && visibleStages.has('S3')) && showDeputyLeft;
    const rightVisible = Boolean(visibleStages && visibleStages.has('S4')) && showDeputyRight && !(visibleStages && visibleStages.has('S5'));
    if (!leftVisible && !rightVisible) return null;

    const deputyMessage = stageMessageFor('S3');
    const deputyRightMessage = stageMessageFor('S4');
    const leftJSX = (
      <div style={{ border: '1px dashed #161616ff', padding: 1, marginTop: 5 }}>
        <div style={{ padding: 1 }}>
          <div className="role-label" style={{ textAlign: 'center', marginTop: 2, fontFamily: 'Khmer OS Muol Light' }}>
            {(meta && meta.feedbackStageRoles && meta.feedbackStageRoles.s3) || getRoleLabel('s3')}
          </div>
          <textarea
            rows={4}
            ref={deputyTextareaRef}
            value={deputyContent}
            onChange={(e) => { setDeputyContent(e.target.value); clearStageMessage('S3'); }}
            placeholder=""
            style={{ width: manualResizeEnabled ? 'calc(100% - 18px)' : '100%', height: 'auto', minHeight: '72px', lineHeight: uiLineHeight, textAlign: 'justify', margin: 0, marginRight: manualResizeEnabled ? '18px' : 0, marginBottom: manualResizeEnabled ? '12px' : 0, padding: '8px 22px 12px 8px', resize: manualResizeEnabled ? 'both' : 'none', overflow: manualResizeEnabled ? 'auto' : 'hidden', backgroundImage: manualResizeEnabled ? "linear-gradient(135deg, rgba(0,0,0,0.22) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.16) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.1) 25%, transparent 25%)" : 'none', backgroundSize: manualResizeEnabled ? '14px 14px, 10px 10px, 6px 6px' : '0 0', backgroundRepeat: manualResizeEnabled ? 'no-repeat' : 'no-repeat', backgroundPosition: manualResizeEnabled ? 'right 6px bottom 6px, right 4px bottom 4px, right 2px bottom 2px' : '0 0', fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", boxSizing: 'border-box', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', textIndent: '30px' }} disabled={!isAssignedToStage(['SD', 'S3'])} />
          <div style={{ textAlign: 'center', marginTop: 0 }}>
            {hasDeputy ? (
              <>
                {effectiveShowDoAt('S3') ? (
                  <div>ធ្វើនៅ {formatKhmerDateTime(dateForMetaKey('Course3Date') || capturedDate)}</div>
                ) : null}
                {(effectiveShowSignature('S3') && sigDeputyUrl) ? (
                  <div style={{ marginTop: 0 }}>
                    <img src={sigDeputyUrl} alt="sig-deputy" style={{ maxWidth: 100, maxHeight: 80, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                  </div>
                ) : null}
              </>
            ) : null}
            {(((effectiveShowName('S3') && (stagesWithFeedback && stagesWithFeedback.has('S3'))) || stageHasSenderForKeys(['SD', 'S3']))) ? (
              <div className="sender-name" style={{ fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }}>{getStageSenderName(['SD', 'S3']) || ''}</div>
            ) : null}
          </div>
          {/* --- Telegram Feedback Section --- */}
          {/* Telegram feedback is rendered globally below */}
        </div>
        {showLargePreview && selectedRef ? (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowLargePreview(false)}>
            <div role="dialog" aria-modal="true" style={{ background: '#fff', padding: 12, borderRadius: 6, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', maxWidth: '95vw', maxHeight: '95vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button onClick={() => setShowLargePreview(false)} style={{ padding: '6px 10px' }}>Close</button>
              </div>
              <div style={{ width: '210mm', maxWidth: '90vw', height: '297mm', maxHeight: '90vh', boxSizing: 'border-box', border: '1px solid #e5e7eb', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', background: '#574a4aff' }}>
                {String(selectedRef).toLowerCase().endsWith('.pdf') ? (
                  <iframe src={selectedRef} title="Large reference preview" style={{ width: '100%', height: '100%', border: 0 }} />
                ) : (
                  <img src={selectedRef} alt="large-ref" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                )}
              </div>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: hasDeputy ? 'space-between' : 'flex-start', alignItems: 'center', marginTop: 6, padding: '0px' }}>
          <div style={{ color: deputyMessage ? '#0b6623' : '#666', minHeight: 0 }}>{deputyMessage}</div>
          {/* in-sheet send button removed; use toolbar/print-only controls instead */}
        </div>
      </div>
    );

    const rightJSX = (
      <div style={{ border: '1px dashed #161616ff', padding: 1, marginTop: 5 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <div style={{ padding: 1 }}>
            <div className="role-label" style={{ textAlign: 'center', marginTop: 2, fontFamily: 'Khmer OS Muol Light' }}>{(meta && meta.feedbackStageRoles && meta.feedbackStageRoles.s4) || getRoleLabel('s4')}
            </div>
            <textarea
              rows={4}
              ref={deputyRightTextareaRef}
              value={deputyRightContent}
              onChange={(e) => { setDeputyRightContent(e.target.value); clearStageMessage('S4'); }}
              placeholder=""
              style={{
                width: manualResizeEnabled ? 'calc(100% - 18px)' : '100%',
                height: 'auto',
                minHeight: '72px',
                lineHeight: uiLineHeight,
                textAlign: 'justify',
                margin: 0,
                marginRight: manualResizeEnabled ? '18px' : 0,
                marginBottom: manualResizeEnabled ? '12px' : 0,
                padding: '8px 22px 12px 8px',
                resize: manualResizeEnabled ? 'both' : 'none',
                overflow: manualResizeEnabled ? 'auto' : 'hidden',
                backgroundImage: manualResizeEnabled ? "linear-gradient(135deg, rgba(0,0,0,0.22) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.16) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.1) 25%, transparent 25%)" : 'none',
                backgroundSize: manualResizeEnabled ? '14px 14px, 10px 10px, 6px 6px' : '0 0',
                backgroundRepeat: manualResizeEnabled ? 'no-repeat' : 'no-repeat',
                backgroundPosition: manualResizeEnabled ? 'right 6px bottom 6px, right 4px bottom 4px, right 2px bottom 2px' : '0 0',
                fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                boxSizing: 'border-box',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                textIndent: '30px'
              }}
              disabled={!isAssignedToStage(['SDR', 'S4'])}
            />
            <div style={{ textAlign: 'center', marginTop: 0 }}>
              {hasDeputyRight ? (
                <>
                  {effectiveShowDoAt('S4') ? (
                    <div>ធ្វើនៅ {formatKhmerDateTime(dateForMetaKey('Course4Date') || capturedDate)}</div>
                  ) : null}
                  {(effectiveShowSignature('S4') && sigDeputyRightUrl) ? (
                    <div style={{ marginTop: 0 }}>
                      <img src={sigDeputyRightUrl} alt="sig-deputy-right" style={{ maxWidth: 120, maxHeight: 80, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                    </div>
                  ) : null}
                </>
              ) : null}
              {(((effectiveShowName('S4') && (stagesWithFeedback && stagesWithFeedback.has('S4'))) || stageHasSenderForKeys(['SDR', 'S4', 'S3']))) ? (
                <div className="sender-name" style={{ fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }}>{getStageSenderName(['SDR', 'S4', 'S3']) || ''}</div>
              ) : null}
            </div>
          </div>
        </div>
        {showLargePreview && selectedRef ? (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowLargePreview(false)}>
            <div role="dialog" aria-modal="true" style={{ background: '#fff', padding: 12, borderRadius: 6, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', maxWidth: '95vw', maxHeight: '95vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button onClick={() => setShowLargePreview(false)} style={{ padding: '6px 10px' }}>Close</button>
              </div>
              <div style={{ width: '210mm', maxWidth: '90vw', height: '297mm', maxHeight: '90vh', boxSizing: 'border-box', border: '1px solid #e5e7eb', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', background: '#fff' }}>
                {String(selectedRef).toLowerCase().endsWith('.pdf') ? (
                  <iframe src={selectedRef} title="Large reference preview" style={{ width: '100%', height: '100%', border: 0 }} />
                ) : (
                  <img src={selectedRef} alt="large-ref" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                )}
              </div>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: hasDeputyRight ? 'space-between' : 'flex-start', alignItems: 'center', marginTop: 6, padding: '0px' }}>
          <div style={{ color: deputyRightMessage ? '#0b6623' : '#666', minHeight: 0 }}>{deputyRightMessage}</div>
          {/* in-sheet send button removed; use toolbar/print-only controls instead */}
        </div>
      </div>
    );



    if (leftVisible && rightVisible) {
      // When director isn't present but both deputy left (S3/SD) and deputy right (SDR/S4)
      // are assigned, stack them full-width (S3 above S4) to make the print layout clearer.
      return (
        <div style={{ marginTop: 5 }}>
          <div style={{ border: '0px dashed #161616ff', padding: 0 }}>
            {leftJSX}
          </div>
          <div style={{ height: 5 }} />
          <div style={{ border: '0px dashed #161616ff', padding: 0 }}>
            {rightJSX}
          </div>
        </div>
      );
    }
    if (leftVisible) return leftJSX;
    if (rightVisible) return rightJSX;
    return null;
  }, [showDeputyLeft, showDeputyRight, deputyContent, deputyRightContent, sigDeputy, sigDeputyUrl, sigDeputyRight, sigDeputyRightUrl, saveMessage, saveMessageStage, meta, capturedDate, visibleStages, showDoAtStages, showSignatureStages, showNameStages]);
  // If a stage references a signature id that we don't have in signaturesMap,
  // fetch it individually so we can show `fullNameKh` and signature image.
  useEffect(() => {
    const stageKeys = ['S', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'SD', 'SDR', 'DIR', 'SDIR', 'HO'];
    let mounted = true;

    const fetchIfMissing = async (id) => {
      try {
        const res = await api.get(`/signatures/${id}`);
        const sig = res && res.data ? res.data : res && res.data && res.data.signature ? res.data.signature : res.data || res;
        if (!mounted || !sig) return;
        setSignaturesMap(prev => ({ ...(prev || {}), [id]: sig }));
      } catch (err) {
        console.warn('Failed to fetch signature by id', id, err);
      }
    };

    (async () => {
      if (!normalizedStages) return;
      for (const key of stageKeys) {
        const raw = normalizedStages[key];
        const id = resolveStageId(raw);
        if (!id) continue;
        if (signaturesMap && signaturesMap[id]) continue;
        await fetchIfMissing(id);
      }
    })();

    return () => { mounted = false; };
  }, [normalizedStages, signaturesMap]);

  // Hide application sidebar while this page is mounted so the sheet can be centered
  useEffect(() => {
    const added = [];
    try {
      if (document && document.body && document.body.classList) document.body.classList.add('replay-hide-sidebar');

      // selectors to hide — expand if your app uses different classnames
      const sidebarSelectors = ['.ant-layout-sider', '.sidebar', '[role="navigation"]', 'aside', '.sider', '.site-layout-sider', '.ant-pro-sider', '[data-testid="sider"]', '.app-sider'];
      const headerSelectors = ['.ant-layout-header', 'header', '.topbar', '.app-header', '.navbar', '.site-header'];

      const hideElems = (sels) => {
        for (const s of sels) {
          try {
            const nodes = Array.from(document.querySelectorAll(s));
            for (const n of nodes) {
              // save original display so we can restore
              try { n.dataset.__replayOrigDisplay = (n.style && n.style.display) ? n.style.display : ''; } catch (e) { }
              try { n.style.setProperty('display', 'none', 'important'); } catch (e) { n.style.display = 'none'; }
              added.push(n);
            }
          } catch (e) { /* ignore invalid selectors */ }
        }
      };

      hideElems(sidebarSelectors);
      hideElems(headerSelectors);

      // also try to remove any left-margin on main content containers
      try {
        const contentCandidates = Array.from(document.querySelectorAll('.ant-layout-content, .main-content, .content, .site-layout-content, .app-root'));
        for (const c of contentCandidates) {
          try { c.dataset.__replayOrigPaddingLeft = c.style && c.style.paddingLeft ? c.style.paddingLeft : ''; } catch (e) { }
          try { c.style.setProperty('padding-left', '0px', 'important'); } catch (e) { c.style.paddingLeft = '0px'; }
          try { c.dataset.__replayOrigMarginLeft = c.style && c.style.marginLeft ? c.style.marginLeft : ''; } catch (e) { }
          try { c.style.setProperty('margin-left', '0px', 'important'); } catch (e) { c.style.marginLeft = '0px'; }
          added.push(c);
        }
      } catch (e) { }

    } catch (e) { }

    return () => {
      try {
        // restore original inline styles where we saved them
        for (const n of added) {
          try {
            if (n && n.dataset) {
              if (n.dataset.__replayOrigDisplay !== undefined) {
                try { n.style.display = n.dataset.__replayOrigDisplay || ''; } catch (e) { n.style.removeProperty('display'); }
                delete n.dataset.__replayOrigDisplay;
              }
              if (n.dataset.__replayOrigPaddingLeft !== undefined) {
                try { n.style.paddingLeft = n.dataset.__replayOrigPaddingLeft || ''; } catch (e) { n.style.removeProperty('padding-left'); }
                delete n.dataset.__replayOrigPaddingLeft;
              }
              if (n.dataset.__replayOrigMarginLeft !== undefined) {
                try { n.style.marginLeft = n.dataset.__replayOrigMarginLeft || ''; } catch (e) { n.style.removeProperty('margin-left'); }
                delete n.dataset.__replayOrigMarginLeft;
              }
            }
          } catch (e) { }
        }
      } catch (e) { }
      try { document && document.body && document.body.classList && document.body.classList.remove('replay-hide-sidebar'); } catch (e) { }
    };
  }, []);

  // Auto-load a small demo record when `?demo=1` is present in the URL.
  useEffect(() => {
    try {
      if (!record && typeof window !== 'undefined') {
        const q = new URLSearchParams(window.location.search);
        if (q.get('demo')) {
          const sample = {
            letterNo: 'DEMO-001',
            source: 'Demo source',
            content: 'This is a demo record used when no backend data is available. Replace with real data when connected to the server.',
            meta: {},
            attachments: []
          };
          setRecord(sample);
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const printSheetDirect = async () => {
    try {
      setIsPrinting(true);
      // give the browser a moment to apply print styles
      await new Promise(res => setTimeout(res, 30));
      try {
        window.focus();
      } catch (e) { }
      try {
        window.print();
      } catch (e) {
        console.error('printSheetDirect: window.print failed', e);
      }
    } finally {
      try { setIsPrinting(false); } catch (e) { }
    }
  };

  // Intercept Ctrl+P / Cmd+P and route to our robust print flow so
  // browser print dialog uses the same single-page, inlined print output.
  useEffect(() => {
    const onKey = (e) => {
      try {
        const isMod = e.ctrlKey || e.metaKey;
        const key = e.key || String.fromCharCode(e.keyCode || 0).toLowerCase();
        if (isMod && (key === 'p' || e.keyCode === 80)) {
          // avoid hijacking when focus is on an editable field where user expects browser print
          const tag = (e.target && e.target.tagName) ? String(e.target.tagName).toLowerCase() : '';
          const editable = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable);
          if (editable) return;
          e.preventDefault();
          e.stopPropagation();
          // call the robust print flow
          try { printSheetV2(); } catch (err) { try { window.print(); } catch (e) { } }
        }
      } catch (err) { }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  // New robust print function: inline CSS, convert blob images to data URIs,
  // rewrite relative URLs to absolute, then open a print window and print.
  const printSheetV2 = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      const el = document.querySelector('.sheet');
      if (!el) {
        setIsPrinting(false);
        return printPage();
      }

      // clone element to manipulate safely
      const clone = el.cloneNode(true);

      // helper to convert blob: or relative URLs to usable URLs/data-URIs
      const toDataUrl = async (url) => {
        try {
          if (!url) return url;
          url = url.trim().replace(/^url\(|\)$/g, '').replace(/^['"]|['"]$/g, '');
          if (url.startsWith('data:')) return url;
          if (url.startsWith('blob:')) {
            try {
              const res = await fetch(url);
              const b = await res.blob();
              return await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = reject;
                fr.readAsDataURL(b);
              });
            } catch (e) { return url; }
          }
          // make relative -> absolute
          if (!/^https?:\/\//i.test(url)) {
            try { return new URL(url, document.baseURI).href; } catch (e) { return url; }
          }
          return url;
        } catch (e) { return url; }
      };

      // helper: try to fetch a resource and convert to data: URI when possible
      const fetchResourceToDataUrl = async (rawUrl) => {
        try {
          if (!rawUrl) return rawUrl;
          const u = rawUrl.trim().replace(/^['"]|['"]$/g, '');
          if (u.startsWith('data:')) return u;
          if (u.startsWith('blob:')) {
            try { return await toDataUrl(u); } catch (e) { return u; }
          }
          const abs = (!/^https?:\/\//i.test(u)) ? (new URL(u, document.baseURI).href) : u;
          try {
            const res = await fetch(abs, { mode: 'cors' });
            if (!res || !res.ok) return abs;
            const b = await res.blob();
            return await new Promise((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(fr.result);
              fr.onerror = reject;
              fr.readAsDataURL(b);
            });
          } catch (e) {
            return abs;
          }
        } catch (e) {
          return rawUrl;
        }
      };

      // Replace url(...) occurrences in a CSS text by converting resources to data: URIs when possible
      const replaceCssUrls = async (cssText) => {
        try {
          if (!cssText || !/url\(/i.test(cssText)) return cssText;
          const matches = [];
          cssText.replace(/url\(([^)]+)\)/g, (m, u) => { matches.push(u); return m; });
          if (!matches.length) return cssText;
          const unique = Array.from(new Set(matches.map(m => m)));
          const map = {};
          await Promise.all(unique.map(async (raw) => {
            try { map[raw] = await fetchResourceToDataUrl(raw); } catch (e) { map[raw] = raw; }
          }));
          // perform replacements
          let out = cssText;
          Object.keys(map).forEach(raw => {
            try {
              // escape for regex
              const esc = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
              // quoted or unquoted
              out = out.replace(new RegExp("url\\((\\s*['\"]?" + esc + "['\"]?\\s*)\\)", 'g'), () => `url('${map[raw]}')`);
              out = out.replace(new RegExp("url\\((\\s*" + esc + "\\s*)\\)", 'g'), () => `url('${map[raw]}')`);
            } catch (e) { }
          });
          return out;
        } catch (e) { return cssText; }
      };

      // Convert img[src] inside clone to data: URIs when possible so images survive in the new print window
      const originalImgs = Array.from(el.querySelectorAll('img'));
      const imgs = Array.from(clone.querySelectorAll('img'));
      await Promise.all(imgs.map(async (img, i) => {
        try {
          const origImg = originalImgs[i];
          if (origImg && origImg.complete && origImg.naturalWidth > 0) {
            // Attempt to grab the image data directly from the already-loaded original image
            const canvas = document.createElement('canvas');
            canvas.width = origImg.naturalWidth;
            canvas.height = origImg.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(origImg, 0, 0);
            try {
              const dataUrl = canvas.toDataURL('image/png');
              img.setAttribute('src', dataUrl);
              return; // Success!
            } catch (err) {
              // Canvas tainted (cross-origin), fallback below
            }
          }
          
          const s = img.getAttribute && img.getAttribute('src');
          if (!s) return;
          // prefer fetching and converting to data: URI for robust print embedding
          const newSrc = await fetchResourceToDataUrl(s).catch(() => null) || await toDataUrl(s).catch(() => null);
          if (newSrc) img.setAttribute('src', newSrc);
        } catch (e) { }
      }));

      // Replace url(...) in inline style attributes
      const nodesWithStyle = Array.from(clone.querySelectorAll('[style]'));
      await Promise.all(nodesWithStyle.map(async (n) => {
        try {
          const st = n.getAttribute('style');
          if (!st || !/url\(/i.test(st)) return;
          const replaced = await st.replace(/url\(([^)]+)\)/g, (m, u) => {
            // we'll replace asynchronously by building promises, but simple approach: resolve synchronously where possible
            // mark placeholder and handle later
            return `url(${u})`;
          });
          // For simplicity, attempt synchronous rewrite for relative/blob values found
          let newStyle = replaced.replace(/url\(([^)]+)\)/g, (m, u) => {
            const raw = u.trim().replace(/^['"]|['"]$/g, '');
            if (!raw) return m;
            if (raw.startsWith('data:')) return `url('${raw}')`;
            if (raw.startsWith('blob:')) {
              // cannot await here, leave original; blob images handled via <img> conversion above
              return `url('${raw}')`;
            }
            try { return `url('${new URL(raw, document.baseURI).href}')`; } catch (e) { return m; }
          });
          try { newStyle = await replaceCssUrls(newStyle); } catch (e) { }
          n.setAttribute('style', newStyle);
        } catch (e) { }
      }));

      // fetch and inline stylesheets (rewrite url() and @import)
      let headCss = '';
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      for (const link of links) {
        try {
          const href = link.getAttribute('href') || '';
          const abs = href && !href.startsWith('data:') && !/^https?:\/\//i.test(href) ? new URL(href, document.baseURI).href : href;
          try {
            const res = await fetch(abs, { cache: 'no-store' });
            if (res && res.ok) {
              let txt = await res.text();
              txt = txt.replace(/url\(([^)]+)\)/g, (m, u) => {
                let url = u.trim().replace(/^['"]|['"]$/g, '');
                try { if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) url = new URL(url, abs).href; } catch (e) { }
                return `url('${url}')`;
              });
              txt = txt.replace(/@import\s+(?:url\()?['"]?([^'"\)]+)['"]?\)?/g, (m, u) => {
                try { if (!/^https?:\/\//i.test(u) && !u.startsWith('data:')) u = new URL(u, abs).href; } catch (e) { }
                return `@import url('${u}')`;
              });
              headCss += '\n' + txt;
              continue;
            }
          } catch (e) {
            // ignore and fallback to link
          }
          // fallback: use absolute link reference
          headCss += `\n@import url('${abs}');`;
        } catch (e) { }
      }

      // also copy inline styles
      Array.from(document.querySelectorAll('style')).forEach(s => { try { headCss += '\n' + s.innerHTML; } catch (e) { } });

      // also replace urls inside headCss to data: URIs when possible so background images/fonts inline
      try { headCss = await replaceCssUrls(headCss); } catch (e) { }

      // compute conservative scale to fit content on one A4 page bottom Printheight
      let scale = 1;
      // derive marginMM from UI paddings (average) so print flow can use it outside try block
      let marginMM = ((Number(uiPaddingLeft || 0) + Number(uiPaddingRight || 0)) / 2) || 8;
      try {
        const tmp = document.createElement('div');
        tmp.style.position = 'absolute';
        tmp.style.left = '-9999px';
        tmp.style.height = '297mm';
        document.body.appendChild(tmp);
        const pagePx = tmp.getBoundingClientRect().height || (297 * 3.78);
        document.body.removeChild(tmp);
        // margins: derive left/right from UI paddings (use average) and account for header allowance
        marginMM = ((Number(uiPaddingLeft || 0) + Number(uiPaddingRight || 0)) / 2) || marginMM || 8;
        const printablePx = pagePx - (marginMM * 2) * (pagePx / 297) - (10 * (pagePx / 297));
        const elH = el.getBoundingClientRect().height || el.offsetHeight || 1;
        const s = printablePx / elH;
        scale = Math.min(1, Math.max(0.4, s));
      } catch (e) { scale = 1; }

      // build print document using scaled print CSS so content fits one page
      // wrap clone in a print wrapper and scale the .sheet to fit one A4 page
      const printableWidth = `calc(210mm - ${Number(marginMM * 2).toFixed(2)}mm)`;
      const printableHeight = '297mm';
      const wrapperStyle = `html,body{height:${printableHeight};margin:0;padding:0;overflow:hidden;} #replay-print-wrapper{width:${printableWidth};height:${printableHeight};display:flex;align-items:flex-start;justify-content:center;overflow:hidden;margin:0 auto;} #replay-print-wrapper .sheet{transform: scale(${scale}); transform-origin: top center; width:${printableWidth}; box-sizing: border-box;} /* hide reference panel/preview in print */ .ref-panel, .ref-panel * { display: none !important; }`;
      const printHtml = `<!doctype html><html><head><meta charset="utf-8"><base href="${document.baseURI}"><style>body{margin:0;padding:0;font-family:'Khmer OS Siemreap','Noto Sans Khmer',Arial,sans-serif;color:#000;background:#fff;}</style><style>${getPrintCss(scale, marginMM)}</style><style>${wrapperStyle}</style><style>${headCss}</style></head><body><div id="replay-print-wrapper">${clone.outerHTML}</div></body></html>`;

      let printFrame = document.getElementById('print-iframe-v2');
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'print-iframe-v2';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
      }
      const printWin = printFrame.contentWindow;
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      // wait for the new window to finish rendering before printing
      const doPrint = () => {
        try { printWin.focus(); } catch (e) { }
        try { printWin.print(); } catch (e) { console.error('print error', e); }
        setTimeout(() => { try { printWin.close(); } catch (e) { } }, 700);
      };

      try {
        const start = Date.now();
        const poll = setInterval(() => {
          try {
            if (!printWin || printWin.closed) return clearInterval(poll);
            if (Date.now() - start > 5000) {
              clearInterval(poll);
              return doPrint();
            }
            // Wait for all images to be complete
            const imgs = Array.from(printWin.document.images || []);
            const allLoaded = imgs.every(img => img.complete && img.naturalWidth > 0);
            if (allLoaded) {
              clearInterval(poll);
              // Give a small delay for browser to paint the rendered images
              setTimeout(doPrint, 200);
            }
          } catch (e) {
            // cross-origin access error or closed
            clearInterval(poll);
            doPrint();
          }
        }, 150);
        
        // 5 second fallback if some image is stuck
        setTimeout(() => {
          try { clearInterval(poll); } catch(e) {}
          if (printWin && !printWin.closed) doPrint();
        }, 5000);
      } catch (e) {
        // last-resort fallback
        setTimeout(() => { try { printWin.print(); } catch (err) { } }, 500);
      }
    } finally {
      try { setIsPrinting(false); } catch (e) { }
    }
  };


  return (
    <div>
      {/* Reverted persistent print-fix to restore browser's default Ctrl+P behavior */}
      {/* dynamic layout styles controlled by toolbar (apply to all sheet content) */}
      <style>{`
        .sheet .page, .sheet .page * { font-size: ${uiFontSize}px !important; line-height: ${uiLineHeight} !important; }
        .sheet .page { 
          font-size: ${uiFontSize}px !important; 
          line-height: ${uiLineHeight} !important; 
          padding-top: ${uiPaddingTop}mm !important;
          max-height: none !important;
          overflow: visible !important;
        }
        .sheet .field { margin-top: ${uiParaBefore}px !important; margin-bottom: ${uiParaAfter}px !important; }
        .sheet .field .label { font-size: ${Math.max(10, uiFontSize - 2)}px !important; }
        .sheet .field .value, .sheet .field .value-plain { font-size: ${uiFontSize}px !important; }
        .sheet textarea { font-size: ${uiFontSize}px !important; line-height: ${uiLineHeight} !important; }
      `}</style>
      <style>{`.sheet .page .role-label { font-size: 12px !important; } .sheet .page .sender-name { font-size: 12px !important; } .sheet .page .role-s2 { font-size: 12px !important; }
    .replay-hide-sidebar .ant-layout-sider, .replay-hide-sidebar .sidebar, .replay-hide-sidebar [role="navigation"], .replay-hide-sidebar .app-sider, .replay-hide-sidebar .site-layout-sider, .replay-hide-sidebar .ant-pro-sider { display: none !important; width: 0 !important; height: 0 !important; overflow: hidden !important; }
    .replay-hide-sidebar .ant-layout-header, .replay-hide-sidebar .topbar, .replay-hide-sidebar .app-header, .replay-hide-sidebar .navbar, .replay-hide-sidebar .header, .replay-hide-sidebar .site-header { display: none !important; height: 0 !important; }
    .replay-hide-sidebar .ant-layout-content, .replay-hide-sidebar .main-content, .replay-hide-sidebar .content, .replay-hide-sidebar .site-layout-content { margin-left: 0 !important; padding-left: 0 !important; }
    .replay-hide-sidebar .ant-layout, .replay-hide-sidebar .app-root { padding-left: 0 !important; }
    .replay-hide-sidebar .sheet { margin-left: auto !important; margin-right: auto !important; }
    `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0px 0' }}>
        <div>
          <button onClick={() => navigate(-1)} style={{ padding: '6px 10px', border: '1px solid #646669ff', borderRadius: 7 }}>Back</button>
        </div>
        <div>
          {record ? (
            <button
              onClick={() => navigate(`/send-feedback?recordId=${encodeURIComponent((record && (record._id || record.id)) || '')}&stage=s`)}
              style={{ padding: '6px 10px', background: '#0088cc', color: '#fff', borderRadius: 4, marginRight: 200, cursor: 'pointer' }}
            >
              {'ផ្ញើមតិ'}
            </button>
          ) : null}
          <button
            onClick={() => printSheetV2()}
            disabled={isPrinting}
            style={{
              padding: '6px 10px',
              background: isPrinting ? '#9ca3af' : '#4f46e5',
              color: '#fff',
              borderRadius: 4,
              marginRight: 100,
              cursor: isPrinting ? 'not-allowed' : 'pointer',
              opacity: isPrinting ? 0.6 : 1
            }}
          >
            {isPrinting ? 'Printing...' : 'Print'}
          </button>
          <span style={{ fontSize: 13, color: '#333', marginRight: 8 }}>Font</span>
          <input aria-label="Font size" type="number" min={8} max={30} value={uiFontSize} onChange={(e) => setUiFontSize(Number(e.target.value) || 12)} style={{ width: 56, marginRight: 8 }} />
          <span style={{ fontSize: 13, color: '#333', marginRight: 8 }}>Line</span>
          <input aria-label="Line height" type="number" step="0.1" min={1} max={3} value={uiLineHeight} onChange={(e) => setUiLineHeight(Number(e.target.value) || 1)} style={{ width: 56, marginRight: 8 }} />
          <span style={{ fontSize: 13, color: '#333', marginRight: 4 }}>Before</span>
          <input aria-label="Paragraph before" type="number" min={0} max={40} value={uiParaBefore} onChange={(e) => setUiParaBefore(Number(e.target.value) || 0)} style={{ width: 48, marginRight: 8 }} />
          <span style={{ fontSize: 13, color: '#333', marginRight: 4 }}>After</span>
          <input aria-label="Paragraph after" type="number" min={0} max={40} value={uiParaAfter} onChange={(e) => setUiParaAfter(Number(e.target.value) || 0)} style={{ width: 48 }} />
          <span style={{ fontSize: 13, color: '#333', margin: '0 8px' }}>Top</span>
          <input aria-label="Page top (mm)" type="number" min={0} max={40} value={uiPaddingTop} onChange={(e) => setUiPaddingTop(Number(e.target.value) || 0)} style={{ width: 56, marginRight: 8 }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 10px' }}>
        <details style={{ width: 'min(210mm, 100%)', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 }}>
          <summary style={{ cursor: 'pointer', fontFamily: 'Khmer OS Muol Light', fontSize: 14, color: '#111' }}>
            កំណត់ការបង្ហាញ
          </summary>

          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start' }}>
              <label style={{ fontSize: 13, color: '#333' }}>
                <input type="checkbox" checked={showLetterNo} onChange={(e) => setShowLetterNo(e.target.checked)} style={{ marginRight: 6 }} />
                បង្ហាញ លិខិតលេខ
              </label>
              <label style={{ fontSize: 13, color: '#333' }}>
                <input type="checkbox" checked={showCreatorName} onChange={(e) => setShowCreatorName(e.target.checked)} style={{ marginRight: 6 }} />
                បង្ហាញ បញ្ចូលលិខិតដោយ
              </label>
              <label style={{ fontSize: 13, color: '#333' }}>
                <input type="checkbox" checked={manualResizeEnabled} onChange={(e) => setManualResizeEnabled(e.target.checked)} style={{ marginRight: 6 }} />
                អនុញ្ញាត កាត់ទំហំដោយដៃ
              </label>
              <div style={{ marginLeft: 8 }}>
                <button type="button" onClick={() => {
                  try {
                    localStorage.removeItem('replayfile2:showLetterNo');
                    localStorage.removeItem('replayfile2:showCreatorName');
                    localStorage.removeItem('replayfile2:showDoAtStages');
                    localStorage.removeItem('replayfile2:showSignatureStages');
                    localStorage.removeItem('replayfile2:showNameStages');
                  } catch (e) { }
                  setShowLetterNo(false);
                  setShowCreatorName(false);
                  setShowDoAtStages(new Set());
                  setShowSignatureStages(new Set());
                  setShowNameStages(new Set());
                }} style={{ padding: '6px 10px', fontSize: 12 }}>Reset display settings</button>
              </div>
            </div>

            <div style={{ marginTop: 10, borderTop: '1px solid #eef2f6', paddingTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 1fr 56px', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#333', fontFamily: 'Khmer OS Muol Light' }}>Stage</div>
                <div style={{ fontSize: 13, color: '#333', fontFamily: 'Khmer OS Muol Light' }}>ធ្វើនៅ</div>
                <div style={{ fontSize: 13, color: '#333', fontFamily: 'Khmer OS Muol Light' }}>ហត្ថលេខា</div>
                <div style={{ fontSize: 13, color: '#333', fontFamily: 'Khmer OS Muol Light' }}>ឈ្មោះ</div>
                <div style={{ fontSize: 13, color: '#333', fontFamily: 'Khmer OS Muol Light', textAlign: 'center' }}>All</div>

                {(stageKeysForSettings && stageKeysForSettings.length) ? (
                  stageKeysForSettings.map((k) => (
                    <React.Fragment key={`stage-row-${k}`}>
                      <div style={{ fontSize: 13, color: '#111', fontFamily: 'Khmer OS Muol Light' }}>{k}</div>
                      <label style={{ fontSize: 13, color: '#333' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(showDoAtStages && showDoAtStages.has(k))}
                          onChange={() => toggleStageInSet(setShowDoAtStages, k)}
                        />
                      </label>
                      <label style={{ fontSize: 13, color: '#333' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(showSignatureStages && showSignatureStages.has(k))}
                          onChange={() => toggleStageInSet(setShowSignatureStages, k)}
                        />
                      </label>
                      <label style={{ fontSize: 13, color: '#333' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(showNameStages && showNameStages.has(k))}
                          onChange={() => toggleStageInSet(setShowNameStages, k)}
                        />
                      </label>
                      <label style={{ fontSize: 13, color: '#333', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(showDoAtStages && showDoAtStages.has(k) && showSignatureStages && showSignatureStages.has(k) && showNameStages && showNameStages.has(k))}
                          onChange={() => {
                            const allOn = Boolean(showDoAtStages && showDoAtStages.has(k) && showSignatureStages && showSignatureStages.has(k) && showNameStages && showNameStages.has(k));
                            if (allOn) {
                              // turn off for this stage
                              setShowDoAtStages(prev => { const n = new Set(prev || []); n.delete(k); return n; });
                              setShowSignatureStages(prev => { const n = new Set(prev || []); n.delete(k); return n; });
                              setShowNameStages(prev => { const n = new Set(prev || []); n.delete(k); return n; });
                            } else {
                              // turn on for this stage
                              setShowDoAtStages(prev => { const n = new Set(prev || []); n.add(k); return n; });
                              setShowSignatureStages(prev => { const n = new Set(prev || []); n.add(k); return n; });
                              setShowNameStages(prev => { const n = new Set(prev || []); n.add(k); return n; });
                            }
                          }}
                        />
                      </label>
                    </React.Fragment>
                  ))
                ) : (
                  <div style={{ gridColumn: '1 / -1', fontSize: 13, color: '#666' }}>មិនទាន់មានវគ្គផ្ញើមតិ</div>
                )}
              </div>
            </div>
          </div>
        </details>
      </div>

      {loading && <div style={{ padding: 20 }}>កំពុងដឹកនាំ...</div>}
      {!loading && !record && (
        <div style={{ padding: 10 }}>
          <div>រកមិនឃើញកំណត់ត្រា</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => {
                try {
                  const sample = {
                    letterNo: 'DEMO-001',
                    source: 'Demo source',
                    content: 'This is a demo record used when no backend data is available. Replace with real data when connected to the server.',
                    meta: {},
                    attachments: []
                  };
                  setRecord(sample);
                } catch (e) { /* ignore */ }
              }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #646669ff' }}
            >
              Load demo record
            </button>
            <div style={{ color: '#666', fontSize: 13 }}>or append <code>?demo=1</code> to the URL to auto-load</div>
          </div>
        </div>
      )}

      {record && (
        <div style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', justifyContent: 'center', paddingTop: 16, paddingLeft: 24, paddingRight: 24, background: '#efefef', flexWrap: 'wrap', overflowX: 'auto' }}>
          <div className="sheet" ref={sheetRef} style={{ width: '210mm', minWidth: '210mm', height: '297mm', flexShrink: 0, margin: '24px 12px 24px 24px', background: '#fff', boxShadow: '0 10px 24px rgba(0,0,0,0.14)', borderRadius: 6, boxSizing: 'border-box', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
            <div className="page" style={{ padding: '10mm', fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", color: '#000', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center', fontWeight: 300, marginBottom: 6, fontFamily: 'Khmer OS Muol Light', fontSize: 18 }}>
                ព្រះរាជាណាចក្រកម្ពុជា
              </div>

              <div style={{ textAlign: 'center', fontWeight: 300, marginBottom: 5, fontFamily: 'Khmer OS Muol Light', fontSize: 1 }}>
                ជាតិ សាសនា ព្រះមហាក្សត្រ
              </div>

              <div style={{ position: 'relative', textAlign: 'center', margin: '10px 0' }}>
                {true ? (
                  <img
                    src={logo3} // or a URL like `${API_BASE}${signature.filePath}`
                    alt=""
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 100,
                      height: 'auto',
                      opacity: 98,
                      pointerEvents: 'none',
                      zIndex: 1
                    }}
                  />
                ) : null}
              </div>

              <div style={{ textAlign: 'left', padding: '0mm 0', fontFamily: 'Khmer OS Muol Light', fontSize: 16 }}>
                ក្រសួងសុខាភិបាល
              </div>

              <div style={{ textAlign: 'left', padding: '1mm 0', fontFamily: 'Khmer OS Muol Light', fontSize: 15 }}>
                មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត
              </div>

              <div style={{ textAlign: 'center', fontFamily: 'Khmer OS Muol Light', fontSize: 15, marginTop: 0 }}>
                កំណត់បង្ហាញ
              </div>


              <div className="field" style={{ marginTop: 5, display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                <span className="label" style={{ width: 140, minWidth: 140, fontFamily: 'Khmer OS Muol Light', fontSize: 15 }}>លេខលិខិតចូល:</span>
                <span className="value" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ lineHeight: 1 }}>{record?.entryNo ? toKhmerDigits(record.entryNo) : ''} ម.ម.ខ.ស</div>
                    <div style={{ fontSize: 14, color: '#000' }}>{(() => {
                      const raw = (record && (record.entryDate || record.date)) || capturedDate;
                      if (!raw) return '';
                      const entryTime = (record && (record.entryTime || record.entry_time)) || '';
                      const dt = applyEntryTime(parsePreferLocalTime(raw, entryTime), entryTime);
                      return `ចុះ ${formatKhmerDateTime(dt)}`;
                    })()}</div>
                  </div>
                </span>
              </div>
              {effectiveShowLetterNo ? (
                <div className="field" style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                  <span className="label" style={{ width: 140, minWidth: 140, fontFamily: 'Khmer OS Muol Light', fontSize: 15 }}>លិខិតលេខ:</span>
                  <span className="value" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div>{record?.letterNo ? toKhmerDigits(record.letterNo) : ''}</div>
                      <div style={{ fontSize: 12, color: '#070707ff' }}>{(() => {
                        const raw = (record && record.date) || capturedDate;
                        if (!raw) return '';
                        const dt = (raw instanceof Date) ? raw : new Date(raw);
                        return `ចុះ ${formatKhmerDate(dt)}`;
                      })()}</div>
                    </div>
                  </span>
                </div>
              ) : null}
              <div className="field" style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                <span className="label" style={{ width: 140, minWidth: 140, fontFamily: 'Khmer OS Muol Light', fontSize: 15 }}>មកពី:</span>
                <span className="value" style={{ flex: 1 }}>{record?.source || ''}</span>
              </div>

              <div className="field" style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                <span className="label" style={{ width: 140, minWidth: 140, fontFamily: 'Khmer OS Muol Light', fontSize: 15 }}>កម្មវត្ថុ:</span>
                <span className="value-plain" style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{record?.content || ''}</span>
              </div>



              {effectiveShowCreatorName ? (
                <div className="field" style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                  <span className="label" style={{ width: 140, minWidth: 140, fontFamily: 'Khmer OS Muol Light', fontSize: 15 }}>បញ្ចូលលិខិតដោយ:</span>
                  <span className="value" style={{ flex: 1 }}>{record?.creatorName || ''}</span>
                </div>
              ) : null}



              {visibleStages && visibleStages.has('S') && (
                <div style={{ border: '1px dashed #161616ff', padding: 1, marginTop: 5 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '50fr', gap: 12 }}>
                    <div style={{ padding: 1 }}>
                      <div className="role-label" style={{ textAlign: 'center', marginTop: 2, fontFamily: 'Khmer OS Muol Light', fontSize: 10 }}>
                        {(meta && meta.feedbackStageRoles && meta.feedbackStageRoles.s) || getRoleLabel('s') || (meta && meta.reporterName)}
                      </div>
                      <textarea
                        rows={4}
                        ref={courseNoteRef}
                        value={leftContent}
                        onChange={(e) => { setLeftContent(e.target.value); clearStageMessage('S'); }}
                        placeholder=""
                        disabled={!isAssignedToStage(['S'])}
                        style={{
                          width: '100%',
                          height: 'auto',
                          minHeight: '24px',
                          lineHeight: uiLineHeight,
                          textAlign: 'justify',
                          margin: 0,
                          padding: '8px 22px 12px 8px',
                          resize: manualResizeEnabled ? 'both' : 'none',
                          overflow: manualResizeEnabled ? 'auto' : 'hidden',
                          backgroundImage: manualResizeEnabled ? "linear-gradient(135deg, rgba(0,0,0,0.22) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.16) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.1) 25%, transparent 25%)" : 'none',
                          backgroundSize: manualResizeEnabled ? '14px 14px, 10px 10px, 6px 6px' : '0 0',
                          backgroundRepeat: manualResizeEnabled ? 'no-repeat' : 'no-repeat',
                          backgroundPosition: manualResizeEnabled ? 'right 6px bottom 6px, right 4px bottom 4px, right 2px bottom 2px' : '0 0',
                          fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                          boxSizing: 'border-box',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          textIndent: '30px'
                        }}
                      />

                      <div style={{ textAlign: 'center', marginTop: 0 }}>
                        {hasCourseNote ? (
                          <>
                            {effectiveShowDoAt('S') ? (
                              <div>ធ្វើនៅ {formatKhmerDateTime(dateForMetaKey('CourseDate') || capturedDate)}</div>
                            ) : null}
                            {(effectiveShowSignature('S') && sigSUrl) ? (
                              <div style={{ marginTop: 0 }}>
                                <img src={sigSUrl} alt="sig-s" style={{ maxWidth: 100, maxHeight: 80, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {(((effectiveShowName('S') && (stagesWithFeedback && stagesWithFeedback.has('S'))) || stageHasSenderForKeys(['S']))) ? (
                          <div className="sender-name" style={{ fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }}>
                            {getStageSenderName('S') || ''}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', justifyContent: hasCourseNote ? 'space-between' : 'flex-start', alignItems: 'center', marginTop: 6, padding: '0px' }}>
                        <div style={{ color: stageMessageFor('S') ? '#0b6623' : '#e53333ff', minHeight: 0 }}>{stageMessageFor('S')}</div>
                        {/* In-sheet Send Feedback button removed; toolbar and print-only buttons used instead */}
                      </div>
                    </div>
                  </div>

                </div>
              )}


              <div style={{ marginTop: '0mm' }} />

              {/* Stage 1 (S1) - Office box: show when S1 assigned or has a value */}
              {visibleStages && visibleStages.has('S1') && (
                <div style={{ border: '1px dashed #161616ff', padding: 1, marginTop: 5 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    <div style={{ padding: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                        <div className="role-label" style={{ textAlign: 'center', fontFamily: 'Khmer OS Muol Light', flex: 1 }}>{getRoleLabel('S1')}</div>
                      </div>
                      <textarea
                        rows={4}
                        ref={s1TextareaRef}
                        value={s1Content}
                        onChange={(e) => { setS1Content(e.target.value); clearStageMessage('S1'); }}
                        placeholder=""
                        disabled={!isAssignedToStage(['S1'])}
                        style={{
                          width: manualResizeEnabled ? 'calc(100% - 18px)' : '100%',
                          height: 'auto',
                          minHeight: '72px',
                          lineHeight: uiLineHeight,
                          textAlign: 'justify',
                          margin: 0,
                          marginRight: manualResizeEnabled ? '18px' : 0,
                          marginBottom: manualResizeEnabled ? '12px' : 0,
                          padding: '8px 22px 12px 8px',
                          resize: manualResizeEnabled ? 'both' : 'none',
                          overflow: manualResizeEnabled ? 'auto' : 'hidden',
                          fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                          boxSizing: 'border-box',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          textIndent: '30px'
                        }}
                      />

                      <div style={{ textAlign: 'center', marginTop: 0 }}>
                        {hasCourse1Note ? (
                          <>
                            {effectiveShowDoAt('S1') ? (
                              <div>ធ្វើនៅ {formatKhmerDateTime(dateForMetaKey('Course1Date') || capturedDate)}</div>
                            ) : null}
                            {(effectiveShowSignature('S1') && sig1Url) ? (
                              <div style={{ marginTop: 0 }}>
                                <img src={sig1Url} alt="sig-s1" style={{ maxWidth: 120, maxHeight: 80, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                              </div>
                            ) : null}
                          </>
                        ) : null}

                        {(((effectiveShowName('S1') && (stagesWithFeedback && stagesWithFeedback.has('S1'))) || stageHasSenderForKeys(['S1']))) ? (
                          <div className="sender-name" style={{ fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }}>{getStageSenderName('S1') || ''}</div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', justifyContent: hasCourse1Note ? 'space-between' : 'flex-start', alignItems: 'center', marginTop: 6, padding: '0px' }}>
                        <div style={{ color: stageMessageFor('S1') ? '#0b6623' : '#666', minHeight: 0 }}>{stageMessageFor('S1')}</div>
                        {/* in-sheet send button removed; use toolbar/print-only controls instead */}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Department Head block similar UI to the recipient block */}
              {/** Department head note block: textarea + signature/date like Course1Note */}
              {visibleStages && visibleStages.has('S2') && (
                <div style={{ border: '1px dashed #161616ff', padding: 1, marginTop: 5 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    <div style={{ padding: 1 }}>
                      <div className="role-s2 role-label" style={{ textAlign: 'center', marginTop: 5, fontFamily: 'Khmer OS Muol Light' }}>{getRoleLabel('S2')}</div>
                      <textarea
                        rows={4}
                        ref={deptTextareaRef}
                        value={deptContent}
                        onChange={(e) => { setDeptContent(e.target.value); clearStageMessage('S2'); }}
                        placeholder=""
                        disabled={!isAssignedToStage(['S2'])}
                        style={{
                          width: manualResizeEnabled ? 'calc(100% - 18px)' : '100%',
                          height: 'auto',
                          minHeight: '72px',
                          lineHeight: uiLineHeight,
                          textAlign: 'justify',
                          margin: 0,
                          marginRight: manualResizeEnabled ? '18px' : 0,
                          marginBottom: manualResizeEnabled ? '12px' : 0,
                          padding: '8px 22px 12px 8px',
                          resize: manualResizeEnabled ? 'both' : 'none',
                          overflow: manualResizeEnabled ? 'auto' : 'hidden',
                          fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                          boxSizing: 'border-box',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          textIndent: '30px'
                        }}
                      />

                      <div style={{ textAlign: 'center', marginTop: 0 }}>
                        {hasDeptNote ? (
                          <>
                            {effectiveShowDoAt('S2') ? (
                              <div>ធ្វើនៅ {formatKhmerDateTime(dateForMetaKey('Course2Date') || capturedDate)}</div>
                            ) : null}
                            {(effectiveShowSignature('S2') && sig2Url) ? (
                              <div style={{ marginTop: 6 }}>
                                <img src={sig2Url} alt="sig-head" style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {(((effectiveShowName('S2') && (stagesWithFeedback && stagesWithFeedback.has('S2'))) || stageHasSenderForKeys(['S2']))) ? (
                          <div className="sender-name" style={{ fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 5, fontWeight: 100 }}>{getStageSenderName('S2') || ''}</div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', justifyContent: hasDeptNote ? 'space-between' : 'flex-start', alignItems: 'center', marginTop: 6, padding: '0px' }}>
                        <div style={{ color: stageMessageFor('S2') ? '#0b6623' : '#666', minHeight: 0 }}>{stageMessageFor('S2')}</div>
                        {/* in-sheet send button removed; use toolbar/print-only controls instead */}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stage area end — Deputy Director block matching recipient UI វគ្គទី4 ទី5 */}
              {(visibleStages && (visibleStages.has('S3') || visibleStages.has('S4'))) ? deputyBlock : null}

              {visibleStages && visibleStages.has('S5') && (
                (visibleStages && visibleStages.has('S4')) ? (
                  // Side-by-side S4 (deputy right) and S5 (director)
                  <div style={{ marginTop: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ border: '1px dashed #161616ff', padding: 5 }}>
                      <div style={{ padding: 1 }}>
                        <div className="role-label" style={{ textAlign: 'center', marginTop: 0, fontFamily: 'Khmer OS Muol Light' }}>{getRoleLabel('S4')}</div>
                        <textarea rows={4} ref={deputyRightTextareaRef} value={deputyRightContent} onChange={(e) => { setDeputyRightContent(e.target.value); clearStageMessage('S4'); }}
                          placeholder="" style={{
                            width: manualResizeEnabled ? 'calc(100% - 18px)' : '100%', height: 'auto', minHeight: '72px',
                            lineHeight: uiLineHeight,
                            textAlign: 'justify',
                            margin: 0,
                            marginRight: manualResizeEnabled ? '18px' : 0,
                            marginBottom: manualResizeEnabled ? '12px' : 0,
                            padding: '8px 22px 12px 8px',
                            resize: manualResizeEnabled ? 'both' : 'none',
                            overflow: manualResizeEnabled ? 'auto' : 'hidden',
                            fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                            boxSizing: 'border-box',
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            textIndent: '30px'
                          }}
                          disabled={!isAssignedToStage(['SDR', 'S4'])} />
                        <div style={{ textAlign: 'center', marginTop: 0 }}>
                          {hasDeputyRight ? (
                            <>
                              {effectiveShowDoAt('S4') ? (
                                <div>ធ្វើនៅ {formatKhmerDateTime(dateForMetaKey('Course4Date') || capturedDate)}</div>
                              ) : null}
                              {(effectiveShowSignature('S4') && sigDeputyRightUrl) ? (
                                <div style={{ marginTop: 0 }}>
                                  <img src={sigDeputyRightUrl} alt="sig-deputy-right" style={{ maxWidth: 100, maxHeight: 80, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                                </div>
                              ) : null}
                            </>
                          ) : null}
                          {(((effectiveShowName('S6') && (stagesWithFeedback && stagesWithFeedback.has('S6'))) || stageHasSenderForKeys(['HO', 'S6', 'S4', 'S3']))) ? (
                            <div className="sender-name" style={{
                              fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                              marginTop: 5, fontWeight: 100
                            }}>{getStageSenderName(['HO', 'S6', 'S4', 'S3']) || ''}</div>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginTop: 6, padding: '0px' }}>
                          <div style={{ color: stageMessageFor('S4') ? '#0b6623' : '#666', minHeight: 0 }}>{stageMessageFor('S4')}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ border: '1px dashed #161616ff', padding: 5 }}>
                      <div style={{ padding: 1 }}>
                        <div className="role-label" style={{ textAlign: 'center', marginTop: 0, fontFamily: 'Khmer OS Muol Light' }}>{getRoleLabel('S5')}</div>
                        <textarea
                          rows={4}
                          ref={directorTextareaRef}
                          value={directorContent}
                          onChange={(e) => { setDirectorContent(e.target.value); clearStageMessage('S5'); }}
                          placeholder=""
                          disabled={!isAssignedToStage(['DIR', 'SDIR', 'S5'])}
                          style={{
                            width: manualResizeEnabled ? 'calc(100% - 18px)' : '100%',
                            height: 'auto',
                            minHeight: '72px',
                            lineHeight: uiLineHeight,
                            textAlign: 'justify',
                            margin: 0,
                            marginRight: manualResizeEnabled ? '18px' : 0,
                            marginBottom: manualResizeEnabled ? '12px' : 0,
                            padding: '8px 22px 12px 8px',
                            resize: manualResizeEnabled ? 'both' : 'none',
                            overflow: manualResizeEnabled ? 'auto' : 'hidden',
                            fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                            boxSizing: 'border-box',
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            textIndent: '30px'
                          }}
                        />

                        <div style={{ textAlign: 'left', marginTop: 0 }}>
                          {hasDirector ? (
                            <>
                              {effectiveShowDoAt('S5') ? (
                                <div>ធ្វើនៅ {formatKhmerDateTime(dateForMetaKey('Course5Date') || capturedDate)}</div>
                              ) : null}
                              {(effectiveShowSignature('S5') && sigDirectorUrl) ? (
                                <div style={{ marginTop: 0 }}>
                                  <img src={sigDirectorUrl} alt="sig-director" style={{ maxWidth: 100, maxHeight: 70, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                                </div>
                              ) : null}
                            </>
                          ) : null}
                          {(((effectiveShowName('S5') && (stagesWithFeedback && stagesWithFeedback.has('S5'))) || stageHasSenderForKeys(['DIR', 'SDIR', 'S5']))) ? (
                            <div className="sender-name" style={{ fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }}>{getStageSenderName(['DIR', 'SDIR', 'S5']) || ''}</div>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginTop: 6, padding: '0px' }}>
                          <div style={{ color: stageMessageFor('S5') ? '#0b6623' : '#666', minHeight: 0 }}>{stageMessageFor('S5')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1px dashed #161616ff', padding: 1, marginTop: 5 }}>
                    <div style={{ padding: 1 }}>
                      <div className="role-label" style={{ textAlign: 'center', marginTop: 0, fontFamily: 'Khmer OS Muol Light' }}>{getRoleLabel('S5')}</div>
                      <textarea
                        rows={4}
                        ref={directorTextareaRef}
                        value={directorContent}
                        onChange={(e) => { setDirectorContent(e.target.value); clearStageMessage('S5'); }}
                        placeholder=""
                        disabled={!isAssignedToStage(['DIR', 'SDIR', 'S5'])}
                        style={{
                          width: manualResizeEnabled ? 'calc(100% - 18px)' : '100%',
                          height: 'auto',
                          minHeight: '72px',
                          lineHeight: uiLineHeight,
                          textAlign: 'left',
                          margin: 0,
                          marginRight: manualResizeEnabled ? '18px' : 0,
                          marginBottom: manualResizeEnabled ? '12px' : 0,
                          padding: '8px 22px 12px 8px',
                          resize: manualResizeEnabled ? 'both' : 'none',
                          overflow: manualResizeEnabled ? 'auto' : 'hidden',
                          fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                          boxSizing: 'border-box',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          textIndent: '30px'
                        }}
                      />

                      <div style={{ textAlign: 'center', marginTop: 0 }}>
                        {hasDirector ? (
                          <>
                            {effectiveShowDoAt('S5') ? (
                              <div>ធ្វើនៅ {formatKhmerDateTime(dateForMetaKey('Course5Date') || capturedDate)}</div>
                            ) : null}
                            {(effectiveShowSignature('S5') && sigDirectorUrl) ? (
                              <div style={{ marginTop: 0 }}>
                                <img src={sigDirectorUrl} alt="sig-director" style={{ maxWidth: 50, maxHeight: 50, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {(effectiveShowName('S5') || stageHasSenderForKeys(['DIR', 'SDIR', 'S5'])) ? (
                          <div className="sender-name" style={{ fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }}>{getStageSenderName(['DIR', 'SDIR', 'S5']) || ''}</div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginTop: 6, padding: '0px' }}>
                        <div style={{ color: stageMessageFor('S5') ? '#0b6623' : '#666', minHeight: 0 }}>{stageMessageFor('S5')}</div>
                      </div>
                    </div>
                  </div>
                )
              )}

              {visibleStages && visibleStages.has('S6') && (
                <div style={{ border: '1px dashed #161616ff', padding: 1, marginTop: 5 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '50fr', gap: 12 }}>
                    <div style={{ padding: 1 }}>
                      <div className="role-label" style={{ textAlign: 'center', marginTop: 0, fontFamily: 'Khmer OS Muol Light' }}>{getRoleLabel('S6')}</div>
                      <textarea
                        rows={4}
                        ref={headOfficeTextareaRef}
                        value={headOfficeContent}
                        onChange={(e) => { setHeadOfficeContent(e.target.value); clearStageMessage('S6'); }}
                        placeholder=""
                        disabled={!isAssignedToStage(['S6'])}
                        style={{
                          width: manualResizeEnabled ? 'calc(100% - 18px)' : '100%',
                          height: 'auto',
                          minHeight: '72px',
                          lineHeight: uiLineHeight,
                          textAlign: 'center',
                          margin: 0,
                          marginRight: manualResizeEnabled ? '18px' : 0,
                          marginBottom: manualResizeEnabled ? '12px' : 0,
                          padding: '8px 22px 12px 8px',
                          resize: manualResizeEnabled ? 'both' : 'none',
                          overflow: manualResizeEnabled ? 'auto' : 'hidden',
                          fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                          boxSizing: 'border-box',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          textIndent: '30px'
                        }}
                      />

                      <div style={{ textAlign: 'center', marginTop: 0 }}>
                        {hasHeadOffice ? (
                          <>
                            {effectiveShowDoAt('S6') ? (
                              <div>ធ្វើនៅ {formatKhmerDateTime(dateForMetaKey('Course6Date') || capturedDate)}</div>
                            ) : null}
                            {(effectiveShowSignature('S6') && sigHeadOfficeUrl) ? (
                              <div style={{ marginTop: 5 }}>
                                <img src={sigHeadOfficeUrl} alt="sig-headoffice" style={{ maxWidth: 160, maxHeight: 90, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                              </div>
                            ) : null}
                          </>
                        ) : null}

                        {(effectiveShowName('S6') || stageHasSenderForKeys(['HO', 'S6', 'S4', 'S3'])) ? (
                          <div className="sender-name" style={{ fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 5, fontWeight: 100 }}>
                            {getStageSenderName(['HO', 'S6', 'S4', 'S3']) || ''}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginTop: 0, padding: '0 px' }}>
                    <div style={{ color: stageMessageFor('S6') ? '#0b6623' : '#666', minHeight: 0 }}>{stageMessageFor('S6')}</div>
                  </div>
                </div>
              )}

            </div>
            {/* Right-side reference panel placed as a sibling so heights match */}
            <div className="ref-panel" style={{ position: 'relative', boxSizing: 'border-box', zIndex: 100, overflow: 'visible', background: 'transparent', width: '210mm', margin: '5mm auto 0', alignSelf: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', height: 'auto', border: '1px solid #ebe5eaff', borderRadius: 1, background: '#fff' }}>
                {/* header / toolbar */}
                <div style={{ padding: '0px 12px', borderBottom: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#ffffff' }}>
                  <div style={{ fontWeight: 100, fontFamily: "'Khmer OS Muol Light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", fontSize: 14 }}>ឯកសារយោង</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {refUrls && refUrls.length ? (
                      <div style={{ fontSize: 13, color: '#333' }}>{refUrls[0] && (refUrls[0].name || refUrls[0].url)}</div>
                    ) : null}
                    {selectedRef ? (
                      <a href={selectedRef} target="_blank" rel="noreferrer" style={{ fontSize: 16, marginLeft: 8 }}>Open</a>
                    ) : null}
                  </div>
                </div>

                <div style={{ padding: 0, paddingTop: '0mm', overflow: 'visible', display: 'block' }}>


                  <div style={{ flex: 1, minHeight: 80, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 8 }}>
                    {selectedRef ? (
                      // render preview filling the ref-panel area (use full-height container)
                      <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div ref={refPreviewWrapper} style={{ width: '210mm', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'visible', background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 2px 6px rgba(0,0,0,0.12)', padding: 8 }}>
                          {(String(selectedRef).toLowerCase().endsWith('.pdf')) ? (
                            // PDF.js renders canvases into this container; let it expand to show all pages
                            null
                          ) : (
                            <img src={selectedRef} alt="reference" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 1, color: '#666', fontFamily: "'Khmer OS Muol Light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'" }}>
                        <div style={{ marginBottom: 8 }}>មិនមានឯកសារយោង
                          <div style={{ fontSize: 12, color: '#999' }}> (debug hints shown below)</div>
                        </div>
                        <div style={{ fontSize: 13, color: '#444' }}>
                          <div style={{ marginBottom: 6 }}>កំណត់ត្រា exposed to console as <code>window.__REPLAY_RECORD</code></div>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Attachment hints:</div>
                          {(() => {
                            const hints = getAttachmentHints(record);
                            if (!hints || hints.length === 0) return (<div style={{ color: '#999' }}>No obvious attachment-like fields found in record (check console).</div>);
                            return (
                              <div style={{ maxHeight: 220, overflow: 'auto', border: '1px dashed #eee', padding: 8, background: '#fafafa' }}>
                                {hints.map((h, i) => (
                                  <div key={i} style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: 12, color: '#333', fontWeight: 600 }}>{h.path}</div>
                                    <div style={{ fontSize: 12, color: '#555', wordBreak: 'break-all' }}>{h.excerpt}</div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Floating send-to-Telegram button removed per UI request */}
      {/* Global Telegram feedback block: show regardless of stage notes */}
      {record && meta && Array.isArray(meta.telegramFeedback) && meta.telegramFeedback.length > 0 && (
        <div style={{ position: 'relative', width: 'min(210mm, 100%)', margin: '12px auto', maxWidth: 900 }}>
          <div style={{ border: '1px solid #0088cc', background: '#f4faff', borderRadius: 6, padding: '12px 18px', boxShadow: '0 2px 8px rgba(0,136,204,0.07)', fontFamily: "'Noto Sans Khmer','Khmer OS','Hanuman',Arial,sans-serif" }}>
            <div style={{ fontWeight: 700, color: '#0088cc', fontSize: 16, marginBottom: 8 }}>មតិ/ការឆ្លើយតបតាម Telegram</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {meta.telegramFeedback.map((fb, idx) => (
                <li key={idx} style={{ marginBottom: 12, padding: '8px 12px', background: '#fff', borderRadius: 4, borderLeft: '4px solid #0088cc', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontWeight: 600, color: '#005577', marginBottom: 2 }}>
                    {fb.userName || fb.from || 'អ្នកប្រើប្រាស់'}
                    <span style={{ fontWeight: 400, color: '#888', fontSize: 12, marginLeft: 8 }}>{(fb.timestamp || fb.date) ? (new Date(fb.timestamp || fb.date).toLocaleString('km-KH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) : ''}</span>
                  </div>
                  <div style={{ color: '#222', fontSize: 15, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{fb.message || fb.text || ''}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* Confirmation modal for stage send */}
      {confirmVisible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div role="dialog" aria-modal="true" style={{ width: 420, maxWidth: '94%', background: '#fff', borderRadius: 8, padding: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>ផ្ញើមតិទៅ Telegram</div>
            <div style={{ marginBottom: 12 }}>តើអ្នកចង់ផ្ញើមតិនេះទៅ Telegram ទេ? ជ្រើសមួយ៖</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={confirmAdvance} onChange={(e) => setConfirmAdvance(e.target.checked)} />
                <span>ផ្ញើ និងបើកវគ្គបន្ទាប់ (Advance to next stage)</span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setConfirmVisible(false)} style={{ padding: '6px 10px' }}>បោះបង់</button>
              <button onClick={() => doSendStage(confirmStageKey, false)} style={{ padding: '6px 10px' }}>ផ្ញើតែនេះ</button>
              <button onClick={() => doSendStage(confirmStageKey, confirmAdvance)} style={{ padding: '6px 10px', background: '#0088cc', color: '#fff', border: 'none', borderRadius: 6 }}>{sendingStage === confirmStageKey ? 'កំពុង...' : 'ផ្ញើ និងបើកវគ្គបន្ទាប់'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// debug helpers (enable with: window.__REPLAY_DEBUG__ = true)
if (typeof window !== 'undefined' && window.__REPLAY_DEBUG__) {
  try {
    // show record meta (if replay code exports it)
    // guard access in case __REPLAY_RECORD is not yet set
    try {
      const meta = window.__REPLAY_RECORD && window.__REPLAY_RECORD.meta;
      if (meta) console.log('REPLAY record meta:', meta);
    } catch (e) { }
    // list dashed boxes and first 200 chars of their text (best-effort)
    try {
      const els = document ? [...document.querySelectorAll('[style*="dashed"]')] : [];
      els.map((el, i) => ({ idx: i, text: (el.innerText || '').trim().slice(0, 200), html: (el.innerHTML || '').slice(0, 200) })).forEach(x => console.log(x));
    } catch (e) { /* ignore DOM inspection errors */ }
  } catch (e) { /* ignore */ }
}
