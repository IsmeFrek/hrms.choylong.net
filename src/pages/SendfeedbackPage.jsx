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
    const keys = ['s','s1','s2','s3','s4','s5','s6'];
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
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
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
        ['s','s1','s2','s3','s4','s5','s6'].forEach(k => {
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
        const firstKey = ['s','s1','s2','s3','s4','s5','s6'].find(k => stages[k]);
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
          const keys = ['s','s1','s2','s3','s4','s5','s6'];
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
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-3">📬 ផ្ញើមតិ/រាយការណ៍</h2>
      
      {/* Info Box */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded flex gap-2">
        <div className="text-2xl">💡</div>
        <div className="flex-1">
          <p className="text-sm font-medium mb-1">ជ្រើសរើសអ្នកទទួលមតិនៅក្នុងវគ្គនីមួយៗ</p>
          <p className="text-xs text-gray-700">
            ប្រព័ន្ធនឹងផ្ញើការជូនដំណឹងទៅកាន់អ្នកដែលបានជ្រើសរើស ដើម្បីឲ្យគាត់ដឹងថា មានឯកសាររង់ចាំការពិនិត្យ
          </p>
        </div>
      </div>
      
      {/* Error Display */}
      {signaturesError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded flex gap-2">
          <div className="text-2xl">⚠️</div>
          <div className="flex-1">
            <p className="text-sm text-red-700">{signaturesError}</p>
            <p className="text-xs text-red-600 mt-1">ចូលទៅ SignSchemas ដើម្បីបង្កើតលិខិតហត្ថលេខាថ្មី</p>
          </div>
        </div>
      )}
      
      <div className="mb-4"></div>
      <div className="space-y-3">
        {[
          { key: 's', bg: 'bg-gray-200', icon: '🔍', label: 'វគ្គ  - មន្រ្តី' },
          { key: 's1', bg: 'bg-purple-200', icon: '🏷️', label: 'វគ្គ ១ - ការិយាល័យ' },
          { key: 's2', bg: 'bg-blue-200', icon: '📘', label: 'វគ្គ ២ - ការិយាល័យ' },
          { key: 's3', bg: 'bg-yellow-200', icon: '🟨', label: 'វគ្គ ៣ - ការិយាល័យ' },
          { key: 's4', bg: 'bg-green-200', icon: '✅', label: 'វគ្គ ៤ - ឆ្វេង' },
          { key: 's5', bg: 'bg-green-200', icon: '🟩', label: 'វគ្គ ៥ - ស្ដាំ' },
          { key: 's6', bg: 'bg-blue-100', icon: '🟦', label: 'វគ្គ ៦ - នាយក' },
          
        ].map((st) => (
          <div key={st.key} className={`border rounded ${st.bg} p-3 ${stages[st.key] ? 'ring-2 ring-green-500' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded flex items-center justify-center text-xl">{st.icon}</div>
              <div className="flex-1">
                <div className="text-sm font-medium mb-1 flex items-center justify-between">
                  <span>{st.label}</span>
                  {stages[st.key] && <span className="text-green-600 text-xs">✓ បានជ្រើសរើស</span>}
                </div>
                <div className="flex gap-2">
                  {/* Signature Selection */}
                  <select ref={el => selectRefs.current[st.key] = el} value={stages[st.key]} onChange={handleStageChange(st.key)} className={`w-1/2 border rounded px-2 py-2 ${presetStage === st.key ? 'ring-2 ring-indigo-500' : ''}`}>
                    <option value="">-- ជ្រើសឈ្មោះ --</option>
                    {loadingSignatures ? (
                      <option>កំពុងទាញ...</option>
                    ) : signatures.length === 0 ? (
                      <option disabled>មិនមានលិខិតហត្ថលេខាទេ</option>
                    ) : (
                      signatures.map(s => (
                        <option key={s.id} value={s.id}>{s.displayName}</option>
                      ))
                    )}
                  </select>
                  
                  {/* Role display: placeholder when no signature selected, otherwise read-only description */}
                  {(() => {
                    const selectedSig = signatures.find(s => s.id === stages[st.key]);
                    const sigDesc = selectedSig && selectedSig.description ? selectedSig.description : '';

                    if (!selectedSig) {
                      return (
                        <div className="w-1/2 px-3 py-2 border rounded bg-white text-gray-500">រង់ចាំការជ្រើសរើសឈ្មោះ</div>
                      );
                    }

                    return (
                      <div className="w-1/2 px-3 py-2 border rounded bg-white text-gray-700">
                        <div className="truncate">{stageRoles[st.key] || sigDesc}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)} 
          className="px-4 py-2 border rounded hover:bg-gray-100"
          disabled={sending || sendingTelegramAll}
        >
          ចាកចេញ
        </button>

        <button
          onClick={sendSelectedStagesToTelegram}
          className="px-5 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          disabled={sending || sendingTelegramAll || !recordId}
          title="ផ្ញើទៅ Telegram សម្រាប់វគ្គដែលបានជ្រើសរើស"
        >
          {sendingTelegramAll ? (
            <>
              <span className="inline-block animate-spin">⏳</span>
              កំពុងផ្ញើ REPORT... {sendingStage ? `(${sendingStage})` : ''}
            </>
          ) : (
            <>
              <span>✈️</span>
              ផ្ញើ REPORT PDF ទៅ Telegram
            </>
          )}
        </button>

        <button 
          onClick={handleSend} 
          className="px-5 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          disabled={sending || sendingTelegramAll}
        >
          {sending ? (
            <>
              <span className="inline-block animate-spin">⏳</span>
              កំពុងផ្ញើ...
            </>
          ) : (
            <>
              <span>📨</span>
              ផ្ញើមតិ
            </>
          )}
        </button>
      </div>
    </div>
  );
}
