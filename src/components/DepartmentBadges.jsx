import React, { useState } from 'react';

const DepartmentBadges = ({ departments, maxVisible = 2 }) => {
  const [showAll, setShowAll] = useState(false);
  
  if (!departments || departments.length === 0) {
    return <span className="text-gray-400 text-sm">គ្មានផ្នែក</span>;
  }

  const departmentArray = Array.isArray(departments) ? departments : [departments];
  const visibleDepts = showAll ? departmentArray : departmentArray.slice(0, maxVisible);
  const remainingCount = departmentArray.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1 items-center" style={{ minHeight: '24px' }}>
      {visibleDepts.map((dept, index) => (
        <span
          key={index}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
          style={{ 
            fontSize: '10px', 
            lineHeight: '12px',
            maxWidth: '80px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={dept}
        >
          {dept}
        </span>
      ))}
      
      {!showAll && remainingCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors"
          style={{ fontSize: '10px', lineHeight: '12px' }}
          title={`មានផ្នែកបន្ថែមទៀត ${remainingCount}`}
        >
          +{remainingCount}
        </button>
      )}
      
      {showAll && departmentArray.length > maxVisible && (
        <button
          onClick={() => setShowAll(false)}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors"
          style={{ fontSize: '10px', lineHeight: '12px' }}
        >
          បង្រួម
        </button>
      )}
    </div>
  );
};

export default DepartmentBadges;