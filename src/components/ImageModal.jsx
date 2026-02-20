import React from 'react';
import { X } from 'lucide-react';

const ImageModal = ({ isOpen, onClose, imageUrl, altText, src, alt }) => {
  if (!isOpen) return null;

  // Use either imageUrl/altText or src/alt props for flexibility
  const imageSrc = imageUrl || src;
  const imageAlt = altText || alt;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-[95vw] max-h-[95vh] bg-white rounded-lg shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors duration-200"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
        
        <div className="p-4">
          <img
            src={imageSrc}
            alt={imageAlt || "Employee photo"}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-lg"
            onError={(e) => {
              e.target.src = '/api/placeholder/300/300';
            }}
          />
          
          {imageAlt && (
            <div className="mt-3 text-center text-gray-700 font-medium">
              {imageAlt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
