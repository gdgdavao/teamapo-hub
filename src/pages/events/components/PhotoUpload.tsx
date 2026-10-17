import React, { useState } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/UI';

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
      <div className="flex flex-wrap items-center gap-md">
        {currentPhotoUrl ? (
          <div className="relative shrink-0">
            <img
              src={currentPhotoUrl}
              alt="Preview"
              className="h-32 w-32 rounded-lg border border-outline-variant object-cover"
            />
            {!disabled && (
              // A 24px dismiss target in the corner of a 128px thumbnail. It is
              // the one control here that a thumb reaches for first and misses
              // most often, so it carries the same 48px floor as everything else.
              <Button
                variant="danger"
                onClick={handleRemove}
                aria-label="Remove photo"
                className="absolute -right-2 -top-2 min-h-control min-w-[48px] rounded-full p-0"
                icon={<XMarkIcon />}
              />
            )}
          </div>
        ) : (
          <label
            className={`flex h-32 w-32 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
              dragActive
                ? 'border-primary bg-primary-container'
                : 'border-outline-variant bg-surface hover:bg-surface-container-low'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <PhotoIcon className="h-8 w-8 text-outline" aria-hidden="true" />
            <span className="mt-2 text-center text-sm text-on-surface-variant">{placeholder}</span>
            <input
              type="file"
              className="sr-only"
              accept={accept}
              onChange={handleFileInputChange}
              disabled={disabled}
            />
          </label>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm text-on-surface-variant">
            Upload a photo for the speaker. Recommended size: 400x400 pixels (1:1 ratio).
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Maximum file size: {maxSize}MB. Supported formats: JPG, PNG, GIF, WebP
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="animate-rise-in motion-reduce:animate-none rounded-md border border-error-container bg-error-container p-2 text-sm text-on-error-container"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
