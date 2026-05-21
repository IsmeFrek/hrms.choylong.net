import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';

export default function AttendanceDayAttendanceDataPage() {
	const { canViewAttendanceMonthlyData } = usePermission();
	const containerRef = useRef(null);

	const PAGE_SIZES = [10, 20, 50, 100, 200, 500];
	const pad2 = (n) => String(n).padStart(2, '0');
	const formatQmHM = (value) => {
		if (value === null || typeof value === 'undefined' || value === '') return '';
		const n = typeof value === 'number' ? value : Number(String(value).trim());
		if (!Number.isFinite(n)) return String(value);
		const mins = Math.max(0, Math.round(n));
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return `${String(h).padStart(2, '0')}h:${String(m).padStart(2, '0')}m`;
	};

	// Use LOCAL date (not UTC) to avoid off-by-one day.
	const ymdLocal = (v) => {
		if (!v) return '';
		const d = v instanceof Date ? v : new Date(v);
		if (isNaN(d.getTime())) return '';
		return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
	};

	const parseISOToLocalDate = (iso) => {
		const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (!m) return new Date(NaN);
		return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	};

	const listDatesInclusive = (fromISO, toISO) => {
		const from = parseISOToLocalDate(fromISO);
		const to = parseISOToLocalDate(toISO);
		if (isNaN(from.getTime()) || isNaN(to.getTime())) return [];
		if (from > to) return [];
		const out = [];
		const cur = new Date(from);
		while (cur <= to) {
			out.push(ymdLocal(cur));
			cur.setDate(cur.getDate() + 1);
		}
		return out;
	};

	const normalizeHeader = (s) =>
		String(s || '')
			.trim()
			.toLowerCase()
			.replace(/\s+/g, '')
			.replace(/_/g, '')
			.replace(/-/g, '');

	const excelSerialToDate = (serial) => {
		const ms = Math.round((Number(serial) - 25569) * 86400 * 1000);
		return new Date(ms);
	};

	const parseAnyDateToISO = (val) => {
		if (val === null || typeof val === 'undefined' || val === '') return '';
		if (val instanceof Date && !isNaN(val.getTime())) return ymdLocal(val);
		if (typeof val === 'number' && Number.isFinite(val)) {
			const d = excelSerialToDate(val);
			return ymdLocal(d);
		}
		const s = String(val).trim();
		if (!s) return '';
		const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
		const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
		if (m) {
			const a = Number(m[1]);
			const b = Number(m[2]);
			let y = Number(m[3]);
			if (y < 100) y = 2000 + y;
			let day = a;
			let mon = b;
			if (a <= 12 && b <= 12) {
				day = a;
				mon = b;
			} else if (a > 12 && b <= 12) {
				day = a;
				mon = b;
			} else if (b > 12 && a <= 12) {
				day = b;
				mon = a;
			}
			return ymdLocal(new Date(y, mon - 1, day));
		}
		const d = new Date(s);
		return isNaN(d.getTime()) ? '' : ymdLocal(d);
	};

	const parseMinutes = (s) => {
		if (!s) return null;
		const str = String(s).trim();
		let m = str.match(/^(\d{1,2}):(\d{2})$/);
		if (m) return Number(m[1]) * 60 + Number(m[2]);
		m = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
		if (m) {
			let h = Number(m[1]);
			const isPM = m[3].toUpperCase() === 'PM';
			if (isPM && h < 12) h += 12;
			if (!isPM && h === 12) h = 0;
			return h * 60 + Number(m[2]);
		}
		const dt = new Date(str);
		if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
		return null;
	};

	const isDayOffShiftTitle = (title) => {
		const raw = String(title || '').trim();
		if (!raw) return false;
		const t = raw.toLowerCase();
		return (
			t === 'day off' ||
			t.includes('dayoff') ||
			t.includes('day off') ||
			t.includes('off') ||
			t.includes('rest') ||
			t.includes('holiday') ||
			raw.includes('សម្រាក') ||
			raw.includes('ឈប់')
		);
	};

	const computeScheduledDurationMinutes = (shiftStartMin, shiftEndMin) => {
		if (shiftStartMin === null || shiftEndMin === null) return null;
		let diff = shiftEndMin - shiftStartMin;
		if (diff < 0) diff += 24 * 60;
		return Math.max(0, diff);
	};

	const formatHMTo12 = (input) => {
		if (!input) return '';
		const s = String(input).trim();

		// 1. Try to find EXISTING AM/PM format (common in noisy strings)
		// e.g. "2026-04-06 05:42 PM - Good Time: 03:30 PM" -> extracts "05:42 PM"
		const ampmMatch = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
		if (ampmMatch) {
			let hh = parseInt(ampmMatch[1], 10);
			const mm = ampmMatch[2];
			const ampm = ampmMatch[3].toUpperCase();
			return `${hh.toString().padStart(2, '0')}:${mm} ${ampm}`;
		}

		// 2. Try to find the FIRST HH:mm pattern that looks like a time
		// e.g. "2024-04-06 17:42" -> extracts "17:42"
		const hmMatch = s.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$|-)/);
		if (hmMatch) {
			let hh = parseInt(hmMatch[1], 10);
			const mm = hmMatch[2];
			const ampm = hh >= 12 ? 'PM' : 'AM';
			hh = hh % 12 || 12;
			return `${hh.toString().padStart(2, '0')}:${mm} ${ampm}`;
		}

		// 3. Try ISO or Date string conversion
		if (s.includes('T') || s.includes('-') || s.includes('/')) {
			const d = new Date(s);
			if (!isNaN(d.getTime())) {
				const hours = d.getHours();
				const minutes = d.getMinutes();
				const ampm = hours >= 12 ? 'PM' : 'AM';
				let h = hours % 12;
				if (h === 0) h = 12;
				const hh = h < 10 ? String(h).padStart(2, '0') : String(h);
				const mm = String(minutes).padStart(2, '0');
				return `${hh}:${mm} ${ampm}`;
			}
		}

		return s;
	};

	const bestDailyEntryForDate = (row, dateISO) => {
		const list = Array.isArray(row?.dailyData) ? row.dailyData : [];
		if (list.length === 0) return null;
		const match = list.filter((x) => (x?.date ? String(x.date).slice(0, 10) === dateISO : false));
		if (match.length > 0) return match[match.length - 1];
		return list[list.length - 1];
	};

	const getDayCellBackground = (entry) => {
		if (!entry) return 'white';
		const ci = (entry.checkIn || '').toString().trim();
		const co = (entry.checkOut || '').toString().trim();
		const status = (entry.status || '').toString().toLowerCase();
		// Absent (no scan, not leave/rest) -> highlight red
		if (!ci && !co && status === 'absent') return '#ff9999';
		if (ci && co) return 'white';
		if (status === 'leave') return '#FFFACD';
		if (status === 'rest' || status === 'dayoff' || status === 'off' || status === 'holiday') return '#C084FC';
		if (ci && !co) return '#90EE90';
		return 'white';
	};

	const [dateFromDate, setDateFromDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [graceMinutes, setGraceMinutes] = useState(15);

	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(false);
	const [lastImportStats, setLastImportStats] = useState(null);
	const [scheduleByStaffId, setScheduleByStaffId] = useState({});
	const [hrLookup, setHrLookup] = useState({});

	const [searchText, setSearchText] = useState('');
	const [filterFlags, setFilterFlags] = useState({
		present: false,
		absent: false,
		leave: false,
		late: false,
		early: false,
		forgot: false,
		notWorking: false
	});

	const [pageSize, setPageSize] = useState(10);
	const [page, setPage] = useState(1);

	const [modalOpen, setModalOpen] = useState(false);
	const [modalData, setModalData] = useState(null);

	const [exporting, setExporting] = useState(false);
	const [importing, setImporting] = useState(false);

	const doPrint = () => window.print();

	const loadHR = async () => {
		try {
			const { data: list } = await api.get('/hr');
			const items = Array.isArray(list) ? list : [];
			const lookup = {};
			items.forEach((r) => {
				if (r?.staffId) lookup[String(r.staffId)] = r;
				if (r?.cardNumber) lookup[String(r.cardNumber)] = r;
				if (r?.cardNo) lookup[String(r.cardNo)] = r;
				if (r?.no) lookup[String(r.no)] = r;
				if (r?._id) lookup[String(r._id)] = r;
			});
			setHrLookup(lookup);
		} catch {
			setHrLookup({});
		}
	};

	const loadSchedules = async (dateISO) => {
		try {
			const res = await api.get('/work-schedules', { params: { startDate: dateISO, endDate: dateISO } });
			const list = Array.isArray(res.data) ? res.data : [];
			const map = {};
			list.forEach((s) => {
				const staffId = s?.employeeId?.staffId;
				if (!staffId) return;
				map[String(staffId)] = {
					shiftTitle: s.shiftTitle || '',
					shiftStart: s.shiftStart || '',
					shiftEnd: s.shiftEnd || ''
				};
			});
			setScheduleByStaffId(map);
		} catch {
			setScheduleByStaffId({});
		}
	};

	const computeFromSchedule = (staffId, entry) => {
		const sid = String(staffId || '').trim();
		const sch = scheduleByStaffId[sid];
		const isDayOff = isDayOffShiftTitle(sch?.shiftTitle);
		const shiftStartMin = parseMinutes(sch?.shiftStart);
		const shiftEndMin = parseMinutes(sch?.shiftEnd);
		const ciMin = parseMinutes(entry?.checkIn);
		const coMin = parseMinutes(entry?.checkOut);
		const grace = Number.isFinite(Number(graceMinutes)) ? Number(graceMinutes) : 15;

		const lateMinutes = !isDayOff && shiftStartMin !== null && ciMin !== null && ciMin > (shiftStartMin + grace) ? Math.max(0, ciMin - shiftStartMin) : 0;
		// For overnight shifts, treat checkout that is earlier than start/end as next day.
		const coMinAdj = coMin !== null && shiftEndMin !== null && coMin < Math.min(shiftEndMin, shiftStartMin ?? shiftEndMin) ? coMin + 24 * 60 : coMin;
		const earlyMinutes = !isDayOff && shiftEndMin !== null && coMinAdj !== null ? Math.max(0, shiftEndMin - coMinAdj) : 0;
		const overtimeMinutes = !isDayOff && shiftEndMin !== null && coMinAdj !== null ? Math.max(0, coMinAdj - shiftEndMin) : 0;

		return {
			lateMinutes,
			earlyMinutes,
			overtimeMinutes,
			lateCount: lateMinutes > 0 ? 1 : 0,
			earlyCount: earlyMinutes > 0 ? 1 : 0,
			overtimeCount: overtimeMinutes > 0 ? 1 : 0
		};
	};

	const load = async () => {
		if (!dateFromDate) return;
		setLoading(true);
		try {
			const res = await api.get('/attendance/day-data', { params: { date: dateFromDate } });
			const list = Array.isArray(res.data) ? res.data : [];

			const rows = list
				.map((r) => {
					const staffId = String(r?.staffId || '').trim();
					const hr = hrLookup[staffId];
					const name = r?.name || hr?.khmerName || hr?.fullName || hr?.name || '';
					const sch = scheduleByStaffId[staffId];
					const isDayOffBySchedule = isDayOffShiftTitle(sch?.shiftTitle);
					const shiftStartMin = parseMinutes(sch?.shiftStart);
					const shiftEndMin = parseMinutes(sch?.shiftEnd);
					const scheduledMinutes = isDayOffBySchedule ? 0 : computeScheduledDurationMinutes(shiftStartMin, shiftEndMin);
					const hasScheduleTime = shiftStartMin !== null && shiftEndMin !== null;
					const entry = bestDailyEntryForDate(r, dateFromDate) || {};
					const status = String(entry?.status || r?.status || '').trim();
					const ci = String(entry?.checkIn || '').trim();
					const co = String(entry?.checkOut || '').trim();

					const sched = computeFromSchedule(staffId, entry);

					let clockMinutes = 0;
					try {
						const inMin = parseMinutes(ci);
						const outMin = parseMinutes(co);
						if (inMin !== null && outMin !== null) {
							let diff = outMin - inMin;
							if (diff < 0) diff += 24 * 60;
							clockMinutes = Math.max(0, diff);
						}
					} catch {
						clockMinutes = 0;
					}

					// Prefer imported summary/minute fields (from Excel) when present.
					if (typeof r?.clockMinutes === 'number') clockMinutes = r.clockMinutes;

					const statusLower = String(status || '').toLowerCase();
					const hasIn = !!ci;
					const hasOut = !!co;
					let isOffByStatus = statusLower === 'rest' || statusLower === 'dayoff' || statusLower === 'off' || statusLower === 'holiday';
					
					// បើគាត់មានម៉ោងត្រូវធ្វើគឺធ្វើ (If they have a working schedule, ignore Checkinme's holiday/rest status)
					if (isOffByStatus && hasScheduleTime && !isDayOffBySchedule) {
						isOffByStatus = false;
					}

					const effectiveStatus =
						(isOffByStatus ? statusLower : '') ||
						(statusLower === 'leave' ? 'leave' : '') ||
						(isDayOffBySchedule && !hasIn && !hasOut ? 'rest' : ((hasIn || hasOut) ? 'present' : 'absent'));
					const isOff = isOffByStatus || effectiveStatus === 'rest' || isDayOffBySchedule;

					const forgotCount = typeof r?.forgotCount === 'number' ? r.forgotCount : (hasIn && !hasOut ? 1 : 0);
					const absentCount = (() => {
						if (isOff || isDayOffBySchedule) return 0;
						if (effectiveStatus === 'absent') return 1;
						if (typeof r?.absentCount === 'number') return r.absentCount;
						return 0;
					})();
					const leaveCount = typeof r?.leaveCount === 'number' && statusLower !== 'leave' ? r.leaveCount : (effectiveStatus === 'leave' ? 1 : 0);

					const dayWorkCount = (() => {
						if (isOff || isDayOffBySchedule) return 0;
						if (hasScheduleTime && !isDayOffBySchedule) return 1; // Force Day Work = 1 if they have a schedule
						if (typeof r?.dayWorkCount === 'number') return r.dayWorkCount;
						return 1;
					})();
					const attendanceCount = typeof r?.attendanceCount === 'number' && !hasIn && !hasOut ? r.attendanceCount : ((hasIn || hasOut) ? 1 : 0);

					// Column A: if already provided from DB/import, keep it.
					// Otherwise, for an absent working day, default A = 1 (but never for Day Off).
					const autoA = (() => {
						const rawA = r?.A;
						if (rawA !== null && typeof rawA !== 'undefined' && String(rawA).trim() !== '') return rawA;
						if (isOff || isDayOffBySchedule) return '';
						return absentCount > 0 ? 1 : '';
					})();

					const workTime = typeof r?.workTime === 'number'
						? r.workTime
						: (hasIn && hasOut ? clockMinutes : 0);
					const clockCount = typeof r?.clockCount === 'number' ? r.clockCount : (hasIn ? 1 : 0) + (hasOut ? 1 : 0);

					const lateCount = typeof r?.checkinLateCount === 'number' && r.checkinLateCount > 0 ? r.checkinLateCount : (effectiveStatus === 'late' ? 1 : sched.lateCount);
					const earlyCount = typeof r?.checkoutEarlyCount === 'number' && r.checkoutEarlyCount > 0 ? r.checkoutEarlyCount : (effectiveStatus === 'early' ? 1 : sched.earlyCount);

					const checkinLateMinutes = typeof r?.checkinLateMinutes === 'number' && r.checkinLateMinutes > 0 ? r.checkinLateMinutes : sched.lateMinutes;
					const checkoutEarlyMinutes = typeof r?.checkoutEarlyMinutes === 'number' && r.checkoutEarlyMinutes > 0 ? r.checkoutEarlyMinutes : sched.earlyMinutes;
					const checkoutOvertimeMinutes = typeof r?.checkoutOvertimeMinutes === 'number' && r.checkoutOvertimeMinutes > 0 ? r.checkoutOvertimeMinutes : sched.overtimeMinutes;
					const checkoutOvertimeCount = typeof r?.checkoutOvertimeCount === 'number' && r.checkoutOvertimeCount > 0 ? r.checkoutOvertimeCount : sched.overtimeCount;

					return {
						staffId,
						name,
						dailyEntry: { date: dateFromDate, checkIn: ci, checkOut: co, status: effectiveStatus || status },
						shiftTitle: sch?.shiftTitle || '',
						shiftStart: sch?.shiftStart || '',
						shiftEnd: sch?.shiftEnd || '',
						dayWorkCount,
						attendanceCount,
						workTime,
						clock: clockMinutes,
						clockCount,
						checkinLateMinutes,
						checkinLateCount: lateCount,
						checkoutEarlyMinutes,
						checkoutEarlyCount: earlyCount,
						checkoutOvertimeMinutes,
						checkoutOvertimeCount,
						absentCount,
						leaveCount,
						A: autoA,
						Plech: String(r?.Plech || '').trim() || (hasIn && !hasOut ? '1' : ''),
						forgotCount
					};
				})
				.filter((x) => x.staffId);

			setData(rows);
			setPage(1);
		} catch (err) {
			console.error(err);
			setData([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!canViewAttendanceMonthlyData) return;
		loadHR();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [canViewAttendanceMonthlyData]);

	useEffect(() => {
		if (!canViewAttendanceMonthlyData) return;
		if (!dateFromDate) return;
		loadSchedules(dateFromDate);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [canViewAttendanceMonthlyData, dateFromDate]);

	useEffect(() => {
		if (!canViewAttendanceMonthlyData) return;
		if (!dateFromDate) return;
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [canViewAttendanceMonthlyData, dateFromDate, graceMinutes, Object.keys(hrLookup).length, Object.keys(scheduleByStaffId).length]);

	const openDayModal = (rec) => {
		setModalData({
			staffId: rec.staffId,
			name: rec.name || '',
			date: dateFromDate,
			checkIn: formatHMTo12(rec.dailyEntry?.checkIn),
			checkOut: formatHMTo12(rec.dailyEntry?.checkOut),
			status: rec.dailyEntry?.status || ''
		});
		setModalOpen(true);
	};

	const closeModal = () => {
		setModalOpen(false);
		setModalData(null);
	};

	const saveModal = async () => {
		try {
			if (!modalData?.staffId || !modalData?.date) return;
			await api.post('/attendance/day-data', [
				{
					staffId: modalData.staffId,
					name: modalData.name || '',
					date: modalData.date,
					checkIn: modalData.checkIn || '',
					checkOut: modalData.checkOut || '',
					status: modalData.status || '',
					graceMinutes: Number.isFinite(Number(graceMinutes)) ? Number(graceMinutes) : 15
				}
			]);
			closeModal();
			await load();
		} catch (err) {
			console.error(err);
			alert('Save failed: ' + (err?.message || String(err)));
		}
	};

	const handleDeleteAllByDate = async () => {
		try {
			if (!dateFromDate) return;
			const ok = window.confirm(`លុបទិន្នន័យទាំងអស់សម្រាប់: ${dateFromDate} ?`);
			if (!ok) return;
			await api.delete('/attendance/day-data', { params: { date: dateFromDate } });
			await load();
			alert('Deleted');
		} catch (err) {
			console.error(err);
			alert('Delete failed: ' + (err?.response?.data?.message || err?.message || String(err)));
		}
	};

	const handleDeleteOne = async (staffId) => {
		try {
			if (!dateFromDate || !staffId) return;
			const ok = window.confirm(`លុប ${staffId} សម្រាប់ថ្ងៃ ${dateFromDate} ?`);
			if (!ok) return;
			await api.delete('/attendance/day-data/one', { params: { staffId, date: dateFromDate } });
			await load();
		} catch (err) {
			console.error(err);
			alert('Delete failed: ' + (err?.response?.data?.message || err?.message || String(err)));
		}
	};

	const exportExcel = async () => {
		try {
			if (!dateFromDate) {
				alert('សូមជ្រើសរើស ថ្ងៃ');
				return;
			}
			const dateISOs = [dateFromDate];
			setExporting(true);

			const fromLocal = parseISOToLocalDate(dateFromDate);
			if (isNaN(fromLocal.getTime())) {
				alert('ថ្ងៃ មិនត្រឹមត្រូវ');
				return;
			}
			const dates = [fromLocal];

			const staffMap = new Map();
			const normalizeStatus = (s) => String(s || '').trim().toLowerCase();

			const addToAgg = (sid, name, dayISO, entry) => {
				const record = staffMap.get(sid) || {
					staffId: sid,
					name: name || '',
					dailyData: [],
					dayWorkCount: 0,
					attendanceCount: 0,
					workTime: 0,
					clock: 0,
					clockCount: 0,
					checkinLateMinutes: 0,
					checkinLateCount: 0,
					checkoutEarlyMinutes: 0,
					checkoutEarlyCount: 0,
					checkoutOvertimeMinutes: 0,
					checkoutOvertimeCount: 0,
					absentCount: 0,
					leaveCount: 0,
					A: '',
					plech: ''
				};

				const checkIn = String(entry?.checkIn || '').trim();
				const checkOut = String(entry?.checkOut || '').trim();
				const status = normalizeStatus(entry?.status);
				let cell = '';
				if (checkIn && checkOut) cell = `${checkIn} - ${checkOut}`;
				else cell = checkIn || checkOut || '';

				record.dailyData.push({ date: dayISO, _cell: cell, status });

				const hasIn = !!checkIn;
				const hasOut = !!checkOut;
				const isOff = status === 'rest' || status === 'dayoff' || status === 'off' || status === 'holiday';

				record.dayWorkCount += isOff ? 0 : 1;
				record.attendanceCount += (hasIn || hasOut) ? 1 : 0;

				const clockMin = (() => {
					const inMin = parseMinutes(checkIn);
					const outMin = parseMinutes(checkOut);
					if (inMin === null || outMin === null) return 0;
					let diff = outMin - inMin;
					if (diff < 0) diff += 24 * 60;
					return Math.max(0, diff);
				})();
				record.clock += clockMin;
				record.workTime += clockMin;
				record.clockCount += (hasIn ? 1 : 0) + (hasOut ? 1 : 0);

				record.checkinLateCount += status === 'late' ? 1 : 0;
				record.checkoutEarlyCount += status === 'early' ? 1 : 0;
				record.absentCount += status === 'absent' ? 1 : 0;
				record.leaveCount += status === 'leave' ? 1 : 0;

				staffMap.set(sid, record);
			};

			for (let i = 0; i < dateISOs.length; i++) {
				const dayISO = dateISOs[i];
				const res = await api.get('/attendance/day-data', { params: { date: dayISO } });
				const list = Array.isArray(res.data) ? res.data : [];
				list.forEach((r) => {
					const sid = String(r?.staffId || '').trim();
					if (!sid) return;
					const hr = hrLookup[sid];
					const resolvedName = r?.name || hr?.khmerName || hr?.fullName || hr?.name || '';
					const entry = bestDailyEntryForDate(r, dayISO) || {};
					addToAgg(sid, resolvedName, dayISO, entry);
				});
			}

			const exportData = Array.from(staffMap.values()).sort((a, b) => String(a.staffId).localeCompare(String(b.staffId)));
			// For single-day export use the same date as both ends of the range.
			const toLocal = fromLocal;
			const dateRangeLabel = `${fromLocal.toLocaleDateString('en-US')} to ${toLocal.toLocaleDateString('en-US')}`;

			const headerRow1 = [
				'Staff ID',
				'Name',
				...dates.map((d) => d.getDate()),
				'Day Work',
				'Attendance',
				'Work Time',
				'Clock',
				'Clock',
				'Checkin Late',
				'Checkin Late',
				'Checkout Early',
				'Checkout Early',
				'Checkout Overtime',
				'Checkout Overtime',
				'Absent',
				'Leave',
				'A',
				'Plech'
			];
			const headerRow2 = [
				'',
				'',
				...dates.map(() => 'Check in - Check out'),
				'Count',
				'Q-mn',
				'Q-mn',
				'Q-mn',
				'Count',
				'Q-mn',
				'Count',
				'Q-mn',
				'Count',
				'Q-mn',
				'Count',
				'',
				'',
				'',
				''
			];

			const rows = [
				[`Detail Report Payroll ${dateRangeLabel}`, ...Array(headerRow1.length - 1).fill('')],
				headerRow1,
				headerRow2,
				...exportData.map((record) => {
					const row = [record.staffId || '', record.name || ''];
					for (const dayISO of dateISOs) {
						const dd = record.dailyData.find((x) => x?.date === dayISO);
						row.push(dd?._cell || '');
					}
					row.push(record.dayWorkCount || '');
					row.push(record.attendanceCount || '');
					row.push(record.workTime || '');
					row.push(record.clock || '');
					row.push(record.clockCount || '');
					row.push(record.checkinLateMinutes || '');
					row.push(record.checkinLateCount || '');
					row.push(record.checkoutEarlyMinutes || '');
					row.push(record.checkoutEarlyCount || '');
					row.push(record.checkoutOvertimeMinutes || '');
					row.push(record.checkoutOvertimeCount || '');
					row.push(record.absentCount || '');
					row.push(record.leaveCount || '');
					const exportA = (record.A !== null && typeof record.A !== 'undefined' && String(record.A).trim() !== '')
						? record.A
						: ((record.absentCount || 0) > 0 ? 1 : '');
					row.push(exportA);
					row.push(record.Plech || record.plech || '');
					return row;
				})
			];

			const ws = XLSX.utils.aoa_to_sheet(rows);
			const borders = {
				left: { style: 'thin', color: { rgb: '000000' } },
				right: { style: 'thin', color: { rgb: '000000' } },
				top: { style: 'thin', color: { rgb: '000000' } },
				bottom: { style: 'thin', color: { rgb: '000000' } }
			};
			const baseFont = { name: 'Times New Roman', sz: 12 };
			const centerAlignment = { horizontal: 'center', vertical: 'center', wrapText: true };
			for (let r = 0; r < rows.length; r++) {
				for (let c = 0; c < rows[r].length; c++) {
					const cellRef = XLSX.utils.encode_col(c) + (r + 1);
					if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
					let style = { font: baseFont, alignment: centerAlignment, border: borders };
					if (r < 3) {
						style = { ...style, fill: { fgColor: { rgb: 'FFE6E6' } } };
					} else if (r >= 3 && c >= 2 && c < 2 + dates.length) {
						// Body daily cells: color by status (absent = red, day off = purple)
						const recIdx = r - 3;
						const dayIdx = c - 2;
						const rec = exportData[recIdx];
						const dayISO = dateISOs[dayIdx];
						const dd = rec && rec.dailyData ? rec.dailyData.find((x) => x?.date === dayISO) : null;
						const s = dd && dd.status ? String(dd.status).toLowerCase() : '';
							if (s === 'absent') {
								style = { ...style, fill: { fgColor: { rgb: 'FF9999' } } };
							} else if (s === 'rest' || s === 'dayoff' || s === 'off' || s === 'holiday') {
								style = { ...style, fill: { fgColor: { rgb: 'C084FC' } } };
						}
					}
					ws[cellRef].s = style;
				}
			}
			const colWidths = [12, 15, ...Array(dates.length).fill(15), 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 10, 10];
			ws['!cols'] = colWidths.map((w) => ({ wch: w }));

			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, 'Day Data');
			const fromStr = dateFromDate.replace(/-/g, '');
			XLSX.writeFile(wb, `AttendanceDayData_${fromStr}.xlsx`);
		} catch (err) {
			console.error(err);
			alert('Export failed: ' + (err?.message || String(err)));
		} finally {
			setExporting(false);
		}
	};

	const importExcel = async (file) => {
		if (!file) return;
		try {
			setImporting(true);
			const arrayBuffer = await file.arrayBuffer();
			const wb = XLSX.read(arrayBuffer, { type: 'array' });
			const sheet = wb.Sheets[wb.SheetNames[0]];
			const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

			if (!raw || raw.length < 2) throw new Error('Empty sheet');

			const findHeaderRowIdx = (predicate) => {
				for (let i = 0; i < Math.min(raw.length, 10); i++) {
					const row = raw[i];
					if (!Array.isArray(row)) continue;
					const norm = row.map(normalizeHeader);
					if (predicate(norm, row)) return i;
				}
				return -1;
			};

			const pivotHeaderRowIdx = findHeaderRowIdx((norm) => norm[0] === 'staffid' && norm[1] === 'name');
			const dayTemplateHeaderRowIdx = findHeaderRowIdx((norm) => norm.includes('date') && norm.includes('staffid'));

			const excelValueToTimeText = (v) => {
				if (v === null || typeof v === 'undefined' || v === '') return '';
				if (v instanceof Date) {
					const hh = String(v.getHours()).padStart(2, '0');
					const mm = String(v.getMinutes()).padStart(2, '0');
					return `${hh}:${mm}`;
				}
				if (typeof v === 'number' && Number.isFinite(v)) {
					const frac = ((v % 1) + 1) % 1;
					const totalMinutes = Math.round(frac * 24 * 60);
					const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
					const mm = String(totalMinutes % 60).padStart(2, '0');
					return `${hh}:${mm}`;
				}
				return String(v).trim();
			};

			const toNumOrUndef = (v) => {
				if (v === null || typeof v === 'undefined' || v === '') return undefined;
				if (typeof v === 'number' && Number.isFinite(v)) return v;
				const s = String(v).trim();
				if (!s) return undefined;
				const n = Number(s);
				return Number.isFinite(n) ? n : undefined;
			};

			const parseDurationMinutes = (v) => {
				if (v === null || typeof v === 'undefined' || v === '') return undefined;
				if (v instanceof Date && !isNaN(v.getTime())) return v.getHours() * 60 + v.getMinutes();
				if (typeof v === 'number' && Number.isFinite(v)) {
					// If it has decimals, assume hours (e.g. 0.5 => 30 minutes). If integer, assume minutes.
					const isInt = Math.abs(v - Math.round(v)) < 1e-9;
					return isInt ? v : Math.round(v * 60);
				}
				const s0 = String(v).trim();
				if (!s0) return undefined;
				const s = s0.toLowerCase().replace(/\s+/g, '');
				const hm = s.match(/^(\d{1,2}):(\d{2})$/);
				if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
				let total = 0;
				const h = s.match(/(\d+(?:\.\d+)?)h/);
				const m = s.match(/(\d+(?:\.\d+)?)m/);
				if (h) total += Math.round(Number(h[1]) * 60);
				if (m) total += Math.round(Number(m[1]));
				if (h || m) return total;
				const n = Number(s0);
				if (Number.isFinite(n)) {
					const isInt = Math.abs(n - Math.round(n)) < 1e-9;
					return isInt ? n : Math.round(n * 60);
				}
				return undefined;
			};

			const grace = Number.isFinite(Number(graceMinutes)) ? Number(graceMinutes) : 15;
			const records = [];
			let totalRows = 0;
			let skippedRows = 0;
			const staffSeen = new Set();

			if (pivotHeaderRowIdx >= 0) {
				const headerRowIdx = pivotHeaderRowIdx;
				const headers = raw[headerRowIdx] || [];
				const dayWorkIdxInFile = (headers || []).findIndex((h) => String(h).trim().toLowerCase() === 'day work');
				const dailyStartIdx = 2;
				const effectiveDailyColCount = dayWorkIdxInFile > dailyStartIdx ? (dayWorkIdxInFile - dailyStartIdx) : 1;
				if (effectiveDailyColCount <= 0) throw new Error('Invalid pivot format: no daily columns');

				// Build dateISOs for each daily column. Prefer header dates (year>=2000),
				// otherwise map by column index from the selected `dateFromDate`.
				const dateISOs = [];
				const baseDate = parseISOToLocalDate(dateFromDate);
				for (let i = 0; i < effectiveDailyColCount; i++) {
					const colIdx = dailyStartIdx + i;
					let dateISO = '';
					const headerVal = headers?.[colIdx];
					if (headerVal !== null && typeof headerVal !== 'undefined' && String(headerVal).trim() !== '') {
						const parsed = parseAnyDateToISO(headerVal);
						if (parsed) {
							const y = Number(String(parsed).slice(0, 4));
							if (Number.isFinite(y) && y >= 2000) dateISO = parsed;
						}
					}
					if (!dateISO && !isNaN(baseDate.getTime())) {
						const d = new Date(baseDate);
						d.setDate(baseDate.getDate() + i);
						dateISO = ymdLocal(d);
					}
					dateISOs.push(dateISO);
				}

				const isSingleDay = effectiveDailyColCount === 1;

				for (let r = headerRowIdx + 2; r < raw.length; r++) {
					const row = raw[r];
					if (!row || !row[0]) continue;
					const staffId = String(row[0] || '').trim();
					if (!staffId) continue;
					totalRows++;
					staffSeen.add(staffId);
					const name = String(row[1] || '').trim();

					const pivotSummary = (() => {
						if (!isSingleDay || dayWorkIdxInFile < 0) return null;
						const idxDayWork = dayWorkIdxInFile;
						const idxAttendance = idxDayWork + 1;
						const idxWorkTime = idxDayWork + 2;
						const idxClockMin = idxDayWork + 3;
						const idxClockCount = idxDayWork + 4;
						const idxLateMin = idxDayWork + 5;
						const idxLateCount = idxDayWork + 6;
						const idxEarlyMin = idxDayWork + 7;
						const idxEarlyCount = idxDayWork + 8;
						const idxOtMin = idxDayWork + 9;
						const idxOtCount = idxDayWork + 10;
						const idxAbsent = idxDayWork + 11;
						const idxLeave = idxDayWork + 12;
						const idxA = idxDayWork + 13;
						const idxPlech = idxDayWork + 14;

						const A = String(row[idxA] ?? '').trim();
						const Plech = String(row[idxPlech] ?? '').trim();

						return {
							...(typeof toNumOrUndef(row[idxDayWork]) === 'number' ? { dayWorkCount: Number(row[idxDayWork]) } : {}),
							...(typeof toNumOrUndef(row[idxAttendance]) === 'number' ? { attendanceCount: Number(row[idxAttendance]) } : {}),
							...(typeof toNumOrUndef(row[idxWorkTime]) === 'number' ? { workTime: Number(row[idxWorkTime]) } : {}),
							...(typeof parseDurationMinutes(row[idxClockMin]) === 'number' ? { clockMinutes: parseDurationMinutes(row[idxClockMin]) } : {}),
							...(typeof toNumOrUndef(row[idxClockCount]) === 'number' ? { clockCount: Number(row[idxClockCount]) } : {}),
							...(typeof parseDurationMinutes(row[idxLateMin]) === 'number' ? { checkinLateMinutes: parseDurationMinutes(row[idxLateMin]) } : {}),
							...(typeof toNumOrUndef(row[idxLateCount]) === 'number' ? { checkinLateCount: Number(row[idxLateCount]) } : {}),
							...(typeof parseDurationMinutes(row[idxEarlyMin]) === 'number' ? { checkoutEarlyMinutes: parseDurationMinutes(row[idxEarlyMin]) } : {}),
							...(typeof toNumOrUndef(row[idxEarlyCount]) === 'number' ? { checkoutEarlyCount: Number(row[idxEarlyCount]) } : {}),
							...(typeof parseDurationMinutes(row[idxOtMin]) === 'number' ? { checkoutOvertimeMinutes: parseDurationMinutes(row[idxOtMin]) } : {}),
							...(typeof toNumOrUndef(row[idxOtCount]) === 'number' ? { checkoutOvertimeCount: Number(row[idxOtCount]) } : {}),
							...(typeof toNumOrUndef(row[idxAbsent]) === 'number' ? { absentCount: Number(row[idxAbsent]) } : {}),
							...(typeof toNumOrUndef(row[idxLeave]) === 'number' ? { leaveCount: Number(row[idxLeave]) } : {}),
							...(A ? { A } : {}),
							...(Plech ? { Plech } : {})
						};
					})();

					// For a single-day pivot export, import ALL staff rows even if the day cell is empty.
					if (isSingleDay) {
						const colIdx = dailyStartIdx;
						const cellVal = row[colIdx];
						const text = excelValueToTimeText(cellVal);
						const parts = String(text || '')
							.split(/\s*(?:-|–|—)\s*/)
							.map((s) => String(s).trim())
							.filter(Boolean);

						const checkIn = parts[0] || '';
						const checkOut = parts[1] || '';

						let dateISO = dateISOs[0];
						if (!dateISO) {
							skippedRows++;
							continue;
						}

						const status = (() => {
							const a = pivotSummary?.absentCount;
							const l = pivotSummary?.leaveCount;
							const late = pivotSummary?.checkinLateCount;
							const early = pivotSummary?.checkoutEarlyCount;
							const att = pivotSummary?.attendanceCount;
							const dw = pivotSummary?.dayWorkCount;
							if (typeof l === 'number' && l > 0) return 'leave';
							if (typeof a === 'number' && a > 0) return 'absent';
							if (typeof late === 'number' && late > 0) return 'late';
							if (typeof early === 'number' && early > 0) return 'early';
							if ((checkIn || checkOut) || (typeof att === 'number' && att > 0)) return 'present';
							if (typeof dw === 'number' && dw === 0) return 'off';
							return '';
						})();

						records.push({ staffId, name, date: dateISO, checkIn, checkOut, status, graceMinutes: grace, ...(pivotSummary || {}) });
						continue;
					}

					for (let i = 0; i < effectiveDailyColCount; i++) {
						const colIdx = dailyStartIdx + i;
						const cellVal = row[colIdx];
						const text = excelValueToTimeText(cellVal);
						const parts = String(text || '')
							.split(/\s*(?:-|–|—)\s*/)
							.map((s) => String(s).trim())
							.filter(Boolean);

						const checkIn = parts[0] || '';
						const checkOut = parts[1] || '';

						let dateISO = dateISOs[i];
						if (!dateISO) {
							skippedRows++;
							continue;
						}
						records.push({ staffId, name, date: dateISO, checkIn, checkOut, status: '', graceMinutes: grace });
					}
				}
			} else {
				const headerRowIdx = dayTemplateHeaderRowIdx >= 0
					? dayTemplateHeaderRowIdx
					: raw.findIndex((r) => Array.isArray(r) && r.some((c) => String(c || '').trim() !== ''));
				if (headerRowIdx < 0) throw new Error('No header row');
				const header = raw[headerRowIdx].map(normalizeHeader);

				const idxOf = (names) => {
					for (const n of names) {
						const i = header.indexOf(normalizeHeader(n));
						if (i >= 0) return i;
					}
					return -1;
				};

				const idxStaffId = idxOf(['staffid', 'staff id', 'id', 'employeeid']);
				const idxName = idxOf(['name', 'khmername', 'fullname']);
				const idxDate = idxOf(['date', 'day']);
				const idxCheckIn = idxOf(['checkin', 'check in', 'in', 'intime']);
				const idxCheckOut = idxOf(['checkout', 'check out', 'out', 'outtime']);
				const idxStatus = idxOf(['status']);
				const idxDayWork = idxOf(['dayworkcount', 'daywork', 'day work', 'dayworkcountcount']);
				const idxAttendance = idxOf(['attendancecount', 'attendance', 'attendanceqmn']);
				const idxWorkTime = idxOf(['worktime', 'worktimeqmn', 'work time', 'work timeqmn']);
				const idxClockMinutes = idxOf(['clockminutes', 'clockqmn', 'clock qmn', 'clock']);
				const idxClockCount = idxOf(['clockcount', 'clock count']);
				const idxLateMinutes = idxOf(['checkinlateminutes', 'checkinlateqmn', 'lateqmn', 'lateminutes', 'late minutes']);
				const idxLateCount = idxOf(['checkinlatecount', 'checkinlate count', 'latecount', 'late count']);
				const idxEarlyMinutes = idxOf(['checkoutearlyminutes', 'checkoutearlyqmn', 'earlyqmn', 'earlyminutes', 'early minutes']);
				const idxEarlyCount = idxOf(['checkoutearlycount', 'checkoutearly count', 'earlycount', 'early count']);
				const idxOvertimeMinutes = idxOf(['checkoutovertimeminutes', 'checkoutovertimeqmn', 'overtimeqmn', 'overtimeminutes']);
				const idxOvertimeCount = idxOf(['checkoutovertimecount', 'checkoutovertime count', 'overtimecount', 'overtime count']);
				const idxForgotCount = idxOf(['forgotcount', 'forgot count', 'plechcount', 'plech count']);
				const idxAbsentCount = idxOf(['absentcount', 'absent count', 'absent']);
				const idxLeaveCount = idxOf(['leavecount', 'leave count', 'leave']);
				const idxA = idxOf(['a']);
				const idxPlech = idxOf(['plech']);
				if (idxStaffId < 0 || idxDate < 0) throw new Error('Excel must include columns: Staff ID and Date');

				for (let i = headerRowIdx + 1; i < raw.length; i++) {
					const row = raw[i];
					if (!row || row.length === 0) continue;
					const staffId = String(row[idxStaffId] || '').trim();
					const dateISO = parseAnyDateToISO(row[idxDate]);
					if (!staffId || !dateISO) {
						skippedRows++;
						continue;
					}
					totalRows++;
					staffSeen.add(staffId);
					const name = idxName >= 0 ? String(row[idxName] || '').trim() : '';
					const checkIn = idxCheckIn >= 0 ? String(row[idxCheckIn] || '').trim() : '';
					const checkOut = idxCheckOut >= 0 ? String(row[idxCheckOut] || '').trim() : '';
					const status = idxStatus >= 0 ? String(row[idxStatus] || '').trim() : '';
					const dayWorkCount = idxDayWork >= 0 ? toNumOrUndef(row[idxDayWork]) : undefined;
					const attendanceCount = idxAttendance >= 0 ? toNumOrUndef(row[idxAttendance]) : undefined;
					const workTime = idxWorkTime >= 0 ? toNumOrUndef(row[idxWorkTime]) : undefined;
					const clockMinutes = idxClockMinutes >= 0 ? parseDurationMinutes(row[idxClockMinutes]) : undefined;
					const clockCount = idxClockCount >= 0 ? toNumOrUndef(row[idxClockCount]) : undefined;
					const checkinLateMinutes = idxLateMinutes >= 0 ? parseDurationMinutes(row[idxLateMinutes]) : undefined;
					const checkinLateCount = idxLateCount >= 0 ? toNumOrUndef(row[idxLateCount]) : undefined;
					const checkoutEarlyMinutes = idxEarlyMinutes >= 0 ? parseDurationMinutes(row[idxEarlyMinutes]) : undefined;
					const checkoutEarlyCount = idxEarlyCount >= 0 ? toNumOrUndef(row[idxEarlyCount]) : undefined;
					const checkoutOvertimeMinutes = idxOvertimeMinutes >= 0 ? parseDurationMinutes(row[idxOvertimeMinutes]) : undefined;
					const checkoutOvertimeCount = idxOvertimeCount >= 0 ? toNumOrUndef(row[idxOvertimeCount]) : undefined;
					const forgotCount = idxForgotCount >= 0 ? toNumOrUndef(row[idxForgotCount]) : undefined;
					const absentCount = idxAbsentCount >= 0 ? toNumOrUndef(row[idxAbsentCount]) : undefined;
					const leaveCount = idxLeaveCount >= 0 ? toNumOrUndef(row[idxLeaveCount]) : undefined;
					const A = idxA >= 0 ? String(row[idxA] ?? '').trim() : '';
					const plechRaw = idxPlech >= 0 ? row[idxPlech] : '';
					const plechRawStr = String(plechRaw ?? '').trim();
					const plechAsNum = toNumOrUndef(plechRaw);
					const Plech = plechAsNum === undefined ? plechRawStr : '';
					const forgotFromPlech = plechAsNum;

					records.push({
						staffId,
						name,
						date: dateISO,
						checkIn,
						checkOut,
						status,
						graceMinutes: grace,
						...(typeof dayWorkCount === 'number' ? { dayWorkCount } : {}),
						...(typeof attendanceCount === 'number' ? { attendanceCount } : {}),
						...(typeof workTime === 'number' ? { workTime } : {}),
						...(typeof clockMinutes === 'number' ? { clockMinutes } : {}),
						...(typeof clockCount === 'number' ? { clockCount } : {}),
						...(typeof checkinLateMinutes === 'number' ? { checkinLateMinutes } : {}),
						...(typeof checkinLateCount === 'number' ? { checkinLateCount } : {}),
						...(typeof checkoutEarlyMinutes === 'number' ? { checkoutEarlyMinutes } : {}),
						...(typeof checkoutEarlyCount === 'number' ? { checkoutEarlyCount } : {}),
						...(typeof checkoutOvertimeMinutes === 'number' ? { checkoutOvertimeMinutes } : {}),
						...(typeof checkoutOvertimeCount === 'number' ? { checkoutOvertimeCount } : {}),
						...(typeof forgotCount === 'number' ? { forgotCount } : (typeof forgotFromPlech === 'number' ? { forgotCount: forgotFromPlech } : {})),
						...(typeof absentCount === 'number' ? { absentCount } : {}),
						...(typeof leaveCount === 'number' ? { leaveCount } : {}),
						...(A ? { A } : {}),
						...(Plech ? { Plech } : {})
					});
				}
			}

			if (records.length === 0) throw new Error('No valid rows found in Excel');

			const batchSize = 500;
			let imported = 0;
			for (let i = 0; i < records.length; i += batchSize) {
				const batch = records.slice(i, i + batchSize);
				await api.post('/attendance/day-data', batch);
				imported += batch.length;
			}
			const importedStaff = staffSeen.size;

			setLastImportStats({
				fileName: file?.name || '',
				totalRows,
				imported,
				importedStaff,
				skippedRows,
				when: new Date().toISOString()
			});
			alert(`Imported ${importedStaff} staff, ${imported} records`);
			await load();
		} catch (err) {
			console.error(err);
			alert('Import failed: ' + (err?.message || String(err)));
		} finally {
			setImporting(false);
		}
	};

	const filteredData = useMemo(() => {
		const flags = filterFlags;
		const q = String(searchText || '').trim().toLowerCase();

		const anyFlag = Object.values(flags).some(Boolean);
		return (Array.isArray(data) ? data : []).filter((r) => {
			if (q) {
				const hay = `${r.staffId || ''} ${r.name || ''}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			if (!anyFlag) return true;

			const statusLower = String(r?.dailyEntry?.status || '').toLowerCase();
			const hasAttendance = (r.attendanceCount || 0) > 0;
			const isAbsent = (r.absentCount || 0) > 0 || statusLower === 'absent';
			const isLeave = (r.leaveCount || 0) > 0 || statusLower === 'leave';
			const isLate = (r.checkinLateCount || 0) > 0 || statusLower === 'late';
			const isEarly = (r.checkoutEarlyCount || 0) > 0 || statusLower === 'early';
			const isForgot = (r.forgotCount || 0) > 0 || statusLower === 'forgot';
			const isNotWorking = (r.dayWorkCount || 0) === 0;

			if (flags.present && !hasAttendance) return false;
			if (flags.absent && !isAbsent) return false;
			if (flags.leave && !isLeave) return false;
			if (flags.late && !isLate) return false;
			if (flags.early && !isEarly) return false;
			if (flags.forgot && !isForgot) return false;
			if (flags.notWorking && !isNotWorking) return false;

			return true;
		});
	}, [data, filterFlags, searchText]);

	const totalFiltered = filteredData.length;
	const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
	const safePage = Math.min(Math.max(1, page), totalPages);
	const startIndex = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize;
	const endIndex = Math.min(startIndex + pageSize, totalFiltered);
	const pageData = filteredData.slice(startIndex, endIndex);

	const displayDates = useMemo(() => {
		const d = parseISOToLocalDate(dateFromDate);
		if (isNaN(d.getTime())) return [];
		return [d];
	}, [dateFromDate]);

	if (!canViewAttendanceMonthlyData) {
		return <div style={{ padding: 16 }}>No permission</div>;
	}

	return (
		<div style={{ padding: 12 }}>
			{modalOpen && modalData && (
				<div
					style={{
						position: 'fixed',
						left: 0,
						top: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0,0,0,0.4)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 50
					}}
					onClick={closeModal}
				>
					<div
						style={{ background: '#fff', padding: 16, borderRadius: 8, minWidth: 420 }}
						onClick={(e) => e.stopPropagation()}
					>
						<div style={{ fontWeight: 700, marginBottom: 12 }}>Edit Day Attendance</div>
						<div style={{ marginBottom: 8 }}>
							<label style={{ display: 'block', fontSize: 12 }}>Staff</label>
							<div>
								{modalData.staffId} - {modalData.name}
							</div>
						</div>
						<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
							<div style={{ flex: 1 }}>
								<label style={{ display: 'block', fontSize: 12 }}>Date</label>
								<input value={modalData.date} disabled style={{ width: '100%' }} />
							</div>
							<div style={{ flex: 1 }}>
								<label style={{ display: 'block', fontSize: 12 }}>Status</label>
								<input value={modalData.status} onChange={(e) => setModalData({ ...modalData, status: e.target.value })} style={{ width: '100%' }} />
							</div>
						</div>
						<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
							<div style={{ flex: 1 }}>
								<label style={{ display: 'block', fontSize: 12 }}>Check In</label>
								<input value={modalData.checkIn} onChange={(e) => setModalData({ ...modalData, checkIn: e.target.value })} style={{ width: '100%' }} />
							</div>
							<div style={{ flex: 1 }}>
								<label style={{ display: 'block', fontSize: 12 }}>Check Out</label>
								<input value={modalData.checkOut} onChange={(e) => setModalData({ ...modalData, checkOut: e.target.value })} style={{ width: '100%' }} />
							</div>
						</div>
						<div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
							<button onClick={closeModal} className="border rounded px-3 py-1">
								Cancel
							</button>
							<button onClick={saveModal} className="border rounded px-3 py-1 bg-green-600 text-white">
								Save
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Controls (match Monthly page layout) */}
			<div className="flex gap-4 mb-4 flex-wrap">
				<div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
					<div>
						<label className="text-sm block mb-2">ថ្ងៃ</label>
						<input
							type="date"
							value={dateFromDate}
							onChange={(e) => setDateFromDate(e.target.value)}
							style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
						/>
					</div>
				</div>

				<div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
					<div>
						<label className="text-sm block mb-2">ស្វែងរក</label>
						<input
							value={searchText}
							onChange={(e) => setSearchText(e.target.value)}
							placeholder="Staff ID / ឈ្មោះ"
							style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, minWidth: 220 }}
						/>
					</div>

					<div>
						<label className="text-sm block mb-2">Filter</label>
						<div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								<input type="checkbox" checked={filterFlags.present} onChange={(e) => setFilterFlags((s) => ({ ...s, present: e.target.checked }))} />
								វត្តមាន
							</label>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								<input type="checkbox" checked={filterFlags.absent} onChange={(e) => setFilterFlags((s) => ({ ...s, absent: e.target.checked }))} />
								អវត្តមាន
							</label>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								<input type="checkbox" checked={filterFlags.leave} onChange={(e) => setFilterFlags((s) => ({ ...s, leave: e.target.checked }))} />
								ច្បាប់
							</label>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								<input type="checkbox" checked={filterFlags.late} onChange={(e) => setFilterFlags((s) => ({ ...s, late: e.target.checked }))} />
								ចូលយឺត
							</label>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								<input type="checkbox" checked={filterFlags.early} onChange={(e) => setFilterFlags((s) => ({ ...s, early: e.target.checked }))} />
								ចេញមុន
							</label>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								<input type="checkbox" checked={filterFlags.forgot} onChange={(e) => setFilterFlags((s) => ({ ...s, forgot: e.target.checked }))} />
								ភ្លេច
							</label>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }} title="Day Work = 0 និងគ្មានវត្តមាន/អវត្តមាន/ច្បាប់">
								<input type="checkbox" checked={filterFlags.notWorking} onChange={(e) => setFilterFlags((s) => ({ ...s, notWorking: e.target.checked }))} />
								សម្រាក
							</label>

							<button
								type="button"
								onClick={() => {
									setSearchText('');
									setFilterFlags({ present: false, absent: false, leave: false, late: false, early: false, forgot: false, notWorking: false });
								}}
								style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, background: '#f3f4f6' }}
							>
								Clear
							</button>
						</div>
					</div>
				</div>

				<div>
					<button onClick={exportExcel} className="border rounded px-3 py-1 bg-green-600 text-white hover:bg-green-700" disabled={exporting || importing}>
						{exporting ? 'Exporting...' : 'នាំចេញ Excel'}
					</button>
				</div>

				<div>
					<button
						onClick={handleDeleteAllByDate}
						className="border rounded px-3 py-1 bg-red-600 text-white hover:bg-red-700"
						title="លុបទិន្នន័យវត្តមាន/ច្បាប់/ស្កេន (ទាំងអស់) សម្រាប់ថ្ងៃដែលបានជ្រើស"
					>
						លុបតាមថ្ងៃ
					</button>
				</div>

				<div>
					<label className="border rounded px-3 py-1 bg-orange-600 text-white cursor-pointer hover:bg-orange-700 inline-block">
						Import Excel
						<input
							type="file"
							accept=".xlsx,.xls"
							style={{ display: 'none' }}
							disabled={importing || exporting}
							onChange={(e) => {
								const f = e.target.files?.[0];
								e.target.value = '';
								if (f) importExcel(f);
							}}
						/>
					</label>
				</div>

				<div className="no-print">
					<button onClick={doPrint} className="border rounded px-3 py-1 bg-gray-600 text-white hover:bg-gray-700">
						ព្រីន
					</button>
				</div>
			</div>

			{/* Data Table */}
			<style>{`
				@media print {
					.no-print { display: none !important; }
					table { font-size: 10px; }
					.page-break { page-break-after: always; }
				}
			`}</style>

			<div
				ref={containerRef}
				style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}
			>
				<div
					className="no-print"
					style={{ padding: 8, borderBottom: '1px solid #e5e7eb', fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
				>
					<div>
						បង្ហាញ: <b>{totalFiltered === 0 ? 0 : startIndex + 1}-{endIndex}</b> / {totalFiltered} (សរុប: {Array.isArray(data) ? data.length : 0})
					</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<span>បង្ហាញម្តង:</span>
						<select
							value={pageSize}
							onChange={(e) => {
								const next = Number(e.target.value) || 10;
								setPageSize(next);
								setPage(1);
							}}
							style={{ padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4 }}
						>
							{PAGE_SIZES.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
						<button
							type="button"
							disabled={safePage <= 1}
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							style={{ padding: '2px 8px', border: '1px solid #ccc', borderRadius: 4, background: safePage <= 1 ? '#f3f4f6' : '#fff' }}
						>
							◀
						</button>
						<div>
							ទំព័រ <b>{safePage}</b> / {totalPages}
						</div>
						<button
							type="button"
							disabled={safePage >= totalPages}
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							style={{ padding: '2px 8px', border: '1px solid #ccc', borderRadius: 4, background: safePage >= totalPages ? '#f3f4f6' : '#fff' }}
						>
							▶
						</button>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<span style={{ fontSize: 12, color: '#6b7280' }}>Grace (ចូល) នាទី:</span>
						<input
							type="number"
							value={graceMinutes}
							onChange={(e) => setGraceMinutes(e.target.value)}
							min={0}
							style={{ width: 80, border: '1px solid #ccc', borderRadius: 4, padding: '2px 6px' }}
						/>
					</div>
					{lastImportStats && (
						<div>
							Excel: <b>{lastImportStats.totalRows}</b> row(s), Imported Staff: <b>{lastImportStats.importedStaff ?? '-'}</b>, Imported Records:{' '}
							<b>{lastImportStats.imported}</b>
							{typeof lastImportStats.skippedRows === 'number' && lastImportStats.skippedRows > 0 ? `, Failed/Skipped: ${lastImportStats.skippedRows}` : ''}
							{lastImportStats.fileName ? ` (${lastImportStats.fileName})` : ''}
							{totalFiltered < (Array.isArray(data) ? data.length : 0) ? ' — មាន Filter/ស្វែងរក កំពុងលាក់ខ្លះៗ' : ''}
						</div>
					)}
					{loading && <div>Loading...</div>}
				</div>

				<table style={{ minWidth: 1200, borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
					<thead>
						<tr style={{ background: '#FFE6E6' }}>
							<th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>
								Staff ID
							</th>
							<th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>
								khmerName
							</th>
							<th colSpan={displayDates.length} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
								{dateFromDate}
							</th>
							<th colSpan={1} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
								Day Work
							</th>
							<th colSpan={1} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
								Attendance
							</th>
							<th colSpan={1} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
								Work Time
							</th>
							<th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
								Clock
							</th>
							<th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
								Checkin Late
							</th>
							<th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
								Checkout Early
							</th>
							<th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
								Checkout Overtime
							</th>
							<th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>
								Absent
							</th>
							<th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>
								Leave
							</th>
							<th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>
								A
							</th>
							<th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>
								Plech
							</th>
							<th rowSpan={2} className="no-print" style={{ border: '1px solid #000', padding: 8 }}>
								Actions
							</th>
						</tr>
						<tr style={{ background: '#FFE6E6' }}>
							{displayDates.map((d) => (
								<th
									key={String(d.getTime())}
									style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}
									title="Check in - Check out"
								>
									<div style={{ fontSize: 10, fontWeight: 700 }}>{d.getDate()}</div>
									<div style={{ fontSize: 9, opacity: 0.8 }}>Check in - Check out</div>
								</th>
							))}
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
							<th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
						</tr>
					</thead>
					<tbody>
						{pageData.map((rec) => {
							const entry = rec.dailyEntry;
							const bg = getDayCellBackground(entry);
							const cellText = entry?.checkIn && entry?.checkOut
								? `${formatHMTo12(entry.checkIn)} - ${formatHMTo12(entry.checkOut)}`
								: (formatHMTo12(entry?.checkIn) || formatHMTo12(entry?.checkOut) || '');

							return (
								<tr key={rec.staffId}>
									<td style={{ border: '1px solid #000', padding: 6, whiteSpace: 'nowrap' }}>{rec.staffId}</td>
									<td style={{ border: '1px solid #000', padding: 6, minWidth: 180 }}>{rec.name}</td>
									<td
										style={{ border: '1px solid #000', padding: 6, textAlign: 'center', background: bg, cursor: 'pointer' }}
										onClick={() => openDayModal(rec)}
										title="Click to edit"
									>
										<div style={{ fontWeight: 600 }}>{cellText}</div>
										{!!(rec.shiftStart || rec.shiftEnd || rec.shiftTitle) && (
											<div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>
												{isDayOffShiftTitle(rec.shiftTitle)
													? 'វេន: Day Off'
													: (() => {
														const schedText = rec.shiftStart && rec.shiftEnd
															? `${formatHMTo12(rec.shiftStart)} - ${formatHMTo12(rec.shiftEnd)}`
															: (formatHMTo12(rec.shiftStart) || formatHMTo12(rec.shiftEnd) || rec.shiftTitle || '');
														return `វេន: ${schedText}`;
													})()}
											</div>
										)}
									</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.dayWorkCount}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.attendanceCount}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatQmHM(rec.workTime)}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatQmHM(rec.clock)}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.clockCount}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatQmHM(rec.checkinLateMinutes)}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.checkinLateCount}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatQmHM(rec.checkoutEarlyMinutes)}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.checkoutEarlyCount}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatQmHM(rec.checkoutOvertimeMinutes)}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.checkoutOvertimeCount}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.absentCount}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.leaveCount}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.A}</td>
									<td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.Plech}</td>
									<td className="no-print" style={{ border: '1px solid #000', padding: 6, textAlign: 'center', whiteSpace: 'nowrap' }}>
										<button className="border rounded px-2 py-1" onClick={() => openDayModal(rec)}>
											Edit
										</button>{' '}
										<button className="border rounded px-2 py-1 bg-red-600 text-white" onClick={() => handleDeleteOne(rec.staffId)}>
											Delete
										</button>
									</td>
								</tr>
							);
						})}
						{pageData.length === 0 && (
							<tr>
								<td colSpan={22} style={{ padding: 12, textAlign: 'center', color: '#6b7280' }}>
									No data
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
