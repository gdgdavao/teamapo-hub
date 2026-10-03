import React, { useState } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface PhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoChange: (file: File | null, previewUrl?: string) => void;
  onPhotoRemove?: () => void;
  accept?: string;
  maxSize?: number; // in MB
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
  currentPhotoUrl,
  onPhotoChange,
  onPhotoRemove,
  accept = "image/*",
  maxSize = 5, // 5MB default
  className = "",
  placeholder = "Upload Photo",
  disabled = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return false;
    }

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleFileSelect = (file: File) => {
    if (!validateFile(file)) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string;
      onPhotoChange(file, previewUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemove = () => {
    onPhotoRemove?.();
    setError(null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center space-x-4">
        {currentPhotoUrl ? (
          <div className="relative">
            <img
              src={currentPhotoUrl}
              alt="Preview"
              className="w-32 h-32 object-cover rounded-lg border border-gray-300"
            />
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <label 
            className={`flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:bg-gray-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <PhotoIcon className="w-8 h-8 text-gray-400" />
            <span className="mt-2 text-sm text-gray-500">{placeholder}</span>
            <input
              type="file"
              className="hidden"
              accept={accept}
              onChange={handleFileInputChange}
              disabled={disabled}
            />
          </label>
        )}
        
        <div className="flex-1">
          <p className="text-sm text-gray-600">
            Upload a photo for the speaker. Recommended size: 400x400 pixels (1:1 ratio).
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Maximum file size: {maxSize}MB. Supported formats: JPG, PNG, GIF, WebP
          </p>
        </div>
      </div>
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
          {error}
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
