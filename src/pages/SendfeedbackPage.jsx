import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { updateFileTransfer, getFileTransfer } from '../api/fileTransfer';

export default function SendfeedbackPage() {
    const [stages, setStages] = useState({ s: '', s1: '', s2: '', s3: '', s4: '', s5: '', s6: '' });
    const [sending, setSending] = useState(false);
    const [signaturesError, setSignaturesError] = useState('');
    const [sendingTelegramAll, setSendingTelegramAll] = useState(false);

    // Default role per stage (matches the screenshot mapping)
    const defaultStageRoles = {
        s: 'មន្រ្តីទទួលបន្ទុក',
        s1: 'យោបល់ប្រធានការិយាល័យបច្ចេកទេស',
        s2: 'យោបល់ប្រធានការិយាល័យហិរញ្ញវត្ថុ',
        s3: 'យោបល់ប្រធានការិយាល័យរដ្ឋបាលបុគ្គលិក',
        s4: 'យោបល់នាយករងមន្ទីរពេទ្យ',
        s5: 'យោបល់នាយករងមន្ទីរពេទ្យ',
        s6: 'យោបល់នាយកមន្ទីរពេទ្យ'
    };

    // Start with empty roles — only populated when a signature is selected or an explicit role exists
    const [stageRoles, setStageRoles] = useState({
        s: '',
        s1: '',
        s2: '',
        s3: '',
        s4: '',
        s5: '',
        s6: ''
    });
    // Note: roles are read-only and come from signature.description; no inline editing dropdown
    const [signatures, setSignatures] = useState([]);
    const [users, setUsers] = useState([]);
    const [loadingSignatures, setLoadingSignatures] = useState(false);
    const [record, setRecord] = useState(null);
    const [sendingStage, setSendingStage] = useState(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const recordId = searchParams.get('recordId');
    const presetStage = searchParams.get('stage');
    const selectRefs = useRef({});

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoadingSignatures(true);
            setSignaturesError('');
            try {
                // Load signatures first
                const sigRes = await api.get('/signatures?limit=200');
                console.log('Raw signatures API response:', sigRes);
                const sigItems = sigRes?.data?.signatures || sigRes?.data || [];
                console.log('Loaded signatures:', sigItems);

                if (!Array.isArray(sigItems)) {
                    console.error('Signatures is not an array:', sigItems);
                    setSignaturesError('Invalid signature data format');
                    setSignatures([]);
                    setUsers([]);
                    return;
                }

                const sigList = (sigItems || []).map(s => ({
                    id: s._id || s.id,
                    name: s.fullNameKh || s.fullName || s.name || '',
                    displayName: s.fullNameKh || s.fullName || s.name || '',
                    description: s.description || '',
                    type: 'signature'
                })).filter(x => x.name);

                console.log('Final signature list:', sigList);

                // If there are no SignSchemas, fetch Admin users as a fallback
                if (sigList.length === 0) {
                    try {
                        const adminsRes = await api.get('/users/admins');
                        const adminItems = adminsRes?.data || [];
                        console.log('Loaded admin fallback list:', adminItems);
                        const fallback = (adminItems || []).map(a => ({
                            id: a.id || a._id,
                            name: a.fullName || a.name || a.fullNameKh || '',
                            displayName: a.fullName || a.name || a.fullNameKh || '',
                            description: 'Admin (fallback)',
                            type: 'admin-fallback'
                        })).filter(x => x.name);

                        if (mounted) {
                            setSignatures(fallback);
                            setUsers([]);
                            setSignaturesError('ប្រើបញ្ជី Admin ជាជម្រើសបំណុល (fallback)');
                        }
                    } catch (ae) {
                        console.error('Failed to load admin fallback:', ae);
                        if (mounted) {
                            setSignatures([]);
                            setUsers([]);
                            setSignaturesError('ពុំមានលិខិតហត្ថលេខា និងមិនអាចទាញយក Admin fallback បាន');
                        }
                    }
                } else {
                    // Normal path: also fetch users list only for admin usage (try but ignore failure)
                    let userList = [];
                    try {
                        const userRes = await api.get('/users');
                        const userItems = userRes?.data || [];
                        userList = (userItems || []).map(u => ({ id: u._id || u.id, name: u.fullName || u.name || '' })).filter(x => x.name);
                    } catch (ue) {
                        console.debug('Could not load full users list (likely not admin):', ue?.message || ue);
                    }
                    if (mounted) {
                        setSignatures(sigList);
                        setUsers(userList);
                        setSignaturesError('');
                    }
                }
            } catch (e) {
                console.error('Failed to load signatures or users:', e);
                setSignaturesError(e.message || 'បរាជ័យក្នុងការទាញយកលិខិតហត្ថលេខា');
                if (mounted) {
                    setSignatures([]);
                    setUsers([]);
                }
            } finally {
                if (mounted) setLoadingSignatures(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, []);

    // If signatures loaded later and stages already selected (e.g. when editing a record),
    // try to auto-fill stageRoles from the selected signature's description where applicable.
    useEffect(() => {
        if (!signatures || signatures.length === 0) return;
        // Only update roles for stages that don't have an explicit role chosen
        const keys = ['s', 's1', 's2', 's3', 's4', 's5', 's6'];
        let changed = false;
        const nextRoles = { ...stageRoles };
        keys.forEach(k => {
            const selectedId = stages[k];
            if (!selectedId) return;
            const sig = signatures.find(s => s.id === selectedId);
            if (sig && sig.description) {
                // If current role is empty, prefer signature description
                if (!nextRoles[k] || nextRoles[k] === '') {
                    nextRoles[k] = sig.description;
                    changed = true;
                }
            }
        });
        if (changed) setStageRoles(nextRoles);
    }, [signatures]);

    // If opened with a `stage` query param, focus and scroll that stage's select
    useEffect(() => {
        if (!presetStage) return;
        const t = setTimeout(() => {
            const el = selectRefs.current[presetStage];
            if (el && typeof el.focus === 'function') {
                try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
                el.focus();
            }
        }, 150);
        return () => clearTimeout(t);
    }, [presetStage, signatures]);

    // Predefined role/type options shown in the selects (as in the screenshot)
    const roleOptions = [
        defaultStageRoles.s,
        defaultStageRoles.s1,
        defaultStageRoles.s2,
        defaultStageRoles.s3,
        defaultStageRoles.s4,
        defaultStageRoles.s5,
        defaultStageRoles.s6
    ];

    const handleRoleChange = (key) => (ev) => setStageRoles(r => ({ ...r, [key]: ev.target.value }));

    // If recordId present, load existing feedback data and prefill
    useEffect(() => {
        if (!recordId) return;
        let mounted = true;
        const loadRecord = async () => {
            try {
                const data = await getFileTransfer(recordId);
                if (!mounted) return;
                setRecord(data);
                if (!mounted || !data) return;
                // Try both top-level and meta-stored values (meta is used for arbitrary payloads)
                const stagesFromRecord = data.feedbackStages || data.feedback_stages || (data.meta && data.meta.feedbackStages) || (data.meta && data.meta.feedback_stages) || {};
                const rolesFromRecord = data.feedbackStageRoles || (data.meta && data.meta.feedbackStageRoles) || {};
                // reporter name UI removed; we no longer load or set a reporterName here
                // Populate stages (person ids) and roles. Support legacy values where a stage value may be
                // a string like 'role:...' (saved by earlier UI). In that case move it into roles and clear person.
                const nextStages = {};
                const nextRoles = {};
                ['s', 's1', 's2', 's3', 's4', 's5', 's6'].forEach(k => {
                    const v = stagesFromRecord[k];
                    if (typeof v === 'string' && v.startsWith('role:')) {
                        // legacy format where stage stored a role string instead of a person id
                        nextStages[k] = '';
                        nextRoles[k] = v.slice(5);
                    } else {
                        nextStages[k] = v || '';
                        // prefer explicit saved role but only apply it when a person is selected for the stage
                        if (nextStages[k] && rolesFromRecord && rolesFromRecord[k]) {
                            nextRoles[k] = rolesFromRecord[k];
                        } else {
                            nextRoles[k] = '';
                        }
                    }
                });
                setStages(nextStages);
                setStageRoles(nextRoles);
            } catch (e) {
                console.warn('Failed to load record feedback', e);
            }
        };
        loadRecord();
        return () => { mounted = false; };
    }, [recordId]);

    const handleStageChange = (key) => (ev) => {
        const val = ev.target.value;
        setStages(s => ({ ...s, [key]: val }));

        // If a signature is selected, and it has a description, use it as the stage role
        if (val) {
            const sig = signatures.find(ss => ss.id === val);
            if (sig && sig.description) {
                setStageRoles(r => ({ ...r, [key]: sig.description }));
            }
        } else {
            // when clearing selection, clear any role for that stage
            setStageRoles(r => ({ ...r, [key]: '' }));
        }
    };
    const handleSend = async () => {
        if (sending) return;
        setSending(true);
        try {
            if (recordId) {
                // Merge into existing meta so we don't overwrite other metadata
                const existing = await getFileTransfer(recordId);
                const existingMeta = (existing && existing.meta) ? existing.meta : {};
                // Derive a human-friendly sender name to persist for replay/print views.
                const firstKey = ['s', 's1', 's2', 's3', 's4', 's5', 's6'].find(k => stages[k]);
                let feedbackSenderName = existingMeta && (existingMeta.feedbackSenderName || existingMeta.senderName) ? (existingMeta.feedbackSenderName || existingMeta.senderName) : '';
                if (firstKey) {
                    const selId = stages[firstKey];
                    const selSig = signatures.find(s => s.id === selId);
                    if (selSig) feedbackSenderName = selSig.displayName || selSig.name || feedbackSenderName;
                    else {
                        const selUsr = users.find(u => u.id === selId);
                        if (selUsr) feedbackSenderName = selUsr.name || feedbackSenderName;
                    }
                }
                const newMeta = { ...existingMeta, feedbackStages: stages, feedbackStageRoles: stageRoles, feedbackSenderName };
                await updateFileTransfer(recordId, { meta: newMeta });

                // ⚠️ CHECK: Only send notifications if document has files attached
                const hasFiles = existing && (
                    (existing.files && existing.files.length > 0) ||
                    (existing.attachments && existing.attachments.length > 0)
                );

                if (!hasFiles) {
                    alert('⚠️ បានរក្សាទុកមតិ ប៉ុន្តែមិនផ្ញើការជូនដំណឹងទេ ព្រោះមិនទាន់មានឯកសារភ្ជាប់');
                    navigate(-1);
                    return;
                }

                // After saving, send notification to each selected signature (if any)
                try {
                    const keys = ['s', 's1', 's2', 's3', 's4', 's5', 's6'];
                    let sentCount = 0;

                    // Prepare document info for notification message
                    const docDate = existing?.date || existing?.created_at;
                    const dateStr = docDate
                        ? new Date(docDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })
                        : 'មិនបានកំណត់';

                    // Prefer an explicit entry time field when available (various possible field names),
                    // otherwise fall back to the document datetime.
                    const entryTimeRaw = existing?.entryTime || existing?.entry_time || existing?.entry_time_display || existing?.entryTimeString || existing?.entry_time_string;
                    let timeStr;
                    if (entryTimeRaw) {
                        try {
                            // If it's a simple time string like "13:45" or "1:45 PM", use it directly.
                            if (typeof entryTimeRaw === 'string') {
                                timeStr = entryTimeRaw;
                            } else {
                                const parsed = new Date(entryTimeRaw);
                                timeStr = !isNaN(parsed.getTime())
                                    ? parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                                    : String(entryTimeRaw);
                            }
                        } catch (e) {
                            timeStr = String(entryTimeRaw);
                        }
                    } else {
                        timeStr = docDate
                            ? new Date(docDate).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            })
                            : 'មិនបានកំណត់';
                    }

                    // Build comprehensive document info
                    const letterNo = existing?.letterNo || existing?.letter_no || '';
                    const source = existing?.source || existing?.origin || '';
                    const docContent = existing?.content || existing?.description || '';

                    // Get feedback date (current date when sending)
                    const feedbackDate = new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    const feedbackTime = new Date().toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });

                    // Get existing feedback from meta (វគ្គមុនៗដែលមានមតិរួច)
                    const existingFeedback = {};
                    const existingFeedbackNames = {};
                    const existingFeedbackDates = {};
                    const metaMapping = {
                        's': 'CourseNote',
                        's1': 'Course1Note',
                        's2': 'Course2Note',
                        's3': 'Course3Note',
                        's4': 'Course4Note',
                        's5': 'Course5Note',
                        's6': 'Course6Note'
                    };
                    const dateMapping = {
                        's': 'CourseDate',
                        's1': 'Course1Date',
                        's2': 'Course2Date',
                        's3': 'Course3Date',
                        's4': 'Course4Date',
                        's5': 'Course5Date',
                        's6': 'Course6Date'
                    };

                    keys.forEach(k => {
                        const metaKey = metaMapping[k];
                        if (metaKey && existing?.meta?.[metaKey]) {
                            existingFeedback[k] = existing.meta[metaKey];

                            // Get the name of who provided this feedback
                            const stageSignatureId = existing?.meta?.feedbackStages?.[k];
                            if (stageSignatureId) {
                                const sig = signatures.find(s => s.id === stageSignatureId);
                                if (sig) {
                                    existingFeedbackNames[k] = sig.name;
                                } else {
                                    // Try to match with users
                                    const usr = users.find(u => u.id === stageSignatureId);
                                    if (usr) existingFeedbackNames[k] = usr.name;
                                }
                            }

                            // Get the date of this feedback
                            const dateKey = dateMapping[k];
                            if (dateKey && existing?.meta?.[dateKey]) {
                                const feedbackDate = new Date(existing.meta[dateKey]);
                                existingFeedbackDates[k] = feedbackDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                }) + ' ' + feedbackDate.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                });
                            }
                        }
                    });

                    // Only notify the first selected stage initially. Subsequent stages are notified
                    // by the webhook when a reply/feedback is received for the previous stage.
                    // Prefer the first selected stage that does NOT already have feedback
                    const firstKey = keys.find(k => stages[k] && !existingFeedback[k]) || keys.find(k => stages[k]);
                    const calls = [];
                    if (firstKey) {
                        const k = firstKey;
                        const selectedId = stages[k];
                        // Find the selected signature
                        const selectedSignature = signatures.find(s => s.id === selectedId);
                        if (selectedSignature) {
                            const matchingUser = users.find(u =>
                                u.name.toLowerCase().includes(selectedSignature.name.toLowerCase()) ||
                                selectedSignature.name.toLowerCase().includes(u.name.toLowerCase())
                            );
                            const targetId = matchingUser ? matchingUser.id : selectedId;
                            const personName = matchingUser ? matchingUser.name : selectedSignature.name;

                            const stageLabels = {
                                's': 'មន្ត្រីទទួលបន្ទុក',
                                's1': 'ប្រធានការិយាល័យ',
                                's2': 'អនុប្រធានការិយាល័យ',
                                's3': 'ប្រធាននាយកដ្ឋាន',
                                's4': 'អនុប្រធាននាយកដ្ឋាន',
                                's5': 'នាយក',
                                's6': 'អនុនាយក'
                            };
                            const stageLabel = stageLabels[k] || stageRoles[k] || k;

                            const hasFeedback = existingFeedback[k];

                            const title = `📄 មានឯកសាររង់ចាំការមានមតិយោប់`;
                            let message = `🔢 <b>លេខលិខិត ៖ </b>${letterNo || ''}\n`;
                            message += `📂 <b>ប្រភពឯកសារ ៖ </b>${source || ''}\n`;
                            message += `📝 <b>កម្មវត្ថុ ៖ </b>${docContent || ''}\n`;
                            message += `📅 <b>ថ្ងៃខែឆ្នាំផ្ញើមតិ ៖ </b>${feedbackDate}\n`;
                            message += `👤 <b>អ្នកទទួល ៖ </b>${personName}\n`;
                            if (hasFeedback) {
                                message += `មតិ ៖ <b>✅ មានមតិរួច</b>\n`;
                                message += `📝 "${hasFeedback}"\n`;
                            } else {
                                message += `មតិ ៖ <b>មិនទាន់ reply មតិបាន</b>\n`;
                            }

                            if (Object.keys(existingFeedback).length > 0) {
                                message += `\n`;
                                message += `📋 <b>មតិវគ្គមុនៗ</b>\n`;
                                message += `\n───────────────\n`;
                                let feedbackIndex = 0;
                                keys.forEach(prevK => {
                                    if (existingFeedback[prevK]) {
                                        const prevName = existingFeedbackNames[prevK] || (stageLabels[prevK] || prevK);
                                        const prevDate = existingFeedbackDates[prevK] || '';
                                        message += `👤<b>ឈ្មោះ ៖</b> ${prevName}\n`;
                                        message += `📝 <b>មតិ ៖</b> ${existingFeedback[prevK]}\n`;
                                        if (prevDate) message += `📅 <b>កាលបរិច្ឆេទ ៖</b> ${prevDate}\n`;
                                        feedbackIndex++;
                                        if (feedbackIndex < Object.keys(existingFeedback).length) message += `───────────────\n`;
                                    }
                                });
                                message += `\n───────────────`;
                            }
                            message += `\n`;
                            // Include the record identifier so replies can be matched to this record
                            if (recordId) {
                                message += `🆔 <b>លេខកត់ត្រា ៖ </b>${recordId}\n`;
                            }
                            message += `📅 <b>ចូលថ្ងៃទី ៖ </b>${dateStr}\n`;
                            message += `⏰ <b>ម៉ោង ៖ </b>${timeStr}\n`;

                            message += `💬 <i>សូមចុច Reply នៅលើសារនេះដើម្បីផ្ញើមតិ</i>`;

                            const link = (typeof window !== 'undefined' && recordId)
                                ? window.location.origin + `/replay-file?recordId=${encodeURIComponent(recordId)}`
                                : undefined;

                            calls.push(
                                api.post('/notifications/send-stage', {
                                    signatureId: targetId,
                                    stageKey: stageRoles[k] || k,
                                    recordId,
                                    title,
                                    message,
                                    link,
                                }).then(r => { sentCount++; return { ok: true, res: r.data }; }).catch(e => ({ ok: false, err: e }))
                            );
                        }
                    }

                    const results = await Promise.allSettled(calls);
                    // don't fail on notification errors; just log them
                    console.debug('notification results', results);

                    // Provide feedback about how many notifications were sent
                    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
                    if (successCount > 0) {
                        alert(`✅ បានរក្សាទុកមតិ និងផ្ញើការជូនដំណឹងទៅកាន់ ${successCount} នាក់`);
                    } else {
                        alert('✅ បានរក្សាទុកមតិសម្រាប់កំណត់ត្រា');
                    }
                } catch (e) {
                    console.warn('Failed sending notifications', e);
                    alert('⚠️ បានរក្សាទុកមតិ ប៉ុន្តែមិនអាចផ្ញើការជូនដំណឹងបាន');
                }

                navigate(-1);
                return;
            }
            // fallback: save to localStorage
            const payload = { feedbackStages: stages, feedbackStageRoles: stageRoles };
            const key = 'sendfeedback:draft:' + Date.now();
            localStorage.setItem(key, JSON.stringify({ payload, createdAt: new Date().toISOString() }));
            alert('រក្សាទុកក្នុងទំព័រនៅក្នុងកម្មវិធី (local)');
            navigate(-1);
        } catch (err) {
            console.error('Failed to save feedback', err);
            alert('❌ មិនអាចរក្សាទុកបាន — ព្យាយាមម្តងទៀត');
        } finally {
            setSending(false);
        }
    };

    // Send a specific saved stage note to Telegram
    const sendStageToTelegram = async (stageKey) => {
        if (!recordId) return;
        if (!window.confirm('តើអ្នកចង់ផ្ញើមតិនេះទៅ Telegram ទេ?')) return;
        try {
            setSendingStage(stageKey);
            const res = await api.post(`/file-transfers/${recordId}/send-telegram`, { stageKey });
            if (res && res.data && res.data.success) {
                const chat = res?.data?.chat;
                const prettySource = (s) => {
                    const v = String(s || '');
                    if (!v) return '';
                    if (v === 'assignee') return 'ទៅអ្នកទទួលវគ្គ (assignee)';
                    if (v === 'legacy') return 'ទៅ chat ទូទៅ (legacy config)';
                    if (v === 'override') return 'ទៅ chat override';
                    return v;
                };
                const extra = chat ? `\n\n📍 ផ្ញើ៖ ${prettySource(chat.source)}${chat.botNumber ? ` (bot${chat.botNumber})` : ''}${chat.field ? ` — ${chat.field}` : ''}` : '';
                alert(`✅ បានផ្ញើមតិទៅ Telegram${extra}`);
                // refresh record to show new telegramSends meta
                const refreshed = await getFileTransfer(recordId);
                setRecord(refreshed);
            } else {
                console.warn('send result', res);
                alert('⚠️ ផ្ញើបរាជ័យ — ពិនិត្យ console សម្រាប់ព័ត៌មានបន្ថែម');
            }
        } catch (e) {
            console.error('Failed to send stage to telegram', e);
            alert('❌ មិនអាចផ្ញើបាន — ព្យាយាមម្តងទៀត');
        } finally {
            setSendingStage(null);
        }
    };

    const sendSelectedStagesToTelegram = async () => {
        if (!recordId) return;

        const stageOrder = ['s', 's1', 's2', 's3', 's4', 's5', 's6'];
        const metaMapping = {
            s: 'CourseNote',
            s1: 'Course1Note',
            s2: 'Course2Note',
            s3: 'Course3Note',
            s4: 'Course4Note',
            s5: 'Course5Note',
            s6: 'Course6Note',
        };
        const stageLabels = {
            s: 'វគ្គ',
            s1: 'វគ្គ ១',
            s2: 'វគ្គ ២',
            s3: 'វគ្គ ៣',
            s4: 'វគ្គ ៤',
            s5: 'វគ្គ ៥',
            s6: 'វគ្គ ៦',
        };

        // Ensure we have a fresh record snapshot
        let current = record;
        if (!current || String(current._id || current.id || '') !== String(recordId)) {
            try {
                current = await getFileTransfer(recordId);
                setRecord(current);
            } catch (e) {
                console.error('Failed to refresh record', e);
            }
        }

        const feedbackStages = (current && current.meta && current.meta.feedbackStages) ? current.meta.feedbackStages : {};
        const stageKeysWithFeedback = stageOrder.filter(k => {
            const mk = metaMapping[k];
            const note = mk ? (current?.meta?.[mk] ?? '') : '';
            return String(note).trim().length > 0;
        });

        const stageKeysToSend = stageKeysWithFeedback.filter(k => !!feedbackStages?.[k]);
        const missingAssignee = stageKeysWithFeedback.filter(k => !feedbackStages?.[k]);

        if (stageKeysWithFeedback.length === 0) {
            alert('⚠️ មិនទាន់មានមតិ (reply) នៅក្នុងវគ្គណាមួយទេ — សូមរង់ចាំឲ្យមានមតិជាមុន');
            return;
        }
        if (stageKeysToSend.length === 0) {
            alert('⚠️ មានមតិរួច ប៉ុន្តែមិនមានអ្នកទទួល (feedbackStages) សម្រាប់វគ្គនោះទេ');
            return;
        }

        const confirmText = `តើអ្នកចង់ផ្ញើ REPORT PDF ទៅ Telegram សម្រាប់ ${stageKeysToSend.length} វគ្គទេ?` +
            (missingAssignee.length ? `\n\nវគ្គដែលគ្មានអ្នកទទួល នឹងរំលង៖ ${missingAssignee.join(', ')}` : '');
        if (!window.confirm(confirmText)) return;

        try {
            setSendingTelegramAll(true);
            setSendingStage('');

            // Generate PDF on the backend (more reliable than client-side capture)
            const fontSize = 14;
            const lineHeight = 1.6;

            const fd = new FormData();
            fd.append('stageKeys', JSON.stringify(stageKeysToSend));
            fd.append('generate', 'server');
            fd.append('template', 'replay');
            fd.append('fontSize', String(fontSize));
            fd.append('lineHeight', String(lineHeight));

            const res = await api.post(`/file-transfers/${recordId}/send-telegram-report`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });

            const okCount = res?.data?.okCount ?? 0;
            const total = res?.data?.total ?? stageKeysToSend.length;
            const failedRows = Array.isArray(res?.data?.results) ? res.data.results.filter(r => !r.ok) : [];
            const failed = failedRows.map(r => r.stageKey);

            const okRows = Array.isArray(res?.data?.results) ? res.data.results.filter(r => r.ok) : [];
            const prettyVia = (field) => {
                const f = String(field || '');
                if (!f) return '';
                if (f === 'replyStage.chatId') return 'តាម Reply Telegram (fallback)';
                if (f === 'telegramChatId') return 'Telegram Chat ID (Bot1)';
                if (f === 'telegramChatId2') return 'Telegram Chat ID (Bot2)';
                if (f === 'telegramId') return 'Telegram ID (legacy)';
                return f;
            };
            const okDetails = okRows.map(r => {
                const label = stageLabels[r.stageKey] || r.stageKey;
                const via = r?.field ? ` — ${prettyVia(r.field)}` : '';
                const bot = r?.botNumber ? ` (bot${r.botNumber})` : '';
                return `${label}${bot}${via}`;
            });

            const failDetails = failedRows.map(r => {
                const reason = r?.reason || 'failed';
                const desc = r?.result?.description || r?.result?.message || r?.details || '';
                const code = r?.result?.error_code ? ` (code ${r.result.error_code})` : '';
                const extra = desc ? ` — ${desc}` : '';
                const label = stageLabels[r.stageKey] || r.stageKey;
                return `${label}: ${reason}${code}${extra}`;
            });

            if (failed.length === 0) {
                const stagesText = okDetails.length ? `\n\nវគ្គដែលបានផ្ញើ៖\n${okDetails.join('\n')}` : '';
                alert(`✅ បានផ្ញើ REPORT PDF ទៅ Telegram រួចរាល់ (${okCount}/${total})${stagesText}`);
            } else {
                const detailText = failDetails.length ? `\n\nDetails:\n${failDetails.join('\n')}` : '';
                const okText = okDetails.length ? `\n\nបានផ្ញើបាន៖\n${okDetails.join('\n')}` : '';
                alert(`⚠️ ផ្ញើ REPORT PDF ទៅ Telegram (${okCount}/${total}) — បរាជ័យ: ${failed.map(k => stageLabels[k] || k).join(', ')}${okText}${detailText}`);
            }
        } catch (e) {
            console.error('Failed to send report PDF to telegram', e);
            const status = e?.response?.status;
            const data = e?.response?.data;
            const detail = (data && (data.error || data.message || data.details)) ? JSON.stringify(data) : (e?.message || 'unknown');
            alert(`❌ មិនអាចផ្ញើ REPORT PDF ទៅ Telegram បាន${status ? ` (HTTP ${status})` : ''}\n${detail}`);
        } finally {
            setSendingStage(null);
            setSendingTelegramAll(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header Section & Action Buttons (Merged) */}
                <div className="sticky top-4 z-30 mb-8 bg-white/90 backdrop-blur-md p-4 rounded-3xl border border-white shadow-xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-[14px] font-bold text-slate-800">ផ្ញើមតិ និង រាយការណ៍</h2>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-16">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-5 py-2 bg-rose-500 text-white text-[14px] font-bold hover:bg-rose-600 rounded-2xl shadow-lg shadow-rose-100 transition-all flex items-center gap-2"
                            disabled={sending || sendingTelegramAll}
                        >
                            ចាកចេញ
                        </button>

                        <button
                            onClick={sendSelectedStagesToTelegram}
                            className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-[14px] font-bold rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center gap-2"
                            disabled={sending || sendingTelegramAll || !recordId}
                        >
                            {sendingTelegramAll ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'ផ្ញើ Report PDF'}
                        </button>

                        <button
                            onClick={handleSend}
                            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-violet-700 text-white text-[14px] font-bold rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center gap-2"
                            disabled={sending || sendingTelegramAll}
                        >
                            {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'ផ្ញើមតិ'}
                        </button>
                    </div>
                </div>



                {/* Error Display */}
                {signaturesError && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 items-center animate-pulse">
                        <div className="text-rose-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-rose-800">{signaturesError}</p>
                        </div>
                    </div>
                )}

                {/* Stages Grid */}
                <div className="grid gap-4 mb-8">
                    {[
                        { 
                            key: 's', 
                            color: 'bg-slate-400', 
                            icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            ), 
                            label: 'វគ្គ ការិយាល័យរដ្ឋបាលបុគ្គលិក និងបុគ្គលិក' 
                        },
                        { 
                            key: 's1', 
                            color: 'bg-violet-500', 
                            icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            ), 
                            label: 'វគ្គ១ មន្រ្តីការិយាល័យ/ផ្នែក' 
                        },
                        { 
                            key: 's2', 
                            color: 'bg-blue-500', 
                            icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            ), 
                            label: 'វគ្គ២ (ការិយាល័យបច្ចេកទេស)' 
                        },
                        { 
                            key: 's3', 
                            color: 'bg-amber-500', 
                            icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            ), 
                            label: 'វគ្គ៣ (ការិយាល័យហិរញ្ញវត្ថុ)' 
                        },
                        { 
                            key: 's4', 
                            color: 'bg-emerald-500', 
                            icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ), 
                            label: 'វគ្គ៤ (នាយករងមន្ទីរពេទ្យ ឆ្វេង)' 
                        },
                        { 
                            key: 's5', 
                            color: 'bg-teal-500', 
                            icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            ), 
                            label: 'វគ្គ៥ (នាយករងមន្ទីរពេទ្យ ស្ដាំ)' 
                        },
                        { 
                            key: 's6', 
                            color: 'bg-sky-500', 
                            icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                            ), 
                            label: 'វគ្គ៦ (លោកនាយកមន្ទីរពេទ្យ)' 
                        },
                    ].map((st) => (
                        <div
                            key={st.key}
                            className={`group relative rounded-2xl border transition-all duration-300 ${stages[st.key]
                                ? 'overflow-visible bg-gradient-to-r from-indigo-50 via-white to-white border-indigo-300 shadow-lg shadow-indigo-100 translate-x-1 ring-1 ring-indigo-200'
                                : 'overflow-hidden bg-white border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md'
                                }`}
                        >
                            {/* Running Border Trace Effect */}
                            {stages[st.key] && (
                                <div className="absolute inset-0 pointer-events-none z-10 overflow-visible">
                                    <svg className="absolute inset-[-2px] w-[calc(100%+4px)] h-[calc(100%+4px)] overflow-visible">
                                        <rect
                                            x="0" y="0"
                                            width="100%" height="100%"
                                            rx="16" ry="16"
                                            className="fill-none stroke-indigo-500 stroke-[3px]"
                                            style={{
                                                strokeDasharray: '1000 200',
                                                strokeLinecap: 'round',
                                                animation: 'border-trace 4s linear infinite',
                                                filter: 'drop-shadow(0 0 2px #6366f1)'
                                            }}
                                        />
                                    </svg>
                                </div>
                            )}
                            <div className="flex items-stretch min-h-[90px]">
                                {/* Side Stripe */}
                                <div className={`w-1.5 ${stages[st.key] ? 'bg-indigo-600' : st.color}`}></div>

                                <div className="flex-1 p-4 flex flex-col md:flex-row md:items-center gap-4">
                                    {/* Icon & Label */}
                                    <div className="flex items-center gap-3 md:w-80 shrink-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm transition-all duration-300 ${stages[st.key] ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-110' : 'bg-slate-50 text-slate-400'
                                            }`}>
                                            {st.icon}
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-bold ${stages[st.key] ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                {st.label}
                                            </h4>
                                            {stages[st.key] && (
                                                <span className="text-[10px] uppercase tracking-wider text-indigo-500 font-bold">បានជ្រើសរើស</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selectors */}
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="relative">
                                            <select
                                                ref={el => selectRefs.current[st.key] = el}
                                                value={stages[st.key]}
                                                onChange={handleStageChange(st.key)}
                                                className={`w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${stages[st.key] ? 'border-indigo-100 bg-white' : ''
                                                    }`}
                                            >
                                                <option value="">-- ជ្រើសរើសឈ្មោះ --</option>
                                                {loadingSignatures ? (
                                                    <option>កំពុងទាញយកទិន្នន័យ...</option>
                                                ) : (
                                                    signatures.map(s => (
                                                        <option key={s.id} value={s.id}>{s.displayName}</option>
                                                    ))
                                                )}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>

                                        <div className={`flex items-center px-4 py-2.5 rounded-xl border text-sm transition-all ${stages[st.key]
                                            ? 'bg-indigo-50/30 border-indigo-100 text-indigo-700 font-medium'
                                            : 'bg-slate-50 border-slate-100 text-slate-400'
                                            }`}>
                                            <span className="truncate">
                                                {stages[st.key] ? (stageRoles[st.key] || 'អ្នកទទួលបន្ទុក') : 'រង់ចាំការជ្រើសរើស'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
