import React, { useEffect, useState } from 'react';
import api from '../services/api';

// Utility: summarize by department and role
function summarizeByDeptAndRole(hrList) {
  const summary = {};
  hrList.forEach(hr => {
    const dept = hr.Department_Kh || 'មិនមានផ្នែក';
    const role = hr.position || 'មិនមានតួនាទី';
    const gender = hr.gender === 'Male' ? 'ប្រុស' : hr.gender === 'Female' ? 'ស្រី' : 'ផ្សេងៗ';
    if (!summary[dept]) summary[dept] = {};
    if (!summary[dept][role]) summary[dept][role] = { male: 0, female: 0, other: 0 };
    if (gender === 'ប្រុស') summary[dept][role].male++;
    else if (gender === 'ស្រី') summary[dept][role].female++;
    else summary[dept][role].other++;
  });
  return summary;
}

export default function HRRoleSummaryPage() {
  const [hrList, setHRList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [reportType, setReportType] = useState('byDept'); // 'byDept', 'byRole', 'byChief'

  useEffect(() => {
    api.get('/hr').then(res => {
      setHRList(Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Get unique departments, roles, genders
  const departments = Array.from(new Set(hrList.map(hr => hr.Department_Kh).filter(Boolean)));
  const roles = Array.from(new Set(hrList.map(hr => hr.position).filter(Boolean)));
  const genders = ['Male', 'Female', 'Other'];

  // Filtered summary
  const filteredList = hrList.filter(hr => {
    if (filterDept && hr.Department_Kh !== filterDept) return false;
    if (filterRole && hr.position !== filterRole) return false;
    if (filterGender && ((filterGender === 'Other' && hr.gender !== 'Other') || (filterGender !== 'Other' && hr.gender !== filterGender))) return false;
    if (search.trim() && !(
      (hr.position && hr.position.includes(search)) ||
      (hr.Department_Kh && hr.Department_Kh.includes(search))
    )) return false;
    return true;
  });
  const summary = summarizeByDeptAndRole(filteredList);

  return (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0' }}>
      {/* Main report content - left side */}
      <div style={{ flex: 1 }}>
        {reportType === 'byDept' && (
          <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', maxWidth: '794px', minHeight: '1122px', margin: '0 auto', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            {/* Header */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍បូកសរុបតួនាទី តាមផ្នែក
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            {loading ? (
              <div>កំពុងទាញទិន្នន័យ...</div>
            ) : (
              <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
                <thead>
                  <tr style={{ background: '#f3f3f3' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្នែក</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>តួនាទី</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>សរុប</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>ប្រុស</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>ស្រី</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្សេងៗ</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary).map(([dept, roles]) => (
                    Object.entries(roles).map(([role, counts], idx) => (
                      <tr key={dept + role}>
                        <td style={{ border: '1px solid #ddd', padding: '8px', background: idx === 0 ? '#f9f9f9' : undefined }}>
                          {idx === 0 ? dept : ''}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{role}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{counts.male + counts.female + counts.other}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{counts.male}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{counts.female}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{counts.other > 0 ? counts.other : ''}</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            )}
            {/* Total summary row below table */}
            <div style={{ marginTop: '18px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#222', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>
              សរុបបុគ្គលិក: {filteredList.length} នាក់
              (ប្រុស: {filteredList.filter(hr => hr.gender === 'Male').length} នាក់,
              ស្រី: {filteredList.filter(hr => hr.gender === 'Female').length} នាក់,
              ផ្សេងៗ: {filteredList.filter(hr => hr.gender === 'Other').length} នាក់)
            </div>
            {/* Footer */}
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
          </div>
        )}
        {reportType === 'byRole' && (
          <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', maxWidth: '794px', minHeight: '1122px', margin: '0 auto', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            {/* Header */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍បូកសរុបតួនាទី
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            {loading ? (
              <div>កំពុងទាញទិន្នន័យ...</div>
            ) : (
              <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
                <thead>
                  <tr style={{ background: '#f3f3f3' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>តួនាទី</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>សរុប</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>ប្រុស</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>ស្រី</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្សេងៗ</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map(role => {
                    const roleList = filteredList.filter(hr => hr.position === role);
                    const male = roleList.filter(hr => hr.gender === 'Male').length;
                    const female = roleList.filter(hr => hr.gender === 'Female').length;
                    const other = roleList.filter(hr => hr.gender === 'Other').length;
                    return (
                      <tr key={role}>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{role}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{roleList.length}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{male}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{female}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{other > 0 ? other : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {/* Total summary row below table */}
            <div style={{ marginTop: '18px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#222', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>
              សរុបបុគ្គលិក: {filteredList.length} នាក់
              (ប្រុស: {filteredList.filter(hr => hr.gender === 'Male').length} នាក់,
              ស្រី: {filteredList.filter(hr => hr.gender === 'Female').length} នាក់,
              ផ្សេងៗ: {filteredList.filter(hr => hr.gender === 'Other').length} នាក់)
            </div>
            {/* Footer */}
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
          </div>
        )}
        
        {reportType === 'byChief' && (
          <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', maxWidth: '794px', minHeight: '1122px', margin: '0 auto', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            {/* Header */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា4</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍នាយផ្នែក/នាយមណ្ឌល
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f3f3f3' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ល.រ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>គោត្តនាម និងនាម</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ភេទ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ជំនាញ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្នែក</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', width: '120px' }}>ផ្សេងៗ</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Group all chiefs into one table (no department separation)
                  const chiefs = filteredList.filter(hr => {
                    if (!hr.position) return false;
                    if (hr.Department_Kh && hr.Department_Kh.includes('ការិយាល័យ')) return false;
                    const pos = hr.position;
                    return (pos.includes('នាយផ្នែក') || pos.includes('នាយមណ្ឌល')) && !pos.includes('នាយផ្នែករង');
                  });
                  const rows = chiefs.map((chief, idx) => (
                    <tr key={chief.name + idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.khmerName || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chief.gender === 'Male' ? 'ប្រុស' : chief.gender === 'Female' ? 'ស្រី' : 'ផ្សេងៗ'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.skill || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.Department_Kh || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '120px' }}></td>
                    </tr>
                  ));
                  // Summary row
                  rows.push(
                    <tr key="chief-summary" style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>សរុបនាយផ្នែក</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chiefs.length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>ប្រុស: {chiefs.filter(c => c.gender === 'Male').length}, ស្រី: {chiefs.filter(c => c.gender === 'Female').length}, ផ្សេងៗ: {chiefs.filter(c => c.gender === 'Other').length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}></td>
                    </tr>
                  );
                  return rows;
                })()}
              </tbody>
            </table>
            {/* Footer */}
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
          </div>
        )}
        {reportType === 'byDeputyChief' && (
          <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', maxWidth: '794px', minHeight: '1122px', margin: '0 auto', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            {/* Header */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍នាយផ្នែករង/នាយមណ្ឌលរង
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f3f3f3' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ល.រ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>គោត្តនាម និងនាម</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ភេទ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ជំនាញ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្នែក</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', width: '120px' }}>ផ្សេងៗ</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const deputies = filteredList.filter(hr => {
                    if (!hr.position) return false;
                    if (hr.Department_Kh && hr.Department_Kh.includes('ការិយាល័យ')) return false;
                    const pos = hr.position;
                    return pos.includes('នាយផ្នែករង') || pos.includes('នាយមណ្ឌលរង');
                  });
                  const rows = deputies.map((dep, idx) => (
                    <tr key={dep.name + idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{dep.khmerName || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{dep.gender === 'Male' ? 'ប្រុស' : dep.gender === 'Female' ? 'ស្រី' : 'ផ្សេងៗ'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{dep.skill || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{dep.Department_Kh || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '120px' }}></td>
                    </tr>
                  ));
                  // Summary row
                  rows.push(
                    <tr key="deputy-summary" style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>សរុបនាយផ្នែករង/នាយមណ្ឌលរង</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{deputies.length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>ប្រុស: {deputies.filter(c => c.gender === 'Male').length}, ស្រី: {deputies.filter(c => c.gender === 'Female').length}, ផ្សេងៗ: {deputies.filter(c => c.gender === 'Other').length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}></td>
                    </tr>
                  );
                  return rows;
                })()}
              </tbody>
            </table>
            {/* Footer */}
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
          </div>
        )}
        {reportType === 'bySchoolChief' && (
          <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', maxWidth: '794px', minHeight: '1122px', margin: '0 auto', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            {/* Header */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍នាយសាល/នាយសាលក្ដាប់រួម
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f3f3f3' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ល.រ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>គោត្តនាម និងនាម</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ភេទ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ជំនាញ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្នែក</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', width: '120px' }}>ផ្សេងៗ</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const chiefs = filteredList.filter(hr => {
                    if (!hr.position) return false;
                    if (hr.Department_Kh && hr.Department_Kh.includes('ការិយាល័យ')) return false;
                    const pos = hr.position;
                    return pos.includes('នាយសាល') || pos.includes('នាយសាលក្ដាប់រួម');
                  });
                  const rows = chiefs.map((chief, idx) => (
                    <tr key={chief.name + idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.khmerName || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chief.gender === 'Male' ? 'ប្រុស' : chief.gender === 'Female' ? 'ស្រី' : 'ផ្សេងៗ'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.skill || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.Department_Kh || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '120px' }}></td>
                    </tr>
                  ));
                  // Summary row
                  rows.push(
                    <tr key="schoolchief-summary" style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>សរុបនាយសាល/នាយសាលក្ដាប់រួម</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chiefs.length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>ប្រុស: {chiefs.filter(c => c.gender === 'Male').length}, ស្រី: {chiefs.filter(c => c.gender === 'Female').length}, ផ្សេងៗ: {chiefs.filter(c => c.gender === 'Other').length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}></td>
                    </tr>
                  );
                  return rows;
                })()}
              </tbody>
            </table>
            {/* Footer */}
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
          </div>
        )}
        {reportType === 'byDeputySchoolChief' && (
          <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', maxWidth: '794px', minHeight: '1122px', margin: '0 auto', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            {/* Header */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍នាយសាលរង
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f3f3f3' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ល.រ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>គោត្តនាម និងនាម</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ភេទ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ជំនាញ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្នែក</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', width: '120px' }}>ផ្សេងៗ</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const deputies = filteredList.filter(hr => {
                    if (!hr.position) return false;
                    if (hr.Department_Kh && hr.Department_Kh.includes('ការិយាល័យ')) return false;
                    const pos = hr.position;
                    return pos.includes('នាយសាលរង') || pos.includes('នាយមណ្ឌលរង');
                  });
                  const rows = deputies.map((dep, idx) => (
                    <tr key={dep.name + idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{dep.khmerName || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{dep.gender === 'Male' ? 'ប្រុស' : dep.gender === 'Female' ? 'ស្រី' : 'ផ្សេងៗ'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{dep.skill || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{dep.Department_Kh || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '120px' }}></td>
                    </tr>
                  ));
                  // Summary row
                  rows.push(
                    <tr key="deputyschool-summary" style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>សរុបនាយសាលរង</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{deputies.length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>ប្រុស: {deputies.filter(c => c.gender === 'Male').length}, ស្រី: {deputies.filter(c => c.gender === 'Female').length}, ផ្សេងៗ: {deputies.filter(c => c.gender === 'Other').length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}></td>
                    </tr>
                  );
                  return rows;
                })()}
              </tbody>
            </table>
            {/* Footer */}
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
          </div>
        )}
        {reportType === 'byChiefAndDeputy' && (
          <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', maxWidth: '794px', minHeight: '1122px', margin: '0 auto', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            {/* Header */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍នាយផ្នែក និងនាយផ្នែករង
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f3f3f3' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ល.រ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>គោត្តនាម និងនាម</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ភេទ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ជំនាញ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្នែក</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', width: '120px' }}>ផ្សេងៗ</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const chiefs = filteredList.filter(hr => {
                    if (!hr.position) return false;
                    if (hr.Department_Kh && hr.Department_Kh.includes('ការិយាល័យ')) return false;
                    const pos = hr.position;
                    return pos.includes('នាយផ្នែក') || pos.includes('នាយមណ្ឌល') || pos.includes('នាយផ្នែករង') || pos.includes('នាយមណ្ឌលរង');
                  });
                  const rows = chiefs.map((chief, idx) => (
                    <tr key={chief.name + idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.khmerName || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chief.gender === 'Male' ? 'ប្រុស' : chief.gender === 'Female' ? 'ស្រី' : 'ផ្សេងៗ'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.skill || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.Department_Kh || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '120px' }}></td>
                    </tr>
                  ));
                  // Summary row
                  rows.push(
                    <tr key="chiefdeputy-summary" style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>សរុបនាយផ្នែក និងនាយផ្នែករង</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chiefs.length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>ប្រុស: {chiefs.filter(c => c.gender === 'Male').length}, ស្រី: {chiefs.filter(c => c.gender === 'Female').length}, ផ្សេងៗ: {chiefs.filter(c => c.gender === 'Other').length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}></td>
                    </tr>
                  );
                  return rows;
                })()}
              </tbody>
            </table>
            {/* Footer */}
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
          </div>
        )}
        {reportType === 'bySchoolChiefAndDeputy' && (
          <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', maxWidth: '794px', minHeight: '1122px', margin: '0 auto', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            {/* Header */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍នាយសាល និងនាយសាលរង
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f3f3f3' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ល.រ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>គោត្តនាម និងនាម</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ភេទ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ជំនាញ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្នែក</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', width: '120px' }}>ផ្សេងៗ</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const chiefs = filteredList.filter(hr => {
                    if (!hr.position) return false;
                    if (hr.Department_Kh && hr.Department_Kh.includes('ការិយាល័យ')) return false;
                    const pos = hr.position;
                    return pos.includes('នាយសាល') || pos.includes('នាយសាលរង') || pos.includes('នាយសាលក្ដាប់រួម');
                  });
                  const rows = chiefs.map((chief, idx) => (
                    <tr key={chief.name + idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.khmerName || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chief.gender === 'Male' ? 'ប្រុស' : chief.gender === 'Female' ? 'ស្រី' : 'ផ្សេងៗ'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.skill || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.Department_Kh || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '120px' }}></td>
                    </tr>
                  ));
                  // Summary row
                  rows.push(
                    <tr key="schoolchiefdeputy-summary" style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>សរុបនាយសាល និងនាយសាលរង</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chiefs.length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>ប្រុស: {chiefs.filter(c => c.gender === 'Male').length}, ស្រី: {chiefs.filter(c => c.gender === 'Female').length}, ផ្សេងៗ: {chiefs.filter(c => c.gender === 'Other').length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}></td>
                    </tr>
                  );
                  return rows;
                })()}
              </tbody>
            </table>
            {/* Footer */}
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
          </div>
        )}
        {reportType === 'byAllChiefsAndDeputies' && (
          <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', maxWidth: '794px', minHeight: '1122px', margin: '0 auto', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            {/* Header */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍នាយផ្នែក និងនាយផ្នែករង នាយសាល និងនាយសាលរង
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f3f3f3' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ល.រ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>គោត្តនាម និងនាម</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ភេទ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ជំនាញ</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្នែក</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', width: '120px' }}>ផ្សេងៗ</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const chiefs = filteredList.filter(hr => {
                    if (!hr.position) return false;
                    if (hr.Department_Kh && hr.Department_Kh.includes('ការិយាល័យ')) return false;
                    const pos = hr.position;
                    return (
                      pos.includes('នាយផ្នែក') || pos.includes('នាយមណ្ឌល') || pos.includes('នាយផ្នែករង') || pos.includes('នាយមណ្ឌលរង') ||
                      pos.includes('នាយសាល') || pos.includes('នាយសាលរង') || pos.includes('នាយសាលក្ដាប់រួម')
                    );
                  });
                  const rows = chiefs.map((chief, idx) => (
                    <tr key={chief.name + idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.khmerName || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chief.gender === 'Male' ? 'ប្រុស' : chief.gender === 'Female' ? 'ស្រី' : 'ផ្សេងៗ'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.skill || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{chief.Department_Kh || ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '120px' }}></td>
                    </tr>
                  ));
                  // Summary row
                  rows.push(
                    <tr key="allchiefdeputy-summary" style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>សរុបនាយផ្នែក និងនាយផ្នែករង នាយសាល និងនាយសាលរង</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{chiefs.length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>ប្រុស: {chiefs.filter(c => c.gender === 'Male').length}, ស្រី: {chiefs.filter(c => c.gender === 'Female').length}, ផ្សេងៗ: {chiefs.filter(c => c.gender === 'Other').length}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}></td>
                    </tr>
                  );
                  return rows;
                })()}
              </tbody>
            </table>
            {/* Footer */}
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
          </div>
        )}
        {/* Skill summary table hidden for this report type as per screenshot */}
      </div>
      {/* Sidebar filter controls - right side, next to report */}
      <div style={{ minWidth: '340px', padding: '24px 0 0 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 16px #e0e0e0', border: '1px solid #eee', padding: '24px 24px 24px 24px', marginBottom: '24px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '17px', marginBottom: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>មុខដំណែង:</div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ស្វែងរក (ឈ្មោះ/លេខកូដ/តួនាទី)" style={{ fontSize: '15px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", marginBottom: '12px' }} />
          <div style={{ fontWeight: 'bold', fontSize: '17px', marginBottom: '8px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>ជ្រើសរើសផ្នែក:</div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ fontSize: '15px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", marginBottom: '12px' }}>
            <option value="">-- ជ្រើសរើសផ្នែក --</option>
            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
          </select>
          <div style={{ fontWeight: 'bold', fontSize: '17px', marginBottom: '8px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>ជ្រើសរើសតួនាទី:</div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ fontSize: '15px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", marginBottom: '12px' }}>
            <option value="">-- ជ្រើសរើសតួនាទី --</option>
            {roles.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          <div style={{ fontWeight: 'bold', fontSize: '17px', marginBottom: '8px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>ជ្រើសរើសភេទ:</div>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ fontSize: '15px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", marginBottom: '12px' }}>
            <option value="">-- ជ្រើសរើសភេទ --</option>
            <option value="Male">ប្រុស</option>
            <option value="Female">ស្រី</option>
            <option value="Other">ផ្សេងៗ</option>
          </select>
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '15px', marginRight: '8px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>ប្រភេទរបាយការណ៍តួនាទី:</label>
                <select value={["byDept","byRole","byChief","byDeputyChief","bySchoolChief","byDeputySchoolChief","byChiefAndDeputy","bySchoolChiefAndDeputy","byAllChiefsAndDeputies"].includes(reportType) ? reportType : ''} onChange={e => setReportType(e.target.value)} style={{ fontSize: '15px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>
                  <option value="">-- ជ្រើសរើស --</option>
                  <option value="byDept">របាយការណ៍បូកសរុបតួនាទី តាមផ្នែក</option>
                  <option value="byRole">របាយការណ៍បូកសរុបតួនាទី</option>
                  <option value="byChief">របាយការណ៍នាយផ្នែក/នាយមណ្ឌល</option>
                  <option value="byDeputyChief">របាយការណ៍នាយផ្នែករង/នាយមណ្ឌលរង</option>
                  <option value="bySchoolChief">របាយការណ៍នាយសាល/នាយសាលក្ដាប់រួម</option>
                  <option value="byDeputySchoolChief">របាយការណ៍នាយសាលរង</option>
                  <option value="byChiefAndDeputy">របាយការណ៍នាយផ្នែក និងនាយផ្នែករង</option>
                  <option value="bySchoolChiefAndDeputy">របាយការណ៍នាយសាល និងនាយសាលរង</option>
                  <option value="byAllChiefsAndDeputies">របាយការណ៍នាយផ្នែក និងនាយផ្នែករង នាយសាល និងនាយសាលរង</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '15px', marginRight: '8px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>ប្រភេទរបាយការណ៍ជំនាញ:</label>
                <select value={reportType === 'bySkill' ? 'bySkill' : ''} onChange={e => setReportType(e.target.value)} style={{ fontSize: '15px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>
                  <option value="">-- ជ្រើសរើស --</option>
                  <option value="bySkill">របាយការណ៍ជំនាញ</option>
                </select>
              </div>
            </div>
        {reportType === 'bySkill' ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
            <div className="a4-portrait" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", padding: '22px', width: '794px', minHeight: '1122px', background: '#fff', boxShadow: '0 0 8px #eee' }}>
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Khmer OS Muol Light, Khmer OS Muol, Noto Serif Khmer, Noto Sans Khmer, Arial, sans-serif', fontSize: '16px', fontWeight: 'normal', marginBottom: '2px', lineHeight: '1.2' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}> ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBotom: '18px', textAlign: 'center' }}>
              របាយការណ៍ជំនាញ
            </h2>
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555' }}>កាលបរិច្ឆេទ៖ {new Date().toLocaleDateString('km-KH')}</div>
            <div style={{ marginTop: '24px', fontWeight: 'bold', fontSize: '15px', color: '#222', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif" }}>
              <div>សង្ខេបជំនាញ និងប្រភេទមន្រ្តី:</div>
              {(() => {
                // Skill summary logic (reuse from chief/deputy block)
                const skillOfficerSummary = {};
                filteredList.forEach(hr => {
                  const skill = hr.skill || 'មិនបញ្ជាក់';
                  const officerType = hr.officerType || 'មិនបញ្ជាក់';
                  if (!skillOfficerSummary[skill]) skillOfficerSummary[skill] = { Civil: 0, Contract: 0, Other: 0 };
                  if (officerType === 'មន្រ្តីរាជការ' || officerType === 'Civil Servant') skillOfficerSummary[skill].Civil++;
                  else if (officerType === 'កិច្ចសន្យា' || officerType === 'Contract') skillOfficerSummary[skill].Contract++;
                  else skillOfficerSummary[skill].Other++;
                });
                return (
                  <table className="a4-report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff', marginTop: '0' }}>
                    <thead>
                      <tr style={{ background: '#f3f3f3' }}>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>ជំនាញ</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>មន្រ្តីរាជការ</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>កិច្ចសន្យា</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>ផ្សេងៗ</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>សរុប</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(skillOfficerSummary).map(([skill, counts]) => (
                        <tr key={skill}>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>{skill}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{counts.Civil}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{counts.Contract}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{counts.Other > 0 ? counts.Other : ''}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{counts.Civil + counts.Contract + counts.Other}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <hr style={{ margin: '32px 0 18px 0', border: 'none', borderTop: '2px solid #222', width: '100%' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", fontSize: '16px', fontWeight: 'bold', color: '#222' }}>
              <span>ប្រភេទជំនាញ ការងារ បន្ថែម</span>
              <input type="text" style={{ flex: '1', fontSize: '15px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', minWidth: '220px' }} placeholder="បញ្ចូល..." />
            </div>
            <div className="report-footer" style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '14px' }}>
              <div>ទំនាក់ទំនង៖ ០២៣ ៧២៣ ១២៣ | hr@mpwt.gov.kh</div>
              <div>© ក្រសួងសាធារណការ និងដឹកជញ្ជូន</div>
            </div>
            </div>
          </div>
        ) : null}
            {/* Dropdowns and skill report block end here. */}
          </div>
          {(filterDept || filterRole || filterGender || search) && (
            <button onClick={() => { setFilterDept(''); setFilterRole(''); setFilterGender(''); setSearch(''); }} style={{ fontSize: '15px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', background: '#eee', cursor: 'pointer', marginTop: '8px', width: '100%' }}>សម្អាត</button>
          )}
        </div>
      </div>
    </div>
  );
}
