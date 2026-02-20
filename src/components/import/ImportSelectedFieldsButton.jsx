import React from 'react';

export default function ImportSelectedFieldsButton({ setShowImportPanel }) {
  return (
    <button
      onClick={() => setShowImportPanel(true)}
      className="bg-purple-600 text-white px-3 py-1 rounded"
    >
      នាំចូលតាមជ្រើសរើស
    </button>
  );
}
