import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import API_BASE from '../config';

export default function ApprovalsPage() {
  const perms = usePermission();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | approved | rejected
  const [targetType, setTargetType] = useState('all'); // all | hr | user
  const [sourceFilter, setSourceFilter] = useState(''); // payload.notes.source
  const [hasAttachments, setHasAttachments] = useState(false);
  const [openUserRequestId, setOpenUserRequestId] = useState(null);
  // Cache snapshots by change request id to preserve diffs & metadata (reason, attachments) after approval
  const [snapshots, setSnapshots] = useState({});
  const didInitFromQueryRef = useRef(false);

  // Init filters from URL query (enables Sidebar shortcuts)
  useEffect(() => {
    if (didInitFromQueryRef.current) return;
    didInitFromQueryRef.current = true;

    try {
      const qTargetType = (searchParams.get('targetType') || '').toLowerCase();
      const qStatus = (searchParams.get('status') || '').toLowerCase();
      const qSource = searchParams.get('source') || '';
      const qHasAttachments = (searchParams.get('hasAttachments') || '').toLowerCase();

      if (qTargetType === 'all' || qTargetType === 'hr' || qTargetType === 'user') setTargetType(qTargetType);
      if (qStatus === 'all' || qStatus === 'pending' || qStatus === 'approved' || qStatus === 'rejected') setStatusFilter(qStatus);
      if (qSource) setSourceFilter(qSource);
      if (qHasAttachments === '1' || qHasAttachments === 'true') setHasAttachments(true);
    } catch {
      // ignore
    }
  }, [searchParams]);

  // Load snapshots from localStorage on mount (so page refresh keeps old view)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('approvalSnapshots');
      if (raw) setSnapshots(JSON.parse(raw));
    } catch {}
  }, []);
  // Persist snapshots on change
  useEffect(() => {
    try {
      localStorage.setItem('approvalSnapshots', JSON.stringify(snapshots));
    } catch {}
  }, [snapshots]);

  // Khmer labels for commonly changed fields
  const khLabels = {
    khmerName: 'ឈ្មោះ',
    name: 'ឡាតាំង',
    gender: 'ភេទ',
    dob: 'ថ្ងៃ ខែ ឆ្នាំ កំណើត',
    birthPlace: 'ទីកន្លែងកំណើត',
    currentPlace: 'អាសយដ្ឋានបច្ចុប្បន្ន',
    position: 'តួនាទី',
    skill: 'មុខជំនាញ',
    civilServantId: 'អត្តលេខមន្ត្រីរាជការ',
  phone: 'ទូរស័ព្ទ',
  email: 'អ៊ីមែល',
  officerType: 'ប្រភេទមន្ត្រី',
  Department_Kh: 'នាយកដ្ឋាន',
  officerId: 'លេខមន្ត្រី',
  cardNumber: 'លេខកាត',
  nid: 'លេខអត្តសញ្ញាណប័ណ្ណ',
  status: 'ស្ថានភាព',
  image: 'រូបភាព',
  joinDate: 'កាលបរិច្ឆេទចូលបម្រើការ',
  bankAccount: 'លេខគណនីធនាគារ',
  degreeLevel: 'កម្រិតសញ្ញាប័ត្រ',
  degree: 'ឯកទេស',
  educationLevel: 'កម្រិតវប្បធម៌',
  maritalStatus: 'ស្ថានភាពគ្រួសារ',
  bloodGroup: 'ក្រុមឈាម',
  };

  const normalizePlaceParts = (v) => {
    const src = v && typeof v === 'object' ? v : {};
    return {
      houseNo: src.houseNo || '',
      road: src.road || '',
      village: src.village || '',
      commune: src.commune || '',
      district: src.district || '',
      province: src.province || '',
    };
  };

  const formatPlaceParts = (parts) => {
    const p = normalizePlaceParts(parts);
    const segments = [
      p.houseNo ? `ផ្ទះលេខ:${p.houseNo}` : '',
      p.road ? `ផ្លូវ:${p.road}` : '',
      p.village ? `ភូមិ:${p.village}` : '',
      p.commune ? `ឃុំ/សង្កាត់:${p.commune}` : '',
      p.district ? `ស្រុក/ខណ្ឌ:${p.district}` : '',
      p.province ? `ខេត្ត/ក្រុង:${p.province}` : '',
    ].filter(Boolean);
    return segments.join(', ');
  };

  const toDisplayUserField = (key, value) => {
    if (value === undefined || value === null || value === '') return '—';
    if (key === 'birthPlaceParts' || key === 'currentPlaceParts') {
      const s = formatPlaceParts(value);
      return s || '—';
    }
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const load = async (silent = false) => {
    if (!perms.canApproveHR) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const params = {};
      if (targetType && targetType !== 'all') params.targetType = targetType;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (hasAttachments) params.hasAttachments = 'true';
      if (sourceFilter) params.source = sourceFilter;
      const { data } = await api.get('/approvals', { params });
      const list = Array.isArray(data) ? data : [];
      // fetch current HR docs for context (old values) only for HR change requests
      const withCtx = targetType === 'user'
        ? list
        : await Promise.all(list.map(async (cr) => {
            if (cr?.targetType !== 'hr') return { ...cr, _hr: null };
            try {
              const { data: hr } = await api.get(`/hr/${cr.targetId}`);
              return { ...cr, _hr: hr };
            } catch {
              return { ...cr, _hr: null };
            }
          }));
      setItems(withCtx);
      // Warm snapshots so diffs/fields remain visible after refresh (for approved or historical items)
      setSnapshots((prev) => {
        const merged = { ...prev };
        for (const cr of withCtx) {
          const existing = merged[cr._id];
          const isObj = existing && typeof existing === 'object' && !Array.isArray(existing);
          const hasHrOld = isObj && 'hrOld' in existing && existing.hrOld;
          const hasPayload = isObj && existing.payload;
          if (!existing || !hasHrOld || !hasPayload) {
            const attachments = (cr?.payload?.attachments || (isObj ? (existing.attachments || []) : [])).filter(Boolean);
            const payload = (isObj ? existing.payload : null) || cr?.payload || null;
            const reason = (isObj ? (existing.reason || '') : '') || ((cr?.reason || cr?.payload?.reason || cr?.payload?.notes?.reason || '') + '').trim();
            merged[cr._id] = {
              hrOld: (isObj && existing.hrOld) || cr._hr || null,
              attachments,
              payload,
              reason,
            };
          }
        }
        return merged;
      });
    } catch (e) {
      if (!silent) setError(e?.response?.data?.message || e?.message || 'បរាជ័យក្នុងការទាញយក');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [perms.canApproveHR, statusFilter, hasAttachments, targetType, sourceFilter]);
  // Auto-refresh silently every 15 seconds
  useEffect(() => {
    if (!perms.canApproveHR) return;
    const id = setInterval(() => load(true), 15000);
    return () => clearInterval(id);
  }, [perms.canApproveHR, statusFilter, hasAttachments, targetType, sourceFilter]);

  // When switching to user requests, default to staff onboarding only.
  useEffect(() => {
    if (targetType === 'user') {
      setSourceFilter((prev) => prev || 'staff_onboarding');
    } else {
      setSourceFilter('');
      setOpenUserRequestId(null);
    }
  }, [targetType]);

  const handleApprove = async (cr) => {
    try {
      // Keep a snapshot of HR and relevant metadata before approving so we can still show the diff & reason afterwards
      const reasonAtApprove = ((cr?.reason || cr?.payload?.reason || cr?.payload?.notes?.reason || '') + '').trim();
      const attachmentsAtApprove = (cr?.payload?.attachments || []).filter(Boolean);
      const payloadAtApprove = cr?.payload || null;
      setSnapshots((prev) => ({
        ...prev,
        [cr._id]: {
          // Backward compatible: if previous snapshot was a plain HR object, keep it as hrOld
          ...(prev[cr._id] && typeof prev[cr._id] === 'object' && !Array.isArray(prev[cr._id]) && 'hrOld' in prev[cr._id]
            ? prev[cr._id]
            : { hrOld: prev[cr._id] && typeof prev[cr._id] === 'object' && !Array.isArray(prev[cr._id]) ? prev[cr._id] : null }),
          hrOld: cr._hr || (prev[cr._id] && prev[cr._id].hrOld) || (prev[cr._id] && typeof prev[cr._id] === 'object' && !Array.isArray(prev[cr._id]) ? prev[cr._id] : null),
          reason: reasonAtApprove || (prev[cr._id] && prev[cr._id].reason) || '',
          attachments: attachmentsAtApprove.length ? attachmentsAtApprove : ((prev[cr._id] && prev[cr._id].attachments) || []),
          payload: payloadAtApprove || (prev[cr._id] && prev[cr._id].payload) || null,
        }
      }));
      // Prefer HR route that applies changes and marks approved
      if (cr.targetType === 'hr') {
        await api.post(`/hr/${cr.targetId}/proposed-changes/${cr._id}/approve`);
      } else {
        await api.post(`/approvals/${cr._id}/approve`);
      }
      await load();
    } catch (e) {
      alert('បរាជ័យក្នុងការអនុម័ត: ' + (e?.response?.data?.message || e?.message));
    }
  };

  const handleReject = async (cr) => {
    const note = prompt('សូមបញ្ចូលមូលហេតុនៃការបដិសេធ (Reason for rejection):');
    if (note === null) return; // cancelled
    try {
      await api.post(`/approvals/${cr._id}/reject`, { reviewerNote: note });
      await load();
    } catch (e) {
      alert('បរាជ័យក្នុងការបដិសេធ: ' + (e?.response?.data?.message || e?.message));
    }
  };

  const userItems = items.filter((cr) => cr?.targetType === 'user');
  const hrItems = items.filter((cr) => cr?.targetType === 'hr');

  const renderUserTable = (list) => (
    <div className="overflow-x-auto bg-white border rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">ល.រ</th>
            <th className="px-3 py-2 text-left">ឈ្មោះ</th>
            <th className="px-3 py-2 text-left">ទូរស័ព្ទ</th>
            <th className="px-3 py-2 text-left">មូលហេតុ</th>
            <th className="px-3 py-2 text-left">ស្ថានភាព</th>
            <th className="px-3 py-2 text-left">ចំណាំ Admin</th>
            <th className="px-3 py-2 text-left">Requested By</th>
            <th className="px-3 py-2 text-left">Requested At</th>
            <th className="px-3 py-2 text-left">ព័ត៌មាន</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((cr, idx) => {
            const snap = snapshots?.[cr._id];
            const fields = (cr?.payload?.fields) || (snap && snap.payload && snap.payload.fields) || {};
            const fullName = fields.fullName || cr?.requestedBy?.fullName || '—';
            const phone = fields.phone || cr?.staffId || cr?.payload?.meta?.staffId || '—';
            const reasonText = ((cr?.reason || (snap && snap.reason) || cr?.payload?.reason || cr?.payload?.notes?.reason || '') + '').trim() || '—';
            const isOpen = openUserRequestId === cr._id;

            const keysToShow = [
              'khmerName', 'name', 'gender', 'dob', 'maritalStatus', 'bloodGroup',
              'birthPlaceParts', 'birthPlace',
              'currentPlaceParts', 'currentPlace',
              'phone', 'email',
              'Department_Kh', 'officerType', 'position', 'skill',
              'degreeLevel', 'degree', 'educationLevel',
              'officerId', 'cardNumber', 'nid', 'bankAccount',
              'joinDate',
            ];
            const detailKeys = keysToShow.filter((k) => typeof fields?.[k] !== 'undefined');

            return (
              <React.Fragment key={cr._id}>
                <tr className="border-t align-top">
                  <td className="px-3 py-2">{idx + 1}</td>
                  <td className="px-3 py-2">{fullName}</td>
                  <td className="px-3 py-2">{phone}</td>
                  <td className="px-3 py-2 whitespace-pre-line">{reasonText}</td>
                  <td className="px-3 py-2">
                    {cr.status === 'approved' && (
                      <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 border border-green-200">អនុម័ត</span>
                    )}
                    {cr.status === 'rejected' && (
                      <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800 border border-red-200">បដិសេធ</span>
                    )}
                    {cr.status === 'pending' && (
                      <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800 border border-yellow-200">រង់ចាំ</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-red-600 font-medium">{cr.reviewerNote || '—'}</td>
                  <td className="px-3 py-2">{cr.requestedBy?.fullName || cr.requestedBy?.email || '—'}</td>
                  <td className="px-3 py-2">{new Date(cr.requestedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="px-2 py-1 rounded border text-xs"
                      onClick={() => setOpenUserRequestId(isOpen ? null : cr._id)}
                    >{isOpen ? 'បិទ' : 'មើល'}</button>
                  </td>
                  <td className="px-3 py-2 flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(cr)}
                      disabled={cr.status !== 'pending'}
                      className={`px-2 py-1 rounded text-white ${cr.status === 'pending' ? 'bg-green-600' : 'bg-gray-400 cursor-not-allowed'}`}
                    >អនុម័ត</button>
                    <button
                      onClick={() => handleReject(cr)}
                      disabled={cr.status !== 'pending'}
                      className={`px-2 py-1 rounded text-white ${cr.status === 'pending' ? 'bg-red-600' : 'bg-gray-400 cursor-not-allowed'}`}
                    >បដិសេធ</button>
                  </td>
                </tr>

                {isOpen && (
                  <tr className="bg-gray-50 border-t">
                    <td className="px-3 py-3" colSpan={9}>
                      {detailKeys.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {detailKeys.map((k) => (
                            <div key={k} className="flex gap-2 text-sm">
                              <div className="w-44 text-gray-700 font-medium">{khLabels[k] || k}</div>
                              <div className="text-gray-900 whitespace-pre-line break-words">{toDisplayUserField(k, fields?.[k])}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">មិនមានទិន្នន័យបន្ថែម</div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderHrTable = (list) => (
    <div className="overflow-x-auto bg-white border rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">ល.រ</th>
            <th className="px-3 py-2 text-left">លេខកាត</th>
            <th className="px-3 py-2 text-left" colSpan={2}>ចំណុចកែប្រែ (ចាស់ → ថ្មី)</th>
            <th className="px-3 py-2 text-left">ឯកសារភ្ជាប់</th>
            <th className="px-3 py-2 text-left">ស្ថានភាព</th>
            <th className="px-3 py-2 text-left">ចំណាំ Admin</th>
            <th className="px-3 py-2 text-left">Requested By</th>
            <th className="px-3 py-2 text-left">Requested At</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((cr, idx) => {
            const snap = snapshots?.[cr._id];
            const oldData = (snap && typeof snap === 'object' && snap !== null && 'hrOld' in snap)
              ? (snap.hrOld || {})
              : (cr?.prev || ((snap && typeof snap === 'object' && snap !== null) ? snap : (cr._hr || {})));
            const fields = (cr?.payload?.fields) || (snap && snap.payload && snap.payload.fields) || {};
            const staffNo = (cr?.staffNo ?? cr?.payload?.meta?.staffNo ?? oldData.no) ?? '—';
            const staffId = (cr?.staffId ?? cr?.payload?.meta?.staffId ?? oldData.staffId) ?? '—';
            const attachments = (cr?.payload?.attachments || (snap && snap.attachments) || []).filter(Boolean);
            const hasPrev = Boolean(cr?.prev) || (snap && typeof snap === 'object' && snap !== null && 'hrOld' in snap);

            // keys to display as differences (exclude dob to avoid format-only diffs)
            const keysToShow = [
              'khmerName','name','gender',
              'birthPlace','currentPlace','position','skill',
              'civilServantId','officerId','cardNumber','nid','status','image',
              'phone','email','officerType','Department_Kh','joinDate','bankAccount'
            ];
            // normalize values for comparison (trim, collapse whitespace, unify digits, simplify ISO dates)
            const toLatinDigits = (s) => s.replace(/[០-៩]/g, (d) => '0123456789'[('០១២៣៤៥៦៧៨៩').indexOf(d)]);
            const norm = (v) => {
              if (v === undefined || v === null) return '';
              if (typeof v === 'string') {
                let s = v.trim();
                s = s.replace(/\s+/g, ' ');
                s = toLatinDigits(s);
                if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (m) {
                  const d = m[1].padStart(2,'0');
                  const mth = m[2].padStart(2,'0');
                  const y = m[3];
                  return `${y}-${mth}-${d}`;
                }
                return s;
              }
              if (v instanceof Date) return String(v.toISOString().slice(0,10));
              if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v);
              return String(v);
            };

            const isUrlLike = (s) => typeof s === 'string' && /^(data:|blob:|https?:|file:)/i.test(s);
            const cleanJoin = (base, p) => {
              const b = String(base || '').replace(/\/+$/, '');
              const q = String(p || '').replace(/^\/+/, '');
              return `${b}/${q}`;
            };
            const resolveImageSrc = (val) => {
              if (!val) return null;
              if (typeof val !== 'string') return null;
              const v = val.trim();
              if (!v) return null;
              if (isUrlLike(v)) return v;
              if (v.startsWith('/uploads')) return cleanJoin(API_BASE, v);
              if (/^(uploads|Uploads)\//.test(v)) return cleanJoin(API_BASE, `/${v}`);
              if (/^public\/(uploads|Uploads)\//.test(v)) return cleanJoin(API_BASE, `/${v.replace(/^public\//,'')}`);
              if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(v)) return cleanJoin(API_BASE, `/uploads/${v}`);
              return null;
            };
            const toDisplay = (v) => {
              if (v === undefined || v === null || v === '') return '—';
              if (v instanceof Date) return v.toISOString().slice(0,10);
              if (typeof v === 'string') return v;
              if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v);
              return String(v);
            };
            const computeDiffSlices = (a, b) => {
              const A = String(a);
              const B = String(b);
              if (A === B) return { aStart: 0, aEnd: 0, bStart: 0, bEnd: 0, equal: true };
              let i = 0;
              const aLen = A.length, bLen = B.length;
              while (i < aLen && i < bLen && A[i] === B[i]) i++;
              let j = 0;
              while (j < aLen - i && j < bLen - i && A[aLen - 1 - j] === B[bLen - 1 - j]) j++;
              return { aStart: i, aEnd: aLen - j, bStart: i, bEnd: bLen - j, equal: false };
            };
            const renderHighlighted = (text, start, end) => {
              const T = String(text);
              if (start === 0 && end === 0) return <>{T}</>;
              return (
                <>
                  {T.slice(0, start)}
                  <strong>{T.slice(start, end)}</strong>
                  {T.slice(end)}
                </>
              );
            };

            const serverKeys = Array.isArray(cr?.changedKeys) && cr.changedKeys.length ? cr.changedKeys : Object.keys(fields);
            const requestedKeys = serverKeys.filter(k => keysToShow.includes(k));
            const changedKeys = hasPrev
              ? requestedKeys.filter(k => norm(fields[k]) !== norm(oldData?.[k]))
              : requestedKeys;

            return (
              <tr key={cr._id} className="border-t align-top">
                <td className="px-3 py-2">{staffNo}</td>
                <td className="px-3 py-2">{staffId}</td>
                <td className="px-3 py-2" colSpan={2}>
                  {changedKeys.length ? (
                    <div className="grid gap-1" style={{gridTemplateColumns: '160px 1fr 24px 1fr'}}>
                      {changedKeys.map((k,i)=> (
                        <React.Fragment key={i}>
                          <div className="text-gray-700 font-medium truncate">{khLabels[k] || k}</div>
                          <div className="rounded px-2 py-1 bg-red-50 text-red-800 border border-red-200 whitespace-pre-line">
                            {k === 'image' ? (
                              (() => {
                                const src = hasPrev ? resolveImageSrc(oldData?.[k]) : null;
                                return src ? (
                                  <a href={src} target="_blank" rel="noreferrer" className="inline-block">
                                    <img src={src} alt="old" className="w-12 h-12 object-cover rounded" />
                                  </a>
                                ) : (
                                  <>{hasPrev ? toDisplay(oldData?.[k] ?? '—') : '—'}</>
                                );
                              })()
                            ) : (
                              (() => {
                                const a = hasPrev ? toDisplay(oldData?.[k]) : '—';
                                const b = toDisplay(fields?.[k]);
                                const { aStart, aEnd, equal } = computeDiffSlices(a, b);
                                return hasPrev ? (equal ? <>{a}</> : renderHighlighted(a, aStart, aEnd)) : <>{a}</>;
                              })()
                            )}
                          </div>
                          <div className="text-center text-gray-500">→</div>
                          <div className="rounded px-2 py-1 bg-green-50 text-green-800 border border-green-200 whitespace-pre-line">
                            {k === 'image' ? (
                              (() => {
                                const src = resolveImageSrc(fields?.[k]);
                                return src ? (
                                  <a href={src} target="_blank" rel="noreferrer" className="inline-block">
                                    <img src={src} alt="new" className="w-12 h-12 object-cover rounded" />
                                  </a>
                                ) : (
                                  <>{toDisplay(fields?.[k] ?? '—')}</>
                                );
                              })()
                            ) : (
                              (() => {
                                const a = toDisplay(oldData?.[k]);
                                const b = toDisplay(fields?.[k]);
                                const { bStart, bEnd, equal } = computeDiffSlices(a, b);
                                return equal ? <>{b}</> : renderHighlighted(b, bStart, bEnd);
                              })()
                            )}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">
                  {attachments.length ? (
                    <div className="flex flex-col gap-1">
                      {attachments.map((a, i) => (
                        <a key={i} href={a.url || a} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                          ឯកសារ {i+1}
                        </a>
                      ))}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">
                  {cr.status === 'approved' && (
                    <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 border border-green-200">អនុម័ត</span>
                  )}
                  {cr.status === 'rejected' && (
                    <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800 border border-red-200">បដិសេធ</span>
                  )}
                  {cr.status === 'pending' && (
                    <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800 border border-yellow-200">រង់ចាំ</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-red-600 font-medium">{cr.reviewerNote || '—'}</td>
                <td className="px-3 py-2">{cr.requestedBy?.fullName || cr.requestedBy?.email || '—'}</td>
                <td className="px-3 py-2">{new Date(cr.requestedAt).toLocaleString()}</td>
                <td className="px-3 py-2 flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(cr)}
                    disabled={cr.status !== 'pending'}
                    className={`px-2 py-1 rounded text-white ${cr.status === 'pending' ? 'bg-green-600' : 'bg-gray-400 cursor-not-allowed'}`}
                  >អនុម័ត</button>
                  <button
                    onClick={() => handleReject(cr)}
                    disabled={cr.status !== 'pending'}
                    className={`px-2 py-1 rounded text-white ${cr.status === 'pending' ? 'bg-red-600' : 'bg-gray-400 cursor-not-allowed'}`}
                  >បដិសេធ</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (!perms.canApproveHR) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900">សំណើអនុម័ត</h2>
        <p className="text-gray-600 mt-2">អ្នកមិនមានសិទ្ធិមើលទំព័រនេះទេ</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">សំណើអនុម័តទិន្នន័យ</h2>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700 flex items-center gap-2">
            ប្រភេទ
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">ទាំងអស់</option>
              <option value="hr">HR</option>
              <option value="user">បុគ្គលិកចុះឈ្មោះ</option>
            </select>
          </label>
          {targetType === 'user' && (
            <label className="text-sm text-gray-700 flex items-center gap-2">
              ប្រភព
              <select
                value={sourceFilter || ''}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="staff_onboarding">បុគ្គលិកចុះឈ្មោះ</option>
                <option value="">ទាំងអស់</option>
              </select>
            </label>
          )}
          <label className="text-sm text-gray-700 flex items-center gap-2">
            ស្ថានភាព
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">ទាំងអស់</option>
              <option value="pending">រង់ចាំ</option>
              <option value="approved">អនុម័ត</option>
              <option value="rejected">បដិសេធ</option>
            </select>
          </label>
          <label className="text-sm text-gray-700 flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasAttachments}
              onChange={(e) => setHasAttachments(e.target.checked)}
            />
            មានឯកសារ
          </label>
          <div className="text-sm text-gray-600">ចំនួន: {items.length}</div>
          <button
            className="px-3 py-1 rounded border text-sm"
            onClick={() => { setStatusFilter('all'); setHasAttachments(false); setTargetType('all'); setSourceFilter(''); load(); }}
          >ស្ដារលំនាំដើម</button>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-red-600 text-sm">{error}</div>
      )}

      {loading ? (
        <div>កំពុងត្រូវទាញយក...</div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-between">
          <div className="text-gray-600">
            {statusFilter !== 'all' || hasAttachments
              ? 'គ្មានទិន្នន័យតាម filter បច្ចុប្បន្ន'
              : 'មិនមានសំណើ'}
          </div>
          {(statusFilter !== 'all' || hasAttachments) && (
            <button
              className="px-3 py-1 rounded border text-sm"
              onClick={() => { setStatusFilter('all'); setHasAttachments(false); setTargetType('all'); setSourceFilter(''); load(); }}
            >ស្ដារលំនាំដើម</button>
          )}
        </div>
      ) : targetType === 'all' ? (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-900">HR</div>
              <div className="text-sm text-gray-600">ចំនួន: {hrItems.length}</div>
            </div>
            {hrItems.length ? renderHrTable(hrItems) : (
              <div className="bg-white border rounded p-4 text-sm text-gray-600">មិនមានសំណើ HR</div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-900">បុគ្គលិកចុះឈ្មោះ</div>
              <div className="text-sm text-gray-600">ចំនួន: {userItems.length}</div>
            </div>
            {userItems.length ? renderUserTable(userItems) : (
              <div className="bg-white border rounded p-4 text-sm text-gray-600">មិនមានសំណើបុគ្គលិកចុះឈ្មោះ</div>
            )}
          </div>
        </div>
      ) : targetType === 'user' ? (
        renderUserTable(items)
      ) : (
        renderHrTable(items)
      )}
    </div>
  );
}
