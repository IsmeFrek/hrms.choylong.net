import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { skillAPI } from '../services/skillAPI';

// Summarize HRs by skill _id, joining with skills collection
function summarizeBySkill(hrList, skills) {
  // Map skills by name for lookup
  const skillNameToObj = {};
  skills.forEach(skill => {
    skillNameToObj[skill.skills_Kh] = skill;
  });
  // Build summary by skills_Id order
  const summaryArr = skills.map(skill => {
    const skillName = skill.skills_Kh;
    const counts = { male: 0, female: 0, other: 0 };
    hrList.forEach(hr => {
      if (hr.skill === skillName) {
        if (hr.gender === 'Male') counts.male++;
        else if (hr.gender === 'Female') counts.female++;
        else counts.other++;
      }
    });
    return {
      skills_Id: skill.skills_Id,
      skills_Kh: skill.skills_Kh,
      skills_En: skill.skills_En,
      other: skill.other,
      total: counts.male + counts.female + counts.other,
      male: counts.male,
      female: counts.female,
      otherCount: counts.other
    };
  });
  return summaryArr;
}


export default function HRSkillSummaryPage() {
  const reportRef = useRef(null);
  const [hrList, setHRList] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [reportType, setReportType] = useState('both'); // 'summary', 'byType', 'both'

  // Print selection options: choose which sections and which columns to include
  const [printInclude, setPrintInclude] = useState({ summary: true, byType: true, groups: false });
  const [printColumnsSummary, setPrintColumnsSummary] = useState({ total: true, male: true, female: true, other: true });
  const [printColumnsByType, setPrintColumnsByType] = useState({ total: true, civil: true, contract: true, other: true });
  // Header checkboxes state: allow user to toggle columns directly in the table header
  const [headerColumnChecks, setHeaderColumnChecks] = useState({
    index: true,
    // skill-related keys: summary vs grouped variants
    skill_summary: true,
    skill_group_tech: true,
    skill_group_plain: true,
    total: true,
    male: true,
    // female for summary table
    female: true,
    other: true,
    // grouped/by-type distinct female columns
    female_overall: true,
    female_civil: true,
    female_contract: true,
    civil: true,
    contract: true
  });

  function toggleHeaderColumn(key, allowMulti = false) {
    setHeaderColumnChecks(prev => {
      const next = { ...prev };
      const becoming = !prev[key];
      // toggle the target
      next[key] = !prev[key];
      try {
        // If this is a skill-related key and multi-select is NOT requested,
        // make the skill group mutually exclusive: when setting one skill_* key true,
        // set other skill_* keys false.
        if (!allowMulti && key.startsWith('skill')) {
          const skillKeys = Object.keys(prev).filter(k => k.startsWith('skill'));
          if (becoming) {
            skillKeys.forEach(k => { if (k !== key) next[k] = false; });
          }
        }
      } catch (e) { /* ignore */ }
      return next;
    });
  }

  // when user selects reportType 'group', enable grouped view automatically
  // NOTE: don't reference groupEnabled here to avoid using a state variable before its declaration
  useEffect(() => {
    setGroupEnabled(reportType === 'group');
  }, [reportType]);

  useEffect(() => {
    Promise.all([
      api.get('/hr'),
      skillAPI.getSkills()
    ]).then(([hrRes, skillsRes]) => {
      setHRList(Array.isArray(hrRes.data) ? hrRes.data : []);
      setSkills(Array.isArray(skillsRes.data) ? skillsRes.data : []);
      setLoading(false);
      // Debug: log hrList and officerType values
      console.log('HR List:', hrRes.data);
      if (Array.isArray(hrRes.data)) {
        const officerTypes = hrRes.data.map(hr => hr.officerType);
        console.log('Officer Types:', officerTypes);
      }
    }).catch(() => setLoading(false));
  }, []);

  const genders = ['Male', 'Female', 'Other'];

  // Filter HRs by sidebar filters
  const filteredList = hrList.filter(hr => {
    if (filterSkill && hr.skill !== filterSkill) return false;
    if (filterGender && ((filterGender === 'Other' && hr.gender !== 'Other') || (filterGender !== 'Other' && hr.gender !== filterGender))) return false;
    if (search.trim() && !(hr.skill && hr.skill.includes(search))) return false;
    return true;
  });
  // Build summary array sorted by skills_Id
  const summaryArr = summarizeBySkill(filteredList, skills);

  // Merge all skills from HRs and skills table
  const allSkillNames = Array.from(new Set([
    ...skills.map(s => s.skills_Kh),
    ...hrList.map(hr => hr.skill).filter(Boolean)
  ]));
  // Build summary for summary table using allSkillNames
  const summarySkillArr = allSkillNames.map((skillName, idx) => {
    let male = 0, female = 0, otherCount = 0;
    hrList.forEach(hr => {
      if (hr.skill === skillName) {
        if (hr.gender === 'Male') male++;
        else if (hr.gender === 'Female') female++;
        else otherCount++;
      }
    });
    return {
      skills_Kh: skillName,
      total: male + female + otherCount,
      male,
      female,
      otherCount
    };
  });

  // Sum of all occurrences across skills (grand total of 'សរុប' column)
  const sumAll = hrList.reduce((acc, hr) => hr.skill ? acc + 1 : acc, 0);

  // Skill type map: precompute civil/contract/other counts per skill (used by grouped view)
  const skillTypeMap = {};
  allSkillNames.forEach(skillName => {
    let civil = 0, contract = 0, other = 0;
    let female = 0, femaleCivil = 0, femaleContract = 0;
    hrList.forEach(hr => {
      if (hr.skill === skillName) {
        const type = hr.officerType ? hr.officerType.toString().toLowerCase() : '';
        // count by officer type
        if (type === 'មន្រ្តីរាជការ' || type === 'civil servant') {
          civil++;
          if (hr.gender === 'Female') femaleCivil++;
        } else if (type === 'កិច្ចសន្យា' || type === 'contract') {
          contract++;
          if (hr.gender === 'Female') femaleContract++;
        } else if (hr.officerType) {
          // treat other non-empty types as contract-type per requirement
          contract++;
          if (hr.gender === 'Female') femaleContract++;
        } else {
          other++;
        }
        // overall female count for this skill
        if (hr.gender === 'Female') female++;
      }
    });
    skillTypeMap[skillName] = { total: civil + contract + other, civil, contract, other, female, femaleCivil, femaleContract };
  });

  // Grouping state (allow user to define skill groups)
  const [groupEnabled, setGroupEnabled] = useState(false);
  const [groups, setGroups] = useState([]); // { name, skills: [] }
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSkills, setNewGroupSkills] = useState([]);
  const [addGroupMsg, setAddGroupMsg] = useState('');
  const [tableOrder, setTableOrder] = useState([]);
  // drag-over visual target state: { kind: 'available'|'group'|'skill', id: any }
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  // NOTE: removed automatic creation of a default "គ្រប់ជំនាញ" group
  // Groups are now only created explicitly by the user via the UI.

  // initialize tableOrder from allSkillNames when skills load
  useEffect(() => {
    // Try to load persisted groups and tableOrder from localStorage first
    try {
      const g = localStorage.getItem('hrskill_groups');
      if (g) {
        const parsed = JSON.parse(g);
        if (Array.isArray(parsed)) setGroups(parsed);
      }
      const t = localStorage.getItem('hrskill_tableOrder');
      if (t) {
        const parsedT = JSON.parse(t);
        if (Array.isArray(parsedT)) setTableOrder(parsedT);
        else if (allSkillNames && allSkillNames.length > 0) setTableOrder(allSkillNames.slice());
      } else if (allSkillNames && allSkillNames.length > 0) {
        setTableOrder(allSkillNames.slice());
      }
    } catch (err) {
      // fallback: initialize from available skills
      if (allSkillNames && allSkillNames.length > 0) setTableOrder(allSkillNames.slice());
    }
    // run when skills list changes
  }, [allSkillNames.length]);

  // Persist groups to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('hrskill_groups', JSON.stringify(groups || []));
    } catch (err) { /* ignore */ }
  }, [groups]);

  // Persist table order to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('hrskill_tableOrder', JSON.stringify(tableOrder || []));
    } catch (err) { /* ignore */ }
  }, [tableOrder]);

  // Persist groups/tableOrder to server (debounced) so preferences survive across devices
  useEffect(() => {
    // Debounced save to server
    let t = null;
    setSaveStatus('saving');
    t = setTimeout(() => {
      api.post('/report-settings/hr-skill-groups', { groups: groups || [], tableOrder: tableOrder || [], groupName: 'global' })
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 1500);
          console.debug('Saved hr-skill prefs to server');
        }).catch(err => {
          setSaveStatus('error');
          console.error('Failed to save hr-skill prefs', err && err.message);
        });
    }, 700);
    return () => { if (t) clearTimeout(t); };
  }, [groups, tableOrder]);

  // On mount try to load persisted prefs from server if local state is empty
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/report-settings/hr-skill-groups');
        if (res && res.data && res.data.ok && res.data.prefs) {
          const prefs = res.data.prefs || {};
          if ((!groups || groups.length === 0) && Array.isArray(prefs.groups) && prefs.groups.length > 0) setGroups(prefs.groups);
          if ((!tableOrder || tableOrder.length === 0) && Array.isArray(prefs.tableOrder) && prefs.tableOrder.length > 0) setTableOrder(prefs.tableOrder);
        }
      } catch (err) { /* ignore */ }
    })();
  }, []);

  // build map skill -> groups for easy lookup when rendering labels
  const skillToGroups = {};
  (groups || []).forEach(g => {
    (g.skills || []).forEach(s => {
      if (!skillToGroups[s]) skillToGroups[s] = [];
      if (!skillToGroups[s].includes(g.name)) skillToGroups[s].push(g.name);
    });
  });

  function moveTableItem(fromIndex, toIndex) {
    setTableOrder(prev => {
      const arr = prev.slice();
      if (fromIndex < 0 || fromIndex >= arr.length) return prev;
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      return arr;
    });
  }

  function addGroup() {
    setAddGroupMsg('');
    if (!newGroupName.trim()) {
      setAddGroupMsg('សូមបញ្ចូលឈ្មោះក្រុម');
      return;
    }
    if (!newGroupSkills || newGroupSkills.length === 0) {
      setAddGroupMsg('សូមជ្រើសយ៉ាងហោចណាស់មួយជំនាញ');
      return;
    }
    // prevent duplicate group name
    if (groups.some(g => g.name === newGroupName.trim())) {
      setAddGroupMsg('ឈ្មោះក្រុមមានស្រាប់');
      return;
    }
    const newG = { name: newGroupName.trim(), skills: newGroupSkills };
    console.log('Adding group', newG);
    setGroups(prev => [...prev, newG]);
    setNewGroupName('');
    setNewGroupSkills([]);
    setAddGroupMsg('បានបន្ថែមក្រុម');
    setTimeout(() => setAddGroupMsg(''), 2500);
  }
  function removeGroup(idx) {
    setGroups(prev => prev.filter((g, i) => i !== idx));
  }

  // Edit group name inline
  const [editingGroupIndex, setEditingGroupIndex] = useState(null);
  const [editingGroupNameVal, setEditingGroupNameVal] = useState('');

  function startEditGroup(idx) {
    setEditingGroupIndex(idx);
    setEditingGroupNameVal(groups[idx] ? groups[idx].name : '');
  }
  function saveEditGroup(idx) {
    const v = (editingGroupNameVal || '').trim();
    if (!v) return; // ignore empty
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, name: v } : g));
    setEditingGroupIndex(null);
    setEditingGroupNameVal('');
  }
  function cancelEditGroup() {
    setEditingGroupIndex(null);
    setEditingGroupNameVal('');
  }

  // Move group up/down
  function moveGroup(idx, dir) {
    setGroups(prev => {
      const arr = Array.isArray(prev) ? prev.slice() : [];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      const [item] = arr.splice(idx, 1);
      arr.splice(j, 0, item);
      return arr;
    });
  }

  // Move a skill inside a group up/down
  function moveSkillInGroup(groupIdx, skillIdx, dir) {
    setGroups(prev => prev.map((g, gi) => {
      if (gi !== groupIdx) return g;
      const arr = Array.isArray(g.skills) ? g.skills.slice() : [];
      const j = skillIdx + dir;
      if (j < 0 || j >= arr.length) return g;
      const [it] = arr.splice(skillIdx, 1);
      arr.splice(j, 0, it);
      return { ...g, skills: arr };
    }));
  }

  // Build rows for by-skill table (respecting filters)
  function buildBySkillRows() {
    const skillTypeArr = allSkillNames.map((skillName) => {
      let civil = 0, contract = 0, other = 0;
      hrList.forEach(hr => {
        if (hr.skill === skillName) {
          const type = hr.officerType ? hr.officerType.toString().toLowerCase() : '';
          if (type === 'មន្រ្តីរាជការ' || type === 'civil servant') civil++;
          else if (type === 'កិច្ចសន្យា' || type === 'contract' || (hr.officerType && (type !== 'មន្រ្តីរាជការ' && type !== 'civil servant'))) contract++;
          else other++;
        }
      });
      return { skills_Kh: skillName, total: civil + contract + other, civil, contract, other };
    });
    const filtered = filterSkill ? skillTypeArr.filter(row => row.skills_Kh === filterSkill) : skillTypeArr;
    let finalRows = filtered;
    if (filterGender === 'Male') finalRows = filtered.filter(row => row.civil > 0);
    if (filterGender === 'Female') finalRows = filtered.filter(row => row.contract > 0);
    if (filterGender === 'Other') finalRows = filtered.filter(row => row.other > 0);
    return finalRows;
  }

  // Build rows for grouped table
  function buildGroupRows() {
    return groups.map(g => {
      const vals = g.skills.reduce((acc, s) => {
        const m = skillTypeMap[s] || { total: 0, civil: 0, contract: 0, other: 0 };
        acc.total += m.total;
        acc.civil += m.civil;
        acc.contract += m.contract;
        acc.other += m.other;
        return acc;
      }, { total: 0, civil: 0, contract: 0, other: 0 });
      return { name: g.name, skills: g.skills.slice(), countSkills: g.skills.length, ...vals };
    });
  }

  // Handle dropping a skill onto another skill row to create/merge groups
  function handleDropOnSkill(e, targetSkill) {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      const data = raw ? JSON.parse(raw) : null;
      if (!data || !data.skill) return;
      const source = data.skill;
      if (!source || source === targetSkill) return;
      setGroups(prev => {
        const groupsCopy = Array.isArray(prev) ? prev.map(g => ({ ...g, skills: Array.isArray(g.skills) ? g.skills.slice() : [] })) : [];
        const srcIdx = groupsCopy.findIndex(g => g.skills.includes(source));
        const tgtIdx = groupsCopy.findIndex(g => g.skills.includes(targetSkill));

        // If target is already in a group, add source to that group
        if (tgtIdx >= 0) {
          if (!groupsCopy[tgtIdx].skills.includes(source)) groupsCopy[tgtIdx].skills.push(source);
          // remove from source group if different
          if (srcIdx >= 0 && srcIdx !== tgtIdx) {
            groupsCopy[srcIdx].skills = groupsCopy[srcIdx].skills.filter(s => s !== source);
          }
          return groupsCopy;
        }

        // If source is in a group and target is not, add target to source's group
        if (srcIdx >= 0) {
          if (!groupsCopy[srcIdx].skills.includes(targetSkill)) groupsCopy[srcIdx].skills.push(targetSkill);
          return groupsCopy;
        }

        // Neither in a group -> create a new group with both
        const baseName = `${targetSkill} + ${source}`;
        let name = baseName;
        let i = 1;
        while (groupsCopy.some(g => g.name === name)) {
          name = `${baseName} (${i++})`;
        }
        groupsCopy.push({ name, skills: [targetSkill, source] });
        return groupsCopy;
      });
    } catch (err) {
      // ignore parse errors
    } finally {
      setDragOverTarget(null);
    }
  }

  // Handle dropping a skill (or table-skill) onto a group by index
  function handleDropOnGroup(e, targetGroupIndex) {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      const data = raw ? JSON.parse(raw) : null;
      if (!data || !data.skill) return;
      const source = data.skill;
      setGroups(prev => {
        const groupsCopy = Array.isArray(prev) ? prev.map(g => ({ ...g, skills: Array.isArray(g.skills) ? g.skills.slice() : [] })) : [];
        const srcIdx = groupsCopy.findIndex(g => g.skills.includes(source));
        const tgtIdx = targetGroupIndex;

        if (tgtIdx < 0 || tgtIdx >= groupsCopy.length) return groupsCopy;

        // Add source to target group if not already present
        if (!groupsCopy[tgtIdx].skills.includes(source)) groupsCopy[tgtIdx].skills.push(source);

        // Remove from source group if different
        if (srcIdx >= 0 && srcIdx !== tgtIdx) {
          groupsCopy[srcIdx].skills = groupsCopy[srcIdx].skills.filter(s => s !== source);
        }

        return groupsCopy;
      });
    } catch (err) {
      // ignore parse errors
    } finally {
      setDragOverTarget(null);
    }
  }

  // Remove a skill from a group by index
  function removeSkillFromGroup(groupIndex, skill) {
    setGroups(prev => prev.map((g, idx) => idx === groupIndex ? { ...g, skills: g.skills.filter(s => s !== skill) } : g));
  }

  // Add group (with confirmation)
  function addGroup() {
    setAddGroupMsg('');
    if (!newGroupName.trim()) {
      setAddGroupMsg('សូមបញ្ចូលឈ្មោះក្រុម');
      return;
    }
    if (!newGroupSkills || newGroupSkills.length === 0) {
      setAddGroupMsg('សូមជ្រើសយ៉ាងហោចណាស់មួយជំនាញ');
      return;
    }
    // prevent duplicate group name
    if (groups.some(g => g.name === newGroupName.trim())) {
      setAddGroupMsg('ឈ្មោះក្រុមមានស្រាប់');
      return;
    }
    // Ask user to confirm creating the group
    const skillsPreview = newGroupSkills.join(', ');
    const confirmMsg = `បង្កើតក្រុម "${newGroupName.trim()}" ដោយមានជំនាញ: ${skillsPreview}\n\nបន្តចុច OK ដើម្បីបង្កើត, ឬ Cancel ដើម្បីត្រឡប់ក្រោយ`;
    if (!window.confirm(confirmMsg)) {
      setAddGroupMsg('បានបោះបង់');
      setTimeout(() => setAddGroupMsg(''), 1500);
      return;
    }

    const newG = { name: newGroupName.trim(), skills: newGroupSkills };
    console.log('Adding group', newG);
    setGroups(prev => [...prev, newG]);
    setNewGroupName('');
    setNewGroupSkills([]);
    setAddGroupMsg('បានបន្ថែមក្រុម');
    setTimeout(() => setAddGroupMsg(''), 2500);
  }

  // Export current view to CSV
  function exportCSV() {
    let rows = [];
    if (groupEnabled && groups.length > 0) {
      rows.push(['Group', 'Skills', 'SkillsCount', 'Total', 'Civil', 'Contract', 'Other']);
      const gr = buildGroupRows();
      gr.forEach(r => rows.push([r.name, (r.skills || []).join('; '), r.countSkills, r.total, r.civil, r.contract, r.other]));
    } else {
      rows.push(['Skill', 'Total', 'Civil', 'Contract', 'Other']);
      const br = buildBySkillRows();
      br.forEach(r => rows.push([r.skills_Kh, r.total, r.civil, r.contract, r.other]));
    }
    // convert to CSV string
    const csv = rows.map(r => r.map(c => '"' + (c != null ? String(c).replace(/"/g, '""') : '') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fname = groupEnabled && groups.length > 0 ? 'hr-skill-groups.csv' : 'hr-skill-by-skill.csv';
    a.setAttribute('download', fname);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Open a new window with just the report area and print it
  function printReport() {
    try {
      const node = reportRef.current;
      if (!node) return;

      // Clone the report DOM so we can safely remove columns for printing
      const cloned = node.cloneNode(true);

      // Detect header checkboxes (user may have checkboxes in the table header to select columns)
      // If any header checkboxes are present, only include columns whose corresponding header checkbox is checked.
      try {
        const tables = Array.from(cloned.querySelectorAll('.a4-report-table'));
        tables.forEach(tbl => {
          const thead = tbl.querySelector('thead');
          if (!thead) return;
          const headerCells = Array.from(thead.querySelectorAll('th'));
          const hasHeaderCheckboxes = headerCells.some(h => h.querySelector('input[type="checkbox"]'));
          if (!hasHeaderCheckboxes) return;

          // build array of booleans per this table: true only if header cell contains a checked checkbox
          // (if a header cell has no checkbox, we treat it as unchecked when header-checkbox mode is used)
          const keep = headerCells.map(h => {
            const cb = h.querySelector('input[type="checkbox"]');
            return cb ? cb.checked : false;
          });

          // remove unchecked header cells
          for (let i = keep.length - 1; i >= 0; --i) {
            if (!keep[i]) {
              const th = headerCells[i];
              if (th && th.parentNode) th.parentNode.removeChild(th);
            }
          }

          // remove corresponding td cells only within this table
          const rows = Array.from(tbl.querySelectorAll('tbody tr, tfoot tr'));
          rows.forEach(tr => {
            const cells = Array.from(tr.children);
            for (let i = cells.length - 1; i >= 0; --i) {
              if (!keep[i]) {
                const c = cells[i];
                if (c && c.parentNode) c.parentNode.removeChild(c);
              }
            }
          });
        });
      } catch (err) {
        // ignore errors and fall back to printing full HTML
        console.debug('Column-selection for print failed', err);
      }

      const html = cloned.innerHTML;
      const styles = `
        <style>
          @page { size: A4; margin: 3mm; }
          body { font-family: 'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif; padding: 5px; color: #222; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
          th, td { border: 1px solid #111111ff; padding: 6px; }
          thead tr { background: #f3f3f3; }
          tfoot tr { background: #c8f7c8; font-weight: bold; }
          h2 { font-size: 14px; margin: 8px 0; }
          /* Hide interactive controls and small remove 'x' buttons in printed output */
          button { display: none !important; }
          /* Hide small parenthesized counts (e.g. (3)) in the printed report */
          .a4-report-table small { display: none !important; }
          /* Hide header checkboxes in printed output (we use them for selection only) */
          .a4-report-table thead input[type="checkbox"] { display: none !important; }
        </style>
      `;
      const docStr = `<!doctype html><html><head><meta charset="utf-8"><title>Printable Report</title>${styles}</head><body>${html}</body></html>`;

      // Always use hidden iframe printing (no new tab/window)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);
      const idoc = iframe.contentDocument || iframe.contentWindow.document;
      idoc.open();
      idoc.write(docStr);
      idoc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error('Iframe print failed', err);
          alert('ព្រីន​មិន​ជោគជ័យ - មើល console សម្រាប់ព័ត៌មានបន្ថែម');
        } finally {
          try { document.body.removeChild(iframe); } catch (e) { /* ignore */ }
        }
      }, 500);
    } catch (err) {
      console.error('Print failed', err);
      alert('ព្រីន​មិន​ជោគជ័យ - មើល console សម្រាប់ព័ត៌មានបន្ថែម');
    }
  }

  // Compute displayed summary rows (respecting current filters) and their total
  const displayedSummaryRows = (filterSkill ? summarySkillArr.filter(row => row.skills_Kh === filterSkill) : summarySkillArr)
    .filter(row => !filterGender || (filterGender === 'Male' ? row.male > 0 : filterGender === 'Female' ? row.female > 0 : filterGender === 'Other' ? row.otherCount > 0 : true));
  const sumDisplayedTotals = displayedSummaryRows.reduce((acc, row) => acc + (row.total || 0), 0);


  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0' }}>
      <div ref={reportRef} style={{ flex: 1 }}>
        <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '14px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
            <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
          </div>
        </div>
        {/* Summary Table */}
        {(reportType === 'summary' || reportType === 'both') && (
          <>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '12px 0', textAlign: 'center' }}>
              របាយការណ៍សរុបជំនាញ
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '10px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff', marginBottom: '32px' }}>
              <thead>
                <tr style={{ background: '#f3f3f3' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={headerColumnChecks.index} onChange={(e) => toggleHeaderColumn('index', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                      <span>ល.រ</span>
                    </label>
                  </th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={headerColumnChecks.skill_summary} onChange={(e) => toggleHeaderColumn('skill_summary', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                      <span>ជំនាញ</span>
                    </label>
                  </th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={headerColumnChecks.total} onChange={(e) => toggleHeaderColumn('total', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                      <span>សរុប</span>
                    </label>
                  </th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={headerColumnChecks.male} onChange={(e) => toggleHeaderColumn('male', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                      <span>ប្រុស</span>
                    </label>
                  </th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={headerColumnChecks.female} onChange={(e) => toggleHeaderColumn('female', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                      <span>ស្រី</span>
                    </label>
                  </th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={headerColumnChecks.other} onChange={(e) => toggleHeaderColumn('other', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                      <span>ផ្សេងៗ</span>
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(filterSkill ? summarySkillArr.filter(row => row.skills_Kh === filterSkill) : summarySkillArr)
                  .filter(row => !filterGender || (filterGender === 'Male' ? row.male > 0 : filterGender === 'Female' ? row.female > 0 : filterGender === 'Other' ? row.otherCount > 0 : true))
                  .map((row, idx) => (
                    <tr key={row.skills_Kh}>
                      <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px' }}>{row.skills_Kh}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{row.total}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{row.male}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{row.female}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{row.otherCount > 0 ? row.otherCount : ''}</td>
                    </tr>
          ))}
        </tbody>
        <tfoot>
                {(() => {
                  // Summary row for all skills in summary table (unique HR by gender)
                  const uniqueHR = new Map();
                  hrList.forEach(hr => {
                    const key = hr._id || hr.id;
                    if (!uniqueHR.has(key)) uniqueHR.set(key, hr.gender);
                  });
                  const total = uniqueHR.size;
                  let male = 0, female = 0, other = 0;
                  for (const gender of uniqueHR.values()) {
                    if (gender === 'Male') male++;
                    else if (gender === 'Female') female++;
                    else other++;
                  }
                  return (
                    <tr style={{ background: '#c8f7c8', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>សរុបបុគ្គលិក </td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumAll} </td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{male}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{female}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{other > 0 ? other : ''}</td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </>
        )}
        {/* By Type Table */}
  {(reportType === 'byType' || reportType === 'both' || reportType === 'group') && (
          <>
            <div style={{ fontWeight: 'bold', fontSize: '14px', margin: '18px 0 8px 0', textAlign: 'center', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>
              របាយការណ៍សរុបជំនាញ តាមប្រភេទមន្រ្តីរាជការ និងកិច្ចសន្យា
            </div>
            {/* Second table: Civil Servant, Contract, Other
                If grouping is enabled and groups exist, show grouped summary table instead */}
            {groupEnabled ? (
              // Grouped summary table (if no user-defined groups, show each skill as its own group)
              <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
                <thead>
                  <tr style={{ background: '#e3e3e3' }}>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.index} onChange={(e) => toggleHeaderColumn('index', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>ល.រ</span>
                        </label>
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.skill_group_tech} onChange={(e) => toggleHeaderColumn('skill_group_tech', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>ជំនាញបច្ចេកទេស</span>
                        </label>
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.skill_group_plain} onChange={(e) => toggleHeaderColumn('skill_group_plain', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>ជំនាញ</span>
                        </label>
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.total} onChange={(e) => toggleHeaderColumn('total', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>សរុប</span>
                        </label>
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.female_overall} onChange={(e) => toggleHeaderColumn('female_overall', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>ស្រី</span>
                        </label>
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.civil} onChange={(e) => toggleHeaderColumn('civil', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>មន្រ្តីរាជការ</span>
                        </label>
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.female_civil} onChange={(e) => toggleHeaderColumn('female_civil', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>ស្រី</span>
                        </label>
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.contract} onChange={(e) => toggleHeaderColumn('contract', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>កិច្ចសន្យា</span>
                        </label>
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.female_contract} onChange={(e) => toggleHeaderColumn('female_contract', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>ស្រី</span>
                        </label>
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '6px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={headerColumnChecks.other} onChange={(e) => toggleHeaderColumn('other', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)} />
                          <span>ផ្សេងៗ</span>
                        </label>
                      </th>
                    </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Build table rows: show one row per group (aggregated)
                    // followed by any ungrouped skills as individual rows.
                    const groupedRows = (groups && groups.length > 0) ? groups.map((g, gi) => {
                      const vals = g.skills.reduce((acc, s) => {
                        const m = skillTypeMap[s] || { total: 0, civil: 0, contract: 0, other: 0, female: 0, femaleCivil: 0, femaleContract: 0 };
                        acc.total += m.total;
                        acc.female += m.female || 0;
                        acc.civil += m.civil;
                        acc.femaleCivil += m.femaleCivil || 0;
                        acc.contract += m.contract;
                        acc.femaleContract += m.femaleContract || 0;
                        acc.other += m.other;
                        return acc;
                      }, { total: 0, female: 0, civil: 0, femaleCivil: 0, contract: 0, femaleContract: 0, other: 0 });
                      return { type: 'group', name: g.name, label: `${g.name} (${g.skills.length})`, skills: g.skills.slice(), groupIndex: gi, ...vals };
                    }) : [];

                    const groupedSkillSet = new Set((groups || []).flatMap(g => g.skills || []));
                    const ungrouped = allSkillNames.filter(s => !groupedSkillSet.has(s));

                    // If no groups exist, respect user tableOrder; otherwise show ungrouped in default order
                    const perSkillRows = (groups && groups.length > 0)
                      ? ungrouped.map(s => ({ type: 'skill', label: s, skill: s, ...(skillTypeMap[s] || { total: 0, female: 0, civil: 0, femaleCivil: 0, contract: 0, femaleContract: 0, other: 0 }) }))
                      : (tableOrder && tableOrder.length > 0 ? tableOrder.map(s => ({ type: 'skill', label: s, skill: s, ...(skillTypeMap[s] || { total: 0, female: 0, civil: 0, femaleCivil: 0, contract: 0, femaleContract: 0, other: 0 }) })) : allSkillNames.map(s => ({ type: 'skill', label: s, skill: s, ...(skillTypeMap[s] || { total: 0, female: 0, civil: 0, femaleCivil: 0, contract: 0, femaleContract: 0, other: 0 }) })));

                    const combined = [...groupedRows, ...perSkillRows];

                    return combined.map((r, idx) => {
                      if (r.type === 'group') {
                        // compute display label: if the group name appears to be auto-generated as "First + ...",
                        // show only the first skill for compact display; otherwise show the stored group name.
                        const displayGroupLabel = (Array.isArray(r.skills) && r.skills.length > 0)
                          ? ((r.name && typeof r.name === 'string' && r.name.startsWith(r.skills[0] + ' +')) ? r.skills[0] : (r.name || r.skills[0]))
                          : (r.name || '');

                        return (
                              <tr key={`group-${idx}`}
                                  onDragOver={e => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (err) {} setDragOverTarget({ kind: 'group', id: r.groupIndex }); }}
                                  onDragLeave={() => setDragOverTarget(null)}
                                  onDrop={e => handleDropOnGroup(e, r.groupIndex)}>
                                <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ border: '1px solid #ddd', padding: '6px', fontWeight: '600' }}>
                                  {editingGroupIndex === r.groupIndex ? (
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                      <input autoFocus value={editingGroupNameVal} onChange={e => setEditingGroupNameVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEditGroup(r.groupIndex); if (e.key === 'Escape') cancelEditGroup(); }} style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                      <button onClick={(e) => { e.stopPropagation(); saveEditGroup(r.groupIndex); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #2b7cff', background: '#2b7cff', color: '#fff', cursor: 'pointer' }}>រក្សា</button>
                                      <button onClick={(e) => { e.stopPropagation(); cancelEditGroup(); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>បោះបង់</button>
                                    </div>
                                  ) : (
                                    <div style={{ cursor: 'pointer' }} onDoubleClick={() => startEditGroup(r.groupIndex)}>{displayGroupLabel} <small style={{ color: '#666' }}>({Array.isArray(r.skills) ? r.skills.length : 0})</small></div>
                                  )}
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '6px', fontSize: '12px', color: '#444', lineHeight: '1.3', maxWidth: '410px', wordBreak: 'break-word', background: (dragOverTarget && dragOverTarget.kind === 'group' && dragOverTarget.id === r.groupIndex) ? '#f0f8ff' : 'transparent' }}>
                                  {Array.isArray(r.skills) && r.skills.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {r.skills.map((s, si) => (
                                        <div key={s + si} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                          <div draggable onDragStart={e => {
                                            try {
                                              const payload = JSON.stringify({ skill: s, fromGroup: r.groupIndex });
                                              e.dataTransfer.setData('application/json', payload);
                                              e.dataTransfer.setData('text/plain', payload);
                                              e.dataTransfer.effectAllowed = 'copyMove';
                                            } catch (err) { }
                                          }} style={{ display: 'inline-block', padding: '4px 8px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', cursor: 'grab', fontSize: '12px' }}>{s}</div>
                                          <button title="ដកចេញ" onClick={e => { e.stopPropagation(); removeSkillFromGroup(r.groupIndex, s); }} style={{ border: '1px solid #ccc', background: '#fff', padding: '2px 6px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px' }}>x</button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : ''}
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.total}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.female}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.civil}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.femaleCivil}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.contract}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.femaleContract}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.other > 0 ? r.other : ''}</td>
                              </tr>
                            );
                      }
                      // ungrouped skill row — allow dragging into groups
                      const plainSkill = r.skill || String(r.label).replace(/\s*\(\d+\)$/, '');
                      return (
                        <tr key={`skill-${idx}`}
                            onDragOver={e => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {} setDragOverTarget({ kind: 'skill', id: plainSkill }); }}
                            onDragLeave={() => setDragOverTarget(null)}
                            onDrop={e => handleDropOnSkill(e, plainSkill)}>
                          <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px' }}>{plainSkill}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px' }}>
                            <div draggable onDragStart={e => {
                              try {
                                e.dataTransfer.setData('text/plain', JSON.stringify({ skill: plainSkill, action: 'table-skill' }));
                                e.dataTransfer.effectAllowed = 'copyMove';
                              } catch (err) { /* ignore */ }
                            }} style={{ cursor: 'grab', userSelect: 'none' }}>{r.label}</div>
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.total}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.female}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.civil}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.femaleCivil}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.contract}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.femaleContract}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{r.other > 0 ? r.other : ''}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot>
                  {(() => {
                    // Compute footer sums based on displayed rows (include both grouped rows and any ungrouped skills)
                    const groupedAggregates = (groups && groups.length > 0) ? groups.map(g => {
                      return g.skills.reduce((acc, s) => {
                        const m = skillTypeMap[s] || { total: 0, female: 0, civil: 0, femaleCivil: 0, contract: 0, femaleContract: 0, other: 0 };
                        acc.total += m.total;
                        acc.female += m.female || 0;
                        acc.civil += m.civil;
                        acc.femaleCivil += m.femaleCivil || 0;
                        acc.contract += m.contract;
                        acc.femaleContract += m.femaleContract || 0;
                        acc.other += m.other;
                        return acc;
                      }, { total: 0, female: 0, civil: 0, femaleCivil: 0, contract: 0, femaleContract: 0, other: 0 });
                    }) : [];

                    const groupedSkillSet = new Set((groups || []).flatMap(g => g.skills || []));
                    const ungrouped = allSkillNames.filter(s => !groupedSkillSet.has(s));

                    const perSkillAggregates = (groups && groups.length > 0)
                      ? ungrouped.map(s => ({ total: skillTypeMap[s]?.total || 0, female: skillTypeMap[s]?.female || 0, civil: skillTypeMap[s]?.civil || 0, femaleCivil: skillTypeMap[s]?.femaleCivil || 0, contract: skillTypeMap[s]?.contract || 0, femaleContract: skillTypeMap[s]?.femaleContract || 0, other: skillTypeMap[s]?.other || 0 }))
                      : (tableOrder && tableOrder.length > 0 ? tableOrder.map(s => ({ total: skillTypeMap[s]?.total || 0, female: skillTypeMap[s]?.female || 0, civil: skillTypeMap[s]?.civil || 0, femaleCivil: skillTypeMap[s]?.femaleCivil || 0, contract: skillTypeMap[s]?.contract || 0, femaleContract: skillTypeMap[s]?.femaleContract || 0, other: skillTypeMap[s]?.other || 0 })) : allSkillNames.map(s => ({ total: skillTypeMap[s]?.total || 0, female: skillTypeMap[s]?.female || 0, civil: skillTypeMap[s]?.civil || 0, femaleCivil: skillTypeMap[s]?.femaleCivil || 0, contract: skillTypeMap[s]?.contract || 0, femaleContract: skillTypeMap[s]?.femaleContract || 0, other: skillTypeMap[s]?.other || 0 })));

                    const rows = [...groupedAggregates, ...perSkillAggregates];
                    const sumGroupTotal = rows.reduce((a, r) => a + (r.total || 0), 0);
                    const sumGroupFemale = rows.reduce((a, r) => a + (r.female || 0), 0);
                    const sumGroupCivil = rows.reduce((a, r) => a + (r.civil || 0), 0);
                    const sumGroupFemaleCivil = rows.reduce((a, r) => a + (r.femaleCivil || 0), 0);
                    const sumGroupContract = rows.reduce((a, r) => a + (r.contract || 0), 0);
                    const sumGroupFemaleContract = rows.reduce((a, r) => a + (r.femaleContract || 0), 0);
                    const sumGroupOther = rows.reduce((a, r) => a + (r.other || 0), 0);
                    return (
                        <tr style={{ background: '#c8f7c8', fontWeight: 'bold' }}>
                        <td colSpan={3} style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'right' }}>សរុបក្រុមជំនាញ</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumGroupTotal}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumGroupFemale}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumGroupCivil}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumGroupFemaleCivil}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumGroupContract}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumGroupFemaleContract}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumGroupOther > 0 ? sumGroupOther : ''}</td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            ) : (
              // Default by-skill table
              <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
                <thead>
                  <tr style={{ background: '#e3e3e3' }}>
                    <th style={{ border: '1px solid #ddd', padding: '6px' }}>ល.រ</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px' }}>ជំនាញ</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px' }}>សរុប</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px' }}>មន្រ្តីរាជការ</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px' }}>កិច្ចសន្យា</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px' }}>ផ្សេងៗ</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Build summary by skill and officerType using allSkillNames
                    const skillTypeArr = allSkillNames.map((skillName, idx) => {
                      let civil = 0, contract = 0, other = 0, male = 0, female = 0, otherCount = 0;
                      hrList.forEach(hr => {
                        if (hr.skill === skillName) {
                          if (hr.officerType === 'មន្រ្តីរាជការ' || (hr.officerType && hr.officerType.toLowerCase() === 'civil servant')) civil++;
                          else if (hr.officerType && hr.officerType !== 'មន្រ្តីរាជការ' && hr.officerType.toLowerCase() !== 'civil servant') contract++;
                          if (hr.gender === 'Male') male++;
                          else if (hr.gender === 'Female') female++;
                          else otherCount++;
                        }
                      });
                      return {
                        skills_Kh: skillName,
                        total: civil + contract + other,
                        civil,
                        contract,
                        other,
                        male,
                        female,
                        otherCount
                      };
                    });
                    // Filter by skill if selected
                    const filtered = filterSkill ? skillTypeArr.filter(row => row.skills_Kh === filterSkill) : skillTypeArr;
                    // Filter by type if selected
                    let finalRows = filtered;
                    if (filterGender === 'Male') finalRows = filtered.filter(row => row.civil > 0);
                    if (filterGender === 'Female') finalRows = filtered.filter(row => row.contract > 0);
                    if (filterGender === 'Other') finalRows = filtered.filter(row => row.other > 0);
                    return finalRows.map((row, idx) => (
                      <tr key={row.skills_Kh}
                          onDragOver={e => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {} setDragOverTarget({ kind: 'skill', id: row.skills_Kh }); }}
                          onDragLeave={() => setDragOverTarget(null)}
                          onDrop={e => handleDropOnSkill(e, row.skills_Kh)}>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px' }}>{row.skills_Kh}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{row.total}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{row.civil}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{row.contract}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{row.other > 0 ? row.other : ''}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot>
                  {(() => {
                    // Summary row for all skills in byType table (unique HR by officerType)
                    const uniqueCivil = new Set();
                    const uniqueContract = new Set();
                    const uniqueOther = new Set();
                    hrList.forEach(hr => {
                      const key = hr._id || hr.id;
                      if (hr.officerType === 'មន្រ្តីរាជការ' || (hr.officerType && hr.officerType.toLowerCase() === 'civil servant')) uniqueCivil.add(key);
                      else if (hr.officerType === 'កិច្ចសន្យា' || (hr.officerType && hr.officerType.toLowerCase() === 'contract')) uniqueContract.add(key);
                      else if (hr.officerType === 'ផ្សេងៗ' || (hr.officerType && hr.officerType.toLowerCase() === 'other')) uniqueOther.add(key);
                    });
                    const total = uniqueCivil.size + uniqueContract.size + uniqueOther.size;
                    // Rebuild skillTypeArr here (same as tbody) and compute displayed sum of 'សរុប' column
                    const skillTypeArr = allSkillNames.map((skillName) => {
                      let civil = 0, contract = 0, other = 0;
                      hrList.forEach(hr => {
                        if (hr.skill === skillName) {
                          if (hr.officerType === 'មន្រ្តីរាជការ' || (hr.officerType && hr.officerType.toLowerCase() === 'civil servant')) civil++;
                          else if (hr.officerType && hr.officerType !== 'មន្រ្តីរាជការ' && hr.officerType.toLowerCase() !== 'civil servant') contract++;
                          else other++;
                        }
                      });
                      return { skills_Kh: skillName, total: civil + contract + other, civil, contract, other };
                    });
                    const filteredRows = filterSkill ? skillTypeArr.filter(row => row.skills_Kh === filterSkill) : skillTypeArr;
                    let finalRows2 = filteredRows;
                    if (filterGender === 'Male') finalRows2 = filteredRows.filter(row => row.civil > 0);
                    if (filterGender === 'Female') finalRows2 = filteredRows.filter(row => row.contract > 0);
                    if (filterGender === 'Other') finalRows2 = filteredRows.filter(row => row.other > 0);
                    const sumDisplayedTotals = finalRows2.reduce((acc, r) => acc + (r.total || 0), 0);
                    // Also compute summed occurrences for contract rows (not unique HR)
                    const sumContract = hrList.reduce((acc, hr) => {
                      const type = hr.officerType ? hr.officerType.toString().toLowerCase() : '';
                      if (hr.skill && !(type === 'មន្រ្តីរាជការ' || type === 'civil servant')) return acc + 1;
                      return acc;
                    }, 0);
                    return (
                      <tr style={{ background: '#c8f7c8', fontWeight: 'bold' }}>
                        <td colSpan={2} style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>សរុបបុគ្គលិក</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumDisplayedTotals}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{uniqueCivil.size}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{sumContract}</td>
                        <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{uniqueOther.size > 0 ? uniqueOther.size : ''}</td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            )}
          </>
        )}
        <div style={{ marginTop: '18px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#222', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>
          សរុបបុគ្គលិក: {filteredList.length} នាក់
          (ប្រុស: {filteredList.filter(hr => hr.gender === 'Male').length} នាក់,
          ស្រី: {filteredList.filter(hr => hr.gender === 'Female').length} នាក់,
          ផ្សេងៗ: {filteredList.filter(hr => hr.gender === 'Other').length} នាក់)
        </div>
        <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
          <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
          <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
        </div>
      </div>
  <div style={{ minWidth: '340px', padding: '24px 0 0 24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 16px #e0e0e0', border: '1px solid #eee', padding: '24px 24px 24px 24px', marginBottom: '24px' }}>
          {/* Report type filter in sidebar */}
          <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '8px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>ប្រភេទរបាយការណ៍:</div>
          <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: '14px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', marginBottom: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>
            <option value="summary">របាយការណ៍សរុបជំនាញ</option>
            <option value="byType">របាយការណ៍សរុបជំនាញតាមប្រភេទមន្រ្តី</option>
            <option value="group">ចាប់ជំនាញជាក្រុម</option>
            <option value="both">ទាំងពីរ</option>
          </select>
          <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>ជំនាញ:</div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ស្វែងរកជំនាញ" style={{ fontSize: '15px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", marginBottom: '12px' }} />
          <select value={filterSkill} onChange={e => setFilterSkill(e.target.value)} style={{ fontSize: '13px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", marginBottom: '12px' }}>
            <option value="">-- ជ្រើសរើសជំនាញ --</option>
            {skills.map(skill => <option key={skill.skills_Id} value={skill.skills_Kh}>{skill.skills_Kh}</option>)}
          </select>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ fontSize: '13px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", marginBottom: '12px' }}>
            <option value="">-- ជ្រើសរើសភេទ --</option>
            <option value="Male">ប្រុស</option>
            <option value="Female">ស្រី</option>
            <option value="Other">ផ្សេងៗ</option>
          </select>
          {/* Quick actions: CSV export + Print (moved up) */}
          <div style={{ margin: '1px 0 1px 0', display: 'flex', gap: '8px' }}>
            <button onClick={exportCSV} style={{ padding: '5px 3px', borderRadius: '4px', border: '1px solid #28a745', background: '#28a745', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>ទាញយក CSV</button>
            <button onClick={printReport} style={{ padding: '5px 3px', borderRadius: '4px', border: '1px solid #2b7cff', background: '#2b7cff', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>ព្រីន</button>
          </div>
          {/* Grouping controls */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: '12px' }}>
            {/* Grouping is controlled by the Report Type select ("group") */}
            {groupEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="ឈ្មោះក្រុម" style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }} />
                <select multiple value={newGroupSkills} onChange={e => setNewGroupSkills(Array.from(e.target.selectedOptions).map(o => o.value))} style={{ minHeight: '120px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}>
                  {allSkillNames.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button type="button" onClick={addGroup} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #2b7cff', background: '#2b7cff', color: '#fff', cursor: 'pointer' }}>បន្ថែមក្រុម</button>
                  <button onClick={() => { setNewGroupName(''); setNewGroupSkills([]); }} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>សម្អាត</button>
                </div>
                {addGroupMsg && <div style={{ marginTop: '6px', color: addGroupMsg.includes('បាន') ? 'green' : 'red' }}>{addGroupMsg}</div>}
                {groups.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>ក្រុម​ដែលបានបង្កើត</div>
                      <div style={{ fontSize: '12px', color: saveStatus === 'error' ? '#c7254e' : saveStatus === 'saved' ? 'green' : '#666' }}>
                        {saveStatus === 'saving' && 'កំពុងរក្សា...'}
                        {saveStatus === 'saved' && 'បានរក្សា'}
                        {saveStatus === 'error' && 'រក្សាបរាជ័យ'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', marginBottom: '6px' }}>ជំនាញដែលអាចចាប់</div>
                        <div id="available-skills"
                             onDragOver={e => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {} setDragOverTarget({ kind: 'available' }); }}
                             onDragLeave={e => { setDragOverTarget(null); }}
                             onDrop={(e) => {
                          try {
                            const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                            const data = raw ? JSON.parse(raw) : null;
                            if (data && data.skill && typeof data.fromGroup === 'number') {
                              setGroups(prev => prev.map((g, idx) => {
                                if (idx === data.fromGroup) return { ...g, skills: g.skills.filter(s => s !== data.skill) };
                                return g;
                              }));
                            }
                          } catch (err) { /* ignore */ }
                          finally { setDragOverTarget(null); }
                        }} style={{ minHeight: '120px', padding: '8px', border: dragOverTarget && dragOverTarget.kind === 'available' ? '2px dashed #2b7cff' : '1px dashed #ccc', borderRadius: '6px', background: '#fafafa', overflow: 'auto' }}>
                          {allSkillNames.filter(s => !groups.some(g => g.skills.includes(s))).map(s => (
                            <div key={s} draggable onDragStart={e => {
                              try {
                                const payload = JSON.stringify({ skill: s });
                                e.dataTransfer.setData('application/json', payload);
                                e.dataTransfer.setData('text/plain', payload);
                                e.dataTransfer.effectAllowed = 'copyMove';
                              } catch (err) { }
                            }} style={{ padding: '4px 6px', border: '1px solid #eee', borderRadius: '4px', marginBottom: '6px', background: '#fff', cursor: 'grab' }}>{s}</div>
                          ))}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        {groups.map((g, i) => (
                          <div key={i} style={{ marginBottom: '8px', padding: '8px', border: '1px solid #eee', borderRadius: '6px', background: '#fff' }} onDragOver={e => e.preventDefault()} onDrop={(e) => {
                            try {
                              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                              if (data && data.skill) {
                                setGroups(prev => prev.map((grp, idx) => {
                                  if (idx === i) {
                                    if (!grp.skills.includes(data.skill)) return { ...grp, skills: [...grp.skills, data.skill] };
                                  }
                                  return grp;
                                }).map((grp, idx) => {
                                  if (data.fromGroup !== undefined && typeof data.fromGroup === 'number' && data.fromGroup !== i && idx === data.fromGroup) {
                                    return { ...grp, skills: grp.skills.filter(s => s !== data.skill) };
                                  }
                                  return grp;
                                }));
                              }
                            } catch (err) { /* ignore */ }
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button onClick={(e) => { e.stopPropagation(); moveGroup(i, -1); }} title="លើ" style={{ width: 10, height: 28, padding: 0, borderRadius: '50%', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>▲</button>
                                  <button onClick={(e) => { e.stopPropagation(); moveGroup(i, 1); }} title="ក្រោម" style={{ width: 10, height: 28, padding: 0, borderRadius: '50%', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>▼</button>
                                </div>
                                <div>
                                  {editingGroupIndex === i ? (
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <input autoFocus value={editingGroupNameVal} onChange={e => setEditingGroupNameVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEditGroup(i); if (e.key === 'Escape') cancelEditGroup(); }} style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                      <button onClick={(e) => { e.stopPropagation(); saveEditGroup(i); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #2b7cff', background: '#2b7cff', color: '#fff', cursor: 'pointer' }}>រក្សា</button>
                                      <button onClick={(e) => { e.stopPropagation(); cancelEditGroup(); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>បោះបង់</button>
                                    </div>
                                  ) : (
                                    <div style={{ fontWeight: '600', cursor: 'pointer' }} onDoubleClick={() => startEditGroup(i)}>{g.name} <small style={{ color: '#666' }}>({g.skills.length})</small></div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={(e) => { e.stopPropagation(); startEditGroup(i); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #2b7cff', background: '#2b7cff', color: '#fff', cursor: 'pointer' }}>កែ</button>
                                <button onClick={(e) => { e.stopPropagation(); removeGroup(i); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #f44336', background: '#f44336', color: '#fff', cursor: 'pointer' }}>លុប</button>
                              </div>
                            </div>
                            <div>
                              {g.skills.length === 0 && <div style={{ color: '#999', fontSize: '13px' }}>ទទេ - ទាញជំនាញបន្តិចទៅទីនេះ</div>}
                              {g.skills.map((s, si) => (
                                <div key={s} draggable onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ skill: s, fromGroup: i }))} style={{ padding: '4px 6px', border: '1px solid #f1f1f1', borderRadius: '4px', marginBottom: '6px', background: '#fff', cursor: 'grab', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button onClick={(e) => { e.stopPropagation(); moveSkillInGroup(i, si, -1); }} title="លើ" style={{ width: 10, height: 24, padding: 0, borderRadius: '50%', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>▲</button>
                                    <button onClick={(e) => { e.stopPropagation(); moveSkillInGroup(i, si, 1); }} title="ក្រោម" style={{ width: 10, height: 24, padding: 0, borderRadius: '50%', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>▼</button>
                                    <span>{s}</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <button onClick={(e) => { e.stopPropagation(); setGroups(prev => prev.map((grp, idx) => idx === i ? { ...grp, skills: grp.skills.filter(x => x !== s) } : grp)); }} style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>x</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* buttons moved up to be always visible in the sidebar */}
                  </div>
                )}
              </div>
            )}
          </div>
          {(filterSkill || filterGender || search) && (
            <button onClick={() => { setFilterSkill(''); setFilterGender(''); setSearch(''); }} style={{ fontSize: '15px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', background: '#eee', cursor: 'pointer', marginTop: '8px', width: '100%' }}>សម្អាត</button>
          )}
        </div>
      </div>
    </div>
  );
}
