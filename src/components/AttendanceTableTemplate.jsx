import React from 'react';

export default function AttendanceTableTemplate({ data = [] }) {
  return (
    <div className="p-6">
      <h3 className="text-2xl font-semibold mb-4">វត្តមាន</h3>
      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th>ល.រ</th>
              <th>គោត្តនាម និងនាម</th>
              <th>ម៉ោងចូល</th>
              <th>ស្ថានភាពចូល</th>
              <th>ម៉ោងចេញ</th>
              <th>ស្ថានភាពចេញ</th>
              <th>កំណត់សម្គាល់</th>
              <th>សកម្មភាព</th>
              <th>លេខកាត</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-4">No records</td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td>{idx + 1}</td>
                  <td>{row.name}</td>
                  <td>{row.checkIn}</td>
                  <td>{row.statusIn}</td>
                  <td>{row.checkOut}</td>
                  <td>{row.statusOut}</td>
                  <td>{row.notes}</td>
                  <td>
                    <button style={{background: "#06b6d4", color: "#fff", marginRight: 6, borderRadius: 6, padding: "6px 8px"}}>Chat</button>
                    <button style={{background: "#10b981", color: "#fff", marginRight: 6, borderRadius: 6, padding: "6px 8px"}}>Edit</button>
                    <button style={{background: "#ef4444", color: "#fff", borderRadius: 6, padding: "6px 8px"}}>Delete</button>
                  </td>
                  <td>{row.card}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
