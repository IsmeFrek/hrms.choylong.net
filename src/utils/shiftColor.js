export function findShiftColor(shift, { pickedShiftsByCategory = {}, shifts = [], shiftTemplates = [] } = {}) {
  try {
    if (!shift) return null;
    if (shift.color) return shift.color;
    const id = String(shift.id || shift._id || '').trim();
    const title = String(shift.title || shift.name || '').trim();
    const start = String(shift.start || '').trim();
    const end = String(shift.end || '').trim();

    // search per-category picked shifts first
    const map = pickedShiftsByCategory || {};
    for (const k of Object.keys(map)) {
      const list = map[k] || [];
      const found = list.find(s => {
        const t = (s && (s.title || '')).toString().trim();
        const st = (s && (s.start || '')).toString().trim();
        const en = (s && (s.end || '')).toString().trim();
        if (id && (s.id === id || s._id === id)) return true;
        if (t && title && t === title) return true;
        if (st && en && start && end && st === start && en === end) return true;
        return false;
      });
      if (found && found.color) return found.color;
    }

    // then search global shifts and templates
    const globalSources = [].concat(Array.isArray(shifts) ? shifts : [], Array.isArray(shiftTemplates) ? shiftTemplates : []);
    for (const s of globalSources) {
      if (!s) continue;
      const t = (s && (s.title || s.name || '')).toString().trim();
      const st = (s && (s.start || '')).toString().trim();
      const en = (s && (s.end || '')).toString().trim();
      if (id && (String(s.id || s._id || '') === String(id)) && s.color) return s.color;
      if (t && title && t === title && s.color) return s.color;
      if (st && en && start && end && st === start && en === end && s.color) return s.color;
    }

    // If no explicit color is found, compute a deterministic color based on time range
    // and then apply a small deterministic variation per-shift so multiple shifts don't all show the exact same hex.
    function parseTimeColor(st, en) {
      try {
        const parse = (t) => {
          if (!t) return null;
          const parts = t.split(':');
          if (parts.length < 1) return null;
          const h = parseInt(parts[0], 10) || 0;
          const m = parseInt(parts[1] || '0', 10) || 0;
          return h + m / 60;
        };
        const sVal = parse(st || '');
        const eVal = parse(en || '');
        const mid = (sVal !== null && eVal !== null) ? ((sVal + eVal) / 2) : (sVal || eVal || 9);
        if (mid >= 5 && mid < 11) return '#16a34a'; // morning: green
        if (mid >= 11 && mid < 17) return '#de0b7f'; // day: magenta-ish (matches app logic)
        if (mid >= 17 && mid < 22) return '#f97316'; // evening: orange
        return '#7c3aed'; // night: purple
      } catch (e) {
        return '#223366';
      }
    }

    // Simple string hash to produce a deterministic number per-shift
    function hashString(str) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    }

    // Mix color with black/white to produce slight shade variations.
    function shadeHex(hex, percent) {
      // percent: -0.3 .. +0.3 (negative -> darker, positive -> lighter)
      const clean = (hex || '#000000').replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      const mix = (c) => {
        if (percent >= 0) {
          return Math.round(c + (255 - c) * percent);
        }
        return Math.round(c * (1 + percent));
      };
      const nr = Math.min(255, Math.max(0, mix(r)));
      const ng = Math.min(255, Math.max(0, mix(g)));
      const nb = Math.min(255, Math.max(0, mix(b)));
      const toHex = (v) => v.toString(16).padStart(2, '0');
      return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
    }

    const base = parseTimeColor(start, end) || '#223366';
    const seed = `${id}|${title}|${start}|${end}`;
    const h = hashString(seed);
    // Map hash to a small percent shift between -0.18 and +0.18
    const sign = (h % 2 === 0) ? 1 : -1;
    const magnitude = (h % 19) / 100.0; // 0 .. 0.18
    const percent = sign * magnitude;
    return shadeHex(base, percent);
  } catch (e) {
    return null;
  }
}
