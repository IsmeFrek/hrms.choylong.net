import React from 'react';

// Reusable date input with dd/mm/yyyy display and native calendar picker
// Props:
// - value: string (ISO yyyy-mm-dd, dd/mm/yyyy, or '')
// - onChange: (displayDate: string) => void  // always dd/mm/yyyy or ''
// - className: optional styling
// - placeholder: optional, defaults to 'dd/mm/yyyy'
// - shortYear: if true, shows dd/mm/yy while keeping value normalization to dd/mm/yyyy
export default function DateInput({ value, onChange, className = '', placeholder, disabled = false, min, max, disableWeekends = false, shortYear = false }) {
  const hiddenRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const desiredCaret = React.useRef(null);
  const [error, setError] = React.useState('');

  const displayFull = toDisplay(value); // always dd/mm/yyyy or ''
  const displayShown = shortYear ? toShort(displayFull) : displayFull;
  // Khmer placeholder default
  const ph = placeholder || (shortYear ? 'dd/mm/yy' : 'បញ្ចូលថ្ងៃខែឆ្នាំ (dd/mm/yyyy)');

  // Local shown value to avoid caret jumping when parent updates
  const [localShown, setLocalShown] = React.useState(displayShown);

  // Sync localShown when parent value changes (but don't stomp while typing)
  React.useEffect(() => {
    if (displayShown !== localShown) setLocalShown(displayShown);
  }, [displayShown]);

  function handleTextChange(e) {
    const el = e.target;
    const v = el.value;
    const selStart = el.selectionStart || 0;
    // Allow digits and '/'
    const cleaned = v.replace(/[^0-9/]/g, '');
    // Auto-insert slashes: 2 -> dd/, 5 -> dd/mm/
    let next = cleaned;
    // If user types three digits in a row, insert slash after 2
    if (/^\d{3}$/.test(cleaned)) next = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    if (/^\d{5}$/.test(cleaned)) next = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4);
    // Limit length for shortYear
    if (shortYear && next.length > 8) next = next.slice(0, 8);
    // Compute caret adjustment when slash inserted
    let newCaret = selStart;
    if (v.length > localShown.length) {
      // typing forward
      if (selStart === 3 && next[2] === '/') newCaret = selStart + 1;
      if (selStart === 6 && next[5] === '/') newCaret = selStart + 1;
    }
    setError('');
    setLocalShown(next);
    desiredCaret.current = newCaret;
    onChange?.(next);
  }

  function handleBlur(e) {
    const inputVal = e.target.value;
    const fixed = normalizeDisplay(inputVal);
    // Validate min/max and weekends if applicable
    if (fixed) {
      const iso = toISO(fixed);
      if (disableWeekends && isWeekendISO(iso)) {
        setError('⚠️ ថ្ងៃចុងសប្តាហ៍មិនអនុញ្ញាត');
        onChange?.('');
        return;
      }
      if (!withinRange(iso, min, max)) {
        setError('⚠️ កាលបរិច្ឆេទនេះមិនអាចប្រើបាន');
        onChange?.('');
        return;
      }
      setError('');
      onChange?.(fixed);
    } else if (inputVal) {
      setError('⚠️ សូមបញ្ចូលថ្ងៃខែឆ្នាំត្រឹមត្រូវ (dd/mm/yyyy)');
      onChange?.('');
    } else {
      setError('');
      onChange?.('');
    }
  }

  function openCalendar() {
    hiddenRef.current?.showPicker?.();
    if (!hiddenRef.current?.showPicker) hiddenRef.current?.click();
  }

  function handleHiddenChange(e) {
    const iso = e.target.value; // yyyy-mm-dd
    const dmy = toDisplay(iso);
    onChange?.(dmy);
  }

  // Set caret after render if desired
  React.useLayoutEffect(() => {
    const pos = desiredCaret.current;
    if (pos != null && inputRef.current) {
      try { inputRef.current.setSelectionRange(pos, pos); } catch (e) {}
      desiredCaret.current = null;
    }
  }, [localShown]);

  return (
    <div className="relative group">
      <input
        ref={inputRef}
        type="text"
  value={localShown}
        onChange={handleTextChange}
        onBlur={handleBlur}
  placeholder={ph}
        disabled={disabled}
        className={`${(className && className.trim().length ? className : 'border px-3 py-2 rounded w-full')} pr-12 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 placeholder-gray-400 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${error ? 'ring-2 ring-red-400 border-red-400 focus:ring-red-400' : ''}`}
        inputMode="numeric"
        aria-label="Date in dd/mm/yyyy"
        onKeyDown={(e) => {
          if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) {
            e.preventDefault();
            openCalendar();
          }
        }}
        aria-invalid={!!error}
      />
      <div className={`absolute inset-y-0 right-0 px-3 flex items-center text-purple-600 hover:text-purple-700 rounded-r-md ${disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
        {/* calendar icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        {!disabled && (
          <input
            ref={hiddenRef}
            type="date"
            value={toISO(displayFull)}
            onChange={handleHiddenChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            tabIndex={-1}
            aria-hidden="true"
            min={toISOAny(min)}
            max={toISOAny(max)}
          />
        )}
      </div>
      {error && (
        <div className="text-red-600 text-xs mt-1 flex items-center">
          <span className="mr-1">⚠️</span>{error.replace(/^⚠️ /, '')}
        </div>
      )}
    </div>
  );
}

// Convert any accepted input to dd/mm/yyyy
function toDisplay(val) {
  if (!val) return '';
  if (typeof val !== 'string') val = String(val);
  // Already dd/mm/yyyy
  const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dd}/${mm}/${dmy[3]}`;
  }
  // ISO yyyy-mm-dd or yyyy-mm-ddTHH
  const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return '';
}

// Normalize user-typed display to dd/mm/yyyy or '' if invalid
function normalizeDisplay(v) {
  if (!v) return '';
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return '';
  let [_, d, mth, y] = m;
  if (y.length === 2) y = (y >= '70' ? '19' : '20') + y; // naive 2-digit year
  const dd = d.padStart(2, '0');
  const mm = mth.padStart(2, '0');
  const dt = new Date(Number(y), Number(mm) - 1, Number(dd));
  if (dt && dt.getFullYear() === Number(y) && dt.getMonth() === Number(mm) - 1 && dt.getDate() === Number(dd)) {
    return `${dd}/${mm}/${y}`;
  }
  return '';
}

// Convert dd/mm/yyyy to ISO yyyy-mm-dd
function toISO(display) {
  if (!display) return '';
  const m = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Helpers
function toISOAny(val) {
  if (!val) return '';
  if (typeof val !== 'string') val = String(val);
  if (/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.test(val)) return toISO(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return '';
}

function isWeekendISO(iso) {
  if (!iso) return false;
  const dt = new Date(iso);
  const d = dt.getDay();
  return d === 0 || d === 6;
}

function withinRange(iso, min, max) {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  const minIso = toISOAny(min);
  const maxIso = toISOAny(max);
  if (minIso && t < new Date(minIso).getTime()) return false;
  if (maxIso && t > new Date(maxIso).getTime()) return false;
  return true;
}

// Convert dd/mm/yyyy to dd/mm/yy for display only
function toShort(full) {
  if (!full) return '';
  const m = full.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return full;
  return `${m[1]}/${m[2]}/${m[3].slice(-2)}`;
}
