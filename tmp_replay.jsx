import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/Replayfile2Page.jsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=ced18999"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import usePermission from "/src/hooks/usePermission.js";
import __vite__cjsImport4_react from "/node_modules/.vite/deps/react.js?v=ced18999"; const React = __vite__cjsImport4_react.__esModule ? __vite__cjsImport4_react.default : __vite__cjsImport4_react; const useEffect = __vite__cjsImport4_react["useEffect"]; const useState = __vite__cjsImport4_react["useState"]; const useRef = __vite__cjsImport4_react["useRef"]; const useMemo = __vite__cjsImport4_react["useMemo"]; const useCallback = __vite__cjsImport4_react["useCallback"];
import { useAuth } from "/src/context/AuthContext.jsx";
import { useNavigate, useSearchParams } from "/node_modules/.vite/deps/react-router-dom.js?v=ced18999";
import api from "/src/services/api.js";
import { getFileTransfer, updateFileTransfer } from "/src/api/fileTransfer.js";
import { API_BASE } from "/src/config.js";
import logo3 from "/src/assets/3.JPG?import";
export default function Replayfile2Page() {
  _s();
  const { user: currentUser } = useAuth() || {};
  const perms = usePermission();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get("recordId");
  const [record, setRecord] = useState(null);
  const meta = record && (record.meta || {});
  const stages = meta && (meta.feedbackStages || {});
  const [signaturesMap, setSignaturesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!recordId) return;
      setLoading(true);
      try {
        if (!recordId) return;
        const data = await getFileTransfer(recordId).catch((e) => {
          throw e;
        });
        if (mounted) setRecord(data || null);
      } catch (e) {
        console.error("load record error", e);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [recordId]);
  const getRoleLabel = (role) => {
    if (!role && role !== 0) return "";
    const key = String(role).toLowerCase();
    try {
      const roles = meta && meta.feedbackStageRoles;
      if (roles && typeof roles === "object" && roles[key]) return roles[key];
    } catch (e) {
    }
    const map = {
      s: "មន្រ្តីទទួលបន្ទុក",
      s1: "យោបល់ប្រធានការិយាល័យបច្ចេកទេស",
      s2: "យោបល់ប្រធានការិយាល័យហិរញ្ញវត្ថុ",
      s3: "យោបល់ប្រធានការិយាល័យរដ្ឋបាលបុគ្គលិក",
      s4: "យោបល់នាយករងមន្ទីរពេទ្យ",
      s5: "យោបល់នាយករងមន្ទីរពេទ្យ",
      s6: "យោបល់នាយកមន្ទីរពេទ្យ",
      dir: "យោបល់នាយករងមន្ទីរពេទ្យ",
      ho: "យោបល់នាយករងមន្ទីរពេទ្យ"
    };
    return map[key] || role;
  };
  const firstCourse1Note = (m) => {
    try {
      if (!m || typeof m !== "object") return "";
      return m.CourseNote || m.Course1Note || m.centerNote || "" || "";
    } catch (e) {
      return "";
    }
  };
  const [leftContent, setLeftContent] = useState(firstCourse1Note(meta) || "");
  const [s1Content, setS1Content] = useState(meta && meta.Course1Note || "");
  const [centerContent, setCenterContent] = useState(meta && meta.centerNote || "");
  const [rightContent, setRightContent] = useState(meta && meta.rightNote || "");
  const [deptContent, setDeptContent] = useState(meta && meta.Course2Note || "");
  const [content3, setContent3] = useState(meta && meta.Course3Note || "");
  const [content4, setContent4] = useState(meta && meta.Course4Note || "");
  const [content5, setContent5] = useState(meta && meta.Course5Note || "");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveMessageStage, setSaveMessageStage] = useState(null);
  const STAGE_KEYS_BY_META = {
    CourseNote: "S",
    Course1Note: "S1",
    Course2Note: "S2",
    Course3Note: "S3",
    Course4Note: "S4",
    Course5Note: "S5",
    Course6Note: "S6"
  };
  const stageKeyByMeta = (metaKey) => STAGE_KEYS_BY_META[metaKey] || null;
  const setStageMessage = (message, stageKey = null) => {
    setSaveMessage(message);
    setSaveMessageStage(message ? stageKey : null);
  };
  const clearStageMessage = (stageKey) => {
    if (!stageKey || saveMessageStage === stageKey) {
      setSaveMessage("");
      setSaveMessageStage(null);
    }
  };
  const stageMessageFor = (stageKey) => saveMessageStage === stageKey ? saveMessage : "";
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
  const [deputyContent, setDeputyContent] = useState(meta && meta.Course3Note || "");
  const [deputyRightContent, setDeputyRightContent] = useState(meta && meta.Course4Note || "");
  const [headOfficeContent, setHeadOfficeContent] = useState(meta && meta.Course6Note || "");
  const [directorContent, setDirectorContent] = useState(meta && meta.Course5Note || "");
  const [directorStageSel, setDirectorStageSel] = useState(() => {
    try {
      if (!normalizedStages) return "";
      const raw = normalizedStages["S5"] || normalizedStages["DIR"] || normalizedStages["SDIR"];
      if (!raw) return "";
      if (typeof raw === "object") return raw._id || raw.id || raw.signatureId || raw.senderId || raw.senderName || raw.sender || "";
      return raw;
    } catch (e) {
      return "";
    }
  });
  const [directorOfficeName, setDirectorOfficeName] = useState("");
  const [capturedDate, setCapturedDate] = useState(null);
  const [refUrls, setRefUrls] = useState([]);
  const [selectedRef, setSelectedRef] = useState(null);
  const refIframe = useRef(null);
  const [showLargePreview, setShowLargePreview] = useState(false);
  const sheetRef = useRef(null);
  const refPreviewWrapper = useRef(null);
  const showCourse3Note = Boolean(meta && meta.Course3Note || deputyContent && deputyContent.trim() !== "");
  const [uiFontSize, setUiFontSize] = useState(15);
  const [isPrinting, setIsPrinting] = useState(false);
  const [uiLineHeight, setUiLineHeight] = useState(1.8);
  const [uiParaBefore, setUiParaBefore] = useState(1);
  const [uiParaAfter, setUiParaAfter] = useState(1);
  const [hideWatermark, setHideWatermark] = useState(false);
  const [uiPaddingTop, setUiPaddingTop] = useState(5);
  const STAGE_TOGGLE_KEYS = ["S", "S1", "S2", "S3", "S4", "S5", "S6"];
  const loadBool = (key, defaultValue) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === void 0) return defaultValue;
      if (raw === "1" || raw === "true") return true;
      if (raw === "0" || raw === "false") return false;
      return defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };
  const loadStageSet = (key, defaultStages) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Set(defaultStages);
      const parts = String(raw).split(",").map((s) => String(s || "").trim().toUpperCase()).filter(Boolean);
      const filtered = parts.filter((s) => STAGE_TOGGLE_KEYS.includes(s));
      return new Set(filtered.length ? filtered : defaultStages);
    } catch (e) {
      return new Set(defaultStages);
    }
  };
  const toggleStageInSet = (setState, stageKey) => {
    setState((prev) => {
      const next = new Set(prev || []);
      const k = String(stageKey || "").trim().toUpperCase();
      if (!k) return next;
      if (next.has(k)) next.delete(k);
      else
        next.add(k);
      return next;
    });
  };
  const [showLetterNo, setShowLetterNo] = useState(() => loadBool("replayfile2:showLetterNo", false));
  const [showCreatorName, setShowCreatorName] = useState(() => loadBool("replayfile2:showCreatorName", false));
  const [manualResizeEnabled, setManualResizeEnabled] = useState(() => loadBool("replayfile2:manualResize", false));
  const [showDoAtStages, setShowDoAtStages] = useState(() => loadStageSet("replayfile2:showDoAtStages", []));
  const [showSignatureStages, setShowSignatureStages] = useState(() => loadStageSet("replayfile2:showSignatureStages", []));
  const [showNameStages, setShowNameStages] = useState(() => loadStageSet("replayfile2:showNameStages", []));
  useEffect(() => {
    try {
      localStorage.setItem("replayfile2:showLetterNo", showLetterNo ? "1" : "0");
    } catch (e) {
    }
  }, [showLetterNo]);
  useEffect(() => {
    try {
      localStorage.setItem("replayfile2:showCreatorName", showCreatorName ? "1" : "0");
    } catch (e) {
    }
  }, [showCreatorName]);
  useEffect(() => {
    try {
      localStorage.setItem("replayfile2:showDoAtStages", Array.from(showDoAtStages || []).join(","));
    } catch (e) {
    }
  }, [showDoAtStages]);
  useEffect(() => {
    try {
      localStorage.setItem("replayfile2:showSignatureStages", Array.from(showSignatureStages || []).join(","));
    } catch (e) {
    }
  }, [showSignatureStages]);
  useEffect(() => {
    try {
      localStorage.setItem("replayfile2:showNameStages", Array.from(showNameStages || []).join(","));
    } catch (e) {
    }
  }, [showNameStages]);
  useEffect(() => {
    try {
      localStorage.setItem("replayfile2:manualResize", manualResizeEnabled ? "1" : "0");
    } catch (e) {
    }
  }, [manualResizeEnabled]);
  const anyToggleSelected = useMemo(() => {
    try {
      if (showDoAtStages && showDoAtStages.size > 0) return true;
      if (showSignatureStages && showSignatureStages.size > 0) return true;
      if (showNameStages && showNameStages.size > 0) return true;
    } catch (e) {
    }
    return false;
  }, [showLetterNo, showCreatorName, showDoAtStages, showSignatureStages, showNameStages]);
  const effectiveShowLetterNo = useMemo(() => !!showLetterNo, [showLetterNo]);
  const effectiveShowCreatorName = useMemo(() => !!showCreatorName, [showCreatorName]);
  const effectiveShowDoAt = useCallback((stageKey) => {
    try {
      return Boolean(showDoAtStages && showDoAtStages.has(stageKey));
    } catch (e) {
      return false;
    }
  }, [showDoAtStages]);
  const effectiveShowSignature = useCallback((stageKey) => {
    try {
      return Boolean(showSignatureStages && showSignatureStages.has(stageKey));
    } catch (e) {
      return false;
    }
  }, [showSignatureStages]);
  const effectiveShowName = useCallback((stageKey) => {
    try {
      return Boolean(showNameStages && showNameStages.has(stageKey));
    } catch (e) {
      return false;
    }
  }, [showNameStages]);
  useEffect(() => {
    try {
      const legacyKeys = ["replayfile:showDoAtStages", "replayfile:showSignatureStages", "replayfile:showNameStages", "replayfile:showLetterNo", "replayfile:showCreatorName"];
      legacyKeys.forEach((k) => {
        try {
          if (localStorage.getItem(k) !== null) localStorage.removeItem(k);
        } catch (e) {
        }
      });
      const targets = ["replayfile2:showDoAtStages", "replayfile2:showSignatureStages", "replayfile2:showNameStages"];
      targets.forEach((k) => {
        try {
          if (localStorage.getItem(k) === null) localStorage.setItem(k, "");
        } catch (e) {
        }
      });
      try {
        if (localStorage.getItem("replayfile2:showLetterNo") === null) localStorage.setItem("replayfile2:showLetterNo", "0");
      } catch (e) {
      }
      try {
        if (localStorage.getItem("replayfile2:showCreatorName") === null) localStorage.setItem("replayfile2:showCreatorName", "0");
      } catch (e) {
      }
    } catch (e) {
    }
  }, []);
  useEffect(() => {
    const onBeforePrint = () => {
      try {
        const existing = document.getElementById("replay-print-iframe");
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        const el = document.querySelector(".sheet");
        if (!el) return;
        const iframe = document.createElement("iframe");
        iframe.id = "replay-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.left = "50%";
        iframe.style.top = "50%";
        iframe.style.transform = "translate(-50%, -50%)";
        iframe.style.width = "210mm";
        iframe.style.height = "297mm";
        iframe.style.border = "0";
        iframe.style.zIndex = "2147483646";
        iframe.style.visibility = "hidden";
        iframe.setAttribute("aria-hidden", "true");
        document.body.appendChild(iframe);
        const idoc = iframe.contentDocument || iframe.contentWindow.document;
        idoc.open();
        try {
          Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach((n) => {
            try {
              idoc.head.appendChild(n.cloneNode(true));
            } catch (e) {
            }
          });
        } catch (e) {
        }
        const hideStyle = idoc.createElement("style");
        hideStyle.type = "text/css";
        hideStyle.appendChild(idoc.createTextNode(`
          @media print {
            body > *:not(#replay-print-iframe) { display: none !important; }
            #replay-print-iframe { visibility: visible !important; position: static !important; transform: none !important; width: 210mm !important; height: 297mm !important; }
          }
        `));
        idoc.head.appendChild(hideStyle);
        try {
          idoc.body.appendChild(el.cloneNode(true));
        } catch (e) {
        }
        idoc.close();
      } catch (e) {
        console.warn("onBeforePrint error", e);
      }
    };
    const onAfterPrint = () => {
      try {
        const iframe = document.getElementById("replay-print-iframe");
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch (e) {
      }
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      onAfterPrint();
    };
  }, [meta, uiFontSize, uiLineHeight, uiPaddingTop]);
  useEffect(() => {
    setLeftContent(firstCourse1Note(meta) || "");
    setS1Content(meta && meta.Course1Note || "");
    setCenterContent(meta && meta.centerNote || "");
    setRightContent(meta && meta.rightNote || "");
    setDeptContent(meta && meta.Course2Note || "");
    setContent3(meta && meta.Course3Note || "");
    setContent4(meta && meta.Course4Note || "");
    setContent5(meta && meta.Course5Note || "");
    setDeputyContent(meta && meta.Course3Note || "");
    setDeputyRightContent(meta && meta.Course4Note || "");
    setHeadOfficeContent(meta && meta.Course6Note || "");
    setDirectorContent(meta && meta.Course5Note || "");
    initialLoad.current = false;
    if (record && record.date) {
      try {
        const rawDateStr = record.date;
        const parsed = new Date(rawDateStr);
        let isDateOnly = false;
        try {
          if (typeof rawDateStr === "string") {
            if (/T00:00:00(?:\.000)?(?:Z|\+00:00)?$/.test(rawDateStr)) isDateOnly = true;
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateStr)) isDateOnly = true;
          }
        } catch (e) {
        }
        if (isDateOnly || parsed.getHours && parsed.getHours() === 0 && parsed.getMinutes && parsed.getMinutes() === 0) {
          const now = /* @__PURE__ */ new Date();
          parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        }
        setCapturedDate(parsed);
        if (meta && meta.Course3Date) {
          try {
            const rawM = meta.Course3Date;
            const m = new Date(rawM);
            let isMetaDateOnly = false;
            try {
              if (typeof rawM === "string") {
                if (/T00:00:00(?:\.000)?(?:Z|\+00:00)?$/.test(rawM)) isMetaDateOnly = true;
                if (/^\d{4}-\d{2}-\d{2}$/.test(rawM)) isMetaDateOnly = true;
              }
            } catch (e) {
            }
            if (isMetaDateOnly || m.getHours && m.getHours() === 0 && m.getMinutes && m.getMinutes() === 0) {
              const now2 = /* @__PURE__ */ new Date();
              m.setHours(now2.getHours(), now2.getMinutes(), now2.getSeconds());
            }
            setCapturedDate(m);
          } catch (e) {
          }
        }
      } catch (e) {
        setCapturedDate(/* @__PURE__ */ new Date());
      }
    } else {
      setCapturedDate(/* @__PURE__ */ new Date());
    }
  }, [record]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cb = record && record.createdBy;
        if (!cb || typeof cb === "object") return;
        if (signaturesMap && signaturesMap[cb]) return;
        try {
          const res = await api.get(`/signatures/${encodeURIComponent(cb)}`);
          const sig = res && res.data;
          if (mounted && sig) {
            setSignaturesMap((prev) => ({ ...prev || {}, [cb]: sig }));
          }
        } catch (e) {
        }
      } catch (e) {
      }
    })();
    return () => {
      mounted = false;
    };
  }, [record && record.createdBy, signaturesMap]);
  useEffect(() => {
    if (!record) {
      setRefUrls([]);
      setSelectedRef(null);
      return;
    }
    const items = [];
    const push = (name, a) => {
      try {
        if (!a && a !== 0) return;
        let url = attachmentUrl(a);
        if (!url) {
          const s = typeof a === "string" ? a : a && (a.name || a.filename || a.url || a.filePath || a.path);
          if (s && String(s).trim()) {
            url = `${API_BASE.replace(/\/+$/, "")}/Uploads/${encodeURIComponent(String(s).trim())}`;
          }
        }
        if (!url) return;
        items.push({ name: name || (typeof a === "string" ? a : a && (a.name || a.filename || a.url)) || url, url });
      } catch (e) {
      }
    };
    if (record.attachments && Array.isArray(record.attachments) && record.attachments.length) {
      record.attachments.forEach((a) => push(a.name || a.filename || a.url || a, a));
    }
    if (record.files && Array.isArray(record.files) && record.files.length) {
      record.files.forEach((a) => push(a.name || a.filename || a.url || a, a));
    }
    const singleFields = ["filePath", "file", "attachment", "url", "document", "letterFile", "filename", "ref_url", "reference", "letterFilePath", "letterFileUrl"];
    singleFields.forEach((k) => {
      if (record[k]) push(k, record[k]);
    });
    if (record.meta && typeof record.meta === "object") {
      const m = record.meta;
      if (m.attachments && Array.isArray(m.attachments)) m.attachments.forEach((a) => push(a.name || a.filename || a.url || a, a));
      if (m.files && Array.isArray(m.files)) m.files.forEach((a) => push(a.name || a.filename || a.url || a, a));
      if (m.file) push("meta.file", m.file);
      if (m.ref_url) push("meta.ref_url", m.ref_url);
    }
    const uploadRegex = /(uploads?\/.+\.(pdf|jpg|jpeg|png|gif|bmp))|(\.pdf$)|(\.(jpg|jpeg|png|gif|bmp)$)|(https?:\/\/)/i;
    const scan = (obj, depth = 0) => {
      if (!obj || depth > 6) return;
      if (typeof obj === "string") {
        const s = obj.trim();
        if (!s) return;
        if (uploadRegex.test(s) || s.toLowerCase().startsWith("http") || s.toLowerCase().endsWith(".pdf") || s.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/i.test(s))) {
          push(s, s);
        }
        return;
      }
      if (Array.isArray(obj)) return obj.forEach((o) => scan(o, depth + 1));
      if (typeof obj === "object") {
        Object.keys(obj).forEach((k) => {
          const v = obj[k];
          if (/file|attach|upload|url|path|src|document|pdf|image|filename/i.test(k)) {
            if (typeof v === "string") push(k, v);
            else if (typeof v === "object" && (v.url || v.filePath || v.path || v.name || v.filename)) {
              push(v.name || v.filename || v.url || v.filePath || v.path, v);
            } else scan(v, depth + 1);
          } else {
            scan(v, depth + 1);
          }
        });
      }
    };
    try {
      scan(record);
    } catch (e) {
    }
    const uniq = [];
    const seen = /* @__PURE__ */ new Set();
    for (const it of items) {
      if (!it || !it.url) continue;
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      uniq.push(it);
    }
    try {
      console.debug("Replay: found attachment URLs", uniq.map((u) => u.url));
    } catch (e) {
    }
    setRefUrls(uniq);
    setSelectedRef(uniq.length ? uniq[0].url : null);
  }, [record]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.__REPLAY_RECORD = record;
      console.debug("Replay record for debugging:", record);
    } catch (e) {
    }
  }, [record]);
  const getAttachmentHints = (r) => {
    if (!r) return [];
    const hints = [];
    const add = (path, val) => {
      try {
        let s = "";
        if (typeof val === "string") s = val;
        else if (typeof val === "object") s = JSON.stringify(val).slice(0, 200);
        else
          s = String(val);
        if (s && (s.includes("/Uploads/") || s.toLowerCase().includes(".pdf") || s.toLowerCase().startsWith("http") || /\.(jpg|jpeg|png|gif|bmp)$/i.test(s))) {
          hints.push({ path, excerpt: s });
        }
      } catch (e) {
      }
    };
    Object.keys(r || {}).forEach((k) => add(k, r[k]));
    if (r.meta && typeof r.meta === "object") Object.keys(r.meta).forEach((k) => add(`meta.${k}`, r.meta[k]));
    if (Array.isArray(r.attachments)) r.attachments.slice(0, 10).forEach((a, i) => add(`attachments[${i}]`, a));
    if (Array.isArray(r.files)) r.files.slice(0, 10).forEach((a, i) => add(`files[${i}]`, a));
    return hints;
  };
  useEffect(() => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.CourseNote || "";
    if ((leftContent || "") === (serverNote || "")) return void 0;
    setStageMessage("កំពុងរក្សាទុក...", "S");
    autosaveTimer.current = setTimeout(() => {
      saveNote();
    }, 1500);
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [leftContent]);
  useEffect(() => {
    if (autosaveTimer.current && typeof autosaveTimer.current === "number") {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.Course1Note || "";
    if ((s1Content || "") === (serverNote || "")) return void 0;
    setStageMessage("កំពុងរក្សាទុក...", "S1");
    autosaveTimer.current = setTimeout(() => {
      saveStageNote("Course1Note", s1Content || "");
    }, 1500);
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [s1Content]);
  useEffect(() => {
    if (autosaveTimerDept.current) {
      clearTimeout(autosaveTimerDept.current);
      autosaveTimerDept.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.Course2Note || "";
    if ((deptContent || "") === (serverNote || "")) return void 0;
    setStageMessage("កំពុងរក្សាទុក...", "S2");
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
  useEffect(() => {
    if (autosaveTimerDeputy.current) {
      clearTimeout(autosaveTimerDeputy.current);
      autosaveTimerDeputy.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.Course3Note || "";
    if ((deputyContent || "") === (serverNote || "")) return void 0;
    setStageMessage("កំពុងរក្សាទុក...", "S3");
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
  useEffect(() => {
    if (autosaveTimerDeputyRight.current) {
      clearTimeout(autosaveTimerDeputyRight.current);
      autosaveTimerDeputyRight.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.Course4Note || "";
    if ((deputyRightContent || "") === (serverNote || "")) return void 0;
    setStageMessage("កំពុងរក្សាទុក...", "S4");
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
  useEffect(() => {
    if (autosaveTimerDirector.current) {
      clearTimeout(autosaveTimerDirector.current);
      autosaveTimerDirector.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.Course5Note || "";
    if ((directorContent || "") === (serverNote || "")) return void 0;
    setStageMessage("កំពុងរក្សាទុក...", "S5");
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
  useEffect(() => {
    if (autosaveTimerHeadOffice.current) {
      clearTimeout(autosaveTimerHeadOffice.current);
      autosaveTimerHeadOffice.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.Course6Note || "";
    if ((headOfficeContent || "") === (serverNote || "")) return void 0;
    setStageMessage("កំពុងរក្សាទុក...", "S6");
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
  useEffect(() => {
    if (autosaveTimer3.current) {
      clearTimeout(autosaveTimer3.current);
      autosaveTimer3.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.Course3Note || "";
    if ((content3 || "") === (serverNote || "")) return void 0;
    autosaveTimer3.current = setTimeout(() => {
      saveStageNote("Course3Note", content3);
    }, 1500);
    return () => {
      if (autosaveTimer3.current) {
        clearTimeout(autosaveTimer3.current);
        autosaveTimer3.current = null;
      }
    };
  }, [content3]);
  useEffect(() => {
    if (autosaveTimer4.current) {
      clearTimeout(autosaveTimer4.current);
      autosaveTimer4.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.Course4Note || "";
    if ((content4 || "") === (serverNote || "")) return void 0;
    autosaveTimer4.current = setTimeout(() => {
      saveStageNote("Course4Note", content4);
    }, 1500);
    return () => {
      if (autosaveTimer4.current) {
        clearTimeout(autosaveTimer4.current);
        autosaveTimer4.current = null;
      }
    };
  }, [content4]);
  useEffect(() => {
    if (autosaveTimer5.current) {
      clearTimeout(autosaveTimer5.current);
      autosaveTimer5.current = null;
    }
    if (initialLoad.current) return void 0;
    if (!record) return void 0;
    const serverNote = meta && meta.Course5Note || "";
    if ((content5 || "") === (serverNote || "")) return void 0;
    autosaveTimer5.current = setTimeout(() => {
      saveStageNote("Course5Note", content5);
    }, 1500);
    return () => {
      if (autosaveTimer5.current) {
        clearTimeout(autosaveTimer5.current);
        autosaveTimer5.current = null;
      }
    };
  }, [content5]);
  useEffect(() => {
  }, []);
  useEffect(() => {
    if (manualResizeEnabled) return void 0;
    const el = courseNoteRef.current;
    if (!el) return void 0;
    el.style.height = "auto";
    const MIN_H = 24;
    const h = Math.max(el.scrollHeight, MIN_H);
    el.style.height = `${h}px`;
    return void 0;
  }, [leftContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter]);
  useEffect(() => {
    if (manualResizeEnabled) return void 0;
    const el = s1TextareaRef.current;
    if (!el) return void 0;
    el.style.height = "auto";
    const MIN_H = 24;
    const h = Math.max(el.scrollHeight, MIN_H);
    el.style.height = `${h}px`;
    return void 0;
  }, [s1Content, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter]);
  useEffect(() => {
    if (manualResizeEnabled) return void 0;
    const el = deptTextareaRef.current;
    if (!el) return void 0;
    el.style.height = "auto";
    const MIN_H_D = 24;
    const h = Math.max(el.scrollHeight, MIN_H_D);
    el.style.height = `${h}px`;
    return void 0;
  }, [deptContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter]);
  useEffect(() => {
    if (manualResizeEnabled) return void 0;
    const el = deputyTextareaRef.current;
    if (!el) return void 0;
    el.style.height = "auto";
    const MIN_H_D = 24;
    const h = Math.max(el.scrollHeight, MIN_H_D);
    el.style.height = `${h}px`;
    return void 0;
  }, [deputyContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter]);
  useEffect(() => {
    if (manualResizeEnabled) return void 0;
    const el = deputyRightTextareaRef.current;
    if (!el) return void 0;
    el.style.height = "auto";
    const MIN_H_D = 24;
    const h = Math.max(el.scrollHeight, MIN_H_D);
    el.style.height = `${h}px`;
    return void 0;
  }, [deputyRightContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter]);
  useEffect(() => {
    if (manualResizeEnabled) return void 0;
    const el = directorTextareaRef.current;
    if (!el) return void 0;
    el.style.height = "auto";
    const MIN_H_D = 24;
    const h = Math.max(el.scrollHeight, MIN_H_D);
    el.style.height = `${h}px`;
    return void 0;
  }, [directorContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter]);
  useEffect(() => {
    if (manualResizeEnabled) return void 0;
    const el = headOfficeTextareaRef.current;
    if (!el) return void 0;
    el.style.height = "auto";
    const MIN_H_D = 24;
    const h = Math.max(el.scrollHeight, MIN_H_D);
    el.style.height = `${h}px`;
    return void 0;
  }, [headOfficeContent, record, uiFontSize, uiLineHeight, uiParaBefore, uiParaAfter]);
  const printPage = () => window.print();
  const getPrintCss = (scale = 1) => {
    const scaledFontSize = Math.max(8, Math.round(uiFontSize * scale));
    const scaledPaddingTop = Math.max(0, (uiPaddingTop * scale).toFixed(2));
    return `@page { 
          size: A4; 
          margin: 0mm 8mm 3mm 8mm; 
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
            left: 8mm !important; 
            top: 0mm !important; 
            /* Fit to printable width (account for left+right margins) */
            width: calc(210mm - 16mm) !important;
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
  const printSheet = () => {
    if (isPrinting) {
      console.log("Print already in progress");
      return;
    }
    setIsPrinting(true);
    try {
      const el = document.querySelector(".sheet");
      if (!el) {
        console.warn("Sheet element not found, using default print");
        setIsPrinting(false);
        return printPage();
      }
      const computeScale = (targetEl) => {
        try {
          if (!targetEl) return 1;
          const tmp = document.createElement("div");
          tmp.style.position = "absolute";
          tmp.style.left = "-9999px";
          tmp.style.height = "297mm";
          document.body.appendChild(tmp);
          const pagePx = tmp.getBoundingClientRect().height || 297 * 3.78;
          document.body.removeChild(tmp);
          const marginTopMm = 0;
          const marginBottomMm = 3;
          const headerAllowMm = 10;
          const printablePx = pagePx - (marginTopMm + marginBottomMm) * (pagePx / 297) - headerAllowMm * (pagePx / 297);
          const elH = targetEl.getBoundingClientRect().height || targetEl.offsetHeight || 1;
          const scale2 = printablePx / elH;
          return Math.min(1, Math.max(0.4, scale2));
        } catch (e) {
          return 1;
        }
      };
      const scale = computeScale(el);
      const css = getPrintCss(scale);
      const hiddenNodes = [];
      try {
        const nodes = el.querySelectorAll("*");
        nodes.forEach((n) => {
          try {
            const tag = (n.tagName || "").toUpperCase();
            if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "LABEL"].includes(tag)) return;
            const txt = (n.innerText || "").trim();
            if (!txt) return;
            const cs = window.getComputedStyle(n);
            const fs = parseFloat(cs.fontSize || "0");
            const total = txt.length || 0;
            const letters = (txt.replace(/[^\p{L}\p{N}]/gu, "") || "").length;
            const punct = total - letters;
            const punctRatio = total ? punct / total : 0;
            if (fs && fs <= 11 && total > 0 && total < 20 && punctRatio < 0.4) {
              hiddenNodes.push(n);
              n.dataset._printHidden = "1";
              n.style.visibility = "hidden";
            }
          } catch (e) {
          }
        });
      } catch (e) {
      }
      let styleEl = document.getElementById("print-sheet-style");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "print-sheet-style";
        styleEl.type = "text/css";
        styleEl.appendChild(document.createTextNode(css));
        document.head.appendChild(styleEl);
      } else {
        styleEl.textContent = css;
      }
      const cleanup = () => {
        try {
          if (hiddenNodes && hiddenNodes.length > 0) {
            hiddenNodes.forEach((n) => {
              try {
                if (n && n.dataset && n.dataset._printHidden) {
                  n.style.visibility = "";
                  delete n.dataset._printHidden;
                }
              } catch (e) {
                console.warn("Error restoring node visibility:", e);
              }
            });
          }
          if (styleEl && styleEl.parentNode) {
            styleEl.parentNode.removeChild(styleEl);
          }
        } catch (e) {
          console.warn("Error during print cleanup:", e);
        }
        window.removeEventListener("afterprint", cleanup);
        if (fallbackTimeout) {
          clearTimeout(fallbackTimeout);
        }
        setIsPrinting(false);
      };
      window.addEventListener("afterprint", cleanup);
      const fallbackTimeout = setTimeout(() => {
        console.warn("Print cleanup timeout reached");
        cleanup();
      }, 5e3);
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (printError) {
          console.error("Error executing window.print():", printError);
          cleanup();
          printPage();
        }
      }, 100);
    } catch (e) {
      console.error("Error in printSheet function:", e);
      setIsPrinting(false);
      printPage();
    }
  };
  useEffect(() => {
    const onBefore = () => {
      try {
        let s = document.getElementById("print-sheet-style");
        const el = document.querySelector(".sheet");
        const computeScale = (targetEl) => {
          try {
            if (!targetEl) return 1;
            const tmp = document.createElement("div");
            tmp.style.position = "absolute";
            tmp.style.left = "-9999px";
            tmp.style.height = "297mm";
            document.body.appendChild(tmp);
            const pagePx = tmp.getBoundingClientRect().height || 297 * 3.78;
            document.body.removeChild(tmp);
            const marginMm = 8;
            const headerAllowMm = 10;
            const printablePx = pagePx - marginMm * 2 * (pagePx / 297) - headerAllowMm * (pagePx / 297);
            const elH = targetEl.getBoundingClientRect().height || targetEl.offsetHeight || 1;
            const scale2 = printablePx / elH;
            return Math.min(1, Math.max(0.4, scale2));
          } catch (e) {
            return 1;
          }
        };
        const scale = computeScale(el);
        if (!s) {
          s = document.createElement("style");
          s.id = "print-sheet-style";
          s.type = "text/css";
          s.appendChild(document.createTextNode(getPrintCss(scale)));
          document.head.appendChild(s);
        } else {
          s.textContent = getPrintCss(scale);
        }
      } catch (e) {
        console.warn("beforeprint handler failed to inject print css", e);
      }
    };
    const onAfter = () => {
      try {
        const s = document.getElementById("print-sheet-style");
        if (s && s.parentNode) s.parentNode.removeChild(s);
      } catch (e) {
        console.warn("afterprint cleanup failed", e);
      }
      try {
        const iframe = document.getElementById("print-iframe");
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch (e) {
      }
      try {
        const hs = document.getElementById("print-hide-everything");
        if (hs && hs.parentNode) hs.parentNode.removeChild(hs);
      } catch (e) {
      }
    };
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint", onAfter);
    const mq = window.matchMedia && window.matchMedia("print");
    const mqHandler = (m) => {
      if (m.matches) onBefore();
      else onAfter();
    };
    if (mq && mq.addListener) mq.addListener(mqHandler);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint", onAfter);
      if (mq && mq.removeListener) mq.removeListener(mqHandler);
    };
  }, [uiPaddingTop, uiFontSize, uiLineHeight]);
  const printRef = () => {
    if (!selectedRef) return;
    try {
      if (refIframe && refIframe.current && refIframe.current.contentWindow) {
        try {
          refIframe.current.contentWindow.focus();
          refIframe.current.contentWindow.print();
          return;
        } catch (e) {
        }
      }
    } catch (e) {
    }
    (async () => {
      try {
        const res = await fetch(selectedRef, { credentials: "same-origin" });
        if (!res || !res.ok) throw new Error("Fetch failed");
        const ct = res.headers.get("content-type") || "";
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.left = "0";
        iframe.style.top = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.visibility = "hidden";
        iframe.src = url;
        document.body.appendChild(iframe);
        const cleanup = () => {
          try {
            if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
          } catch (e) {
          }
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
          }
          window.removeEventListener("message", msgHandler);
        };
        const msgHandler = () => {
        };
        iframe.onload = () => {
          try {
            const iw = iframe.contentWindow;
            if (iw) {
              iw.focus();
              try {
                iw.print();
              } catch (e) {
              }
            }
          } catch (e) {
          }
          setTimeout(cleanup, 1500);
        };
      } catch (e) {
        const w = window.open(selectedRef, "_blank");
        if (w) w.focus();
      }
    })();
  };
  const resolveStageId = (val) => {
    if (!val) return null;
    if (typeof val === "string") return val;
    if (typeof val === "object") return val._id || val.id || val.signature || null;
    return null;
  };
  const normalizedStages = useMemo(() => {
    try {
      const s = stages || meta && meta.feedbackStages || {};
      if (!s) return {};
      if (Array.isArray(s)) {
        const map = {};
        s.forEach((item) => {
          if (!item) return;
          const key = (item._key || item.key || item.stageKey || item.stage || item.name || "").toString().toUpperCase();
          if (key) map[key] = item;
          else if (item._id) map[item._id] = item;
        });
        return map;
      }
      if (typeof s === "object") return s;
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
    return `${API_BASE.replace(/\/$/, "")}${fp.startsWith("/") ? "" : "/"}${fp}`;
  };
  const getStageSenderName = (keys) => {
    try {
      const ks = Array.isArray(keys) ? keys : [keys];
      try {
        if (meta && meta.feedbackSenderName) {
          const hasS = ks.some((k) => String(k).toUpperCase() === "S");
          if (hasS) return String(meta.feedbackSenderName).replace(/\s*\([^)]+\)\s*$/, "").trim();
        }
      } catch (e) {
      }
      for (const k of ks) {
        if (!k) continue;
        const raw = normalizedStages && normalizedStages[k];
        if (raw) {
          if (typeof raw === "object") {
            const n = raw.senderName || raw.sender || raw.name;
            if (n) return String(n).replace(/\s*\([^)]+\)\s*$/, "").trim();
          }
          const id = resolveStageId(raw);
          if (id && signaturesMap && signaturesMap[id]) {
            const s = signaturesMap[id];
            const n = s && (s.fullNameKh || s.fullName || s.name);
            if (n) return String(n).replace(/\s*\([^)]+\)\s*$/, "").trim();
          }
        }
        if (k === "S") {
          if (meta && meta.reporterName) return String(meta.reporterName).replace(/\s*\([^)]+\)\s*$/, "").trim();
        }
        if (k === "S1") {
          if (s1Content && String(s1Content).trim() !== "") return String(s1Content).replace(/\s*\([^)]+\)\s*$/, "").trim();
          if (stages && stages.s1) return String(stages.s1).replace(/\s*\([^)]+\)\s*$/, "").trim();
        }
        if (k === "S2") {
          if (meta && meta.departmentHead) return String(meta.departmentHead).replace(/\s*\([^)]+\)\s*$/, "").trim();
        }
        if (k === "SD" || k === "S3") {
          if (meta && meta.deputyName) return String(meta.deputyName).replace(/\s*\([^)]+\)\s*$/, "").trim();
        }
        if (k === "SDR" || k === "S4") {
          if (meta && meta.deputyRightName) return String(meta.deputyRightName).replace(/\s*\([^)]+\)\s*$/, "").trim();
        }
        if (k === "S5" || k === "DIR" || k === "SDIR") {
          if (meta && meta.directorName) return String(meta.directorName).replace(/\s*\([^)]+\)\s*$/, "").trim();
        }
        if (k === "S6" || k === "HO") {
          if (meta && meta.headOfficeName) return String(meta.headOfficeName).replace(/\s*\([^)]+\)\s*$/, "").trim();
        }
      }
    } catch (e) {
    }
    return "";
  };
  const attachmentUrl = (a) => {
    if (!a) return null;
    try {
      const s = typeof a === "string" ? a : a.name || a.url || "";
      if (!s) return null;
      if (s.startsWith("http")) return s;
      if (s.startsWith("/")) return `${API_BASE.replace(/\/$/, "")}${s}`;
      const idx = s.indexOf("/Uploads/");
      if (idx >= 0) return `${API_BASE.replace(/\/$/, "")}${s.slice(idx)}`;
      return `${API_BASE.replace(/\/$/, "")}/Uploads/${encodeURIComponent(s)}`;
    } catch (e) {
      return null;
    }
  };
  const saveNote = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta("CourseNote");
    setSaving(true);
    setStageMessage("កំពុងរក្សាទុក...", stageKey);
    try {
      const id = record._id || record.id;
      const now = /* @__PURE__ */ new Date();
      const newMeta = { ...meta || {}, CourseNote: leftContent, CourseDate: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = res && (res.item || res) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord((r) => ({ ...r || {}, meta: newMeta }));
      }
      setStageMessage("រក្សាទុកបានសម្រេច", stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error("Failed to save note", err);
      setStageMessage("រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត", stageKey);
    } finally {
      setSaving(false);
    }
  };
  const saveDeptNote = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta("Course2Note");
    setSaving(true);
    setStageMessage("កំពុងរក្សាទុក...", stageKey);
    try {
      const id = record._id || record.id;
      const now = /* @__PURE__ */ new Date();
      const newMeta = { ...meta || {}, Course2Note: deptContent, Course2Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = res && (res.item || res) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord((r) => ({ ...r || {}, meta: newMeta }));
      }
      setStageMessage("រក្សាទុកបានសម្រេច", stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error("Failed to save dept note", err);
      setStageMessage("រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត", stageKey);
    } finally {
      setSaving(false);
    }
  };
  const saveCourse3Note = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta("Course3Note");
    setSaving(true);
    setStageMessage("កំពុងរក្សាទុក...", stageKey);
    try {
      const id = record._id || record.id;
      const now = /* @__PURE__ */ new Date();
      const newMeta = { ...meta || {}, Course3Note: deputyContent, Course3Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = res && (res.item || res) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord((r) => ({ ...r || {}, meta: newMeta }));
      }
      setStageMessage("រក្សាទុកបានសម្រេច", stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error("Failed to save deputy note", err);
      setStageMessage("រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត", stageKey);
    } finally {
      setSaving(false);
    }
  };
  const saveCourse4Note = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta("Course4Note");
    setSaving(true);
    setStageMessage("កំពុងរក្សាទុក...", stageKey);
    try {
      const id = record._id || record.id;
      const now = /* @__PURE__ */ new Date();
      const newMeta = { ...meta || {}, Course4Note: deputyRightContent, Course4Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = res && (res.item || res) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord((r) => ({ ...r || {}, meta: newMeta }));
      }
      setStageMessage("រក្សាទុកបានសម្រេច", stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error("Failed to save deputy right note", err);
      setStageMessage("រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត", stageKey);
    } finally {
      setSaving(false);
    }
  };
  const saveCourse6Note = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta("Course6Note");
    setSaving(true);
    setStageMessage("កំពុងរក្សាទុក...", stageKey);
    try {
      const id = record._id || record.id;
      const now = /* @__PURE__ */ new Date();
      const newMeta = { ...meta || {}, Course6Note: headOfficeContent, Course6Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = res && (res.item || res) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord((r) => ({ ...r || {}, meta: newMeta }));
      }
      setStageMessage("រក្សាទុកបានសម្រេច", stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error("Failed to save head office note", err);
      setStageMessage("រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត", stageKey);
    } finally {
      setSaving(false);
    }
  };
  const saveCourse5Note = async () => {
    if (!record) return;
    const stageKey = stageKeyByMeta("Course5Note");
    setSaving(true);
    setStageMessage("កំពុងរក្សាទុក...", stageKey);
    try {
      const id = record._id || record.id;
      const now = /* @__PURE__ */ new Date();
      const newMeta = { ...meta || {}, Course5Note: directorContent, Course5Date: now.toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = res && (res.item || res) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord((r) => ({ ...r || {}, meta: newMeta }));
      }
      setStageMessage("រក្សាទុកបានសម្រេច", stageKey);
      setCapturedDate(now);
    } catch (err) {
      console.error("Failed to save director note", err);
      setStageMessage("រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត", stageKey);
    } finally {
      setSaving(false);
    }
  };
  const saveStageNote = async (metaKey, content) => {
    if (!record) return;
    const stageKey = stageKeyByMeta(metaKey);
    setSaving(true);
    setStageMessage("កំពុងរក្សាទុក...", stageKey);
    try {
      const id = record._id || record.id;
      const dateKey = metaKey.replace("Note", "Date");
      const newMeta = { ...meta || {}, [metaKey]: content, [dateKey]: (/* @__PURE__ */ new Date()).toISOString() };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = res && (res.item || res) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord((r) => ({ ...r || {}, meta: newMeta }));
      }
      setStageMessage("រក្សាទុកបានសម្រេច", stageKey);
      setCapturedDate(/* @__PURE__ */ new Date());
    } catch (err) {
      console.error("Failed to save stage note", err);
      setStageMessage("រក្សាទុកមិនបាន — សូមព្យាយាមម្ដងទៀត", stageKey);
    } finally {
      setSaving(false);
    }
  };
  const sendToTelegram = async () => {
    if (!record) return;
    setSaving(true);
    setStageMessage("", null);
    try {
      const id = record._id || record.id;
      const res = await api.post(`/file-transfers/${id}/send-telegram`, { stageKey: "s" });
      if (res && res.data && res.data.success) {
        setStageMessage("បានផ្ញើមតិ", null);
      } else {
        setStageMessage("ផ្ញើមិនបាន — ​​សូមព្យាយាម​ម្ដងទៀត", null);
      }
    } catch (err) {
      console.error("sendToTelegram failed", err);
      setStageMessage("ផ្ញើមិនបាន — សូមព្យាយាមម្ដងទៀត", null);
    } finally {
      setSaving(false);
    }
  };
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmStageKey, setConfirmStageKey] = useState(null);
  const [confirmAdvance, setConfirmAdvance] = useState(true);
  const sendStageToTelegram = (stageKey) => {
    if (!record) return;
    setConfirmStageKey(stageKey);
    setConfirmAdvance(true);
    setConfirmVisible(true);
  };
  const doSendStage = async (stageKey, advance) => {
    if (!record) return;
    setConfirmVisible(false);
    const normalizedStageKey = String(stageKey || "").toLowerCase();
    setSendingStage(normalizedStageKey);
    setStageMessage("", normalizedStageKey);
    try {
      const id = record._id || record.id;
      const payload = { stageKey: normalizedStageKey };
      if (advance) payload.advance = true;
      const res = await api.post(`/file-transfers/${id}/send-telegram`, payload);
      if (res && res.data && res.data.success) {
        setStageMessage("បានផ្ញើមតិ", normalizedStageKey);
        const refreshed = await getFileTransfer(id);
        if (refreshed) setRecord(refreshed.item || refreshed);
      } else {
        setStageMessage("ផ្ញើមិនបាន — សូមព្យាយាមម្ដងទៀត", normalizedStageKey);
      }
    } catch (err) {
      console.error("sendStageToTelegram failed", err);
      setStageMessage("ផ្ញើមិនបាន — សូមព្យាយាមម្ដងទៀត", normalizedStageKey);
    } finally {
      setSendingStage(null);
    }
  };
  const recreateStageNote = async (metaKey) => {
    if (!record) return;
    const stageKey = stageKeyByMeta(metaKey);
    setSaving(true);
    setStageMessage("", stageKey);
    try {
      const id = record._id || record.id;
      const dateKey = metaKey.replace("Note", "Date");
      const newMeta = { ...meta || {}, [metaKey]: "", [dateKey]: null };
      const res = await updateFileTransfer(id, { meta: newMeta });
      const updated = res && (res.item || res) || null;
      if (updated) {
        setRecord(updated.item || updated);
      } else {
        setRecord((r) => ({ ...r || {}, meta: newMeta }));
      }
      setStageMessage("បានកំណត់ឡើងវិញ", stageKey);
      if (metaKey === "Course1Note") setS1Content("");
      if (metaKey === "CourseNote") setLeftContent("");
    } catch (err) {
      console.error("Failed to recreate stage note", err);
      setStageMessage("មិនបានកំណត់ឡើងវិញ — សូមព្យាយាមម្ដងទៀត", stageKey);
    } finally {
      setSaving(false);
    }
  };
  const KHMER_DIGITS = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
  const KHMER_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const toKhmerDigits = (num) => {
    if (num === null || num === void 0) return "";
    const s = String(num);
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      if (ch >= "0" && ch <= "9") out += KHMER_DIGITS[parseInt(ch, 10)];
      else
        out += ch;
    }
    return out;
  };
  const formatKhmerDate = (d) => {
    if (!d) return "........";
    try {
      const day = toKhmerDigits(d.getDate());
      const month = KHMER_MONTHS[d.getMonth()] || "";
      const year = toKhmerDigits(d.getFullYear());
      return `ថ្ងៃទី ${day}  ខែ ${month}  ឆ្នាំ ${year}`;
    } catch (e) {
      return "........";
    }
  };
  const pad2 = (n) => n === null || n === void 0 ? "" : n < 10 ? `0${n}` : String(n);
  const formatKhmerDateTime = (d) => {
    if (!d) return "........";
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
    if (!entryTime || typeof entryTime !== "string") return clone;
    const parts = entryTime.split(":").map((p) => parseInt(p, 10));
    if (!parts.length) return clone;
    const [hh, mm = 0, ss = 0] = parts;
    if (!Number.isNaN(hh)) clone.setHours(hh, Number.isNaN(mm) ? 0 : mm, Number.isNaN(ss) ? 0 : ss);
    return clone;
  };
  const parsePreferLocalTime = (raw, entryTime) => {
    if (!raw) return null;
    const d = raw instanceof Date ? new Date(raw.getTime()) : new Date(raw);
    try {
      let isDateOnly = false;
      if (typeof raw === "string") {
        if (/T00:00:00(?:\.000)?(?:Z|\+00:00)?$/.test(raw)) isDateOnly = true;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) isDateOnly = true;
      }
      if (!entryTime && (isDateOnly || d.getHours && d.getHours() === 0 && d.getMinutes && d.getMinutes() === 0 && /(?:Z|\+00:00)$/.test(String(raw)))) {
        const now = /* @__PURE__ */ new Date();
        d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      }
    } catch (e) {
    }
    return d;
  };
  const creatorName = () => {
    try {
      if (!record) return "";
      const cb = record.createdBy;
      if (cb && typeof cb === "object") {
        return cb.fullName || cb.fullNameKh || cb.name || cb.username || "";
      }
      if (cb && (typeof cb === "string" || typeof cb === "number")) {
        try {
          const sig = signaturesMap && signaturesMap[cb];
          if (sig) return sig.fullNameKh || sig.fullName || sig.name || String(cb);
        } catch (e) {
        }
      }
      if (record.createdByName) return record.createdByName;
      if (record.reporter) return record.reporter;
      if (meta && meta.reporterName) return meta.reporterName;
      if (record.createdBy) return record.createdBy;
      return "";
    } catch (e) {
      return "";
    }
  };
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
  const sigS = sigFor && sigFor("S");
  const sig1 = sigFor && sigFor("S1");
  const sig2 = sigFor && sigFor("S2");
  const sig3 = sigFor && sigFor("S3");
  const sig1Url = signatureUrl(sig1);
  const sigSUrl = signatureUrl(sigS);
  const sig2Url = signatureUrl(sig2);
  const sig3Url = signatureUrl(sig3);
  const sigDeputy = sigFor && (sigFor("SD") || sigFor("S3"));
  const sigDeputyUrl = signatureUrl(sigDeputy);
  const sigDeputyRight = sigFor && (sigFor("SDR") || sigFor("S4") || sigFor("S3"));
  const sigDeputyRightUrl = signatureUrl(sigDeputyRight);
  const sigDirector = sigFor && (sigFor("DIR") || sigFor("SDIR") || sigFor("S5"));
  const sigDirectorUrl = signatureUrl(sigDirector);
  const sigHeadOffice = sigFor && (sigFor("HO") || sigFor("S6") || sigFor("S4") || sigFor("S3"));
  const sigHeadOfficeUrl = signatureUrl(sigHeadOffice);
  const hasCourseNote = Boolean(meta && meta.CourseNote || leftContent && leftContent.trim() !== "");
  const hasCourse1Note = Boolean(meta && meta.Course1Note || s1Content && s1Content.trim() !== "");
  const hasDeptNote = Boolean(meta && meta.Course2Note || deptContent && deptContent.trim() !== "");
  const hasDeputy = Boolean(meta && meta.Course3Note || deputyContent && deputyContent.trim() !== "");
  const hasDeputyRight = Boolean(meta && meta.Course4Note || deputyRightContent && deputyRightContent.trim() !== "");
  const hasHeadOffice = Boolean(meta && meta.Course6Note || headOfficeContent && headOfficeContent.trim() !== "");
  const hasDirector = Boolean(meta && meta.Course5Note || directorContent && directorContent.trim() !== "");
  useEffect(() => {
    try {
      if (!capturedDate && (hasCourseNote || hasDeptNote || hasDeputy || hasDeputyRight || hasHeadOffice || hasDirector)) {
        setCapturedDate(/* @__PURE__ */ new Date());
      }
    } catch (e) {
    }
  }, [capturedDate, hasCourseNote, hasDeptNote, hasDeputy, hasDeputyRight, hasHeadOffice, hasDirector]);
  useEffect(() => {
    let mounted = true;
    const getSheet = () => sheetRef && sheetRef.current || null;
    const getPreview = () => refPreviewWrapper && refPreviewWrapper.current || null;
    const syncPreviewSize = () => {
      try {
        const p = getPreview();
        if (!p) return;
        p.style.width = "210mm";
        p.style.height = "auto";
        p.style.overflow = "visible";
      } catch (e) {
      }
    };
    syncPreviewSize();
    let ro = null;
    try {
      if (typeof window !== "undefined" && window.ResizeObserver) {
        ro = new window.ResizeObserver(() => {
          if (mounted) syncPreviewSize();
        });
        const s = getSheet();
        if (s) ro.observe(s);
      }
    } catch (e) {
      ro = null;
    }
    const onResize = () => {
      if (mounted) syncPreviewSize();
    };
    window.addEventListener("resize", onResize);
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
      }
    }, 250);
    return () => {
      mounted = false;
      window.removeEventListener("resize", onResize);
      try {
        if (ro) ro.disconnect();
      } catch (e) {
      }
      try {
        clearInterval(poll);
      } catch (e) {
      }
    };
  }, [sheetRef, refPreviewWrapper, uiFontSize, uiLineHeight, uiPaddingTop, selectedRef]);
  useEffect(() => {
    let mounted = true;
    let loadingTask = null;
    const container = refPreviewWrapper && refPreviewWrapper.current || null;
    if (!container) return void 0;
    container.innerHTML = "";
    if (!selectedRef) return void 0;
    const isPdf = String(selectedRef).toLowerCase().endsWith(".pdf");
    if (!isPdf) return void 0;
    (async () => {
      try {
        const pdfjs = await import("/node_modules/.vite/deps/pdfjs-dist_legacy_build_pdf.js?v=ced18999");
        const pdfjsLib = pdfjs && (pdfjs.default || pdfjs);
        try {
          if (typeof window !== "undefined" && window.location && window.location.origin) {
            const localWorker = `${window.location.origin}/pdf.worker.min.js`;
            try {
              const head = await fetch(localWorker, { method: "HEAD" });
              if (head && head.ok) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = localWorker;
              } else {
                pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc || "https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js";
              }
            } catch (e) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc || "https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js";
            }
          } else {
            pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc || "https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js";
          }
        } catch (e) {
        }
        let pdf = null;
        try {
          const res = await fetch(selectedRef, { mode: "cors" });
          if (res && res.ok) {
            const blob = await res.blob();
            const arrayBuf = await blob.arrayBuffer();
            loadingTask = pdfjsLib.getDocument({ data: arrayBuf });
            pdf = await loadingTask.promise;
          } else {
            const iframe = document.createElement("iframe");
            iframe.src = selectedRef;
            iframe.style.width = "210mm";
            iframe.style.height = "297mm";
            iframe.style.border = "0";
            iframe.style.display = "block";
            iframe.style.margin = "0 auto 10mm";
            container.appendChild(iframe);
            return;
          }
        } catch (fetchErr) {
          try {
            const iframe = document.createElement("iframe");
            iframe.src = selectedRef;
            iframe.style.width = "210mm";
            iframe.style.height = "297mm";
            iframe.style.border = "0";
            iframe.style.display = "block";
            iframe.style.margin = "0 auto 10mm";
            container.appendChild(iframe);
            return;
          } catch (e) {
            throw fetchErr;
          }
        }
        for (let p = 1; p <= pdf.numPages; p++) {
          if (!mounted) break;
          const page = await pdf.getPage(p);
          const canvas = document.createElement("canvas");
          canvas.style.width = "210mm";
          canvas.style.height = "297mm";
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 10mm";
          canvas.style.boxSizing = "border-box";
          canvas.style.pageBreakAfter = "always";
          container.appendChild(canvas);
          const DPR = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
          const cssWidth = canvas.clientWidth || 210 / 25.4 * 96;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = cssWidth / baseViewport.width;
          const renderViewport = page.getViewport({ scale });
          canvas.width = Math.max(1, Math.floor(renderViewport.width * DPR));
          canvas.height = Math.max(1, Math.floor(renderViewport.height * DPR));
          const ctx = canvas.getContext("2d");
          if (ctx && ctx.setTransform) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
        }
      } catch (err) {
        console.warn("Failed to render PDF preview", err);
        if (container && mounted) {
          const msg = err && err.message ? String(err.message) : String(err || "Unknown error");
          const details = `Failed to render PDF preview
URL: ${selectedRef}
Error: ${msg}`;
          container.innerHTML = `<div style="color:#a00;padding:8px;white-space:pre-wrap">${details}</div>`;
        }
      }
    })();
    return () => {
      mounted = false;
      try {
        if (loadingTask && loadingTask.destroy) loadingTask.destroy();
      } catch (e) {
      }
    };
  }, [selectedRef]);
  const stageHasSenderForKeys = (keys) => {
    if (!normalizedStages) return false;
    for (const k of keys || []) {
      const raw = normalizedStages[k];
      if (!raw) continue;
      if (typeof raw === "object") {
        if (raw.senderName || raw.sender || raw.name) return true;
      }
      const id = resolveStageId(raw);
      if (id && signaturesMap && signaturesMap[id]) {
        const s = signaturesMap[id];
        if (s && (s.fullNameKh || s.fullName || s.name)) return true;
      }
    }
    return false;
  };
  const stageToMetaKey = {
    S: "CourseNote",
    S1: "Course1Note",
    S2: "Course2Note",
    SD: "Course3Note",
    S3: "Course3Note",
    SDR: "Course4Note",
    S4: "Course4Note",
    S5: "Course5Note",
    DIR: "Course5Note",
    SDIR: "Course5Note",
    S6: "Course6Note",
    HO: "Course6Note"
  };
  const visibleStages = useMemo(() => {
    try {
      const buckets = [
        { key: "S", variants: ["S"], metaKey: "CourseNote", local: leftContent },
        { key: "S1", variants: ["S1"], metaKey: "Course1Note", local: s1Content },
        { key: "S2", variants: ["S2"], metaKey: "Course2Note", local: deptContent },
        { key: "S3", variants: ["SD", "S3"], metaKey: "Course3Note", local: deputyContent },
        { key: "S4", variants: ["SDR", "S4"], metaKey: "Course4Note", local: deputyRightContent },
        { key: "S5", variants: ["S5", "DIR", "SDIR"], metaKey: "Course5Note", local: directorContent },
        { key: "S6", variants: ["S6", "HO"], metaKey: "Course6Note", local: headOfficeContent }
      ];
      const variantSelected = (variants) => {
        try {
          for (const k of variants || []) {
            const raw = normalizedStages && normalizedStages[k];
            if (raw !== void 0 && raw !== null && raw !== "") return true;
          }
        } catch (e) {
        }
        return false;
      };
      const localHasNote = (metaKey, localVal) => {
        try {
          if (localVal && String(localVal).trim() !== "") return true;
          const v = meta && meta[metaKey];
          if (v && String(v).trim() !== "") return true;
        } catch (e) {
        }
        return false;
      };
      const present = buckets.map((b) => ({ bucket: b, present: variantSelected(b.variants) || localHasNote(b.metaKey, b.local) })).filter((x) => x.present).map((x) => x.bucket);
      if (!present || present.length === 0) return /* @__PURE__ */ new Set();
      const withDates = present.map((b) => {
        const dateKey = String(b.metaKey).replace(/Note$/i, "Date");
        let ts = null;
        try {
          const raw = meta && meta[dateKey];
          if (raw) {
            const d = new Date(raw);
            if (!isNaN(d.getTime())) ts = d.getTime();
          }
        } catch (e) {
          ts = null;
        }
        return { key: b.key, ts, bucket: b };
      });
      const orderKeys = buckets.map((b) => b.key);
      const hasAnySavedNote = present.some((b) => {
        try {
          const v = meta && meta[b.metaKey];
          return v && String(v).trim() !== "";
        } catch (e) {
          return false;
        }
      });
      if (hasAnySavedNote) {
        withDates.sort((a, z) => {
          if (a.ts !== null && z.ts !== null) return a.ts - z.ts;
          if (a.ts !== null && z.ts === null) return -1;
          if (a.ts === null && z.ts !== null) return 1;
          return orderKeys.indexOf(a.key) - orderKeys.indexOf(z.key);
        });
      } else {
        withDates.sort((a, z) => orderKeys.indexOf(a.key) - orderKeys.indexOf(z.key));
      }
      const orderedBuckets = withDates.map((x) => x.bucket);
      if (!orderedBuckets || orderedBuckets.length === 0) return /* @__PURE__ */ new Set();
      return new Set(orderedBuckets.map((b) => b.key));
    } catch (e) {
      return /* @__PURE__ */ new Set();
    }
  }, [normalizedStages, leftContent, s1Content, deptContent, deputyContent, deputyRightContent, directorContent, headOfficeContent, signaturesMap, meta]);
  const stagesWithFeedback = useMemo(() => {
    try {
      const hasText = (v) => v !== null && v !== void 0 && String(v).trim() !== "";
      const sent = /* @__PURE__ */ new Set();
      if (hasText(leftContent) || hasText(meta && meta.CourseNote)) sent.add("S");
      if (hasText(s1Content) || hasText(meta && meta.Course1Note)) sent.add("S1");
      if (hasText(deptContent) || hasText(meta && meta.Course2Note)) sent.add("S2");
      if (hasText(deputyContent) || hasText(meta && meta.Course3Note)) sent.add("S3");
      if (hasText(deputyRightContent) || hasText(meta && meta.Course4Note)) sent.add("S4");
      if (hasText(directorContent) || hasText(meta && meta.Course5Note)) sent.add("S5");
      if (hasText(headOfficeContent) || hasText(meta && meta.Course6Note)) sent.add("S6");
      return sent;
    } catch (e) {
      return /* @__PURE__ */ new Set();
    }
  }, [meta, leftContent, s1Content, deptContent, deputyContent, deputyRightContent, directorContent, headOfficeContent]);
  const stageKeysForSettings = useMemo(() => {
    return STAGE_TOGGLE_KEYS;
  }, []);
  const waitingStageSender = useMemo(() => {
    try {
      if (!normalizedStages) return null;
      const order = ["S", "S1", "S2", "SD", "SDR", "S3", "S4", "S5", "S6"];
      for (const k of order) {
        const raw = normalizedStages[k];
        if (!raw) continue;
        const metaKey = stageToMetaKey[k];
        const metaVal = meta && meta[metaKey] || "";
        let local = "";
        if (metaKey === "CourseNote") local = leftContent || "";
        else if (metaKey === "Course1Note") local = s1Content || "";
        else if (metaKey === "Course2Note") local = deptContent || "";
        else if (metaKey === "Course3Note") local = deputyContent || "";
        else if (metaKey === "Course4Note") local = deputyRightContent || "";
        else if (metaKey === "Course6Note") local = headOfficeContent || "";
        else if (metaKey === "Course6Note") local = directorContent || "";
        if (String(metaVal || "").trim() === "" && String(local || "").trim() === "") {
          if (typeof raw === "object") {
            const n = raw.senderName || raw.sender || raw.name;
            if (n) return `${n} (${k})`;
          }
          const id = resolveStageId(raw);
          if (id && signaturesMap && signaturesMap[id]) {
            const s = signaturesMap[id];
            const n = s && (s.fullNameKh || s.fullName || s.name);
            if (n) return `${n} (${k})`;
          }
          return `Stage ${k}`;
        }
      }
    } catch (e) {
    }
    return null;
  }, [normalizedStages, meta, leftContent, deptContent, deputyContent, deputyRightContent, directorContent, headOfficeContent, signaturesMap]);
  const waitingStageSenderClean = useMemo(() => {
    try {
      if (!waitingStageSender) return null;
      return String(waitingStageSender).replace(/\s*\([^)]+\)\s*$/, "").trim();
    } catch (e) {
      return waitingStageSender;
    }
  }, [waitingStageSender]);
  const isAssignedToStage = (keys) => {
    try {
      if (perms && perms.canEditDocuments) return true;
    } catch (e) {
    }
    try {
      if (!normalizedStages || !currentUser) return false;
      const normalize = (v) => (v || "").toString().normalize ? v.toString().normalize("NFKD").replace(/\p{Diacritic}/gu, "") : (v || "").toString();
      const norm = (v) => normalize(v).toLowerCase().trim();
      const userNames = [currentUser.name, currentUser.fullName, currentUser.fullNameKh].filter(Boolean).map((s) => norm(s));
      for (const k of keys || []) {
        const raw = normalizedStages[k];
        if (!raw) continue;
        if (typeof raw === "object") {
          const candidate = (raw.senderName || raw.sender || raw.name || "").toString();
          if (userNames.includes(norm(candidate))) return true;
        } else {
          const id = resolveStageId(raw);
          if (id && signaturesMap && signaturesMap[id]) {
            const s = signaturesMap[id];
            const cand = (s.fullNameKh || s.fullName || s.name || "").toString();
            if (userNames.includes(norm(cand))) return true;
          }
          if (userNames.includes(norm(raw))) return true;
        }
      }
    } catch (e) {
    }
    return false;
  };
  const stageSelected = (keys) => {
    if (!normalizedStages) return false;
    for (const k of keys || []) {
      const raw = normalizedStages[k];
      if (raw !== void 0 && raw !== null && raw !== "") return true;
    }
    return false;
  };
  const hasNote = (metaKey, content) => {
    try {
      if (content && String(content).trim() !== "") return true;
      const v = meta && meta[metaKey];
      if (v && String(v).trim() !== "") return true;
    } catch (e) {
    }
    return false;
  };
  const alwaysShowPlaceholders = true;
  const showDeputyLeft = hasNote("Course3Note", deputyContent) || stageSelected(["SD", "S3"]);
  const showDeputyRight = hasNote("Course4Note", deputyRightContent) || stageSelected(["SDR", "S4"]);
  const showHeadOffice = hasNote("Course6Note", headOfficeContent) || stageSelected(["S6"]);
  const showDirector = hasNote("Course5Note", directorContent) || stageSelected(["DIR", "SDIR", "S5"]);
  const showDept = hasNote("Course2Note", deptContent) || stageSelected(["S2"]);
  const showRecipient = hasNote("CourseNote", leftContent) || stageSelected(["S"]);
  const deputyBlock = useMemo(() => {
    const leftVisible = Boolean(visibleStages && visibleStages.has("S3")) && showDeputyLeft;
    const rightVisible = Boolean(visibleStages && visibleStages.has("S4")) && showDeputyRight && !(visibleStages && visibleStages.has("S5"));
    if (!leftVisible && !rightVisible) return null;
    const deputyMessage = stageMessageFor("S3");
    const deputyRightMessage = stageMessageFor("S4");
    const leftJSX = /* @__PURE__ */ jsxDEV("div", { style: { border: "1px dashed #161616ff", padding: 1, marginTop: 5 }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { padding: 1 }, children: [
        /* @__PURE__ */ jsxDEV("div", { className: "role-label", style: { textAlign: "center", marginTop: 2, fontFamily: "Khmer OS Muol Light" }, children: meta && meta.feedbackStageRoles && meta.feedbackStageRoles.s3 || getRoleLabel("s3") }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2276,
          columnNumber: 23
        }, this),
        /* @__PURE__ */ jsxDEV(
          "textarea",
          {
            rows: 4,
            ref: deputyTextareaRef,
            value: deputyContent,
            onChange: (e) => {
              setDeputyContent(e.target.value);
              clearStageMessage("S3");
            },
            placeholder: "....................",
            style: { width: manualResizeEnabled ? "calc(100% - 18px)" : "100%", height: "auto", minHeight: "72px", lineHeight: uiLineHeight, textAlign: "justify", margin: 0, marginRight: manualResizeEnabled ? "18px" : 0, marginBottom: manualResizeEnabled ? "12px" : 0, padding: "8px 22px 12px 8px", resize: manualResizeEnabled ? "both" : "none", overflow: manualResizeEnabled ? "auto" : "hidden", backgroundImage: manualResizeEnabled ? "linear-gradient(135deg, rgba(0,0,0,0.22) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.16) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.1) 25%, transparent 25%)" : "none", backgroundSize: manualResizeEnabled ? "14px 14px, 10px 10px, 6px 6px" : "0 0", backgroundRepeat: manualResizeEnabled ? "no-repeat" : "no-repeat", backgroundPosition: manualResizeEnabled ? "right 6px bottom 6px, right 4px bottom 4px, right 2px bottom 2px" : "0 0", fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", boxSizing: "border-box", whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word", textIndent: "30px" },
            disabled: !isAssignedToStage(["SD", "S3"])
          },
          void 0,
          false,
          {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2279,
            columnNumber: 23
          },
          this
        ),
        /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 0 }, children: [
          hasDeputy ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
            effectiveShowDoAt("S3") ? /* @__PURE__ */ jsxDEV("div", { children: [
              "ធ្វើនៅ ",
              formatKhmerDateTime(dateForMetaKey("Course3Date") || capturedDate)
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2290,
              columnNumber: 13
            }, this) : null,
            effectiveShowSignature("S3") && sigDeputyUrl ? /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 0 }, children: /* @__PURE__ */ jsxDEV("img", { src: sigDeputyUrl, alt: "sig-deputy", style: { maxWidth: 100, maxHeight: 80, objectFit: "contain", display: "block", margin: "0 auto" } }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2294,
              columnNumber: 21
            }, this) }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2293,
              columnNumber: 13
            }, this) : null
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2288,
            columnNumber: 11
          }, this) : null,
          effectiveShowName("S3") || stageHasSenderForKeys(["SD", "S3"]) ? /* @__PURE__ */ jsxDEV("div", { className: "sender-name", style: { fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }, children: getStageSenderName(["SD", "S3"]) || "" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2300,
            columnNumber: 11
          }, this) : null
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2286,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2275,
        columnNumber: 9
      }, this),
      showLargePreview && selectedRef ? /* @__PURE__ */ jsxDEV("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1e4, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }, onClick: () => setShowLargePreview(false), children: /* @__PURE__ */ jsxDEV("div", { role: "dialog", "aria-modal": "true", style: { background: "#fff", padding: 12, borderRadius: 6, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxWidth: "95vw", maxHeight: "95vh", overflow: "auto" }, onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }, children: /* @__PURE__ */ jsxDEV("button", { onClick: () => setShowLargePreview(false), style: { padding: "6px 10px" }, children: "Close" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2310,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2309,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { width: "210mm", maxWidth: "90vw", height: "297mm", maxHeight: "90vh", boxSizing: "border-box", border: "1px solid #e5e7eb", boxShadow: "0 6px 18px rgba(0,0,0,0.12)", background: "#574a4aff" }, children: String(selectedRef).toLowerCase().endsWith(".pdf") ? /* @__PURE__ */ jsxDEV("iframe", { src: selectedRef, title: "Large reference preview", style: { width: "100%", height: "100%", border: 0 } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2314,
          columnNumber: 13
        }, this) : /* @__PURE__ */ jsxDEV("img", { src: selectedRef, alt: "large-ref", style: { width: "100%", height: "100%", objectFit: "contain" } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2316,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2312,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2308,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2307,
        columnNumber: 7
      }, this) : null,
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: hasDeputy ? "space-between" : "flex-start", alignItems: "center", marginTop: 6, padding: "0px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { color: deputyMessage ? "#0b6623" : "#666", minHeight: 0 }, children: deputyMessage }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2323,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2322,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2274,
      columnNumber: 5
    }, this);
    const rightJSX = /* @__PURE__ */ jsxDEV("div", { style: { border: "1px dashed #161616ff", padding: 1, marginTop: 5 }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: 12 }, children: /* @__PURE__ */ jsxDEV("div", { style: { padding: 1 }, children: [
        /* @__PURE__ */ jsxDEV("div", { className: "role-label", style: { textAlign: "center", marginTop: 2, fontFamily: "Khmer OS Muol Light" }, children: meta && meta.feedbackStageRoles && meta.feedbackStageRoles.s4 || getRoleLabel("s4") }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2333,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          "textarea",
          {
            rows: 4,
            ref: deputyRightTextareaRef,
            value: deputyRightContent,
            onChange: (e) => {
              setDeputyRightContent(e.target.value);
              clearStageMessage("S4");
            },
            placeholder: "....................",
            style: {
              width: manualResizeEnabled ? "calc(100% - 18px)" : "100%",
              height: "auto",
              minHeight: "72px",
              lineHeight: uiLineHeight,
              textAlign: "justify",
              margin: 0,
              marginRight: manualResizeEnabled ? "18px" : 0,
              marginBottom: manualResizeEnabled ? "12px" : 0,
              padding: "8px 22px 12px 8px",
              resize: manualResizeEnabled ? "both" : "none",
              overflow: manualResizeEnabled ? "auto" : "hidden",
              backgroundImage: manualResizeEnabled ? "linear-gradient(135deg, rgba(0,0,0,0.22) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.16) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.1) 25%, transparent 25%)" : "none",
              backgroundSize: manualResizeEnabled ? "14px 14px, 10px 10px, 6px 6px" : "0 0",
              backgroundRepeat: manualResizeEnabled ? "no-repeat" : "no-repeat",
              backgroundPosition: manualResizeEnabled ? "right 6px bottom 6px, right 4px bottom 4px, right 2px bottom 2px" : "0 0",
              fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
              boxSizing: "border-box",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              textIndent: "30px"
            },
            disabled: !isAssignedToStage(["SDR", "S4"])
          },
          void 0,
          false,
          {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2335,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 0 }, children: [
          hasDeputyRight ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
            effectiveShowDoAt("S4") ? /* @__PURE__ */ jsxDEV("div", { children: [
              "ធ្វើនៅ ",
              formatKhmerDateTime(dateForMetaKey("Course4Date") || capturedDate)
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2368,
              columnNumber: 15
            }, this) : null,
            effectiveShowSignature("S4") && sigDeputyRightUrl ? /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 0 }, children: /* @__PURE__ */ jsxDEV("img", { src: sigDeputyRightUrl, alt: "sig-deputy-right", style: { maxWidth: 120, maxHeight: 80, objectFit: "contain", display: "block", margin: "0 auto" } }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2372,
              columnNumber: 23
            }, this) }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2371,
              columnNumber: 15
            }, this) : null
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2366,
            columnNumber: 13
          }, this) : null,
          effectiveShowName("S4") || stageHasSenderForKeys(["SDR", "S4", "S3"]) ? /* @__PURE__ */ jsxDEV("div", { className: "sender-name", style: { fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }, children: getStageSenderName(["SDR", "S4", "S3"]) || "" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2378,
            columnNumber: 13
          }, this) : null
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2364,
          columnNumber: 17
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2332,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2331,
        columnNumber: 9
      }, this),
      showLargePreview && selectedRef ? /* @__PURE__ */ jsxDEV("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1e4, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }, onClick: () => setShowLargePreview(false), children: /* @__PURE__ */ jsxDEV("div", { role: "dialog", "aria-modal": "true", style: { background: "#fff", padding: 12, borderRadius: 6, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxWidth: "95vw", maxHeight: "95vh", overflow: "auto" }, onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }, children: /* @__PURE__ */ jsxDEV("button", { onClick: () => setShowLargePreview(false), style: { padding: "6px 10px" }, children: "Close" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2387,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2386,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { width: "210mm", maxWidth: "90vw", height: "297mm", maxHeight: "90vh", boxSizing: "border-box", border: "1px solid #e5e7eb", boxShadow: "0 6px 18px rgba(0,0,0,0.12)", background: "#fff" }, children: String(selectedRef).toLowerCase().endsWith(".pdf") ? /* @__PURE__ */ jsxDEV("iframe", { src: selectedRef, title: "Large reference preview", style: { width: "100%", height: "100%", border: 0 } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2391,
          columnNumber: 13
        }, this) : /* @__PURE__ */ jsxDEV("img", { src: selectedRef, alt: "large-ref", style: { width: "100%", height: "100%", objectFit: "contain" } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2393,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2389,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2385,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2384,
        columnNumber: 7
      }, this) : null,
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: hasDeputyRight ? "space-between" : "flex-start", alignItems: "center", marginTop: 6, padding: "0px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { color: deputyRightMessage ? "#0b6623" : "#666", minHeight: 0 }, children: deputyRightMessage }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2400,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2399,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2330,
      columnNumber: 5
    }, this);
    if (leftVisible && rightVisible) {
      return /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 5 }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { border: "0px dashed #161616ff", padding: 0 }, children: leftJSX }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2413,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { height: 5 } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2416,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { border: "0px dashed #161616ff", padding: 0 }, children: rightJSX }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2417,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2412,
        columnNumber: 9
      }, this);
    }
    if (leftVisible) return leftJSX;
    if (rightVisible) return rightJSX;
    return null;
  }, [showDeputyLeft, showDeputyRight, deputyContent, deputyRightContent, sigDeputy, sigDeputyUrl, sigDeputyRight, sigDeputyRightUrl, saveMessage, saveMessageStage, meta, capturedDate, visibleStages, showDoAtStages, showSignatureStages, showNameStages]);
  useEffect(() => {
    const stageKeys = ["S", "S1", "S2", "S3", "S4", "S5", "S6", "SD", "SDR", "DIR", "SDIR", "HO"];
    let mounted = true;
    const fetchIfMissing = async (id) => {
      try {
        const res = await api.get(`/signatures/${id}`);
        const sig = res && res.data ? res.data : res && res.data && res.data.signature ? res.data.signature : res.data || res;
        if (!mounted || !sig) return;
        setSignaturesMap((prev) => ({ ...prev || {}, [id]: sig }));
      } catch (err) {
        console.warn("Failed to fetch signature by id", id, err);
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
    return () => {
      mounted = false;
    };
  }, [normalizedStages, signaturesMap]);
  useEffect(() => {
    const added = [];
    try {
      if (document && document.body && document.body.classList) document.body.classList.add("replay-hide-sidebar");
      const sidebarSelectors = [".ant-layout-sider", ".sidebar", '[role="navigation"]', "aside", ".sider", ".site-layout-sider", ".ant-pro-sider", '[data-testid="sider"]', ".app-sider"];
      const headerSelectors = [".ant-layout-header", "header", ".topbar", ".app-header", ".navbar", ".site-header"];
      const hideElems = (sels) => {
        for (const s of sels) {
          try {
            const nodes = Array.from(document.querySelectorAll(s));
            for (const n of nodes) {
              try {
                n.dataset.__replayOrigDisplay = n.style && n.style.display ? n.style.display : "";
              } catch (e) {
              }
              try {
                n.style.setProperty("display", "none", "important");
              } catch (e) {
                n.style.display = "none";
              }
              added.push(n);
            }
          } catch (e) {
          }
        }
      };
      hideElems(sidebarSelectors);
      hideElems(headerSelectors);
      try {
        const contentCandidates = Array.from(document.querySelectorAll(".ant-layout-content, .main-content, .content, .site-layout-content, .app-root"));
        for (const c of contentCandidates) {
          try {
            c.dataset.__replayOrigPaddingLeft = c.style && c.style.paddingLeft ? c.style.paddingLeft : "";
          } catch (e) {
          }
          try {
            c.style.setProperty("padding-left", "0px", "important");
          } catch (e) {
            c.style.paddingLeft = "0px";
          }
          try {
            c.dataset.__replayOrigMarginLeft = c.style && c.style.marginLeft ? c.style.marginLeft : "";
          } catch (e) {
          }
          try {
            c.style.setProperty("margin-left", "0px", "important");
          } catch (e) {
            c.style.marginLeft = "0px";
          }
          added.push(c);
        }
      } catch (e) {
      }
    } catch (e) {
    }
    return () => {
      try {
        for (const n of added) {
          try {
            if (n && n.dataset) {
              if (n.dataset.__replayOrigDisplay !== void 0) {
                try {
                  n.style.display = n.dataset.__replayOrigDisplay || "";
                } catch (e) {
                  n.style.removeProperty("display");
                }
                delete n.dataset.__replayOrigDisplay;
              }
              if (n.dataset.__replayOrigPaddingLeft !== void 0) {
                try {
                  n.style.paddingLeft = n.dataset.__replayOrigPaddingLeft || "";
                } catch (e) {
                  n.style.removeProperty("padding-left");
                }
                delete n.dataset.__replayOrigPaddingLeft;
              }
              if (n.dataset.__replayOrigMarginLeft !== void 0) {
                try {
                  n.style.marginLeft = n.dataset.__replayOrigMarginLeft || "";
                } catch (e) {
                  n.style.removeProperty("margin-left");
                }
                delete n.dataset.__replayOrigMarginLeft;
              }
            }
          } catch (e) {
          }
        }
      } catch (e) {
      }
      try {
        document && document.body && document.body.classList && document.body.classList.remove("replay-hide-sidebar");
      } catch (e) {
      }
    };
  }, []);
  useEffect(() => {
    try {
      if (!record && typeof window !== "undefined") {
        const q = new URLSearchParams(window.location.search);
        if (q.get("demo")) {
          const sample = {
            letterNo: "DEMO-001",
            source: "Demo source",
            content: "This is a demo record used when no backend data is available. Replace with real data when connected to the server.",
            meta: {},
            attachments: []
          };
          setRecord(sample);
        }
      }
    } catch (e) {
    }
  }, []);
  const printSheetDirect = async () => {
    try {
      setIsPrinting(true);
      await new Promise((res) => setTimeout(res, 30));
      try {
        window.focus();
      } catch (e) {
      }
      try {
        window.print();
      } catch (e) {
        console.error("printSheetDirect: window.print failed", e);
      }
    } finally {
      try {
        setIsPrinting(false);
      } catch (e) {
      }
    }
  };
  return /* @__PURE__ */ jsxDEV("div", { children: [
    /* @__PURE__ */ jsxDEV("style", { children: `
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
      ` }, void 0, false, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2569,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("style", { children: `.sheet .page .role-label { font-size: 12px !important; } .sheet .page .sender-name { font-size: 12px !important; } .sheet .page .role-s2 { font-size: 12px !important; }
    .replay-hide-sidebar .ant-layout-sider, .replay-hide-sidebar .sidebar, .replay-hide-sidebar [role="navigation"], .replay-hide-sidebar .app-sider, .replay-hide-sidebar .site-layout-sider, .replay-hide-sidebar .ant-pro-sider { display: none !important; width: 0 !important; height: 0 !important; overflow: hidden !important; }
    .replay-hide-sidebar .ant-layout-header, .replay-hide-sidebar .topbar, .replay-hide-sidebar .app-header, .replay-hide-sidebar .navbar, .replay-hide-sidebar .header, .replay-hide-sidebar .site-header { display: none !important; height: 0 !important; }
    .replay-hide-sidebar .ant-layout-content, .replay-hide-sidebar .main-content, .replay-hide-sidebar .content, .replay-hide-sidebar .site-layout-content { margin-left: 0 !important; padding-left: 0 !important; }
    .replay-hide-sidebar .ant-layout, .replay-hide-sidebar .app-root { padding-left: 0 !important; }
    .replay-hide-sidebar .sheet { margin-left: auto !important; margin-right: auto !important; }
    ` }, void 0, false, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2583,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "space-between", margin: "0px 0" }, children: [
      /* @__PURE__ */ jsxDEV("div", { children: /* @__PURE__ */ jsxDEV("button", { onClick: () => navigate(-1), style: { padding: "6px 10px", border: "1px solid #646669ff", borderRadius: 7 }, children: "Back" }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2592,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2591,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { children: [
        record ? /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => navigate(`/send-feedback?recordId=${encodeURIComponent(record && (record._id || record.id) || "")}&stage=s`),
            style: { padding: "6px 10px", background: "#0088cc", color: "#fff", borderRadius: 4, marginRight: 200, cursor: "pointer" },
            children: "ផ្ញើមតិ"
          },
          void 0,
          false,
          {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2596,
            columnNumber: 11
          },
          this
        ) : null,
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: printSheetDirect,
            disabled: isPrinting,
            style: {
              padding: "6px 10px",
              background: isPrinting ? "#9ca3af" : "#4f46e5",
              color: "#fff",
              borderRadius: 4,
              marginRight: 100,
              cursor: isPrinting ? "not-allowed" : "pointer",
              opacity: isPrinting ? 0.6 : 1
            },
            children: isPrinting ? "Printing..." : "Print"
          },
          void 0,
          false,
          {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2603,
            columnNumber: 11
          },
          this
        ),
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 13, color: "#333", marginRight: 8 }, children: "Font" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2618,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("input", { "aria-label": "Font size", type: "number", min: 8, max: 30, value: uiFontSize, onChange: (e) => setUiFontSize(Number(e.target.value) || 12), style: { width: 56, marginRight: 8 } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2619,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 13, color: "#333", marginRight: 8 }, children: "Line" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2620,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("input", { "aria-label": "Line height", type: "number", step: "0.1", min: 1, max: 3, value: uiLineHeight, onChange: (e) => setUiLineHeight(Number(e.target.value) || 1), style: { width: 56, marginRight: 8 } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2621,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 13, color: "#333", marginRight: 4 }, children: "Before" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2622,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("input", { "aria-label": "Paragraph before", type: "number", min: 0, max: 40, value: uiParaBefore, onChange: (e) => setUiParaBefore(Number(e.target.value) || 0), style: { width: 48, marginRight: 8 } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2623,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 13, color: "#333", marginRight: 4 }, children: "After" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2624,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("input", { "aria-label": "Paragraph after", type: "number", min: 0, max: 40, value: uiParaAfter, onChange: (e) => setUiParaAfter(Number(e.target.value) || 0), style: { width: 48 } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2625,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 13, color: "#333", margin: "0 8px" }, children: "Top" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2626,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("input", { "aria-label": "Page top (mm)", type: "number", min: 0, max: 40, value: uiPaddingTop, onChange: (e) => setUiPaddingTop(Number(e.target.value) || 0), style: { width: 56, marginRight: 8 } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2627,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2594,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2590,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "center", margin: "0 0 10px" }, children: /* @__PURE__ */ jsxDEV("details", { style: { width: "min(210mm, 100%)", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 10 }, children: [
      /* @__PURE__ */ jsxDEV("summary", { style: { cursor: "pointer", fontFamily: "Khmer OS Muol Light", fontSize: 14, color: "#111" }, children: "កំណត់ការបង្ហាញ" }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2633,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 10 }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-start" }, children: [
          /* @__PURE__ */ jsxDEV("label", { style: { fontSize: 13, color: "#333" }, children: [
            /* @__PURE__ */ jsxDEV("input", { type: "checkbox", checked: showLetterNo, onChange: (e) => setShowLetterNo(e.target.checked), style: { marginRight: 6 } }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2640,
              columnNumber: 17
            }, this),
            "បង្ហាញ លិខិតលេខ"
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2639,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("label", { style: { fontSize: 13, color: "#333" }, children: [
            /* @__PURE__ */ jsxDEV("input", { type: "checkbox", checked: showCreatorName, onChange: (e) => setShowCreatorName(e.target.checked), style: { marginRight: 6 } }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2644,
              columnNumber: 17
            }, this),
            "បង្ហាញ បញ្ចូលលិខិតដោយ"
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2643,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("label", { style: { fontSize: 13, color: "#333" }, children: [
            /* @__PURE__ */ jsxDEV("input", { type: "checkbox", checked: manualResizeEnabled, onChange: (e) => setManualResizeEnabled(e.target.checked), style: { marginRight: 6 } }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2648,
              columnNumber: 17
            }, this),
            "អនុញ្ញាត កាត់ទំហំដោយដៃ"
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2647,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { marginLeft: 8 }, children: /* @__PURE__ */ jsxDEV("button", { type: "button", onClick: () => {
            try {
              localStorage.removeItem("replayfile2:showLetterNo");
              localStorage.removeItem("replayfile2:showCreatorName");
              localStorage.removeItem("replayfile2:showDoAtStages");
              localStorage.removeItem("replayfile2:showSignatureStages");
              localStorage.removeItem("replayfile2:showNameStages");
            } catch (e) {
            }
            setShowLetterNo(false);
            setShowCreatorName(false);
            setShowDoAtStages(/* @__PURE__ */ new Set());
            setShowSignatureStages(/* @__PURE__ */ new Set());
            setShowNameStages(/* @__PURE__ */ new Set());
          }, style: { padding: "6px 10px", fontSize: 12 }, children: "Reset display settings" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2652,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2651,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2638,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 10, borderTop: "1px solid #eef2f6", paddingTop: 10 }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "56px 1fr 1fr 1fr 56px", gap: 8, alignItems: "center" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#333", fontFamily: "Khmer OS Muol Light" }, children: "Stage" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2671,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#333", fontFamily: "Khmer OS Muol Light" }, children: "ធ្វើនៅ" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2672,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#333", fontFamily: "Khmer OS Muol Light" }, children: "ហត្ថលេខា" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2673,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#333", fontFamily: "Khmer OS Muol Light" }, children: "ឈ្មោះ" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2674,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#333", fontFamily: "Khmer OS Muol Light", textAlign: "center" }, children: "All" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2675,
            columnNumber: 17
          }, this),
          stageKeysForSettings && stageKeysForSettings.length ? stageKeysForSettings.map(
            (k) => /* @__PURE__ */ jsxDEV(React.Fragment, { children: [
              /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#111", fontFamily: "Khmer OS Muol Light" }, children: k }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 2680,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: 13, color: "#333" }, children: /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "checkbox",
                  checked: Boolean(showDoAtStages && showDoAtStages.has(k)),
                  onChange: () => toggleStageInSet(setShowDoAtStages, k)
                },
                void 0,
                false,
                {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 2682,
                  columnNumber: 25
                },
                this
              ) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 2681,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: 13, color: "#333" }, children: /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "checkbox",
                  checked: Boolean(showSignatureStages && showSignatureStages.has(k)),
                  onChange: () => toggleStageInSet(setShowSignatureStages, k)
                },
                void 0,
                false,
                {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 2689,
                  columnNumber: 25
                },
                this
              ) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 2688,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: 13, color: "#333" }, children: /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "checkbox",
                  checked: Boolean(showNameStages && showNameStages.has(k)),
                  onChange: () => toggleStageInSet(setShowNameStages, k)
                },
                void 0,
                false,
                {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 2696,
                  columnNumber: 25
                },
                this
              ) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 2695,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: 13, color: "#333", textAlign: "center" }, children: /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "checkbox",
                  checked: Boolean(showDoAtStages && showDoAtStages.has(k) && showSignatureStages && showSignatureStages.has(k) && showNameStages && showNameStages.has(k)),
                  onChange: () => {
                    const allOn = Boolean(showDoAtStages && showDoAtStages.has(k) && showSignatureStages && showSignatureStages.has(k) && showNameStages && showNameStages.has(k));
                    if (allOn) {
                      setShowDoAtStages((prev) => {
                        const n = new Set(prev || []);
                        n.delete(k);
                        return n;
                      });
                      setShowSignatureStages((prev) => {
                        const n = new Set(prev || []);
                        n.delete(k);
                        return n;
                      });
                      setShowNameStages((prev) => {
                        const n = new Set(prev || []);
                        n.delete(k);
                        return n;
                      });
                    } else {
                      setShowDoAtStages((prev) => {
                        const n = new Set(prev || []);
                        n.add(k);
                        return n;
                      });
                      setShowSignatureStages((prev) => {
                        const n = new Set(prev || []);
                        n.add(k);
                        return n;
                      });
                      setShowNameStages((prev) => {
                        const n = new Set(prev || []);
                        n.add(k);
                        return n;
                      });
                    }
                  }
                },
                void 0,
                false,
                {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 2703,
                  columnNumber: 25
                },
                this
              ) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 2702,
                columnNumber: 23
              }, this)
            ] }, `stage-row-${k}`, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2679,
              columnNumber: 17
            }, this)
          ) : /* @__PURE__ */ jsxDEV("div", { style: { gridColumn: "1 / -1", fontSize: 13, color: "#666" }, children: "មិនទាន់មានវគ្គផ្ញើមតិ" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2725,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2670,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2669,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2637,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2632,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2631,
      columnNumber: 7
    }, this),
    loading && /* @__PURE__ */ jsxDEV("div", { style: { padding: 20 }, children: "កំពុងដឹកនាំ..." }, void 0, false, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2733,
      columnNumber: 19
    }, this),
    !loading && !record && /* @__PURE__ */ jsxDEV("div", { style: { padding: 10 }, children: [
      /* @__PURE__ */ jsxDEV("div", { children: "រកមិនឃើញកំណត់ត្រា" }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2736,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 8, display: "flex", gap: 8, alignItems: "center" }, children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => {
              try {
                const sample = {
                  letterNo: "DEMO-001",
                  source: "Demo source",
                  content: "This is a demo record used when no backend data is available. Replace with real data when connected to the server.",
                  meta: {},
                  attachments: []
                };
                setRecord(sample);
              } catch (e) {
              }
            },
            style: { padding: "6px 10px", borderRadius: 6, border: "1px solid #646669ff" },
            children: "Load demo record"
          },
          void 0,
          false,
          {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2738,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV("div", { style: { color: "#666", fontSize: 13 }, children: [
          "or append ",
          /* @__PURE__ */ jsxDEV("code", { children: "?demo=1" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2755,
            columnNumber: 68
          }, this),
          " to the URL to auto-load"
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2755,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2737,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2735,
      columnNumber: 7
    }, this),
    record && /* @__PURE__ */ jsxDEV("div", { style: { position: "relative", display: "flex", gap: 12, alignItems: "flex-start", width: "100%", justifyContent: "center", paddingTop: 16, paddingLeft: 24, paddingRight: 24, background: "#efefef", flexWrap: "wrap", overflowX: "auto" }, children: /* @__PURE__ */ jsxDEV("div", { className: "sheet", ref: sheetRef, style: { width: "210mm", minWidth: "210mm", height: "297mm", flexShrink: 0, margin: "24px 12px 24px 24px", background: "#fff", boxShadow: "0 10px 24px rgba(0,0,0,0.14)", borderRadius: 6, boxSizing: "border-box", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }, children: [
      /* @__PURE__ */ jsxDEV("div", { className: "page", style: { padding: "10mm", fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", color: "#000", height: "100%", overflow: "auto", boxSizing: "border-box" }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", fontWeight: 300, marginBottom: 6, fontFamily: "Khmer OS Muol Light", fontSize: 18 }, children: "ព្រះរាជាណាចក្រកម្ពុជា" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2764,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", fontWeight: 300, marginBottom: 5, fontFamily: "Khmer OS Muol Light", fontSize: 1 }, children: "ជាតិ សាសនា ព្រះមហាក្សត្រ" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2768,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { position: "relative", textAlign: "center", margin: "10px 0" }, children: true ? /* @__PURE__ */ jsxDEV(
          "img",
          {
            src: logo3,
            alt: "",
            "aria-hidden": "true",
            style: {
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 100,
              height: "auto",
              opacity: 98,
              pointerEvents: "none",
              zIndex: 1
            }
          },
          void 0,
          false,
          {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2774,
            columnNumber: 15
          },
          this
        ) : null }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2772,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "left", padding: "0mm 0", fontFamily: "Khmer OS Muol Light", fontSize: 16 }, children: "ក្រសួងសុខាភិបាល" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2793,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "left", padding: "1mm 0", fontFamily: "Khmer OS Muol Light", fontSize: 15 }, children: "មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2797,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", fontFamily: "Khmer OS Muol Light", fontSize: 15, marginTop: 0 }, children: "កំណត់បង្ហាញ" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2801,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "field", style: { marginTop: 5, display: "flex", alignItems: "flex-start", gap: 0 }, children: [
          /* @__PURE__ */ jsxDEV("span", { className: "label", style: { width: 140, minWidth: 140, fontFamily: "Khmer OS Muol Light", fontSize: 15 }, children: "លេខលិខិតចូល:" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2807,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "value", style: { flex: 1 }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { lineHeight: 1 }, children: [
              record?.entryNo ? toKhmerDigits(record.entryNo) : "",
              " ម.ម.ខ.ស"
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2810,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 14, color: "#000" }, children: (() => {
              const raw = record && (record.entryDate || record.date) || capturedDate;
              if (!raw) return "";
              const entryTime = record && (record.entryTime || record.entry_time) || "";
              const dt = applyEntryTime(parsePreferLocalTime(raw, entryTime), entryTime);
              return `ចុះ ${formatKhmerDateTime(dt)}`;
            })() }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2811,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2809,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2808,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2806,
          columnNumber: 15
        }, this),
        effectiveShowLetterNo ? /* @__PURE__ */ jsxDEV("div", { className: "field", style: { marginTop: 6, display: "flex", alignItems: "flex-start", gap: 0 }, children: [
          /* @__PURE__ */ jsxDEV("span", { className: "label", style: { width: 140, minWidth: 140, fontFamily: "Khmer OS Muol Light", fontSize: 15 }, children: "លិខិតលេខ:" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2823,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "value", style: { flex: 1 }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ jsxDEV("div", { children: record?.letterNo ? toKhmerDigits(record.letterNo) : "" }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2826,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, color: "#070707ff" }, children: (() => {
              const raw = record && record.date || capturedDate;
              if (!raw) return "";
              const dt = raw instanceof Date ? raw : new Date(raw);
              return `ចុះ ${formatKhmerDate(dt)}`;
            })() }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2827,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2825,
            columnNumber: 19
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2824,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2822,
          columnNumber: 13
        }, this) : null,
        /* @__PURE__ */ jsxDEV("div", { className: "field", style: { marginTop: 6, display: "flex", alignItems: "flex-start", gap: 0 }, children: [
          /* @__PURE__ */ jsxDEV("span", { className: "label", style: { width: 140, minWidth: 140, fontFamily: "Khmer OS Muol Light", fontSize: 15 }, children: "មកពី:" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2838,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "value", style: { flex: 1 }, children: record?.source || "" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2839,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2837,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "field", style: { marginTop: 6, display: "flex", alignItems: "flex-start", gap: 0 }, children: [
          /* @__PURE__ */ jsxDEV("span", { className: "label", style: { width: 140, minWidth: 140, fontFamily: "Khmer OS Muol Light", fontSize: 15 }, children: "កម្មវត្ថុ:" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2843,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "value-plain", style: { flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: record?.content || "" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2844,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2842,
          columnNumber: 13
        }, this),
        effectiveShowCreatorName ? /* @__PURE__ */ jsxDEV("div", { className: "field", style: { marginTop: 6, display: "flex", alignItems: "flex-start", gap: 0 }, children: [
          /* @__PURE__ */ jsxDEV("span", { className: "label", style: { width: 140, minWidth: 140, fontFamily: "Khmer OS Muol Light", fontSize: 15 }, children: "បញ្ចូលលិខិតដោយ:" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2851,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "value", style: { flex: 1 }, children: record?.creatorName || "" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2852,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2850,
          columnNumber: 13
        }, this) : null,
        visibleStages && visibleStages.has("S") && /* @__PURE__ */ jsxDEV("div", { style: { border: "1px dashed #161616ff", padding: 1, marginTop: 5 }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "50fr", gap: 12 }, children: /* @__PURE__ */ jsxDEV("div", { style: { padding: 1 }, children: [
          /* @__PURE__ */ jsxDEV("div", { className: "role-label", style: { textAlign: "center", marginTop: 2, fontFamily: "Khmer OS Muol Light", fontSize: 10 }, children: meta && meta.feedbackStageRoles && meta.feedbackStageRoles.s || getRoleLabel("s") || meta && meta.reporterName }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2862,
            columnNumber: 20
          }, this),
          /* @__PURE__ */ jsxDEV(
            "textarea",
            {
              rows: 4,
              ref: courseNoteRef,
              value: leftContent,
              onChange: (e) => {
                setLeftContent(e.target.value);
                clearStageMessage("S");
              },
              placeholder: "....................",
              disabled: !isAssignedToStage(["S"]),
              style: {
                width: "100%",
                height: "auto",
                minHeight: "24px",
                lineHeight: uiLineHeight,
                textAlign: "justify",
                margin: 0,
                padding: "8px 22px 12px 8px",
                resize: manualResizeEnabled ? "both" : "none",
                overflow: manualResizeEnabled ? "auto" : "hidden",
                backgroundImage: manualResizeEnabled ? "linear-gradient(135deg, rgba(0,0,0,0.22) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.16) 25%, transparent 25%), linear-gradient(135deg, rgba(0,0,0,0.1) 25%, transparent 25%)" : "none",
                backgroundSize: manualResizeEnabled ? "14px 14px, 10px 10px, 6px 6px" : "0 0",
                backgroundRepeat: manualResizeEnabled ? "no-repeat" : "no-repeat",
                backgroundPosition: manualResizeEnabled ? "right 6px bottom 6px, right 4px bottom 4px, right 2px bottom 2px" : "0 0",
                fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                boxSizing: "border-box",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                textIndent: "30px"
              }
            },
            void 0,
            false,
            {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2865,
              columnNumber: 21
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 0 }, children: [
            hasCourseNote ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              effectiveShowDoAt("S") ? /* @__PURE__ */ jsxDEV("div", { children: [
                "ធ្វើនៅ ",
                formatKhmerDateTime(dateForMetaKey("CourseDate") || capturedDate)
              ] }, void 0, true, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 2899,
                columnNumber: 23
              }, this) : null,
              effectiveShowSignature("S") && sigSUrl ? /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 0 }, children: /* @__PURE__ */ jsxDEV("img", { src: sigSUrl, alt: "sig-s", style: { maxWidth: 100, maxHeight: 80, objectFit: "contain", display: "block", margin: "0 auto" } }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 2903,
                columnNumber: 31
              }, this) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 2902,
                columnNumber: 23
              }, this) : null
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2897,
              columnNumber: 21
            }, this) : null,
            effectiveShowName("S") || stageHasSenderForKeys(["S"]) ? /* @__PURE__ */ jsxDEV("div", { className: "sender-name", style: { fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }, children: (() => {
              try {
                if (hasCourseNote) {
                  return (getStageSenderName("S") || "").toString();
                }
                if (waitingStageSender) {
                  const s = String(waitingStageSender || "");
                  const m = s.match(/\(([^)]+)\)\s*$/);
                  if (m && m[1]) {
                    const key = m[1].trim();
                    try {
                      const rawStage = normalizedStages && normalizedStages[key];
                      const id = resolveStageId(rawStage);
                      if (id && signaturesMap && signaturesMap[id]) {
                        const sig = signaturesMap[id];
                        return sig && (sig.fullNameKh || sig.fullName || sig.name) || getRoleLabel(key) || s.replace(/\s*\([^)]+\)\s*$/, "").trim();
                      }
                    } catch (e) {
                    }
                    const label = getRoleLabel(key);
                    if (label) return label;
                  }
                  const keyOnly = (s.match(/(S\d|S|SDR|SD|DIR|SDIR|HO)/i) || [])[0];
                  if (keyOnly) {
                    try {
                      const rawStage = normalizedStages && normalizedStages[keyOnly];
                      const id = resolveStageId(rawStage);
                      if (id && signaturesMap && signaturesMap[id]) {
                        const sig = signaturesMap[id];
                        return sig && (sig.fullNameKh || sig.fullName || sig.name) || getRoleLabel(keyOnly) || keyOnly;
                      }
                    } catch (e) {
                    }
                    const label = getRoleLabel(keyOnly);
                    if (label) return label;
                  }
                  return s.replace(/\s*\([^)]+\)\s*$/, "").trim();
                }
              } catch (e) {
              }
              return getStageSenderName("S") || "";
            })() }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2909,
              columnNumber: 21
            }, this) : null
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2895,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: hasCourseNote ? "space-between" : "flex-start", alignItems: "center", marginTop: 6, padding: "0px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { color: stageMessageFor("S") ? "#0b6623" : "#e53333ff", minHeight: 0 }, children: stageMessageFor("S") }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2963,
            columnNumber: 23
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2962,
            columnNumber: 21
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2861,
          columnNumber: 19
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2860,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2859,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { marginTop: "0mm" } }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2973,
          columnNumber: 13
        }, this),
        visibleStages && visibleStages.has("S1") && /* @__PURE__ */ jsxDEV("div", { style: { border: "1px dashed #161616ff", padding: 1, marginTop: 5 }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: 12 }, children: /* @__PURE__ */ jsxDEV("div", { style: { padding: 1 }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }, children: /* @__PURE__ */ jsxDEV("div", { className: "role-label", style: { textAlign: "center", fontFamily: "Khmer OS Muol Light", flex: 1 }, children: getRoleLabel("S1") }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2981,
            columnNumber: 23
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 2980,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV(
            "textarea",
            {
              rows: 4,
              ref: s1TextareaRef,
              value: s1Content,
              onChange: (e) => {
                setS1Content(e.target.value);
                clearStageMessage("S1");
              },
              placeholder: "....................",
              disabled: !isAssignedToStage(["S1"]),
              style: {
                width: manualResizeEnabled ? "calc(100% - 18px)" : "100%",
                height: "auto",
                minHeight: "72px",
                lineHeight: uiLineHeight,
                textAlign: "justify",
                margin: 0,
                marginRight: manualResizeEnabled ? "18px" : 0,
                marginBottom: manualResizeEnabled ? "12px" : 0,
                padding: "8px 22px 12px 8px",
                resize: manualResizeEnabled ? "both" : "none",
                overflow: manualResizeEnabled ? "auto" : "hidden",
                fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                boxSizing: "border-box",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                textIndent: "30px"
              }
            },
            void 0,
            false,
            {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 2983,
              columnNumber: 21
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 0 }, children: [
            hasCourse1Note ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              effectiveShowDoAt("S1") ? /* @__PURE__ */ jsxDEV("div", { children: [
                "ធ្វើនៅ ",
                formatKhmerDateTime(dateForMetaKey("Course1Date") || capturedDate)
              ] }, void 0, true, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3015,
                columnNumber: 23
              }, this) : null,
              effectiveShowSignature("S1") && sig1Url ? /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 0 }, children: /* @__PURE__ */ jsxDEV("img", { src: sig1Url, alt: "sig-s1", style: { maxWidth: 120, maxHeight: 80, objectFit: "contain", display: "block", margin: "0 auto" } }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3019,
                columnNumber: 31
              }, this) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3018,
                columnNumber: 23
              }, this) : null
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3013,
              columnNumber: 21
            }, this) : null,
            effectiveShowName("S1") || stageHasSenderForKeys(["S1"]) ? /* @__PURE__ */ jsxDEV("div", { className: "sender-name", style: { fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }, children: getStageSenderName("S1") || waitingStageSender || "" }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3026,
              columnNumber: 21
            }, this) : null
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3011,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: hasCourse1Note ? "space-between" : "flex-start", alignItems: "center", marginTop: 6, padding: "0px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { color: stageMessageFor("S1") ? "#0b6623" : "#666", minHeight: 0 }, children: stageMessageFor("S1") }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3031,
            columnNumber: 23
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3030,
            columnNumber: 21
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2979,
          columnNumber: 19
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2978,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 2977,
          columnNumber: 13
        }, this),
        visibleStages && visibleStages.has("S2") && /* @__PURE__ */ jsxDEV("div", { style: { border: "1px dashed #161616ff", padding: 1, marginTop: 5 }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: 12 }, children: /* @__PURE__ */ jsxDEV("div", { style: { padding: 1 }, children: [
          /* @__PURE__ */ jsxDEV("div", { className: "role-s2 role-label", style: { textAlign: "center", marginTop: 5, fontFamily: "Khmer OS Muol Light" }, children: getRoleLabel("S2") }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3044,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV(
            "textarea",
            {
              rows: 4,
              ref: deptTextareaRef,
              value: deptContent,
              onChange: (e) => {
                setDeptContent(e.target.value);
                clearStageMessage("S2");
              },
              placeholder: "....................",
              disabled: !isAssignedToStage(["S2"]),
              style: {
                width: manualResizeEnabled ? "calc(100% - 18px)" : "100%",
                height: "auto",
                minHeight: "72px",
                lineHeight: uiLineHeight,
                textAlign: "justify",
                margin: 0,
                marginRight: manualResizeEnabled ? "18px" : 0,
                marginBottom: manualResizeEnabled ? "12px" : 0,
                padding: "8px 22px 12px 8px",
                resize: manualResizeEnabled ? "both" : "none",
                overflow: manualResizeEnabled ? "auto" : "hidden",
                fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                boxSizing: "border-box",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                textIndent: "30px"
              }
            },
            void 0,
            false,
            {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3045,
              columnNumber: 21
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 0 }, children: [
            hasDeptNote ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              effectiveShowDoAt("S2") ? /* @__PURE__ */ jsxDEV("div", { children: [
                "ធ្វើនៅ ",
                formatKhmerDateTime(dateForMetaKey("Course2Date") || capturedDate)
              ] }, void 0, true, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3077,
                columnNumber: 23
              }, this) : null,
              effectiveShowSignature("S2") && sig2Url ? /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ jsxDEV("img", { src: sig2Url, alt: "sig-head", style: { maxWidth: 120, maxHeight: 60, objectFit: "contain", display: "block", margin: "0 auto" } }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3081,
                columnNumber: 31
              }, this) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3080,
                columnNumber: 23
              }, this) : null
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3075,
              columnNumber: 21
            }, this) : null,
            effectiveShowName("S2") || stageHasSenderForKeys(["S2"]) ? /* @__PURE__ */ jsxDEV("div", { className: "sender-name", style: { fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 5, fontWeight: 100 }, children: getStageSenderName("S2") || "" }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3087,
              columnNumber: 21
            }, this) : null
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3073,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: hasDeptNote ? "space-between" : "flex-start", alignItems: "center", marginTop: 6, padding: "0px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { color: stageMessageFor("S2") ? "#0b6623" : "#666", minHeight: 0 }, children: stageMessageFor("S2") }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3092,
            columnNumber: 23
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3091,
            columnNumber: 21
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3043,
          columnNumber: 19
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3042,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3041,
          columnNumber: 13
        }, this),
        visibleStages && (visibleStages.has("S3") || visibleStages.has("S4")) ? deputyBlock : null,
        visibleStages && visibleStages.has("S5") && (visibleStages && visibleStages.has("S4") ? (
          // Side-by-side S4 (deputy right) and S5 (director)
          /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { border: "1px dashed #161616ff", padding: 5 }, children: /* @__PURE__ */ jsxDEV("div", { style: { padding: 1 }, children: [
              /* @__PURE__ */ jsxDEV("div", { className: "role-label", style: { textAlign: "center", marginTop: 0, fontFamily: "Khmer OS Muol Light" }, children: getRoleLabel("S4") }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3109,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(
                "textarea",
                {
                  rows: 4,
                  ref: deputyRightTextareaRef,
                  value: deputyRightContent,
                  onChange: (e) => {
                    setDeputyRightContent(e.target.value);
                    clearStageMessage("S4");
                  },
                  placeholder: "....................",
                  style: {
                    width: manualResizeEnabled ? "calc(100% - 18px)" : "100%",
                    height: "auto",
                    minHeight: "72px",
                    lineHeight: uiLineHeight,
                    textAlign: "justify",
                    margin: 0,
                    marginRight: manualResizeEnabled ? "18px" : 0,
                    marginBottom: manualResizeEnabled ? "12px" : 0,
                    padding: "8px 22px 12px 8px",
                    resize: manualResizeEnabled ? "both" : "none",
                    overflow: manualResizeEnabled ? "auto" : "hidden",
                    fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                    boxSizing: "border-box",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    textIndent: "30px"
                  },
                  disabled: !isAssignedToStage(["SDR", "S4"])
                },
                void 0,
                false,
                {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3110,
                  columnNumber: 23
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 0 }, children: [
                hasDeputyRight ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                  effectiveShowDoAt("S4") ? /* @__PURE__ */ jsxDEV("div", { children: [
                    "ធ្វើនៅ ",
                    formatKhmerDateTime(dateForMetaKey("Course4Date") || capturedDate)
                  ] }, void 0, true, {
                    fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                    lineNumber: 3132,
                    columnNumber: 23
                  }, this) : null,
                  effectiveShowSignature("S4") && sigDeputyRightUrl ? /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 0 }, children: /* @__PURE__ */ jsxDEV("img", { src: sigDeputyRightUrl, alt: "sig-deputy-right", style: { maxWidth: 100, maxHeight: 80, objectFit: "contain", display: "block", margin: "0 auto" } }, void 0, false, {
                    fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                    lineNumber: 3136,
                    columnNumber: 33
                  }, this) }, void 0, false, {
                    fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                    lineNumber: 3135,
                    columnNumber: 23
                  }, this) : null
                ] }, void 0, true, {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3130,
                  columnNumber: 21
                }, this) : null,
                effectiveShowName("S6") || stageHasSenderForKeys(["HO", "S6", "S4", "S3"]) ? /* @__PURE__ */ jsxDEV("div", { className: "sender-name", style: {
                  fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                  marginTop: 5,
                  fontWeight: 100
                }, children: getStageSenderName(["HO", "S6", "S4", "S3"]) || "" }, void 0, false, {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3142,
                  columnNumber: 21
                }, this) : null
              ] }, void 0, true, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3128,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "flex-start", alignItems: "center", marginTop: 6, padding: "0px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { color: stageMessageFor("S4") ? "#0b6623" : "#666", minHeight: 0 }, children: stageMessageFor("S4") }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3147,
                columnNumber: 27
              }, this) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3146,
                columnNumber: 25
              }, this)
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3108,
              columnNumber: 21
            }, this) }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3107,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { border: "1px dashed #161616ff", padding: 5 }, children: /* @__PURE__ */ jsxDEV("div", { style: { padding: 1 }, children: [
              /* @__PURE__ */ jsxDEV("div", { className: "role-label", style: { textAlign: "center", marginTop: 0, fontFamily: "Khmer OS Muol Light" }, children: getRoleLabel("S5") }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3153,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(
                "textarea",
                {
                  rows: 4,
                  ref: directorTextareaRef,
                  value: directorContent,
                  onChange: (e) => {
                    setDirectorContent(e.target.value);
                    clearStageMessage("S5");
                  },
                  placeholder: "....................",
                  disabled: !isAssignedToStage(["DIR", "SDIR", "S5"]),
                  style: {
                    width: manualResizeEnabled ? "calc(100% - 18px)" : "100%",
                    height: "auto",
                    minHeight: "72px",
                    lineHeight: uiLineHeight,
                    textAlign: "justify",
                    margin: 0,
                    marginRight: manualResizeEnabled ? "18px" : 0,
                    marginBottom: manualResizeEnabled ? "12px" : 0,
                    padding: "8px 22px 12px 8px",
                    resize: manualResizeEnabled ? "both" : "none",
                    overflow: manualResizeEnabled ? "auto" : "hidden",
                    fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                    boxSizing: "border-box",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    textIndent: "30px"
                  }
                },
                void 0,
                false,
                {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3154,
                  columnNumber: 23
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "left", marginTop: 0 }, children: [
                hasDirector ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                  effectiveShowDoAt("S5") ? /* @__PURE__ */ jsxDEV("div", { children: [
                    "ធ្វើនៅ ",
                    formatKhmerDateTime(dateForMetaKey("Course5Date") || capturedDate)
                  ] }, void 0, true, {
                    fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                    lineNumber: 3186,
                    columnNumber: 23
                  }, this) : null,
                  effectiveShowSignature("S5") && sigDirectorUrl ? /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 0 }, children: /* @__PURE__ */ jsxDEV("img", { src: sigDirectorUrl, alt: "sig-director", style: { maxWidth: 100, maxHeight: 70, objectFit: "contain", display: "block", margin: "0 auto" } }, void 0, false, {
                    fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                    lineNumber: 3190,
                    columnNumber: 33
                  }, this) }, void 0, false, {
                    fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                    lineNumber: 3189,
                    columnNumber: 23
                  }, this) : null
                ] }, void 0, true, {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3184,
                  columnNumber: 21
                }, this) : null,
                effectiveShowName("S5") || stageHasSenderForKeys(["DIR", "SDIR", "S5"]) ? /* @__PURE__ */ jsxDEV("div", { className: "sender-name", style: { fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }, children: getStageSenderName(["DIR", "SDIR", "S5"]) || "" }, void 0, false, {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3196,
                  columnNumber: 21
                }, this) : null
              ] }, void 0, true, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3182,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "flex-start", alignItems: "center", marginTop: 6, padding: "0px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { color: stageMessageFor("S5") ? "#0b6623" : "#666", minHeight: 0 }, children: stageMessageFor("S5") }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3200,
                columnNumber: 25
              }, this) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3199,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3152,
              columnNumber: 21
            }, this) }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3151,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3106,
            columnNumber: 13
          }, this)
        ) : /* @__PURE__ */ jsxDEV("div", { style: { border: "1px dashed #161616ff", padding: 1, marginTop: 5 }, children: /* @__PURE__ */ jsxDEV("div", { style: { padding: 1 }, children: [
          /* @__PURE__ */ jsxDEV("div", { className: "role-label", style: { textAlign: "center", marginTop: 0, fontFamily: "Khmer OS Muol Light" }, children: getRoleLabel("S5") }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3208,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV(
            "textarea",
            {
              rows: 4,
              ref: directorTextareaRef,
              value: directorContent,
              onChange: (e) => {
                setDirectorContent(e.target.value);
                clearStageMessage("S5");
              },
              placeholder: "....................",
              disabled: !isAssignedToStage(["DIR", "SDIR", "S5"]),
              style: {
                width: manualResizeEnabled ? "calc(100% - 18px)" : "100%",
                height: "auto",
                minHeight: "72px",
                lineHeight: uiLineHeight,
                textAlign: "left",
                margin: 0,
                marginRight: manualResizeEnabled ? "18px" : 0,
                marginBottom: manualResizeEnabled ? "12px" : 0,
                padding: "8px 22px 12px 8px",
                resize: manualResizeEnabled ? "both" : "none",
                overflow: manualResizeEnabled ? "auto" : "hidden",
                fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                boxSizing: "border-box",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                textIndent: "30px"
              }
            },
            void 0,
            false,
            {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3209,
              columnNumber: 21
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 0 }, children: [
            hasDirector ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              effectiveShowDoAt("S5") ? /* @__PURE__ */ jsxDEV("div", { children: [
                "ធ្វើនៅ ",
                formatKhmerDateTime(dateForMetaKey("Course5Date") || capturedDate)
              ] }, void 0, true, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3241,
                columnNumber: 21
              }, this) : null,
              effectiveShowSignature("S5") && sigDirectorUrl ? /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 0 }, children: /* @__PURE__ */ jsxDEV("img", { src: sigDirectorUrl, alt: "sig-director", style: { maxWidth: 50, maxHeight: 50, objectFit: "contain", display: "block", margin: "0 auto" } }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3245,
                columnNumber: 31
              }, this) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3244,
                columnNumber: 21
              }, this) : null
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3239,
              columnNumber: 19
            }, this) : null,
            effectiveShowName("S5") || stageHasSenderForKeys(["DIR", "SDIR", "S5"]) ? /* @__PURE__ */ jsxDEV("div", { className: "sender-name", style: { fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 0, fontWeight: 100 }, children: getStageSenderName(["DIR", "SDIR", "S5"]) || "" }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3251,
              columnNumber: 19
            }, this) : null
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3237,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "flex-start", alignItems: "center", marginTop: 6, padding: "0px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { color: stageMessageFor("S5") ? "#0b6623" : "#666", minHeight: 0 }, children: stageMessageFor("S5") }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3255,
            columnNumber: 23
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3254,
            columnNumber: 21
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3207,
          columnNumber: 19
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3206,
          columnNumber: 13
        }, this)),
        visibleStages && visibleStages.has("S6") && /* @__PURE__ */ jsxDEV("div", { style: { border: "1px dashed #161616ff", padding: 1, marginTop: 5 }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "50fr", gap: 12 }, children: /* @__PURE__ */ jsxDEV("div", { style: { padding: 1 }, children: [
            /* @__PURE__ */ jsxDEV("div", { className: "role-label", style: { textAlign: "center", marginTop: 0, fontFamily: "Khmer OS Muol Light" }, children: getRoleLabel("S6") }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3266,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              "textarea",
              {
                rows: 4,
                ref: headOfficeTextareaRef,
                value: headOfficeContent,
                onChange: (e) => {
                  setHeadOfficeContent(e.target.value);
                  clearStageMessage("S6");
                },
                placeholder: "....................",
                disabled: !isAssignedToStage(["S6"]),
                style: {
                  width: manualResizeEnabled ? "calc(100% - 18px)" : "100%",
                  height: "auto",
                  minHeight: "72px",
                  lineHeight: uiLineHeight,
                  textAlign: "center",
                  margin: 0,
                  marginRight: manualResizeEnabled ? "18px" : 0,
                  marginBottom: manualResizeEnabled ? "12px" : 0,
                  padding: "8px 22px 12px 8px",
                  resize: manualResizeEnabled ? "both" : "none",
                  overflow: manualResizeEnabled ? "auto" : "hidden",
                  fontFamily: "'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'",
                  boxSizing: "border-box",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  textIndent: "30px"
                }
              },
              void 0,
              false,
              {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3267,
                columnNumber: 21
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 0 }, children: [
              hasHeadOffice ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                effectiveShowDoAt("S6") ? /* @__PURE__ */ jsxDEV("div", { children: [
                  "ធ្វើនៅ ",
                  formatKhmerDateTime(dateForMetaKey("Course6Date") || capturedDate)
                ] }, void 0, true, {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3299,
                  columnNumber: 23
                }, this) : null,
                effectiveShowSignature("S6") && sigHeadOfficeUrl ? /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 5 }, children: /* @__PURE__ */ jsxDEV("img", { src: sigHeadOfficeUrl, alt: "sig-headoffice", style: { maxWidth: 160, maxHeight: 90, objectFit: "contain", display: "block", margin: "0 auto" } }, void 0, false, {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3303,
                  columnNumber: 31
                }, this) }, void 0, false, {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3302,
                  columnNumber: 23
                }, this) : null
              ] }, void 0, true, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3297,
                columnNumber: 21
              }, this) : null,
              effectiveShowName("S6") || stageHasSenderForKeys(["HO", "S6", "S4", "S3"]) ? /* @__PURE__ */ jsxDEV("div", { className: "sender-name", style: { fontFamily: "'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", marginTop: 5, fontWeight: 100 }, children: getStageSenderName(["HO", "S6", "S4", "S3"]) || "" }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3310,
                columnNumber: 21
              }, this) : null
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3295,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3265,
            columnNumber: 19
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3264,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "flex-start", alignItems: "center", marginTop: 0, padding: "0 px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { color: stageMessageFor("S6") ? "#0b6623" : "#666", minHeight: 0 }, children: stageMessageFor("S6") }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3318,
            columnNumber: 19
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3317,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3263,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 2763,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "ref-panel", style: { position: "relative", boxSizing: "border-box", zIndex: 100, overflow: "visible", background: "transparent", width: "210mm", margin: "5mm auto 0", alignSelf: "center" }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", flexDirection: "column", height: "auto", border: "1px solid #ebe5eaff", borderRadius: 1, background: "#fff" }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { padding: "0px 12px", borderBottom: "1px solid #eef2f6", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "#ffffff" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 100, fontFamily: "'Khmer OS Muol Light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'", fontSize: 14 }, children: "ឯកសារយោង" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3329,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
            refUrls && refUrls.length ? /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#333" }, children: refUrls[0] && (refUrls[0].name || refUrls[0].url) }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3332,
              columnNumber: 19
            }, this) : null,
            selectedRef ? /* @__PURE__ */ jsxDEV("a", { href: selectedRef, target: "_blank", rel: "noreferrer", style: { fontSize: 16, marginLeft: 8 }, children: "Open" }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3335,
              columnNumber: 19
            }, this) : null
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3330,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3328,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { padding: 0, paddingTop: "0mm", overflow: "visible", display: "block" }, children: /* @__PURE__ */ jsxDEV("div", { style: { flex: 1, minHeight: 80, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "center", padding: 8 }, children: selectedRef ? (
          // render preview filling the ref-panel area (use full-height container)
          /* @__PURE__ */ jsxDEV("div", { style: { width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsxDEV("div", { ref: refPreviewWrapper, style: { width: "210mm", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", overflow: "visible", background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 2px 6px rgba(0,0,0,0.12)", padding: 8 }, children: String(selectedRef).toLowerCase().endsWith(".pdf") ? (
            // PDF.js renders canvases into this container; let it expand to show all pages
            null
          ) : /* @__PURE__ */ jsxDEV("img", { src: selectedRef, alt: "reference", style: { width: "100%", height: "100%", objectFit: "contain" } }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3352,
            columnNumber: 23
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3347,
            columnNumber: 25
          }, this) }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3346,
            columnNumber: 19
          }, this)
        ) : /* @__PURE__ */ jsxDEV("div", { style: { padding: 1, color: "#666", fontFamily: "'Khmer OS Muol Light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { marginBottom: 8 }, children: [
            "មិនមានឯកសារយោង",
            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, color: "#999" }, children: " (debug hints shown below)" }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3359,
              columnNumber: 25
            }, this)
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3358,
            columnNumber: 23
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#444" }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { marginBottom: 6 }, children: [
              "កំណត់ត្រា exposed to console as ",
              /* @__PURE__ */ jsxDEV("code", { children: "window.__REPLAY_RECORD" }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3362,
                columnNumber: 90
              }, this)
            ] }, void 0, true, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3362,
              columnNumber: 25
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 600, marginBottom: 6 }, children: "Attachment hints:" }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3363,
              columnNumber: 25
            }, this),
            (() => {
              const hints = getAttachmentHints(record);
              if (!hints || hints.length === 0) return /* @__PURE__ */ jsxDEV("div", { style: { color: "#999" }, children: "No obvious attachment-like fields found in record (check console)." }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3366,
                columnNumber: 66
              }, this);
              return /* @__PURE__ */ jsxDEV("div", { style: { maxHeight: 220, overflow: "auto", border: "1px dashed #eee", padding: 8, background: "#fafafa" }, children: hints.map(
                (h, i) => /* @__PURE__ */ jsxDEV("div", { style: { marginBottom: 8 }, children: [
                  /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, color: "#333", fontWeight: 600 }, children: h.path }, void 0, false, {
                    fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                    lineNumber: 3371,
                    columnNumber: 35
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, color: "#555", wordBreak: "break-all" }, children: h.excerpt }, void 0, false, {
                    fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                    lineNumber: 3372,
                    columnNumber: 35
                  }, this)
                ] }, i, true, {
                  fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                  lineNumber: 3370,
                  columnNumber: 29
                }, this)
              ) }, void 0, false, {
                fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
                lineNumber: 3368,
                columnNumber: 27
              }, this);
            })()
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3361,
            columnNumber: 23
          }, this)
        ] }, void 0, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3357,
          columnNumber: 19
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3343,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3340,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 3326,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 3325,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2762,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 2761,
      columnNumber: 7
    }, this),
    record && (meta && meta.CourseNote || leftContent && leftContent.trim() !== "") && perms && perms.canSendTelegram && /* @__PURE__ */ jsxDEV("div", { style: { position: "fixed", right: 18, bottom: 18, zIndex: 9999 }, children: /* @__PURE__ */ jsxDEV("button", { onClick: sendToTelegram, disabled: saving, style: { background: "#0088cc", color: "#fff", padding: "10px 14px", borderRadius: 8, border: "none", boxShadow: "0 6px 18px rgba(0,0,0,0.12)", cursor: saving ? "default" : "pointer" }, children: saving ? "កំពុងបញ្ជូន..." : "ផ្ញើមតិ" }, void 0, false, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 3391,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 3390,
      columnNumber: 7
    }, this),
    record && meta && Array.isArray(meta.telegramFeedback) && meta.telegramFeedback.length > 0 && /* @__PURE__ */ jsxDEV("div", { style: { position: "relative", width: "min(210mm, 100%)", margin: "12px auto", maxWidth: 900 }, children: /* @__PURE__ */ jsxDEV("div", { style: { border: "1px solid #0088cc", background: "#f4faff", borderRadius: 6, padding: "12px 18px", boxShadow: "0 2px 8px rgba(0,136,204,0.07)", fontFamily: "'Noto Sans Khmer','Khmer OS','Hanuman',Arial,sans-serif" }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700, color: "#0088cc", fontSize: 16, marginBottom: 8 }, children: "មតិ/ការឆ្លើយតបតាម Telegram" }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 3400,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("ul", { style: { listStyle: "none", padding: 0, margin: 0 }, children: meta.telegramFeedback.map(
        (fb, idx) => /* @__PURE__ */ jsxDEV("li", { style: { marginBottom: 12, padding: "8px 12px", background: "#fff", borderRadius: 4, borderLeft: "4px solid #0088cc", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 600, color: "#005577", marginBottom: 2 }, children: [
            fb.userName || fb.from || "អ្នកប្រើប្រាស់",
            /* @__PURE__ */ jsxDEV("span", { style: { fontWeight: 400, color: "#888", fontSize: 12, marginLeft: 8 }, children: fb.timestamp || fb.date ? new Date(fb.timestamp || fb.date).toLocaleString("km-KH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "" }, void 0, false, {
              fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
              lineNumber: 3406,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3404,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { color: "#222", fontSize: 15, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: fb.message || fb.text || "" }, void 0, false, {
            fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
            lineNumber: 3408,
            columnNumber: 19
          }, this)
        ] }, idx, true, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3403,
          columnNumber: 13
        }, this)
      ) }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 3401,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 3399,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 3398,
      columnNumber: 7
    }, this),
    confirmVisible && /* @__PURE__ */ jsxDEV("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1e4, display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ jsxDEV("div", { role: "dialog", "aria-modal": "true", style: { width: 420, maxWidth: "94%", background: "#fff", borderRadius: 8, padding: 18, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 16, fontWeight: 600, marginBottom: 8 }, children: "ផ្ញើមតិទៅ Telegram" }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 3419,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { marginBottom: 12 }, children: "តើអ្នកចង់ផ្ញើមតិនេះទៅ Telegram ទេ? ជ្រើសមួយ៖" }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 3420,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { marginBottom: 12 }, children: /* @__PURE__ */ jsxDEV("label", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV("input", { type: "checkbox", checked: confirmAdvance, onChange: (e) => setConfirmAdvance(e.target.checked) }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3423,
          columnNumber: 17
        }, this),
        /* @__PURE__ */ jsxDEV("span", { children: "ផ្ញើ និងបើកវគ្គបន្ទាប់ (Advance to next stage)" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3424,
          columnNumber: 17
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 3422,
        columnNumber: 15
      }, this) }, void 0, false, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 3421,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV("button", { onClick: () => setConfirmVisible(false), style: { padding: "6px 10px" }, children: "បោះបង់" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3428,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("button", { onClick: () => doSendStage(confirmStageKey, false), style: { padding: "6px 10px" }, children: "ផ្ញើតែនេះ" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3429,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("button", { onClick: () => doSendStage(confirmStageKey, confirmAdvance), style: { padding: "6px 10px", background: "#0088cc", color: "#fff", border: "none", borderRadius: 6 }, children: sendingStage === confirmStageKey ? "កំពុង..." : "ផ្ញើ និងបើកវគ្គបន្ទាប់" }, void 0, false, {
          fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
          lineNumber: 3430,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
        lineNumber: 3427,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 3418,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
      lineNumber: 3417,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx",
    lineNumber: 2566,
    columnNumber: 5
  }, this);
}
_s(Replayfile2Page, "VPfdwSSoGQlev6LYTm3/GbneIvA=", false, function() {
  return [useAuth, usePermission, useSearchParams, useNavigate];
});
_c = Replayfile2Page;
if (typeof window !== "undefined" && window.__REPLAY_DEBUG__) {
  try {
    try {
      const meta = window.__REPLAY_RECORD && window.__REPLAY_RECORD.meta;
      if (meta) console.log("REPLAY record meta:", meta);
    } catch (e) {
    }
    try {
      const els = document ? [...document.querySelectorAll('[style*="dashed"]')] : [];
      els.map((el, i) => ({ idx: i, text: (el.innerText || "").trim().slice(0, 200), html: (el.innerHTML || "").slice(0, 200) })).forEach((x) => console.log(x));
    } catch (e) {
    }
  } catch (e) {
  }
}
var _c;
$RefreshReg$(_c, "Replayfile2Page");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/DB/web_2026_V3/src/pages/Replayfile2Page.jsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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aVAsV0FBVyxlQUFlQSxPQUFPa2Usa0JBQWtCO0FBQzVELE1BQUk7QUFHRixRQUFJO0FBQ0YsWUFBTXpzQixPQUFPdU8sT0FBT3dELG1CQUFtQnhELE9BQU93RCxnQkFBZ0IvUjtBQUM5RCxVQUFJQSxLQUFNYSxTQUFRcVQsSUFBSSx1QkFBdUJsVSxJQUFJO0FBQUEsSUFDbkQsU0FBU1ksR0FBRztBQUFBLElBQUM7QUFFYixRQUFJO0FBQ0YsWUFBTThyQixNQUFNdGdCLFdBQVcsQ0FBQyxHQUFHQSxTQUFTeUIsaUJBQWlCLG1CQUFtQixDQUFDLElBQUk7QUFDN0U2ZSxVQUFJcHJCLElBQUksQ0FBQ2tMLElBQUlnRyxPQUFPLEVBQUUrRyxLQUFLL0csR0FBRytaLE9BQU8vZixHQUFHNkksYUFBYSxJQUFJck4sS0FBSyxFQUFFc0ssTUFBTSxHQUFHLEdBQUcsR0FBR3FhLE9BQU9uZ0IsR0FBR3NULGFBQWEsSUFBSXhOLE1BQU0sR0FBRyxHQUFHLEVBQUUsRUFBRSxFQUFFdkcsUUFBUSxDQUFBa1ksTUFBS3BqQixRQUFRcVQsSUFBSStQLENBQUMsQ0FBQztBQUFBLElBQ3pKLFNBQVNyakIsR0FBRztBQUFBLElBQUU7QUFBQSxFQUNoQixTQUFTQSxHQUFHO0FBQUEsRUFBRTtBQUNoQjtBQUFDLElBQUE0ckI7QUFBQUksYUFBQUosSUFBQSIsIm5hbWVzIjpbInVzZVBlcm1pc3Npb24iLCJSZWFjdCIsInVzZUVmZmVjdCIsInVzZVN0YXRlIiwidXNlUmVmIiwidXNlTWVtbyIsInVzZUNhbGxiYWNrIiwidXNlQXV0aCIsInVzZU5hdmlnYXRlIiwidXNlU2VhcmNoUGFyYW1zIiwiYXBpIiwiZ2V0RmlsZVRyYW5zZmVyIiwidXBkYXRlRmlsZVRyYW5zZmVyIiwiQVBJX0JBU0UiLCJsb2dvMyIsIlJlcGxheWZpbGUyUGFnZSIsIl9zIiwidXNlciIsImN1cnJlbnRVc2VyIiwicGVybXMiLCJzZWFyY2hQYXJhbXMiLCJyZWNvcmRJZCIsImdldCIsInJlY29yZCIsInNldFJlY29yZCIsIm1ldGEiLCJzdGFnZXMiLCJmZWVkYmFja1N0YWdlcyIsInNpZ25hdHVyZXNNYXAiLCJzZXRTaWduYXR1cmVzTWFwIiwibG9hZGluZyIsInNldExvYWRpbmciLCJuYXZpZ2F0ZSIsIm1vdW50ZWQiLCJsb2FkIiwiZGF0YSIsImNhdGNoIiwiZSIsImNvbnNvbGUiLCJlcnJvciIsImdldFJvbGVMYWJlbCIsInJvbGUiLCJrZXkiLCJTdHJpbmciLCJ0b0xvd2VyQ2FzZSIsInJvbGVzIiwiZmVlZGJhY2tTdGFnZVJvbGVzIiwibWFwIiwicyIsInMxIiwiczIiLCJzMyIsInM0IiwiczUiLCJzNiIsImRpciIsImhvIiwiZmlyc3RDb3Vyc2UxTm90ZSIsIm0iLCJDb3Vyc2VOb3RlIiwiQ291cnNlMU5vdGUiLCJjZW50ZXJOb3RlIiwibGVmdENvbnRlbnQiLCJzZXRMZWZ0Q29udGVudCIsInMxQ29udGVudCIsInNldFMxQ29udGVudCIsImNlbnRlckNvbnRlbnQiLCJzZXRDZW50ZXJDb250ZW50IiwicmlnaHRDb250ZW50Iiwic2V0UmlnaHRDb250ZW50IiwicmlnaHROb3RlIiwiZGVwdENvbnRlbnQiLCJzZXREZXB0Q29udGVudCIsIkNvdXJzZTJOb3RlIiwiY29udGVudDMiLCJzZXRDb250ZW50MyIsIkNvdXJzZTNOb3RlIiwiY29udGVudDQiLCJzZXRDb250ZW50NCIsIkNvdXJzZTROb3RlIiwiY29udGVudDUiLCJzZXRDb250ZW50NSIsIkNvdXJzZTVOb3RlIiwic2F2aW5nIiwic2V0U2F2aW5nIiwic2F2ZU1lc3NhZ2UiLCJzZXRTYXZlTWVzc2FnZSIsInNhdmVNZXNzYWdlU3RhZ2UiLCJzZXRTYXZlTWVzc2FnZVN0YWdlIiwiU1RBR0VfS0VZU19CWV9NRVRBIiwiQ291cnNlNk5vdGUiLCJzdGFnZUtleUJ5TWV0YSIsIm1ldGFLZXkiLCJzZXRTdGFnZU1lc3NhZ2UiLCJtZXNzYWdlIiwic3RhZ2VLZXkiLCJjbGVhclN0YWdlTWVzc2FnZSIsInN0YWdlTWVzc2FnZUZvciIsInNlbmRpbmdTdGFnZSIsInNldFNlbmRpbmdTdGFnZSIsImF1dG9zYXZlVGltZXIiLCJhdXRvc2F2ZVRpbWVyRGVwdCIsImF1dG9zYXZlVGltZXJEZXB1dHkiLCJhdXRvc2F2ZVRpbWVyRGVwdXR5UmlnaHQiLCJhdXRvc2F2ZVRpbWVySGVhZE9mZmljZSIsImF1dG9zYXZlVGltZXJEaXJlY3RvciIsImF1dG9zYXZlVGltZXIzIiwiYXV0b3NhdmVUaW1lcjQiLCJhdXRvc2F2ZVRpbWVyNSIsImluaXRpYWxMb2FkIiwiY291cnNlTm90ZVJlZiIsInMxVGV4dGFyZWFSZWYiLCJkZXB0VGV4dGFyZWFSZWYiLCJkZXB1dHlUZXh0YXJlYVJlZiIsImRlcHV0eVJpZ2h0VGV4dGFyZWFSZWYiLCJkaXJlY3RvclRleHRhcmVhUmVmIiwiaGVhZE9mZmljZVRleHRhcmVhUmVmIiwidGV4dGFyZWEzUmVmIiwidGV4dGFyZWE0UmVmIiwidGV4dGFyZWE1UmVmIiwiZGVwdXR5Q29udGVudCIsInNldERlcHV0eUNvbnRlbnQiLCJkZXB1dHlSaWdodENvbnRlbnQiLCJzZXREZXB1dHlSaWdodENvbnRlbnQiLCJoZWFkT2ZmaWNlQ29udGVudCIsInNldEhlYWRPZmZpY2VDb250ZW50IiwiZGlyZWN0b3JDb250ZW50Iiwic2V0RGlyZWN0b3JDb250ZW50IiwiZGlyZWN0b3JTdGFnZVNlbCIsInNldERpcmVjdG9yU3RhZ2VTZWwiLCJub3JtYWxpemVkU3RhZ2VzIiwicmF3IiwiX2lkIiwiaWQiLCJzaWduYXR1cmVJZCIsInNlbmRlcklkIiwic2VuZGVyTmFtZSIsInNlbmRlciIsImRpcmVjdG9yT2ZmaWNlTmFtZSIsInNldERpcmVjdG9yT2ZmaWNlTmFtZSIsImNhcHR1cmVkRGF0ZSIsInNldENhcHR1cmVkRGF0ZSIsInJlZlVybHMiLCJzZXRSZWZVcmxzIiwic2VsZWN0ZWRSZWYiLCJzZXRTZWxlY3RlZFJlZiIsInJlZklmcmFtZSIsInNob3dMYXJnZVByZXZpZXciLCJzZXRTaG93TGFyZ2VQcmV2aWV3Iiwic2hlZXRSZWYiLCJyZWZQcmV2aWV3V3JhcHBlciIsInNob3dDb3Vyc2UzTm90ZSIsIkJvb2xlYW4iLCJ0cmltIiwidWlGb250U2l6ZSIsInNldFVpRm9udFNpemUiLCJpc1ByaW50aW5nIiwic2V0SXNQcmludGluZyIsInVpTGluZUhlaWdodCIsInNldFVpTGluZUhlaWdodCIsInVpUGFyYUJlZm9yZSIsInNldFVpUGFyYUJlZm9yZSIsInVpUGFyYUFmdGVyIiwic2V0VWlQYXJhQWZ0ZXIiLCJoaWRlV2F0ZXJtYXJrIiwic2V0SGlkZVdhdGVybWFyayIsInVpUGFkZGluZ1RvcCIsInNldFVpUGFkZGluZ1RvcCIsIlNUQUdFX1RPR0dMRV9LRVlTIiwibG9hZEJvb2wiLCJkZWZhdWx0VmFsdWUiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwidW5kZWZpbmVkIiwibG9hZFN0YWdlU2V0IiwiZGVmYXVsdFN0YWdlcyIsIlNldCIsInBhcnRzIiwic3BsaXQiLCJ0b1VwcGVyQ2FzZSIsImZpbHRlciIsImZpbHRlcmVkIiwiaW5jbHVkZXMiLCJsZW5ndGgiLCJ0b2dnbGVTdGFnZUluU2V0Iiwic2V0U3RhdGUiLCJwcmV2IiwibmV4dCIsImsiLCJoYXMiLCJkZWxldGUiLCJhZGQiLCJzaG93TGV0dGVyTm8iLCJzZXRTaG93TGV0dGVyTm8iLCJzaG93Q3JlYXRvck5hbWUiLCJzZXRTaG93Q3JlYXRvck5hbWUiLCJtYW51YWxSZXNpemVFbmFibGVkIiwic2V0TWFudWFsUmVzaXplRW5hYmxlZCIsInNob3dEb0F0U3RhZ2VzIiwic2V0U2hvd0RvQXRTdGFnZXMiLCJzaG93U2lnbmF0dXJlU3RhZ2VzIiwic2V0U2hvd1NpZ25hdHVyZVN0YWdlcyIsInNob3dOYW1lU3RhZ2VzIiwic2V0U2hvd05hbWVTdGFnZXMiLCJzZXRJdGVtIiwiQXJyYXkiLCJmcm9tIiwiam9pbiIsImFueVRvZ2dsZVNlbGVjdGVkIiwic2l6ZSIsImVmZmVjdGl2ZVNob3dMZXR0ZXJObyIsImVmZmVjdGl2ZVNob3dDcmVhdG9yTmFtZSIsImVmZmVjdGl2ZVNob3dEb0F0IiwiZWZmZWN0aXZlU2hvd1NpZ25hdHVyZSIsImVmZmVjdGl2ZVNob3dOYW1lIiwibGVnYWN5S2V5cyIsImZvckVhY2giLCJyZW1vdmVJdGVtIiwidGFyZ2V0cyIsIm9uQmVmb3JlUHJpbnQiLCJleGlzdGluZyIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJwYXJlbnROb2RlIiwicmVtb3ZlQ2hpbGQiLCJlbCIsInF1ZXJ5U2VsZWN0b3IiLCJpZnJhbWUiLCJjcmVhdGVFbGVtZW50Iiwic3R5bGUiLCJwb3NpdGlvbiIsImxlZnQiLCJ0b3AiLCJ0cmFuc2Zvcm0iLCJ3aWR0aCIsImhlaWdodCIsImJvcmRlciIsInpJbmRleCIsInZpc2liaWxpdHkiLCJzZXRBdHRyaWJ1dGUiLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJpZG9jIiwiY29udGVudERvY3VtZW50IiwiY29udGVudFdpbmRvdyIsIm9wZW4iLCJxdWVyeVNlbGVjdG9yQWxsIiwibiIsImhlYWQiLCJjbG9uZU5vZGUiLCJoaWRlU3R5bGUiLCJ0eXBlIiwiY3JlYXRlVGV4dE5vZGUiLCJjbG9zZSIsIndhcm4iLCJvbkFmdGVyUHJpbnQiLCJ3aW5kb3ciLCJhZGRFdmVudExpc3RlbmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImN1cnJlbnQiLCJkYXRlIiwicmF3RGF0ZVN0ciIsInBhcnNlZCIsIkRhdGUiLCJpc0RhdGVPbmx5IiwidGVzdCIsImdldEhvdXJzIiwiZ2V0TWludXRlcyIsIm5vdyIsInNldEhvdXJzIiwiZ2V0U2Vjb25kcyIsIkNvdXJzZTNEYXRlIiwicmF3TSIsImlzTWV0YURhdGVPbmx5Iiwibm93MiIsImNiIiwiY3JlYXRlZEJ5IiwicmVzIiwiZW5jb2RlVVJJQ29tcG9uZW50Iiwic2lnIiwiaXRlbXMiLCJwdXNoIiwibmFtZSIsImEiLCJ1cmwiLCJhdHRhY2htZW50VXJsIiwiZmlsZW5hbWUiLCJmaWxlUGF0aCIsInBhdGgiLCJyZXBsYWNlIiwiYXR0YWNobWVudHMiLCJpc0FycmF5IiwiZmlsZXMiLCJzaW5nbGVGaWVsZHMiLCJmaWxlIiwicmVmX3VybCIsInVwbG9hZFJlZ2V4Iiwic2NhbiIsIm9iaiIsImRlcHRoIiwic3RhcnRzV2l0aCIsImVuZHNXaXRoIiwibWF0Y2giLCJvIiwiT2JqZWN0Iiwia2V5cyIsInYiLCJ1bmlxIiwic2VlbiIsIml0IiwiZGVidWciLCJ1IiwiX19SRVBMQVlfUkVDT1JEIiwiZ2V0QXR0YWNobWVudEhpbnRzIiwiciIsImhpbnRzIiwidmFsIiwiSlNPTiIsInN0cmluZ2lmeSIsInNsaWNlIiwiZXhjZXJwdCIsImkiLCJjbGVhclRpbWVvdXQiLCJzZXJ2ZXJOb3RlIiwic2V0VGltZW91dCIsInNhdmVOb3RlIiwic2F2ZVN0YWdlTm90ZSIsInNhdmVEZXB0Tm90ZSIsInNhdmVDb3Vyc2UzTm90ZSIsInNhdmVDb3Vyc2U0Tm90ZSIsInNhdmVDb3Vyc2U1Tm90ZSIsInNhdmVDb3Vyc2U2Tm90ZSIsIk1JTl9IIiwiaCIsIk1hdGgiLCJtYXgiLCJzY3JvbGxIZWlnaHQiLCJNSU5fSF9EIiwicHJpbnRQYWdlIiwicHJpbnQiLCJnZXRQcmludENzcyIsInNjYWxlIiwic2NhbGVkRm9udFNpemUiLCJyb3VuZCIsInNjYWxlZFBhZGRpbmdUb3AiLCJ0b0ZpeGVkIiwicHJpbnRTaGVldCIsImxvZyIsImNvbXB1dGVTY2FsZSIsInRhcmdldEVsIiwidG1wIiwicGFnZVB4IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwibWFyZ2luVG9wTW0iLCJtYXJnaW5Cb3R0b21NbSIsImhlYWRlckFsbG93TW0iLCJwcmludGFibGVQeCIsImVsSCIsIm9mZnNldEhlaWdodCIsIm1pbiIsImNzcyIsImhpZGRlbk5vZGVzIiwibm9kZXMiLCJ0YWciLCJ0YWdOYW1lIiwidHh0IiwiaW5uZXJUZXh0IiwiY3MiLCJnZXRDb21wdXRlZFN0eWxlIiwiZnMiLCJwYXJzZUZsb2F0IiwiZm9udFNpemUiLCJ0b3RhbCIsImxldHRlcnMiLCJwdW5jdCIsInB1bmN0UmF0aW8iLCJkYXRhc2V0IiwiX3ByaW50SGlkZGVuIiwic3R5bGVFbCIsInRleHRDb250ZW50IiwiY2xlYW51cCIsImZhbGxiYWNrVGltZW91dCIsImZvY3VzIiwicHJpbnRFcnJvciIsIm9uQmVmb3JlIiwibWFyZ2luTW0iLCJvbkFmdGVyIiwiaHMiLCJtcSIsIm1hdGNoTWVkaWEiLCJtcUhhbmRsZXIiLCJtYXRjaGVzIiwiYWRkTGlzdGVuZXIiLCJyZW1vdmVMaXN0ZW5lciIsInByaW50UmVmIiwiZmV0Y2giLCJjcmVkZW50aWFscyIsIm9rIiwiRXJyb3IiLCJjdCIsImhlYWRlcnMiLCJibG9iIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwic3JjIiwicmV2b2tlT2JqZWN0VVJMIiwibXNnSGFuZGxlciIsIm9ubG9hZCIsIml3IiwidyIsInJlc29sdmVTdGFnZUlkIiwic2lnbmF0dXJlIiwiaXRlbSIsIl9rZXkiLCJzdGFnZSIsInRvU3RyaW5nIiwic2lnRm9yIiwic2lnbmF0dXJlVXJsIiwiZnAiLCJnZXRTdGFnZVNlbmRlck5hbWUiLCJrcyIsImZlZWRiYWNrU2VuZGVyTmFtZSIsImhhc1MiLCJzb21lIiwiZnVsbE5hbWVLaCIsImZ1bGxOYW1lIiwicmVwb3J0ZXJOYW1lIiwiZGVwYXJ0bWVudEhlYWQiLCJkZXB1dHlOYW1lIiwiZGVwdXR5UmlnaHROYW1lIiwiZGlyZWN0b3JOYW1lIiwiaGVhZE9mZmljZU5hbWUiLCJpZHgiLCJpbmRleE9mIiwibmV3TWV0YSIsIkNvdXJzZURhdGUiLCJ0b0lTT1N0cmluZyIsInVwZGF0ZWQiLCJlcnIiLCJDb3Vyc2UyRGF0ZSIsIkNvdXJzZTREYXRlIiwiQ291cnNlNkRhdGUiLCJDb3Vyc2U1RGF0ZSIsImNvbnRlbnQiLCJkYXRlS2V5Iiwic2VuZFRvVGVsZWdyYW0iLCJwb3N0Iiwic3VjY2VzcyIsImNvbmZpcm1WaXNpYmxlIiwic2V0Q29uZmlybVZpc2libGUiLCJjb25maXJtU3RhZ2VLZXkiLCJzZXRDb25maXJtU3RhZ2VLZXkiLCJjb25maXJtQWR2YW5jZSIsInNldENvbmZpcm1BZHZhbmNlIiwic2VuZFN0YWdlVG9UZWxlZ3JhbSIsImRvU2VuZFN0YWdlIiwiYWR2YW5jZSIsIm5vcm1hbGl6ZWRTdGFnZUtleSIsInBheWxvYWQiLCJyZWZyZXNoZWQiLCJyZWNyZWF0ZVN0YWdlTm90ZSIsIktITUVSX0RJR0lUUyIsIktITUVSX01PTlRIUyIsInRvS2htZXJEaWdpdHMiLCJudW0iLCJvdXQiLCJjaCIsImNoYXJBdCIsInBhcnNlSW50IiwiZm9ybWF0S2htZXJEYXRlIiwiZCIsImRheSIsImdldERhdGUiLCJtb250aCIsImdldE1vbnRoIiwieWVhciIsImdldEZ1bGxZZWFyIiwicGFkMiIsImZvcm1hdEtobWVyRGF0ZVRpbWUiLCJkYXRlUGFydCIsImhoIiwibW0iLCJhcHBseUVudHJ5VGltZSIsImJhc2VEYXRlIiwiZW50cnlUaW1lIiwiY2xvbmUiLCJwIiwic3MiLCJOdW1iZXIiLCJpc05hTiIsInBhcnNlUHJlZmVyTG9jYWxUaW1lIiwiZ2V0VGltZSIsImNyZWF0b3JOYW1lIiwidXNlcm5hbWUiLCJjcmVhdGVkQnlOYW1lIiwicmVwb3J0ZXIiLCJkYXRlRm9yTWV0YUtleSIsInNpZ1MiLCJzaWcxIiwic2lnMiIsInNpZzMiLCJzaWcxVXJsIiwic2lnU1VybCIsInNpZzJVcmwiLCJzaWczVXJsIiwic2lnRGVwdXR5Iiwic2lnRGVwdXR5VXJsIiwic2lnRGVwdXR5UmlnaHQiLCJzaWdEZXB1dHlSaWdodFVybCIsInNpZ0RpcmVjdG9yIiwic2lnRGlyZWN0b3JVcmwiLCJzaWdIZWFkT2ZmaWNlIiwic2lnSGVhZE9mZmljZVVybCIsImhhc0NvdXJzZU5vdGUiLCJoYXNDb3Vyc2UxTm90ZSIsImhhc0RlcHROb3RlIiwiaGFzRGVwdXR5IiwiaGFzRGVwdXR5UmlnaHQiLCJoYXNIZWFkT2ZmaWNlIiwiaGFzRGlyZWN0b3IiLCJnZXRTaGVldCIsImdldFByZXZpZXciLCJzeW5jUHJldmlld1NpemUiLCJvdmVyZmxvdyIsInJvIiwiUmVzaXplT2JzZXJ2ZXIiLCJvYnNlcnZlIiwib25SZXNpemUiLCJsYXN0UmVjdCIsInBvbGwiLCJzZXRJbnRlcnZhbCIsImRpc2Nvbm5lY3QiLCJjbGVhckludGVydmFsIiwibG9hZGluZ1Rhc2siLCJjb250YWluZXIiLCJpbm5lckhUTUwiLCJpc1BkZiIsInBkZmpzIiwicGRmanNMaWIiLCJkZWZhdWx0IiwibG9jYXRpb24iLCJvcmlnaW4iLCJsb2NhbFdvcmtlciIsIm1ldGhvZCIsIkdsb2JhbFdvcmtlck9wdGlvbnMiLCJ3b3JrZXJTcmMiLCJwZGYiLCJtb2RlIiwiYXJyYXlCdWYiLCJhcnJheUJ1ZmZlciIsImdldERvY3VtZW50IiwicHJvbWlzZSIsImRpc3BsYXkiLCJtYXJnaW4iLCJmZXRjaEVyciIsIm51bVBhZ2VzIiwicGFnZSIsImdldFBhZ2UiLCJjYW52YXMiLCJib3hTaXppbmciLCJwYWdlQnJlYWtBZnRlciIsIkRQUiIsImRldmljZVBpeGVsUmF0aW8iLCJjc3NXaWR0aCIsImNsaWVudFdpZHRoIiwiYmFzZVZpZXdwb3J0IiwiZ2V0Vmlld3BvcnQiLCJyZW5kZXJWaWV3cG9ydCIsImZsb29yIiwiY3R4IiwiZ2V0Q29udGV4dCIsInNldFRyYW5zZm9ybSIsInJlbmRlciIsImNhbnZhc0NvbnRleHQiLCJ2aWV3cG9ydCIsIm1zZyIsImRldGFpbHMiLCJkZXN0cm95Iiwic3RhZ2VIYXNTZW5kZXJGb3JLZXlzIiwic3RhZ2VUb01ldGFLZXkiLCJTIiwiUzEiLCJTMiIsIlNEIiwiUzMiLCJTRFIiLCJTNCIsIlM1IiwiRElSIiwiU0RJUiIsIlM2IiwiSE8iLCJ2aXNpYmxlU3RhZ2VzIiwiYnVja2V0cyIsInZhcmlhbnRzIiwibG9jYWwiLCJ2YXJpYW50U2VsZWN0ZWQiLCJsb2NhbEhhc05vdGUiLCJsb2NhbFZhbCIsInByZXNlbnQiLCJiIiwiYnVja2V0IiwieCIsIndpdGhEYXRlcyIsInRzIiwib3JkZXJLZXlzIiwiaGFzQW55U2F2ZWROb3RlIiwic29ydCIsInoiLCJvcmRlcmVkQnVja2V0cyIsInN0YWdlc1dpdGhGZWVkYmFjayIsImhhc1RleHQiLCJzZW50Iiwic3RhZ2VLZXlzRm9yU2V0dGluZ3MiLCJ3YWl0aW5nU3RhZ2VTZW5kZXIiLCJvcmRlciIsIm1ldGFWYWwiLCJ3YWl0aW5nU3RhZ2VTZW5kZXJDbGVhbiIsImlzQXNzaWduZWRUb1N0YWdlIiwiY2FuRWRpdERvY3VtZW50cyIsIm5vcm1hbGl6ZSIsIm5vcm0iLCJ1c2VyTmFtZXMiLCJjYW5kaWRhdGUiLCJjYW5kIiwic3RhZ2VTZWxlY3RlZCIsImhhc05vdGUiLCJhbHdheXNTaG93UGxhY2Vob2xkZXJzIiwic2hvd0RlcHV0eUxlZnQiLCJzaG93RGVwdXR5UmlnaHQiLCJzaG93SGVhZE9mZmljZSIsInNob3dEaXJlY3RvciIsInNob3dEZXB0Iiwic2hvd1JlY2lwaWVudCIsImRlcHV0eUJsb2NrIiwibGVmdFZpc2libGUiLCJyaWdodFZpc2libGUiLCJkZXB1dHlNZXNzYWdlIiwiZGVwdXR5UmlnaHRNZXNzYWdlIiwibGVmdEpTWCIsInBhZGRpbmciLCJtYXJnaW5Ub3AiLCJ0ZXh0QWxpZ24iLCJmb250RmFtaWx5IiwidGFyZ2V0IiwidmFsdWUiLCJtaW5IZWlnaHQiLCJsaW5lSGVpZ2h0IiwibWFyZ2luUmlnaHQiLCJtYXJnaW5Cb3R0b20iLCJyZXNpemUiLCJiYWNrZ3JvdW5kSW1hZ2UiLCJiYWNrZ3JvdW5kU2l6ZSIsImJhY2tncm91bmRSZXBlYXQiLCJiYWNrZ3JvdW5kUG9zaXRpb24iLCJ3aGl0ZVNwYWNlIiwib3ZlcmZsb3dXcmFwIiwid29yZEJyZWFrIiwidGV4dEluZGVudCIsIm1heFdpZHRoIiwibWF4SGVpZ2h0Iiwib2JqZWN0Rml0IiwiZm9udFdlaWdodCIsImluc2V0IiwiYmFja2dyb3VuZCIsImFsaWduSXRlbXMiLCJqdXN0aWZ5Q29udGVudCIsImJvcmRlclJhZGl1cyIsImJveFNoYWRvdyIsInN0b3BQcm9wYWdhdGlvbiIsImNvbG9yIiwicmlnaHRKU1giLCJncmlkVGVtcGxhdGVDb2x1bW5zIiwiZ2FwIiwic3RhZ2VLZXlzIiwiZmV0Y2hJZk1pc3NpbmciLCJhZGRlZCIsImNsYXNzTGlzdCIsInNpZGViYXJTZWxlY3RvcnMiLCJoZWFkZXJTZWxlY3RvcnMiLCJoaWRlRWxlbXMiLCJzZWxzIiwiX19yZXBsYXlPcmlnRGlzcGxheSIsInNldFByb3BlcnR5IiwiY29udGVudENhbmRpZGF0ZXMiLCJjIiwiX19yZXBsYXlPcmlnUGFkZGluZ0xlZnQiLCJwYWRkaW5nTGVmdCIsIl9fcmVwbGF5T3JpZ01hcmdpbkxlZnQiLCJtYXJnaW5MZWZ0IiwicmVtb3ZlUHJvcGVydHkiLCJyZW1vdmUiLCJxIiwiVVJMU2VhcmNoUGFyYW1zIiwic2VhcmNoIiwic2FtcGxlIiwibGV0dGVyTm8iLCJzb3VyY2UiLCJwcmludFNoZWV0RGlyZWN0IiwiUHJvbWlzZSIsImN1cnNvciIsIm9wYWNpdHkiLCJmbGV4V3JhcCIsImNoZWNrZWQiLCJib3JkZXJUb3AiLCJwYWRkaW5nVG9wIiwiYWxsT24iLCJncmlkQ29sdW1uIiwicGFkZGluZ1JpZ2h0Iiwib3ZlcmZsb3dYIiwibWluV2lkdGgiLCJmbGV4U2hyaW5rIiwiZmxleERpcmVjdGlvbiIsInBvaW50ZXJFdmVudHMiLCJmbGV4IiwiZW50cnlObyIsImVudHJ5RGF0ZSIsImVudHJ5X3RpbWUiLCJkdCIsInJhd1N0YWdlIiwibGFiZWwiLCJrZXlPbmx5IiwiYWxpZ25TZWxmIiwiYm9yZGVyQm90dG9tIiwiY2FuU2VuZFRlbGVncmFtIiwicmlnaHQiLCJib3R0b20iLCJ0ZWxlZ3JhbUZlZWRiYWNrIiwibGlzdFN0eWxlIiwiZmIiLCJib3JkZXJMZWZ0IiwidXNlck5hbWUiLCJ0aW1lc3RhbXAiLCJ0b0xvY2FsZVN0cmluZyIsImhvdXIiLCJtaW51dGUiLCJ0ZXh0IiwiX2MiLCJfX1JFUExBWV9ERUJVR19fIiwiZWxzIiwiaHRtbCIsIiRSZWZyZXNoUmVnJCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJSZXBsYXlmaWxlMlBhZ2UuanN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB1c2VQZXJtaXNzaW9uIGZyb20gJy4uL2hvb2tzL3VzZVBlcm1pc3Npb24nO1xyXG5pbXBvcnQgUmVhY3QsIHsgdXNlRWZmZWN0LCB1c2VTdGF0ZSwgdXNlUmVmLCB1c2VNZW1vLCB1c2VDYWxsYmFjayB9IGZyb20gJ3JlYWN0JztcclxuaW1wb3J0IHsgdXNlQXV0aCB9IGZyb20gJy4uL2NvbnRleHQvQXV0aENvbnRleHQnO1xyXG5pbXBvcnQgeyB1c2VOYXZpZ2F0ZSwgdXNlU2VhcmNoUGFyYW1zIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XHJcbmltcG9ydCBhcGkgZnJvbSAnLi4vc2VydmljZXMvYXBpJztcclxuaW1wb3J0IHsgZ2V0RmlsZVRyYW5zZmVyLCB1cGRhdGVGaWxlVHJhbnNmZXIgfSBmcm9tICcuLi9hcGkvZmlsZVRyYW5zZmVyJztcclxuaW1wb3J0IHsgQVBJX0JBU0UgfSBmcm9tICcuLi9jb25maWcnO1xyXG5pbXBvcnQgbG9nbzMgZnJvbSAnLi4vYXNzZXRzLzMuSlBHJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFJlcGxheWZpbGUyUGFnZSgpIHtcclxuICBjb25zdCB7IHVzZXI6IGN1cnJlbnRVc2VyIH0gPSB1c2VBdXRoKCkgfHwge307XHJcbiAgICBjb25zdCBwZXJtcyA9IHVzZVBlcm1pc3Npb24oKTtcclxuICBjb25zdCBbc2VhcmNoUGFyYW1zXSA9IHVzZVNlYXJjaFBhcmFtcygpO1xyXG4gIGNvbnN0IHJlY29yZElkID0gc2VhcmNoUGFyYW1zLmdldCgncmVjb3JkSWQnKTtcclxuICBjb25zdCBbcmVjb3JkLCBzZXRSZWNvcmRdID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgbWV0YSA9IHJlY29yZCAmJiAocmVjb3JkLm1ldGEgfHwge30pO1xyXG4gIGNvbnN0IHN0YWdlcyA9IG1ldGEgJiYgKG1ldGEuZmVlZGJhY2tTdGFnZXMgfHwge30pO1xyXG4gIGNvbnN0IFtzaWduYXR1cmVzTWFwLCBzZXRTaWduYXR1cmVzTWFwXSA9IHVzZVN0YXRlKHt9KTtcclxuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgbmF2aWdhdGUgPSB1c2VOYXZpZ2F0ZSgpO1xyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgbGV0IG1vdW50ZWQgPSB0cnVlO1xyXG4gICAgY29uc3QgbG9hZCA9IGFzeW5jICgpID0+IHtcclxuICAgICAgaWYgKCFyZWNvcmRJZCkgcmV0dXJuO1xyXG4gICAgICBzZXRMb2FkaW5nKHRydWUpO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGlmICghcmVjb3JkSWQpIHJldHVybjtcclxuICAgICAgICAvLyBVc2UgbGVnYWN5IGZpbGUtdHJhbnNmZXIgQVBJIGhlbHBlciB0byBmZXRjaCB0aGUgcmVjb3JkXHJcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGdldEZpbGVUcmFuc2ZlcihyZWNvcmRJZCkuY2F0Y2goZSA9PiB7IHRocm93IGU7IH0pO1xyXG4gICAgICAgIGlmIChtb3VudGVkKSBzZXRSZWNvcmQoZGF0YSB8fCBudWxsKTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ2xvYWQgcmVjb3JkIGVycm9yJywgZSk7XHJcbiAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIH07XHJcbiAgICAgIGxvYWQoKTtcclxuICAgICAgcmV0dXJuICgpID0+IHsgbW91bnRlZCA9IGZhbHNlOyB9O1xyXG4gICAgfSwgW3JlY29yZElkXSk7XHJcbiAgLy8gaGVscGVyOiBtYXAgc3RhZ2Ugcm9sZSBjb2RlcyB0byByZWFkYWJsZSBsYWJlbHNcclxuICAvLyBQcmVmZXIgcGVyLXJlY29yZCAobWV0YS5mZWVkYmFja1N0YWdlUm9sZXMpIG1hcHBpbmdzIHdoZW4gYXZhaWxhYmxlLFxyXG4gIC8vIG90aGVyd2lzZSBmYWxsIGJhY2sgdG8gdGhlIGJ1aWx0LWluIG1hcCBvciB0aGUgcmF3IHJvbGUgY29kZS5cclxuICBjb25zdCBnZXRSb2xlTGFiZWwgPSAocm9sZSkgPT4ge1xyXG4gICAgaWYgKCFyb2xlICYmIHJvbGUgIT09IDApIHJldHVybiAnJztcclxuICAgIGNvbnN0IGtleSA9IFN0cmluZyhyb2xlKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJvbGVzID0gbWV0YSAmJiBtZXRhLmZlZWRiYWNrU3RhZ2VSb2xlcztcclxuICAgICAgaWYgKHJvbGVzICYmIHR5cGVvZiByb2xlcyA9PT0gJ29iamVjdCcgJiYgcm9sZXNba2V5XSkgcmV0dXJuIHJvbGVzW2tleV07XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIC8vIGlnbm9yZSBhbmQgZmFsbCBiYWNrIHRvIHN0YXRpYyBtYXBcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtYXAgPSB7XHJcbiAgICAgIHM6ICfhnpjhnpPhn5Lhnprhn5Lhno/hnrjhnpHhnpHhnr3hnpvhnpThnpPhn5LhnpHhnrvhnoAnLFxyXG4gICAgICBzMTogJ+GemeGfhOGelOGem+Gfi+GelOGfkuGemuGekuGetuGek+GegOGetuGemuGet+GemeGetuGem+GfkOGemeGelOGeheGfkuGeheGfgeGegOGekeGfgeGenycsXHJcbiAgICAgIHMyOiAn4Z6Z4Z+E4Z6U4Z6b4Z+L4Z6U4Z+S4Z6a4Z6S4Z624Z6T4Z6A4Z624Z6a4Z634Z6Z4Z624Z6b4Z+Q4Z6Z4Z6g4Z634Z6a4Z6J4Z+S4Z6J4Z6c4Z6P4Z+S4Z6Q4Z67JyxcclxuICAgICAgczM6ICfhnpnhn4ThnpThnpvhn4vhnpThn5LhnprhnpLhnrbhnpPhnoDhnrbhnprhnrfhnpnhnrbhnpvhn5Dhnpnhnprhnorhn5LhnovhnpThnrbhnpvhnpThnrvhnoLhn5LhnoLhnpvhnrfhnoAnLFxyXG4gICAgICBzNDogJ+GemeGfhOGelOGem+Gfi+Gek+GetuGemeGegOGemuGehOGemOGek+GfkuGekeGeuOGemuGeluGfgeGekeGfkuGemScsXHJcbiAgICAgIHM1OiAn4Z6Z4Z+E4Z6U4Z6b4Z+L4Z6T4Z624Z6Z4Z6A4Z6a4Z6E4Z6Y4Z6T4Z+S4Z6R4Z644Z6a4Z6W4Z+B4Z6R4Z+S4Z6ZJyxcclxuICAgICAgczY6ICfhnpnhn4ThnpThnpvhn4vhnpPhnrbhnpnhnoDhnpjhnpPhn5LhnpHhnrjhnprhnpbhn4HhnpHhn5LhnpknLFxyXG4gICAgICBkaXI6ICfhnpnhn4ThnpThnpvhn4vhnpPhnrbhnpnhnoDhnprhnoThnpjhnpPhn5LhnpHhnrjhnprhnpbhn4HhnpHhn5LhnpknLFxyXG4gICAgICBobzogJ+GemeGfhOGelOGem+Gfi+Gek+GetuGemeGegOGemuGehOGemOGek+GfkuGekeGeuOGemuGeluGfgeGekeGfkuGemSdcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG1hcFtrZXldIHx8IHJvbGU7XHJcbiAgfTtcclxuXHJcbiAgLy8gaGVscGVyOiByZXR1cm4gdGhlIHByZWZlcnJlZCBpbml0aWFsIGxlZnQvY291cnNlMSBub3RlIGZyb20gbWV0YVxyXG4gIGNvbnN0IGZpcnN0Q291cnNlMU5vdGUgPSAobSkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgaWYgKCFtIHx8IHR5cGVvZiBtICE9PSAnb2JqZWN0JykgcmV0dXJuICcnO1xyXG4gICAgICAvLyBwcmVmZXIgQ291cnNlTm90ZSwgdGhlbiBDb3Vyc2UxTm90ZSwgdGhlbiBjZW50ZXJOb3RlIGFzIGZhbGxiYWNrXHJcbiAgICAgIHJldHVybiAobS5Db3Vyc2VOb3RlIHx8IG0uQ291cnNlMU5vdGUgfHwgbS5jZW50ZXJOb3RlIHx8ICcnKSB8fCAnJztcclxuICAgIH0gY2F0Y2ggKGUpIHsgcmV0dXJuICcnOyB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgW2xlZnRDb250ZW50LCBzZXRMZWZ0Q29udGVudF0gPSB1c2VTdGF0ZShmaXJzdENvdXJzZTFOb3RlKG1ldGEpIHx8ICcnKTtcclxuICBjb25zdCBbczFDb250ZW50LCBzZXRTMUNvbnRlbnRdID0gdXNlU3RhdGUoKG1ldGEgJiYgbWV0YS5Db3Vyc2UxTm90ZSkgfHwgJycpO1xyXG4gIGNvbnN0IFtjZW50ZXJDb250ZW50LCBzZXRDZW50ZXJDb250ZW50XSA9IHVzZVN0YXRlKChtZXRhICYmIG1ldGEuY2VudGVyTm90ZSkgfHwgJycpO1xyXG4gIGNvbnN0IFtyaWdodENvbnRlbnQsIHNldFJpZ2h0Q29udGVudF0gPSB1c2VTdGF0ZSgobWV0YSAmJiBtZXRhLnJpZ2h0Tm90ZSkgfHwgJycpO1xyXG4gIGNvbnN0IFtkZXB0Q29udGVudCwgc2V0RGVwdENvbnRlbnRdID0gdXNlU3RhdGUoKG1ldGEgJiYgbWV0YS5Db3Vyc2UyTm90ZSkgfHwgJycpO1xyXG4gIGNvbnN0IFtjb250ZW50Mywgc2V0Q29udGVudDNdID0gdXNlU3RhdGUoKG1ldGEgJiYgbWV0YS5Db3Vyc2UzTm90ZSkgfHwgJycpO1xyXG4gIGNvbnN0IFtjb250ZW50NCwgc2V0Q29udGVudDRdID0gdXNlU3RhdGUoKG1ldGEgJiYgbWV0YS5Db3Vyc2U0Tm90ZSkgfHwgJycpO1xyXG4gIGNvbnN0IFtjb250ZW50NSwgc2V0Q29udGVudDVdID0gdXNlU3RhdGUoKG1ldGEgJiYgbWV0YS5Db3Vyc2U1Tm90ZSkgfHwgJycpO1xyXG4gIGNvbnN0IFtzYXZpbmcsIHNldFNhdmluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW3NhdmVNZXNzYWdlLCBzZXRTYXZlTWVzc2FnZV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW3NhdmVNZXNzYWdlU3RhZ2UsIHNldFNhdmVNZXNzYWdlU3RhZ2VdID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgU1RBR0VfS0VZU19CWV9NRVRBID0ge1xyXG4gICAgQ291cnNlTm90ZTogJ1MnLFxyXG4gICAgQ291cnNlMU5vdGU6ICdTMScsXHJcbiAgICBDb3Vyc2UyTm90ZTogJ1MyJyxcclxuICAgIENvdXJzZTNOb3RlOiAnUzMnLFxyXG4gICAgQ291cnNlNE5vdGU6ICdTNCcsXHJcbiAgICBDb3Vyc2U1Tm90ZTogJ1M1JyxcclxuICAgIENvdXJzZTZOb3RlOiAnUzYnXHJcbiAgfTtcclxuICBjb25zdCBzdGFnZUtleUJ5TWV0YSA9IChtZXRhS2V5KSA9PiBTVEFHRV9LRVlTX0JZX01FVEFbbWV0YUtleV0gfHwgbnVsbDtcclxuICBjb25zdCBzZXRTdGFnZU1lc3NhZ2UgPSAobWVzc2FnZSwgc3RhZ2VLZXkgPSBudWxsKSA9PiB7XHJcbiAgICBzZXRTYXZlTWVzc2FnZShtZXNzYWdlKTtcclxuICAgIHNldFNhdmVNZXNzYWdlU3RhZ2UobWVzc2FnZSA/IHN0YWdlS2V5IDogbnVsbCk7XHJcbiAgfTtcclxuICBjb25zdCBjbGVhclN0YWdlTWVzc2FnZSA9IChzdGFnZUtleSkgPT4ge1xyXG4gICAgaWYgKCFzdGFnZUtleSB8fCBzYXZlTWVzc2FnZVN0YWdlID09PSBzdGFnZUtleSkge1xyXG4gICAgICBzZXRTYXZlTWVzc2FnZSgnJyk7XHJcbiAgICAgIHNldFNhdmVNZXNzYWdlU3RhZ2UobnVsbCk7XHJcbiAgICB9XHJcbiAgfTtcclxuICBjb25zdCBzdGFnZU1lc3NhZ2VGb3IgPSAoc3RhZ2VLZXkpID0+IChzYXZlTWVzc2FnZVN0YWdlID09PSBzdGFnZUtleSA/IHNhdmVNZXNzYWdlIDogJycpO1xyXG4gIGNvbnN0IFtzZW5kaW5nU3RhZ2UsIHNldFNlbmRpbmdTdGFnZV0gPSB1c2VTdGF0ZShudWxsKTtcclxuICBjb25zdCBhdXRvc2F2ZVRpbWVyID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IGF1dG9zYXZlVGltZXJEZXB0ID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IGF1dG9zYXZlVGltZXJEZXB1dHkgPSB1c2VSZWYobnVsbCk7XHJcbiAgY29uc3QgYXV0b3NhdmVUaW1lckRlcHV0eVJpZ2h0ID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IGF1dG9zYXZlVGltZXJIZWFkT2ZmaWNlID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IGF1dG9zYXZlVGltZXJEaXJlY3RvciA9IHVzZVJlZihudWxsKTtcclxuICBjb25zdCBhdXRvc2F2ZVRpbWVyMyA9IHVzZVJlZihudWxsKTtcclxuICBjb25zdCBhdXRvc2F2ZVRpbWVyNCA9IHVzZVJlZihudWxsKTtcclxuICBjb25zdCBhdXRvc2F2ZVRpbWVyNSA9IHVzZVJlZihudWxsKTtcclxuICBjb25zdCBpbml0aWFsTG9hZCA9IHVzZVJlZih0cnVlKTtcclxuICBjb25zdCBjb3Vyc2VOb3RlUmVmID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IHMxVGV4dGFyZWFSZWYgPSB1c2VSZWYobnVsbCk7XHJcbiAgY29uc3QgZGVwdFRleHRhcmVhUmVmID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IGRlcHV0eVRleHRhcmVhUmVmID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IGRlcHV0eVJpZ2h0VGV4dGFyZWFSZWYgPSB1c2VSZWYobnVsbCk7XHJcbiAgY29uc3QgZGlyZWN0b3JUZXh0YXJlYVJlZiA9IHVzZVJlZihudWxsKTtcclxuICBjb25zdCBoZWFkT2ZmaWNlVGV4dGFyZWFSZWYgPSB1c2VSZWYobnVsbCk7XHJcbiAgY29uc3QgdGV4dGFyZWEzUmVmID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IHRleHRhcmVhNFJlZiA9IHVzZVJlZihudWxsKTtcclxuICBjb25zdCB0ZXh0YXJlYTVSZWYgPSB1c2VSZWYobnVsbCk7XHJcbiAgY29uc3QgW2RlcHV0eUNvbnRlbnQsIHNldERlcHV0eUNvbnRlbnRdID0gdXNlU3RhdGUoKG1ldGEgJiYgbWV0YS5Db3Vyc2UzTm90ZSkgfHwgJycpO1xyXG4gIGNvbnN0IFtkZXB1dHlSaWdodENvbnRlbnQsIHNldERlcHV0eVJpZ2h0Q29udGVudF0gPSB1c2VTdGF0ZSgobWV0YSAmJiBtZXRhLkNvdXJzZTROb3RlKSB8fCAnJyk7XHJcbiAgY29uc3QgW2hlYWRPZmZpY2VDb250ZW50LCBzZXRIZWFkT2ZmaWNlQ29udGVudF0gPSB1c2VTdGF0ZSgobWV0YSAmJiBtZXRhLkNvdXJzZTZOb3RlKSB8fCAnJyk7XHJcbiAgY29uc3QgW2RpcmVjdG9yQ29udGVudCwgc2V0RGlyZWN0b3JDb250ZW50XSA9IHVzZVN0YXRlKChtZXRhICYmIG1ldGEuQ291cnNlNU5vdGUpIHx8ICcnKTtcclxuICBjb25zdCBbZGlyZWN0b3JTdGFnZVNlbCwgc2V0RGlyZWN0b3JTdGFnZVNlbF0gPSB1c2VTdGF0ZSgoKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBpZiAoIW5vcm1hbGl6ZWRTdGFnZXMpIHJldHVybiAnJztcclxuICAgICAgY29uc3QgcmF3ID0gbm9ybWFsaXplZFN0YWdlc1snUzUnXSB8fCBub3JtYWxpemVkU3RhZ2VzWydESVInXSB8fCBub3JtYWxpemVkU3RhZ2VzWydTRElSJ107XHJcbiAgICAgIGlmICghcmF3KSByZXR1cm4gJyc7XHJcbiAgICAgIGlmICh0eXBlb2YgcmF3ID09PSAnb2JqZWN0JykgcmV0dXJuIHJhdy5faWQgfHwgcmF3LmlkIHx8IHJhdy5zaWduYXR1cmVJZCB8fCByYXcuc2VuZGVySWQgfHwgcmF3LnNlbmRlck5hbWUgfHwgcmF3LnNlbmRlciB8fCAnJztcclxuICAgICAgcmV0dXJuIHJhdztcclxuICAgIH0gY2F0Y2ggKGUpIHsgcmV0dXJuICcnOyB9XHJcbiAgfSk7XHJcbiAgY29uc3QgW2RpcmVjdG9yT2ZmaWNlTmFtZSwgc2V0RGlyZWN0b3JPZmZpY2VOYW1lXSA9IHVzZVN0YXRlKCcnKTtcclxuICBjb25zdCBbY2FwdHVyZWREYXRlLCBzZXRDYXB0dXJlZERhdGVdID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgW3JlZlVybHMsIHNldFJlZlVybHNdID0gdXNlU3RhdGUoW10pO1xyXG4gIGNvbnN0IFtzZWxlY3RlZFJlZiwgc2V0U2VsZWN0ZWRSZWZdID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgcmVmSWZyYW1lID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IFtzaG93TGFyZ2VQcmV2aWV3LCBzZXRTaG93TGFyZ2VQcmV2aWV3XSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBzaGVldFJlZiA9IHVzZVJlZihudWxsKTtcclxuICBjb25zdCByZWZQcmV2aWV3V3JhcHBlciA9IHVzZVJlZihudWxsKTtcclxuXHJcbiAgLy8gd2hlbiBDb3Vyc2UzTm90ZSAoZGVwdXR5KSBpcyBwcmVzZW50LCBhdm9pZCBzaG93aW5nIHRoZSBjZW50ZXJlZCB3YXRlcm1hcmtcclxuICAvLyBzbyBpdCBkb2Vzbid0IGNvdmVyIG5vdGUgdGV4dCBpbiB0aGF0IGFyZWFcclxuICBjb25zdCBzaG93Q291cnNlM05vdGUgPSBCb29sZWFuKChtZXRhICYmIG1ldGEuQ291cnNlM05vdGUpIHx8IChkZXB1dHlDb250ZW50ICYmIGRlcHV0eUNvbnRlbnQudHJpbSgpICE9PSAnJykpO1xyXG5cclxuICAvLyBVSSBjb250cm9scyBmb3IgYWRqdXN0aW5nIGZvbnQgc2l6ZSBhbmQgc3BhY2luZyBmb3IgcHJpbnQvbGF5b3V0XHJcbiAgY29uc3QgW3VpRm9udFNpemUsIHNldFVpRm9udFNpemVdID0gdXNlU3RhdGUoMTUpO1xyXG4gIGNvbnN0IFtpc1ByaW50aW5nLCBzZXRJc1ByaW50aW5nXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbdWlMaW5lSGVpZ2h0LCBzZXRVaUxpbmVIZWlnaHRdID0gdXNlU3RhdGUoMS44KTtcclxuICBjb25zdCBbdWlQYXJhQmVmb3JlLCBzZXRVaVBhcmFCZWZvcmVdID0gdXNlU3RhdGUoMSk7IC8vIHB4XHJcbiAgY29uc3QgW3VpUGFyYUFmdGVyLCBzZXRVaVBhcmFBZnRlcl0gPSB1c2VTdGF0ZSgxKTsgLy8gcHhcclxuICBjb25zdCBbaGlkZVdhdGVybWFyaywgc2V0SGlkZVdhdGVybWFya10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW3VpUGFkZGluZ1RvcCwgc2V0VWlQYWRkaW5nVG9wXSA9IHVzZVN0YXRlKDUpOyAvLyBtbVxyXG5cclxuICAvLyBEaXNwbGF5IHNldHRpbmdzIChwZXJzaXN0ZWQgcGVyIGJyb3dzZXIpXHJcbiAgY29uc3QgU1RBR0VfVE9HR0xFX0tFWVMgPSBbJ1MnLCAnUzEnLCAnUzInLCAnUzMnLCAnUzQnLCAnUzUnLCAnUzYnXTtcclxuICBjb25zdCBsb2FkQm9vbCA9IChrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmF3ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KTtcclxuICAgICAgaWYgKHJhdyA9PT0gbnVsbCB8fCByYXcgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcclxuICAgICAgaWYgKHJhdyA9PT0gJzEnIHx8IHJhdyA9PT0gJ3RydWUnKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgaWYgKHJhdyA9PT0gJzAnIHx8IHJhdyA9PT0gJ2ZhbHNlJykgcmV0dXJuIGZhbHNlO1xyXG4gICAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xyXG4gICAgfVxyXG4gIH07XHJcbiAgY29uc3QgbG9hZFN0YWdlU2V0ID0gKGtleSwgZGVmYXVsdFN0YWdlcykgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmF3ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KTtcclxuICAgICAgaWYgKCFyYXcpIHJldHVybiBuZXcgU2V0KGRlZmF1bHRTdGFnZXMpO1xyXG4gICAgICBjb25zdCBwYXJ0cyA9IFN0cmluZyhyYXcpXHJcbiAgICAgICAgLnNwbGl0KCcsJylcclxuICAgICAgICAubWFwKHMgPT4gU3RyaW5nKHMgfHwgJycpLnRyaW0oKS50b1VwcGVyQ2FzZSgpKVxyXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICAgIGNvbnN0IGZpbHRlcmVkID0gcGFydHMuZmlsdGVyKHMgPT4gU1RBR0VfVE9HR0xFX0tFWVMuaW5jbHVkZXMocykpO1xyXG4gICAgICByZXR1cm4gbmV3IFNldChmaWx0ZXJlZC5sZW5ndGggPyBmaWx0ZXJlZCA6IGRlZmF1bHRTdGFnZXMpO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICByZXR1cm4gbmV3IFNldChkZWZhdWx0U3RhZ2VzKTtcclxuICAgIH1cclxuICB9O1xyXG4gIGNvbnN0IHRvZ2dsZVN0YWdlSW5TZXQgPSAoc2V0U3RhdGUsIHN0YWdlS2V5KSA9PiB7XHJcbiAgICBzZXRTdGF0ZShwcmV2ID0+IHtcclxuICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldiB8fCBbXSk7XHJcbiAgICAgIGNvbnN0IGsgPSBTdHJpbmcoc3RhZ2VLZXkgfHwgJycpLnRyaW0oKS50b1VwcGVyQ2FzZSgpO1xyXG4gICAgICBpZiAoIWspIHJldHVybiBuZXh0O1xyXG4gICAgICBpZiAobmV4dC5oYXMoaykpIG5leHQuZGVsZXRlKGspO1xyXG4gICAgICBlbHNlIG5leHQuYWRkKGspO1xyXG4gICAgICByZXR1cm4gbmV4dDtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIC8vIGRlZmF1bHQgdGhlc2UgdG8gZmFsc2UgKHVuY2hlY2tlZCkgcGVyIFVYIHJlcXVlc3RcclxuICBjb25zdCBbc2hvd0xldHRlck5vLCBzZXRTaG93TGV0dGVyTm9dID0gdXNlU3RhdGUoKCkgPT4gbG9hZEJvb2woJ3JlcGxheWZpbGUyOnNob3dMZXR0ZXJObycsIGZhbHNlKSk7XHJcbiAgY29uc3QgW3Nob3dDcmVhdG9yTmFtZSwgc2V0U2hvd0NyZWF0b3JOYW1lXSA9IHVzZVN0YXRlKCgpID0+IGxvYWRCb29sKCdyZXBsYXlmaWxlMjpzaG93Q3JlYXRvck5hbWUnLCBmYWxzZSkpO1xyXG4gIC8vIGFsbG93IG1hbnVhbCB0ZXh0YXJlYSByZXNpemUgd2hlbiBlbmFibGVkIGluIHNldHRpbmdzXHJcbiAgY29uc3QgW21hbnVhbFJlc2l6ZUVuYWJsZWQsIHNldE1hbnVhbFJlc2l6ZUVuYWJsZWRdID0gdXNlU3RhdGUoKCkgPT4gbG9hZEJvb2woJ3JlcGxheWZpbGUyOm1hbnVhbFJlc2l6ZScsIGZhbHNlKSk7XHJcbiAgLy8gRGVmYXVsdCB0byBoaWRkZW4gZm9yIERvQXQgLyBTaWduYXR1cmUgLyBOYW1lIHN0YWdlIGNvbHVtbnNcclxuICBjb25zdCBbc2hvd0RvQXRTdGFnZXMsIHNldFNob3dEb0F0U3RhZ2VzXSA9IHVzZVN0YXRlKCgpID0+IGxvYWRTdGFnZVNldCgncmVwbGF5ZmlsZTI6c2hvd0RvQXRTdGFnZXMnLCBbXSkpO1xyXG4gIGNvbnN0IFtzaG93U2lnbmF0dXJlU3RhZ2VzLCBzZXRTaG93U2lnbmF0dXJlU3RhZ2VzXSA9IHVzZVN0YXRlKCgpID0+IGxvYWRTdGFnZVNldCgncmVwbGF5ZmlsZTI6c2hvd1NpZ25hdHVyZVN0YWdlcycsIFtdKSk7XHJcbiAgY29uc3QgW3Nob3dOYW1lU3RhZ2VzLCBzZXRTaG93TmFtZVN0YWdlc10gPSB1c2VTdGF0ZSgoKSA9PiBsb2FkU3RhZ2VTZXQoJ3JlcGxheWZpbGUyOnNob3dOYW1lU3RhZ2VzJywgW10pKTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIHRyeSB7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdyZXBsYXlmaWxlMjpzaG93TGV0dGVyTm8nLCBzaG93TGV0dGVyTm8gPyAnMScgOiAnMCcpOyB9IGNhdGNoIChlKSB7fVxyXG4gIH0sIFtzaG93TGV0dGVyTm9dKTtcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgdHJ5IHsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3JlcGxheWZpbGUyOnNob3dDcmVhdG9yTmFtZScsIHNob3dDcmVhdG9yTmFtZSA/ICcxJyA6ICcwJyk7IH0gY2F0Y2ggKGUpIHt9XHJcbiAgfSwgW3Nob3dDcmVhdG9yTmFtZV0pO1xyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICB0cnkgeyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncmVwbGF5ZmlsZTI6c2hvd0RvQXRTdGFnZXMnLCBBcnJheS5mcm9tKHNob3dEb0F0U3RhZ2VzIHx8IFtdKS5qb2luKCcsJykpOyB9IGNhdGNoIChlKSB7fVxyXG4gIH0sIFtzaG93RG9BdFN0YWdlc10pO1xyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICB0cnkgeyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncmVwbGF5ZmlsZTI6c2hvd1NpZ25hdHVyZVN0YWdlcycsIEFycmF5LmZyb20oc2hvd1NpZ25hdHVyZVN0YWdlcyB8fCBbXSkuam9pbignLCcpKTsgfSBjYXRjaCAoZSkge31cclxuICB9LCBbc2hvd1NpZ25hdHVyZVN0YWdlc10pO1xyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICB0cnkgeyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncmVwbGF5ZmlsZTI6c2hvd05hbWVTdGFnZXMnLCBBcnJheS5mcm9tKHNob3dOYW1lU3RhZ2VzIHx8IFtdKS5qb2luKCcsJykpOyB9IGNhdGNoIChlKSB7fVxyXG4gIH0sIFtzaG93TmFtZVN0YWdlc10pO1xyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgdHJ5IHsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3JlcGxheWZpbGUyOm1hbnVhbFJlc2l6ZScsIG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnMScgOiAnMCcpOyB9IGNhdGNoIChlKSB7fVxyXG4gIH0sIFttYW51YWxSZXNpemVFbmFibGVkXSk7XHJcblxyXG4gIC8vIElmIHRoZSB1c2VyIGhhc24ndCBzZWxlY3RlZCBhbnkgdG9nZ2xlcyB5ZXQsIHRyZWF0IGZlYXR1cmVzIGFzIHZpc2libGUgYnkgZGVmYXVsdFxyXG4gIGNvbnN0IGFueVRvZ2dsZVNlbGVjdGVkID0gdXNlTWVtbygoKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBPbmx5IGNvbnNpZGVyIHBlci1zdGFnZSB0b2dnbGVzIGZvciB0aGUgXCJhbnkgdG9nZ2xlIHNlbGVjdGVkXCIgZmxhZy5cclxuICAgICAgLy8gVG9nZ2xpbmcgTGV0dGVyTm8gb3IgQ3JlYXRvck5hbWUgc2hvdWxkIG5vdCBmbGlwIHN0YWdlLWRlZmF1bHQgYmVoYXZpb3VyLlxyXG4gICAgICBpZiAoc2hvd0RvQXRTdGFnZXMgJiYgc2hvd0RvQXRTdGFnZXMuc2l6ZSA+IDApIHJldHVybiB0cnVlO1xyXG4gICAgICBpZiAoc2hvd1NpZ25hdHVyZVN0YWdlcyAmJiBzaG93U2lnbmF0dXJlU3RhZ2VzLnNpemUgPiAwKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgaWYgKHNob3dOYW1lU3RhZ2VzICYmIHNob3dOYW1lU3RhZ2VzLnNpemUgPiAwKSByZXR1cm4gdHJ1ZTtcclxuICAgIH0gY2F0Y2ggKGUpIHt9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfSwgW3Nob3dMZXR0ZXJObywgc2hvd0NyZWF0b3JOYW1lLCBzaG93RG9BdFN0YWdlcywgc2hvd1NpZ25hdHVyZVN0YWdlcywgc2hvd05hbWVTdGFnZXNdKTtcclxuXHJcbiAgLy8gRG8gbm90IGF1dG8tc2hvdyBmaWVsZHMgd2hlbiBub3RoaW5nIGlzIGV4cGxpY2l0bHkgdG9nZ2xlZC4gQWxsIGRpc3BsYXlcclxuICAvLyB0b2dnbGVzIGRlZmF1bHQgdG8gdW5jaGVja2VkIGFuZCBtdXN0IGJlIHNldCBieSB0aGUgdXNlci5cclxuICBjb25zdCBlZmZlY3RpdmVTaG93TGV0dGVyTm8gPSB1c2VNZW1vKCgpID0+ICEhc2hvd0xldHRlck5vLCBbc2hvd0xldHRlck5vXSk7XHJcbiAgY29uc3QgZWZmZWN0aXZlU2hvd0NyZWF0b3JOYW1lID0gdXNlTWVtbygoKSA9PiAhIXNob3dDcmVhdG9yTmFtZSwgW3Nob3dDcmVhdG9yTmFtZV0pO1xyXG4gIGNvbnN0IGVmZmVjdGl2ZVNob3dEb0F0ID0gdXNlQ2FsbGJhY2soKHN0YWdlS2V5KSA9PiB7XHJcbiAgICB0cnkgeyByZXR1cm4gQm9vbGVhbihzaG93RG9BdFN0YWdlcyAmJiBzaG93RG9BdFN0YWdlcy5oYXMoc3RhZ2VLZXkpKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gZmFsc2U7IH1cclxuICB9LCBbc2hvd0RvQXRTdGFnZXNdKTtcclxuICBjb25zdCBlZmZlY3RpdmVTaG93U2lnbmF0dXJlID0gdXNlQ2FsbGJhY2soKHN0YWdlS2V5KSA9PiB7XHJcbiAgICB0cnkgeyByZXR1cm4gQm9vbGVhbihzaG93U2lnbmF0dXJlU3RhZ2VzICYmIHNob3dTaWduYXR1cmVTdGFnZXMuaGFzKHN0YWdlS2V5KSk7IH0gY2F0Y2ggKGUpIHsgcmV0dXJuIGZhbHNlOyB9XHJcbiAgfSwgW3Nob3dTaWduYXR1cmVTdGFnZXNdKTtcclxuICBjb25zdCBlZmZlY3RpdmVTaG93TmFtZSA9IHVzZUNhbGxiYWNrKChzdGFnZUtleSkgPT4ge1xyXG4gICAgdHJ5IHsgcmV0dXJuIEJvb2xlYW4oc2hvd05hbWVTdGFnZXMgJiYgc2hvd05hbWVTdGFnZXMuaGFzKHN0YWdlS2V5KSk7IH0gY2F0Y2ggKGUpIHsgcmV0dXJuIGZhbHNlOyB9XHJcbiAgfSwgW3Nob3dOYW1lU3RhZ2VzXSk7XHJcblxyXG4gIC8vIE1pZ3JhdGlvbi9pbml0aWFsaXphdGlvbjogY2xlYXIgbGVnYWN5IGByZXBsYXlmaWxlOmAga2V5cyBhbmQgZW5zdXJlXHJcbiAgLy8gYHJlcGxheWZpbGUyOmAga2V5cyBleGlzdCAoZW1wdHkpIHNvIG5ldyBkZWZhdWx0cyAodW5jaGVja2VkKSBhcHBseVxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBsZWdhY3lLZXlzID0gWydyZXBsYXlmaWxlOnNob3dEb0F0U3RhZ2VzJywgJ3JlcGxheWZpbGU6c2hvd1NpZ25hdHVyZVN0YWdlcycsICdyZXBsYXlmaWxlOnNob3dOYW1lU3RhZ2VzJywgJ3JlcGxheWZpbGU6c2hvd0xldHRlck5vJywgJ3JlcGxheWZpbGU6c2hvd0NyZWF0b3JOYW1lJ107XHJcbiAgICAgIGxlZ2FjeUtleXMuZm9yRWFjaChrID0+IHsgdHJ5IHsgaWYgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGspICE9PSBudWxsKSBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrKTsgfSBjYXRjaCAoZSkge30gfSk7XHJcblxyXG4gICAgICBjb25zdCB0YXJnZXRzID0gWydyZXBsYXlmaWxlMjpzaG93RG9BdFN0YWdlcycsICdyZXBsYXlmaWxlMjpzaG93U2lnbmF0dXJlU3RhZ2VzJywgJ3JlcGxheWZpbGUyOnNob3dOYW1lU3RhZ2VzJ107XHJcbiAgICAgIHRhcmdldHMuZm9yRWFjaChrID0+IHsgdHJ5IHsgaWYgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGspID09PSBudWxsKSBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrLCAnJyk7IH0gY2F0Y2ggKGUpIHt9IH0pO1xyXG5cclxuICAgICAgLy8gZW5zdXJlIHRoZSBzaW1wbGUgYm9vbGVhbiBrZXlzIGV4aXN0IHRvb1xyXG4gICAgICB0cnkgeyBpZiAobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3JlcGxheWZpbGUyOnNob3dMZXR0ZXJObycpID09PSBudWxsKSBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncmVwbGF5ZmlsZTI6c2hvd0xldHRlck5vJywgJzAnKTsgfSBjYXRjaCAoZSkge31cclxuICAgICAgdHJ5IHsgaWYgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdyZXBsYXlmaWxlMjpzaG93Q3JlYXRvck5hbWUnKSA9PT0gbnVsbCkgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3JlcGxheWZpbGUyOnNob3dDcmVhdG9yTmFtZScsICcwJyk7IH0gY2F0Y2ggKGUpIHt9XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIC8vIGlnbm9yZSBzdG9yYWdlIGVycm9yc1xyXG4gICAgfVxyXG4gIH0sIFtdKTtcclxuXHJcbiAgLy8gRW5zdXJlIEN0cmwrUCAoYnJvd3NlciBwcmludCBwcmV2aWV3KSBzaG93cyB0aGUgc2hlZXQgYnkgY2xvbmluZyBpdCBpbnRvXHJcbiAgLy8gYSBzYW1lLW9yaWdpbiBpZnJhbWUgcmlnaHQgYmVmb3JlIHByaW50aW5nLCBhbmQgcmVtb3ZpbmcgaXQgYWZ0ZXIuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IG9uQmVmb3JlUHJpbnQgPSAoKSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVwbGF5LXByaW50LWlmcmFtZScpO1xyXG4gICAgICAgIGlmIChleGlzdGluZyAmJiBleGlzdGluZy5wYXJlbnROb2RlKSBleGlzdGluZy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGV4aXN0aW5nKTtcclxuICAgICAgICBjb25zdCBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zaGVldCcpO1xyXG4gICAgICAgIGlmICghZWwpIHJldHVybjtcclxuXHJcbiAgICAgICAgY29uc3QgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XHJcbiAgICAgICAgaWZyYW1lLmlkID0gJ3JlcGxheS1wcmludC1pZnJhbWUnO1xyXG4gICAgICAgIGlmcmFtZS5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XHJcbiAgICAgICAgaWZyYW1lLnN0eWxlLmxlZnQgPSAnNTAlJztcclxuICAgICAgICBpZnJhbWUuc3R5bGUudG9wID0gJzUwJSc7XHJcbiAgICAgICAgaWZyYW1lLnN0eWxlLnRyYW5zZm9ybSA9ICd0cmFuc2xhdGUoLTUwJSwgLTUwJSknO1xyXG4gICAgICAgIGlmcmFtZS5zdHlsZS53aWR0aCA9ICcyMTBtbSc7XHJcbiAgICAgICAgaWZyYW1lLnN0eWxlLmhlaWdodCA9ICcyOTdtbSc7XHJcbiAgICAgICAgaWZyYW1lLnN0eWxlLmJvcmRlciA9ICcwJztcclxuICAgICAgICBpZnJhbWUuc3R5bGUuekluZGV4ID0gJzIxNDc0ODM2NDYnO1xyXG4gICAgICAgIGlmcmFtZS5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XHJcbiAgICAgICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nLCAndHJ1ZScpO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcclxuXHJcbiAgICAgICAgY29uc3QgaWRvYyA9IGlmcmFtZS5jb250ZW50RG9jdW1lbnQgfHwgaWZyYW1lLmNvbnRlbnRXaW5kb3cuZG9jdW1lbnQ7XHJcbiAgICAgICAgaWRvYy5vcGVuKCk7XHJcbiAgICAgICAgLy8gY29weSBzdHlsZXNcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdsaW5rW3JlbD1cInN0eWxlc2hlZXRcIl0sIHN0eWxlJykpLmZvckVhY2gobiA9PiB7XHJcbiAgICAgICAgICAgIHRyeSB7IGlkb2MuaGVhZC5hcHBlbmRDaGlsZChuLmNsb25lTm9kZSh0cnVlKSk7IH0gY2F0Y2ggKGUpIHt9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7fVxyXG5cclxuICAgICAgICAvLyBhZGQgYSBwcmludC1vbmx5IHJ1bGUgdG8gaGlkZSBldmVyeXRoaW5nIGV4Y2VwdCB0aGUgaWZyYW1lXHJcbiAgICAgICAgY29uc3QgaGlkZVN0eWxlID0gaWRvYy5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xyXG4gICAgICAgIGhpZGVTdHlsZS50eXBlID0gJ3RleHQvY3NzJztcclxuICAgICAgICBoaWRlU3R5bGUuYXBwZW5kQ2hpbGQoaWRvYy5jcmVhdGVUZXh0Tm9kZShgXHJcbiAgICAgICAgICBAbWVkaWEgcHJpbnQge1xyXG4gICAgICAgICAgICBib2R5ID4gKjpub3QoI3JlcGxheS1wcmludC1pZnJhbWUpIHsgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50OyB9XHJcbiAgICAgICAgICAgICNyZXBsYXktcHJpbnQtaWZyYW1lIHsgdmlzaWJpbGl0eTogdmlzaWJsZSAhaW1wb3J0YW50OyBwb3NpdGlvbjogc3RhdGljICFpbXBvcnRhbnQ7IHRyYW5zZm9ybTogbm9uZSAhaW1wb3J0YW50OyB3aWR0aDogMjEwbW0gIWltcG9ydGFudDsgaGVpZ2h0OiAyOTdtbSAhaW1wb3J0YW50OyB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgYCkpO1xyXG4gICAgICAgIGlkb2MuaGVhZC5hcHBlbmRDaGlsZChoaWRlU3R5bGUpO1xyXG5cclxuICAgICAgICAvLyBjbG9uZSBzaGVldFxyXG4gICAgICAgIHRyeSB7IGlkb2MuYm9keS5hcHBlbmRDaGlsZChlbC5jbG9uZU5vZGUodHJ1ZSkpOyB9IGNhdGNoIChlKSB7fVxyXG4gICAgICAgIGlkb2MuY2xvc2UoKTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnNvbGUud2Fybignb25CZWZvcmVQcmludCBlcnJvcicsIGUpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IG9uQWZ0ZXJQcmludCA9ICgpID0+IHtcclxuICAgICAgdHJ5IHsgY29uc3QgaWZyYW1lID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlcGxheS1wcmludC1pZnJhbWUnKTsgaWYgKGlmcmFtZSAmJiBpZnJhbWUucGFyZW50Tm9kZSkgaWZyYW1lLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoaWZyYW1lKTsgfSBjYXRjaCAoZSkge31cclxuICAgIH07XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXByaW50Jywgb25CZWZvcmVQcmludCk7XHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYWZ0ZXJwcmludCcsIG9uQWZ0ZXJQcmludCk7XHJcbiAgICByZXR1cm4gKCkgPT4geyB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignYmVmb3JlcHJpbnQnLCBvbkJlZm9yZVByaW50KTsgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2FmdGVycHJpbnQnLCBvbkFmdGVyUHJpbnQpOyBvbkFmdGVyUHJpbnQoKTsgfTtcclxuICB9LCBbbWV0YSwgdWlGb250U2l6ZSwgdWlMaW5lSGVpZ2h0LCB1aVBhZGRpbmdUb3BdKTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIHNldExlZnRDb250ZW50KGZpcnN0Q291cnNlMU5vdGUobWV0YSkgfHwgJycpO1xyXG4gICAgc2V0UzFDb250ZW50KChtZXRhICYmIG1ldGEuQ291cnNlMU5vdGUpIHx8ICcnKTtcclxuICAgIHNldENlbnRlckNvbnRlbnQoKG1ldGEgJiYgbWV0YS5jZW50ZXJOb3RlKSB8fCAnJyk7XHJcbiAgICBzZXRSaWdodENvbnRlbnQoKG1ldGEgJiYgbWV0YS5yaWdodE5vdGUpIHx8ICcnKTtcclxuICAgIHNldERlcHRDb250ZW50KChtZXRhICYmIG1ldGEuQ291cnNlMk5vdGUpIHx8ICcnKTtcclxuICAgIHNldENvbnRlbnQzKChtZXRhICYmIG1ldGEuQ291cnNlM05vdGUpIHx8ICcnKTtcclxuICAgIHNldENvbnRlbnQ0KChtZXRhICYmIG1ldGEuQ291cnNlNE5vdGUpIHx8ICcnKTtcclxuICAgIHNldENvbnRlbnQ1KChtZXRhICYmIG1ldGEuQ291cnNlNU5vdGUpIHx8ICcnKTtcclxuICAgIHNldERlcHV0eUNvbnRlbnQoKG1ldGEgJiYgbWV0YS5Db3Vyc2UzTm90ZSkgfHwgJycpO1xyXG4gICAgc2V0RGVwdXR5UmlnaHRDb250ZW50KChtZXRhICYmIG1ldGEuQ291cnNlNE5vdGUpIHx8ICcnKTtcclxuICAgIHNldEhlYWRPZmZpY2VDb250ZW50KChtZXRhICYmIG1ldGEuQ291cnNlNk5vdGUpIHx8ICcnKTtcclxuICAgIHNldERpcmVjdG9yQ29udGVudCgobWV0YSAmJiBtZXRhLkNvdXJzZTVOb3RlKSB8fCAnJyk7XHJcbiAgICAvLyBza2lwIGF1dG9zYXZlIGZvciB0aGUgaW5pdGlhbCBwb3B1bGF0aW9uXHJcbiAgICBpbml0aWFsTG9hZC5jdXJyZW50ID0gZmFsc2U7XHJcbiAgICAvLyBzZXQgY2FwdHVyZWQgZGF0ZSBmcm9tIHJlY29yZCBpZiBhdmFpbGFibGVcclxuICAgIGlmIChyZWNvcmQgJiYgcmVjb3JkLmRhdGUpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCByYXdEYXRlU3RyID0gcmVjb3JkLmRhdGU7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gbmV3IERhdGUocmF3RGF0ZVN0cik7XHJcbiAgICAgICAgLy8gRGV0ZWN0IGRhdGUtb25seSBzdHJpbmdzIHRoYXQgdXNlIG1pZG5pZ2h0IG9yIFVUQyBtYXJrZXIgKGUuZy4gXCJUMDA6MDA6MDBaXCIgb3IgXCIrMDA6MDBcIikuXHJcbiAgICAgICAgbGV0IGlzRGF0ZU9ubHkgPSBmYWxzZTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKHR5cGVvZiByYXdEYXRlU3RyID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICBpZiAoL1QwMDowMDowMCg/OlxcLjAwMCk/KD86WnxcXCswMDowMCk/JC8udGVzdChyYXdEYXRlU3RyKSkgaXNEYXRlT25seSA9IHRydWU7XHJcbiAgICAgICAgICAgIGlmICgvXlxcZHs0fS1cXGR7Mn0tXFxkezJ9JC8udGVzdChyYXdEYXRlU3RyKSkgaXNEYXRlT25seSA9IHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge31cclxuXHJcbiAgICAgICAgaWYgKGlzRGF0ZU9ubHkgfHwgKHBhcnNlZC5nZXRIb3VycyAmJiBwYXJzZWQuZ2V0SG91cnMoKSA9PT0gMCAmJiBwYXJzZWQuZ2V0TWludXRlcyAmJiBwYXJzZWQuZ2V0TWludXRlcygpID09PSAwKSkge1xyXG4gICAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcclxuICAgICAgICAgIHBhcnNlZC5zZXRIb3Vycyhub3cuZ2V0SG91cnMoKSwgbm93LmdldE1pbnV0ZXMoKSwgbm93LmdldFNlY29uZHMoKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNldENhcHR1cmVkRGF0ZShwYXJzZWQpO1xyXG4gICAgICAgIC8vIElmIG1ldGEgaGFzIGEgcGVyLWNvdXJzZSBzYXZlZCBkYXRlIChlLmcuIENvdXJzZTNEYXRlIGZvciBkZXB1dHkpLCBwcmVmZXIgaXRcclxuICAgICAgICBpZiAobWV0YSAmJiBtZXRhLkNvdXJzZTNEYXRlKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByYXdNID0gbWV0YS5Db3Vyc2UzRGF0ZTtcclxuICAgICAgICAgICAgY29uc3QgbSA9IG5ldyBEYXRlKHJhd00pO1xyXG4gICAgICAgICAgICBsZXQgaXNNZXRhRGF0ZU9ubHkgPSBmYWxzZTtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBpZiAodHlwZW9mIHJhd00gPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoL1QwMDowMDowMCg/OlxcLjAwMCk/KD86WnxcXCswMDowMCk/JC8udGVzdChyYXdNKSkgaXNNZXRhRGF0ZU9ubHkgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgaWYgKC9eXFxkezR9LVxcZHsyfS1cXGR7Mn0kLy50ZXN0KHJhd00pKSBpc01ldGFEYXRlT25seSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7fVxyXG4gICAgICAgICAgICBpZiAoaXNNZXRhRGF0ZU9ubHkgfHwgKG0uZ2V0SG91cnMgJiYgbS5nZXRIb3VycygpID09PSAwICYmIG0uZ2V0TWludXRlcyAmJiBtLmdldE1pbnV0ZXMoKSA9PT0gMCkpIHtcclxuICAgICAgICAgICAgICBjb25zdCBub3cyID0gbmV3IERhdGUoKTtcclxuICAgICAgICAgICAgICBtLnNldEhvdXJzKG5vdzIuZ2V0SG91cnMoKSwgbm93Mi5nZXRNaW51dGVzKCksIG5vdzIuZ2V0U2Vjb25kcygpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBzZXRDYXB0dXJlZERhdGUobSk7XHJcbiAgICAgICAgICB9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSAqLyB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgc2V0Q2FwdHVyZWREYXRlKG5ldyBEYXRlKCkpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzZXRDYXB0dXJlZERhdGUobmV3IERhdGUoKSk7XHJcbiAgICB9XHJcbiAgfSwgW3JlY29yZF0pO1xyXG5cclxuICAvLyBJZiBgcmVjb3JkLmNyZWF0ZWRCeWAgaXMgYSBzY2FsYXIgaWQgYW5kIG5vdCBwcmVzZW50IGluIHNpZ25hdHVyZXNNYXAsXHJcbiAgLy8gYXR0ZW1wdCB0byBmZXRjaCB0aGF0IHNpbmdsZSBzaWduYXR1cmUgc28gd2UgY2FuIHNob3cgdGhlIGNyZWF0b3IncyBuYW1lLlxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBsZXQgbW91bnRlZCA9IHRydWU7XHJcbiAgICAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IGNiID0gcmVjb3JkICYmIHJlY29yZC5jcmVhdGVkQnk7XHJcbiAgICAgICAgaWYgKCFjYiB8fCB0eXBlb2YgY2IgPT09ICdvYmplY3QnKSByZXR1cm47XHJcbiAgICAgICAgaWYgKHNpZ25hdHVyZXNNYXAgJiYgc2lnbmF0dXJlc01hcFtjYl0pIHJldHVybjsgLy8gYWxyZWFkeSBoYXZlIGl0XHJcbiAgICAgICAgLy8gdHJ5IHRvIGZldGNoIGEgc2lnbmF0dXJlIGJ5IGlkXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGFwaS5nZXQoYC9zaWduYXR1cmVzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KGNiKX1gKTtcclxuICAgICAgICAgIGNvbnN0IHNpZyA9IHJlcyAmJiByZXMuZGF0YTtcclxuICAgICAgICAgIGlmIChtb3VudGVkICYmIHNpZykge1xyXG4gICAgICAgICAgICBzZXRTaWduYXR1cmVzTWFwKHByZXYgPT4gKHsgLi4uKHByZXYgfHwge30pLCBbY2JdOiBzaWcgfSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgIC8vIGlnbm9yZSDigJQgbm90IGFsbCBjcmVhdGVkQnkgdmFsdWVzIG1hcCB0byBzaWduYXR1cmVzXHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlKSB7fVxyXG4gICAgfSkoKTtcclxuICAgIHJldHVybiAoKSA9PiB7IG1vdW50ZWQgPSBmYWxzZTsgfTtcclxuICB9LCBbcmVjb3JkICYmIHJlY29yZC5jcmVhdGVkQnksIHNpZ25hdHVyZXNNYXBdKTtcclxuXHJcbiAgLy8gZ2F0aGVyIGNhbmRpZGF0ZSByZWZlcmVuY2UgYXR0YWNobWVudHMvVVJMcyBmcm9tIHRoZSByZWNvcmRcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFyZWNvcmQpIHsgc2V0UmVmVXJscyhbXSk7IHNldFNlbGVjdGVkUmVmKG51bGwpOyByZXR1cm47IH1cclxuXHJcbiAgICBjb25zdCBpdGVtcyA9IFtdO1xyXG4gICAgY29uc3QgcHVzaCA9IChuYW1lLCBhKSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgaWYgKCFhICYmIGEgIT09IDApIHJldHVybjtcclxuICAgICAgICBsZXQgdXJsID0gYXR0YWNobWVudFVybChhKTtcclxuICAgICAgICAvLyBpZiBhdHRhY2htZW50VXJsIGNvdWxkbid0IGJ1aWxkIGEgdXJsLCB0cnkgZmFsbGJhY2sgZm9yIHBsYWluIGZpbGVuYW1lc1xyXG4gICAgICAgIGlmICghdXJsKSB7XHJcbiAgICAgICAgICBjb25zdCBzID0gKHR5cGVvZiBhID09PSAnc3RyaW5nJykgPyBhIDogKGEgJiYgKGEubmFtZSB8fCBhLmZpbGVuYW1lIHx8IGEudXJsIHx8IGEuZmlsZVBhdGggfHwgYS5wYXRoKSk7XHJcbiAgICAgICAgICBpZiAocyAmJiBTdHJpbmcocykudHJpbSgpKSB7XHJcbiAgICAgICAgICAgIHVybCA9IGAke0FQSV9CQVNFLnJlcGxhY2UoL1xcLyskLywgJycpfS9VcGxvYWRzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KFN0cmluZyhzKS50cmltKCkpfWA7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdXJsKSByZXR1cm47XHJcbiAgICAgICAgaXRlbXMucHVzaCh7IG5hbWU6IG5hbWUgfHwgKHR5cGVvZiBhID09PSAnc3RyaW5nJyA/IGEgOiAoYSAmJiAoYS5uYW1lIHx8IGEuZmlsZW5hbWUgfHwgYS51cmwpKSApIHx8IHVybCwgdXJsIH0pO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgLy8gaWdub3JlXHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLy8gcHJpb3JpdGl6ZSBleHBsaWNpdCBhdHRhY2htZW50cy9maWxlcyBhcnJheXMgaWYgcHJlc2VudFxyXG4gICAgaWYgKHJlY29yZC5hdHRhY2htZW50cyAmJiBBcnJheS5pc0FycmF5KHJlY29yZC5hdHRhY2htZW50cykgJiYgcmVjb3JkLmF0dGFjaG1lbnRzLmxlbmd0aCkge1xyXG4gICAgICByZWNvcmQuYXR0YWNobWVudHMuZm9yRWFjaChhID0+IHB1c2goYS5uYW1lIHx8IGEuZmlsZW5hbWUgfHwgYS51cmwgfHwgYSwgYSkpO1xyXG4gICAgfVxyXG4gICAgaWYgKHJlY29yZC5maWxlcyAmJiBBcnJheS5pc0FycmF5KHJlY29yZC5maWxlcykgJiYgcmVjb3JkLmZpbGVzLmxlbmd0aCkge1xyXG4gICAgICByZWNvcmQuZmlsZXMuZm9yRWFjaChhID0+IHB1c2goYS5uYW1lIHx8IGEuZmlsZW5hbWUgfHwgYS51cmwgfHwgYSwgYSkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGNvbW1vbiBzaW5nbGUtdmFsdWUgZmllbGRzIChleHBsaWNpdCBtYXBwaW5nKVxyXG4gICAgY29uc3Qgc2luZ2xlRmllbGRzID0gWydmaWxlUGF0aCcsICdmaWxlJywgJ2F0dGFjaG1lbnQnLCAndXJsJywgJ2RvY3VtZW50JywgJ2xldHRlckZpbGUnLCAnZmlsZW5hbWUnLCAncmVmX3VybCcsICdyZWZlcmVuY2UnLCAnbGV0dGVyRmlsZVBhdGgnLCAnbGV0dGVyRmlsZVVybCddO1xyXG4gICAgc2luZ2xlRmllbGRzLmZvckVhY2goayA9PiB7XHJcbiAgICAgIGlmIChyZWNvcmRba10pIHB1c2goaywgcmVjb3JkW2tdKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGFsc28gY2hlY2sgbWV0YSBmb3IgYXR0YWNobWVudHNcclxuICAgIGlmIChyZWNvcmQubWV0YSAmJiB0eXBlb2YgcmVjb3JkLm1ldGEgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIGNvbnN0IG0gPSByZWNvcmQubWV0YTtcclxuICAgICAgaWYgKG0uYXR0YWNobWVudHMgJiYgQXJyYXkuaXNBcnJheShtLmF0dGFjaG1lbnRzKSkgbS5hdHRhY2htZW50cy5mb3JFYWNoKGEgPT4gcHVzaChhLm5hbWUgfHwgYS5maWxlbmFtZSB8fCBhLnVybCB8fCBhLCBhKSk7XHJcbiAgICAgIGlmIChtLmZpbGVzICYmIEFycmF5LmlzQXJyYXkobS5maWxlcykpIG0uZmlsZXMuZm9yRWFjaChhID0+IHB1c2goYS5uYW1lIHx8IGEuZmlsZW5hbWUgfHwgYS51cmwgfHwgYSwgYSkpO1xyXG4gICAgICBpZiAobS5maWxlKSBwdXNoKCdtZXRhLmZpbGUnLCBtLmZpbGUpO1xyXG4gICAgICBpZiAobS5yZWZfdXJsKSBwdXNoKCdtZXRhLnJlZl91cmwnLCBtLnJlZl91cmwpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGRlZXAgc2NhbiBmb3Igc3RyaW5ncyBvciBrZXlzIHRoYXQgbG9vayBsaWtlIHVwbG9hZHMsIHBkZnMgb3IgaW1hZ2VzXHJcbiAgICBjb25zdCB1cGxvYWRSZWdleCA9IC8odXBsb2Fkcz9cXC8uK1xcLihwZGZ8anBnfGpwZWd8cG5nfGdpZnxibXApKXwoXFwucGRmJCl8KFxcLihqcGd8anBlZ3xwbmd8Z2lmfGJtcCkkKXwoaHR0cHM/OlxcL1xcLykvaTtcclxuICAgIGNvbnN0IHNjYW4gPSAob2JqLCBkZXB0aCA9IDApID0+IHtcclxuICAgICAgaWYgKCFvYmogfHwgZGVwdGggPiA2KSByZXR1cm47XHJcbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIGNvbnN0IHMgPSBvYmoudHJpbSgpO1xyXG4gICAgICAgIGlmICghcykgcmV0dXJuO1xyXG4gICAgICAgIC8vIHRyeSB0byBjYXB0dXJlIGxpa2VseSBmaWxlIHN0cmluZ3NcclxuICAgICAgICBpZiAodXBsb2FkUmVnZXgudGVzdChzKSB8fCBzLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aCgnaHR0cCcpIHx8IHMudG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgnLnBkZicpIHx8IHMudG9Mb3dlckNhc2UoKS5tYXRjaCgvXFwuKGpwZ3xqcGVnfHBuZ3xnaWZ8Ym1wKSQvaS50ZXN0KHMpKSkge1xyXG4gICAgICAgICAgcHVzaChzLCBzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHJldHVybiBvYmouZm9yRWFjaChvID0+IHNjYW4obywgZGVwdGggKyAxKSk7XHJcbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIE9iamVjdC5rZXlzKG9iaikuZm9yRWFjaChrID0+IHtcclxuICAgICAgICAgIGNvbnN0IHYgPSBvYmpba107XHJcbiAgICAgICAgICAvLyBwcmVmZXIga2V5cyB0aGF0IG1lbnRpb24gZmlsZS9hdHRhY2gvdXBsb2FkL3VybC9wYXRoXHJcbiAgICAgICAgICBpZiAoL2ZpbGV8YXR0YWNofHVwbG9hZHx1cmx8cGF0aHxzcmN8ZG9jdW1lbnR8cGRmfGltYWdlfGZpbGVuYW1lL2kudGVzdChrKSkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09ICdzdHJpbmcnKSBwdXNoKGssIHYpO1xyXG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YgdiA9PT0gJ29iamVjdCcgJiYgKHYudXJsIHx8IHYuZmlsZVBhdGggfHwgdi5wYXRoIHx8IHYubmFtZSB8fCB2LmZpbGVuYW1lKSkge1xyXG4gICAgICAgICAgICAgIHB1c2godi5uYW1lIHx8IHYuZmlsZW5hbWUgfHwgdi51cmwgfHwgdi5maWxlUGF0aCB8fCB2LnBhdGgsIHYpO1xyXG4gICAgICAgICAgICB9IGVsc2Ugc2Nhbih2LCBkZXB0aCArIDEpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gc3RpbGwgc2NhbiBkZWVwZXIgZm9yIGFueSBzdHJpbmdzIHRoYXQgbWF0Y2hcclxuICAgICAgICAgICAgc2Nhbih2LCBkZXB0aCArIDEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgdHJ5IHsgc2NhbihyZWNvcmQpOyB9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSAqLyB9XHJcblxyXG4gICAgLy8gZGVkdXBlIGJ5IHVybFxyXG4gICAgY29uc3QgdW5pcSA9IFtdO1xyXG4gICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcclxuICAgIGZvciAoY29uc3QgaXQgb2YgaXRlbXMpIHtcclxuICAgICAgaWYgKCFpdCB8fCAhaXQudXJsKSBjb250aW51ZTtcclxuICAgICAgaWYgKHNlZW4uaGFzKGl0LnVybCkpIGNvbnRpbnVlO1xyXG4gICAgICBzZWVuLmFkZChpdC51cmwpO1xyXG4gICAgICB1bmlxLnB1c2goaXQpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGxvZyBmb3IgZGVidWdnaW5nXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zb2xlLmRlYnVnKCdSZXBsYXk6IGZvdW5kIGF0dGFjaG1lbnQgVVJMcycsIHVuaXEubWFwKHUgPT4gdS51cmwpKTtcclxuICAgIH0gY2F0Y2ggKGUpIHt9XHJcblxyXG4gICAgc2V0UmVmVXJscyh1bmlxKTtcclxuICAgIHNldFNlbGVjdGVkUmVmKHVuaXEubGVuZ3RoID8gdW5pcVswXS51cmwgOiBudWxsKTtcclxuICB9LCBbcmVjb3JkXSk7XHJcblxyXG4gIC8vIGV4cG9zZSByZWNvcmQgZm9yIGRlYnVnZ2luZyBpbiBkZXZ0b29scyBhbmQgbG9nIChvbmx5IGluIGJyb3dzZXIpXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gZXhwb3NlIGZvciBxdWljayBpbnNwZWN0aW9uIGluIGJyb3dzZXIgY29uc29sZVxyXG4gICAgICB3aW5kb3cuX19SRVBMQVlfUkVDT1JEID0gcmVjb3JkO1xyXG4gICAgICBjb25zb2xlLmRlYnVnKCdSZXBsYXkgcmVjb3JkIGZvciBkZWJ1Z2dpbmc6JywgcmVjb3JkKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgLy8gaWdub3JlIGluIHJlc3RyaWN0ZWQgZW52XHJcbiAgICB9XHJcbiAgfSwgW3JlY29yZF0pO1xyXG5cclxuICAvLyBoZWxwZXIgdG8gZXh0cmFjdCBhdHRhY2htZW50IGhpbnRzIGZvciBkZWJ1Z2dpbmcgZGlzcGxheVxyXG4gIGNvbnN0IGdldEF0dGFjaG1lbnRIaW50cyA9IChyKSA9PiB7XHJcbiAgICBpZiAoIXIpIHJldHVybiBbXTtcclxuICAgIGNvbnN0IGhpbnRzID0gW107XHJcbiAgICBjb25zdCBhZGQgPSAocGF0aCwgdmFsKSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgbGV0IHMgPSAnJztcclxuICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHMgPSB2YWw7XHJcbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ29iamVjdCcpIHMgPSBKU09OLnN0cmluZ2lmeSh2YWwpLnNsaWNlKDAsIDIwMCk7XHJcbiAgICAgICAgZWxzZSBzID0gU3RyaW5nKHZhbCk7XHJcbiAgICAgICAgaWYgKHMgJiYgKHMuaW5jbHVkZXMoJy9VcGxvYWRzLycpIHx8IHMudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnLnBkZicpIHx8IHMudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKCdodHRwJykgfHwgL1xcLihqcGd8anBlZ3xwbmd8Z2lmfGJtcCkkL2kudGVzdChzKSkpIHtcclxuICAgICAgICAgIGhpbnRzLnB1c2goeyBwYXRoLCBleGNlcnB0OiBzIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIC8vIGlnbm9yZVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgLy8gZmlyc3QtbGV2ZWxcclxuICAgIE9iamVjdC5rZXlzKHIgfHwge30pLmZvckVhY2goayA9PiBhZGQoaywgcltrXSkpO1xyXG4gICAgLy8gbWV0YVxyXG4gICAgaWYgKHIubWV0YSAmJiB0eXBlb2Ygci5tZXRhID09PSAnb2JqZWN0JykgT2JqZWN0LmtleXMoci5tZXRhKS5mb3JFYWNoKGsgPT4gYWRkKGBtZXRhLiR7a31gLCByLm1ldGFba10pKTtcclxuICAgIC8vIGF0dGFjaG1lbnRzL2ZpbGVzIGFycmF5cyAoZmlyc3QgMTApXHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShyLmF0dGFjaG1lbnRzKSkgci5hdHRhY2htZW50cy5zbGljZSgwLCAxMCkuZm9yRWFjaCgoYSwgaSkgPT4gYWRkKGBhdHRhY2htZW50c1ske2l9XWAsIGEpKTtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KHIuZmlsZXMpKSByLmZpbGVzLnNsaWNlKDAsIDEwKS5mb3JFYWNoKChhLCBpKSA9PiBhZGQoYGZpbGVzWyR7aX1dYCwgYSkpO1xyXG4gICAgcmV0dXJuIGhpbnRzO1xyXG4gIH07XHJcblxyXG4gIC8vIEF1dG9zYXZlIGxlZnRDb250ZW50IGFmdGVyIGEgZGVib3VuY2Ugd2hlbiB0aGUgdXNlciBlZGl0cy5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgLy8gY2xlYXIgcHJldmlvdXMgdGltZXJcclxuICAgIGlmIChhdXRvc2F2ZVRpbWVyLmN1cnJlbnQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KGF1dG9zYXZlVGltZXIuY3VycmVudCk7XHJcbiAgICAgIGF1dG9zYXZlVGltZXIuY3VycmVudCA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZG9uJ3QgYXV0b3NhdmUgdW50aWwgaW5pdGlhbCBwb3B1bGF0aW9uIGhhcyBoYXBwZW5lZFxyXG4gICAgaWYgKGluaXRpYWxMb2FkLmN1cnJlbnQpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG4gICAgLy8gaWYgdGhlcmUgaXMgbm8gcmVjb3JkIHlldCBvciBjb250ZW50IGVxdWFscyBzZXJ2ZXIgbWV0YSwgc2tpcFxyXG4gICAgaWYgKCFyZWNvcmQpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBzZXJ2ZXJOb3RlID0gKG1ldGEgJiYgbWV0YS5Db3Vyc2VOb3RlKSB8fCAnJztcclxuICAgIGlmICgobGVmdENvbnRlbnQgfHwgJycpID09PSAoc2VydmVyTm90ZSB8fCAnJykpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG4gICAgLy8gc2V0IGEgZGVib3VuY2UgdGltZXIgdG8gYXV0b3NhdmVcclxuICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6A4Z+G4Z6W4Z674Z6E4Z6a4Z6A4Z+S4Z6f4Z624Z6R4Z674Z6ALi4uJywgJ1MnKTtcclxuICAgIGF1dG9zYXZlVGltZXIuY3VycmVudCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAvLyBjYWxsIHNhdmVOb3RlICh3aWxsIHNldCBtZXNzYWdlcylcclxuICAgICAgc2F2ZU5vdGUoKTtcclxuICAgIH0sIDE1MDApO1xyXG5cclxuICAgIC8vIGNsZWFudXBcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGlmIChhdXRvc2F2ZVRpbWVyLmN1cnJlbnQpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQoYXV0b3NhdmVUaW1lci5jdXJyZW50KTtcclxuICAgICAgICBhdXRvc2F2ZVRpbWVyLmN1cnJlbnQgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0sIFtsZWZ0Q29udGVudF0pO1xyXG5cclxuICAvLyBBdXRvc2F2ZSBzMUNvbnRlbnQgKFN0YWdlIDEpIGFmdGVyIGEgZGVib3VuY2Ugd2hlbiB0aGUgUzEgdGV4dGFyZWEgZWRpdHMuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChhdXRvc2F2ZVRpbWVyLmN1cnJlbnQgJiYgdHlwZW9mIGF1dG9zYXZlVGltZXIuY3VycmVudCA9PT0gJ251bWJlcicpIHtcclxuICAgICAgLy8gcmV1c2UgYXV0b3NhdmVUaW1lciBmb3Igc2luZ2xlLWZpZWxkIGNhc2VzOyBjbGVhciBpZiBzZXRcclxuICAgICAgY2xlYXJUaW1lb3V0KGF1dG9zYXZlVGltZXIuY3VycmVudCk7XHJcbiAgICAgIGF1dG9zYXZlVGltZXIuY3VycmVudCA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZG9uJ3QgYXV0b3NhdmUgdW50aWwgaW5pdGlhbCBwb3B1bGF0aW9uIGhhcyBoYXBwZW5lZFxyXG4gICAgaWYgKGluaXRpYWxMb2FkLmN1cnJlbnQpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG4gICAgaWYgKCFyZWNvcmQpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBzZXJ2ZXJOb3RlID0gKG1ldGEgJiYgbWV0YS5Db3Vyc2UxTm90ZSkgfHwgJyc7XHJcbiAgICBpZiAoKHMxQ29udGVudCB8fCAnJykgPT09IChzZXJ2ZXJOb3RlIHx8ICcnKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcbiAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GegOGfhuGeluGeu+GehOGemuGegOGfkuGen+GetuGekeGeu+GegC4uLicsICdTMScpO1xyXG4gICAgYXV0b3NhdmVUaW1lci5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIHNhdmVTdGFnZU5vdGUoJ0NvdXJzZTFOb3RlJywgczFDb250ZW50IHx8ICcnKTtcclxuICAgIH0sIDE1MDApO1xyXG5cclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGlmIChhdXRvc2F2ZVRpbWVyLmN1cnJlbnQpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQoYXV0b3NhdmVUaW1lci5jdXJyZW50KTtcclxuICAgICAgICBhdXRvc2F2ZVRpbWVyLmN1cnJlbnQgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0sIFtzMUNvbnRlbnRdKTtcclxuXHJcbiAgLy8gQXV0b3NhdmUgZGVwdENvbnRlbnQgYWZ0ZXIgYSBkZWJvdW5jZSB3aGVuIHRoZSBkZXBhcnRtZW50IGhlYWQgZWRpdHMuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChhdXRvc2F2ZVRpbWVyRGVwdC5jdXJyZW50KSB7XHJcbiAgICAgIGNsZWFyVGltZW91dChhdXRvc2F2ZVRpbWVyRGVwdC5jdXJyZW50KTtcclxuICAgICAgYXV0b3NhdmVUaW1lckRlcHQuY3VycmVudCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZiAoaW5pdGlhbExvYWQuY3VycmVudCkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGlmICghcmVjb3JkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3Qgc2VydmVyTm90ZSA9IChtZXRhICYmIG1ldGEuQ291cnNlMk5vdGUpIHx8ICcnO1xyXG4gICAgaWYgKChkZXB0Q29udGVudCB8fCAnJykgPT09IChzZXJ2ZXJOb3RlIHx8ICcnKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6A4Z+G4Z6W4Z674Z6E4Z6a4Z6A4Z+S4Z6f4Z624Z6R4Z674Z6ALi4uJywgJ1MyJyk7XHJcbiAgICBhdXRvc2F2ZVRpbWVyRGVwdC5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIHNhdmVEZXB0Tm90ZSgpO1xyXG4gICAgfSwgMTUwMCk7XHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBpZiAoYXV0b3NhdmVUaW1lckRlcHQuY3VycmVudCkge1xyXG4gICAgICAgIGNsZWFyVGltZW91dChhdXRvc2F2ZVRpbWVyRGVwdC5jdXJyZW50KTtcclxuICAgICAgICBhdXRvc2F2ZVRpbWVyRGVwdC5jdXJyZW50ID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9LCBbZGVwdENvbnRlbnRdKTtcclxuXHJcbiAgLy8gQXV0b3NhdmUgZGVwdXR5Q29udGVudCBhZnRlciBhIGRlYm91bmNlIHdoZW4gdGhlIGRlcHV0eSBlZGl0cy5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKGF1dG9zYXZlVGltZXJEZXB1dHkuY3VycmVudCkge1xyXG4gICAgICBjbGVhclRpbWVvdXQoYXV0b3NhdmVUaW1lckRlcHV0eS5jdXJyZW50KTtcclxuICAgICAgYXV0b3NhdmVUaW1lckRlcHV0eS5jdXJyZW50ID0gbnVsbDtcclxuICAgIH1cclxuICAgIGlmIChpbml0aWFsTG9hZC5jdXJyZW50KSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgaWYgKCFyZWNvcmQpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBzZXJ2ZXJOb3RlID0gKG1ldGEgJiYgbWV0YS5Db3Vyc2UzTm90ZSkgfHwgJyc7XHJcbiAgICBpZiAoKGRlcHV0eUNvbnRlbnQgfHwgJycpID09PSAoc2VydmVyTm90ZSB8fCAnJykpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GegOGfhuGeluGeu+GehOGemuGegOGfkuGen+GetuGekeGeu+GegC4uLicsICdTMycpO1xyXG4gICAgYXV0b3NhdmVUaW1lckRlcHV0eS5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIHNhdmVDb3Vyc2UzTm90ZSgpO1xyXG4gICAgfSwgMTUwMCk7XHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBpZiAoYXV0b3NhdmVUaW1lckRlcHV0eS5jdXJyZW50KSB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KGF1dG9zYXZlVGltZXJEZXB1dHkuY3VycmVudCk7XHJcbiAgICAgICAgYXV0b3NhdmVUaW1lckRlcHV0eS5jdXJyZW50ID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9LCBbZGVwdXR5Q29udGVudF0pO1xyXG5cclxuICAvLyBBdXRvc2F2ZSBkZXB1dHlSaWdodENvbnRlbnQgYWZ0ZXIgYSBkZWJvdW5jZSB3aGVuIHRoZSByaWdodCBkZXB1dHkgZWRpdHMuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChhdXRvc2F2ZVRpbWVyRGVwdXR5UmlnaHQuY3VycmVudCkge1xyXG4gICAgICBjbGVhclRpbWVvdXQoYXV0b3NhdmVUaW1lckRlcHV0eVJpZ2h0LmN1cnJlbnQpO1xyXG4gICAgICBhdXRvc2F2ZVRpbWVyRGVwdXR5UmlnaHQuY3VycmVudCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZiAoaW5pdGlhbExvYWQuY3VycmVudCkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGlmICghcmVjb3JkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3Qgc2VydmVyTm90ZSA9IChtZXRhICYmIG1ldGEuQ291cnNlNE5vdGUpIHx8ICcnO1xyXG4gICAgaWYgKChkZXB1dHlSaWdodENvbnRlbnQgfHwgJycpID09PSAoc2VydmVyTm90ZSB8fCAnJykpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GegOGfhuGeluGeu+GehOGemuGegOGfkuGen+GetuGekeGeu+GegC4uLicsICdTNCcpO1xyXG4gICAgYXV0b3NhdmVUaW1lckRlcHV0eVJpZ2h0LmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgc2F2ZUNvdXJzZTROb3RlKCk7XHJcbiAgICB9LCAxNTAwKTtcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGlmIChhdXRvc2F2ZVRpbWVyRGVwdXR5UmlnaHQuY3VycmVudCkge1xyXG4gICAgICAgIGNsZWFyVGltZW91dChhdXRvc2F2ZVRpbWVyRGVwdXR5UmlnaHQuY3VycmVudCk7XHJcbiAgICAgICAgYXV0b3NhdmVUaW1lckRlcHV0eVJpZ2h0LmN1cnJlbnQgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0sIFtkZXB1dHlSaWdodENvbnRlbnRdKTtcclxuXHJcbiAgLy8gQXV0b3NhdmUgZGlyZWN0b3JDb250ZW50IGFmdGVyIGEgZGVib3VuY2Ugd2hlbiB0aGUgZGlyZWN0b3IgZWRpdHMuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChhdXRvc2F2ZVRpbWVyRGlyZWN0b3IuY3VycmVudCkge1xyXG4gICAgICBjbGVhclRpbWVvdXQoYXV0b3NhdmVUaW1lckRpcmVjdG9yLmN1cnJlbnQpO1xyXG4gICAgICBhdXRvc2F2ZVRpbWVyRGlyZWN0b3IuY3VycmVudCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZiAoaW5pdGlhbExvYWQuY3VycmVudCkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGlmICghcmVjb3JkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3Qgc2VydmVyTm90ZSA9IChtZXRhICYmIG1ldGEuQ291cnNlNU5vdGUpIHx8ICcnO1xyXG4gICAgaWYgKChkaXJlY3RvckNvbnRlbnQgfHwgJycpID09PSAoc2VydmVyTm90ZSB8fCAnJykpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GegOGfhuGeluGeu+GehOGemuGegOGfkuGen+GetuGekeGeu+GegC4uLicsICdTNScpO1xyXG4gICAgYXV0b3NhdmVUaW1lckRpcmVjdG9yLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgc2F2ZUNvdXJzZTVOb3RlKCk7XHJcbiAgICB9LCAxNTAwKTtcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGlmIChhdXRvc2F2ZVRpbWVyRGlyZWN0b3IuY3VycmVudCkge1xyXG4gICAgICAgIGNsZWFyVGltZW91dChhdXRvc2F2ZVRpbWVyRGlyZWN0b3IuY3VycmVudCk7XHJcbiAgICAgICAgYXV0b3NhdmVUaW1lckRpcmVjdG9yLmN1cnJlbnQgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0sIFtkaXJlY3RvckNvbnRlbnRdKTtcclxuXHJcbiAgLy8gQXV0b3NhdmUgaGVhZE9mZmljZUNvbnRlbnQgYWZ0ZXIgYSBkZWJvdW5jZSB3aGVuIHRoZSBoZWFkIG9mIG9mZmljZSBlZGl0cy5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKGF1dG9zYXZlVGltZXJIZWFkT2ZmaWNlLmN1cnJlbnQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KGF1dG9zYXZlVGltZXJIZWFkT2ZmaWNlLmN1cnJlbnQpO1xyXG4gICAgICBhdXRvc2F2ZVRpbWVySGVhZE9mZmljZS5jdXJyZW50ID0gbnVsbDtcclxuICAgIH1cclxuICAgIGlmIChpbml0aWFsTG9hZC5jdXJyZW50KSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgaWYgKCFyZWNvcmQpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBzZXJ2ZXJOb3RlID0gKG1ldGEgJiYgbWV0YS5Db3Vyc2U2Tm90ZSkgfHwgJyc7XHJcbiAgICBpZiAoKGhlYWRPZmZpY2VDb250ZW50IHx8ICcnKSA9PT0gKHNlcnZlck5vdGUgfHwgJycpKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgc2V0U3RhZ2VNZXNzYWdlKCfhnoDhn4bhnpbhnrvhnoThnprhnoDhn5Lhnp/hnrbhnpHhnrvhnoAuLi4nLCAnUzYnKTtcclxuICAgIGF1dG9zYXZlVGltZXJIZWFkT2ZmaWNlLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgc2F2ZUNvdXJzZTZOb3RlKCk7XHJcbiAgICB9LCAxNTAwKTtcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGlmIChhdXRvc2F2ZVRpbWVySGVhZE9mZmljZS5jdXJyZW50KSB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KGF1dG9zYXZlVGltZXJIZWFkT2ZmaWNlLmN1cnJlbnQpO1xyXG4gICAgICAgIGF1dG9zYXZlVGltZXJIZWFkT2ZmaWNlLmN1cnJlbnQgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0sIFtoZWFkT2ZmaWNlQ29udGVudF0pO1xyXG5cclxuICAvLyBBdXRvc2F2ZSBjb250ZW50My4uNlxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoYXV0b3NhdmVUaW1lcjMuY3VycmVudCkgeyBjbGVhclRpbWVvdXQoYXV0b3NhdmVUaW1lcjMuY3VycmVudCk7IGF1dG9zYXZlVGltZXIzLmN1cnJlbnQgPSBudWxsOyB9XHJcbiAgICBpZiAoaW5pdGlhbExvYWQuY3VycmVudCkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGlmICghcmVjb3JkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3Qgc2VydmVyTm90ZSA9IChtZXRhICYmIG1ldGEuQ291cnNlM05vdGUpIHx8ICcnO1xyXG4gICAgaWYgKChjb250ZW50MyB8fCAnJykgPT09IChzZXJ2ZXJOb3RlIHx8ICcnKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGF1dG9zYXZlVGltZXIzLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHsgc2F2ZVN0YWdlTm90ZSgnQ291cnNlM05vdGUnLCBjb250ZW50Myk7IH0sIDE1MDApO1xyXG4gICAgcmV0dXJuICgpID0+IHsgaWYgKGF1dG9zYXZlVGltZXIzLmN1cnJlbnQpIHsgY2xlYXJUaW1lb3V0KGF1dG9zYXZlVGltZXIzLmN1cnJlbnQpOyBhdXRvc2F2ZVRpbWVyMy5jdXJyZW50ID0gbnVsbDsgfSB9O1xyXG4gIH0sIFtjb250ZW50M10pO1xyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKGF1dG9zYXZlVGltZXI0LmN1cnJlbnQpIHsgY2xlYXJUaW1lb3V0KGF1dG9zYXZlVGltZXI0LmN1cnJlbnQpOyBhdXRvc2F2ZVRpbWVyNC5jdXJyZW50ID0gbnVsbDsgfVxyXG4gICAgaWYgKGluaXRpYWxMb2FkLmN1cnJlbnQpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBpZiAoIXJlY29yZCkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IHNlcnZlck5vdGUgPSAobWV0YSAmJiBtZXRhLkNvdXJzZTROb3RlKSB8fCAnJztcclxuICAgIGlmICgoY29udGVudDQgfHwgJycpID09PSAoc2VydmVyTm90ZSB8fCAnJykpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBhdXRvc2F2ZVRpbWVyNC5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7IHNhdmVTdGFnZU5vdGUoJ0NvdXJzZTROb3RlJywgY29udGVudDQpOyB9LCAxNTAwKTtcclxuICAgIHJldHVybiAoKSA9PiB7IGlmIChhdXRvc2F2ZVRpbWVyNC5jdXJyZW50KSB7IGNsZWFyVGltZW91dChhdXRvc2F2ZVRpbWVyNC5jdXJyZW50KTsgYXV0b3NhdmVUaW1lcjQuY3VycmVudCA9IG51bGw7IH0gfTtcclxuICB9LCBbY29udGVudDRdKTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChhdXRvc2F2ZVRpbWVyNS5jdXJyZW50KSB7IGNsZWFyVGltZW91dChhdXRvc2F2ZVRpbWVyNS5jdXJyZW50KTsgYXV0b3NhdmVUaW1lcjUuY3VycmVudCA9IG51bGw7IH1cclxuICAgIGlmIChpbml0aWFsTG9hZC5jdXJyZW50KSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgaWYgKCFyZWNvcmQpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBzZXJ2ZXJOb3RlID0gKG1ldGEgJiYgbWV0YS5Db3Vyc2U1Tm90ZSkgfHwgJyc7XHJcbiAgICBpZiAoKGNvbnRlbnQ1IHx8ICcnKSA9PT0gKHNlcnZlck5vdGUgfHwgJycpKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgYXV0b3NhdmVUaW1lcjUuY3VycmVudCA9IHNldFRpbWVvdXQoKCkgPT4geyBzYXZlU3RhZ2VOb3RlKCdDb3Vyc2U1Tm90ZScsIGNvbnRlbnQ1KTsgfSwgMTUwMCk7XHJcbiAgICByZXR1cm4gKCkgPT4geyBpZiAoYXV0b3NhdmVUaW1lcjUuY3VycmVudCkgeyBjbGVhclRpbWVvdXQoYXV0b3NhdmVUaW1lcjUuY3VycmVudCk7IGF1dG9zYXZlVGltZXI1LmN1cnJlbnQgPSBudWxsOyB9IH07XHJcbiAgfSwgW2NvbnRlbnQ1XSk7XHJcblxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICAvLyBDb3Vyc2U2IGlzIGhhbmRsZWQgYnkgSGVhZCBvZiBPZmZpY2UgKGBoZWFkT2ZmaWNlQ29udGVudGApIGF1dG9zYXZlXHJcbiAgfSwgW10pO1xyXG5cclxuICAvLyBBZGp1c3QgdGV4dGFyZWEgaGVpZ2h0IHRvIGZpdCBjb250ZW50IChhdXRvLXJlc2l6ZSkgZm9yIENvdXJzZU5vdGUgdGV4dGFyZWFcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKG1hbnVhbFJlc2l6ZUVuYWJsZWQpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBlbCA9IGNvdXJzZU5vdGVSZWYuY3VycmVudDtcclxuICAgIGlmICghZWwpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAvLyByZXNldCB0aGVuIHNldCB0byBzY3JvbGxIZWlnaHQgdG8gYWNjb21tb2RhdGUgc2hyaW5rICYgZ3Jvd1xyXG4gICAgZWwuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nO1xyXG4gICAgLy8ga2VlcCBhIHNtYWxsIG1pbmltdW0gc28gdGhlIHRleHRhcmVhIGluaXRpYWxseSBzaG93cyB+MSBsaW5lXHJcbiAgICBjb25zdCBNSU5fSCA9IDI0OyAvLyBweCB+IG9uZSBsaW5lXHJcbiAgICBjb25zdCBoID0gTWF0aC5tYXgoZWwuc2Nyb2xsSGVpZ2h0LCBNSU5fSCk7XHJcbiAgICBlbC5zdHlsZS5oZWlnaHQgPSBgJHtofXB4YDtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfSwgW2xlZnRDb250ZW50LCByZWNvcmQsIHVpRm9udFNpemUsIHVpTGluZUhlaWdodCwgdWlQYXJhQmVmb3JlLCB1aVBhcmFBZnRlcl0pO1xyXG5cclxuICAvLyBhdXRvc2l6ZSBmb3IgUzEgdGV4dGFyZWEgKFN0YWdlIDEpXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChtYW51YWxSZXNpemVFbmFibGVkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgZWwgPSBzMVRleHRhcmVhUmVmLmN1cnJlbnQ7XHJcbiAgICBpZiAoIWVsKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgZWwuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nO1xyXG4gICAgY29uc3QgTUlOX0ggPSAyNDtcclxuICAgIGNvbnN0IGggPSBNYXRoLm1heChlbC5zY3JvbGxIZWlnaHQsIE1JTl9IKTtcclxuICAgIGVsLnN0eWxlLmhlaWdodCA9IGAke2h9cHhgO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9LCBbczFDb250ZW50LCByZWNvcmQsIHVpRm9udFNpemUsIHVpTGluZUhlaWdodCwgdWlQYXJhQmVmb3JlLCB1aVBhcmFBZnRlcl0pO1xyXG5cclxuICAvLyBhdXRvc2l6ZSBmb3IgZGVwYXJ0bWVudCB0ZXh0YXJlYVxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAobWFudWFsUmVzaXplRW5hYmxlZCkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IGVsID0gZGVwdFRleHRhcmVhUmVmLmN1cnJlbnQ7XHJcbiAgICBpZiAoIWVsKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgZWwuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nO1xyXG4gICAgY29uc3QgTUlOX0hfRCA9IDI0O1xyXG4gICAgY29uc3QgaCA9IE1hdGgubWF4KGVsLnNjcm9sbEhlaWdodCwgTUlOX0hfRCk7XHJcbiAgICBlbC5zdHlsZS5oZWlnaHQgPSBgJHtofXB4YDtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfSwgW2RlcHRDb250ZW50LCByZWNvcmQsIHVpRm9udFNpemUsIHVpTGluZUhlaWdodCwgdWlQYXJhQmVmb3JlLCB1aVBhcmFBZnRlcl0pO1xyXG5cclxuICAvLyBhdXRvc2l6ZSBmb3IgZGVwdXR5IHRleHRhcmVhXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChtYW51YWxSZXNpemVFbmFibGVkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgZWwgPSBkZXB1dHlUZXh0YXJlYVJlZi5jdXJyZW50O1xyXG4gICAgaWYgKCFlbCkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGVsLnN0eWxlLmhlaWdodCA9ICdhdXRvJztcclxuICAgIGNvbnN0IE1JTl9IX0QgPSAyNDtcclxuICAgIGNvbnN0IGggPSBNYXRoLm1heChlbC5zY3JvbGxIZWlnaHQsIE1JTl9IX0QpO1xyXG4gICAgZWwuc3R5bGUuaGVpZ2h0ID0gYCR7aH1weGA7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH0sIFtkZXB1dHlDb250ZW50LCByZWNvcmQsIHVpRm9udFNpemUsIHVpTGluZUhlaWdodCwgdWlQYXJhQmVmb3JlLCB1aVBhcmFBZnRlcl0pO1xyXG5cclxuICAvLyBhdXRvc2l6ZSBmb3IgZGVwdXR5LXJpZ2h0IHRleHRhcmVhXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChtYW51YWxSZXNpemVFbmFibGVkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgZWwgPSBkZXB1dHlSaWdodFRleHRhcmVhUmVmLmN1cnJlbnQ7XHJcbiAgICBpZiAoIWVsKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgZWwuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nO1xyXG4gICAgY29uc3QgTUlOX0hfRCA9IDI0O1xyXG4gICAgY29uc3QgaCA9IE1hdGgubWF4KGVsLnNjcm9sbEhlaWdodCwgTUlOX0hfRCk7XHJcbiAgICBlbC5zdHlsZS5oZWlnaHQgPSBgJHtofXB4YDtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfSwgW2RlcHV0eVJpZ2h0Q29udGVudCwgcmVjb3JkLCB1aUZvbnRTaXplLCB1aUxpbmVIZWlnaHQsIHVpUGFyYUJlZm9yZSwgdWlQYXJhQWZ0ZXJdKTtcclxuXHJcbiAgLy8gYXV0b3NpemUgZm9yIGRpcmVjdG9yIHRleHRhcmVhXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChtYW51YWxSZXNpemVFbmFibGVkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgZWwgPSBkaXJlY3RvclRleHRhcmVhUmVmLmN1cnJlbnQ7XHJcbiAgICBpZiAoIWVsKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgZWwuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nO1xyXG4gICAgY29uc3QgTUlOX0hfRCA9IDI0O1xyXG4gICAgY29uc3QgaCA9IE1hdGgubWF4KGVsLnNjcm9sbEhlaWdodCwgTUlOX0hfRCk7XHJcbiAgICBlbC5zdHlsZS5oZWlnaHQgPSBgJHtofXB4YDtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfSwgW2RpcmVjdG9yQ29udGVudCwgcmVjb3JkLCB1aUZvbnRTaXplLCB1aUxpbmVIZWlnaHQsIHVpUGFyYUJlZm9yZSwgdWlQYXJhQWZ0ZXJdKTtcclxuXHJcbiAgLy8gYXV0b3NpemUgZm9yIGhlYWQgb2ZmaWNlIHRleHRhcmVhXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChtYW51YWxSZXNpemVFbmFibGVkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgZWwgPSBoZWFkT2ZmaWNlVGV4dGFyZWFSZWYuY3VycmVudDtcclxuICAgIGlmICghZWwpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBlbC5zdHlsZS5oZWlnaHQgPSAnYXV0byc7XHJcbiAgICBjb25zdCBNSU5fSF9EID0gMjQ7XHJcbiAgICBjb25zdCBoID0gTWF0aC5tYXgoZWwuc2Nyb2xsSGVpZ2h0LCBNSU5fSF9EKTtcclxuICAgIGVsLnN0eWxlLmhlaWdodCA9IGAke2h9cHhgO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9LCBbaGVhZE9mZmljZUNvbnRlbnQsIHJlY29yZCwgdWlGb250U2l6ZSwgdWlMaW5lSGVpZ2h0LCB1aVBhcmFCZWZvcmUsIHVpUGFyYUFmdGVyXSk7XHJcblxyXG4gIGNvbnN0IHByaW50UGFnZSA9ICgpID0+IHdpbmRvdy5wcmludCgpO1xyXG5cclxuICAvLyBTaGFyZWQgZnVuY3Rpb24gdG8gcHJvZHVjZSB0aGUgcHJpbnQgQ1NTIHVzZWQgYnkgYm90aCBwcm9ncmFtbWF0aWMgcHJpbnRzXHJcbiAgLy8gYW5kIHRoZSBicm93c2VyJ3MgQ3RybCtQIChiZWZvcmVwcmludCkuIEtlZXAgaW4gc3luYyB3aXRoIHByaW50U2hlZXREaXJlY3QuXHJcbiAgY29uc3QgZ2V0UHJpbnRDc3MgPSAoc2NhbGUgPSAxKSA9PiB7XHJcbiAgICBjb25zdCBzY2FsZWRGb250U2l6ZSA9IE1hdGgubWF4KDgsIE1hdGgucm91bmQodWlGb250U2l6ZSAqIHNjYWxlKSk7XHJcbiAgICBjb25zdCBzY2FsZWRQYWRkaW5nVG9wID0gTWF0aC5tYXgoMCwgKHVpUGFkZGluZ1RvcCAqIHNjYWxlKS50b0ZpeGVkKDIpKTtcclxuICAgIHJldHVybiBgQHBhZ2UgeyBcclxuICAgICAgICAgIHNpemU6IEE0OyBcclxuICAgICAgICAgIG1hcmdpbjogMG1tIDhtbSAzbW0gOG1tOyBcclxuICAgICAgICB9XHJcbiAgICAgICAgQG1lZGlhIHByaW50IHtcclxuICAgICAgICAgIGh0bWwsIGJvZHkgeyBcclxuICAgICAgICAgICAgaGVpZ2h0OiBhdXRvICFpbXBvcnRhbnQ7IFxyXG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmICFpbXBvcnRhbnQ7IFxyXG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDsgXHJcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDsgXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBib2R5ICogeyB2aXNpYmlsaXR5OiBoaWRkZW4gIWltcG9ydGFudDsgfVxyXG4gICAgICAgICAgLnNoZWV0LCAuc2hlZXQgKiB7IHZpc2liaWxpdHk6IHZpc2libGUgIWltcG9ydGFudDsgfVxyXG4gICAgICAgICAgLnNoZWV0IHsgXHJcbiAgICAgICAgICAgIC8qIHBsYWNlIHNoZWV0IGF0IHRoZSB2ZXJ5IHRvcCBvZiB0aGUgcHJpbnRlZCBwYWdlIHNhZmUgYXJlYSAqL1xyXG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGUgIWltcG9ydGFudDsgXHJcbiAgICAgICAgICAgIGxlZnQ6IDhtbSAhaW1wb3J0YW50OyBcclxuICAgICAgICAgICAgdG9wOiAwbW0gIWltcG9ydGFudDsgXHJcbiAgICAgICAgICAgIC8qIEZpdCB0byBwcmludGFibGUgd2lkdGggKGFjY291bnQgZm9yIGxlZnQrcmlnaHQgbWFyZ2lucykgKi9cclxuICAgICAgICAgICAgd2lkdGg6IGNhbGMoMjEwbW0gLSAxNm1tKSAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgICBtaW4td2lkdGg6IDAgIWltcG9ydGFudDtcclxuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7IFxyXG4gICAgICAgICAgICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7IFxyXG4gICAgICAgICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94ICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgICAgIGRpc3BsYXk6IGJsb2NrICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmYgIWltcG9ydGFudDtcclxuICAgICAgICAgICAgLyogbGltaXQgc2hlZXQgaGVpZ2h0IHRvIHByaW50YWJsZSBhcmVhIChwYWdlIGhlaWdodCBtaW51cyB0b3ArYm90dG9tIG1hcmdpbnMgYW5kIGhlYWRlciBhbGxvd2FuY2UpICovXHJcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IGNhbGMoMjk3bW0gLSAxM21tKSAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgICBwYWdlLWJyZWFrLWluc2lkZTogYXV0byAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgICBwYWdlLWJyZWFrLWFmdGVyOiBhdm9pZCAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgICBvdmVyZmxvdzogdmlzaWJsZSAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgICB0cmFuc2Zvcm06IG5vbmUgIWltcG9ydGFudDtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAucGFnZSB7IFxyXG4gICAgICAgICAgICBoZWlnaHQ6IGF1dG8gIWltcG9ydGFudDsgXHJcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IG5vbmUgIWltcG9ydGFudDtcclxuICAgICAgICAgICAgbWluLWhlaWdodDogYXV0byAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgICAvKiBlbnN1cmUgcGFnZSBjb250ZW50IHN0YXlzIGluc2lkZSBob3Jpem9udGFsIHNhZmUgYXJlYSAqL1xyXG4gICAgICAgICAgICBwYWRkaW5nOiAwbW0gIWltcG9ydGFudDtcclxuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwbW0gIWltcG9ydGFudDtcclxuICAgICAgICAgICAgcGFkZGluZy1yaWdodDogMG1tICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgICAgIC8qIHJlbW92ZSB0b3AgcGFkZGluZyBmb3IgcHJpbnRlZCBvdXRwdXQgc28gY29udGVudCBzaXRzIGF0IHRoZSB2ZXJ5IHRvcCAqL1xyXG4gICAgICAgICAgICBwYWRkaW5nLXRvcDogMG1tICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3ggIWltcG9ydGFudDtcclxuICAgICAgICAgICAgb3ZlcmZsb3c6IHZpc2libGUgIWltcG9ydGFudDtcclxuICAgICAgICAgICAgcGFnZS1icmVhay1pbnNpZGU6IGF1dG8gIWltcG9ydGFudDtcclxuICAgICAgICAgICAgZm9udC1mYW1pbHk6ICdLaG1lciBPUyBTaWVtcmVhcCcsJ05vdG8gU2FucyBLaG1lcicsJ0tobWVyIE9TJywnSGFudW1hbicsQXJpYWwsJ3NhbnMtc2VyaWYnICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogJHtzY2FsZWRGb250U2l6ZX1weCAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgICBwYWdlLWJyZWFrLWFmdGVyOiBhdm9pZCAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgICBsaW5lLWhlaWdodDogJHt1aUxpbmVIZWlnaHR9ICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLmZpZWxkIHsgXHJcbiAgICAgICAgICAgIHBhZ2UtYnJlYWstaW5zaWRlOiBhdm9pZCAhaW1wb3J0YW50O1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC5wcmludC1oaWRlIHsgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50OyB9XHJcbiAgICAgICAgICBuYXYsIGhlYWRlciwgZm9vdGVyLCAubm8tcHJpbnQgeyBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7IH1cclxuICAgICAgICAgIC8qIFM2IG5vdGUgcHJpbnQgaGVscGVyczogaGlkZSBzY3JlZW4gcHJldmlldywgc2hvdyBwcmludC1vbmx5IGNlbnRlcmVkIG5vdGUgKi9cclxuICAgICAgICAgIC5zNi1ub3RlLXNjcmVlbiB7IGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsgfVxyXG4gICAgICAgICAgLnM2LW5vdGUtcHJpbnQgeyBkaXNwbGF5OiBibG9jayAhaW1wb3J0YW50OyB3aGl0ZS1zcGFjZTogcHJlLXdyYXAgIWltcG9ydGFudDsgd29yZC1icmVhazogYnJlYWstYWxsICFpbXBvcnRhbnQ7IG92ZXJmbG93LXdyYXA6IGFueXdoZXJlICFpbXBvcnRhbnQ7IHRleHQtYWxpZ246IGNlbnRlciAhaW1wb3J0YW50OyB9XHJcbiAgICAgICAgfWA7XHJcbiAgfTtcclxuXHJcbiAgLy8gUHJpbnQgb25seSB0aGUgc2hlZXQgY29udGVudCB3aXRob3V0IG9wZW5pbmcgYSBuZXcgdGFiL3dpbmRvdy5cclxuICAvLyBXZSBpbmplY3QgYSB0ZW1wb3Jhcnkgc3R5bGVzaGVldCB0aGF0IGhpZGVzIGFsbCBlbGVtZW50cyBleGNlcHQgYC5zaGVldGAgZHVyaW5nIHByaW50aW5nLFxyXG4gIC8vIHRoZW4gY2FsbCBgd2luZG93LnByaW50KClgIGFuZCBjbGVhbiB1cCBhZnRlciBwcmludGluZy5cclxuICBjb25zdCBwcmludFNoZWV0ID0gKCkgPT4ge1xyXG4gICAgaWYgKGlzUHJpbnRpbmcpIHtcclxuICAgICAgY29uc29sZS5sb2coJ1ByaW50IGFscmVhZHkgaW4gcHJvZ3Jlc3MnKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBzZXRJc1ByaW50aW5nKHRydWUpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2hlZXQnKTtcclxuICAgICAgaWYgKCFlbCkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybignU2hlZXQgZWxlbWVudCBub3QgZm91bmQsIHVzaW5nIGRlZmF1bHQgcHJpbnQnKTtcclxuICAgICAgICBzZXRJc1ByaW50aW5nKGZhbHNlKTtcclxuICAgICAgICByZXR1cm4gcHJpbnRQYWdlKCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIGNvbXB1dGUgYSBzY2FsZSBzbyB0aGUgc2hlZXQgZml0cyBvbiBhIHNpbmdsZSBBNCBwcmludGFibGUgYXJlYSBpZiBuZWVkZWRcclxuICAgICAgY29uc3QgY29tcHV0ZVNjYWxlID0gKHRhcmdldEVsKSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGlmICghdGFyZ2V0RWwpIHJldHVybiAxO1xyXG4gICAgICAgICAgLy8gY3JlYXRlIGEgdGVtcG9yYXJ5IGVsZW1lbnQgb2YgMjk3bW0gdG8gbWVhc3VyZSBweCBwZXIgbW0gb24gdGhpcyBkZXZpY2VcclxuICAgICAgICAgIGNvbnN0IHRtcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgdG1wLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcclxuICAgICAgICAgIHRtcC5zdHlsZS5sZWZ0ID0gJy05OTk5cHgnO1xyXG4gICAgICAgICAgdG1wLnN0eWxlLmhlaWdodCA9ICcyOTdtbSc7XHJcbiAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRtcCk7XHJcbiAgICAgICAgICBjb25zdCBwYWdlUHggPSB0bXAuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0IHx8ICgyOTcgKiAzLjc4KTtcclxuICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodG1wKTtcclxuXHJcbiAgICAgICAgICBjb25zdCBtYXJnaW5Ub3BNbSA9IDA7IC8vIHRvcCBtYXJnaW4gaW4gQHBhZ2VcclxuICAgICAgICAgIGNvbnN0IG1hcmdpbkJvdHRvbU1tID0gMzsgLy8gcmVkdWNlZCBib3R0b20gbWFyZ2luIHRvIHNocmluayB3aGl0ZXNwYWNlXHJcbiAgICAgICAgICBjb25zdCBoZWFkZXJBbGxvd01tID0gMTA7IC8vIGNvbnNlcnZhdGl2ZSBoZWFkZXIgYWxsb3dhbmNlXHJcbiAgICAgICAgICBjb25zdCBwcmludGFibGVQeCA9IHBhZ2VQeCAtIChtYXJnaW5Ub3BNbSArIG1hcmdpbkJvdHRvbU1tKSAqIChwYWdlUHggLyAyOTcpIC0gKGhlYWRlckFsbG93TW0gKiAocGFnZVB4IC8gMjk3KSk7XHJcbiAgICAgICAgICBjb25zdCBlbEggPSB0YXJnZXRFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgfHwgdGFyZ2V0RWwub2Zmc2V0SGVpZ2h0IHx8IDE7XHJcbiAgICAgICAgICBjb25zdCBzY2FsZSA9IHByaW50YWJsZVB4IC8gZWxIO1xyXG4gICAgICAgICAgcmV0dXJuIE1hdGgubWluKDEsIE1hdGgubWF4KDAuNCwgc2NhbGUpKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IHJldHVybiAxOyB9XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBzY2FsZSA9IGNvbXB1dGVTY2FsZShlbCk7XHJcbiAgICAgIGNvbnN0IGNzcyA9IGdldFByaW50Q3NzKHNjYWxlKTtcclxuXHJcbiAgICAgIC8vIGhpZGUgc21hbGwgb3ZlcmxheSBsYWJlbHMgaW5zaWRlIHRoZSBzaGVldCBiZWZvcmUgcHJpbnRpbmdcclxuICAgICAgLy8gVXNlIGNvbnNlcnZhdGl2ZSBoZXVyaXN0aWNzIHNvIGltcG9ydGFudCBsb25nIGxpbmVzIChlLmcuIGRvdHRlZC91bmRlcnNjb3JlIGZpZWxkcylcclxuICAgICAgLy8gb3Igc2hvcnQgZnJhZ21lbnRzIHRoYXQgbG9vayBsaWtlIGZvcm0gZmllbGRzIGFyZSBOT1QgaGlkZGVuLlxyXG4gICAgICBjb25zdCBoaWRkZW5Ob2RlcyA9IFtdO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IG5vZGVzID0gZWwucXVlcnlTZWxlY3RvckFsbCgnKicpO1xyXG4gICAgICAgIG5vZGVzLmZvckVhY2gobiA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyBza2lwIGZvcm0gY29udHJvbHMgYW5kIG9idmlvdXMgaW50ZXJhY3RpdmUgZWxlbWVudHNcclxuICAgICAgICAgICAgY29uc3QgdGFnID0gKG4udGFnTmFtZSB8fCAnJykudG9VcHBlckNhc2UoKTtcclxuICAgICAgICAgICAgaWYgKFsnSU5QVVQnLCAnVEVYVEFSRUEnLCAnU0VMRUNUJywgJ0JVVFRPTicsICdMQUJFTCddLmluY2x1ZGVzKHRhZykpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHR4dCA9IChuLmlubmVyVGV4dCB8fCAnJykudHJpbSgpO1xyXG4gICAgICAgICAgICBpZiAoIXR4dCkgcmV0dXJuO1xyXG4gICAgICAgICAgICBjb25zdCBjcyA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKG4pO1xyXG4gICAgICAgICAgICBjb25zdCBmcyA9IHBhcnNlRmxvYXQoY3MuZm9udFNpemUgfHwgJzAnKTtcclxuXHJcbiAgICAgICAgICAgIC8vIGRldGVybWluZSB3aGV0aGVyIHRoZSB0ZXh0IGlzIG1vc3RseSBwdW5jdHVhdGlvbiAoZS5nLiBsb25nIGRvdHRlZC91bmRlcnNjb3JlIGxpbmVzKVxyXG4gICAgICAgICAgICBjb25zdCB0b3RhbCA9IHR4dC5sZW5ndGggfHwgMDtcclxuICAgICAgICAgICAgY29uc3QgbGV0dGVycyA9ICh0eHQucmVwbGFjZSgvW15cXHB7TH1cXHB7Tn1dL2d1LCAnJykgfHwgJycpLmxlbmd0aDtcclxuICAgICAgICAgICAgY29uc3QgcHVuY3QgPSB0b3RhbCAtIGxldHRlcnM7XHJcbiAgICAgICAgICAgIGNvbnN0IHB1bmN0UmF0aW8gPSB0b3RhbCA/IChwdW5jdCAvIHRvdGFsKSA6IDA7XHJcblxyXG4gICAgICAgICAgICAvLyBoaWRlIG9ubHkgdmVyeSBzbWFsbCwgc2hvcnQgbGFiZWxzIHRoYXQgYXJlIG1vc3RseSB3b3JkIGNoYXJhY3RlcnNcclxuICAgICAgICAgICAgLy8gLSBmb250LXNpemUgPD0gMTFweFxyXG4gICAgICAgICAgICAvLyAtIGxlbmd0aCA8IDIwIGNoYXJzIChzaG9ydClcclxuICAgICAgICAgICAgLy8gLSBwdW5jdHVhdGlvbiByYXRpbyA8IDAuNCAobm90IGEgbGluZSBvZiB1bmRlcnNjb3Jlcy9kb3RzKVxyXG4gICAgICAgICAgICAvLyBUaGlzIGF2b2lkcyBoaWRpbmcgZG90dGVkL3VuZGVyc2NvcmVkIGZvcm0gbGluZXMgYW5kIGxvbmdlciBLaG1lciBwaHJhc2VzLlxyXG4gICAgICAgICAgICBpZiAoZnMgJiYgZnMgPD0gMTEgJiYgdG90YWwgPiAwICYmIHRvdGFsIDwgMjAgJiYgcHVuY3RSYXRpbyA8IDAuNCkge1xyXG4gICAgICAgICAgICAgIGhpZGRlbk5vZGVzLnB1c2gobik7XHJcbiAgICAgICAgICAgICAgbi5kYXRhc2V0Ll9wcmludEhpZGRlbiA9ICcxJztcclxuICAgICAgICAgICAgICBuLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBjYXRjaCAoZSkge31cclxuICAgICAgICB9KTtcclxuICAgICAgfSBjYXRjaCAoZSkge31cclxuXHJcbiAgICAgIGxldCBzdHlsZUVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ByaW50LXNoZWV0LXN0eWxlJyk7XHJcbiAgICAgIGlmICghc3R5bGVFbCkge1xyXG4gICAgICAgIHN0eWxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xyXG4gICAgICAgIHN0eWxlRWwuaWQgPSAncHJpbnQtc2hlZXQtc3R5bGUnO1xyXG4gICAgICAgIHN0eWxlRWwudHlwZSA9ICd0ZXh0L2Nzcyc7XHJcbiAgICAgICAgc3R5bGVFbC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTtcclxuICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlRWwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHN0eWxlRWwudGV4dENvbnRlbnQgPSBjc3M7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIGNsZWFudXAgaGVscGVyXHJcbiAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIC8vIHJlc3RvcmUgaGlkZGVuIG5vZGVzXHJcbiAgICAgICAgICBpZiAoaGlkZGVuTm9kZXMgJiYgaGlkZGVuTm9kZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICBoaWRkZW5Ob2Rlcy5mb3JFYWNoKG4gPT4ge1xyXG4gICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobiAmJiBuLmRhdGFzZXQgJiYgbi5kYXRhc2V0Ll9wcmludEhpZGRlbikge1xyXG4gICAgICAgICAgICAgICAgICBuLnN0eWxlLnZpc2liaWxpdHkgPSAnJztcclxuICAgICAgICAgICAgICAgICAgZGVsZXRlIG4uZGF0YXNldC5fcHJpbnRIaWRkZW47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdFcnJvciByZXN0b3Jpbmcgbm9kZSB2aXNpYmlsaXR5OicsIGUpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICAvLyBSZW1vdmUgcHJpbnQgc3R5bGVzaGVldFxyXG4gICAgICAgICAgaWYgKHN0eWxlRWwgJiYgc3R5bGVFbC5wYXJlbnROb2RlKSB7XHJcbiAgICAgICAgICAgIHN0eWxlRWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzdHlsZUVsKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ0Vycm9yIGR1cmluZyBwcmludCBjbGVhbnVwOicsIGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignYWZ0ZXJwcmludCcsIGNsZWFudXApO1xyXG4gICAgICAgIGlmIChmYWxsYmFja1RpbWVvdXQpIHtcclxuICAgICAgICAgIGNsZWFyVGltZW91dChmYWxsYmFja1RpbWVvdXQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzZXRJc1ByaW50aW5nKGZhbHNlKTtcclxuICAgICAgfTtcclxuXHJcbiAgICAgIC8vIFNldCB1cCBjbGVhbnVwIGxpc3RlbmVyc1xyXG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYWZ0ZXJwcmludCcsIGNsZWFudXApO1xyXG4gICAgICAvLyBmYWxsYmFjayBjbGVhbnVwIGluIGNhc2UgYWZ0ZXJwcmludCBkb2Vzbid0IGZpcmVcclxuICAgICAgY29uc3QgZmFsbGJhY2tUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKCdQcmludCBjbGVhbnVwIHRpbWVvdXQgcmVhY2hlZCcpO1xyXG4gICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgfSwgNTAwMCk7XHJcblxyXG4gICAgICAvLyBFbnN1cmUgd2luZG93IGZvY3VzIGFuZCBwcmludFxyXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgd2luZG93LmZvY3VzKCk7XHJcbiAgICAgICAgICB3aW5kb3cucHJpbnQoKTtcclxuICAgICAgICB9IGNhdGNoIChwcmludEVycm9yKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBleGVjdXRpbmcgd2luZG93LnByaW50KCk6JywgcHJpbnRFcnJvcik7XHJcbiAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICBwcmludFBhZ2UoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sIDEwMCk7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluIHByaW50U2hlZXQgZnVuY3Rpb246JywgZSk7XHJcbiAgICAgIHNldElzUHJpbnRpbmcoZmFsc2UpO1xyXG4gICAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IHByaW50XHJcbiAgICAgIHByaW50UGFnZSgpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8vIEluamVjdCBzYW1lIHByaW50IHN0eWxlc2hlZXQgZm9yIGJyb3dzZXItaW5pdGlhdGVkIHByaW50aW5nIChDdHJsK1ApXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IG9uQmVmb3JlID0gKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGxldCBzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ByaW50LXNoZWV0LXN0eWxlJyk7XHJcbiAgICAgICAgLy8gY29tcHV0ZSBzY2FsZSBmcm9tIGN1cnJlbnQgc2hlZXQgdG8gdHJ5IHRvIGZpdCBvbiBvbmUgcGFnZVxyXG4gICAgICAgIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNoZWV0Jyk7XHJcbiAgICAgICAgY29uc3QgY29tcHV0ZVNjYWxlID0gKHRhcmdldEVsKSA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAoIXRhcmdldEVsKSByZXR1cm4gMTtcclxuICAgICAgICAgICAgY29uc3QgdG1wID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgIHRtcC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XHJcbiAgICAgICAgICAgIHRtcC5zdHlsZS5sZWZ0ID0gJy05OTk5cHgnO1xyXG4gICAgICAgICAgICB0bXAuc3R5bGUuaGVpZ2h0ID0gJzI5N21tJztcclxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0bXApO1xyXG4gICAgICAgICAgICBjb25zdCBwYWdlUHggPSB0bXAuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0IHx8ICgyOTcgKiAzLjc4KTtcclxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0bXApO1xyXG4gICAgICAgICAgICBjb25zdCBtYXJnaW5NbSA9IDg7XHJcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlckFsbG93TW0gPSAxMDtcclxuICAgICAgICAgICAgY29uc3QgcHJpbnRhYmxlUHggPSBwYWdlUHggLSAobWFyZ2luTW0gKiAyKSAqIChwYWdlUHggLyAyOTcpIC0gKGhlYWRlckFsbG93TW0gKiAocGFnZVB4IC8gMjk3KSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGVsSCA9IHRhcmdldEVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCB8fCB0YXJnZXRFbC5vZmZzZXRIZWlnaHQgfHwgMTtcclxuICAgICAgICAgICAgY29uc3Qgc2NhbGUgPSBwcmludGFibGVQeCAvIGVsSDtcclxuICAgICAgICAgICAgcmV0dXJuIE1hdGgubWluKDEsIE1hdGgubWF4KDAuNCwgc2NhbGUpKTtcclxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHsgcmV0dXJuIDE7IH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBjb25zdCBzY2FsZSA9IGNvbXB1dGVTY2FsZShlbCk7XHJcbiAgICAgICAgaWYgKCFzKSB7XHJcbiAgICAgICAgICBzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcclxuICAgICAgICAgIHMuaWQgPSAncHJpbnQtc2hlZXQtc3R5bGUnO1xyXG4gICAgICAgICAgcy50eXBlID0gJ3RleHQvY3NzJztcclxuICAgICAgICAgIHMuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoZ2V0UHJpbnRDc3Moc2NhbGUpKSk7XHJcbiAgICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHMpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBzLnRleHRDb250ZW50ID0gZ2V0UHJpbnRDc3Moc2NhbGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybignYmVmb3JlcHJpbnQgaGFuZGxlciBmYWlsZWQgdG8gaW5qZWN0IHByaW50IGNzcycsIGUpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IG9uQWZ0ZXIgPSAoKSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcmludC1zaGVldC1zdHlsZScpO1xyXG4gICAgICAgIGlmIChzICYmIHMucGFyZW50Tm9kZSkgcy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHMpO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKCdhZnRlcnByaW50IGNsZWFudXAgZmFpbGVkJywgZSk7XHJcbiAgICAgIH1cclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBpZnJhbWUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJpbnQtaWZyYW1lJyk7XHJcbiAgICAgICAgaWYgKGlmcmFtZSAmJiBpZnJhbWUucGFyZW50Tm9kZSkgaWZyYW1lLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoaWZyYW1lKTtcclxuICAgICAgfSBjYXRjaCAoZSkge31cclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBocyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcmludC1oaWRlLWV2ZXJ5dGhpbmcnKTtcclxuICAgICAgICBpZiAoaHMgJiYgaHMucGFyZW50Tm9kZSkgaHMucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChocyk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHt9XHJcbiAgICB9O1xyXG5cclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmVwcmludCcsIG9uQmVmb3JlKTtcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdhZnRlcnByaW50Jywgb25BZnRlcik7XHJcblxyXG4gICAgY29uc3QgbXEgPSB3aW5kb3cubWF0Y2hNZWRpYSAmJiB3aW5kb3cubWF0Y2hNZWRpYSgncHJpbnQnKTtcclxuICAgIGNvbnN0IG1xSGFuZGxlciA9IChtKSA9PiB7IGlmIChtLm1hdGNoZXMpIG9uQmVmb3JlKCk7IGVsc2Ugb25BZnRlcigpOyB9O1xyXG4gICAgaWYgKG1xICYmIG1xLmFkZExpc3RlbmVyKSBtcS5hZGRMaXN0ZW5lcihtcUhhbmRsZXIpO1xyXG5cclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdiZWZvcmVwcmludCcsIG9uQmVmb3JlKTtcclxuICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2FmdGVycHJpbnQnLCBvbkFmdGVyKTtcclxuICAgICAgaWYgKG1xICYmIG1xLnJlbW92ZUxpc3RlbmVyKSBtcS5yZW1vdmVMaXN0ZW5lcihtcUhhbmRsZXIpO1xyXG4gICAgfTtcclxuICB9LCBbdWlQYWRkaW5nVG9wLCB1aUZvbnRTaXplLCB1aUxpbmVIZWlnaHRdKTtcclxuXHJcbiAgY29uc3QgcHJpbnRSZWYgPSAoKSA9PiB7XHJcbiAgICBpZiAoIXNlbGVjdGVkUmVmKSByZXR1cm47XHJcbiAgICAvLyBUcnkgcHJpbnRpbmcgdGhlIHNob3duIGlmcmFtZSBpZiBzYW1lLW9yaWdpblxyXG4gICAgdHJ5IHtcclxuICAgICAgaWYgKHJlZklmcmFtZSAmJiByZWZJZnJhbWUuY3VycmVudCAmJiByZWZJZnJhbWUuY3VycmVudC5jb250ZW50V2luZG93KSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHJlZklmcmFtZS5jdXJyZW50LmNvbnRlbnRXaW5kb3cuZm9jdXMoKTtcclxuICAgICAgICAgIHJlZklmcmFtZS5jdXJyZW50LmNvbnRlbnRXaW5kb3cucHJpbnQoKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAvLyBjb3VsZCBiZSBjcm9zcy1vcmlnaW47IGZhbGx0aHJvdWdoIHRvIGZldGNoIGFwcHJvYWNoXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIC8vIGlnbm9yZSBhbmQgZmFsbGJhY2tcclxuICAgIH1cclxuXHJcbiAgICAvLyBBdHRlbXB0IHRvIGZldGNoIHRoZSByZXNvdXJjZSBhbmQgcHJpbnQgdmlhIGEgc2FtZS1vcmlnaW4gYmxvYiBVUkwgaWZyYW1lXHJcbiAgICAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNlbGVjdGVkUmVmLCB7IGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nIH0pO1xyXG4gICAgICAgIGlmICghcmVzIHx8ICFyZXMub2spIHRocm93IG5ldyBFcnJvcignRmV0Y2ggZmFpbGVkJyk7XHJcbiAgICAgICAgY29uc3QgY3QgPSByZXMuaGVhZGVycy5nZXQoJ2NvbnRlbnQtdHlwZScpIHx8ICcnO1xyXG4gICAgICAgIGNvbnN0IGJsb2IgPSBhd2FpdCByZXMuYmxvYigpO1xyXG4gICAgICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcblxyXG4gICAgICAgIC8vIGNyZWF0ZSBoaWRkZW4gaWZyYW1lXHJcbiAgICAgICAgY29uc3QgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XHJcbiAgICAgICAgaWZyYW1lLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcclxuICAgICAgICBpZnJhbWUuc3R5bGUubGVmdCA9ICcwJztcclxuICAgICAgICBpZnJhbWUuc3R5bGUudG9wID0gJzAnO1xyXG4gICAgICAgIGlmcmFtZS5zdHlsZS53aWR0aCA9ICcwJztcclxuICAgICAgICBpZnJhbWUuc3R5bGUuaGVpZ2h0ID0gJzAnO1xyXG4gICAgICAgIGlmcmFtZS5zdHlsZS5ib3JkZXIgPSAnMCc7XHJcbiAgICAgICAgaWZyYW1lLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcclxuICAgICAgICBpZnJhbWUuc3JjID0gdXJsO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcclxuXHJcbiAgICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcclxuICAgICAgICAgIHRyeSB7IGlmIChpZnJhbWUgJiYgaWZyYW1lLnBhcmVudE5vZGUpIGlmcmFtZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGlmcmFtZSk7IH0gY2F0Y2ggKGUpIHt9XHJcbiAgICAgICAgICB0cnkgeyBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7IH0gY2F0Y2ggKGUpIHt9XHJcbiAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG1zZ0hhbmRsZXIpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbnN0IG1zZ0hhbmRsZXIgPSAoKSA9PiB7fTtcclxuXHJcbiAgICAgICAgLy8gd2hlbiBpZnJhbWUgbG9hZHMsIHByaW50IGl0XHJcbiAgICAgICAgaWZyYW1lLm9ubG9hZCA9ICgpID0+IHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGl3ID0gaWZyYW1lLmNvbnRlbnRXaW5kb3c7XHJcbiAgICAgICAgICAgIGlmIChpdykge1xyXG4gICAgICAgICAgICAgIGl3LmZvY3VzKCk7XHJcbiAgICAgICAgICAgICAgLy8gYXR0ZW1wdCB0byBwcmludDsgc29tZSBicm93c2VycyBtYXkgYmxvY2sgb3Igbm90IGFsbG93IHByb2dyYW1tYXRpYyBwcmludCBmb3IgUERGc1xyXG4gICAgICAgICAgICAgIHRyeSB7IGl3LnByaW50KCk7IH0gY2F0Y2ggKGUpIHsgLyogaWdub3JlICovIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAvLyBpZ25vcmVcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIC8vIHNjaGVkdWxlIGNsZWFudXBcclxuICAgICAgICAgIHNldFRpbWVvdXQoY2xlYW51cCwgMTUwMCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIC8vIGZhbGxiYWNrOiBvcGVuIG5ldyB0YWIgc28gdXNlciBjYW4gcHJpbnQgbWFudWFsbHlcclxuICAgICAgICBjb25zdCB3ID0gd2luZG93Lm9wZW4oc2VsZWN0ZWRSZWYsICdfYmxhbmsnKTtcclxuICAgICAgICBpZiAodykgdy5mb2N1cygpO1xyXG4gICAgICB9XHJcbiAgICB9KSgpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHJlc29sdmVTdGFnZUlkID0gKHZhbCkgPT4ge1xyXG4gICAgaWYgKCF2YWwpIHJldHVybiBudWxsO1xyXG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSByZXR1cm4gdmFsO1xyXG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSByZXR1cm4gdmFsLl9pZCB8fCB2YWwuaWQgfHwgdmFsLnNpZ25hdHVyZSB8fCBudWxsO1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfTtcclxuXHJcbiAgLy8gTm9ybWFsaXplIGBzdGFnZXNgICh3aGljaCBtYXkgYmUgYW4gb2JqZWN0IG9yIGFuIGFycmF5KSBpbnRvIGEgbWFwXHJcbiAgY29uc3Qgbm9ybWFsaXplZFN0YWdlcyA9IHVzZU1lbW8oKCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcyA9IHN0YWdlcyB8fCAobWV0YSAmJiBtZXRhLmZlZWRiYWNrU3RhZ2VzKSB8fCB7fTtcclxuICAgICAgaWYgKCFzKSByZXR1cm4ge307XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHMpKSB7XHJcbiAgICAgICAgY29uc3QgbWFwID0ge307XHJcbiAgICAgICAgcy5mb3JFYWNoKGl0ZW0gPT4ge1xyXG4gICAgICAgICAgaWYgKCFpdGVtKSByZXR1cm47XHJcbiAgICAgICAgICBjb25zdCBrZXkgPSAoaXRlbS5fa2V5IHx8IGl0ZW0ua2V5IHx8IGl0ZW0uc3RhZ2VLZXkgfHwgaXRlbS5zdGFnZSB8fCBpdGVtLm5hbWUgfHwgJycpLnRvU3RyaW5nKCkudG9VcHBlckNhc2UoKTtcclxuICAgICAgICAgIGlmIChrZXkpIG1hcFtrZXldID0gaXRlbTtcclxuICAgICAgICAgIGVsc2UgaWYgKGl0ZW0uX2lkKSBtYXBbaXRlbS5faWRdID0gaXRlbTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gbWFwO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICh0eXBlb2YgcyA9PT0gJ29iamVjdCcpIHJldHVybiBzO1xyXG4gICAgICByZXR1cm4ge307XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIHJldHVybiB7fTtcclxuICAgIH1cclxuICB9LCBbc3RhZ2VzLCBtZXRhXSk7XHJcblxyXG4gIGNvbnN0IHNpZ0ZvciA9IChzdGFnZUtleSkgPT4ge1xyXG4gICAgY29uc3QgcmF3ID0gbm9ybWFsaXplZFN0YWdlcyAmJiBub3JtYWxpemVkU3RhZ2VzW3N0YWdlS2V5XTtcclxuICAgIGlmICghcmF3KSByZXR1cm4gbnVsbDtcclxuICAgIGNvbnN0IGlkID0gcmVzb2x2ZVN0YWdlSWQocmF3KTtcclxuICAgIGlmICghaWQpIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHNpZ25hdHVyZXNNYXBbaWRdIHx8IG51bGw7XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2lnbmF0dXJlVXJsID0gKHNpZykgPT4ge1xyXG4gICAgaWYgKCFzaWcpIHJldHVybiBudWxsO1xyXG4gICAgY29uc3QgZnAgPSBzaWcuZmlsZVBhdGggfHwgc2lnLmZpbGUgfHwgc2lnLmZpbGVQYXRoO1xyXG4gICAgaWYgKCFmcCkgcmV0dXJuIG51bGw7XHJcbiAgICAvLyBhdm9pZCBkb3VibGUgc2xhc2hlcyBpZiBBUElfQkFTRSBhbHJlYWR5IGVuZHMgd2l0aCAnLydcclxuICAgIHJldHVybiBgJHtBUElfQkFTRS5yZXBsYWNlKC9cXC8kLywgJycpfSR7ZnAuc3RhcnRzV2l0aCgnLycpID8gJycgOiAnLyd9JHtmcH1gO1xyXG4gIH07XHJcblxyXG4gIC8vIEhlbHBlcjogcmVzb2x2ZSBhIGh1bWFuLWZyaWVuZGx5IHNlbmRlciBuYW1lIGZvciBvbmUgb3IgbW9yZSBzdGFnZSBrZXlzLlxyXG4gIC8vIEFjY2VwdHMgYSBzaW5nbGUga2V5IHN0cmluZyBvciBhbiBhcnJheSBvZiBrZXlzIChpbiBwcmlvcml0eSBvcmRlcikuXHJcbiAgY29uc3QgZ2V0U3RhZ2VTZW5kZXJOYW1lID0gKGtleXMpID0+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGtzID0gQXJyYXkuaXNBcnJheShrZXlzKSA/IGtleXMgOiBba2V5c107XHJcbiAgICAgIC8vIElmIGEgZmVlZGJhY2tTZW5kZXJOYW1lIHdhcyBzYXZlZCBpbiBtZXRhLCBwcmVmZXIgaXQgZm9yIHRoZSBtYWluICdTJyBzdGFnZS5cclxuICAgICAgdHJ5IHtcclxuICAgICAgICBpZiAobWV0YSAmJiBtZXRhLmZlZWRiYWNrU2VuZGVyTmFtZSkge1xyXG4gICAgICAgICAgY29uc3QgaGFzUyA9IGtzLnNvbWUoayA9PiBTdHJpbmcoaykudG9VcHBlckNhc2UoKSA9PT0gJ1MnKTtcclxuICAgICAgICAgIGlmIChoYXNTKSByZXR1cm4gU3RyaW5nKG1ldGEuZmVlZGJhY2tTZW5kZXJOYW1lKS5yZXBsYWNlKC9cXHMqXFwoW14pXStcXClcXHMqJC8sICcnKS50cmltKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSAqLyB9XHJcbiAgICAgIGZvciAoY29uc3QgayBvZiBrcykge1xyXG4gICAgICAgIGlmICghaykgY29udGludWU7XHJcbiAgICAgICAgY29uc3QgcmF3ID0gbm9ybWFsaXplZFN0YWdlcyAmJiBub3JtYWxpemVkU3RhZ2VzW2tdO1xyXG4gICAgICAgIGlmIChyYXcpIHtcclxuICAgICAgICAgIGlmICh0eXBlb2YgcmF3ID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICBjb25zdCBuID0gcmF3LnNlbmRlck5hbWUgfHwgcmF3LnNlbmRlciB8fCByYXcubmFtZTtcclxuICAgICAgICAgICAgaWYgKG4pIHJldHVybiBTdHJpbmcobikucmVwbGFjZSgvXFxzKlxcKFteKV0rXFwpXFxzKiQvLCAnJykudHJpbSgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgY29uc3QgaWQgPSByZXNvbHZlU3RhZ2VJZChyYXcpO1xyXG4gICAgICAgICAgaWYgKGlkICYmIHNpZ25hdHVyZXNNYXAgJiYgc2lnbmF0dXJlc01hcFtpZF0pIHtcclxuICAgICAgICAgICAgY29uc3QgcyA9IHNpZ25hdHVyZXNNYXBbaWRdO1xyXG4gICAgICAgICAgICBjb25zdCBuID0gKHMgJiYgKHMuZnVsbE5hbWVLaCB8fCBzLmZ1bGxOYW1lIHx8IHMubmFtZSkpO1xyXG4gICAgICAgICAgICBpZiAobikgcmV0dXJuIFN0cmluZyhuKS5yZXBsYWNlKC9cXHMqXFwoW14pXStcXClcXHMqJC8sICcnKS50cmltKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIHN0YWdlLXNwZWNpZmljIG1ldGEgZmFsbGJhY2tzXHJcbiAgICAgICAgaWYgKGsgPT09ICdTJykge1xyXG4gICAgICAgICAgaWYgKG1ldGEgJiYgbWV0YS5yZXBvcnRlck5hbWUpIHJldHVybiBTdHJpbmcobWV0YS5yZXBvcnRlck5hbWUpLnJlcGxhY2UoL1xccypcXChbXildK1xcKVxccyokLywgJycpLnRyaW0oKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGsgPT09ICdTMScpIHtcclxuICAgICAgICAgIGlmIChzMUNvbnRlbnQgJiYgU3RyaW5nKHMxQ29udGVudCkudHJpbSgpICE9PSAnJykgcmV0dXJuIFN0cmluZyhzMUNvbnRlbnQpLnJlcGxhY2UoL1xccypcXChbXildK1xcKVxccyokLywgJycpLnRyaW0oKTtcclxuICAgICAgICAgIGlmIChzdGFnZXMgJiYgc3RhZ2VzLnMxKSByZXR1cm4gU3RyaW5nKHN0YWdlcy5zMSkucmVwbGFjZSgvXFxzKlxcKFteKV0rXFwpXFxzKiQvLCAnJykudHJpbSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoayA9PT0gJ1MyJykge1xyXG4gICAgICAgICAgaWYgKG1ldGEgJiYgbWV0YS5kZXBhcnRtZW50SGVhZCkgcmV0dXJuIFN0cmluZyhtZXRhLmRlcGFydG1lbnRIZWFkKS5yZXBsYWNlKC9cXHMqXFwoW14pXStcXClcXHMqJC8sICcnKS50cmltKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChrID09PSAnU0QnIHx8IGsgPT09ICdTMycpIHtcclxuICAgICAgICAgIGlmIChtZXRhICYmIG1ldGEuZGVwdXR5TmFtZSkgcmV0dXJuIFN0cmluZyhtZXRhLmRlcHV0eU5hbWUpLnJlcGxhY2UoL1xccypcXChbXildK1xcKVxccyokLywgJycpLnRyaW0oKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGsgPT09ICdTRFInIHx8IGsgPT09ICdTNCcpIHtcclxuICAgICAgICAgIGlmIChtZXRhICYmIG1ldGEuZGVwdXR5UmlnaHROYW1lKSByZXR1cm4gU3RyaW5nKG1ldGEuZGVwdXR5UmlnaHROYW1lKS5yZXBsYWNlKC9cXHMqXFwoW14pXStcXClcXHMqJC8sICcnKS50cmltKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChrID09PSAnUzUnIHx8IGsgPT09ICdESVInIHx8IGsgPT09ICdTRElSJykge1xyXG4gICAgICAgICAgaWYgKG1ldGEgJiYgbWV0YS5kaXJlY3Rvck5hbWUpIHJldHVybiBTdHJpbmcobWV0YS5kaXJlY3Rvck5hbWUpLnJlcGxhY2UoL1xccypcXChbXildK1xcKVxccyokLywgJycpLnRyaW0oKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGsgPT09ICdTNicgfHwgayA9PT0gJ0hPJykge1xyXG4gICAgICAgICAgaWYgKG1ldGEgJiYgbWV0YS5oZWFkT2ZmaWNlTmFtZSkgcmV0dXJuIFN0cmluZyhtZXRhLmhlYWRPZmZpY2VOYW1lKS5yZXBsYWNlKC9cXHMqXFwoW14pXStcXClcXHMqJC8sICcnKS50cmltKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIC8vIGlnbm9yZVxyXG4gICAgfVxyXG4gICAgcmV0dXJuICcnO1xyXG4gIH07XHJcblxyXG4gIC8vIEJ1aWxkIGEgY2xpZW50IFVSTCBmb3IgYW4gYXR0YWNobWVudCBuYW1lL3BhdGhcclxuICBjb25zdCBhdHRhY2htZW50VXJsID0gKGEpID0+IHtcclxuICAgIGlmICghYSkgcmV0dXJuIG51bGw7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBzID0gKHR5cGVvZiBhID09PSAnc3RyaW5nJykgPyBhIDogKGEubmFtZSB8fCBhLnVybCB8fCAnJyk7XHJcbiAgICAgIGlmICghcykgcmV0dXJuIG51bGw7XHJcbiAgICAgIGlmIChzLnN0YXJ0c1dpdGgoJ2h0dHAnKSkgcmV0dXJuIHM7XHJcbiAgICAgIGlmIChzLnN0YXJ0c1dpdGgoJy8nKSkgcmV0dXJuIGAke0FQSV9CQVNFLnJlcGxhY2UoL1xcLyQvLCAnJyl9JHtzfWA7XHJcbiAgICAgIGNvbnN0IGlkeCA9IHMuaW5kZXhPZignL1VwbG9hZHMvJyk7XHJcbiAgICAgIGlmIChpZHggPj0gMCkgcmV0dXJuIGAke0FQSV9CQVNFLnJlcGxhY2UoL1xcLyQvLCAnJyl9JHtzLnNsaWNlKGlkeCl9YDtcclxuICAgICAgLy8gZmFsbGJhY2s6IGFzc3VtZSBmaWxlbmFtZSB1bmRlciAvVXBsb2Fkcy9cclxuICAgICAgcmV0dXJuIGAke0FQSV9CQVNFLnJlcGxhY2UoL1xcLyQvLCAnJyl9L1VwbG9hZHMvJHtlbmNvZGVVUklDb21wb25lbnQocyl9YDtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2F2ZU5vdGUgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIXJlY29yZCkgcmV0dXJuO1xyXG4gICAgY29uc3Qgc3RhZ2VLZXkgPSBzdGFnZUtleUJ5TWV0YSgnQ291cnNlTm90ZScpO1xyXG4gICAgc2V0U2F2aW5nKHRydWUpO1xyXG4gICAgc2V0U3RhZ2VNZXNzYWdlKCfhnoDhn4bhnpbhnrvhnoThnprhnoDhn5Lhnp/hnrbhnpHhnrvhnoAuLi4nLCBzdGFnZUtleSk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBpZCA9IHJlY29yZC5faWQgfHwgcmVjb3JkLmlkO1xyXG4gICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICBjb25zdCBuZXdNZXRhID0geyAuLi4obWV0YSB8fCB7fSksIENvdXJzZU5vdGU6IGxlZnRDb250ZW50LCBDb3Vyc2VEYXRlOiBub3cudG9JU09TdHJpbmcoKSB9O1xyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCB1cGRhdGVGaWxlVHJhbnNmZXIoaWQsIHsgbWV0YTogbmV3TWV0YSB9KTtcclxuICAgICAgLy8gdXBkYXRlIGxvY2FsIHJlY29yZCB3aXRoIHJldHVybmVkIGl0ZW0gaWYgYXZhaWxhYmxlXHJcbiAgICAgIGNvbnN0IHVwZGF0ZWQgPSAocmVzICYmIChyZXMuaXRlbSB8fCByZXMpKSB8fCBudWxsO1xyXG4gICAgICBpZiAodXBkYXRlZCkge1xyXG4gICAgICAgIC8vIHNvbWUgZW5kcG9pbnRzIHJldHVybiB7IGl0ZW06IHVwZGF0ZWQgfVxyXG4gICAgICAgIHNldFJlY29yZCh1cGRhdGVkLml0ZW0gfHwgdXBkYXRlZCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gZmFsbGJhY2s6IHVwZGF0ZSBtZXRhIGxvY2FsbHlcclxuICAgICAgICBzZXRSZWNvcmQociA9PiAoeyAuLi4ociB8fCB7fSksIG1ldGE6IG5ld01ldGEgfSkpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6a4Z6A4Z+S4Z6f4Z624Z6R4Z674Z6A4Z6U4Z624Z6T4Z6f4Z6Y4Z+S4Z6a4Z+B4Z6FJywgc3RhZ2VLZXkpO1xyXG4gICAgICAvLyBzZXQgY2FwdHVyZWQgZGF0ZSB0byBub3cgb24gc3VjY2Vzc2Z1bCBzYXZlXHJcbiAgICAgIHNldENhcHR1cmVkRGF0ZShub3cpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzYXZlIG5vdGUnLCBlcnIpO1xyXG4gICAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GemuGegOGfkuGen+GetuGekeGeu+GegOGemOGet+Gek+GelOGetuGekyDigJQg4Z6f4Z684Z6Y4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4Z6Y4Z+S4Z6K4Z6E4Z6R4Z+A4Z6PJywgc3RhZ2VLZXkpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0U2F2aW5nKGZhbHNlKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBzYXZlRGVwdE5vdGUgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIXJlY29yZCkgcmV0dXJuO1xyXG4gICAgY29uc3Qgc3RhZ2VLZXkgPSBzdGFnZUtleUJ5TWV0YSgnQ291cnNlMk5vdGUnKTtcclxuICAgIHNldFNhdmluZyh0cnVlKTtcclxuICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6A4Z+G4Z6W4Z674Z6E4Z6a4Z6A4Z+S4Z6f4Z624Z6R4Z674Z6ALi4uJywgc3RhZ2VLZXkpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgaWQgPSByZWNvcmQuX2lkIHx8IHJlY29yZC5pZDtcclxuICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcclxuICAgICAgY29uc3QgbmV3TWV0YSA9IHsgLi4uKG1ldGEgfHwge30pLCBDb3Vyc2UyTm90ZTogZGVwdENvbnRlbnQsIENvdXJzZTJEYXRlOiBub3cudG9JU09TdHJpbmcoKSB9O1xyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCB1cGRhdGVGaWxlVHJhbnNmZXIoaWQsIHsgbWV0YTogbmV3TWV0YSB9KTtcclxuICAgICAgY29uc3QgdXBkYXRlZCA9IChyZXMgJiYgKHJlcy5pdGVtIHx8IHJlcykpIHx8IG51bGw7XHJcbiAgICAgIGlmICh1cGRhdGVkKSB7XHJcbiAgICAgICAgc2V0UmVjb3JkKHVwZGF0ZWQuaXRlbSB8fCB1cGRhdGVkKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzZXRSZWNvcmQociA9PiAoeyAuLi4ociB8fCB7fSksIG1ldGE6IG5ld01ldGEgfSkpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6a4Z6A4Z+S4Z6f4Z624Z6R4Z674Z6A4Z6U4Z624Z6T4Z6f4Z6Y4Z+S4Z6a4Z+B4Z6FJywgc3RhZ2VLZXkpO1xyXG4gICAgICBzZXRDYXB0dXJlZERhdGUobm93KTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2F2ZSBkZXB0IG5vdGUnLCBlcnIpO1xyXG4gICAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GemuGegOGfkuGen+GetuGekeGeu+GegOGemOGet+Gek+GelOGetuGekyDigJQg4Z6f4Z684Z6Y4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4Z6Y4Z+S4Z6K4Z6E4Z6R4Z+A4Z6PJywgc3RhZ2VLZXkpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0U2F2aW5nKGZhbHNlKTtcclxuICAgIH1cclxuXHJcbiAgfTtcclxuIFxyXG4gIC8vIHNhdmUgZGVwdXR5IG5vdGUgKERlcHV0eSBkaXJlY3RvcilcclxuICBjb25zdCBzYXZlQ291cnNlM05vdGUgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIXJlY29yZCkgcmV0dXJuO1xyXG4gICAgY29uc3Qgc3RhZ2VLZXkgPSBzdGFnZUtleUJ5TWV0YSgnQ291cnNlM05vdGUnKTtcclxuICAgIHNldFNhdmluZyh0cnVlKTtcclxuICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6A4Z+G4Z6W4Z674Z6E4Z6a4Z6A4Z+S4Z6f4Z624Z6R4Z674Z6ALi4uJywgc3RhZ2VLZXkpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgaWQgPSByZWNvcmQuX2lkIHx8IHJlY29yZC5pZDtcclxuICAgICAgLy8gU2F2ZSBkZXB1dHkgbm90ZSBhbmQgcmVjb3JkIHRoZSBkYXRlIGl0IHdhcyBmaWxsZWRcclxuICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcclxuICAgICAgY29uc3QgbmV3TWV0YSA9IHsgLi4uKG1ldGEgfHwge30pLCBDb3Vyc2UzTm90ZTogZGVwdXR5Q29udGVudCwgQ291cnNlM0RhdGU6IG5vdy50b0lTT1N0cmluZygpIH07XHJcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHVwZGF0ZUZpbGVUcmFuc2ZlcihpZCwgeyBtZXRhOiBuZXdNZXRhIH0pO1xyXG4gICAgICBjb25zdCB1cGRhdGVkID0gKHJlcyAmJiAocmVzLml0ZW0gfHwgcmVzKSkgfHwgbnVsbDtcclxuICAgICAgaWYgKHVwZGF0ZWQpIHtcclxuICAgICAgICBzZXRSZWNvcmQodXBkYXRlZC5pdGVtIHx8IHVwZGF0ZWQpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNldFJlY29yZChyID0+ICh7IC4uLihyIHx8IHt9KSwgbWV0YTogbmV3TWV0YSB9KSk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnprhnoDhn5Lhnp/hnrbhnpHhnrvhnoDhnpThnrbhnpPhnp/hnpjhn5Lhnprhn4HhnoUnLCBzdGFnZUtleSk7XHJcbiAgICAgIHNldENhcHR1cmVkRGF0ZShub3cpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzYXZlIGRlcHV0eSBub3RlJywgZXJyKTtcclxuICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnprhnoDhn5Lhnp/hnrbhnpHhnrvhnoDhnpjhnrfhnpPhnpThnrbhnpMg4oCUIOGen+GevOGemOGeluGfkuGemeGetuGemeGetuGemOGemOGfkuGeiuGehOGekeGfgOGejycsIHN0YWdlS2V5KTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldFNhdmluZyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2F2ZUNvdXJzZTROb3RlID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFyZWNvcmQpIHJldHVybjtcclxuICAgIGNvbnN0IHN0YWdlS2V5ID0gc3RhZ2VLZXlCeU1ldGEoJ0NvdXJzZTROb3RlJyk7XHJcbiAgICBzZXRTYXZpbmcodHJ1ZSk7XHJcbiAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GegOGfhuGeluGeu+GehOGemuGegOGfkuGen+GetuGekeGeu+GegC4uLicsIHN0YWdlS2V5KTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGlkID0gcmVjb3JkLl9pZCB8fCByZWNvcmQuaWQ7XHJcbiAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XHJcbiAgICAgIGNvbnN0IG5ld01ldGEgPSB7IC4uLihtZXRhIHx8IHt9KSwgQ291cnNlNE5vdGU6IGRlcHV0eVJpZ2h0Q29udGVudCwgQ291cnNlNERhdGU6IG5vdy50b0lTT1N0cmluZygpIH07XHJcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHVwZGF0ZUZpbGVUcmFuc2ZlcihpZCwgeyBtZXRhOiBuZXdNZXRhIH0pO1xyXG4gICAgICBjb25zdCB1cGRhdGVkID0gKHJlcyAmJiAocmVzLml0ZW0gfHwgcmVzKSkgfHwgbnVsbDtcclxuICAgICAgaWYgKHVwZGF0ZWQpIHtcclxuICAgICAgICBzZXRSZWNvcmQodXBkYXRlZC5pdGVtIHx8IHVwZGF0ZWQpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNldFJlY29yZChyID0+ICh7IC4uLihyIHx8IHt9KSwgbWV0YTogbmV3TWV0YSB9KSk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnprhnoDhn5Lhnp/hnrbhnpHhnrvhnoDhnpThnrbhnpPhnp/hnpjhn5Lhnprhn4HhnoUnLCBzdGFnZUtleSk7XHJcbiAgICAgIHNldENhcHR1cmVkRGF0ZShub3cpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzYXZlIGRlcHV0eSByaWdodCBub3RlJywgZXJyKTtcclxuICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnprhnoDhn5Lhnp/hnrbhnpHhnrvhnoDhnpjhnrfhnpPhnpThnrbhnpMg4oCUIOGen+GevOGemOGeluGfkuGemeGetuGemeGetuGemOGemOGfkuGeiuGehOGekeGfgOGejycsIHN0YWdlS2V5KTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldFNhdmluZyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gc2F2ZSBIZWFkIG9mIE9mZmljZSBub3RlXHJcbiAgY29uc3Qgc2F2ZUNvdXJzZTZOb3RlID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFyZWNvcmQpIHJldHVybjtcclxuICAgIGNvbnN0IHN0YWdlS2V5ID0gc3RhZ2VLZXlCeU1ldGEoJ0NvdXJzZTZOb3RlJyk7XHJcbiAgICBzZXRTYXZpbmcodHJ1ZSk7XHJcbiAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GegOGfhuGeluGeu+GehOGemuGegOGfkuGen+GetuGekeGeu+GegC4uLicsIHN0YWdlS2V5KTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGlkID0gcmVjb3JkLl9pZCB8fCByZWNvcmQuaWQ7XHJcbiAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XHJcbiAgICAgIGNvbnN0IG5ld01ldGEgPSB7IC4uLihtZXRhIHx8IHt9KSwgQ291cnNlNk5vdGU6IGhlYWRPZmZpY2VDb250ZW50LCBDb3Vyc2U2RGF0ZTogbm93LnRvSVNPU3RyaW5nKCkgfTtcclxuICAgICAgY29uc3QgcmVzID0gYXdhaXQgdXBkYXRlRmlsZVRyYW5zZmVyKGlkLCB7IG1ldGE6IG5ld01ldGEgfSk7XHJcbiAgICAgIGNvbnN0IHVwZGF0ZWQgPSAocmVzICYmIChyZXMuaXRlbSB8fCByZXMpKSB8fCBudWxsO1xyXG4gICAgICBpZiAodXBkYXRlZCkge1xyXG4gICAgICAgIHNldFJlY29yZCh1cGRhdGVkLml0ZW0gfHwgdXBkYXRlZCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2V0UmVjb3JkKHIgPT4gKHsgLi4uKHIgfHwge30pLCBtZXRhOiBuZXdNZXRhIH0pKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GemuGegOGfkuGen+GetuGekeGeu+GegOGelOGetuGek+Gen+GemOGfkuGemuGfgeGehScsIHN0YWdlS2V5KTtcclxuICAgICAgc2V0Q2FwdHVyZWREYXRlKG5vdyk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHNhdmUgaGVhZCBvZmZpY2Ugbm90ZScsIGVycik7XHJcbiAgICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6a4Z6A4Z+S4Z6f4Z624Z6R4Z674Z6A4Z6Y4Z634Z6T4Z6U4Z624Z6TIOKAlCDhnp/hnrzhnpjhnpbhn5Lhnpnhnrbhnpnhnrbhnpjhnpjhn5LhnorhnoThnpHhn4Dhno8nLCBzdGFnZUtleSk7XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICBzZXRTYXZpbmcoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHNhdmVDb3Vyc2U1Tm90ZSA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghcmVjb3JkKSByZXR1cm47XHJcbiAgICBjb25zdCBzdGFnZUtleSA9IHN0YWdlS2V5QnlNZXRhKCdDb3Vyc2U1Tm90ZScpO1xyXG4gICAgc2V0U2F2aW5nKHRydWUpO1xyXG4gICAgc2V0U3RhZ2VNZXNzYWdlKCfhnoDhn4bhnpbhnrvhnoThnprhnoDhn5Lhnp/hnrbhnpHhnrvhnoAuLi4nLCBzdGFnZUtleSk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBpZCA9IHJlY29yZC5faWQgfHwgcmVjb3JkLmlkO1xyXG4gICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICBjb25zdCBuZXdNZXRhID0geyAuLi4obWV0YSB8fCB7fSksIENvdXJzZTVOb3RlOiBkaXJlY3RvckNvbnRlbnQsIENvdXJzZTVEYXRlOiBub3cudG9JU09TdHJpbmcoKSB9O1xyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCB1cGRhdGVGaWxlVHJhbnNmZXIoaWQsIHsgbWV0YTogbmV3TWV0YSB9KTtcclxuICAgICAgY29uc3QgdXBkYXRlZCA9IChyZXMgJiYgKHJlcy5pdGVtIHx8IHJlcykpIHx8IG51bGw7XHJcbiAgICAgIGlmICh1cGRhdGVkKSB7XHJcbiAgICAgICAgc2V0UmVjb3JkKHVwZGF0ZWQuaXRlbSB8fCB1cGRhdGVkKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzZXRSZWNvcmQociA9PiAoeyAuLi4ociB8fCB7fSksIG1ldGE6IG5ld01ldGEgfSkpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6a4Z6A4Z+S4Z6f4Z624Z6R4Z674Z6A4Z6U4Z624Z6T4Z6f4Z6Y4Z+S4Z6a4Z+B4Z6FJywgc3RhZ2VLZXkpO1xyXG4gICAgICBzZXRDYXB0dXJlZERhdGUobm93KTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2F2ZSBkaXJlY3RvciBub3RlJywgZXJyKTtcclxuICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnprhnoDhn5Lhnp/hnrbhnpHhnrvhnoDhnpjhnrfhnpPhnpThnrbhnpMg4oCUIOGen+GevOGemOGeluGfkuGemeGetuGemeGetuGemOGemOGfkuGeiuGehOGekeGfgOGejycsIHN0YWdlS2V5KTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldFNhdmluZyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gZ2VuZXJpYyBzdGFnZSBzYXZlIGhlbHBlclxyXG4gIGNvbnN0IHNhdmVTdGFnZU5vdGUgPSBhc3luYyAobWV0YUtleSwgY29udGVudCkgPT4ge1xyXG4gICAgaWYgKCFyZWNvcmQpIHJldHVybjtcclxuICAgIGNvbnN0IHN0YWdlS2V5ID0gc3RhZ2VLZXlCeU1ldGEobWV0YUtleSk7XHJcbiAgICBzZXRTYXZpbmcodHJ1ZSk7XHJcbiAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GegOGfhuGeluGeu+GehOGemuGegOGfkuGen+GetuGekeGeu+GegC4uLicsIHN0YWdlS2V5KTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGlkID0gcmVjb3JkLl9pZCB8fCByZWNvcmQuaWQ7XHJcbiAgICAgIGNvbnN0IGRhdGVLZXkgPSBtZXRhS2V5LnJlcGxhY2UoJ05vdGUnLCAnRGF0ZScpO1xyXG4gICAgICBjb25zdCBuZXdNZXRhID0geyAuLi4obWV0YSB8fCB7fSksIFttZXRhS2V5XTogY29udGVudCwgW2RhdGVLZXldOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfTtcclxuICAgICAgY29uc3QgcmVzID0gYXdhaXQgdXBkYXRlRmlsZVRyYW5zZmVyKGlkLCB7IG1ldGE6IG5ld01ldGEgfSk7XHJcbiAgICAgIGNvbnN0IHVwZGF0ZWQgPSAocmVzICYmIChyZXMuaXRlbSB8fCByZXMpKSB8fCBudWxsO1xyXG4gICAgICBpZiAodXBkYXRlZCkge1xyXG4gICAgICAgIHNldFJlY29yZCh1cGRhdGVkLml0ZW0gfHwgdXBkYXRlZCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2V0UmVjb3JkKHIgPT4gKHsgLi4uKHIgfHwge30pLCBtZXRhOiBuZXdNZXRhIH0pKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GemuGegOGfkuGen+GetuGekeGeu+GegOGelOGetuGek+Gen+GemOGfkuGemuGfgeGehScsIHN0YWdlS2V5KTtcclxuICAgICAgc2V0Q2FwdHVyZWREYXRlKG5ldyBEYXRlKCkpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzYXZlIHN0YWdlIG5vdGUnLCBlcnIpO1xyXG4gICAgICBzZXRTdGFnZU1lc3NhZ2UoJ+GemuGegOGfkuGen+GetuGekeGeu+GegOGemOGet+Gek+GelOGetuGekyDigJQg4Z6f4Z684Z6Y4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4Z6Y4Z+S4Z6K4Z6E4Z6R4Z+A4Z6PJywgc3RhZ2VLZXkpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0U2F2aW5nKGZhbHNlKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICAvLyBzZW5kIHNhdmVkIGNvbW1lbnQvc3VtbWFyeSB0byBUZWxlZ3JhbSBmb3IgdGhpcyByZWNvcmRcclxuICBjb25zdCBzZW5kVG9UZWxlZ3JhbSA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghcmVjb3JkKSByZXR1cm47XHJcbiAgICBzZXRTYXZpbmcodHJ1ZSk7XHJcbiAgICBzZXRTdGFnZU1lc3NhZ2UoJycsIG51bGwpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgaWQgPSByZWNvcmQuX2lkIHx8IHJlY29yZC5pZDtcclxuICAgICAgLy8gRGVmYXVsdCBzZW5kIGlzIGZvciB0aGUgcHJpbWFyeSBzdGFnZSAoUykgc28gcmVwbGllcyBtYXAgdG8gQ291cnNlTm90ZVxyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBhcGkucG9zdChgL2ZpbGUtdHJhbnNmZXJzLyR7aWR9L3NlbmQtdGVsZWdyYW1gLCB7IHN0YWdlS2V5OiAncycgfSk7XHJcbiAgICAgIGlmIChyZXMgJiYgcmVzLmRhdGEgJiYgcmVzLmRhdGEuc3VjY2Vzcykge1xyXG4gICAgICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6U4Z624Z6T4Z6V4Z+S4Z6J4Z6+4Z6Y4Z6P4Z63JywgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnpXhn5Lhnonhnr7hnpjhnrfhnpPhnpThnrbhnpMg4oCUIOKAi+KAi+Gen+GevOGemOGeluGfkuGemeGetuGemeGetuGemOKAi+GemOGfkuGeiuGehOGekeGfgOGejycsIG51bGwpO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignc2VuZFRvVGVsZWdyYW0gZmFpbGVkJywgZXJyKTtcclxuICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnpXhn5Lhnonhnr7hnpjhnrfhnpPhnpThnrbhnpMg4oCUIOGen+GevOGemOGeluGfkuGemeGetuGemeGetuGemOGemOGfkuGeiuGehOGekeGfgOGejycsIG51bGwpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0U2F2aW5nKGZhbHNlKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICAvLyBDb25maXJtYXRpb24gbW9kYWwgc3RhdGUgZm9yIHN0YWdlIHNlbmRcclxuICBjb25zdCBbY29uZmlybVZpc2libGUsIHNldENvbmZpcm1WaXNpYmxlXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbY29uZmlybVN0YWdlS2V5LCBzZXRDb25maXJtU3RhZ2VLZXldID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgW2NvbmZpcm1BZHZhbmNlLCBzZXRDb25maXJtQWR2YW5jZV0gPSB1c2VTdGF0ZSh0cnVlKTtcclxuXHJcbiAgLy8gU2hvdyBjb25maXJtYXRpb24gVUkgYmVmb3JlIHNlbmRpbmcgYSBzdGFnZSBub3RlXHJcbiAgY29uc3Qgc2VuZFN0YWdlVG9UZWxlZ3JhbSA9IChzdGFnZUtleSkgPT4ge1xyXG4gICAgaWYgKCFyZWNvcmQpIHJldHVybjtcclxuICAgIHNldENvbmZpcm1TdGFnZUtleShzdGFnZUtleSk7XHJcbiAgICBzZXRDb25maXJtQWR2YW5jZSh0cnVlKTtcclxuICAgIHNldENvbmZpcm1WaXNpYmxlKHRydWUpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGRvU2VuZFN0YWdlID0gYXN5bmMgKHN0YWdlS2V5LCBhZHZhbmNlKSA9PiB7XHJcbiAgICBpZiAoIXJlY29yZCkgcmV0dXJuO1xyXG4gICAgc2V0Q29uZmlybVZpc2libGUoZmFsc2UpO1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZFN0YWdlS2V5ID0gU3RyaW5nKHN0YWdlS2V5IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgc2V0U2VuZGluZ1N0YWdlKG5vcm1hbGl6ZWRTdGFnZUtleSk7XHJcbiAgICBzZXRTdGFnZU1lc3NhZ2UoJycsIG5vcm1hbGl6ZWRTdGFnZUtleSk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBpZCA9IHJlY29yZC5faWQgfHwgcmVjb3JkLmlkO1xyXG4gICAgICBjb25zdCBwYXlsb2FkID0geyBzdGFnZUtleTogbm9ybWFsaXplZFN0YWdlS2V5IH07XHJcbiAgICAgIGlmIChhZHZhbmNlKSBwYXlsb2FkLmFkdmFuY2UgPSB0cnVlO1xyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBhcGkucG9zdChgL2ZpbGUtdHJhbnNmZXJzLyR7aWR9L3NlbmQtdGVsZWdyYW1gLCBwYXlsb2FkKTtcclxuICAgICAgaWYgKHJlcyAmJiByZXMuZGF0YSAmJiByZXMuZGF0YS5zdWNjZXNzKSB7XHJcbiAgICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnpThnrbhnpPhnpXhn5Lhnonhnr7hnpjhno/hnrcnLCBub3JtYWxpemVkU3RhZ2VLZXkpO1xyXG4gICAgICAgIGNvbnN0IHJlZnJlc2hlZCA9IGF3YWl0IGdldEZpbGVUcmFuc2ZlcihpZCk7XHJcbiAgICAgICAgaWYgKHJlZnJlc2hlZCkgc2V0UmVjb3JkKHJlZnJlc2hlZC5pdGVtIHx8IHJlZnJlc2hlZCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnpXhn5Lhnonhnr7hnpjhnrfhnpPhnpThnrbhnpMg4oCUIOGen+GevOGemOGeluGfkuGemeGetuGemeGetuGemOGemOGfkuGeiuGehOGekeGfgOGejycsIG5vcm1hbGl6ZWRTdGFnZUtleSk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdzZW5kU3RhZ2VUb1RlbGVncmFtIGZhaWxlZCcsIGVycik7XHJcbiAgICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6V4Z+S4Z6J4Z6+4Z6Y4Z634Z6T4Z6U4Z624Z6TIOKAlCDhnp/hnrzhnpjhnpbhn5Lhnpnhnrbhnpnhnrbhnpjhnpjhn5LhnorhnoThnpHhn4Dhno8nLCBub3JtYWxpemVkU3RhZ2VLZXkpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0U2VuZGluZ1N0YWdlKG51bGwpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8vIHJlY3JlYXRlIC8gY2xlYXIgYSBzdGFnZSBub3RlICh1c2VmdWwgdG8gcmVzZXQgYW5kIHN0YXJ0IGZyZXNoKVxyXG4gIGNvbnN0IHJlY3JlYXRlU3RhZ2VOb3RlID0gYXN5bmMgKG1ldGFLZXkpID0+IHtcclxuICAgIGlmICghcmVjb3JkKSByZXR1cm47XHJcbiAgICBjb25zdCBzdGFnZUtleSA9IHN0YWdlS2V5QnlNZXRhKG1ldGFLZXkpO1xyXG4gICAgc2V0U2F2aW5nKHRydWUpO1xyXG4gICAgc2V0U3RhZ2VNZXNzYWdlKCcnLCBzdGFnZUtleSk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBpZCA9IHJlY29yZC5faWQgfHwgcmVjb3JkLmlkO1xyXG4gICAgICAvLyBhbHNvIGNsZWFyIGNvcnJlc3BvbmRpbmcgZGF0ZSBrZXkgaWYgcHJlc2VudCAoQ291cnNlMURhdGUsIENvdXJzZTJEYXRlLCAuLi4pXHJcbiAgICAgIGNvbnN0IGRhdGVLZXkgPSBtZXRhS2V5LnJlcGxhY2UoJ05vdGUnLCAnRGF0ZScpO1xyXG4gICAgICBjb25zdCBuZXdNZXRhID0geyAuLi4obWV0YSB8fCB7fSksIFttZXRhS2V5XTogJycsIFtkYXRlS2V5XTogbnVsbCB9O1xyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCB1cGRhdGVGaWxlVHJhbnNmZXIoaWQsIHsgbWV0YTogbmV3TWV0YSB9KTtcclxuICAgICAgY29uc3QgdXBkYXRlZCA9IChyZXMgJiYgKHJlcy5pdGVtIHx8IHJlcykpIHx8IG51bGw7XHJcbiAgICAgIGlmICh1cGRhdGVkKSB7XHJcbiAgICAgICAgc2V0UmVjb3JkKHVwZGF0ZWQuaXRlbSB8fCB1cGRhdGVkKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzZXRSZWNvcmQociA9PiAoeyAuLi4ociB8fCB7fSksIG1ldGE6IG5ld01ldGEgfSkpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFN0YWdlTWVzc2FnZSgn4Z6U4Z624Z6T4Z6A4Z+G4Z6O4Z6P4Z+L4Z6h4Z6+4Z6E4Z6c4Z634Z6JJywgc3RhZ2VLZXkpO1xyXG4gICAgICAvLyBjbGVhciBsb2NhbCBzdGF0ZSBmb3IgdGhlIG1hdGNoaW5nIGtleVxyXG4gICAgICBpZiAobWV0YUtleSA9PT0gJ0NvdXJzZTFOb3RlJykgc2V0UzFDb250ZW50KCcnKTtcclxuICAgICAgaWYgKG1ldGFLZXkgPT09ICdDb3Vyc2VOb3RlJykgc2V0TGVmdENvbnRlbnQoJycpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byByZWNyZWF0ZSBzdGFnZSBub3RlJywgZXJyKTtcclxuICAgICAgc2V0U3RhZ2VNZXNzYWdlKCfhnpjhnrfhnpPhnpThnrbhnpPhnoDhn4bhno7hno/hn4vhnqHhnr7hnoThnpzhnrfhnokg4oCUIOGen+GevOGemOGeluGfkuGemeGetuGemeGetuGemOGemOGfkuGeiuGehOGekeGfgOGejycsIHN0YWdlS2V5KTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldFNhdmluZyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gS2htZXIgZGF0ZSBmb3JtYXR0aW5nIGhlbHBlcnNcclxuICBjb25zdCBLSE1FUl9ESUdJVFMgPSBbJ+GfoCcsJ+GfoScsJ+GfoicsJ+GfoycsJ+GfpCcsJ+GfpScsJ+GfpicsJ+GfpycsJ+GfqCcsJ+GfqSddO1xyXG4gIGNvbnN0IEtITUVSX01PTlRIUyA9IFsn4Z6Y4Z6A4Z6a4Z62Jywn4Z6A4Z674Z6Y4Z+S4Z6X4Z+IJywn4Z6Y4Z644Z6T4Z62Jywn4Z6Y4Z+B4Z6f4Z62Jywn4Z6n4Z6f4Z6X4Z62Jywn4Z6Y4Z634Z6Q4Z674Z6T4Z62Jywn4Z6A4Z6A4Z+S4Z6A4Z6K4Z62Jywn4Z6f4Z644Z6g4Z62Jywn4Z6A4Z6J4Z+S4Z6J4Z62Jywn4Z6P4Z674Z6b4Z62Jywn4Z6c4Z634Z6F4Z+S4Z6G4Z634Z6A4Z62Jywn4Z6S4Z+S4Z6T4Z68J107XHJcbiAgY29uc3QgdG9LaG1lckRpZ2l0cyA9IChudW0pID0+IHtcclxuICAgIGlmIChudW0gPT09IG51bGwgfHwgbnVtID09PSB1bmRlZmluZWQpIHJldHVybiAnJztcclxuICAgIGNvbnN0IHMgPSBTdHJpbmcobnVtKTtcclxuICAgIGxldCBvdXQgPSAnJztcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBjb25zdCBjaCA9IHMuY2hhckF0KGkpO1xyXG4gICAgICBpZiAoY2ggPj0gJzAnICYmIGNoIDw9ICc5Jykgb3V0ICs9IEtITUVSX0RJR0lUU1twYXJzZUludChjaCwgMTApXTtcclxuICAgICAgZWxzZSBvdXQgKz0gY2g7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gb3V0O1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGZvcm1hdEtobWVyRGF0ZSA9IChkKSA9PiB7XHJcbiAgICBpZiAoIWQpIHJldHVybiAnLi4uLi4uLi4nO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZGF5ID0gdG9LaG1lckRpZ2l0cyhkLmdldERhdGUoKSk7XHJcbiAgICAgIGNvbnN0IG1vbnRoID0gS0hNRVJfTU9OVEhTW2QuZ2V0TW9udGgoKV0gfHwgJyc7XHJcbiAgICAgIGNvbnN0IHllYXIgPSB0b0tobWVyRGlnaXRzKGQuZ2V0RnVsbFllYXIoKSk7XHJcbiAgICAgIHJldHVybiBg4Z6Q4Z+S4Z6E4Z+D4Z6R4Z64ICR7ZGF5fSAg4Z6B4Z+CICR7bW9udGh9ICDhnobhn5LhnpPhnrbhn4YgJHt5ZWFyfWA7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIHJldHVybiAnLi4uLi4uLi4nO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHBhZDIgPSAobikgPT4gKG4gPT09IG51bGwgfHwgbiA9PT0gdW5kZWZpbmVkID8gJycgOiAobiA8IDEwID8gYDAke259YCA6IFN0cmluZyhuKSkpO1xyXG4gIGNvbnN0IGZvcm1hdEtobWVyRGF0ZVRpbWUgPSAoZCkgPT4ge1xyXG4gICAgaWYgKCFkKSByZXR1cm4gJy4uLi4uLi4uJztcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGRhdGVQYXJ0ID0gZm9ybWF0S2htZXJEYXRlKGQpO1xyXG4gICAgICBjb25zdCBoaCA9IGQuZ2V0SG91cnMoKTtcclxuICAgICAgY29uc3QgbW0gPSBkLmdldE1pbnV0ZXMoKTtcclxuICAgICAgcmV0dXJuIGAke2RhdGVQYXJ0fSAg4Z6Y4Z+J4Z+E4Z6EICR7dG9LaG1lckRpZ2l0cyhwYWQyKGhoKSl9OiR7dG9LaG1lckRpZ2l0cyhwYWQyKG1tKSl9YDtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgcmV0dXJuIGZvcm1hdEtobWVyRGF0ZShkKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBhcHBseUVudHJ5VGltZSA9IChiYXNlRGF0ZSwgZW50cnlUaW1lKSA9PiB7XHJcbiAgICBpZiAoIWJhc2VEYXRlKSByZXR1cm4gbnVsbDtcclxuICAgIGNvbnN0IGNsb25lID0gbmV3IERhdGUoYmFzZURhdGUpO1xyXG4gICAgaWYgKCFlbnRyeVRpbWUgfHwgdHlwZW9mIGVudHJ5VGltZSAhPT0gJ3N0cmluZycpIHJldHVybiBjbG9uZTtcclxuICAgIGNvbnN0IHBhcnRzID0gZW50cnlUaW1lLnNwbGl0KCc6JykubWFwKHAgPT4gcGFyc2VJbnQocCwgMTApKTtcclxuICAgIGlmICghcGFydHMubGVuZ3RoKSByZXR1cm4gY2xvbmU7XHJcbiAgICBjb25zdCBbaGgsIG1tID0gMCwgc3MgPSAwXSA9IHBhcnRzO1xyXG4gICAgaWYgKCFOdW1iZXIuaXNOYU4oaGgpKSBjbG9uZS5zZXRIb3VycyhoaCwgTnVtYmVyLmlzTmFOKG1tKSA/IDAgOiBtbSwgTnVtYmVyLmlzTmFOKHNzKSA/IDAgOiBzcyk7XHJcbiAgICByZXR1cm4gY2xvbmU7XHJcbiAgfTtcclxuXHJcbiAgLy8gUGFyc2UgYSByYXcgZGF0ZSAoc3RyaW5nIG9yIERhdGUpIGFuZCwgZm9yIGRhdGUtb25seSAvIFVUQy1taWRuaWdodCB2YWx1ZXMsXHJcbiAgLy8gc2V0IHRoZSB0aW1lIHBvcnRpb24gdG8gdGhlIGN1cnJlbnQgbG9jYWwgdGltZSBzbyBwcmludGVkIHRpbWUgaXMgbWVhbmluZ2Z1bFxyXG4gIC8vIE9OTFkgd2hlbiBhbiBleHBsaWNpdCBgZW50cnlUaW1lYCBpcyBub3QgcHJvdmlkZWQuIElmIGBlbnRyeVRpbWVgIGV4aXN0cyxcclxuICAvLyBwcmVmZXIgdGhhdCB2YWx1ZSBhbmQgZG8gbm90IHN1YnN0aXR1dGUgYG5vd2AuXHJcbiAgY29uc3QgcGFyc2VQcmVmZXJMb2NhbFRpbWUgPSAocmF3LCBlbnRyeVRpbWUpID0+IHtcclxuICAgIGlmICghcmF3KSByZXR1cm4gbnVsbDtcclxuICAgIGNvbnN0IGQgPSAocmF3IGluc3RhbmNlb2YgRGF0ZSkgPyBuZXcgRGF0ZShyYXcuZ2V0VGltZSgpKSA6IG5ldyBEYXRlKHJhdyk7XHJcbiAgICB0cnkge1xyXG4gICAgICBsZXQgaXNEYXRlT25seSA9IGZhbHNlO1xyXG4gICAgICBpZiAodHlwZW9mIHJhdyA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICBpZiAoL1QwMDowMDowMCg/OlxcLjAwMCk/KD86WnxcXCswMDowMCk/JC8udGVzdChyYXcpKSBpc0RhdGVPbmx5ID0gdHJ1ZTtcclxuICAgICAgICBpZiAoL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QocmF3KSkgaXNEYXRlT25seSA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgICAgLy8gaWYgaXQncyBkYXRlLW9ubHkgb3IgbWlkbmlnaHQgVVRDLCBhcHBseSBsb2NhbCBjdXJyZW50IHRpbWUgb25seSB3aGVuXHJcbiAgICAgIC8vIHRoZXJlIGlzIG5vIGV4cGxpY2l0IGBlbnRyeVRpbWVgIHRvIGFwcGx5IGxhdGVyLiBUaGlzIHByZXZlbnRzIHNob3dpbmdcclxuICAgICAgLy8gYSB2YXJ5aW5nIFwibm93XCIgdGltZSB3aGVuIGFuIGFjdHVhbCByZWNvcmRlZCBgZW50cnlUaW1lYCBleGlzdHMuXHJcbiAgICAgIGlmICghZW50cnlUaW1lICYmIChpc0RhdGVPbmx5IHx8IChkLmdldEhvdXJzICYmIGQuZ2V0SG91cnMoKSA9PT0gMCAmJiBkLmdldE1pbnV0ZXMgJiYgZC5nZXRNaW51dGVzKCkgPT09IDAgJiYgLyg/Olp8XFwrMDA6MDApJC8udGVzdChTdHJpbmcocmF3KSkpKSkge1xyXG4gICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgZC5zZXRIb3Vycyhub3cuZ2V0SG91cnMoKSwgbm93LmdldE1pbnV0ZXMoKSwgbm93LmdldFNlY29uZHMoKSk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGUpIHt9XHJcbiAgICByZXR1cm4gZDtcclxuICB9O1xyXG5cclxuICAvLyBoZWxwZXI6IHJlc29sdmUgY3JlYXRvcidzIGRpc3BsYXkgbmFtZSBmcm9tIHJlY29yZFxyXG4gIGNvbnN0IGNyZWF0b3JOYW1lID0gKCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgaWYgKCFyZWNvcmQpIHJldHVybiAnJztcclxuICAgICAgLy8gcHJlZmVyIHN0cnVjdHVyZWQgYGNyZWF0ZWRCeWAgb2JqZWN0IGlmIHByZXNlbnRcclxuICAgICAgY29uc3QgY2IgPSByZWNvcmQuY3JlYXRlZEJ5O1xyXG4gICAgICBpZiAoY2IgJiYgdHlwZW9mIGNiID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIHJldHVybiBjYi5mdWxsTmFtZSB8fCBjYi5mdWxsTmFtZUtoIHx8IGNiLm5hbWUgfHwgY2IudXNlcm5hbWUgfHwgJyc7XHJcbiAgICAgIH1cclxuICAgICAgLy8gaWYgY3JlYXRlZEJ5IGlzIGEgc2NhbGFyIGlkLCB0cnkgc2lnbmF0dXJlc01hcCBsb29rdXBcclxuICAgICAgaWYgKGNiICYmICh0eXBlb2YgY2IgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBjYiA9PT0gJ251bWJlcicpKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHNpZyA9IHNpZ25hdHVyZXNNYXAgJiYgc2lnbmF0dXJlc01hcFtjYl07XHJcbiAgICAgICAgICBpZiAoc2lnKSByZXR1cm4gc2lnLmZ1bGxOYW1lS2ggfHwgc2lnLmZ1bGxOYW1lIHx8IHNpZy5uYW1lIHx8IFN0cmluZyhjYik7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge31cclxuICAgICAgfVxyXG4gICAgICAvLyBuZXh0IHByZWZlciBleHBsaWNpdCBjcmVhdGVkQnlOYW1lIG9yIHJlcG9ydGVyTmFtZSBpbiBtZXRhXHJcbiAgICAgIGlmIChyZWNvcmQuY3JlYXRlZEJ5TmFtZSkgcmV0dXJuIHJlY29yZC5jcmVhdGVkQnlOYW1lO1xyXG4gICAgICBpZiAocmVjb3JkLnJlcG9ydGVyKSByZXR1cm4gcmVjb3JkLnJlcG9ydGVyO1xyXG4gICAgICBpZiAobWV0YSAmJiBtZXRhLnJlcG9ydGVyTmFtZSkgcmV0dXJuIG1ldGEucmVwb3J0ZXJOYW1lO1xyXG4gICAgICAvLyBmYWxsYmFjayB0byBjcmVhdGVkQnkgc2NhbGFyXHJcbiAgICAgIGlmIChyZWNvcmQuY3JlYXRlZEJ5KSByZXR1cm4gcmVjb3JkLmNyZWF0ZWRCeTtcclxuICAgICAgcmV0dXJuICcnO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICByZXR1cm4gJyc7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gaGVscGVyOiBnZXQgYSBEYXRlIG9iamVjdCBmcm9tIG1ldGEgZm9yIGtleXMgbGlrZSAnQ291cnNlM0RhdGUnXHJcbiAgY29uc3QgZGF0ZUZvck1ldGFLZXkgPSAoa2V5KSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBpZiAoIW1ldGEgfHwgIWtleSkgcmV0dXJuIG51bGw7XHJcbiAgICAgIGNvbnN0IHYgPSBtZXRhW2tleV07XHJcbiAgICAgIGlmICghdikgcmV0dXJuIG51bGw7XHJcbiAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSh2KTtcclxuICAgICAgaWYgKGlzTmFOKGQuZ2V0VGltZSgpKSkgcmV0dXJuIG51bGw7XHJcbiAgICAgIHJldHVybiBkO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICAvLyByZWNpcGllbnQgc2lnbmF0dXJlIGZyb20gZmVlZGJhY2tTdGFnZXMuUzFcclxuICBcclxuICBjb25zdCBzaWdTID0gc2lnRm9yICYmIHNpZ0ZvcignUycpO1xyXG4gIGNvbnN0IHNpZzEgPSBzaWdGb3IgJiYgc2lnRm9yKCdTMScpO1xyXG4gIGNvbnN0IHNpZzIgPSBzaWdGb3IgJiYgc2lnRm9yKCdTMicpO1xyXG4gIGNvbnN0IHNpZzMgPSBzaWdGb3IgJiYgc2lnRm9yKCdTMycpO1xyXG4gIGNvbnN0IHNpZzFVcmwgPSBzaWduYXR1cmVVcmwoc2lnMSk7XHJcbiAgY29uc3Qgc2lnU1VybCA9IHNpZ25hdHVyZVVybChzaWdTKTtcclxuICBjb25zdCBzaWcyVXJsID0gc2lnbmF0dXJlVXJsKHNpZzIpO1xyXG4gIGNvbnN0IHNpZzNVcmwgPSBzaWduYXR1cmVVcmwoc2lnMyk7XHJcbiAgLy8gZGVwdXR5IHNpZ25hdHVyZTogcHJlZmVyICdTRCcgKGRlcHV0eSkgdGhlbiBmYWxsYmFjayB0byBTMyBpZiBwcmVzZW50XHJcbiAgY29uc3Qgc2lnRGVwdXR5ID0gc2lnRm9yICYmIChzaWdGb3IoJ1NEJykgfHwgc2lnRm9yKCdTMycpKTtcclxuICBjb25zdCBzaWdEZXB1dHlVcmwgPSBzaWduYXR1cmVVcmwoc2lnRGVwdXR5KTtcclxuICAvLyByaWdodCBkZXB1dHkgc2lnbmF0dXJlOiBwcmVmZXIgJ1NEUicgdGhlbiBmYWxsYmFjayB0byBTNCBvciBTM1xyXG4gIGNvbnN0IHNpZ0RlcHV0eVJpZ2h0ID0gc2lnRm9yICYmIChzaWdGb3IoJ1NEUicpIHx8IHNpZ0ZvcignUzQnKSB8fCBzaWdGb3IoJ1MzJykpO1xyXG4gIGNvbnN0IHNpZ0RlcHV0eVJpZ2h0VXJsID0gc2lnbmF0dXJlVXJsKHNpZ0RlcHV0eVJpZ2h0KTtcclxuICAvLyBkaXJlY3RvciBzaWduYXR1cmU6IHByZWZlciAnRElSJyBvciAnU0RJUicsIGZhbGxiYWNrIHRvIFM1XHJcbiAgY29uc3Qgc2lnRGlyZWN0b3IgPSBzaWdGb3IgJiYgKHNpZ0ZvcignRElSJykgfHwgc2lnRm9yKCdTRElSJykgfHwgc2lnRm9yKCdTNScpKTtcclxuICBjb25zdCBzaWdEaXJlY3RvclVybCA9IHNpZ25hdHVyZVVybChzaWdEaXJlY3Rvcik7XHJcbiAgLy8gaGVhZCBvZiBvZmZpY2Ugc2lnbmF0dXJlOiBwcmVmZXIgJ0hPJyB0aGVuIHByZWZlciBTNiAoc3RhZ2UgNiksIHRoZW4gZmFsbGJhY2sgdG8gUzQvUzNcclxuICBjb25zdCBzaWdIZWFkT2ZmaWNlID0gc2lnRm9yICYmIChzaWdGb3IoJ0hPJykgfHwgc2lnRm9yKCdTNicpIHx8IHNpZ0ZvcignUzQnKSB8fCBzaWdGb3IoJ1MzJykpO1xyXG4gIGNvbnN0IHNpZ0hlYWRPZmZpY2VVcmwgPSBzaWduYXR1cmVVcmwoc2lnSGVhZE9mZmljZSk7XHJcbiAgY29uc3QgaGFzQ291cnNlTm90ZSA9IEJvb2xlYW4oKG1ldGEgJiYgbWV0YS5Db3Vyc2VOb3RlKSB8fCAobGVmdENvbnRlbnQgJiYgbGVmdENvbnRlbnQudHJpbSgpICE9PSAnJykpO1xyXG4gIGNvbnN0IGhhc0NvdXJzZTFOb3RlID0gQm9vbGVhbigobWV0YSAmJiBtZXRhLkNvdXJzZTFOb3RlKSB8fCAoczFDb250ZW50ICYmIHMxQ29udGVudC50cmltKCkgIT09ICcnKSk7XHJcbiAgY29uc3QgaGFzRGVwdE5vdGUgPSBCb29sZWFuKChtZXRhICYmIG1ldGEuQ291cnNlMk5vdGUpIHx8IChkZXB0Q29udGVudCAmJiBkZXB0Q29udGVudC50cmltKCkgIT09ICcnKSk7XHJcbiAgY29uc3QgaGFzRGVwdXR5ID0gQm9vbGVhbigobWV0YSAmJiBtZXRhLkNvdXJzZTNOb3RlKSB8fCAoZGVwdXR5Q29udGVudCAmJiBkZXB1dHlDb250ZW50LnRyaW0oKSAhPT0gJycpKTtcclxuICBjb25zdCBoYXNEZXB1dHlSaWdodCA9IEJvb2xlYW4oKG1ldGEgJiYgbWV0YS5Db3Vyc2U0Tm90ZSkgfHwgKGRlcHV0eVJpZ2h0Q29udGVudCAmJiBkZXB1dHlSaWdodENvbnRlbnQudHJpbSgpICE9PSAnJykpO1xyXG4gIGNvbnN0IGhhc0hlYWRPZmZpY2UgPSBCb29sZWFuKChtZXRhICYmIG1ldGEuQ291cnNlNk5vdGUpIHx8IChoZWFkT2ZmaWNlQ29udGVudCAmJiBoZWFkT2ZmaWNlQ29udGVudC50cmltKCkgIT09ICcnKSk7XHJcbiAgY29uc3QgaGFzRGlyZWN0b3IgPSBCb29sZWFuKChtZXRhICYmIG1ldGEuQ291cnNlNU5vdGUpIHx8IChkaXJlY3RvckNvbnRlbnQgJiYgZGlyZWN0b3JDb250ZW50LnRyaW0oKSAhPT0gJycpKTtcclxuXHJcbiAgLy8gSWYgYW55IHZpc2libGUgbm90ZSBleGlzdHMgYnV0IHdlIGRvbid0IHlldCBoYXZlIGEgY2FwdHVyZWQgZGF0ZSwgZGVmYXVsdCBpdCB0byBub3dcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgaWYgKCFjYXB0dXJlZERhdGUgJiYgKGhhc0NvdXJzZU5vdGUgfHwgaGFzRGVwdE5vdGUgfHwgaGFzRGVwdXR5IHx8IGhhc0RlcHV0eVJpZ2h0IHx8IGhhc0hlYWRPZmZpY2UgfHwgaGFzRGlyZWN0b3IpKSB7XHJcbiAgICAgICAgc2V0Q2FwdHVyZWREYXRlKG5ldyBEYXRlKCkpO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIC8vIGlnbm9yZVxyXG4gICAgfVxyXG4gIH0sIFtjYXB0dXJlZERhdGUsIGhhc0NvdXJzZU5vdGUsIGhhc0RlcHROb3RlLCBoYXNEZXB1dHksIGhhc0RlcHV0eVJpZ2h0LCBoYXNIZWFkT2ZmaWNlLCBoYXNEaXJlY3Rvcl0pO1xyXG5cclxuICAvLyBLZWVwIHRoZSByZWYtcGFuZWwgcHJldmlldyB0aGUgc2FtZSBwaXhlbCBzaXplIGFzIHRoZSBsZWZ0IHNoZWV0IHNvIHpvb20vc2NhbGUgbWF0Y2hcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgbGV0IG1vdW50ZWQgPSB0cnVlO1xyXG4gICAgY29uc3QgZ2V0U2hlZXQgPSAoKSA9PiAoc2hlZXRSZWYgJiYgc2hlZXRSZWYuY3VycmVudCkgfHwgbnVsbDtcclxuICAgIGNvbnN0IGdldFByZXZpZXcgPSAoKSA9PiAocmVmUHJldmlld1dyYXBwZXIgJiYgcmVmUHJldmlld1dyYXBwZXIuY3VycmVudCkgfHwgbnVsbDtcclxuXHJcbiAgICBjb25zdCBzeW5jUHJldmlld1NpemUgPSAoKSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcCA9IGdldFByZXZpZXcoKTtcclxuICAgICAgICBpZiAoIXApIHJldHVybjtcclxuICAgICAgICAvLyBLZWVwIHRoZSBwcmV2aWV3IHdyYXBwZXIgc2l6ZWQgdG8gQTQgQ1NTIGRpbWVuc2lvbnMgYW5kIGFsbG93IGl0IHRvIGV4cGFuZCB2ZXJ0aWNhbGx5XHJcbiAgICAgICAgcC5zdHlsZS53aWR0aCA9ICcyMTBtbSc7XHJcbiAgICAgICAgcC5zdHlsZS5oZWlnaHQgPSAnYXV0byc7XHJcbiAgICAgICAgcC5zdHlsZS5vdmVyZmxvdyA9ICd2aXNpYmxlJztcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIC8vIGlnbm9yZVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIGluaXRpYWwgc3luY1xyXG4gICAgc3luY1ByZXZpZXdTaXplKCk7XHJcblxyXG4gICAgLy8gdXNlIFJlc2l6ZU9ic2VydmVyIHdoZW4gYXZhaWxhYmxlIHRvIGRldGVjdCBlbGVtZW50IHJlc2l6ZXMgKHpvb20sIGxheW91dCBjaGFuZ2VzKVxyXG4gICAgbGV0IHJvID0gbnVsbDtcclxuICAgIHRyeSB7XHJcbiAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuUmVzaXplT2JzZXJ2ZXIpIHtcclxuICAgICAgICBybyA9IG5ldyB3aW5kb3cuUmVzaXplT2JzZXJ2ZXIoKCkgPT4geyBpZiAobW91bnRlZCkgc3luY1ByZXZpZXdTaXplKCk7IH0pO1xyXG4gICAgICAgIGNvbnN0IHMgPSBnZXRTaGVldCgpO1xyXG4gICAgICAgIGlmIChzKSByby5vYnNlcnZlKHMpO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIHJvID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICAvLyB3aW5kb3cgcmVzaXplIGhhbmRsZXIgKHZpZXdwb3J0IHJlc2l6ZSlcclxuICAgIGNvbnN0IG9uUmVzaXplID0gKCkgPT4geyBpZiAobW91bnRlZCkgc3luY1ByZXZpZXdTaXplKCk7IH07XHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgb25SZXNpemUpO1xyXG5cclxuICAgIC8vIHBvbGxpbmcgZmFsbGJhY2sgZm9yIGNhc2VzIHdoZXJlIFJlc2l6ZU9ic2VydmVyIG9yIHJlc2l6ZSBldmVudHMgZG9uJ3QgY2F0Y2ggem9vbS9zY2FsZSBjaGFuZ2VzXHJcbiAgICBsZXQgbGFzdFJlY3QgPSBudWxsO1xyXG4gICAgY29uc3QgcG9sbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBzID0gZ2V0U2hlZXQoKTtcclxuICAgICAgICBpZiAoIXMpIHJldHVybjtcclxuICAgICAgICBjb25zdCByID0gcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICBpZiAoIWxhc3RSZWN0IHx8IHIud2lkdGggIT09IGxhc3RSZWN0LndpZHRoIHx8IHIuaGVpZ2h0ICE9PSBsYXN0UmVjdC5oZWlnaHQpIHtcclxuICAgICAgICAgIGxhc3RSZWN0ID0gcjtcclxuICAgICAgICAgIGlmIChtb3VudGVkKSBzeW5jUHJldmlld1NpemUoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAvLyBpZ25vcmVcclxuICAgICAgfVxyXG4gICAgfSwgMjUwKTtcclxuXHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBtb3VudGVkID0gZmFsc2U7XHJcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCBvblJlc2l6ZSk7XHJcbiAgICAgIHRyeSB7IGlmIChybykgcm8uZGlzY29ubmVjdCgpOyB9IGNhdGNoIChlKSB7fVxyXG4gICAgICB0cnkgeyBjbGVhckludGVydmFsKHBvbGwpOyB9IGNhdGNoIChlKSB7fVxyXG4gICAgfTtcclxuICB9LCBbc2hlZXRSZWYsIHJlZlByZXZpZXdXcmFwcGVyLCB1aUZvbnRTaXplLCB1aUxpbmVIZWlnaHQsIHVpUGFkZGluZ1RvcCwgc2VsZWN0ZWRSZWZdKTtcclxuXHJcbiAgLy8gUmVuZGVyIHNlbGVjdGVkIHJlZmVyZW5jZSBQREYgaW50byBgcmVmUHJldmlld1dyYXBwZXJgIGFzIEE0IGNhbnZhc2VzXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxldCBtb3VudGVkID0gdHJ1ZTtcclxuICAgIGxldCBsb2FkaW5nVGFzayA9IG51bGw7XHJcbiAgICBjb25zdCBjb250YWluZXIgPSAocmVmUHJldmlld1dyYXBwZXIgJiYgcmVmUHJldmlld1dyYXBwZXIuY3VycmVudCkgfHwgbnVsbDtcclxuICAgIGlmICghY29udGFpbmVyKSByZXR1cm4gdW5kZWZpbmVkO1xyXG5cclxuICAgIC8vIGNsZWFyIHByZXZpb3VzIHByZXZpZXdcclxuICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuXHJcbiAgICBpZiAoIXNlbGVjdGVkUmVmKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgaXNQZGYgPSBTdHJpbmcoc2VsZWN0ZWRSZWYpLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoJy5wZGYnKTtcclxuICAgIGlmICghaXNQZGYpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG4gICAgKGFzeW5jICgpID0+IHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICAvLyBkeW5hbWljIGltcG9ydCBzbyBidW5kbGVycyBoYW5kbGUgcGRmanMgY29ycmVjdGx5XHJcbiAgICAgICAgY29uc3QgcGRmanMgPSAoYXdhaXQgaW1wb3J0KCdwZGZqcy1kaXN0L2xlZ2FjeS9idWlsZC9wZGYnKSk7XHJcbiAgICAgICAgY29uc3QgcGRmanNMaWIgPSBwZGZqcyAmJiAocGRmanMuZGVmYXVsdCB8fCBwZGZqcyk7XHJcblxyXG4gICAgICAgIC8vIFByZWZlciBzZXJ2aW5nIHRoZSBwZGYud29ya2VyIGZyb20gdGhlIHNhbWUgb3JpZ2luIHRvIGF2b2lkIENPUlMgZXJyb3JzXHJcbiAgICAgICAgLy8gKGNvcHkgYG5vZGVfbW9kdWxlcy9wZGZqcy1kaXN0L2J1aWxkL3BkZi53b3JrZXIubWluLmpzYCAtPiBgcHVibGljL3BkZi53b3JrZXIubWluLmpzYCkuXHJcbiAgICAgICAgLy8gSWYgYSBsb2NhbCB3b3JrZXIgaXNuJ3QgYXZhaWxhYmxlLCBmYWxsIGJhY2sgdG8gdGhlIENETiB3b3JrZXIuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24gJiYgd2luZG93LmxvY2F0aW9uLm9yaWdpbikge1xyXG4gICAgICAgICAgICBjb25zdCBsb2NhbFdvcmtlciA9IGAke3dpbmRvdy5sb2NhdGlvbi5vcmlnaW59L3BkZi53b3JrZXIubWluLmpzYDtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBjb25zdCBoZWFkID0gYXdhaXQgZmV0Y2gobG9jYWxXb3JrZXIsIHsgbWV0aG9kOiAnSEVBRCcgfSk7XHJcbiAgICAgICAgICAgICAgaWYgKGhlYWQgJiYgaGVhZC5vaykge1xyXG4gICAgICAgICAgICAgICAgcGRmanNMaWIuR2xvYmFsV29ya2VyT3B0aW9ucy53b3JrZXJTcmMgPSBsb2NhbFdvcmtlcjtcclxuICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcGRmanNMaWIuR2xvYmFsV29ya2VyT3B0aW9ucy53b3JrZXJTcmMgPSBwZGZqc0xpYi5HbG9iYWxXb3JrZXJPcHRpb25zLndvcmtlclNyYyB8fCAnaHR0cHM6Ly91bnBrZy5jb20vcGRmanMtZGlzdC9idWlsZC9wZGYud29ya2VyLm1pbi5qcyc7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgcGRmanNMaWIuR2xvYmFsV29ya2VyT3B0aW9ucy53b3JrZXJTcmMgPSBwZGZqc0xpYi5HbG9iYWxXb3JrZXJPcHRpb25zLndvcmtlclNyYyB8fCAnaHR0cHM6Ly91bnBrZy5jb20vcGRmanMtZGlzdC9idWlsZC9wZGYud29ya2VyLm1pbi5qcyc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHBkZmpzTGliLkdsb2JhbFdvcmtlck9wdGlvbnMud29ya2VyU3JjID0gcGRmanNMaWIuR2xvYmFsV29ya2VyT3B0aW9ucy53b3JrZXJTcmMgfHwgJ2h0dHBzOi8vdW5wa2cuY29tL3BkZmpzLWRpc3QvYnVpbGQvcGRmLndvcmtlci5taW4uanMnO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgIC8vIGlnbm9yZVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gVHJ5IGZldGNoaW5nIHRoZSBQREYgYXMgYSBibG9iIGZpcnN0IHVzaW5nIENPUlMgKGhlbHBzIGF2b2lkIHdvcmtlciBmZXRjaCBwcm9ibGVtcykuXHJcbiAgICAgICAgLy8gSWYgdGhlIGZldGNoIGlzIGJsb2NrZWQgYnkgQ09SUyBvciBmYWlscywgZmFsbCBiYWNrIHRvIGVtYmVkZGluZyBhbiBpZnJhbWUgc28gdGhlIHVzZXIgY2FuIHZpZXcgdGhlIFBERi5cclxuICAgICAgICBsZXQgcGRmID0gbnVsbDtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2VsZWN0ZWRSZWYsIHsgbW9kZTogJ2NvcnMnIH0pO1xyXG4gICAgICAgICAgaWYgKHJlcyAmJiByZXMub2spIHtcclxuICAgICAgICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IHJlcy5ibG9iKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGFycmF5QnVmID0gYXdhaXQgYmxvYi5hcnJheUJ1ZmZlcigpO1xyXG4gICAgICAgICAgICBsb2FkaW5nVGFzayA9IHBkZmpzTGliLmdldERvY3VtZW50KHsgZGF0YTogYXJyYXlCdWYgfSk7XHJcbiAgICAgICAgICAgIHBkZiA9IGF3YWl0IGxvYWRpbmdUYXNrLnByb21pc2U7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBpZiBzZXJ2ZXIgcmV0dXJuZWQgbm9uLU9LIChlLmcuIDQwNC80MDMpIG9yIG5vIENPUlMsIGZhbGwgYmFjayB0byBpZnJhbWVcclxuICAgICAgICAgICAgY29uc3QgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XHJcbiAgICAgICAgICAgIGlmcmFtZS5zcmMgPSBzZWxlY3RlZFJlZjtcclxuICAgICAgICAgICAgaWZyYW1lLnN0eWxlLndpZHRoID0gJzIxMG1tJztcclxuICAgICAgICAgICAgaWZyYW1lLnN0eWxlLmhlaWdodCA9ICcyOTdtbSc7XHJcbiAgICAgICAgICAgIGlmcmFtZS5zdHlsZS5ib3JkZXIgPSAnMCc7XHJcbiAgICAgICAgICAgIGlmcmFtZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcclxuICAgICAgICAgICAgaWZyYW1lLnN0eWxlLm1hcmdpbiA9ICcwIGF1dG8gMTBtbSc7XHJcbiAgICAgICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChpZnJhbWUpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZmV0Y2hFcnIpIHtcclxuICAgICAgICAgIC8vIGxpa2VseSBDT1JTIG9yIG5ldHdvcmsgZXJyb3Ig4oCUIGVtYmVkIGFuIGlmcmFtZSBzbyB0aGUgdXNlciBjYW4gc3RpbGwgdmlldyB0aGUgUERGXHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcclxuICAgICAgICAgICAgaWZyYW1lLnNyYyA9IHNlbGVjdGVkUmVmO1xyXG4gICAgICAgICAgICBpZnJhbWUuc3R5bGUud2lkdGggPSAnMjEwbW0nO1xyXG4gICAgICAgICAgICBpZnJhbWUuc3R5bGUuaGVpZ2h0ID0gJzI5N21tJztcclxuICAgICAgICAgICAgaWZyYW1lLnN0eWxlLmJvcmRlciA9ICcwJztcclxuICAgICAgICAgICAgaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xyXG4gICAgICAgICAgICBpZnJhbWUuc3R5bGUubWFyZ2luID0gJzAgYXV0byAxMG1tJztcclxuICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGlmcmFtZSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgLy8gaWYgZXZlbiBpZnJhbWUgaW5zZXJ0aW9uIGZhaWxzLCBwcm9wYWdhdGUgb3JpZ2luYWwgZmV0Y2hFcnJcclxuICAgICAgICAgICAgdGhyb3cgZmV0Y2hFcnI7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGxldCBwID0gMTsgcCA8PSBwZGYubnVtUGFnZXM7IHArKykge1xyXG4gICAgICAgICAgaWYgKCFtb3VudGVkKSBicmVhaztcclxuICAgICAgICAgIGNvbnN0IHBhZ2UgPSBhd2FpdCBwZGYuZ2V0UGFnZShwKTtcclxuXHJcbiAgICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcclxuICAgICAgICAgIGNhbnZhcy5zdHlsZS53aWR0aCA9ICcyMTBtbSc7XHJcbiAgICAgICAgICBjYW52YXMuc3R5bGUuaGVpZ2h0ID0gJzI5N21tJztcclxuICAgICAgICAgIGNhbnZhcy5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcclxuICAgICAgICAgIGNhbnZhcy5zdHlsZS5tYXJnaW4gPSAnMCBhdXRvIDEwbW0nO1xyXG4gICAgICAgICAgY2FudmFzLnN0eWxlLmJveFNpemluZyA9ICdib3JkZXItYm94JztcclxuICAgICAgICAgIGNhbnZhcy5zdHlsZS5wYWdlQnJlYWtBZnRlciA9ICdhbHdheXMnO1xyXG4gICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGNhbnZhcyk7XHJcblxyXG4gICAgICAgICAgY29uc3QgRFBSID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvKSA/IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIDogMTtcclxuICAgICAgICAgIGNvbnN0IGNzc1dpZHRoID0gY2FudmFzLmNsaWVudFdpZHRoIHx8ICgoMjEwIC8gMjUuNCkgKiA5Nik7XHJcbiAgICAgICAgICBjb25zdCBiYXNlVmlld3BvcnQgPSBwYWdlLmdldFZpZXdwb3J0KHsgc2NhbGU6IDEgfSk7XHJcbiAgICAgICAgICBjb25zdCBzY2FsZSA9IGNzc1dpZHRoIC8gYmFzZVZpZXdwb3J0LndpZHRoO1xyXG4gICAgICAgICAgY29uc3QgcmVuZGVyVmlld3BvcnQgPSBwYWdlLmdldFZpZXdwb3J0KHsgc2NhbGUgfSk7XHJcblxyXG4gICAgICAgICAgY2FudmFzLndpZHRoID0gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcihyZW5kZXJWaWV3cG9ydC53aWR0aCAqIERQUikpO1xyXG4gICAgICAgICAgY2FudmFzLmhlaWdodCA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IocmVuZGVyVmlld3BvcnQuaGVpZ2h0ICogRFBSKSk7XHJcblxyXG4gICAgICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XHJcbiAgICAgICAgICBpZiAoY3R4ICYmIGN0eC5zZXRUcmFuc2Zvcm0pIGN0eC5zZXRUcmFuc2Zvcm0oRFBSLCAwLCAwLCBEUFIsIDAsIDApO1xyXG5cclxuICAgICAgICAgIGF3YWl0IHBhZ2UucmVuZGVyKHsgY2FudmFzQ29udGV4dDogY3R4LCB2aWV3cG9ydDogcmVuZGVyVmlld3BvcnQgfSkucHJvbWlzZTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIHJlbmRlciBQREYgcHJldmlldycsIGVycik7XHJcbiAgICAgICAgaWYgKGNvbnRhaW5lciAmJiBtb3VudGVkKSB7XHJcbiAgICAgICAgICBjb25zdCBtc2cgPSAoZXJyICYmIGVyci5tZXNzYWdlKSA/IFN0cmluZyhlcnIubWVzc2FnZSkgOiBTdHJpbmcoZXJyIHx8ICdVbmtub3duIGVycm9yJyk7XHJcbiAgICAgICAgICBjb25zdCBkZXRhaWxzID0gYEZhaWxlZCB0byByZW5kZXIgUERGIHByZXZpZXdcXG5VUkw6ICR7c2VsZWN0ZWRSZWZ9XFxuRXJyb3I6ICR7bXNnfWA7XHJcbiAgICAgICAgICBjb250YWluZXIuaW5uZXJIVE1MID0gYDxkaXYgc3R5bGU9XCJjb2xvcjojYTAwO3BhZGRpbmc6OHB4O3doaXRlLXNwYWNlOnByZS13cmFwXCI+JHtkZXRhaWxzfTwvZGl2PmA7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KSgpO1xyXG5cclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIG1vdW50ZWQgPSBmYWxzZTtcclxuICAgICAgdHJ5IHsgaWYgKGxvYWRpbmdUYXNrICYmIGxvYWRpbmdUYXNrLmRlc3Ryb3kpIGxvYWRpbmdUYXNrLmRlc3Ryb3koKTsgfSBjYXRjaCAoZSkge31cclxuICAgIH07XHJcbiAgfSwgW3NlbGVjdGVkUmVmXSk7XHJcblxyXG4gIC8vIGhlbHBlcjogZGV0ZXJtaW5lIGlmIGEgc3RhZ2UgKG9yIGxpc3Qgb2Ygc3RhZ2Uga2V5cykgaGFzIGEgc2VuZGVyIG5hbWUgYXZhaWxhYmxlXHJcbiAgY29uc3Qgc3RhZ2VIYXNTZW5kZXJGb3JLZXlzID0gKGtleXMpID0+IHtcclxuICAgIGlmICghbm9ybWFsaXplZFN0YWdlcykgcmV0dXJuIGZhbHNlO1xyXG4gICAgZm9yIChjb25zdCBrIG9mIChrZXlzIHx8IFtdKSkge1xyXG4gICAgICBjb25zdCByYXcgPSBub3JtYWxpemVkU3RhZ2VzW2tdO1xyXG4gICAgICBpZiAoIXJhdykgY29udGludWU7XHJcbiAgICAgIC8vIHJhdyBtYXkgYmUgYW4gb2JqZWN0IHdpdGggc2VuZGVyTmFtZS9zZW5kZXIvbmFtZVxyXG4gICAgICBpZiAodHlwZW9mIHJhdyA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICBpZiAocmF3LnNlbmRlck5hbWUgfHwgcmF3LnNlbmRlciB8fCByYXcubmFtZSkgcmV0dXJuIHRydWU7XHJcbiAgICAgIH1cclxuICAgICAgLy8gcmVzb2x2ZSBpZCBhbmQgY2hlY2sgc2lnbmF0dXJlc01hcCBmb3IgYSBuYW1lXHJcbiAgICAgIGNvbnN0IGlkID0gcmVzb2x2ZVN0YWdlSWQocmF3KTtcclxuICAgICAgaWYgKGlkICYmIHNpZ25hdHVyZXNNYXAgJiYgc2lnbmF0dXJlc01hcFtpZF0pIHtcclxuICAgICAgICBjb25zdCBzID0gc2lnbmF0dXJlc01hcFtpZF07XHJcbiAgICAgICAgaWYgKHMgJiYgKHMuZnVsbE5hbWVLaCB8fCBzLmZ1bGxOYW1lIHx8IHMubmFtZSkpIHJldHVybiB0cnVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfTtcclxuXHJcbiAgLy8gbWFwIHN0YWdlIGtleXMgdG8gbWV0YSBub3RlIGtleXNcclxuICBjb25zdCBzdGFnZVRvTWV0YUtleSA9IHtcclxuICAgIFM6ICdDb3Vyc2VOb3RlJyxcclxuICAgIFMxOiAnQ291cnNlMU5vdGUnLFxyXG4gICAgUzI6ICdDb3Vyc2UyTm90ZScsXHJcbiAgICBTRDogJ0NvdXJzZTNOb3RlJyxcclxuICAgIFMzOiAnQ291cnNlM05vdGUnLFxyXG4gICAgU0RSOiAnQ291cnNlNE5vdGUnLFxyXG4gICAgUzQ6ICdDb3Vyc2U0Tm90ZScsXHJcbiAgICBTNTogJ0NvdXJzZTVOb3RlJyxcclxuICAgIERJUjogJ0NvdXJzZTVOb3RlJyxcclxuICAgIFNESVI6ICdDb3Vyc2U1Tm90ZScsXHJcbiAgICBTNjogJ0NvdXJzZTZOb3RlJyxcclxuICAgIEhPOiAnQ291cnNlNk5vdGUnXHJcbiAgfTtcclxuXHJcbiAgLy8gRGV0ZXJtaW5lIHdoaWNoIGJ1Y2tldHMgKFMsIFMxLi5TNikgZXhpc3QgYW5kIGNvbXB1dGUgd2hpY2ggc2hvdWxkIGJlIHZpc2libGVcclxuICBjb25zdCB2aXNpYmxlU3RhZ2VzID0gdXNlTWVtbygoKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBidWNrZXRzID0gW1xyXG4gICAgICAgIHsga2V5OiAnUycsIHZhcmlhbnRzOiBbJ1MnXSwgbWV0YUtleTogJ0NvdXJzZU5vdGUnLCBsb2NhbDogbGVmdENvbnRlbnQgfSxcclxuICAgICAgICB7IGtleTogJ1MxJywgdmFyaWFudHM6IFsnUzEnXSwgbWV0YUtleTogJ0NvdXJzZTFOb3RlJywgbG9jYWw6IHMxQ29udGVudCB9LFxyXG4gICAgICAgIHsga2V5OiAnUzInLCB2YXJpYW50czogWydTMiddLCBtZXRhS2V5OiAnQ291cnNlMk5vdGUnLCBsb2NhbDogZGVwdENvbnRlbnQgfSxcclxuICAgICAgICB7IGtleTogJ1MzJywgdmFyaWFudHM6IFsnU0QnLCdTMyddLCBtZXRhS2V5OiAnQ291cnNlM05vdGUnLCBsb2NhbDogZGVwdXR5Q29udGVudCB9LFxyXG4gICAgICAgIHsga2V5OiAnUzQnLCB2YXJpYW50czogWydTRFInLCdTNCddLCBtZXRhS2V5OiAnQ291cnNlNE5vdGUnLCBsb2NhbDogZGVwdXR5UmlnaHRDb250ZW50IH0sXHJcbiAgICAgICAgeyBrZXk6ICdTNScsIHZhcmlhbnRzOiBbJ1M1JywnRElSJywnU0RJUiddLCBtZXRhS2V5OiAnQ291cnNlNU5vdGUnLCBsb2NhbDogZGlyZWN0b3JDb250ZW50IH0sXHJcbiAgICAgICAgeyBrZXk6ICdTNicsIHZhcmlhbnRzOiBbJ1M2JywnSE8nXSwgbWV0YUtleTogJ0NvdXJzZTZOb3RlJywgbG9jYWw6IGhlYWRPZmZpY2VDb250ZW50IH1cclxuICAgICAgXTtcclxuXHJcbiAgICAgIGNvbnN0IHZhcmlhbnRTZWxlY3RlZCA9ICh2YXJpYW50cykgPT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBmb3IgKGNvbnN0IGsgb2YgKHZhcmlhbnRzIHx8IFtdKSkge1xyXG4gICAgICAgICAgICBjb25zdCByYXcgPSBub3JtYWxpemVkU3RhZ2VzICYmIG5vcm1hbGl6ZWRTdGFnZXNba107XHJcbiAgICAgICAgICAgIGlmIChyYXcgIT09IHVuZGVmaW5lZCAmJiByYXcgIT09IG51bGwgJiYgcmF3ICE9PSAnJykgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge31cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBsb2NhbEhhc05vdGUgPSAobWV0YUtleSwgbG9jYWxWYWwpID0+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKGxvY2FsVmFsICYmIFN0cmluZyhsb2NhbFZhbCkudHJpbSgpICE9PSAnJykgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICBjb25zdCB2ID0gbWV0YSAmJiBtZXRhW21ldGFLZXldO1xyXG4gICAgICAgICAgaWYgKHYgJiYgU3RyaW5nKHYpLnRyaW0oKSAhPT0gJycpIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHt9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgLy8gcHJlc2VudCBidWNrZXRzIGFyZSB0aG9zZSB0aGF0IGFyZSBhc3NpZ25lZCBPUiBoYXZlIGEgbm90ZVxyXG4gICAgICBjb25zdCBwcmVzZW50ID0gYnVja2V0cy5tYXAoYiA9PiAoeyBidWNrZXQ6IGIsIHByZXNlbnQ6IHZhcmlhbnRTZWxlY3RlZChiLnZhcmlhbnRzKSB8fCBsb2NhbEhhc05vdGUoYi5tZXRhS2V5LCBiLmxvY2FsKSB9KSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcih4ID0+IHgucHJlc2VudClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCh4ID0+IHguYnVja2V0KTtcclxuXHJcbiAgICAgIGlmICghcHJlc2VudCB8fCBwcmVzZW50Lmxlbmd0aCA9PT0gMCkgcmV0dXJuIG5ldyBTZXQoKTtcclxuXHJcbiAgICAgIC8vIGF0dGFjaCB0aW1lc3RhbXBzIGZyb20gbWV0YSBDb3Vyc2VYRGF0ZSBmaWVsZHMgd2hlbiBhdmFpbGFibGVcclxuICAgICAgY29uc3Qgd2l0aERhdGVzID0gcHJlc2VudC5tYXAoYiA9PiB7XHJcbiAgICAgICAgY29uc3QgZGF0ZUtleSA9IFN0cmluZyhiLm1ldGFLZXkpLnJlcGxhY2UoL05vdGUkL2ksICdEYXRlJyk7XHJcbiAgICAgICAgbGV0IHRzID0gbnVsbDtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgcmF3ID0gbWV0YSAmJiBtZXRhW2RhdGVLZXldO1xyXG4gICAgICAgICAgaWYgKHJhdykge1xyXG4gICAgICAgICAgICBjb25zdCBkID0gbmV3IERhdGUocmF3KTtcclxuICAgICAgICAgICAgaWYgKCFpc05hTihkLmdldFRpbWUoKSkpIHRzID0gZC5nZXRUaW1lKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyB0cyA9IG51bGw7IH1cclxuICAgICAgICByZXR1cm4geyBrZXk6IGIua2V5LCB0cywgYnVja2V0OiBiIH07XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gRGVjaWRlIG9yZGVyaW5nIHN0cmF0ZWd5OlxyXG4gICAgICAvLyAtIElmIGF0IGxlYXN0IG9uZSBwcmVzZW50IGJ1Y2tldCBoYXMgYSBzYXZlZCBDb3Vyc2VYTm90ZSwgdXNlIHRpbWVzdGFtcHNcclxuICAgICAgLy8gICAoQ291cnNlWERhdGUpIHRvIGRldGVybWluZSBzZW5kIG9yZGVyLlxyXG4gICAgICAvLyAtIElmIG5vIG5vdGVzIGV4aXN0IHlldCwgcHJlc2VydmUgY2Fub25pY2FsIGJ1Y2tldCBvcmRlciBzbyB0aGUgVUlcclxuICAgICAgLy8gICBzdGFydHMgYXQgdGhlIGZpcnN0IGFzc2lnbmVkIHN0YWdlIChhdm9pZCBzaG93aW5nIFM2IGZpcnN0IGR1ZSB0b1xyXG4gICAgICAvLyAgIHN0YWxlL2F1dG8gdGltZXN0YW1wcykuXHJcbiAgICAgIGNvbnN0IG9yZGVyS2V5cyA9IGJ1Y2tldHMubWFwKGIgPT4gYi5rZXkpO1xyXG4gICAgICBjb25zdCBoYXNBbnlTYXZlZE5vdGUgPSBwcmVzZW50LnNvbWUoYiA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHYgPSBtZXRhICYmIG1ldGFbYi5tZXRhS2V5XTtcclxuICAgICAgICAgIHJldHVybiB2ICYmIFN0cmluZyh2KS50cmltKCkgIT09ICcnO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgcmV0dXJuIGZhbHNlOyB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKGhhc0FueVNhdmVkTm90ZSkge1xyXG4gICAgICAgIHdpdGhEYXRlcy5zb3J0KChhLCB6KSA9PiB7XHJcbiAgICAgICAgICBpZiAoYS50cyAhPT0gbnVsbCAmJiB6LnRzICE9PSBudWxsKSByZXR1cm4gYS50cyAtIHoudHM7XHJcbiAgICAgICAgICBpZiAoYS50cyAhPT0gbnVsbCAmJiB6LnRzID09PSBudWxsKSByZXR1cm4gLTE7XHJcbiAgICAgICAgICBpZiAoYS50cyA9PT0gbnVsbCAmJiB6LnRzICE9PSBudWxsKSByZXR1cm4gMTtcclxuICAgICAgICAgIHJldHVybiBvcmRlcktleXMuaW5kZXhPZihhLmtleSkgLSBvcmRlcktleXMuaW5kZXhPZih6LmtleSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gcHJlc2VydmUgY2Fub25pY2FsIG9yZGVyIHdoZW4gdGhlcmUgYXJlIG5vIHNhdmVkIG5vdGVzXHJcbiAgICAgICAgd2l0aERhdGVzLnNvcnQoKGEsIHopID0+IG9yZGVyS2V5cy5pbmRleE9mKGEua2V5KSAtIG9yZGVyS2V5cy5pbmRleE9mKHoua2V5KSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFNob3cgYWxsIHByZXNlbnQvb3JkZXJlZCBidWNrZXRzIChkbyBub3QgbGltaXQgdG8gYSBzaW5nbGUgc3RhZ2UpXHJcbiAgICAgIGNvbnN0IG9yZGVyZWRCdWNrZXRzID0gd2l0aERhdGVzLm1hcCh4ID0+IHguYnVja2V0KTtcclxuICAgICAgaWYgKCFvcmRlcmVkQnVja2V0cyB8fCBvcmRlcmVkQnVja2V0cy5sZW5ndGggPT09IDApIHJldHVybiBuZXcgU2V0KCk7XHJcbiAgICAgIHJldHVybiBuZXcgU2V0KG9yZGVyZWRCdWNrZXRzLm1hcChiID0+IGIua2V5KSk7XHJcbiAgICB9IGNhdGNoIChlKSB7IHJldHVybiBuZXcgU2V0KCk7IH1cclxuICB9LCBbbm9ybWFsaXplZFN0YWdlcywgbGVmdENvbnRlbnQsIHMxQ29udGVudCwgZGVwdENvbnRlbnQsIGRlcHV0eUNvbnRlbnQsIGRlcHV0eVJpZ2h0Q29udGVudCwgZGlyZWN0b3JDb250ZW50LCBoZWFkT2ZmaWNlQ29udGVudCwgc2lnbmF0dXJlc01hcCwgbWV0YV0pO1xyXG5cclxuICAvLyBTdGFnZXMgdGhhdCBoYXZlIGFjdHVhbGx5IHNlbnQgZmVlZGJhY2sgKG5vdGUgZXhpc3RzKVxyXG4gIGNvbnN0IHN0YWdlc1dpdGhGZWVkYmFjayA9IHVzZU1lbW8oKCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgaGFzVGV4dCA9ICh2KSA9PiB2ICE9PSBudWxsICYmIHYgIT09IHVuZGVmaW5lZCAmJiBTdHJpbmcodikudHJpbSgpICE9PSAnJztcclxuICAgICAgY29uc3Qgc2VudCA9IG5ldyBTZXQoKTtcclxuICAgICAgaWYgKGhhc1RleHQobGVmdENvbnRlbnQpIHx8IGhhc1RleHQobWV0YSAmJiBtZXRhLkNvdXJzZU5vdGUpKSBzZW50LmFkZCgnUycpO1xyXG4gICAgICBpZiAoaGFzVGV4dChzMUNvbnRlbnQpIHx8IGhhc1RleHQobWV0YSAmJiBtZXRhLkNvdXJzZTFOb3RlKSkgc2VudC5hZGQoJ1MxJyk7XHJcbiAgICAgIGlmIChoYXNUZXh0KGRlcHRDb250ZW50KSB8fCBoYXNUZXh0KG1ldGEgJiYgbWV0YS5Db3Vyc2UyTm90ZSkpIHNlbnQuYWRkKCdTMicpO1xyXG4gICAgICBpZiAoaGFzVGV4dChkZXB1dHlDb250ZW50KSB8fCBoYXNUZXh0KG1ldGEgJiYgbWV0YS5Db3Vyc2UzTm90ZSkpIHNlbnQuYWRkKCdTMycpO1xyXG4gICAgICBpZiAoaGFzVGV4dChkZXB1dHlSaWdodENvbnRlbnQpIHx8IGhhc1RleHQobWV0YSAmJiBtZXRhLkNvdXJzZTROb3RlKSkgc2VudC5hZGQoJ1M0Jyk7XHJcbiAgICAgIGlmIChoYXNUZXh0KGRpcmVjdG9yQ29udGVudCkgfHwgaGFzVGV4dChtZXRhICYmIG1ldGEuQ291cnNlNU5vdGUpKSBzZW50LmFkZCgnUzUnKTtcclxuICAgICAgaWYgKGhhc1RleHQoaGVhZE9mZmljZUNvbnRlbnQpIHx8IGhhc1RleHQobWV0YSAmJiBtZXRhLkNvdXJzZTZOb3RlKSkgc2VudC5hZGQoJ1M2Jyk7XHJcbiAgICAgIHJldHVybiBzZW50O1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICByZXR1cm4gbmV3IFNldCgpO1xyXG4gICAgfVxyXG4gIH0sIFttZXRhLCBsZWZ0Q29udGVudCwgczFDb250ZW50LCBkZXB0Q29udGVudCwgZGVwdXR5Q29udGVudCwgZGVwdXR5UmlnaHRDb250ZW50LCBkaXJlY3RvckNvbnRlbnQsIGhlYWRPZmZpY2VDb250ZW50XSk7XHJcblxyXG4gIGNvbnN0IHN0YWdlS2V5c0ZvclNldHRpbmdzID0gdXNlTWVtbygoKSA9PiB7XHJcbiAgICAvLyBBbHdheXMgc2hvdyBhbGwgc3RhZ2UgdG9nZ2xlcyAoUywgUzEuLlM2KSBpbiB0aGUgc2V0dGluZ3MgcGFuZWwgc29cclxuICAgIC8vIHRoZSB1c2VyIGNhbiBjb250cm9sIHZpc2liaWxpdHkgZXZlbiBpZiBhIHN0YWdlIGhhc24ndCB5ZXQgc2VudCBmZWVkYmFjay5cclxuICAgIHJldHVybiBTVEFHRV9UT0dHTEVfS0VZUztcclxuICB9LCBbXSk7XHJcblxyXG4gIC8vIGhlbHBlcjogZmluZCB0aGUgZmlyc3Qgc3RhZ2UgdGhhdCBpcyBhc3NpZ25lZCBidXQgd2hvc2UgY29ycmVzcG9uZGluZyBDb3Vyc2Ugbm90ZSBpcyBzdGlsbCBlbXB0eVxyXG4gIGNvbnN0IHdhaXRpbmdTdGFnZVNlbmRlciA9IHVzZU1lbW8oKCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgaWYgKCFub3JtYWxpemVkU3RhZ2VzKSByZXR1cm4gbnVsbDtcclxuICAgICAgY29uc3Qgb3JkZXIgPSBbJ1MnLCdTMScsJ1MyJywnU0QnLCdTRFInLCdTMycsJ1M0JywnUzUnLCdTNiddO1xyXG4gICAgICBmb3IgKGNvbnN0IGsgb2Ygb3JkZXIpIHtcclxuICAgICAgICBjb25zdCByYXcgPSBub3JtYWxpemVkU3RhZ2VzW2tdO1xyXG4gICAgICAgIGlmICghcmF3KSBjb250aW51ZTtcclxuICAgICAgICBjb25zdCBtZXRhS2V5ID0gc3RhZ2VUb01ldGFLZXlba107XHJcbiAgICAgICAgY29uc3QgbWV0YVZhbCA9IChtZXRhICYmIG1ldGFbbWV0YUtleV0pIHx8ICcnO1xyXG4gICAgICAgIC8vIHBpY2sgY29ycmVzcG9uZGluZyBsb2NhbCBjb250ZW50IGZvciBxdWljayBjaGVja1xyXG4gICAgICAgIGxldCBsb2NhbCA9ICcnO1xyXG4gICAgICAgIGlmIChtZXRhS2V5ID09PSAnQ291cnNlTm90ZScpIGxvY2FsID0gbGVmdENvbnRlbnQgfHwgJyc7XHJcbiAgICAgICAgZWxzZSBpZiAobWV0YUtleSA9PT0gJ0NvdXJzZTFOb3RlJykgbG9jYWwgPSBzMUNvbnRlbnQgfHwgJyc7XHJcbiAgICAgICAgZWxzZSBpZiAobWV0YUtleSA9PT0gJ0NvdXJzZTJOb3RlJykgbG9jYWwgPSBkZXB0Q29udGVudCB8fCAnJztcclxuICAgICAgICBlbHNlIGlmIChtZXRhS2V5ID09PSAnQ291cnNlM05vdGUnKSBsb2NhbCA9IGRlcHV0eUNvbnRlbnQgfHwgJyc7XHJcbiAgICAgICAgZWxzZSBpZiAobWV0YUtleSA9PT0gJ0NvdXJzZTROb3RlJykgbG9jYWwgPSBkZXB1dHlSaWdodENvbnRlbnQgfHwgJyc7XHJcbiAgICAgICAgZWxzZSBpZiAobWV0YUtleSA9PT0gJ0NvdXJzZTZOb3RlJykgbG9jYWwgPSBoZWFkT2ZmaWNlQ29udGVudCB8fCAnJztcclxuICAgICAgICBlbHNlIGlmIChtZXRhS2V5ID09PSAnQ291cnNlNk5vdGUnKSBsb2NhbCA9IGRpcmVjdG9yQ29udGVudCB8fCAnJztcclxuXHJcbiAgICAgICAgaWYgKFN0cmluZyhtZXRhVmFsIHx8ICcnKS50cmltKCkgPT09ICcnICYmIFN0cmluZyhsb2NhbCB8fCAnJykudHJpbSgpID09PSAnJykge1xyXG4gICAgICAgICAgLy8gdGhpcyBzdGFnZSBpcyB3YWl0aW5nIGZvciBhIG5vdGVcclxuICAgICAgICAgIC8vIGlmIHJhdyBpcyBvYmplY3QsIHRyeSBzZW5kZXJOYW1lXHJcbiAgICAgICAgICBpZiAodHlwZW9mIHJhdyA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgY29uc3QgbiA9IHJhdy5zZW5kZXJOYW1lIHx8IHJhdy5zZW5kZXIgfHwgcmF3Lm5hbWU7XHJcbiAgICAgICAgICAgIGlmIChuKSByZXR1cm4gYCR7bn0gKCR7a30pYDtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGNvbnN0IGlkID0gcmVzb2x2ZVN0YWdlSWQocmF3KTtcclxuICAgICAgICAgIGlmIChpZCAmJiBzaWduYXR1cmVzTWFwICYmIHNpZ25hdHVyZXNNYXBbaWRdKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHMgPSBzaWduYXR1cmVzTWFwW2lkXTtcclxuICAgICAgICAgICAgY29uc3QgbiA9IChzICYmIChzLmZ1bGxOYW1lS2ggfHwgcy5mdWxsTmFtZSB8fCBzLm5hbWUpKTtcclxuICAgICAgICAgICAgaWYgKG4pIHJldHVybiBgJHtufSAoJHtrfSlgO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgLy8gZmFsbGJhY2sgdG8gc3RhZ2Uga2V5IGlmIG5vdGhpbmcgZWxzZVxyXG4gICAgICAgICAgcmV0dXJuIGBTdGFnZSAke2t9YDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGUpIHt9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9LCBbbm9ybWFsaXplZFN0YWdlcywgbWV0YSwgbGVmdENvbnRlbnQsIGRlcHRDb250ZW50LCBkZXB1dHlDb250ZW50LCBkZXB1dHlSaWdodENvbnRlbnQsIGRpcmVjdG9yQ29udGVudCwgaGVhZE9mZmljZUNvbnRlbnQsIHNpZ25hdHVyZXNNYXBdKTtcclxuXHJcbiAgLy8gQSBjbGVhbmVkIHZlcnNpb24gb2Ygd2FpdGluZ1N0YWdlU2VuZGVyIHdpdGggYW55IHRyYWlsaW5nIFwiIChTeClcIiByZW1vdmVkIGZvciBkaXNwbGF5XHJcbiAgY29uc3Qgd2FpdGluZ1N0YWdlU2VuZGVyQ2xlYW4gPSB1c2VNZW1vKCgpID0+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGlmICghd2FpdGluZ1N0YWdlU2VuZGVyKSByZXR1cm4gbnVsbDtcclxuICAgICAgcmV0dXJuIFN0cmluZyh3YWl0aW5nU3RhZ2VTZW5kZXIpLnJlcGxhY2UoL1xccypcXChbXildK1xcKVxccyokLywgJycpLnRyaW0oKTtcclxuICAgIH0gY2F0Y2ggKGUpIHsgcmV0dXJuIHdhaXRpbmdTdGFnZVNlbmRlcjsgfVxyXG4gIH0sIFt3YWl0aW5nU3RhZ2VTZW5kZXJdKTtcclxuXHJcbiAgLy8gaGVscGVyOiBjaGVjayB3aGV0aGVyIHRoZSBjdXJyZW50IGxvZ2dlZC1pbiB1c2VyIGlzIHRoZSBhc3NpZ25lZCBzZW5kZXIgZm9yIGFueSBvZiB0aGUgZ2l2ZW4gc3RhZ2Uga2V5c1xyXG4gIGNvbnN0IGlzQXNzaWduZWRUb1N0YWdlID0gKGtleXMpID0+IHtcclxuICAgICAgICAvLyBBZG1pbiB1c2VycyBtYXkgZWRpdCBhbGwgc3RhZ2VzXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGlmIChwZXJtcyAmJiBwZXJtcy5jYW5FZGl0RG9jdW1lbnRzKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAvLyBpZ25vcmVcclxuICAgICAgICB9XHJcbiAgICB0cnkge1xyXG4gICAgICBpZiAoIW5vcm1hbGl6ZWRTdGFnZXMgfHwgIWN1cnJlbnRVc2VyKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZSA9ICh2KSA9PiAodiB8fCAnJykudG9TdHJpbmcoKS5ub3JtYWxpemUgPyB2LnRvU3RyaW5nKCkubm9ybWFsaXplKCdORktEJykucmVwbGFjZSgvXFxwe0RpYWNyaXRpY30vZ3UsICcnKSA6ICh2IHx8ICcnKS50b1N0cmluZygpO1xyXG4gICAgICBjb25zdCBub3JtID0gKHYpID0+IG5vcm1hbGl6ZSh2KS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcclxuICAgICAgY29uc3QgdXNlck5hbWVzID0gW2N1cnJlbnRVc2VyLm5hbWUsIGN1cnJlbnRVc2VyLmZ1bGxOYW1lLCBjdXJyZW50VXNlci5mdWxsTmFtZUtoXS5maWx0ZXIoQm9vbGVhbikubWFwKHMgPT4gbm9ybShzKSk7XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IGsgb2YgKGtleXMgfHwgW10pKSB7XHJcbiAgICAgICAgY29uc3QgcmF3ID0gbm9ybWFsaXplZFN0YWdlc1trXTtcclxuICAgICAgICBpZiAoIXJhdykgY29udGludWU7XHJcbiAgICAgICAgLy8gb2JqZWN0IHdpdGggc2VuZGVyTmFtZS9zZW5kZXIvbmFtZVxyXG4gICAgICAgIGlmICh0eXBlb2YgcmF3ID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgY29uc3QgY2FuZGlkYXRlID0gKHJhdy5zZW5kZXJOYW1lIHx8IHJhdy5zZW5kZXIgfHwgcmF3Lm5hbWUgfHwgJycpLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICBpZiAodXNlck5hbWVzLmluY2x1ZGVzKG5vcm0oY2FuZGlkYXRlKSkpIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyB0cnkgcmVzb2x2ZSBpZCAtPiBzaWduYXR1cmUgcmVjb3JkXHJcbiAgICAgICAgICBjb25zdCBpZCA9IHJlc29sdmVTdGFnZUlkKHJhdyk7XHJcbiAgICAgICAgICBpZiAoaWQgJiYgc2lnbmF0dXJlc01hcCAmJiBzaWduYXR1cmVzTWFwW2lkXSkge1xyXG4gICAgICAgICAgICBjb25zdCBzID0gc2lnbmF0dXJlc01hcFtpZF07XHJcbiAgICAgICAgICAgIGNvbnN0IGNhbmQgPSAocy5mdWxsTmFtZUtoIHx8IHMuZnVsbE5hbWUgfHwgcy5uYW1lIHx8ICcnKS50b1N0cmluZygpO1xyXG4gICAgICAgICAgICBpZiAodXNlck5hbWVzLmluY2x1ZGVzKG5vcm0oY2FuZCkpKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIC8vIGZhbGxiYWNrOiBjb21wYXJlIHJhdyBzdHJpbmcgZGlyZWN0bHkgdG8gdXNlciBuYW1lc1xyXG4gICAgICAgICAgaWYgKHVzZXJOYW1lcy5pbmNsdWRlcyhub3JtKHJhdykpKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgLy8gaWdub3JlXHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfTtcclxuXHJcbiAgXHJcbiAgLy8gV2hlbiB0cnVlLCBzaG93IHBsYWNlaG9sZGVyIHN0YWdlIGJveGVzIGV2ZW4gaWYgbm8gc3RhZ2UgYXNzaWdubWVudHMgb3Igbm90ZXMgZXhpc3RcclxuICAvLyBTZXQgdG8gZmFsc2Ugc28gcGxhY2Vob2xkZXJzIG9ubHkgYXBwZWFyIHdoZW4gZmVlZGJhY2sgc3RhZ2VzL25vdGVzIGV4aXN0XHJcbiAgLy8gaGVscGVyOiBjaGVjayB3aGV0aGVyIGFueSBvZiB0aGUgc3RhZ2UgZHJvcGRvd25zIHdlcmUgYWN0dWFsbHkgc2VsZWN0ZWRcclxuICBjb25zdCBzdGFnZVNlbGVjdGVkID0gKGtleXMpID0+IHtcclxuICAgIGlmICghbm9ybWFsaXplZFN0YWdlcykgcmV0dXJuIGZhbHNlO1xyXG4gICAgZm9yIChjb25zdCBrIG9mIChrZXlzIHx8IFtdKSkge1xyXG4gICAgICBjb25zdCByYXcgPSBub3JtYWxpemVkU3RhZ2VzW2tdO1xyXG4gICAgICBpZiAocmF3ICE9PSB1bmRlZmluZWQgJiYgcmF3ICE9PSBudWxsICYmIHJhdyAhPT0gJycpIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH07XHJcblxyXG4gIC8vIGhlbHBlcjogc2hvdyBpZiBtZXRhIGhhcyBhIHNhdmVkIG5vdGUgb3IgbG9jYWwgY29udGVudCBleGlzdHNcclxuICBjb25zdCBoYXNOb3RlID0gKG1ldGFLZXksIGNvbnRlbnQpID0+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGlmIChjb250ZW50ICYmIFN0cmluZyhjb250ZW50KS50cmltKCkgIT09ICcnKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgY29uc3QgdiA9IG1ldGEgJiYgbWV0YVttZXRhS2V5XTtcclxuICAgICAgaWYgKHYgJiYgU3RyaW5nKHYpLnRyaW0oKSAhPT0gJycpIHJldHVybiB0cnVlO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAvLyBpZ25vcmVcclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9O1xyXG5cclxuICAvLyBTaG93IHBsYWNlaG9sZGVyIHN0YWdlIGJsb2NrcyBldmVuIHdoZW4gbm8gbm90ZXMgZXhpc3Qgc28gdGhlIHNoZWV0XHJcbiAgLy8gZGlzcGxheXMgdGhlIGZ1bGwgc2V0IG9mIHN0YWdlcyAobWF0Y2hpbmcgdGhlIHNjcmVlbnNob3Qgc2VsZWN0aW9uKVxyXG4gIGNvbnN0IGFsd2F5c1Nob3dQbGFjZWhvbGRlcnMgPSB0cnVlO1xyXG4gIC8vIE9ubHkgc2hvdyBibG9ja3MgZm9yIHN0YWdlcyB0aGF0IGhhdmUgc2F2ZWQgbm90ZXMg4oCUIGhpZGUgcGxhY2Vob2xkZXJzIGZvciBlbXB0eS9hc3NpZ25lZC1vbmx5IHN0YWdlc1xyXG4gIC8vIFNob3cgZGVwdXR5IGxlZnQgd2hlbiBlaXRoZXIgYSBub3RlIGV4aXN0cyBvciB0aGUgc3RhZ2Ugd2FzIHNlbGVjdGVkL3NlbnRcclxuICBjb25zdCBzaG93RGVwdXR5TGVmdCA9IGhhc05vdGUoJ0NvdXJzZTNOb3RlJywgZGVwdXR5Q29udGVudCkgfHwgc3RhZ2VTZWxlY3RlZChbJ1NEJywnUzMnXSk7XHJcblxyXG4gIC8vIFJpZ2h0IGRlcHV0eSBzaG91bGQgYmUgc2hvd24gd2hlbiBpdCBoYXMgYSBzYXZlZCBub3RlIG9yIHdhcyBzZWxlY3RlZFxyXG4gIGNvbnN0IHNob3dEZXB1dHlSaWdodCA9IGhhc05vdGUoJ0NvdXJzZTROb3RlJywgZGVwdXR5UmlnaHRDb250ZW50KSB8fCBzdGFnZVNlbGVjdGVkKFsnU0RSJywnUzQnXSk7XHJcbiAgLy8gU2hvdyBIZWFkT2ZmaWNlIHdoZW4gQ291cnNlNk5vdGUgZXhpc3RzIG9yIFM2IHdhcyBzZWxlY3RlZFxyXG4gIGNvbnN0IHNob3dIZWFkT2ZmaWNlID0gaGFzTm90ZSgnQ291cnNlNk5vdGUnLCBoZWFkT2ZmaWNlQ29udGVudCkgfHwgc3RhZ2VTZWxlY3RlZChbJ1M2J10pO1xyXG4gIC8vIFNob3cgZGlyZWN0b3IgYmxvY2sgd2hlbiBDb3Vyc2U1Tm90ZSBleGlzdHMgb3IgZGlyZWN0b3Igc3RhZ2Ugd2FzIHNlbGVjdGVkXHJcbiAgY29uc3Qgc2hvd0RpcmVjdG9yID0gaGFzTm90ZSgnQ291cnNlNU5vdGUnLCBkaXJlY3RvckNvbnRlbnQpIHx8IHN0YWdlU2VsZWN0ZWQoWydESVInLCdTRElSJywnUzUnXSk7XHJcbiAgLy8gU2hvdyBkZXBhcnRtZW50IGhlYWQgd2hlbiBDb3Vyc2UyTm90ZSBleGlzdHMgb3IgUzIgd2FzIHNlbGVjdGVkXHJcbiAgY29uc3Qgc2hvd0RlcHQgPSBoYXNOb3RlKCdDb3Vyc2UyTm90ZScsIGRlcHRDb250ZW50KSB8fCBzdGFnZVNlbGVjdGVkKFsnUzInXSk7XHJcblxyXG4gIC8vIHNob3cgcmVjaXBpZW50IChTKSB3aGVuIENvdXJzZU5vdGUgaGFzIGNvbnRlbnQgb3IgUyB3YXMgc2VsZWN0ZWQvc2VudFxyXG4gIGNvbnN0IHNob3dSZWNpcGllbnQgPSBoYXNOb3RlKCdDb3Vyc2VOb3RlJywgbGVmdENvbnRlbnQpIHx8IHN0YWdlU2VsZWN0ZWQoWydTJ10pO1xyXG5cclxuICAvLyBCdWlsZCBkZXB1dHkgYmxvY2sgYXMgc3RhbmRhbG9uZSBKU1ggdG8gYXZvaWQgY29tcGxleCBpbmxpbmUgdGVybmFyaWVzXHJcbiAgY29uc3QgZGVwdXR5QmxvY2sgPSB1c2VNZW1vKCgpID0+IHtcclxuICAgIC8vIHJlc3BlY3QgY29tcHV0ZWQgdmlzaWJsZVN0YWdlczogb25seSBzaG93IGRlcHV0eSBsZWZ0L3JpZ2h0IHdoZW4gdGhlaXJcclxuICAgIC8vIGNvcnJlc3BvbmRpbmcgdmlzaWJsZVN0YWdlIGlzIHByZXNlbnQuIElmIFM0IHdpbGwgYmUgcmVuZGVyZWQgdG9nZXRoZXJcclxuICAgIC8vIHdpdGggUzUgKHNpZGUtYnktc2lkZSksIGF2b2lkIHJlbmRlcmluZyB0aGUgUzQgcmlnaHRKU1ggaGVyZSB0byBwcmV2ZW50IGR1cGxpY2F0aW9uLlxyXG4gICAgY29uc3QgbGVmdFZpc2libGUgPSBCb29sZWFuKHZpc2libGVTdGFnZXMgJiYgdmlzaWJsZVN0YWdlcy5oYXMoJ1MzJykpICYmIHNob3dEZXB1dHlMZWZ0O1xyXG4gICAgY29uc3QgcmlnaHRWaXNpYmxlID0gQm9vbGVhbih2aXNpYmxlU3RhZ2VzICYmIHZpc2libGVTdGFnZXMuaGFzKCdTNCcpKSAmJiBzaG93RGVwdXR5UmlnaHQgJiYgISh2aXNpYmxlU3RhZ2VzICYmIHZpc2libGVTdGFnZXMuaGFzKCdTNScpKTtcclxuICAgIGlmICghbGVmdFZpc2libGUgJiYgIXJpZ2h0VmlzaWJsZSkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgY29uc3QgZGVwdXR5TWVzc2FnZSA9IHN0YWdlTWVzc2FnZUZvcignUzMnKTtcclxuICAgIGNvbnN0IGRlcHV0eVJpZ2h0TWVzc2FnZSA9IHN0YWdlTWVzc2FnZUZvcignUzQnKTtcclxuICAgIGNvbnN0IGxlZnRKU1ggPSAoXHJcbiAgICAgIDxkaXYgc3R5bGU9e3sgYm9yZGVyOiAnMXB4IGRhc2hlZCAjMTYxNjE2ZmYnLCBwYWRkaW5nOiAxLCBtYXJnaW5Ub3A6IDUgfX0+XHJcbiAgICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAxIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb2xlLWxhYmVsXCIgc3R5bGU9e3sgdGV4dEFsaWduOiAnY2VudGVyJywgbWFyZ2luVG9wOiAyLCBmb250RmFtaWx5OiAnS2htZXIgT1MgTXVvbCBMaWdodCcgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsobWV0YSAmJiBtZXRhLmZlZWRiYWNrU3RhZ2VSb2xlcyAmJiBtZXRhLmZlZWRiYWNrU3RhZ2VSb2xlcy5zMykgfHwgZ2V0Um9sZUxhYmVsKCdzMycpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICAgICAgcm93cz17NH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVmPXtkZXB1dHlUZXh0YXJlYVJlZn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2RlcHV0eUNvbnRlbnR9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4geyBzZXREZXB1dHlDb250ZW50KGUudGFyZ2V0LnZhbHVlKTsgY2xlYXJTdGFnZU1lc3NhZ2UoJ1MzJyk7IH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiLi4uLi4uLi4uLi4uLi4uLi4uLi5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyB3aWR0aDogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdjYWxjKDEwMCUgLSAxOHB4KScgOiAnMTAwJScsIGhlaWdodDogJ2F1dG8nLCBtaW5IZWlnaHQ6ICc3MnB4JywgbGluZUhlaWdodDogdWlMaW5lSGVpZ2h0LCB0ZXh0QWxpZ246ICdqdXN0aWZ5JywgbWFyZ2luOiAwLCBtYXJnaW5SaWdodDogbWFudWFsUmVzaXplRW5hYmxlZCA/ICcxOHB4JyA6IDAsIG1hcmdpbkJvdHRvbTogbWFudWFsUmVzaXplRW5hYmxlZCA/ICcxMnB4JyA6IDAsIHBhZGRpbmc6ICc4cHggMjJweCAxMnB4IDhweCcsIHJlc2l6ZTogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdib3RoJyA6ICdub25lJywgb3ZlcmZsb3c6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnYXV0bycgOiAnaGlkZGVuJywgYmFja2dyb3VuZEltYWdlOiBtYW51YWxSZXNpemVFbmFibGVkID8gXCJsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCByZ2JhKDAsMCwwLDAuMjIpIDI1JSwgdHJhbnNwYXJlbnQgMjUlKSwgbGluZWFyLWdyYWRpZW50KDEzNWRlZywgcmdiYSgwLDAsMCwwLjE2KSAyNSUsIHRyYW5zcGFyZW50IDI1JSksIGxpbmVhci1ncmFkaWVudCgxMzVkZWcsIHJnYmEoMCwwLDAsMC4xKSAyNSUsIHRyYW5zcGFyZW50IDI1JSlcIiA6ICdub25lJywgYmFja2dyb3VuZFNpemU6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnMTRweCAxNHB4LCAxMHB4IDEwcHgsIDZweCA2cHgnIDogJzAgMCcsIGJhY2tncm91bmRSZXBlYXQ6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnbm8tcmVwZWF0JyA6ICduby1yZXBlYXQnLCBiYWNrZ3JvdW5kUG9zaXRpb246IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAncmlnaHQgNnB4IGJvdHRvbSA2cHgsIHJpZ2h0IDRweCBib3R0b20gNHB4LCByaWdodCAycHggYm90dG9tIDJweCcgOiAnMCAwJywgZm9udEZhbWlseTogXCInS2htZXIgT1MgU2llbXJlYXAnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLCBib3hTaXppbmc6ICdib3JkZXItYm94Jywgd2hpdGVTcGFjZTogJ3ByZS13cmFwJywgb3ZlcmZsb3dXcmFwOiAnYW55d2hlcmUnLCB3b3JkQnJlYWs6ICdicmVhay13b3JkJywgdGV4dEluZGVudDogJzMwcHgnIH19IGRpc2FibGVkPXshaXNBc3NpZ25lZFRvU3RhZ2UoWydTRCcsJ1MzJ10pfSAvPlxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHRleHRBbGlnbjogJ2NlbnRlcicsIG1hcmdpblRvcDogMCB9fT5cclxuICAgICAgICAgICAge2hhc0RlcHV0eSA/IChcclxuICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAge2VmZmVjdGl2ZVNob3dEb0F0KCdTMycpID8gKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2PuGekuGfkuGenOGevuGek+GfhSB7Zm9ybWF0S2htZXJEYXRlVGltZShkYXRlRm9yTWV0YUtleSgnQ291cnNlM0RhdGUnKSB8fCBjYXB0dXJlZERhdGUpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICB7KGVmZmVjdGl2ZVNob3dTaWduYXR1cmUoJ1MzJykgJiYgc2lnRGVwdXR5VXJsKSA/IChcclxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IDAgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgPGltZyBzcmM9e3NpZ0RlcHV0eVVybH0gYWx0PVwic2lnLWRlcHV0eVwiIHN0eWxlPXt7IG1heFdpZHRoOiAxMDAsIG1heEhlaWdodDogODAsIG9iamVjdEZpdDogJ2NvbnRhaW4nLCBkaXNwbGF5OiAnYmxvY2snLCBtYXJnaW46ICcwIGF1dG8nIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgPC8+XHJcbiAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICB7KGVmZmVjdGl2ZVNob3dOYW1lKCdTMycpIHx8IHN0YWdlSGFzU2VuZGVyRm9yS2V5cyhbJ1NEJywnUzMnXSkpID8gKFxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2VuZGVyLW5hbWVcIiBzdHlsZT17eyBmb250RmFtaWx5OiBcIidLaG1lciBPUyBtdW9sIGxpZ2h0JywnTm90byBTYW5zIEtobWVyJywnS2htZXIgT1MnLCdIYW51bWFuJyxBcmlhbCwnc2Fucy1zZXJpZidcIiwgbWFyZ2luVG9wOiAwLCBmb250V2VpZ2h0OiAxMDAgfX0+e2dldFN0YWdlU2VuZGVyTmFtZShbJ1NEJywnUzMnXSkgfHwgJyd9PC9kaXY+XHJcbiAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICB7LyogLS0tIFRlbGVncmFtIEZlZWRiYWNrIFNlY3Rpb24gLS0tICovfVxyXG4gICAgICAgICAgey8qIFRlbGVncmFtIGZlZWRiYWNrIGlzIHJlbmRlcmVkIGdsb2JhbGx5IGJlbG93ICovfVxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIHtzaG93TGFyZ2VQcmV2aWV3ICYmIHNlbGVjdGVkUmVmID8gKFxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17eyBwb3NpdGlvbjogJ2ZpeGVkJywgaW5zZXQ6IDAsIGJhY2tncm91bmQ6ICdyZ2JhKDAsMCwwLDAuNTUpJywgekluZGV4OiAxMDAwMCwgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLCBwYWRkaW5nOiAyMCB9fSBvbkNsaWNrPXsoKSA9PiBzZXRTaG93TGFyZ2VQcmV2aWV3KGZhbHNlKX0+XHJcbiAgICAgICAgICAgIDxkaXYgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgc3R5bGU9e3sgYmFja2dyb3VuZDogJyNmZmYnLCBwYWRkaW5nOiAxMiwgYm9yZGVyUmFkaXVzOiA2LCBib3hTaGFkb3c6ICcwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuNCknLCBtYXhXaWR0aDogJzk1dncnLCBtYXhIZWlnaHQ6ICc5NXZoJywgb3ZlcmZsb3c6ICdhdXRvJyB9fSBvbkNsaWNrPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX0+XHJcbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGp1c3RpZnlDb250ZW50OiAnZmxleC1lbmQnLCBtYXJnaW5Cb3R0b206IDggfX0+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpID0+IHNldFNob3dMYXJnZVByZXZpZXcoZmFsc2UpfSBzdHlsZT17eyBwYWRkaW5nOiAnNnB4IDEwcHgnIH19PkNsb3NlPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyB3aWR0aDogJzIxMG1tJywgbWF4V2lkdGg6ICc5MHZ3JywgaGVpZ2h0OiAnMjk3bW0nLCBtYXhIZWlnaHQ6ICc5MHZoJywgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcsIGJvcmRlcjogJzFweCBzb2xpZCAjZTVlN2ViJywgYm94U2hhZG93OiAnMCA2cHggMThweCByZ2JhKDAsMCwwLDAuMTIpJywgYmFja2dyb3VuZDogJyM1NzRhNGFmZicgfX0+XHJcbiAgICAgICAgICAgICAgICB7U3RyaW5nKHNlbGVjdGVkUmVmKS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcucGRmJykgPyAoXHJcbiAgICAgICAgICAgICAgICAgIDxpZnJhbWUgc3JjPXtzZWxlY3RlZFJlZn0gdGl0bGU9XCJMYXJnZSByZWZlcmVuY2UgcHJldmlld1wiIHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGhlaWdodDogJzEwMCUnLCBib3JkZXI6IDAgfX0gLz5cclxuICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPXtzZWxlY3RlZFJlZn0gYWx0PVwibGFyZ2UtcmVmXCIgc3R5bGU9e3sgd2lkdGg6ICcxMDAlJywgaGVpZ2h0OiAnMTAwJScsIG9iamVjdEZpdDogJ2NvbnRhaW4nIH19IC8+XHJcbiAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogaGFzRGVwdXR5ID8gJ3NwYWNlLWJldHdlZW4nIDogJ2ZsZXgtc3RhcnQnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgbWFyZ2luVG9wOiA2LCBwYWRkaW5nOiAnMHB4JyB9fT5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3sgY29sb3I6IGRlcHV0eU1lc3NhZ2UgPyAnIzBiNjYyMycgOiAnIzY2NicsIG1pbkhlaWdodDogMCB9fT57ZGVwdXR5TWVzc2FnZX08L2Rpdj5cclxuICAgICAgICAgIHsvKiBpbi1zaGVldCBzZW5kIGJ1dHRvbiByZW1vdmVkOyB1c2UgdG9vbGJhci9wcmludC1vbmx5IGNvbnRyb2xzIGluc3RlYWQgKi99XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCByaWdodEpTWCA9IChcclxuICAgICAgPGRpdiBzdHlsZT17eyBib3JkZXI6ICcxcHggZGFzaGVkICMxNjE2MTZmZicsIHBhZGRpbmc6IDEsIG1hcmdpblRvcDogNSB9fT5cclxuICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdncmlkJywgZ3JpZFRlbXBsYXRlQ29sdW1uczogJzFmcicsIGdhcDogMTIgfX0+XHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6IDEgfX0+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sZS1sYWJlbFwiIHN0eWxlPXt7IHRleHRBbGlnbjogJ2NlbnRlcicsIG1hcmdpblRvcDogMiwgZm9udEZhbWlseTogJ0tobWVyIE9TIE11b2wgTGlnaHQnIH19PnsobWV0YSAmJiBtZXRhLmZlZWRiYWNrU3RhZ2VSb2xlcyAmJiBtZXRhLmZlZWRiYWNrU3RhZ2VSb2xlcy5zNCkgfHwgZ2V0Um9sZUxhYmVsKCdzNCcpfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPHRleHRhcmVhXHJcbiAgICAgICAgICAgICAgcm93cz17NH1cclxuICAgICAgICAgICAgICByZWY9e2RlcHV0eVJpZ2h0VGV4dGFyZWFSZWZ9XHJcbiAgICAgICAgICAgICAgdmFsdWU9e2RlcHV0eVJpZ2h0Q29udGVudH1cclxuICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHsgc2V0RGVwdXR5UmlnaHRDb250ZW50KGUudGFyZ2V0LnZhbHVlKTsgY2xlYXJTdGFnZU1lc3NhZ2UoJ1M0Jyk7IH19XHJcbiAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIuLi4uLi4uLi4uLi4uLi4uLi4uLlwiXHJcbiAgICAgICAgICAgICAgc3R5bGU9e3sgd2lkdGg6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnY2FsYygxMDAlIC0gMThweCknIDogJzEwMCUnLCBcclxuICAgICAgICAgICAgICAgIGhlaWdodDogJ2F1dG8nLCBcclxuICAgICAgICAgICAgICAgIG1pbkhlaWdodDogJzcycHgnLCBcclxuICAgICAgICAgICAgICAgIGxpbmVIZWlnaHQ6IHVpTGluZUhlaWdodCwgXHJcbiAgICAgICAgICAgICAgICB0ZXh0QWxpZ246ICdqdXN0aWZ5JywgXHJcbiAgICAgICAgICAgICAgICBtYXJnaW46IDAsIFxyXG4gICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnMThweCcgOiAwLFxyXG4gICAgICAgICAgICAgICAgbWFyZ2luQm90dG9tOiBtYW51YWxSZXNpemVFbmFibGVkID8gJzEycHgnIDogMCxcclxuICAgICAgICAgICAgICAgIHBhZGRpbmc6ICc4cHggMjJweCAxMnB4IDhweCcsIFxyXG4gICAgICAgICAgICAgICAgcmVzaXplOiBtYW51YWxSZXNpemVFbmFibGVkID8gJ2JvdGgnIDogJ25vbmUnLCBcclxuICAgICAgICAgICAgICAgIG92ZXJmbG93OiBtYW51YWxSZXNpemVFbmFibGVkID8gJ2F1dG8nIDogJ2hpZGRlbicsIFxyXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZEltYWdlOiBtYW51YWxSZXNpemVFbmFibGVkID8gXCJsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCByZ2JhKDAsMCwwLDAuMjIpIDI1JSwgdHJhbnNwYXJlbnQgMjUlKSwgbGluZWFyLWdyYWRpZW50KDEzNWRlZywgcmdiYSgwLDAsMCwwLjE2KSAyNSUsIHRyYW5zcGFyZW50IDI1JSksIGxpbmVhci1ncmFkaWVudCgxMzVkZWcsIHJnYmEoMCwwLDAsMC4xKSAyNSUsIHRyYW5zcGFyZW50IDI1JSlcIiA6ICdub25lJyxcclxuICAgICAgICAgICAgICAgIGJhY2tncm91bmRTaXplOiBtYW51YWxSZXNpemVFbmFibGVkID8gJzE0cHggMTRweCwgMTBweCAxMHB4LCA2cHggNnB4JyA6ICcwIDAnLFxyXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZFJlcGVhdDogbWFudWFsUmVzaXplRW5hYmxlZCA/ICduby1yZXBlYXQnIDogJ25vLXJlcGVhdCcsXHJcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kUG9zaXRpb246IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAncmlnaHQgNnB4IGJvdHRvbSA2cHgsIHJpZ2h0IDRweCBib3R0b20gNHB4LCByaWdodCAycHggYm90dG9tIDJweCcgOiAnMCAwJywgXHJcbiAgICAgICAgICAgICAgICBmb250RmFtaWx5OiBcIidLaG1lciBPUyBTaWVtcmVhcCcsJ05vdG8gU2FucyBLaG1lcicsJ0tobWVyIE9TJywnSGFudW1hbicsQXJpYWwsJ3NhbnMtc2VyaWYnXCIsIFxyXG4gICAgICAgICAgICAgICAgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcsIFxyXG4gICAgICAgICAgICAgICAgd2hpdGVTcGFjZTogJ3ByZS13cmFwJywgXHJcbiAgICAgICAgICAgICAgICBvdmVyZmxvd1dyYXA6ICdhbnl3aGVyZScsIFxyXG4gICAgICAgICAgICAgICAgd29yZEJyZWFrOiAnYnJlYWstd29yZCcsIFxyXG4gICAgICAgICAgICAgICAgdGV4dEluZGVudDogJzMwcHgnIH19XHJcbiAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFpc0Fzc2lnbmVkVG9TdGFnZShbJ1NEUicsJ1M0J10pfVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyB0ZXh0QWxpZ246ICdjZW50ZXInLCBtYXJnaW5Ub3A6IDAgfX0+XHJcbiAgICAgICAgICAgICAgICB7aGFzRGVwdXR5UmlnaHQgPyAoXHJcbiAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICB7ZWZmZWN0aXZlU2hvd0RvQXQoJ1M0JykgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdj7hnpLhn5Lhnpzhnr7hnpPhn4Uge2Zvcm1hdEtobWVyRGF0ZVRpbWUoZGF0ZUZvck1ldGFLZXkoJ0NvdXJzZTREYXRlJykgfHwgY2FwdHVyZWREYXRlKX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgIHsoZWZmZWN0aXZlU2hvd1NpZ25hdHVyZSgnUzQnKSAmJiBzaWdEZXB1dHlSaWdodFVybCkgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IDAgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8aW1nIHNyYz17c2lnRGVwdXR5UmlnaHRVcmx9IGFsdD1cInNpZy1kZXB1dHktcmlnaHRcIiBzdHlsZT17eyBtYXhXaWR0aDogMTIwLCBtYXhIZWlnaHQ6IDgwLCBvYmplY3RGaXQ6ICdjb250YWluJywgZGlzcGxheTogJ2Jsb2NrJywgbWFyZ2luOiAnMCBhdXRvJyB9fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICAgICAgeyhlZmZlY3RpdmVTaG93TmFtZSgnUzQnKSB8fCBzdGFnZUhhc1NlbmRlckZvcktleXMoWydTRFInLCdTNCcsJ1MzJ10pKSA/IChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2VuZGVyLW5hbWVcIiBzdHlsZT17eyBmb250RmFtaWx5OiBcIidLaG1lciBPUyBtdW9sIGxpZ2h0JywnTm90byBTYW5zIEtobWVyJywnS2htZXIgT1MnLCdIYW51bWFuJyxBcmlhbCwnc2Fucy1zZXJpZidcIiwgbWFyZ2luVG9wOiAwLCBmb250V2VpZ2h0OiAxMDAgfX0+e2dldFN0YWdlU2VuZGVyTmFtZShbJ1NEUicsJ1M0JywnUzMnXSkgfHwgJyd9PC9kaXY+XHJcbiAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAge3Nob3dMYXJnZVByZXZpZXcgJiYgc2VsZWN0ZWRSZWYgPyAoXHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHBvc2l0aW9uOiAnZml4ZWQnLCBpbnNldDogMCwgYmFja2dyb3VuZDogJ3JnYmEoMCwwLDAsMC41NSknLCB6SW5kZXg6IDEwMDAwLCBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsIHBhZGRpbmc6IDIwIH19IG9uQ2xpY2s9eygpID0+IHNldFNob3dMYXJnZVByZXZpZXcoZmFsc2UpfT5cclxuICAgICAgICAgICAgPGRpdiByb2xlPVwiZGlhbG9nXCIgYXJpYS1tb2RhbD1cInRydWVcIiBzdHlsZT17eyBiYWNrZ3JvdW5kOiAnI2ZmZicsIHBhZGRpbmc6IDEyLCBib3JkZXJSYWRpdXM6IDYsIGJveFNoYWRvdzogJzAgMTBweCAzMHB4IHJnYmEoMCwwLDAsMC40KScsIG1heFdpZHRoOiAnOTV2dycsIG1heEhlaWdodDogJzk1dmgnLCBvdmVyZmxvdzogJ2F1dG8nIH19IG9uQ2xpY2s9eyhlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpfT5cclxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywganVzdGlmeUNvbnRlbnQ6ICdmbGV4LWVuZCcsIG1hcmdpbkJvdHRvbTogOCB9fT5cclxuICAgICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4gc2V0U2hvd0xhcmdlUHJldmlldyhmYWxzZSl9IHN0eWxlPXt7IHBhZGRpbmc6ICc2cHggMTBweCcgfX0+Q2xvc2U8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHdpZHRoOiAnMjEwbW0nLCBtYXhXaWR0aDogJzkwdncnLCBoZWlnaHQ6ICcyOTdtbScsIG1heEhlaWdodDogJzkwdmgnLCBib3hTaXppbmc6ICdib3JkZXItYm94JywgYm9yZGVyOiAnMXB4IHNvbGlkICNlNWU3ZWInLCBib3hTaGFkb3c6ICcwIDZweCAxOHB4IHJnYmEoMCwwLDAsMC4xMiknLCBiYWNrZ3JvdW5kOiAnI2ZmZicgfX0+XHJcbiAgICAgICAgICAgICAgICB7U3RyaW5nKHNlbGVjdGVkUmVmKS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcucGRmJykgPyAoXHJcbiAgICAgICAgICAgICAgICAgIDxpZnJhbWUgc3JjPXtzZWxlY3RlZFJlZn0gdGl0bGU9XCJMYXJnZSByZWZlcmVuY2UgcHJldmlld1wiIHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGhlaWdodDogJzEwMCUnLCBib3JkZXI6IDAgfX0gLz5cclxuICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPXtzZWxlY3RlZFJlZn0gYWx0PVwibGFyZ2UtcmVmXCIgc3R5bGU9e3sgd2lkdGg6ICcxMDAlJywgaGVpZ2h0OiAnMTAwJScsIG9iamVjdEZpdDogJ2NvbnRhaW4nIH19IC8+XHJcbiAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogaGFzRGVwdXR5UmlnaHQgPyAnc3BhY2UtYmV0d2VlbicgOiAnZmxleC1zdGFydCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBtYXJnaW5Ub3A6IDYsIHBhZGRpbmc6ICcwcHgnIH19PlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17eyBjb2xvcjogZGVwdXR5UmlnaHRNZXNzYWdlID8gJyMwYjY2MjMnIDogJyM2NjYnLCBtaW5IZWlnaHQ6IDAgfX0+e2RlcHV0eVJpZ2h0TWVzc2FnZX08L2Rpdj5cclxuICAgICAgICAgIHsvKiBpbi1zaGVldCBzZW5kIGJ1dHRvbiByZW1vdmVkOyB1c2UgdG9vbGJhci9wcmludC1vbmx5IGNvbnRyb2xzIGluc3RlYWQgKi99XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKTtcclxuXHJcbiAgICBcclxuXHJcbiAgICBpZiAobGVmdFZpc2libGUgJiYgcmlnaHRWaXNpYmxlKSB7XHJcbiAgICAgIC8vIFdoZW4gZGlyZWN0b3IgaXNuJ3QgcHJlc2VudCBidXQgYm90aCBkZXB1dHkgbGVmdCAoUzMvU0QpIGFuZCBkZXB1dHkgcmlnaHQgKFNEUi9TNClcclxuICAgICAgLy8gYXJlIGFzc2lnbmVkLCBzdGFjayB0aGVtIGZ1bGwtd2lkdGggKFMzIGFib3ZlIFM0KSB0byBtYWtlIHRoZSBwcmludCBsYXlvdXQgY2xlYXJlci5cclxuICAgICAgcmV0dXJuIChcclxuICAgICAgICA8ZGl2IHN0eWxlPXt7IG1hcmdpblRvcDogNSB9fT5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3sgYm9yZGVyOiAnMHB4IGRhc2hlZCAjMTYxNjE2ZmYnLCBwYWRkaW5nOiAwIH19PlxyXG4gICAgICAgICAgICB7bGVmdEpTWH1cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17eyBoZWlnaHQ6IDUgfX0gLz5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3sgYm9yZGVyOiAnMHB4IGRhc2hlZCAjMTYxNjE2ZmYnLCBwYWRkaW5nOiAwIH19PlxyXG4gICAgICAgICAgICB7cmlnaHRKU1h9XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIGlmIChsZWZ0VmlzaWJsZSkgcmV0dXJuIGxlZnRKU1g7XHJcbiAgICBpZiAocmlnaHRWaXNpYmxlKSByZXR1cm4gcmlnaHRKU1g7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9LCBbc2hvd0RlcHV0eUxlZnQsIHNob3dEZXB1dHlSaWdodCwgZGVwdXR5Q29udGVudCwgZGVwdXR5UmlnaHRDb250ZW50LCBzaWdEZXB1dHksIHNpZ0RlcHV0eVVybCwgc2lnRGVwdXR5UmlnaHQsIHNpZ0RlcHV0eVJpZ2h0VXJsLCBzYXZlTWVzc2FnZSwgc2F2ZU1lc3NhZ2VTdGFnZSwgbWV0YSwgY2FwdHVyZWREYXRlLCB2aXNpYmxlU3RhZ2VzLCBzaG93RG9BdFN0YWdlcywgc2hvd1NpZ25hdHVyZVN0YWdlcywgc2hvd05hbWVTdGFnZXNdKTtcclxuICAvLyBJZiBhIHN0YWdlIHJlZmVyZW5jZXMgYSBzaWduYXR1cmUgaWQgdGhhdCB3ZSBkb24ndCBoYXZlIGluIHNpZ25hdHVyZXNNYXAsXHJcbiAgLy8gZmV0Y2ggaXQgaW5kaXZpZHVhbGx5IHNvIHdlIGNhbiBzaG93IGBmdWxsTmFtZUtoYCBhbmQgc2lnbmF0dXJlIGltYWdlLlxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBzdGFnZUtleXMgPSBbJ1MnLCAnUzEnLCAnUzInLCAnUzMnLCAnUzQnLCAnUzUnLCAnUzYnLCAnU0QnLCAnU0RSJywgJ0RJUicsICdTRElSJywgJ0hPJ107XHJcbiAgICBsZXQgbW91bnRlZCA9IHRydWU7XHJcblxyXG4gICAgY29uc3QgZmV0Y2hJZk1pc3NpbmcgPSBhc3luYyAoaWQpID0+IHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBhcGkuZ2V0KGAvc2lnbmF0dXJlcy8ke2lkfWApO1xyXG4gICAgICAgIGNvbnN0IHNpZyA9IHJlcyAmJiByZXMuZGF0YSA/IHJlcy5kYXRhIDogcmVzICYmIHJlcy5kYXRhICYmIHJlcy5kYXRhLnNpZ25hdHVyZSA/IHJlcy5kYXRhLnNpZ25hdHVyZSA6IHJlcy5kYXRhIHx8IHJlcztcclxuICAgICAgICBpZiAoIW1vdW50ZWQgfHwgIXNpZykgcmV0dXJuO1xyXG4gICAgICAgIHNldFNpZ25hdHVyZXNNYXAocHJldiA9PiAoeyAuLi4ocHJldiB8fCB7fSksIFtpZF06IHNpZyB9KSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIGZldGNoIHNpZ25hdHVyZSBieSBpZCcsIGlkLCBlcnIpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIChhc3luYyAoKSA9PiB7XHJcbiAgICAgIGlmICghbm9ybWFsaXplZFN0YWdlcykgcmV0dXJuO1xyXG4gICAgICBmb3IgKGNvbnN0IGtleSBvZiBzdGFnZUtleXMpIHtcclxuICAgICAgICBjb25zdCByYXcgPSBub3JtYWxpemVkU3RhZ2VzW2tleV07XHJcbiAgICAgICAgY29uc3QgaWQgPSByZXNvbHZlU3RhZ2VJZChyYXcpO1xyXG4gICAgICAgIGlmICghaWQpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChzaWduYXR1cmVzTWFwICYmIHNpZ25hdHVyZXNNYXBbaWRdKSBjb250aW51ZTtcclxuICAgICAgICBhd2FpdCBmZXRjaElmTWlzc2luZyhpZCk7XHJcbiAgICAgIH1cclxuICAgIH0pKCk7XHJcblxyXG4gICAgcmV0dXJuICgpID0+IHsgbW91bnRlZCA9IGZhbHNlOyB9O1xyXG4gIH0sIFtub3JtYWxpemVkU3RhZ2VzLCBzaWduYXR1cmVzTWFwXSk7XHJcblxyXG4gIC8vIEhpZGUgYXBwbGljYXRpb24gc2lkZWJhciB3aGlsZSB0aGlzIHBhZ2UgaXMgbW91bnRlZCBzbyB0aGUgc2hlZXQgY2FuIGJlIGNlbnRlcmVkXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IGFkZGVkID0gW107XHJcbiAgICB0cnkge1xyXG4gICAgICBpZiAoZG9jdW1lbnQgJiYgZG9jdW1lbnQuYm9keSAmJiBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdCkgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKCdyZXBsYXktaGlkZS1zaWRlYmFyJyk7XHJcblxyXG4gICAgICAvLyBzZWxlY3RvcnMgdG8gaGlkZSDigJQgZXhwYW5kIGlmIHlvdXIgYXBwIHVzZXMgZGlmZmVyZW50IGNsYXNzbmFtZXNcclxuICAgICAgY29uc3Qgc2lkZWJhclNlbGVjdG9ycyA9IFsnLmFudC1sYXlvdXQtc2lkZXInLCAnLnNpZGViYXInLCAnW3JvbGU9XCJuYXZpZ2F0aW9uXCJdJywgJ2FzaWRlJywgJy5zaWRlcicsICcuc2l0ZS1sYXlvdXQtc2lkZXInLCAnLmFudC1wcm8tc2lkZXInLCAnW2RhdGEtdGVzdGlkPVwic2lkZXJcIl0nLCAnLmFwcC1zaWRlciddO1xyXG4gICAgICBjb25zdCBoZWFkZXJTZWxlY3RvcnMgPSBbJy5hbnQtbGF5b3V0LWhlYWRlcicsICdoZWFkZXInLCAnLnRvcGJhcicsICcuYXBwLWhlYWRlcicsICcubmF2YmFyJywgJy5zaXRlLWhlYWRlciddO1xyXG5cclxuICAgICAgY29uc3QgaGlkZUVsZW1zID0gKHNlbHMpID0+IHtcclxuICAgICAgICBmb3IgKGNvbnN0IHMgb2Ygc2Vscykge1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3Qgbm9kZXMgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwocykpO1xyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IG4gb2Ygbm9kZXMpIHtcclxuICAgICAgICAgICAgICAvLyBzYXZlIG9yaWdpbmFsIGRpc3BsYXkgc28gd2UgY2FuIHJlc3RvcmVcclxuICAgICAgICAgICAgICB0cnkgeyBuLmRhdGFzZXQuX19yZXBsYXlPcmlnRGlzcGxheSA9IChuLnN0eWxlICYmIG4uc3R5bGUuZGlzcGxheSkgPyBuLnN0eWxlLmRpc3BsYXkgOiAnJzsgfSBjYXRjaCAoZSkge31cclxuICAgICAgICAgICAgICB0cnkgeyBuLnN0eWxlLnNldFByb3BlcnR5KCdkaXNwbGF5JywgJ25vbmUnLCAnaW1wb3J0YW50Jyk7IH0gY2F0Y2ggKGUpIHsgbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9XHJcbiAgICAgICAgICAgICAgYWRkZWQucHVzaChuKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBjYXRjaCAoZSkgeyAvKiBpZ25vcmUgaW52YWxpZCBzZWxlY3RvcnMgKi8gfVxyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuXHJcbiAgICAgIGhpZGVFbGVtcyhzaWRlYmFyU2VsZWN0b3JzKTtcclxuICAgICAgaGlkZUVsZW1zKGhlYWRlclNlbGVjdG9ycyk7XHJcblxyXG4gICAgICAvLyBhbHNvIHRyeSB0byByZW1vdmUgYW55IGxlZnQtbWFyZ2luIG9uIG1haW4gY29udGVudCBjb250YWluZXJzXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgY29udGVudENhbmRpZGF0ZXMgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5hbnQtbGF5b3V0LWNvbnRlbnQsIC5tYWluLWNvbnRlbnQsIC5jb250ZW50LCAuc2l0ZS1sYXlvdXQtY29udGVudCwgLmFwcC1yb290JykpO1xyXG4gICAgICAgIGZvciAoY29uc3QgYyBvZiBjb250ZW50Q2FuZGlkYXRlcykge1xyXG4gICAgICAgICAgdHJ5IHsgYy5kYXRhc2V0Ll9fcmVwbGF5T3JpZ1BhZGRpbmdMZWZ0ID0gYy5zdHlsZSAmJiBjLnN0eWxlLnBhZGRpbmdMZWZ0ID8gYy5zdHlsZS5wYWRkaW5nTGVmdCA6ICcnOyB9IGNhdGNoIChlKSB7fVxyXG4gICAgICAgICAgdHJ5IHsgYy5zdHlsZS5zZXRQcm9wZXJ0eSgncGFkZGluZy1sZWZ0JywgJzBweCcsICdpbXBvcnRhbnQnKTsgfSBjYXRjaCAoZSkgeyBjLnN0eWxlLnBhZGRpbmdMZWZ0ID0gJzBweCc7IH1cclxuICAgICAgICAgIHRyeSB7IGMuZGF0YXNldC5fX3JlcGxheU9yaWdNYXJnaW5MZWZ0ID0gYy5zdHlsZSAmJiBjLnN0eWxlLm1hcmdpbkxlZnQgPyBjLnN0eWxlLm1hcmdpbkxlZnQgOiAnJzsgfSBjYXRjaCAoZSkge31cclxuICAgICAgICAgIHRyeSB7IGMuc3R5bGUuc2V0UHJvcGVydHkoJ21hcmdpbi1sZWZ0JywgJzBweCcsICdpbXBvcnRhbnQnKTsgfSBjYXRjaCAoZSkgeyBjLnN0eWxlLm1hcmdpbkxlZnQgPSAnMHB4JzsgfVxyXG4gICAgICAgICAgYWRkZWQucHVzaChjKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHt9XHJcblxyXG4gICAgfSBjYXRjaCAoZSkge31cclxuXHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIC8vIHJlc3RvcmUgb3JpZ2luYWwgaW5saW5lIHN0eWxlcyB3aGVyZSB3ZSBzYXZlZCB0aGVtXHJcbiAgICAgICAgZm9yIChjb25zdCBuIG9mIGFkZGVkKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAobiAmJiBuLmRhdGFzZXQpIHtcclxuICAgICAgICAgICAgICBpZiAobi5kYXRhc2V0Ll9fcmVwbGF5T3JpZ0Rpc3BsYXkgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHsgbi5zdHlsZS5kaXNwbGF5ID0gbi5kYXRhc2V0Ll9fcmVwbGF5T3JpZ0Rpc3BsYXkgfHwgJyc7IH0gY2F0Y2ggKGUpIHsgbi5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgnZGlzcGxheScpOyB9XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgbi5kYXRhc2V0Ll9fcmVwbGF5T3JpZ0Rpc3BsYXk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIGlmIChuLmRhdGFzZXQuX19yZXBsYXlPcmlnUGFkZGluZ0xlZnQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHsgbi5zdHlsZS5wYWRkaW5nTGVmdCA9IG4uZGF0YXNldC5fX3JlcGxheU9yaWdQYWRkaW5nTGVmdCB8fCAnJzsgfSBjYXRjaCAoZSkgeyBuLnN0eWxlLnJlbW92ZVByb3BlcnR5KCdwYWRkaW5nLWxlZnQnKTsgfVxyXG4gICAgICAgICAgICAgICAgZGVsZXRlIG4uZGF0YXNldC5fX3JlcGxheU9yaWdQYWRkaW5nTGVmdDtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgaWYgKG4uZGF0YXNldC5fX3JlcGxheU9yaWdNYXJnaW5MZWZ0ICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHRyeSB7IG4uc3R5bGUubWFyZ2luTGVmdCA9IG4uZGF0YXNldC5fX3JlcGxheU9yaWdNYXJnaW5MZWZ0IHx8ICcnOyB9IGNhdGNoIChlKSB7IG4uc3R5bGUucmVtb3ZlUHJvcGVydHkoJ21hcmdpbi1sZWZ0Jyk7IH1cclxuICAgICAgICAgICAgICAgIGRlbGV0ZSBuLmRhdGFzZXQuX19yZXBsYXlPcmlnTWFyZ2luTGVmdDtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlKSB7fVxyXG4gICAgICB0cnkgeyBkb2N1bWVudCAmJiBkb2N1bWVudC5ib2R5ICYmIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0ICYmIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZSgncmVwbGF5LWhpZGUtc2lkZWJhcicpOyB9IGNhdGNoIChlKSB7fVxyXG4gICAgfTtcclxuICB9LCBbXSk7XHJcblxyXG4gIC8vIEF1dG8tbG9hZCBhIHNtYWxsIGRlbW8gcmVjb3JkIHdoZW4gYD9kZW1vPTFgIGlzIHByZXNlbnQgaW4gdGhlIFVSTC5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgaWYgKCFyZWNvcmQgJiYgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICBjb25zdCBxID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcclxuICAgICAgICBpZiAocS5nZXQoJ2RlbW8nKSkge1xyXG4gICAgICAgICAgY29uc3Qgc2FtcGxlID0ge1xyXG4gICAgICAgICAgICBsZXR0ZXJObzogJ0RFTU8tMDAxJyxcclxuICAgICAgICAgICAgc291cmNlOiAnRGVtbyBzb3VyY2UnLFxyXG4gICAgICAgICAgICBjb250ZW50OiAnVGhpcyBpcyBhIGRlbW8gcmVjb3JkIHVzZWQgd2hlbiBubyBiYWNrZW5kIGRhdGEgaXMgYXZhaWxhYmxlLiBSZXBsYWNlIHdpdGggcmVhbCBkYXRhIHdoZW4gY29ubmVjdGVkIHRvIHRoZSBzZXJ2ZXIuJyxcclxuICAgICAgICAgICAgbWV0YToge30sXHJcbiAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBbXVxyXG4gICAgICAgICAgfTtcclxuICAgICAgICAgIHNldFJlY29yZChzYW1wbGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAvLyBpZ25vcmVcclxuICAgIH1cclxuICB9LCBbXSk7XHJcblxyXG4gIGNvbnN0IHByaW50U2hlZXREaXJlY3QgPSBhc3luYyAoKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBzZXRJc1ByaW50aW5nKHRydWUpO1xyXG4gICAgICAvLyBnaXZlIHRoZSBicm93c2VyIGEgbW9tZW50IHRvIGFwcGx5IHByaW50IHN0eWxlc1xyXG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXMgPT4gc2V0VGltZW91dChyZXMsIDMwKSk7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgd2luZG93LmZvY3VzKCk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHt9XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgd2luZG93LnByaW50KCk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdwcmludFNoZWV0RGlyZWN0OiB3aW5kb3cucHJpbnQgZmFpbGVkJywgZSk7XHJcbiAgICAgIH1cclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHRyeSB7IHNldElzUHJpbnRpbmcoZmFsc2UpOyB9IGNhdGNoIChlKSB7fVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG5cclxuICByZXR1cm4gKFxyXG4gICAgPGRpdj5cclxuICAgICAgey8qIFJldmVydGVkIHBlcnNpc3RlbnQgcHJpbnQtZml4IHRvIHJlc3RvcmUgYnJvd3NlcidzIGRlZmF1bHQgQ3RybCtQIGJlaGF2aW9yICovfVxyXG4gICAgICB7LyogZHluYW1pYyBsYXlvdXQgc3R5bGVzIGNvbnRyb2xsZWQgYnkgdG9vbGJhciAoYXBwbHkgdG8gYWxsIHNoZWV0IGNvbnRlbnQpICovfVxyXG4gICAgICA8c3R5bGU+e2BcclxuICAgICAgICAuc2hlZXQgLnBhZ2UsIC5zaGVldCAucGFnZSAqIHsgZm9udC1zaXplOiAke3VpRm9udFNpemV9cHggIWltcG9ydGFudDsgbGluZS1oZWlnaHQ6ICR7dWlMaW5lSGVpZ2h0fSAhaW1wb3J0YW50OyB9XHJcbiAgICAgICAgLnNoZWV0IC5wYWdlIHsgXHJcbiAgICAgICAgICBmb250LXNpemU6ICR7dWlGb250U2l6ZX1weCAhaW1wb3J0YW50OyBcclxuICAgICAgICAgIGxpbmUtaGVpZ2h0OiAke3VpTGluZUhlaWdodH0gIWltcG9ydGFudDsgXHJcbiAgICAgICAgICBwYWRkaW5nLXRvcDogJHt1aVBhZGRpbmdUb3B9bW0gIWltcG9ydGFudDtcclxuICAgICAgICAgIG1heC1oZWlnaHQ6IG5vbmUgIWltcG9ydGFudDtcclxuICAgICAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC5zaGVldCAuZmllbGQgeyBtYXJnaW4tdG9wOiAke3VpUGFyYUJlZm9yZX1weCAhaW1wb3J0YW50OyBtYXJnaW4tYm90dG9tOiAke3VpUGFyYUFmdGVyfXB4ICFpbXBvcnRhbnQ7IH1cclxuICAgICAgICAuc2hlZXQgLmZpZWxkIC5sYWJlbCB7IGZvbnQtc2l6ZTogJHtNYXRoLm1heCgxMCwgdWlGb250U2l6ZSAtIDIpfXB4ICFpbXBvcnRhbnQ7IH1cclxuICAgICAgICAuc2hlZXQgLmZpZWxkIC52YWx1ZSwgLnNoZWV0IC5maWVsZCAudmFsdWUtcGxhaW4geyBmb250LXNpemU6ICR7dWlGb250U2l6ZX1weCAhaW1wb3J0YW50OyB9XHJcbiAgICAgICAgLnNoZWV0IHRleHRhcmVhIHsgZm9udC1zaXplOiAke3VpRm9udFNpemV9cHggIWltcG9ydGFudDsgbGluZS1oZWlnaHQ6ICR7dWlMaW5lSGVpZ2h0fSAhaW1wb3J0YW50OyB9XHJcbiAgICAgIGB9PC9zdHlsZT5cclxuICAgICAgPHN0eWxlPntgLnNoZWV0IC5wYWdlIC5yb2xlLWxhYmVsIHsgZm9udC1zaXplOiAxMnB4ICFpbXBvcnRhbnQ7IH0gLnNoZWV0IC5wYWdlIC5zZW5kZXItbmFtZSB7IGZvbnQtc2l6ZTogMTJweCAhaW1wb3J0YW50OyB9IC5zaGVldCAucGFnZSAucm9sZS1zMiB7IGZvbnQtc2l6ZTogMTJweCAhaW1wb3J0YW50OyB9XHJcbiAgICAucmVwbGF5LWhpZGUtc2lkZWJhciAuYW50LWxheW91dC1zaWRlciwgLnJlcGxheS1oaWRlLXNpZGViYXIgLnNpZGViYXIsIC5yZXBsYXktaGlkZS1zaWRlYmFyIFtyb2xlPVwibmF2aWdhdGlvblwiXSwgLnJlcGxheS1oaWRlLXNpZGViYXIgLmFwcC1zaWRlciwgLnJlcGxheS1oaWRlLXNpZGViYXIgLnNpdGUtbGF5b3V0LXNpZGVyLCAucmVwbGF5LWhpZGUtc2lkZWJhciAuYW50LXByby1zaWRlciB7IGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsgd2lkdGg6IDAgIWltcG9ydGFudDsgaGVpZ2h0OiAwICFpbXBvcnRhbnQ7IG92ZXJmbG93OiBoaWRkZW4gIWltcG9ydGFudDsgfVxyXG4gICAgLnJlcGxheS1oaWRlLXNpZGViYXIgLmFudC1sYXlvdXQtaGVhZGVyLCAucmVwbGF5LWhpZGUtc2lkZWJhciAudG9wYmFyLCAucmVwbGF5LWhpZGUtc2lkZWJhciAuYXBwLWhlYWRlciwgLnJlcGxheS1oaWRlLXNpZGViYXIgLm5hdmJhciwgLnJlcGxheS1oaWRlLXNpZGViYXIgLmhlYWRlciwgLnJlcGxheS1oaWRlLXNpZGViYXIgLnNpdGUtaGVhZGVyIHsgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50OyBoZWlnaHQ6IDAgIWltcG9ydGFudDsgfVxyXG4gICAgLnJlcGxheS1oaWRlLXNpZGViYXIgLmFudC1sYXlvdXQtY29udGVudCwgLnJlcGxheS1oaWRlLXNpZGViYXIgLm1haW4tY29udGVudCwgLnJlcGxheS1oaWRlLXNpZGViYXIgLmNvbnRlbnQsIC5yZXBsYXktaGlkZS1zaWRlYmFyIC5zaXRlLWxheW91dC1jb250ZW50IHsgbWFyZ2luLWxlZnQ6IDAgIWltcG9ydGFudDsgcGFkZGluZy1sZWZ0OiAwICFpbXBvcnRhbnQ7IH1cclxuICAgIC5yZXBsYXktaGlkZS1zaWRlYmFyIC5hbnQtbGF5b3V0LCAucmVwbGF5LWhpZGUtc2lkZWJhciAuYXBwLXJvb3QgeyBwYWRkaW5nLWxlZnQ6IDAgIWltcG9ydGFudDsgfVxyXG4gICAgLnJlcGxheS1oaWRlLXNpZGViYXIgLnNoZWV0IHsgbWFyZ2luLWxlZnQ6IGF1dG8gIWltcG9ydGFudDsgbWFyZ2luLXJpZ2h0OiBhdXRvICFpbXBvcnRhbnQ7IH1cclxuICAgIGB9PC9zdHlsZT5cclxuICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsIG1hcmdpbjogJzBweCAwJyB9fT5cclxuICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiBuYXZpZ2F0ZSgtMSl9IHN0eWxlPXt7IHBhZGRpbmc6ICc2cHggMTBweCcsIGJvcmRlcjogJzFweCBzb2xpZCAjNjQ2NjY5ZmYnLCBib3JkZXJSYWRpdXM6IDcgfX0+QmFjazwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXY+XHJcbiAgICAgICAgICB7cmVjb3JkID8gKFxyXG4gICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gbmF2aWdhdGUoYC9zZW5kLWZlZWRiYWNrP3JlY29yZElkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KChyZWNvcmQgJiYgKHJlY29yZC5faWQgfHwgcmVjb3JkLmlkKSkgfHwgJycpfSZzdGFnZT1zYCl9XHJcbiAgICAgICAgICAgICAgc3R5bGU9e3sgcGFkZGluZzogJzZweCAxMHB4JywgYmFja2dyb3VuZDogJyMwMDg4Y2MnLCBjb2xvcjogJyNmZmYnLCBib3JkZXJSYWRpdXM6IDQsIG1hcmdpblJpZ2h0OiAyMDAsIGN1cnNvcjogJ3BvaW50ZXInIH19XHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICB7J+GeleGfkuGeieGevuGemOGej+Getyd9XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICBvbkNsaWNrPXtwcmludFNoZWV0RGlyZWN0fSBcclxuICAgICAgICAgICAgZGlzYWJsZWQ9e2lzUHJpbnRpbmd9XHJcbiAgICAgICAgICAgIHN0eWxlPXt7IFxyXG4gICAgICAgICAgICAgIHBhZGRpbmc6ICc2cHggMTBweCcsIFxyXG4gICAgICAgICAgICAgIGJhY2tncm91bmQ6IGlzUHJpbnRpbmcgPyAnIzljYTNhZicgOiAnIzRmNDZlNScsIFxyXG4gICAgICAgICAgICAgIGNvbG9yOiAnI2ZmZicsIFxyXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogNCwgXHJcbiAgICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IDEwMCxcclxuICAgICAgICAgICAgICBjdXJzb3I6IGlzUHJpbnRpbmcgPyAnbm90LWFsbG93ZWQnIDogJ3BvaW50ZXInLFxyXG4gICAgICAgICAgICAgIG9wYWNpdHk6IGlzUHJpbnRpbmcgPyAwLjYgOiAxXHJcbiAgICAgICAgICAgIH19XHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIHtpc1ByaW50aW5nID8gJ1ByaW50aW5nLi4uJyA6ICdQcmludCd9XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJywgbWFyZ2luUmlnaHQ6IDggfX0+Rm9udDwvc3Bhbj5cclxuICAgICAgICAgIDxpbnB1dCBhcmlhLWxhYmVsPVwiRm9udCBzaXplXCIgdHlwZT1cIm51bWJlclwiIG1pbj17OH0gbWF4PXszMH0gdmFsdWU9e3VpRm9udFNpemV9IG9uQ2hhbmdlPXsoZSkgPT4gc2V0VWlGb250U2l6ZShOdW1iZXIoZS50YXJnZXQudmFsdWUpIHx8IDEyKX0gc3R5bGU9e3sgd2lkdGg6IDU2LCBtYXJnaW5SaWdodDogOCB9fSAvPlxyXG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IDEzLCBjb2xvcjogJyMzMzMnLCBtYXJnaW5SaWdodDogOCB9fT5MaW5lPC9zcGFuPlxyXG4gICAgICAgICAgPGlucHV0IGFyaWEtbGFiZWw9XCJMaW5lIGhlaWdodFwiIHR5cGU9XCJudW1iZXJcIiBzdGVwPVwiMC4xXCIgbWluPXsxfSBtYXg9ezN9IHZhbHVlPXt1aUxpbmVIZWlnaHR9IG9uQ2hhbmdlPXsoZSkgPT4gc2V0VWlMaW5lSGVpZ2h0KE51bWJlcihlLnRhcmdldC52YWx1ZSkgfHwgMSl9IHN0eWxlPXt7IHdpZHRoOiA1NiwgbWFyZ2luUmlnaHQ6IDggfX0gLz5cclxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJywgbWFyZ2luUmlnaHQ6IDQgfX0+QmVmb3JlPC9zcGFuPlxyXG4gICAgICAgICAgPGlucHV0IGFyaWEtbGFiZWw9XCJQYXJhZ3JhcGggYmVmb3JlXCIgdHlwZT1cIm51bWJlclwiIG1pbj17MH0gbWF4PXs0MH0gdmFsdWU9e3VpUGFyYUJlZm9yZX0gb25DaGFuZ2U9eyhlKSA9PiBzZXRVaVBhcmFCZWZvcmUoTnVtYmVyKGUudGFyZ2V0LnZhbHVlKSB8fCAwKX0gc3R5bGU9e3sgd2lkdGg6IDQ4LCBtYXJnaW5SaWdodDogOCB9fSAvPlxyXG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IDEzLCBjb2xvcjogJyMzMzMnLCBtYXJnaW5SaWdodDogNCB9fT5BZnRlcjwvc3Bhbj5cclxuICAgICAgICAgIDxpbnB1dCBhcmlhLWxhYmVsPVwiUGFyYWdyYXBoIGFmdGVyXCIgdHlwZT1cIm51bWJlclwiIG1pbj17MH0gbWF4PXs0MH0gdmFsdWU9e3VpUGFyYUFmdGVyfSBvbkNoYW5nZT17KGUpID0+IHNldFVpUGFyYUFmdGVyKE51bWJlcihlLnRhcmdldC52YWx1ZSkgfHwgMCl9IHN0eWxlPXt7IHdpZHRoOiA0OCB9fSAvPlxyXG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IDEzLCBjb2xvcjogJyMzMzMnLCBtYXJnaW46ICcwIDhweCcgfX0+VG9wPC9zcGFuPlxyXG4gICAgICAgICAgPGlucHV0IGFyaWEtbGFiZWw9XCJQYWdlIHRvcCAobW0pXCIgdHlwZT1cIm51bWJlclwiIG1pbj17MH0gbWF4PXs0MH0gdmFsdWU9e3VpUGFkZGluZ1RvcH0gb25DaGFuZ2U9eyhlKSA9PiBzZXRVaVBhZGRpbmdUb3AoTnVtYmVyKGUudGFyZ2V0LnZhbHVlKSB8fCAwKX0gc3R5bGU9e3sgd2lkdGg6IDU2LCBtYXJnaW5SaWdodDogOCB9fSAvPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsIG1hcmdpbjogJzAgMCAxMHB4JyB9fT5cclxuICAgICAgICA8ZGV0YWlscyBzdHlsZT17eyB3aWR0aDogJ21pbigyMTBtbSwgMTAwJSknLCBiYWNrZ3JvdW5kOiAnI2ZmZicsIGJvcmRlcjogJzFweCBzb2xpZCAjZTVlN2ViJywgYm9yZGVyUmFkaXVzOiA2LCBwYWRkaW5nOiAxMCB9fT5cclxuICAgICAgICAgIDxzdW1tYXJ5IHN0eWxlPXt7IGN1cnNvcjogJ3BvaW50ZXInLCBmb250RmFtaWx5OiAnS2htZXIgT1MgTXVvbCBMaWdodCcsIGZvbnRTaXplOiAxNCwgY29sb3I6ICcjMTExJyB9fT5cclxuICAgICAgICAgICAg4Z6A4Z+G4Z6O4Z6P4Z+L4Z6A4Z624Z6a4Z6U4Z6E4Z+S4Z6g4Z624Z6JXHJcbiAgICAgICAgICA8L3N1bW1hcnk+XHJcblxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IDEwIH19PlxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAxNiwgZmxleFdyYXA6ICd3cmFwJywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGp1c3RpZnlDb250ZW50OiAnZmxleC1zdGFydCcgfX0+XHJcbiAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJyB9fT5cclxuICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjaGVja2VkPXtzaG93TGV0dGVyTm99IG9uQ2hhbmdlPXsoZSkgPT4gc2V0U2hvd0xldHRlck5vKGUudGFyZ2V0LmNoZWNrZWQpfSBzdHlsZT17eyBtYXJnaW5SaWdodDogNiB9fSAvPlxyXG4gICAgICAgICAgICAgICAg4Z6U4Z6E4Z+S4Z6g4Z624Z6JIOGem+Get+GegeGet+Gej+Gem+GfgeGegVxyXG4gICAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJyB9fT5cclxuICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjaGVja2VkPXtzaG93Q3JlYXRvck5hbWV9IG9uQ2hhbmdlPXsoZSkgPT4gc2V0U2hvd0NyZWF0b3JOYW1lKGUudGFyZ2V0LmNoZWNrZWQpfSBzdHlsZT17eyBtYXJnaW5SaWdodDogNiB9fSAvPlxyXG4gICAgICAgICAgICAgICAg4Z6U4Z6E4Z+S4Z6g4Z624Z6JIOGelOGeieGfkuGeheGevOGem+Gem+Get+GegeGet+Gej+GeiuGfhOGemVxyXG4gICAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJyB9fT5cclxuICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjaGVja2VkPXttYW51YWxSZXNpemVFbmFibGVkfSBvbkNoYW5nZT17KGUpID0+IHNldE1hbnVhbFJlc2l6ZUVuYWJsZWQoZS50YXJnZXQuY2hlY2tlZCl9IHN0eWxlPXt7IG1hcmdpblJpZ2h0OiA2IH19IC8+XHJcbiAgICAgICAgICAgICAgICDhnqLhnpPhnrvhnonhn5Lhnonhnrbhno8g4Z6A4Z624Z6P4Z+L4Z6R4Z+G4Z6g4Z+G4Z6K4Z+E4Z6Z4Z6K4Z+DXHJcbiAgICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IG1hcmdpbkxlZnQ6IDggfX0+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBvbkNsaWNrPXsoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3JlcGxheWZpbGUyOnNob3dMZXR0ZXJObycpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdyZXBsYXlmaWxlMjpzaG93Q3JlYXRvck5hbWUnKTtcclxuICAgICAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncmVwbGF5ZmlsZTI6c2hvd0RvQXRTdGFnZXMnKTtcclxuICAgICAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncmVwbGF5ZmlsZTI6c2hvd1NpZ25hdHVyZVN0YWdlcycpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdyZXBsYXlmaWxlMjpzaG93TmFtZVN0YWdlcycpO1xyXG4gICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7fVxyXG4gICAgICAgICAgICAgICAgICBzZXRTaG93TGV0dGVyTm8oZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICBzZXRTaG93Q3JlYXRvck5hbWUoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICBzZXRTaG93RG9BdFN0YWdlcyhuZXcgU2V0KCkpO1xyXG4gICAgICAgICAgICAgICAgICBzZXRTaG93U2lnbmF0dXJlU3RhZ2VzKG5ldyBTZXQoKSk7XHJcbiAgICAgICAgICAgICAgICAgIHNldFNob3dOYW1lU3RhZ2VzKG5ldyBTZXQoKSk7XHJcbiAgICAgICAgICAgICAgICB9fSBzdHlsZT17eyBwYWRkaW5nOiAnNnB4IDEwcHgnLCBmb250U2l6ZTogMTIgfX0+UmVzZXQgZGlzcGxheSBzZXR0aW5nczwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgbWFyZ2luVG9wOiAxMCwgYm9yZGVyVG9wOiAnMXB4IHNvbGlkICNlZWYyZjYnLCBwYWRkaW5nVG9wOiAxMCB9fT5cclxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdncmlkJywgZ3JpZFRlbXBsYXRlQ29sdW1uczogJzU2cHggMWZyIDFmciAxZnIgNTZweCcsIGdhcDogOCwgYWxpZ25JdGVtczogJ2NlbnRlcicgfX0+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJywgZm9udEZhbWlseTogJ0tobWVyIE9TIE11b2wgTGlnaHQnIH19PlN0YWdlPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJywgZm9udEZhbWlseTogJ0tobWVyIE9TIE11b2wgTGlnaHQnIH19PuGekuGfkuGenOGevuGek+GfhTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250U2l6ZTogMTMsIGNvbG9yOiAnIzMzMycsIGZvbnRGYW1pbHk6ICdLaG1lciBPUyBNdW9sIExpZ2h0JyB9fT7hnqDhno/hn5LhnpDhnpvhn4HhnoHhnrY8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFNpemU6IDEzLCBjb2xvcjogJyMzMzMnLCBmb250RmFtaWx5OiAnS2htZXIgT1MgTXVvbCBMaWdodCcgfX0+4Z6I4Z+S4Z6Y4Z+E4Z+HPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJywgZm9udEZhbWlseTogJ0tobWVyIE9TIE11b2wgTGlnaHQnLCB0ZXh0QWxpZ246ICdjZW50ZXInIH19PkFsbDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIHsoc3RhZ2VLZXlzRm9yU2V0dGluZ3MgJiYgc3RhZ2VLZXlzRm9yU2V0dGluZ3MubGVuZ3RoKSA/IChcclxuICAgICAgICAgICAgICAgICAgc3RhZ2VLZXlzRm9yU2V0dGluZ3MubWFwKChrKSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPFJlYWN0LkZyYWdtZW50IGtleT17YHN0YWdlLXJvdy0ke2t9YH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMTExJywgZm9udEZhbWlseTogJ0tobWVyIE9TIE11b2wgTGlnaHQnIH19PntrfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImNoZWNrYm94XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja2VkPXtCb29sZWFuKHNob3dEb0F0U3RhZ2VzICYmIHNob3dEb0F0U3RhZ2VzLmhhcyhrKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eygpID0+IHRvZ2dsZVN0YWdlSW5TZXQoc2V0U2hvd0RvQXRTdGFnZXMsIGspfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT17eyBmb250U2l6ZTogMTMsIGNvbG9yOiAnIzMzMycgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJjaGVja2JveFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tlZD17Qm9vbGVhbihzaG93U2lnbmF0dXJlU3RhZ2VzICYmIHNob3dTaWduYXR1cmVTdGFnZXMuaGFzKGspKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KCkgPT4gdG9nZ2xlU3RhZ2VJblNldChzZXRTaG93U2lnbmF0dXJlU3RhZ2VzLCBrKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZm9udFNpemU6IDEzLCBjb2xvcjogJyMzMzMnIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiY2hlY2tib3hcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e0Jvb2xlYW4oc2hvd05hbWVTdGFnZXMgJiYgc2hvd05hbWVTdGFnZXMuaGFzKGspKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KCkgPT4gdG9nZ2xlU3RhZ2VJblNldChzZXRTaG93TmFtZVN0YWdlcywgayl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJywgdGV4dEFsaWduOiAnY2VudGVyJyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImNoZWNrYm94XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja2VkPXtCb29sZWFuKHNob3dEb0F0U3RhZ2VzICYmIHNob3dEb0F0U3RhZ2VzLmhhcyhrKSAmJiBzaG93U2lnbmF0dXJlU3RhZ2VzICYmIHNob3dTaWduYXR1cmVTdGFnZXMuaGFzKGspICYmIHNob3dOYW1lU3RhZ2VzICYmIHNob3dOYW1lU3RhZ2VzLmhhcyhrKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eygpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbE9uID0gQm9vbGVhbihzaG93RG9BdFN0YWdlcyAmJiBzaG93RG9BdFN0YWdlcy5oYXMoaykgJiYgc2hvd1NpZ25hdHVyZVN0YWdlcyAmJiBzaG93U2lnbmF0dXJlU3RhZ2VzLmhhcyhrKSAmJiBzaG93TmFtZVN0YWdlcyAmJiBzaG93TmFtZVN0YWdlcy5oYXMoaykpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFsbE9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHR1cm4gb2ZmIGZvciB0aGlzIHN0YWdlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dEb0F0U3RhZ2VzKHByZXYgPT4geyBjb25zdCBuID0gbmV3IFNldChwcmV2IHx8IFtdKTsgbi5kZWxldGUoayk7IHJldHVybiBuOyB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd1NpZ25hdHVyZVN0YWdlcyhwcmV2ID0+IHsgY29uc3QgbiA9IG5ldyBTZXQocHJldiB8fCBbXSk7IG4uZGVsZXRlKGspOyByZXR1cm4gbjsgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dOYW1lU3RhZ2VzKHByZXYgPT4geyBjb25zdCBuID0gbmV3IFNldChwcmV2IHx8IFtdKTsgbi5kZWxldGUoayk7IHJldHVybiBuOyB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHR1cm4gb24gZm9yIHRoaXMgc3RhZ2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd0RvQXRTdGFnZXMocHJldiA9PiB7IGNvbnN0IG4gPSBuZXcgU2V0KHByZXYgfHwgW10pOyBuLmFkZChrKTsgcmV0dXJuIG47IH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93U2lnbmF0dXJlU3RhZ2VzKHByZXYgPT4geyBjb25zdCBuID0gbmV3IFNldChwcmV2IHx8IFtdKTsgbi5hZGQoayk7IHJldHVybiBuOyB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd05hbWVTdGFnZXMocHJldiA9PiB7IGNvbnN0IG4gPSBuZXcgU2V0KHByZXYgfHwgW10pOyBuLmFkZChrKTsgcmV0dXJuIG47IH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvUmVhY3QuRnJhZ21lbnQ+XHJcbiAgICAgICAgICAgICAgICAgICkpXHJcbiAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGdyaWRDb2x1bW46ICcxIC8gLTEnLCBmb250U2l6ZTogMTMsIGNvbG9yOiAnIzY2NicgfX0+4Z6Y4Z634Z6T4Z6R4Z624Z6T4Z+L4Z6Y4Z624Z6T4Z6c4Z6C4Z+S4Z6C4Z6V4Z+S4Z6J4Z6+4Z6Y4Z6P4Z63PC9kaXY+XHJcbiAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGV0YWlscz5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICB7bG9hZGluZyAmJiA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6IDIwIH19PuGegOGfhuGeluGeu+GehOGeiuGeueGegOGek+GetuGfhi4uLjwvZGl2Pn1cclxuICAgICAgeyFsb2FkaW5nICYmICFyZWNvcmQgJiYgKFxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMTAgfX0+XHJcbiAgICAgICAgICA8ZGl2PuGemuGegOGemOGet+Gek+Geg+GevuGeieGegOGfhuGejuGej+Gfi+Gej+GfkuGemuGetjwvZGl2PlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IDgsIGRpc3BsYXk6ICdmbGV4JywgZ2FwOiA4LCBhbGlnbkl0ZW1zOiAnY2VudGVyJyB9fT5cclxuICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHNhbXBsZSA9IHtcclxuICAgICAgICAgICAgICAgICAgICBsZXR0ZXJObzogJ0RFTU8tMDAxJyxcclxuICAgICAgICAgICAgICAgICAgICBzb3VyY2U6ICdEZW1vIHNvdXJjZScsXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogJ1RoaXMgaXMgYSBkZW1vIHJlY29yZCB1c2VkIHdoZW4gbm8gYmFja2VuZCBkYXRhIGlzIGF2YWlsYWJsZS4gUmVwbGFjZSB3aXRoIHJlYWwgZGF0YSB3aGVuIGNvbm5lY3RlZCB0byB0aGUgc2VydmVyLicsXHJcbiAgICAgICAgICAgICAgICAgICAgbWV0YToge30sXHJcbiAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHM6IFtdXHJcbiAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgIHNldFJlY29yZChzYW1wbGUpO1xyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkgeyAvKiBpZ25vcmUgKi8gfVxyXG4gICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgc3R5bGU9e3sgcGFkZGluZzogJzZweCAxMHB4JywgYm9yZGVyUmFkaXVzOiA2LCBib3JkZXI6ICcxcHggc29saWQgIzY0NjY2OWZmJyB9fVxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgTG9hZCBkZW1vIHJlY29yZFxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBjb2xvcjogJyM2NjYnLCBmb250U2l6ZTogMTMgfX0+b3IgYXBwZW5kIDxjb2RlPj9kZW1vPTE8L2NvZGU+IHRvIHRoZSBVUkwgdG8gYXV0by1sb2FkPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgKX1cclxuXHJcbiAgICAgIHtyZWNvcmQgJiYgKFxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgcG9zaXRpb246ICdyZWxhdGl2ZScsIGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAxMiwgYWxpZ25JdGVtczogJ2ZsZXgtc3RhcnQnLCB3aWR0aDogJzEwMCUnLCBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsIHBhZGRpbmdUb3A6IDE2LCBwYWRkaW5nTGVmdDogMjQsIHBhZGRpbmdSaWdodDogMjQsIGJhY2tncm91bmQ6ICcjZWZlZmVmJywgZmxleFdyYXA6ICd3cmFwJywgb3ZlcmZsb3dYOiAnYXV0bycgfX0+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNoZWV0XCIgcmVmPXtzaGVldFJlZn0gc3R5bGU9e3sgd2lkdGg6ICcyMTBtbScsIG1pbldpZHRoOiAnMjEwbW0nLCBoZWlnaHQ6ICcyOTdtbScsIGZsZXhTaHJpbms6IDAsIG1hcmdpbjogJzI0cHggMTJweCAyNHB4IDI0cHgnLCBiYWNrZ3JvdW5kOiAnI2ZmZicsIGJveFNoYWRvdzogJzAgMTBweCAyNHB4IHJnYmEoMCwwLDAsMC4xNCknLCBib3JkZXJSYWRpdXM6IDYsIGJveFNpemluZzogJ2JvcmRlci1ib3gnLCBib3JkZXI6ICcxcHggc29saWQgI2U1ZTdlYicsIGRpc3BsYXk6ICdmbGV4JywgZmxleERpcmVjdGlvbjogJ2NvbHVtbicgfX0+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGFnZVwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxMG1tJywgZm9udEZhbWlseTogXCInS2htZXIgT1MgU2llbXJlYXAnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLCBjb2xvcjogJyMwMDAnLCBoZWlnaHQ6ICcxMDAlJywgb3ZlcmZsb3c6ICdhdXRvJywgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcgfX0+XHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgdGV4dEFsaWduOiAnY2VudGVyJywgZm9udFdlaWdodDogMzAwLCBtYXJnaW5Cb3R0b206IDYsIGZvbnRGYW1pbHk6J0tobWVyIE9TIE11b2wgTGlnaHQnLCBmb250U2l6ZTogMTggfX0+XHJcbiAgICAgICAgICAgICAg4Z6W4Z+S4Z6a4Z+H4Z6a4Z624Z6H4Z624Z6O4Z624Z6F4Z6A4Z+S4Z6a4Z6A4Z6Y4Z+S4Z6W4Z674Z6H4Z62XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyB0ZXh0QWxpZ246ICdjZW50ZXInLCBmb250V2VpZ2h0OiAzMDAsIG1hcmdpbkJvdHRvbTogNSwgZm9udEZhbWlseTonS2htZXIgT1MgTXVvbCBMaWdodCcsIGZvbnRTaXplOiAxfX0+XHJcbiAgICAgICAgICAgICAg4Z6H4Z624Z6P4Z63IOGen+GetuGen+Gek+GetiDhnpbhn5Lhnprhn4fhnpjhnqDhnrbhnoDhn5Lhnp/hno/hn5LhnppcclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHBvc2l0aW9uOiAncmVsYXRpdmUnLCB0ZXh0QWxpZ246ICdjZW50ZXInLCBtYXJnaW46ICcxMHB4IDAnIH19PlxyXG4gICAgICAgICAgICAgIHt0cnVlID8gKFxyXG4gICAgICAgICAgICAgICAgPGltZ1xyXG4gICAgICAgICAgICAgICAgICBzcmM9e2xvZ28zfSAvLyBvciBhIFVSTCBsaWtlIGAke0FQSV9CQVNFfSR7c2lnbmF0dXJlLmZpbGVQYXRofWBcclxuICAgICAgICAgICAgICAgICAgYWx0PVwiXCJcclxuICAgICAgICAgICAgICAgICAgYXJpYS1oaWRkZW49XCJ0cnVlXCJcclxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcclxuICAgICAgICAgICAgICAgICAgICB0b3A6ICc1MCUnLFxyXG4gICAgICAgICAgICAgICAgICAgIGxlZnQ6ICc1MCUnLFxyXG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogJ3RyYW5zbGF0ZSgtNTAlLCAtNTAlKScsXHJcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IDEwMCxcclxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6ICdhdXRvJyxcclxuICAgICAgICAgICAgICAgICAgICBvcGFjaXR5OiA5OCxcclxuICAgICAgICAgICAgICAgICAgICBwb2ludGVyRXZlbnRzOiAnbm9uZScsXHJcbiAgICAgICAgICAgICAgICAgICAgekluZGV4OiAxXHJcbiAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgdGV4dEFsaWduOiAnbGVmdCcsIHBhZGRpbmc6ICcwbW0gMCcsIGZvbnRGYW1pbHk6J0tobWVyIE9TIE11b2wgTGlnaHQnLCBmb250U2l6ZTogMTYgfX0+XHJcbiAgICAgICAgICAgICAg4Z6A4Z+S4Z6a4Z6f4Z694Z6E4Z6f4Z674Z6B4Z624Z6X4Z634Z6U4Z624Z6bXHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyB0ZXh0QWxpZ246ICdsZWZ0JywgcGFkZGluZzogJzFtbSAwJywgZm9udEZhbWlseTonS2htZXIgT1MgTXVvbCBMaWdodCcsIGZvbnRTaXplOiAxNSB9fT5cclxuICAgICAgICAgICAgICDhnpjhnpPhn5LhnpHhnrjhnprhnpbhn4HhnpHhn5Lhnpnhnpjhnrfhno/hn5Lhno/hnpfhnrbhnpbhnoHhn5Lhnpjhn4Lhnpot4Z6f4Z684Z6c4Z+A4Z6PXHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyB0ZXh0QWxpZ246ICdjZW50ZXInLCBmb250RmFtaWx5OidLaG1lciBPUyBNdW9sIExpZ2h0JywgZm9udFNpemU6IDE1LCBtYXJnaW5Ub3A6IDAgfX0+XHJcbiAgICAgICAgICAgICAg4Z6A4Z+G4Z6O4Z6P4Z+L4Z6U4Z6E4Z+S4Z6g4Z624Z6JXHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmllbGRcIiBzdHlsZT17eyBtYXJnaW5Ub3A6IDUsIGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2ZsZXgtc3RhcnQnLCBnYXA6IDAgfX0+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwibGFiZWxcIiBzdHlsZT17eyB3aWR0aDogMTQwLCBtaW5XaWR0aDogMTQwLCBmb250RmFtaWx5OiAnS2htZXIgT1MgTXVvbCBMaWdodCcsIGZvbnRTaXplOiAxNSB9fT7hnpvhn4HhnoHhnpvhnrfhnoHhnrfhno/hnoXhnrzhnps6PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInZhbHVlXCIgc3R5bGU9e3sgZmxleDogMSB9fT5cclxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAxMiB9fT5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBsaW5lSGVpZ2h0OiAxIH19PntyZWNvcmQ/LmVudHJ5Tm8gPyB0b0tobWVyRGlnaXRzKHJlY29yZC5lbnRyeU5vKSA6ICcnfSDhnpgu4Z6YLuGegS7hnp88L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250U2l6ZTogMTQsIGNvbG9yOiAnIzAwMCcgfX0+eygoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gKHJlY29yZCAmJiAocmVjb3JkLmVudHJ5RGF0ZSB8fCByZWNvcmQuZGF0ZSkpIHx8IGNhcHR1cmVkRGF0ZTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXJhdykgcmV0dXJuICcnO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5VGltZSA9IChyZWNvcmQgJiYgKHJlY29yZC5lbnRyeVRpbWUgfHwgcmVjb3JkLmVudHJ5X3RpbWUpKSB8fCAnJztcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkdCA9IGFwcGx5RW50cnlUaW1lKHBhcnNlUHJlZmVyTG9jYWxUaW1lKHJhdywgZW50cnlUaW1lKSwgZW50cnlUaW1lKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYOGeheGeu+GfhyAke2Zvcm1hdEtobWVyRGF0ZVRpbWUoZHQpfWA7XHJcbiAgICAgICAgICAgICAgICAgIH0pKCl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICB7ZWZmZWN0aXZlU2hvd0xldHRlck5vID8gKFxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmllbGRcIiBzdHlsZT17eyBtYXJnaW5Ub3A6IDYsIGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2ZsZXgtc3RhcnQnLCBnYXA6IDAgfX0+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJsYWJlbFwiIHN0eWxlPXt7IHdpZHRoOiAxNDAsIG1pbldpZHRoOiAxNDAsIGZvbnRGYW1pbHk6ICdLaG1lciBPUyBNdW9sIExpZ2h0JywgZm9udFNpemU6IDE1IH19PuGem+Get+GegeGet+Gej+Gem+GfgeGegTo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ2YWx1ZVwiIHN0eWxlPXt7IGZsZXg6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiA4IH19PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXY+e3JlY29yZD8ubGV0dGVyTm8gPyB0b0tobWVyRGlnaXRzKHJlY29yZC5sZXR0ZXJObykgOiAnJ308L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRTaXplOiAxMiwgY29sb3I6ICcjMDcwNzA3ZmYnIH19PnsoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gKHJlY29yZCAmJiByZWNvcmQuZGF0ZSkgfHwgY2FwdHVyZWREYXRlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCFyYXcpIHJldHVybiAnJztcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGR0ID0gKHJhdyBpbnN0YW5jZW9mIERhdGUpID8gcmF3IDogbmV3IERhdGUocmF3KTtcclxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBg4Z6F4Z674Z+HICR7Zm9ybWF0S2htZXJEYXRlKGR0KX1gO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pKCl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmaWVsZFwiIHN0eWxlPXt7IG1hcmdpblRvcDogNiwgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnZmxleC1zdGFydCcsIGdhcDogMCB9fT5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJsYWJlbFwiIHN0eWxlPXt7IHdpZHRoOiAxNDAsIG1pbldpZHRoOiAxNDAsIGZvbnRGYW1pbHk6ICdLaG1lciBPUyBNdW9sIExpZ2h0JywgZm9udFNpemU6IDE1IH19PuGemOGegOGeluGeuDo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidmFsdWVcIiBzdHlsZT17eyBmbGV4OiAxIH19PntyZWNvcmQ/LnNvdXJjZSB8fCAnJ308L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmaWVsZFwiIHN0eWxlPXt7IG1hcmdpblRvcDogNiwgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnZmxleC1zdGFydCcsIGdhcDogMCB9fT5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJsYWJlbFwiIHN0eWxlPXt7IHdpZHRoOiAxNDAsIG1pbldpZHRoOiAxNDAsIGZvbnRGYW1pbHk6ICdLaG1lciBPUyBNdW9sIExpZ2h0JywgZm9udFNpemU6IDE1IH19PuGegOGemOGfkuGemOGenOGej+GfkuGekOGeuzo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidmFsdWUtcGxhaW5cIiBzdHlsZT17eyBmbGV4OiAxLCB3aGl0ZVNwYWNlOiAncHJlLXdyYXAnLCB3b3JkQnJlYWs6ICdicmVhay13b3JkJyB9fT57cmVjb3JkPy5jb250ZW50IHx8ICcnfTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgIFxyXG5cclxuICAgICAgICAgICAge2VmZmVjdGl2ZVNob3dDcmVhdG9yTmFtZSA/IChcclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZpZWxkXCIgc3R5bGU9e3sgbWFyZ2luVG9wOiA2LCBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdmbGV4LXN0YXJ0JywgZ2FwOiAwIH19PlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwibGFiZWxcIiBzdHlsZT17eyB3aWR0aDogMTQwLCBtaW5XaWR0aDogMTQwLCBmb250RmFtaWx5OiAnS2htZXIgT1MgTXVvbCBMaWdodCcsIGZvbnRTaXplOiAxNSB9fT7hnpThnonhn5LhnoXhnrzhnpvhnpvhnrfhnoHhnrfhno/hnorhn4Thnpk6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidmFsdWVcIiBzdHlsZT17eyBmbGV4OiAxIH19PntyZWNvcmQ/LmNyZWF0b3JOYW1lIHx8ICcnfTwvc3Bhbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgKSA6IG51bGx9XHJcblxyXG4gICAgICAgICAgIFxyXG5cclxuICAgICAgICAgICAge3Zpc2libGVTdGFnZXMgJiYgdmlzaWJsZVN0YWdlcy5oYXMoJ1MnKSAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBib3JkZXI6ICcxcHggZGFzaGVkICMxNjE2MTZmZicsIHBhZGRpbmc6IDEsIG1hcmdpblRvcDogNSB9fT5cclxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2dyaWQnLCBncmlkVGVtcGxhdGVDb2x1bW5zOiAnNTBmcicsIGdhcDogMTIgfX0+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sZS1sYWJlbFwiIHN0eWxlPXt7IHRleHRBbGlnbjogJ2NlbnRlcicsIG1hcmdpblRvcDogMiwgZm9udEZhbWlseTogJ0tobWVyIE9TIE11b2wgTGlnaHQnLCBmb250U2l6ZTogMTAgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICB7KG1ldGEgJiYgbWV0YS5mZWVkYmFja1N0YWdlUm9sZXMgJiYgbWV0YS5mZWVkYmFja1N0YWdlUm9sZXMucykgfHwgZ2V0Um9sZUxhYmVsKCdzJykgfHwgKG1ldGEgJiYgbWV0YS5yZXBvcnRlck5hbWUpfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDx0ZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICAgICAgcm93cz17NH1cclxuICAgICAgICAgICAgICAgICAgICAgIHJlZj17Y291cnNlTm90ZVJlZn1cclxuICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtsZWZ0Q29udGVudH1cclxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4geyBzZXRMZWZ0Q29udGVudChlLnRhcmdldC52YWx1ZSk7IGNsZWFyU3RhZ2VNZXNzYWdlKCdTJyk7IH19XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIi4uLi4uLi4uLi4uLi4uLi4uLi4uXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXshaXNBc3NpZ25lZFRvU3RhZ2UoWydTJ10pfVxyXG4gICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6ICcxMDAlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAnYXV0bycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbkhlaWdodDogJzI0cHgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lSGVpZ2h0OiB1aUxpbmVIZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHRBbGlnbjogJ2p1c3RpZnknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW46IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICc4cHggMjJweCAxMnB4IDhweCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc2l6ZTogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdib3RoJyA6ICdub25lJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmZsb3c6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnYXV0bycgOiAnaGlkZGVuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZEltYWdlOiBtYW51YWxSZXNpemVFbmFibGVkID8gXCJsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCByZ2JhKDAsMCwwLDAuMjIpIDI1JSwgdHJhbnNwYXJlbnQgMjUlKSwgbGluZWFyLWdyYWRpZW50KDEzNWRlZywgcmdiYSgwLDAsMCwwLjE2KSAyNSUsIHRyYW5zcGFyZW50IDI1JSksIGxpbmVhci1ncmFkaWVudCgxMzVkZWcsIHJnYmEoMCwwLDAsMC4xKSAyNSUsIHRyYW5zcGFyZW50IDI1JSlcIiA6ICdub25lJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZFNpemU6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnMTRweCAxNHB4LCAxMHB4IDEwcHgsIDZweCA2cHgnIDogJzAgMCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRSZXBlYXQ6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnbm8tcmVwZWF0JyA6ICduby1yZXBlYXQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kUG9zaXRpb246IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAncmlnaHQgNnB4IGJvdHRvbSA2cHgsIHJpZ2h0IDRweCBib3R0b20gNHB4LCByaWdodCAycHggYm90dG9tIDJweCcgOiAnMCAwJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9udEZhbWlseTogXCInS2htZXIgT1MgU2llbXJlYXAnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBib3hTaXppbmc6ICdib3JkZXItYm94JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpdGVTcGFjZTogJ3ByZS13cmFwJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmZsb3dXcmFwOiAnYW55d2hlcmUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JkQnJlYWs6ICdicmVhay13b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dEluZGVudDogJzMwcHgnXHJcbiAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgdGV4dEFsaWduOiAnY2VudGVyJywgbWFyZ2luVG9wOiAwIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAge2hhc0NvdXJzZU5vdGUgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2VmZmVjdGl2ZVNob3dEb0F0KCdTJykgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2PuGekuGfkuGenOGevuGek+GfhSB7Zm9ybWF0S2htZXJEYXRlVGltZShkYXRlRm9yTWV0YUtleSgnQ291cnNlRGF0ZScpIHx8IGNhcHR1cmVkRGF0ZSl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyhlZmZlY3RpdmVTaG93U2lnbmF0dXJlKCdTJykgJiYgc2lnU1VybCkgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IG1hcmdpblRvcDogMCB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGltZyBzcmM9e3NpZ1NVcmx9IGFsdD1cInNpZy1zXCIgc3R5bGU9e3sgbWF4V2lkdGg6IDEwMCwgbWF4SGVpZ2h0OiA4MCwgb2JqZWN0Rml0OiAnY29udGFpbicsIGRpc3BsYXk6ICdibG9jaycsIG1hcmdpbjogJzAgYXV0bycgfX0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8Lz5cclxuICAgICAgICAgICAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICAgICAgICAgICAgeyhlZmZlY3RpdmVTaG93TmFtZSgnUycpIHx8IHN0YWdlSGFzU2VuZGVyRm9yS2V5cyhbJ1MnXSkpID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZW5kZXItbmFtZVwiIHN0eWxlPXt7IGZvbnRGYW1pbHk6IFwiJ0tobWVyIE9TIG11b2wgbGlnaHQnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLCBtYXJnaW5Ub3A6IDAsIGZvbnRXZWlnaHQ6IDEwMCB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgUyBhbHJlYWR5IGhhcyBhIENvdXJzZU5vdGUsIHByZWZlciB0aGUgYWN0dWFsIFMgc2VuZGVyXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgZG8gbm90IGF0dGVtcHQgdG8gcmVzb2x2ZSBvdGhlciBzdGFnZSBrZXlzIGZyb20gdGhlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3YWl0aW5nU3RhZ2VTZW5kZXIgdGV4dC4gVGhpcyBwcmV2ZW50cyBzaG93aW5nIGEgZGlmZmVyZW50XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzdGFnZSdzIG5hbWUgd2hlbiBTIGhhcyBhIGNvbW1lbnQvc2lnbmF0dXJlLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhhc0NvdXJzZU5vdGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChnZXRTdGFnZVNlbmRlck5hbWUoJ1MnKSB8fCAnJykudG9TdHJpbmcoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAod2FpdGluZ1N0YWdlU2VuZGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHMgPSBTdHJpbmcod2FpdGluZ1N0YWdlU2VuZGVyIHx8ICcnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJ5IHRvIGV4dHJhY3Qgc3RhZ2Uga2V5IGluIHBhcmVudGhlc2VzIGxpa2UgXCJOYW1lIChTMylcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtID0gcy5tYXRjaCgvXFwoKFteKV0rKVxcKVxccyokLyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtICYmIG1bMV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBtWzFdLnRyaW0oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBwcmVmZXIgdGhlIHNpZ25hdHVyZSBmdWxsTmFtZUtoIGZvciB0aGF0IHN0YWdlIHdoZW4gYXZhaWxhYmxlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJhd1N0YWdlID0gbm9ybWFsaXplZFN0YWdlcyAmJiBub3JtYWxpemVkU3RhZ2VzW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpZCA9IHJlc29sdmVTdGFnZUlkKHJhd1N0YWdlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZCAmJiBzaWduYXR1cmVzTWFwICYmIHNpZ25hdHVyZXNNYXBbaWRdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZyA9IHNpZ25hdHVyZXNNYXBbaWRdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKHNpZyAmJiAoc2lnLmZ1bGxOYW1lS2ggfHwgc2lnLmZ1bGxOYW1lIHx8IHNpZy5uYW1lKSkgfHwgKGdldFJvbGVMYWJlbChrZXkpIHx8IHMucmVwbGFjZSgvXFxzKlxcKFteKV0rXFwpXFxzKiQvLCAnJykudHJpbSgpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhYmVsID0gZ2V0Um9sZUxhYmVsKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhYmVsKSByZXR1cm4gbGFiZWw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgd2FpdGluZ1N0YWdlU2VuZGVyIGl0c2VsZiBpcyAob3IgY29udGFpbnMpIGEgc3RhZ2Uga2V5LCB0cnkgdGhhdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXlPbmx5ID0gKHMubWF0Y2goLyhTXFxkfFN8U0RSfFNEfERJUnxTRElSfEhPKS9pKSB8fCBbXSlbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXlPbmx5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJhd1N0YWdlID0gbm9ybWFsaXplZFN0YWdlcyAmJiBub3JtYWxpemVkU3RhZ2VzW2tleU9ubHldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaWQgPSByZXNvbHZlU3RhZ2VJZChyYXdTdGFnZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQgJiYgc2lnbmF0dXJlc01hcCAmJiBzaWduYXR1cmVzTWFwW2lkXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWcgPSBzaWduYXR1cmVzTWFwW2lkXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChzaWcgJiYgKHNpZy5mdWxsTmFtZUtoIHx8IHNpZy5mdWxsTmFtZSB8fCBzaWcubmFtZSkpIHx8IChnZXRSb2xlTGFiZWwoa2V5T25seSkgfHwga2V5T25seSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYWJlbCA9IGdldFJvbGVMYWJlbChrZXlPbmx5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFiZWwpIHJldHVybiBsYWJlbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBvdGhlcndpc2UgcmV0dXJuIHRoZSBuYW1lIHBvcnRpb24gd2l0aG91dCB0aGUgdHJhaWxpbmcgXCIoUylcIiBwYXJ0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzLnJlcGxhY2UoL1xccypcXChbXildK1xcKVxccyokLywgJycpLnRyaW0oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRTdGFnZVNlbmRlck5hbWUoJ1MnKSB8fCAnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSkoKX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogaGFzQ291cnNlTm90ZSA/ICdzcGFjZS1iZXR3ZWVuJyA6ICdmbGV4LXN0YXJ0JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1hcmdpblRvcDogNiwgcGFkZGluZzogJzBweCcgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiBzdGFnZU1lc3NhZ2VGb3IoJ1MnKSA/ICcjMGI2NjIzJyA6ICcjZTUzMzMzZmYnLCBtaW5IZWlnaHQ6IDAgfX0+e3N0YWdlTWVzc2FnZUZvcignUycpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgey8qIEluLXNoZWV0IFNlbmQgRmVlZGJhY2sgYnV0dG9uIHJlbW92ZWQ7IHRvb2xiYXIgYW5kIHByaW50LW9ubHkgYnV0dG9ucyB1c2VkIGluc3RlYWQgKi99XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgbWFyZ2luVG9wOiAnMG1tJyB9fSAvPlxyXG5cclxuICAgICAgICAgICAgey8qIFN0YWdlIDEgKFMxKSAtIE9mZmljZSBib3g6IHNob3cgd2hlbiBTMSBhc3NpZ25lZCBvciBoYXMgYSB2YWx1ZSAqL31cclxuICAgICAgICAgICAge3Zpc2libGVTdGFnZXMgJiYgdmlzaWJsZVN0YWdlcy5oYXMoJ1MxJykgJiYgKFxyXG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgYm9yZGVyOiAnMXB4IGRhc2hlZCAjMTYxNjE2ZmYnLCBwYWRkaW5nOiAxLCBtYXJnaW5Ub3A6IDUgfX0+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdncmlkJywgZ3JpZFRlbXBsYXRlQ29sdW1uczogJzFmcicsIGdhcDogMTIgfX0+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJywgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1hcmdpblRvcDogNSB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sZS1sYWJlbFwiIHN0eWxlPXt7IHRleHRBbGlnbjogJ2NlbnRlcicsIGZvbnRGYW1pbHk6ICdLaG1lciBPUyBNdW9sIExpZ2h0JywgZmxleDogMSB9fT57Z2V0Um9sZUxhYmVsKCdTMScpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDx0ZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICAgICAgcm93cz17NH1cclxuICAgICAgICAgICAgICAgICAgICAgIHJlZj17czFUZXh0YXJlYVJlZn1cclxuICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtzMUNvbnRlbnR9XHJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHsgc2V0UzFDb250ZW50KGUudGFyZ2V0LnZhbHVlKTsgY2xlYXJTdGFnZU1lc3NhZ2UoJ1MxJyk7IH19XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIi4uLi4uLi4uLi4uLi4uLi4uLi4uXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXshaXNBc3NpZ25lZFRvU3RhZ2UoWydTMSddKX1cclxuICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiBtYW51YWxSZXNpemVFbmFibGVkID8gJ2NhbGMoMTAwJSAtIDE4cHgpJyA6ICcxMDAlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAnYXV0bycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbkhlaWdodDogJzcycHgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lSGVpZ2h0OiB1aUxpbmVIZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHRBbGlnbjogJ2p1c3RpZnknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW46IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpblJpZ2h0OiBtYW51YWxSZXNpemVFbmFibGVkID8gJzE4cHgnIDogMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luQm90dG9tOiBtYW51YWxSZXNpemVFbmFibGVkID8gJzEycHgnIDogMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogJzhweCAyMnB4IDEycHggOHB4JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzaXplOiBtYW51YWxSZXNpemVFbmFibGVkID8gJ2JvdGgnIDogJ25vbmUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVyZmxvdzogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdhdXRvJyA6ICdoaWRkZW4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb250RmFtaWx5OiBcIidLaG1lciBPUyBTaWVtcmVhcCcsJ05vdG8gU2FucyBLaG1lcicsJ0tobWVyIE9TJywnSGFudW1hbicsQXJpYWwsJ3NhbnMtc2VyaWYnXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJveFNpemluZzogJ2JvcmRlci1ib3gnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aGl0ZVNwYWNlOiAncHJlLXdyYXAnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVyZmxvd1dyYXA6ICdhbnl3aGVyZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdvcmRCcmVhazogJ2JyZWFrLXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0SW5kZW50OiAnMzBweCdcclxuICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgLz5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyB0ZXh0QWxpZ246ICdjZW50ZXInLCBtYXJnaW5Ub3A6IDAgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICB7aGFzQ291cnNlMU5vdGUgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtlZmZlY3RpdmVTaG93RG9BdCgnUzEnKSA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2PuGekuGfkuGenOGevuGek+GfhSB7Zm9ybWF0S2htZXJEYXRlVGltZShkYXRlRm9yTWV0YUtleSgnQ291cnNlMURhdGUnKSB8fCBjYXB0dXJlZERhdGUpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyhlZmZlY3RpdmVTaG93U2lnbmF0dXJlKCdTMScpICYmIHNpZzFVcmwpID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IDAgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPXtzaWcxVXJsfSBhbHQ9XCJzaWctczFcIiBzdHlsZT17eyBtYXhXaWR0aDogMTIwLCBtYXhIZWlnaHQ6IDgwLCBvYmplY3RGaXQ6ICdjb250YWluJywgZGlzcGxheTogJ2Jsb2NrJywgbWFyZ2luOiAnMCBhdXRvJyB9fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7KGVmZmVjdGl2ZVNob3dOYW1lKCdTMScpIHx8IHN0YWdlSGFzU2VuZGVyRm9yS2V5cyhbJ1MxJ10pKSA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZW5kZXItbmFtZVwiIHN0eWxlPXt7IGZvbnRGYW1pbHk6IFwiJ0tobWVyIE9TIG11b2wgbGlnaHQnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLCBtYXJnaW5Ub3A6IDAsIGZvbnRXZWlnaHQ6IDEwMCB9fT57Z2V0U3RhZ2VTZW5kZXJOYW1lKCdTMScpIHx8IHdhaXRpbmdTdGFnZVNlbmRlciB8fCAnJ308L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywganVzdGlmeUNvbnRlbnQ6IGhhc0NvdXJzZTFOb3RlID8gJ3NwYWNlLWJldHdlZW4nIDogJ2ZsZXgtc3RhcnQnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgbWFyZ2luVG9wOiA2LCBwYWRkaW5nOiAnMHB4JyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgY29sb3I6IHN0YWdlTWVzc2FnZUZvcignUzEnKSA/ICcjMGI2NjIzJyA6ICcjNjY2JywgbWluSGVpZ2h0OiAwIH19PntzdGFnZU1lc3NhZ2VGb3IoJ1MxJyl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICB7LyogaW4tc2hlZXQgc2VuZCBidXR0b24gcmVtb3ZlZDsgdXNlIHRvb2xiYXIvcHJpbnQtb25seSBjb250cm9scyBpbnN0ZWFkICovfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgICB7LyogRGVwYXJ0bWVudCBIZWFkIGJsb2NrIHNpbWlsYXIgVUkgdG8gdGhlIHJlY2lwaWVudCBibG9jayAqL31cclxuICAgICAgICAgICAgey8qKiBEZXBhcnRtZW50IGhlYWQgbm90ZSBibG9jazogdGV4dGFyZWEgKyBzaWduYXR1cmUvZGF0ZSBsaWtlIENvdXJzZTFOb3RlICovfVxyXG4gICAgICAgICAgICB7dmlzaWJsZVN0YWdlcyAmJiB2aXNpYmxlU3RhZ2VzLmhhcygnUzInKSAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBib3JkZXI6ICcxcHggZGFzaGVkICMxNjE2MTZmZicsIHBhZGRpbmc6IDEsIG1hcmdpblRvcDogNSB9fT5cclxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2dyaWQnLCBncmlkVGVtcGxhdGVDb2x1bW5zOiAnMWZyJywgZ2FwOiAxMiB9fT5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAxIH19PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sZS1zMiByb2xlLWxhYmVsXCIgc3R5bGU9e3sgdGV4dEFsaWduOiAnY2VudGVyJywgbWFyZ2luVG9wOiA1LCBmb250RmFtaWx5OiAnS2htZXIgT1MgTXVvbCBMaWdodCcgfX0+e2dldFJvbGVMYWJlbCgnUzInKX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICAgIHJvd3M9ezR9XHJcbiAgICAgICAgICAgICAgICAgICAgICByZWY9e2RlcHRUZXh0YXJlYVJlZn1cclxuICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtkZXB0Q29udGVudH1cclxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4geyBzZXREZXB0Q29udGVudChlLnRhcmdldC52YWx1ZSk7IGNsZWFyU3RhZ2VNZXNzYWdlKCdTMicpOyB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIuLi4uLi4uLi4uLi4uLi4uLi4uLlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17IWlzQXNzaWduZWRUb1N0YWdlKFsnUzInXSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdjYWxjKDEwMCUgLSAxOHB4KScgOiAnMTAwJScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogJ2F1dG8nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5IZWlnaHQ6ICc3MnB4JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZUhlaWdodDogdWlMaW5lSGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0QWxpZ246ICdqdXN0aWZ5JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5SaWdodDogbWFudWFsUmVzaXplRW5hYmxlZCA/ICcxOHB4JyA6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbkJvdHRvbTogbWFudWFsUmVzaXplRW5hYmxlZCA/ICcxMnB4JyA6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICc4cHggMjJweCAxMnB4IDhweCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc2l6ZTogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdib3RoJyA6ICdub25lJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmZsb3c6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnYXV0bycgOiAnaGlkZGVuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9udEZhbWlseTogXCInS2htZXIgT1MgU2llbXJlYXAnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBib3hTaXppbmc6ICdib3JkZXItYm94JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpdGVTcGFjZTogJ3ByZS13cmFwJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmZsb3dXcmFwOiAnYW55d2hlcmUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JkQnJlYWs6ICdicmVhay13b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dEluZGVudDogJzMwcHgnXHJcbiAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgdGV4dEFsaWduOiAnY2VudGVyJywgbWFyZ2luVG9wOiAwIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAge2hhc0RlcHROb3RlID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtlZmZlY3RpdmVTaG93RG9BdCgnUzInKSA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+4Z6S4Z+S4Z6c4Z6+4Z6T4Z+FIHtmb3JtYXRLaG1lckRhdGVUaW1lKGRhdGVGb3JNZXRhS2V5KCdDb3Vyc2UyRGF0ZScpIHx8IGNhcHR1cmVkRGF0ZSl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyhlZmZlY3RpdmVTaG93U2lnbmF0dXJlKCdTMicpICYmIHNpZzJVcmwpID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IDYgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPXtzaWcyVXJsfSBhbHQ9XCJzaWctaGVhZFwiIHN0eWxlPXt7IG1heFdpZHRoOiAxMjAsIG1heEhlaWdodDogNjAsIG9iamVjdEZpdDogJ2NvbnRhaW4nLCBkaXNwbGF5OiAnYmxvY2snLCBtYXJnaW46ICcwIGF1dG8nIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7KGVmZmVjdGl2ZVNob3dOYW1lKCdTMicpIHx8IHN0YWdlSGFzU2VuZGVyRm9yS2V5cyhbJ1MyJ10pKSA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZW5kZXItbmFtZVwiIHN0eWxlPXt7IGZvbnRGYW1pbHk6IFwiJ0tobWVyIE9TIG11b2wgbGlnaHQnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLCBtYXJnaW5Ub3A6IDUsIGZvbnRXZWlnaHQ6IDEwMCB9fT57Z2V0U3RhZ2VTZW5kZXJOYW1lKCdTMicpIHx8ICcnfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogaGFzRGVwdE5vdGUgPyAnc3BhY2UtYmV0d2VlbicgOiAnZmxleC1zdGFydCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBtYXJnaW5Ub3A6IDYsIHBhZGRpbmc6ICcwcHgnIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBjb2xvcjogc3RhZ2VNZXNzYWdlRm9yKCdTMicpID8gJyMwYjY2MjMnIDogJyM2NjYnLCBtaW5IZWlnaHQ6IDAgfX0+e3N0YWdlTWVzc2FnZUZvcignUzInKX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIHsvKiBpbi1zaGVldCBzZW5kIGJ1dHRvbiByZW1vdmVkOyB1c2UgdG9vbGJhci9wcmludC1vbmx5IGNvbnRyb2xzIGluc3RlYWQgKi99XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICBcclxuICAgICAgICAgICAgey8qIFN0YWdlIGFyZWEgZW5kIOKAlCBEZXB1dHkgRGlyZWN0b3IgYmxvY2sgbWF0Y2hpbmcgcmVjaXBpZW50IFVJIOGenOGeguGfkuGeguGekeGeuDQg4Z6R4Z64NSAqL31cclxuICAgICAgICAgICAgeyh2aXNpYmxlU3RhZ2VzICYmICh2aXNpYmxlU3RhZ2VzLmhhcygnUzMnKSB8fCB2aXNpYmxlU3RhZ2VzLmhhcygnUzQnKSkpID8gZGVwdXR5QmxvY2sgOiBudWxsfVxyXG5cclxuICAgICAgICAgICAge3Zpc2libGVTdGFnZXMgJiYgdmlzaWJsZVN0YWdlcy5oYXMoJ1M1JykgJiYgKFxyXG4gICAgICAgICAgICAgICh2aXNpYmxlU3RhZ2VzICYmIHZpc2libGVTdGFnZXMuaGFzKCdTNCcpKSA/IChcclxuICAgICAgICAgICAgICAgIC8vIFNpZGUtYnktc2lkZSBTNCAoZGVwdXR5IHJpZ2h0KSBhbmQgUzUgKGRpcmVjdG9yKVxyXG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IDUsIGRpc3BsYXk6ICdncmlkJywgZ3JpZFRlbXBsYXRlQ29sdW1uczogJzFmciAxZnInLCBnYXA6IDggfX0+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgYm9yZGVyOiAnMXB4IGRhc2hlZCAjMTYxNjE2ZmYnLCBwYWRkaW5nOiA1IH19PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sZS1sYWJlbFwiIHN0eWxlPXt7IHRleHRBbGlnbjogJ2NlbnRlcicsIG1hcmdpblRvcDogMCwgZm9udEZhbWlseTogJ0tobWVyIE9TIE11b2wgTGlnaHQnIH19PntnZXRSb2xlTGFiZWwoJ1M0Jyl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGV4dGFyZWEgcm93cz17NH0gcmVmPXtkZXB1dHlSaWdodFRleHRhcmVhUmVmfSB2YWx1ZT17ZGVwdXR5UmlnaHRDb250ZW50fSBvbkNoYW5nZT17KGUpID0+IHsgc2V0RGVwdXR5UmlnaHRDb250ZW50KGUudGFyZ2V0LnZhbHVlKTsgY2xlYXJTdGFnZU1lc3NhZ2UoJ1M0Jyk7IH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiLi4uLi4uLi4uLi4uLi4uLi4uLi5cIiBzdHlsZT17eyB3aWR0aDogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdjYWxjKDEwMCUgLSAxOHB4KScgOiAnMTAwJScsIGhlaWdodDogJ2F1dG8nLCBtaW5IZWlnaHQ6ICc3MnB4JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZUhlaWdodDogdWlMaW5lSGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0QWxpZ246ICdqdXN0aWZ5JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5SaWdodDogbWFudWFsUmVzaXplRW5hYmxlZCA/ICcxOHB4JyA6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbkJvdHRvbTogbWFudWFsUmVzaXplRW5hYmxlZCA/ICcxMnB4JyA6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICc4cHggMjJweCAxMnB4IDhweCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc2l6ZTogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdib3RoJyA6ICdub25lJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmZsb3c6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnYXV0bycgOiAnaGlkZGVuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9udEZhbWlseTogXCInS2htZXIgT1MgU2llbXJlYXAnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBib3hTaXppbmc6ICdib3JkZXItYm94JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpdGVTcGFjZTogJ3ByZS13cmFwJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmZsb3dXcmFwOiAnYW55d2hlcmUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JkQnJlYWs6ICdicmVhay13b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dEluZGVudDogJzMwcHgnXHJcbiAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17IWlzQXNzaWduZWRUb1N0YWdlKFsnU0RSJywnUzQnXSl9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHRleHRBbGlnbjogJ2NlbnRlcicsIG1hcmdpblRvcDogMCB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2hhc0RlcHV0eVJpZ2h0ID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZWZmZWN0aXZlU2hvd0RvQXQoJ1M0JykgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+4Z6S4Z+S4Z6c4Z6+4Z6T4Z+FIHtmb3JtYXRLaG1lckRhdGVUaW1lKGRhdGVGb3JNZXRhS2V5KCdDb3Vyc2U0RGF0ZScpIHx8IGNhcHR1cmVkRGF0ZSl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsoZWZmZWN0aXZlU2hvd1NpZ25hdHVyZSgnUzQnKSAmJiBzaWdEZXB1dHlSaWdodFVybCkgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgbWFyZ2luVG9wOiAwIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPXtzaWdEZXB1dHlSaWdodFVybH0gYWx0PVwic2lnLWRlcHV0eS1yaWdodFwiIHN0eWxlPXt7IG1heFdpZHRoOiAxMDAsbWF4SGVpZ2h0OiA4MCwgb2JqZWN0Rml0OiAnY29udGFpbicsZGlzcGxheTogJ2Jsb2NrJyxtYXJnaW46ICcwIGF1dG8nIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyhlZmZlY3RpdmVTaG93TmFtZSgnUzYnKSB8fCBzdGFnZUhhc1NlbmRlckZvcktleXMoWydITycsJ1M2JywnUzQnLCdTMyddKSkgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZW5kZXItbmFtZVwiIHN0eWxlPXt7IGZvbnRGYW1pbHk6IFwiJ0tobWVyIE9TIG11b2wgbGlnaHQnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luVG9wOiA1LCBmb250V2VpZ2h0OiAxMDAgfX0+e2dldFN0YWdlU2VuZGVyTmFtZShbJ0hPJywnUzYnLCdTNCcsJ1MzJ10pIHx8ICcnfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywganVzdGlmeUNvbnRlbnQ6ICdmbGV4LXN0YXJ0JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1hcmdpblRvcDogNiwgcGFkZGluZzogJzBweCcgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBjb2xvcjogc3RhZ2VNZXNzYWdlRm9yKCdTNCcpID8gJyMwYjY2MjMnIDogJyM2NjYnLCBtaW5IZWlnaHQ6IDAgfX0+e3N0YWdlTWVzc2FnZUZvcignUzQnKX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGJvcmRlcjogJzFweCBkYXNoZWQgIzE2MTYxNmZmJywgcGFkZGluZzogNSB9fT5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvbGUtbGFiZWxcIiBzdHlsZT17eyB0ZXh0QWxpZ246ICdjZW50ZXInLCBtYXJnaW5Ub3A6IDAsIGZvbnRGYW1pbHk6ICdLaG1lciBPUyBNdW9sIExpZ2h0JyB9fT57Z2V0Um9sZUxhYmVsKCdTNScpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd3M9ezR9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZj17ZGlyZWN0b3JUZXh0YXJlYVJlZn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2RpcmVjdG9yQ29udGVudH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB7IHNldERpcmVjdG9yQ29udGVudChlLnRhcmdldC52YWx1ZSk7IGNsZWFyU3RhZ2VNZXNzYWdlKCdTNScpOyB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIi4uLi4uLi4uLi4uLi4uLi4uLi4uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFpc0Fzc2lnbmVkVG9TdGFnZShbJ0RJUicsJ1NESVInLCdTNSddKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnY2FsYygxMDAlIC0gMThweCknIDogJzEwMCUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6ICdhdXRvJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWluSGVpZ2h0OiAnNzJweCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVIZWlnaHQ6IHVpTGluZUhlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dEFsaWduOiAnanVzdGlmeScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbjogMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnMThweCcgOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5Cb3R0b206IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnMTJweCcgOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnOHB4IDIycHggMTJweCA4cHgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNpemU6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnYm90aCcgOiAnbm9uZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJmbG93OiBtYW51YWxSZXNpemVFbmFibGVkID8gJ2F1dG8nIDogJ2hpZGRlbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvbnRGYW1pbHk6IFwiJ0tobWVyIE9TIFNpZW1yZWFwJywnTm90byBTYW5zIEtobWVyJywnS2htZXIgT1MnLCdIYW51bWFuJyxBcmlhbCwnc2Fucy1zZXJpZidcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaXRlU3BhY2U6ICdwcmUtd3JhcCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJmbG93V3JhcDogJ2FueXdoZXJlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgd29yZEJyZWFrOiAnYnJlYWstd29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHRJbmRlbnQ6ICczMHB4J1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgLz5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHRleHRBbGlnbjogJ2xlZnQnLCBtYXJnaW5Ub3A6IDAgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtoYXNEaXJlY3RvciA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2VmZmVjdGl2ZVNob3dEb0F0KCdTNScpID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2PuGekuGfkuGenOGevuGek+GfhSB7Zm9ybWF0S2htZXJEYXRlVGltZShkYXRlRm9yTWV0YUtleSgnQ291cnNlNURhdGUnKSB8fCBjYXB0dXJlZERhdGUpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7KGVmZmVjdGl2ZVNob3dTaWduYXR1cmUoJ1M1JykgJiYgc2lnRGlyZWN0b3JVcmwpID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IG1hcmdpblRvcDogMCB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nIHNyYz17c2lnRGlyZWN0b3JVcmx9IGFsdD1cInNpZy1kaXJlY3RvclwiIHN0eWxlPXt7IG1heFdpZHRoOiAxMDAsIG1heEhlaWdodDogNzAsIG9iamVjdEZpdDogJ2NvbnRhaW4nLCBkaXNwbGF5OiAnYmxvY2snLCBtYXJnaW46ICcwIGF1dG8nIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7KGVmZmVjdGl2ZVNob3dOYW1lKCdTNScpIHx8IHN0YWdlSGFzU2VuZGVyRm9yS2V5cyhbJ0RJUicsJ1NESVInLCdTNSddKSkgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZW5kZXItbmFtZVwiIHN0eWxlPXt7IGZvbnRGYW1pbHk6IFwiJ0tobWVyIE9TIG11b2wgbGlnaHQnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLCBtYXJnaW5Ub3A6IDAsIGZvbnRXZWlnaHQ6IDEwMCB9fT57Z2V0U3RhZ2VTZW5kZXJOYW1lKFsnRElSJywnU0RJUicsJ1M1J10pIHx8ICcnfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGp1c3RpZnlDb250ZW50OiAnZmxleC1zdGFydCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBtYXJnaW5Ub3A6IDYsIHBhZGRpbmc6ICcwcHgnIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiBzdGFnZU1lc3NhZ2VGb3IoJ1M1JykgPyAnIzBiNjYyMycgOiAnIzY2NicsIG1pbkhlaWdodDogMCB9fT57c3RhZ2VNZXNzYWdlRm9yKCdTNScpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgYm9yZGVyOiAnMXB4IGRhc2hlZCAjMTYxNjE2ZmYnLCBwYWRkaW5nOiAxLCBtYXJnaW5Ub3A6IDUgfX0+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvbGUtbGFiZWxcIiBzdHlsZT17eyB0ZXh0QWxpZ246ICdjZW50ZXInLCBtYXJnaW5Ub3A6IDAsIGZvbnRGYW1pbHk6ICdLaG1lciBPUyBNdW9sIExpZ2h0JyB9fT57Z2V0Um9sZUxhYmVsKCdTNScpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDx0ZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICAgICAgcm93cz17NH1cclxuICAgICAgICAgICAgICAgICAgICAgIHJlZj17ZGlyZWN0b3JUZXh0YXJlYVJlZn1cclxuICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtkaXJlY3RvckNvbnRlbnR9XHJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHsgc2V0RGlyZWN0b3JDb250ZW50KGUudGFyZ2V0LnZhbHVlKTsgY2xlYXJTdGFnZU1lc3NhZ2UoJ1M1Jyk7IH19XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIi4uLi4uLi4uLi4uLi4uLi4uLi4uXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXshaXNBc3NpZ25lZFRvU3RhZ2UoWydESVInLCdTRElSJywnUzUnXSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdjYWxjKDEwMCUgLSAxOHB4KScgOiAnMTAwJScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogJ2F1dG8nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5IZWlnaHQ6ICc3MnB4JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZUhlaWdodDogdWlMaW5lSGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0QWxpZ246ICdsZWZ0JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5SaWdodDogbWFudWFsUmVzaXplRW5hYmxlZCA/ICcxOHB4JyA6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbkJvdHRvbTogbWFudWFsUmVzaXplRW5hYmxlZCA/ICcxMnB4JyA6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICc4cHggMjJweCAxMnB4IDhweCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc2l6ZTogbWFudWFsUmVzaXplRW5hYmxlZCA/ICdib3RoJyA6ICdub25lJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmZsb3c6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnYXV0bycgOiAnaGlkZGVuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9udEZhbWlseTogXCInS2htZXIgT1MgU2llbXJlYXAnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBib3hTaXppbmc6ICdib3JkZXItYm94JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpdGVTcGFjZTogJ3ByZS13cmFwJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcmZsb3dXcmFwOiAnYW55d2hlcmUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JkQnJlYWs6ICdicmVhay13b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dEluZGVudDogJzMwcHgnXHJcbiAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgdGV4dEFsaWduOiAnY2VudGVyJywgbWFyZ2luVG9wOiAwIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAge2hhc0RpcmVjdG9yID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtlZmZlY3RpdmVTaG93RG9BdCgnUzUnKSA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+4Z6S4Z+S4Z6c4Z6+4Z6T4Z+FIHtmb3JtYXRLaG1lckRhdGVUaW1lKGRhdGVGb3JNZXRhS2V5KCdDb3Vyc2U1RGF0ZScpIHx8IGNhcHR1cmVkRGF0ZSl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyhlZmZlY3RpdmVTaG93U2lnbmF0dXJlKCdTNScpICYmIHNpZ0RpcmVjdG9yVXJsKSA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgbWFyZ2luVG9wOiAwIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nIHNyYz17c2lnRGlyZWN0b3JVcmx9IGFsdD1cInNpZy1kaXJlY3RvclwiIHN0eWxlPXt7IG1heFdpZHRoOiA1MCwgbWF4SGVpZ2h0OiA1MCwgb2JqZWN0Rml0OiAnY29udGFpbicsIGRpc3BsYXk6ICdibG9jaycsIG1hcmdpbjogJzAgYXV0bycgfX0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8Lz5cclxuICAgICAgICAgICAgICAgICAgICAgICkgOiBudWxsfVxyXG4gICAgICAgICAgICAgICAgICAgICAgeyhlZmZlY3RpdmVTaG93TmFtZSgnUzUnKSB8fCBzdGFnZUhhc1NlbmRlckZvcktleXMoWydESVInLCdTRElSJywnUzUnXSkpID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNlbmRlci1uYW1lXCIgc3R5bGU9e3sgZm9udEZhbWlseTogXCInS2htZXIgT1MgbXVvbCBsaWdodCcsJ05vdG8gU2FucyBLaG1lcicsJ0tobWVyIE9TJywnSGFudW1hbicsQXJpYWwsJ3NhbnMtc2VyaWYnXCIsIG1hcmdpblRvcDogMCwgZm9udFdlaWdodDogMTAwIH19PntnZXRTdGFnZVNlbmRlck5hbWUoWydESVInLCdTRElSJywnUzUnXSkgfHwgJyd9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywganVzdGlmeUNvbnRlbnQ6ICdmbGV4LXN0YXJ0JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1hcmdpblRvcDogNiwgcGFkZGluZzogJzBweCcgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiBzdGFnZU1lc3NhZ2VGb3IoJ1M1JykgPyAnIzBiNjYyMycgOiAnIzY2NicsIG1pbkhlaWdodDogMCB9fT57c3RhZ2VNZXNzYWdlRm9yKCdTNScpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgIHt2aXNpYmxlU3RhZ2VzICYmIHZpc2libGVTdGFnZXMuaGFzKCdTNicpICYmIChcclxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGJvcmRlcjogJzFweCBkYXNoZWQgIzE2MTYxNmZmJywgcGFkZGluZzogMSwgbWFyZ2luVG9wOiA1IH19PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZ3JpZCcsIGdyaWRUZW1wbGF0ZUNvbHVtbnM6ICc1MGZyJywgZ2FwOiAxMiB9fT5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAxIH19PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sZS1sYWJlbFwiIHN0eWxlPXt7IHRleHRBbGlnbjogJ2NlbnRlcicsIG1hcmdpblRvcDogMCwgZm9udEZhbWlseTogJ0tobWVyIE9TIE11b2wgTGlnaHQnIH19PntnZXRSb2xlTGFiZWwoJ1M2Jyl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgICAgICByb3dzPXs0fVxyXG4gICAgICAgICAgICAgICAgICAgICAgcmVmPXtoZWFkT2ZmaWNlVGV4dGFyZWFSZWZ9XHJcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17aGVhZE9mZmljZUNvbnRlbnR9XHJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHsgc2V0SGVhZE9mZmljZUNvbnRlbnQoZS50YXJnZXQudmFsdWUpOyBjbGVhclN0YWdlTWVzc2FnZSgnUzYnKTsgfX1cclxuICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiLi4uLi4uLi4uLi4uLi4uLi4uLi5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFpc0Fzc2lnbmVkVG9TdGFnZShbJ1M2J10pfVxyXG4gICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnY2FsYygxMDAlIC0gMThweCknIDogJzEwMCUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAnYXV0bycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbkhlaWdodDogJzcycHgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lSGVpZ2h0OiB1aUxpbmVIZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHRBbGlnbjogJ2NlbnRlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbjogMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnMThweCcgOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5Cb3R0b206IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnMTJweCcgOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnOHB4IDIycHggMTJweCA4cHgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNpemU6IG1hbnVhbFJlc2l6ZUVuYWJsZWQgPyAnYm90aCcgOiAnbm9uZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJmbG93OiBtYW51YWxSZXNpemVFbmFibGVkID8gJ2F1dG8nIDogJ2hpZGRlbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvbnRGYW1pbHk6IFwiJ0tobWVyIE9TIFNpZW1yZWFwJywnTm90byBTYW5zIEtobWVyJywnS2htZXIgT1MnLCdIYW51bWFuJyxBcmlhbCwnc2Fucy1zZXJpZidcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaXRlU3BhY2U6ICdwcmUtd3JhcCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJmbG93V3JhcDogJ2FueXdoZXJlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgd29yZEJyZWFrOiAnYnJlYWstd29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHRJbmRlbnQ6ICczMHB4J1xyXG4gICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAvPlxyXG5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHRleHRBbGlnbjogJ2NlbnRlcicsIG1hcmdpblRvcDogMCB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgIHtoYXNIZWFkT2ZmaWNlID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtlZmZlY3RpdmVTaG93RG9BdCgnUzYnKSA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+4Z6S4Z+S4Z6c4Z6+4Z6T4Z+FIHtmb3JtYXRLaG1lckRhdGVUaW1lKGRhdGVGb3JNZXRhS2V5KCdDb3Vyc2U2RGF0ZScpIHx8IGNhcHR1cmVkRGF0ZSl9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyhlZmZlY3RpdmVTaG93U2lnbmF0dXJlKCdTNicpICYmIHNpZ0hlYWRPZmZpY2VVcmwpID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IDUgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPXtzaWdIZWFkT2ZmaWNlVXJsfSBhbHQ9XCJzaWctaGVhZG9mZmljZVwiIHN0eWxlPXt7IG1heFdpZHRoOiAxNjAsIG1heEhlaWdodDogOTAsIG9iamVjdEZpdDogJ2NvbnRhaW4nLCBkaXNwbGF5OiAnYmxvY2snLCBtYXJnaW46ICcwIGF1dG8nIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICB7KGVmZmVjdGl2ZVNob3dOYW1lKCdTNicpIHx8IHN0YWdlSGFzU2VuZGVyRm9yS2V5cyhbJ0hPJywnUzYnLCdTNCcsJ1MzJ10pKSA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZW5kZXItbmFtZVwiIHN0eWxlPXt7IGZvbnRGYW1pbHk6IFwiJ0tobWVyIE9TIG11b2wgbGlnaHQnLCdOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLCdzYW5zLXNlcmlmJ1wiLCBtYXJnaW5Ub3A6IDUsIGZvbnRXZWlnaHQ6IDEwMCB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Z2V0U3RhZ2VTZW5kZXJOYW1lKFsnSE8nLCdTNicsJ1M0JywnUzMnXSkgfHwgJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywganVzdGlmeUNvbnRlbnQ6ICdmbGV4LXN0YXJ0JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1hcmdpblRvcDogMCwgcGFkZGluZzogJzAgcHgnIH19PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiBzdGFnZU1lc3NhZ2VGb3IoJ1M2JykgPyAnIzBiNjYyMycgOiAnIzY2NicsIG1pbkhlaWdodDogMCB9fT57c3RhZ2VNZXNzYWdlRm9yKCdTNicpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICB7LyogUmlnaHQtc2lkZSByZWZlcmVuY2UgcGFuZWwgcGxhY2VkIGFzIGEgc2libGluZyBzbyBoZWlnaHRzIG1hdGNoICovfVxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyZWYtcGFuZWxcIiBzdHlsZT17eyBwb3NpdGlvbjogJ3JlbGF0aXZlJywgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcsIHpJbmRleDogMTAwLCBvdmVyZmxvdzogJ3Zpc2libGUnLCBiYWNrZ3JvdW5kOiAndHJhbnNwYXJlbnQnLCB3aWR0aDogJzIxMG1tJywgbWFyZ2luOiAnNW1tIGF1dG8gMCcsIGFsaWduU2VsZjogJ2NlbnRlcicgfX0+XHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBmbGV4RGlyZWN0aW9uOiAnY29sdW1uJywgaGVpZ2h0OiAnYXV0bycsIGJvcmRlcjogJzFweCBzb2xpZCAjZWJlNWVhZmYnLCBib3JkZXJSYWRpdXM6IDEsIGJhY2tncm91bmQ6ICcjZmZmJyB9fT5cclxuICAgICAgICAgICAgICB7LyogaGVhZGVyIC8gdG9vbGJhciAqL31cclxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6ICcwcHggMTJweCcsIGJvcmRlckJvdHRvbTogJzFweCBzb2xpZCAjZWVmMmY2JywgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiA4LCBiYWNrZ3JvdW5kOiAnI2ZmZmZmZicgfX0+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDEwMCwgZm9udEZhbWlseTogXCInS2htZXIgT1MgTXVvbCBMaWdodCcsJ05vdG8gU2FucyBLaG1lcicsJ0tobWVyIE9TJywnSGFudW1hbicsQXJpYWwsJ3NhbnMtc2VyaWYnXCIsIGZvbnRTaXplOiAxNCB9fT7hnq/hnoDhnp/hnrbhnprhnpnhn4ThnoQ8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBnYXA6IDgsIGFsaWduSXRlbXM6ICdjZW50ZXInIH19PlxyXG4gICAgICAgICAgICAgICAgICB7cmVmVXJscyAmJiByZWZVcmxzLmxlbmd0aCA/IChcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRTaXplOiAxMywgY29sb3I6ICcjMzMzJyB9fT57cmVmVXJsc1swXSAmJiAocmVmVXJsc1swXS5uYW1lIHx8IHJlZlVybHNbMF0udXJsKX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICAgIHtzZWxlY3RlZFJlZiA/IChcclxuICAgICAgICAgICAgICAgICAgICA8YSBocmVmPXtzZWxlY3RlZFJlZn0gdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9yZWZlcnJlclwiIHN0eWxlPXt7IGZvbnRTaXplOiAxNiwgbWFyZ2luTGVmdDogOCB9fT5PcGVuPC9hPlxyXG4gICAgICAgICAgICAgICAgICApIDogbnVsbH1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6IDAsIHBhZGRpbmdUb3A6ICcwbW0nLCBvdmVyZmxvdzogJ3Zpc2libGUnLCBkaXNwbGF5OiAnYmxvY2snIH19PlxyXG4gICAgICAgICAgICAgICAgXHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmbGV4OiAxLCBtaW5IZWlnaHQ6IDgwLCBvdmVyZmxvdzogJ2F1dG8nLCBkaXNwbGF5OiAnZmxleCcsIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJywgYWxpZ25JdGVtczogJ2NlbnRlcicsIHBhZGRpbmc6IDggfX0+XHJcbiAgICAgICAgICAgICAgICAgIHtzZWxlY3RlZFJlZiA/IChcclxuICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXIgcHJldmlldyBmaWxsaW5nIHRoZSByZWYtcGFuZWwgYXJlYSAodXNlIGZ1bGwtaGVpZ2h0IGNvbnRhaW5lcilcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGhlaWdodDogJzEwMCUnLCBkaXNwbGF5OiAnZmxleCcsIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJywgYWxpZ25JdGVtczogJ2NlbnRlcicgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgcmVmPXtyZWZQcmV2aWV3V3JhcHBlcn0gc3R5bGU9e3sgd2lkdGg6ICcyMTBtbScsIG1hcmdpbjogJzAgYXV0bycsIGRpc3BsYXk6ICdmbGV4JywgZmxleERpcmVjdGlvbjogJ2NvbHVtbicsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBvdmVyZmxvdzogJ3Zpc2libGUnLCBiYWNrZ3JvdW5kOiAnI2ZmZicsIGJvcmRlcjogJzFweCBzb2xpZCAjZTVlN2ViJywgYm94U2hhZG93OiAnMCAycHggNnB4IHJnYmEoMCwwLDAsMC4xMiknLCBwYWRkaW5nOiA4IH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsoU3RyaW5nKHNlbGVjdGVkUmVmKS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcucGRmJykpID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUERGLmpzIHJlbmRlcnMgY2FudmFzZXMgaW50byB0aGlzIGNvbnRhaW5lcjsgbGV0IGl0IGV4cGFuZCB0byBzaG93IGFsbCBwYWdlc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nIHNyYz17c2VsZWN0ZWRSZWZ9IGFsdD1cInJlZmVyZW5jZVwiIHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGhlaWdodDogJzEwMCUnLCBvYmplY3RGaXQ6ICdjb250YWluJyB9fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMSwgY29sb3I6ICcjNjY2JywgZm9udEZhbWlseTogXCInS2htZXIgT1MgTXVvbCBMaWdodCcsJ05vdG8gU2FucyBLaG1lcicsJ0tobWVyIE9TJywnSGFudW1hbicsQXJpYWwsJ3NhbnMtc2VyaWYnXCIgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IG1hcmdpbkJvdHRvbTogOCB9fT7hnpjhnrfhnpPhnpjhnrbhnpPhnq/hnoDhnp/hnrbhnprhnpnhn4ThnoRcclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250U2l6ZTogMTIsIGNvbG9yOiAnIzk5OScgfX0+IChkZWJ1ZyBoaW50cyBzaG93biBiZWxvdyk8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250U2l6ZTogMTMsIGNvbG9yOiAnIzQ0NCcgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiA2IH19PuGegOGfhuGejuGej+Gfi+Gej+GfkuGemuGetiBleHBvc2VkIHRvIGNvbnNvbGUgYXMgPGNvZGU+d2luZG93Ll9fUkVQTEFZX1JFQ09SRDwvY29kZT48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA2MDAsIG1hcmdpbkJvdHRvbTogNiB9fT5BdHRhY2htZW50IGhpbnRzOjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoaW50cyA9IGdldEF0dGFjaG1lbnRIaW50cyhyZWNvcmQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaGludHMgfHwgaGludHMubGVuZ3RoID09PSAwKSByZXR1cm4gKDxkaXYgc3R5bGU9e3sgY29sb3I6ICcjOTk5JyB9fT5ObyBvYnZpb3VzIGF0dGFjaG1lbnQtbGlrZSBmaWVsZHMgZm91bmQgaW4gcmVjb3JkIChjaGVjayBjb25zb2xlKS48L2Rpdj4pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IG1heEhlaWdodDogMjIwLCBvdmVyZmxvdzogJ2F1dG8nLCBib3JkZXI6ICcxcHggZGFzaGVkICNlZWUnLCBwYWRkaW5nOiA4LCBiYWNrZ3JvdW5kOiAnI2ZhZmFmYScgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtoaW50cy5tYXAoKGgsIGkpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17aX0gc3R5bGU9e3sgbWFyZ2luQm90dG9tOiA4IH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250U2l6ZTogMTIsIGNvbG9yOiAnIzMzMycsIGZvbnRXZWlnaHQ6IDYwMCB9fT57aC5wYXRofTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250U2l6ZTogMTIsIGNvbG9yOiAnIzU1NScsIHdvcmRCcmVhazogJ2JyZWFrLWFsbCcgfX0+e2guZXhjZXJwdH08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSgpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcbiAgICAgICl9XHJcbiAgICAgIHsvKiBGbG9hdGluZyBzZW5kLXRvLVRlbGVncmFtIGJ1dHRvbiAodmlzaWJsZSB3aGVuIHRoZXJlJ3MgYSBzYXZlZCBwcmltYXJ5IG5vdGUpICovfVxyXG4gICAgICB7cmVjb3JkICYmICgobWV0YSAmJiBtZXRhLkNvdXJzZU5vdGUpIHx8IChsZWZ0Q29udGVudCAmJiBsZWZ0Q29udGVudC50cmltKCkgIT09ICcnKSkgJiYgcGVybXMgJiYgcGVybXMuY2FuU2VuZFRlbGVncmFtICYmIChcclxuICAgICAgICA8ZGl2IHN0eWxlPXt7IHBvc2l0aW9uOiAnZml4ZWQnLCByaWdodDogMTgsIGJvdHRvbTogMTgsIHpJbmRleDogOTk5OSB9fT5cclxuICAgICAgICAgIDxidXR0b24gb25DbGljaz17c2VuZFRvVGVsZWdyYW19IGRpc2FibGVkPXtzYXZpbmd9IHN0eWxlPXt7IGJhY2tncm91bmQ6ICcjMDA4OGNjJywgY29sb3I6ICcjZmZmJywgcGFkZGluZzogJzEwcHggMTRweCcsIGJvcmRlclJhZGl1czogOCwgYm9yZGVyOiAnbm9uZScsIGJveFNoYWRvdzogJzAgNnB4IDE4cHggcmdiYSgwLDAsMCwwLjEyKScsIGN1cnNvcjogc2F2aW5nID8gJ2RlZmF1bHQnIDogJ3BvaW50ZXInIH19PlxyXG4gICAgICAgICAgICB7c2F2aW5nID8gJ+GegOGfhuGeluGeu+GehOGelOGeieGfkuGeh+GevOGeky4uLicgOiAn4Z6V4Z+S4Z6J4Z6+4Z6Y4Z6P4Z63J31cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICApfVxyXG4gICAgICB7LyogR2xvYmFsIFRlbGVncmFtIGZlZWRiYWNrIGJsb2NrOiBzaG93IHJlZ2FyZGxlc3Mgb2Ygc3RhZ2Ugbm90ZXMgKi99XHJcbiAgICAgIHtyZWNvcmQgJiYgbWV0YSAmJiBBcnJheS5pc0FycmF5KG1ldGEudGVsZWdyYW1GZWVkYmFjaykgJiYgbWV0YS50ZWxlZ3JhbUZlZWRiYWNrLmxlbmd0aCA+IDAgJiYgKFxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgcG9zaXRpb246ICdyZWxhdGl2ZScsIHdpZHRoOiAnbWluKDIxMG1tLCAxMDAlKScsIG1hcmdpbjogJzEycHggYXV0bycsIG1heFdpZHRoOiA5MDAgfX0+XHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGJvcmRlcjogJzFweCBzb2xpZCAjMDA4OGNjJywgYmFja2dyb3VuZDogJyNmNGZhZmYnLCBib3JkZXJSYWRpdXM6IDYsIHBhZGRpbmc6ICcxMnB4IDE4cHgnLCBib3hTaGFkb3c6ICcwIDJweCA4cHggcmdiYSgwLDEzNiwyMDQsMC4wNyknLCBmb250RmFtaWx5OiBcIidOb3RvIFNhbnMgS2htZXInLCdLaG1lciBPUycsJ0hhbnVtYW4nLEFyaWFsLHNhbnMtc2VyaWZcIiB9fT5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAsIGNvbG9yOiAnIzAwODhjYycsIGZvbnRTaXplOiAxNiwgbWFyZ2luQm90dG9tOiA4IH19PuGemOGej+Gety/hnoDhnrbhnprhnobhn5Lhnpvhnr7hnpnhno/hnpThno/hnrbhnpggVGVsZWdyYW08L2Rpdj5cclxuICAgICAgICAgICAgPHVsIHN0eWxlPXt7IGxpc3RTdHlsZTogJ25vbmUnLCBwYWRkaW5nOiAwLCBtYXJnaW46IDAgfX0+XHJcbiAgICAgICAgICAgICAge21ldGEudGVsZWdyYW1GZWVkYmFjay5tYXAoKGZiLCBpZHgpID0+IChcclxuICAgICAgICAgICAgICAgIDxsaSBrZXk9e2lkeH0gc3R5bGU9e3sgbWFyZ2luQm90dG9tOiAxMiwgcGFkZGluZzogJzhweCAxMnB4JywgYmFja2dyb3VuZDogJyNmZmYnLCBib3JkZXJSYWRpdXM6IDQsIGJvcmRlckxlZnQ6ICc0cHggc29saWQgIzAwODhjYycsIGJveFNoYWRvdzogJzAgMXB4IDNweCByZ2JhKDAsMCwwLDAuMDQpJyB9fT5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA2MDAsIGNvbG9yOiAnIzAwNTU3NycsIG1hcmdpbkJvdHRvbTogMiB9fT5cclxuICAgICAgICAgICAgICAgICAgICB7ZmIudXNlck5hbWUgfHwgZmIuZnJvbSB8fCAn4Z6i4Z+S4Z6T4Z6A4Z6U4Z+S4Z6a4Z6+4Z6U4Z+S4Z6a4Z624Z6f4Z+LJ31cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBmb250V2VpZ2h0OiA0MDAsIGNvbG9yOiAnIzg4OCcsIGZvbnRTaXplOiAxMiwgbWFyZ2luTGVmdDogOCB9fT57KGZiLnRpbWVzdGFtcCB8fCBmYi5kYXRlKSA/IChuZXcgRGF0ZShmYi50aW1lc3RhbXAgfHwgZmIuZGF0ZSkudG9Mb2NhbGVTdHJpbmcoJ2ttLUtIJywgeyB5ZWFyOiAnbnVtZXJpYycsIG1vbnRoOiAnc2hvcnQnLCBkYXk6ICdudW1lcmljJywgaG91cjogJzItZGlnaXQnLCBtaW51dGU6ICcyLWRpZ2l0JyB9KSkgOiAnJ308L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiAnIzIyMicsIGZvbnRTaXplOiAxNSwgd2hpdGVTcGFjZTogJ3ByZS13cmFwJywgd29yZEJyZWFrOiAnYnJlYWstd29yZCcgfX0+e2ZiLm1lc3NhZ2UgfHwgZmIudGV4dCB8fCAnJ308L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvbGk+XHJcbiAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgIDwvdWw+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgKX1cclxuICAgICAgey8qIENvbmZpcm1hdGlvbiBtb2RhbCBmb3Igc3RhZ2Ugc2VuZCAqL31cclxuICAgICAge2NvbmZpcm1WaXNpYmxlICYmIChcclxuICAgICAgICA8ZGl2IHN0eWxlPXt7IHBvc2l0aW9uOiAnZml4ZWQnLCBpbnNldDogMCwgYmFja2dyb3VuZDogJ3JnYmEoMCwwLDAsMC40NSknLCB6SW5kZXg6IDEwMDAwLCBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicgfX0+XHJcbiAgICAgICAgICA8ZGl2IHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIHN0eWxlPXt7IHdpZHRoOiA0MjAsIG1heFdpZHRoOiAnOTQlJywgYmFja2dyb3VuZDogJyNmZmYnLCBib3JkZXJSYWRpdXM6IDgsIHBhZGRpbmc6IDE4LCBib3hTaGFkb3c6ICcwIDhweCAzMHB4IHJnYmEoMCwwLDAsMC40KScgfX0+XHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFNpemU6IDE2LCBmb250V2VpZ2h0OiA2MDAsIG1hcmdpbkJvdHRvbTogOCB9fT7hnpXhn5Lhnonhnr7hnpjhno/hnrfhnpHhn4UgVGVsZWdyYW08L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Cb3R0b206IDEyIH19PuGej+GevuGeouGfkuGek+GegOGeheGehOGfi+GeleGfkuGeieGevuGemOGej+Get+Gek+GfgeGfh+GekeGfhSBUZWxlZ3JhbSDhnpHhn4E/IOGeh+GfkuGemuGevuGen+GemOGeveGemeGfljwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IG1hcmdpbkJvdHRvbTogMTIgfX0+XHJcbiAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGdhcDogOCB9fT5cclxuICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjaGVja2VkPXtjb25maXJtQWR2YW5jZX0gb25DaGFuZ2U9eyhlKSA9PiBzZXRDb25maXJtQWR2YW5jZShlLnRhcmdldC5jaGVja2VkKX0gLz5cclxuICAgICAgICAgICAgICAgIDxzcGFuPuGeleGfkuGeieGeviDhnpPhnrfhnoThnpThnr7hnoDhnpzhnoLhn5LhnoLhnpThnpPhn5LhnpHhnrbhnpThn4sgKEFkdmFuY2UgdG8gbmV4dCBzdGFnZSk8L3NwYW4+XHJcbiAgICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogJ2ZsZXgtZW5kJywgZ2FwOiA4IH19PlxyXG4gICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4gc2V0Q29uZmlybVZpc2libGUoZmFsc2UpfSBzdHlsZT17eyBwYWRkaW5nOiAnNnB4IDEwcHgnIH19PuGelOGfhOGfh+GelOGehOGfizwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4gZG9TZW5kU3RhZ2UoY29uZmlybVN0YWdlS2V5LCBmYWxzZSl9IHN0eWxlPXt7IHBhZGRpbmc6ICc2cHggMTBweCcgfX0+4Z6V4Z+S4Z6J4Z6+4Z6P4Z+C4Z6T4Z+B4Z+HPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiBkb1NlbmRTdGFnZShjb25maXJtU3RhZ2VLZXksIGNvbmZpcm1BZHZhbmNlKX0gc3R5bGU9e3sgcGFkZGluZzogJzZweCAxMHB4JywgYmFja2dyb3VuZDogJyMwMDg4Y2MnLCBjb2xvcjogJyNmZmYnLCBib3JkZXI6ICdub25lJywgYm9yZGVyUmFkaXVzOiA2IH19PntzZW5kaW5nU3RhZ2UgPT09IGNvbmZpcm1TdGFnZUtleSA/ICfhnoDhn4bhnpbhnrvhnoQuLi4nIDogJ+GeleGfkuGeieGeviDhnpPhnrfhnoThnpThnr7hnoDhnpzhnoLhn5LhnoLhnpThnpPhn5LhnpHhnrbhnpThn4snfTwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICApfVxyXG4gICAgPC9kaXY+XHJcbiAgKTtcclxufVxyXG5cclxuXHJcbi8vIGRlYnVnIGhlbHBlcnMgKGVuYWJsZSB3aXRoOiB3aW5kb3cuX19SRVBMQVlfREVCVUdfXyA9IHRydWUpXHJcbmlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuX19SRVBMQVlfREVCVUdfXykge1xyXG4gIHRyeSB7XHJcbiAgICAvLyBzaG93IHJlY29yZCBtZXRhIChpZiByZXBsYXkgY29kZSBleHBvcnRzIGl0KVxyXG4gICAgLy8gZ3VhcmQgYWNjZXNzIGluIGNhc2UgX19SRVBMQVlfUkVDT1JEIGlzIG5vdCB5ZXQgc2V0XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBtZXRhID0gd2luZG93Ll9fUkVQTEFZX1JFQ09SRCAmJiB3aW5kb3cuX19SRVBMQVlfUkVDT1JELm1ldGE7XHJcbiAgICAgIGlmIChtZXRhKSBjb25zb2xlLmxvZygnUkVQTEFZIHJlY29yZCBtZXRhOicsIG1ldGEpO1xyXG4gICAgfSBjYXRjaCAoZSkge31cclxuICAgIC8vIGxpc3QgZGFzaGVkIGJveGVzIGFuZCBmaXJzdCAyMDAgY2hhcnMgb2YgdGhlaXIgdGV4dCAoYmVzdC1lZmZvcnQpXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBlbHMgPSBkb2N1bWVudCA/IFsuLi5kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbc3R5bGUqPVwiZGFzaGVkXCJdJyldIDogW107XHJcbiAgICAgIGVscy5tYXAoKGVsLCBpKSA9PiAoeyBpZHg6IGksIHRleHQ6IChlbC5pbm5lclRleHQgfHwgJycpLnRyaW0oKS5zbGljZSgwLCAyMDApLCBodG1sOiAoZWwuaW5uZXJIVE1MIHx8ICcnKS5zbGljZSgwLCAyMDApIH0pKS5mb3JFYWNoKHggPT4gY29uc29sZS5sb2coeCkpO1xyXG4gICAgfSBjYXRjaCAoZSkgeyAvKiBpZ25vcmUgRE9NIGluc3BlY3Rpb24gZXJyb3JzICovIH1cclxuICB9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSAqLyB9XHJcbn1cclxuIl0sImZpbGUiOiJEOi9EQi93ZWJfMjAyNl9WMy9zcmMvcGFnZXMvUmVwbGF5ZmlsZTJQYWdlLmpzeCJ9