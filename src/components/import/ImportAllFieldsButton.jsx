import React from 'react';

export default function ImportAllFieldsButton({ handleImportAllFields }) {
  const fileInputRef = React.useRef();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImportAllFields(file);
    }
    e.target.value = '';
  };

  return (
    <>
      <button
        className="bg-orange-600 text-white px-3 py-1 rounded"
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
      >
        នាំចូលទាំងអស់
      </button>
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </>
  );
}
