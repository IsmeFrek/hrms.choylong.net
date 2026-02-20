import React from 'react';

export default function ExportAllFieldsButton({ handleExportAllFields }) {
  return (
    <button
      onClick={handleExportAllFields}
      className="bg-green-600 text-white px-3 py-1 rounded"
    >
      នាំចេញទាំងអស់
    </button>
  );
}
