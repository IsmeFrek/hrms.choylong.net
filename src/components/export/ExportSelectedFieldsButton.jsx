import React from 'react';

export default function ExportSelectedFieldsButton({ setShowFieldPanel }) {
  return (
    <button
      onClick={() => setShowFieldPanel(true)}
      className="bg-blue-600 text-white px-3 py-1 rounded"
    >
      នាំចេញតាមជ្រើសរើស
    </button>
  );
}
