import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';

function toISODate(d) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function asNumber(val, fallback = 0) {
  if (val === '' || val === null || typeof val === 'undefined') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function bestDailyEntry(row) {
  const list = Array.isArray(row?.dailyData) ? row.dailyData : [];
  if (list.length === 0) return null;
  // Backend pushes imported entries after raw entries, so the last entry is usually the imported (editable) one.
  return list[list.length - 1];
}

function parseMinutes(s) {
  if (!s) return null;
  const str = String(s).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
  return null;
}

function computeAutoCounts(draft, schedule, graceMinutes) {
  const status = String(draft?.status || '').trim();
  const hasIn = !!String(draft?.checkIn || '').trim();
  const hasOut = !!String(draft?.checkOut || '').trim();

  // Follow backend rule when status is not set.
  const effectiveStatus = status || ((hasIn || hasOut) ? 'present' : 'absent');

  const grace = Number.isFinite(Number(graceMinutes)) ? Number(graceMinutes) : 15;

  const shiftTitle = String(schedule?.shiftTitle || '').toLowerCase();
  const isDayOff = shiftTitle.includes('off');

  const shiftStartMin = parseMinutes(schedule?.shiftStart);
  const shiftEndMin = parseMinutes(schedule?.shiftEnd);
  const checkInMin = parseMinutes(draft?.checkIn);
  const checkOutMin = parseMinutes(draft?.checkOut);

  const lateByTime = !isDayOff && shiftStartMin !== null && checkInMin !== null && checkInMin > (shiftStartMin + grace);
  const earlyByTime = !isDayOff && shiftEndMin !== null && checkOutMin !== null && checkOutMin < shiftEndMin;

  const forgotCount = (effectiveStatus === 'forgot' || (hasIn && !hasOut)) ? 1 : 0;
  const checkinLateCount = (effectiveStatus === 'late' || lateByTime) ? 1 : 0;
  const checkoutEarlyCount = (effectiveStatus === 'early' || earlyByTime) ? 1 : 0;
  const absentCount = effectiveStatus === 'absent' ? 1 : 0;
  const leaveCount = effectiveStatus === 'leave' ? 1 : 0;

  return { effectiveStatus, forgotCount, checkinLateCount, checkoutEarlyCount, absentCount, leaveCount };
}

export default function AttendanceDayDataPage() {
  const { canViewAttendanceMonthlyData } = usePermission();
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [scheduleByStaffId, setScheduleByStaffId] = useState({});

  const [rows, setRows] = useState([]);
  const [editMap, setEditMap] = useState({});
  const [dirtySet, setDirtySet] = useState(() => new Set());
  const dirtyRef = useRef(dirtySet);
  useEffect(() => {
    dirtyRef.current = dirtySet;
  }, [dirtySet]);

  const [query, setQuery] = useState('');

  // HR lookup (optional) to enrich names and allow staffId suggestions
  const [hrList, setHrList] = useState([]);
  const [hrLookup, setHrLookup] = useState({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get('/hr');
        if (!mounted) return;
        const items = Array.isArray(data) ? data : [];
        const lookup = {};
        items.forEach((r) => {
          if (r?.staffId) lookup[String(r.staffId)] = r;
          if (r?.cardNumber) lookup[String(r.cardNumber)] = r;
          if (r?.cardNo) lookup[String(r.cardNo)] = r;
          if (r?.no) lookup[String(r.no)] = r;
          if (r?._id) lookup[String(r._id)] = r;
        });
        setHrList(items);
        setHrLookup(lookup);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // After HR lookup loads, fill missing names without marking dirty.
  useEffect(() => {
    const lookup = hrLookup;
    if (!lookup || Object.keys(lookup).length === 0) return;
    setEditMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const sid of Object.keys(next)) {
        const r = next[sid];
        if (!r) continue;
        if (r.name) continue;
        const hr = lookup[String(sid)];
        const name = hr?.khmerName || hr?.fullName || hr?.name || '';
        if (name) {
          next[sid] = { ...r, name };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [hrLookup]);

  const buildRowDraft = (r) => {
    const sid = String(r?.staffId || '').trim();
    const hr = hrLookup[sid];
    const entry = bestDailyEntry(r);

    const resolvedName =
      r?.name ||
      hr?.khmerName ||
      hr?.fullName ||
      hr?.name ||
      '';

    const draft = {
      staffId: sid,
      name: resolvedName,
      date,
      checkIn: entry?.checkIn || '',
      checkOut: entry?.checkOut || '',
      status: entry?.status || r?.status || '',
      dayWorkCount: asNumber(r?.dayWorkCount, 0),
      attendanceCount: asNumber(r?.attendanceCount, 0),
      workTime: r?.workTime ?? '',
    };

    const auto = computeAutoCounts(draft);

    return {
      ...draft,
      forgotCount: auto.forgotCount,
      checkinLateCount: auto.checkinLateCount,
      checkoutEarlyCount: auto.checkoutEarlyCount,
      absentCount: auto.absentCount,
      leaveCount: auto.leaveCount,
    };
  };

  const load = async () => {
    if (!date) return;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await api.get('/attendance/day-data', { params: { date } });
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(list);

      const nextMap = {};
      list.forEach((r) => {
        const sid = String(r?.staffId || '').trim();
        if (!sid) return;
        nextMap[sid] = buildRowDraft(r);
      });
      setEditMap(nextMap);
      setDirtySet(new Set());
    } catch (e) {
      setRows([]);
      setEditMap({});
      setDirtySet(new Set());
      setError(e?.response?.data?.message || e.message || 'Failed to load day data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!date) return;
    // auto load when date changes
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Load work-schedules for the selected date so we can compute late/early based on scheduled times.
  useEffect(() => {
    let mounted = true;
    if (!date) return;
    (async () => {
      try {
        const res = await api.get('/work-schedules', { params: { startDate: date, endDate: date } });
        const list = Array.isArray(res.data) ? res.data : [];
        const map = {};
        list.forEach((s) => {
          const staffId = s?.employeeId?.staffId;
          if (!staffId) return;
          map[String(staffId)] = {
            shiftTitle: s.shiftTitle || '',
            shiftStart: s.shiftStart || '',
            shiftEnd: s.shiftEnd || '',
          };
        });
        if (!mounted) return;
        setScheduleByStaffId(map);
      } catch {
        if (!mounted) return;
        setScheduleByStaffId({});
      }
    })();
    return () => {
      mounted = false;
    };
  }, [date]);

  const filteredStaffIds = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    const ids = Object.keys(editMap);
    if (!q) return ids.sort();
    return ids
      .filter((sid) => {
        const r = editMap[sid];
        const name = String(r?.name || '').toLowerCase();
        return sid.toLowerCase().includes(q) || name.includes(q);
      })
      .sort();
  }, [editMap, query]);

  const markDirty = (sid) => {
    setDirtySet((prev) => {
      const next = new Set(prev);
      next.add(sid);
      return next;
    });
  };

  const setField = (sid, key, value) => {
    setEditMap((prev) => {
      const next = { ...prev };
      const current = next[sid] || { staffId: sid, date };
      next[sid] = { ...current, [key]: value };
      return next;
    });
    markDirty(sid);
  };

  const addRow = (staffIdRaw) => {
    const sid = String(staffIdRaw || '').trim();
    if (!sid) return;
    setEditMap((prev) => {
      if (prev[sid]) return prev;
      const hr = hrLookup[sid];
      const name = hr?.khmerName || hr?.fullName || hr?.name || '';
      return {
        ...prev,
        [sid]: {
          staffId: sid,
          name,
          date,
          checkIn: '',
          checkOut: '',
          status: '',
          forgotCount: 0,
          checkinLateCount: 0,
          checkoutEarlyCount: 0,
          dayWorkCount: 0,
          attendanceCount: 0,
          workTime: '',
          absentCount: 0,
          leaveCount: 0,
        },
      };
    });
    setDirtySet((prev) => {
      const next = new Set(prev);
      next.add(sid);
      return next;
    });
  };

  const removeRow = (sid) => {
    setEditMap((prev) => {
      const next = { ...prev };
      delete next[sid];
      return next;
    });
    setDirtySet((prev) => {
      const next = new Set(prev);
      next.delete(sid);
      return next;
    });
  };

  const buildPayload = (draft) => {
    const schedule = scheduleByStaffId[String(draft?.staffId || '')];
    const auto = computeAutoCounts(draft, schedule, graceMinutes);
    return {
      staffId: draft.staffId,
      name: draft.name || '',
      date,
      checkIn: draft.checkIn || '',
      checkOut: draft.checkOut || '',
      status: draft.status || '',
      graceMinutes: Number.isFinite(Number(graceMinutes)) ? Number(graceMinutes) : 15,
      forgotCount: auto.forgotCount,
      checkinLateCount: auto.checkinLateCount,
      checkoutEarlyCount: auto.checkoutEarlyCount,
      dayWorkCount: asNumber(draft.dayWorkCount, 0),
      attendanceCount: asNumber(draft.attendanceCount, 0),
      workTime: draft.workTime === '' ? 0 : asNumber(draft.workTime, 0),
      absentCount: auto.absentCount,
      leaveCount: auto.leaveCount,
    };
  };

  const saveOne = async (sid) => {
    const draft = editMap[sid];
    if (!draft?.staffId) return;
    setSaving(true);
    setError('');
    setInfo('');
    try {
      await api.post('/attendance/day-data', buildPayload(draft));
      setInfo(`Saved: ${sid}`);
      setDirtySet((prev) => {
        const next = new Set(prev);
        next.delete(sid);
        return next;
      });
      // refresh data so table reflects merged raw+imported
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    const ids = Array.from(dirtyRef.current);
    if (ids.length === 0) {
      setInfo('No changes to save');
      return;
    }
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const payload = ids
        .map((sid) => editMap[sid])
        .filter(Boolean)
        .map(buildPayload);

      const res = await api.post('/attendance/day-data', payload);
      setInfo(`Saved ${res?.data?.upserted ?? payload.length} row(s)`);
      setDirtySet(new Set());
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Save all failed');
    } finally {
      setSaving(false);
    }
  };

  // Quick add form
  const [newStaffId, setNewStaffId] = useState('');
  const addInputRef = useRef(null);
  const onAddSubmit = (e) => {
    e.preventDefault();
    addRow(newStaffId);
    setNewStaffId('');
    try {
      addInputRef.current?.focus();
    } catch {
      // ignore
    }
  };

  if (!canViewAttendanceMonthlyData) {
    return <div className="p-4">មិនមានការអនុញ្ញាត</div>;
  }

  return (
    <div className="p-4" style={{ fontFamily: 'Khmer OS, Arial' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">ទិន្នន័យវត្តមានប្រចាំថ្ងៃ (Attendance Day Data)</h1>
          <div className="text-sm text-gray-600">បញ្ចូល/កែសម្រួលទិន្នន័យសង្ខេបប្រចាំថ្ងៃ (upsert) តាមបុគ្គលិក</div>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600">Date</label>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 border"
            onClick={load}
            disabled={loading || !date}
          >
            {loading ? 'Loading...' : 'Reload'}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            onClick={saveAll}
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : `Save All (${dirtySet.size})`}
          </button>
        </div>
      </div>

      {(error || info) && (
        <div className="mt-3">
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">{error}</div>}
          {info && <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-2 rounded mt-2">{info}</div>}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <form onSubmit={onAddSubmit} className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">បន្ថែមបុគ្គលិក (Add Row)</div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-600">Staff ID</label>
              <input
                ref={addInputRef}
                className="border rounded px-2 py-1 w-full"
                value={newStaffId}
                onChange={(e) => setNewStaffId(e.target.value)}
                placeholder="e.g. s0932"
                list="hrStaffIds"
              />
              <datalist id="hrStaffIds">
                {hrList
                  .filter((r) => r?.staffId)
                  .slice(0, 3000)
                  .map((r) => (
                    <option key={String(r._id || r.staffId)} value={String(r.staffId)}>
                      {r.khmerName || r.fullName || r.name || ''}
                    </option>
                  ))}
              </datalist>
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-black"
            >
              Add
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">Tip: បញ្ចូល Staff ID ហើយចុច Add</div>
        </form>

        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">ស្វែងរក (Search)</div>
          <label className="block text-xs text-gray-600">Staff ID / Name</label>
          <input
            className="border rounded px-2 py-1 w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
          />
          <div className="mt-2 text-xs text-gray-500">Rows: {Object.keys(editMap).length} | Showing: {filteredStaffIds.length}</div>
        </div>

        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">Format</div>
          <div className="text-sm text-gray-700">
            <div>- `checkIn/checkOut`: `HH:MM` ឬ ISO</div>
            <div>- `workTime`: ចំនួនម៉ោង (ឧ. 7.5)</div>
            <div>- `ភ្លេច/ចូលយឺត/ចេញមុន`: រាប់ស្វ័យប្រវត្តិ (0/1)</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="text-xs text-gray-600">Grace (ចូល) នាទី:</div>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20"
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(e.target.value)}
                min={0}
              />
              <div className="text-xs text-gray-500">(Default 15, អាចប្រែប្រួល)</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">Backend នឹងគណនា `workTime` ពី `checkIn/checkOut` បើមិនបញ្ចូល។</div>
          </div>
        </div>
      </div>

      <div className="mt-4 border rounded bg-white overflow-auto">
        <table className="min-w-[1600px] w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-2">លេខសម្គាល់</th>
              <th className="text-left p-2">ឈ្មោះ</th>
              <th className="text-left p-2">ថ្ងៃធ្វើការ</th>
              <th className="text-left p-2">វត្តមាន</th>
              <th className="text-left p-2">ម៉ោងធ្វើការ (ម៉ោង)</th>
              <th className="text-left p-2">ចូលយឺត</th>
              <th className="text-left p-2">ចេញមុន</th>
              <th className="text-left p-2">អវត្តមាន</th>
              <th className="text-left p-2">ច្បាប់</th>
              <th className="text-left p-2">ភ្លេច</th>
              <th className="text-left p-2">ថ្ងៃខែឆ្នាំ</th>
              <th className="text-left p-2">ម៉ោងចូល/ម៉ោងចេញ</th>
              <th className="text-left p-2">ស្ថានភាព</th>
              <th className="text-left p-2">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaffIds.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={14}>
                  {loading ? 'Loading...' : 'No rows'}
                </td>
              </tr>
            ) : (
              filteredStaffIds.map((sid) => {
                const r = editMap[sid];
                if (!r) return null;
                const dirty = dirtySet.has(sid);
                const schedule = scheduleByStaffId[String(sid)];
                const auto = computeAutoCounts(r, schedule, graceMinutes);
                return (
                  <tr key={sid} className={dirty ? 'bg-yellow-50' : ''}>
                    <td className="p-2 border-t font-mono">{sid}</td>
                    <td className="p-2 border-t">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={r.name || ''}
                        onChange={(e) => setField(sid, 'name', e.target.value)}
                        placeholder="Name"
                      />
                    </td>
                    <td className="p-2 border-t">
                      <input
                        type="number"
                        className="border rounded px-2 py-1 w-full"
                        value={r.dayWorkCount}
                        onChange={(e) => setField(sid, 'dayWorkCount', e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-t">
                      <input
                        type="number"
                        className="border rounded px-2 py-1 w-full"
                        value={r.attendanceCount}
                        onChange={(e) => setField(sid, 'attendanceCount', e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-t">
                      <input
                        type="number"
                        step="0.01"
                        className="border rounded px-2 py-1 w-full"
                        value={r.workTime}
                        onChange={(e) => setField(sid, 'workTime', e.target.value)}
                        placeholder="7.5"
                      />
                    </td>
                    <td className="p-2 border-t">
                      <input
                        className="border rounded px-2 py-1 w-full bg-gray-50"
                        value={auto.checkinLateCount}
                        readOnly
                        title="បើស្ថានភាព=ចូលយឺត នឹងរាប់ 1"
                      />
                    </td>
                    <td className="p-2 border-t">
                      <input
                        className="border rounded px-2 py-1 w-full bg-gray-50"
                        value={auto.checkoutEarlyCount}
                        readOnly
                        title="បើស្ថានភាព=ចេញមុន នឹងរាប់ 1"
                      />
                    </td>
                    <td className="p-2 border-t">
                      <input
                        className="border rounded px-2 py-1 w-full bg-gray-50"
                        value={auto.absentCount}
                        readOnly
                        title="បើស្ថានភាព=អវត្តមាន នឹងរាប់ 1"
                      />
                    </td>
                    <td className="p-2 border-t">
                      <input
                        className="border rounded px-2 py-1 w-full bg-gray-50"
                        value={auto.leaveCount}
                        readOnly
                        title="បើស្ថានភាព=ច្បាប់ នឹងរាប់ 1"
                      />
                    </td>
                    <td className="p-2 border-t">
                      <input
                        className="border rounded px-2 py-1 w-full bg-gray-50"
                        value={auto.forgotCount}
                        readOnly
                        title="បើមិនមានម៉ោងចេញ នឹងរាប់ 1"
                      />
                    </td>
                    <td className="p-2 border-t whitespace-nowrap">{date}</td>
                    <td className="p-2 border-t">
                      <div className="flex gap-2">
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={r.checkIn || ''}
                          onChange={(e) => setField(sid, 'checkIn', e.target.value)}
                          placeholder="ចូល (07:30)"
                        />
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={r.checkOut || ''}
                          onChange={(e) => setField(sid, 'checkOut', e.target.value)}
                          placeholder="ចេញ (15:30)"
                        />
                      </div>
                    </td>
                    <td className="p-2 border-t">
                      <select
                        className="border rounded px-2 py-1 w-full"
                        value={r.status || ''}
                        onChange={(e) => setField(sid, 'status', e.target.value)}
                      >
                        <option value="">(auto)</option>
                        <option value="present">មានវត្តមាន</option>
                        <option value="absent">អវត្តមាន</option>
                        <option value="leave">ច្បាប់</option>
                        <option value="late">ចូលយឺត</option>
                        <option value="early">ចេញមុន</option>
                        <option value="forgot">ភ្លេច</option>
                        <option value="remote">ធ្វើការពីចម្ងាយ</option>
                        <option value="permission">សុំច្បាប់ (permission)</option>
                        {r.status &&
                          ![
                            '',
                            'present',
                            'absent',
                            'leave',
                            'late',
                            'early',
                            'forgot',
                            'remote',
                            'permission',
                          ].includes(r.status) && (
                            <option value={r.status}>
                              ស្ថានភាពផ្សេងទៀត: {r.status}
                            </option>
                          )}
                      </select>
                    </td>
                    <td className="p-2 border-t whitespace-nowrap">
                      <button
                        type="button"
                        className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        onClick={() => saveOne(sid)}
                        disabled={saving || loading}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="ml-2 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border"
                        onClick={() => removeRow(sid)}
                        disabled={saving || loading}
                        title="Remove from table (does not delete from DB)"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Note: This page upserts into `AttendanceDayData` collection; it does not delete raw `Attendance` records.
      </div>
    </div>
  );
}
