import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
  /** Fill the viewport. Only for route-level guards. */
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-4',
  lg: 'w-12 h-12 border-4'
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  text,
  fullScreen = false
}) => (
  <div
    className={`flex flex-col items-center justify-center ${fullScreen ? 'min-h-screen' : 'py-8'} ${className}`}
    role="status"
    aria-live="polite"
  >
    <div className={`loading-spinner ${sizeClasses[size]}`} aria-hidden="true" />
    <span className="sr-only">Loading</span>
    {text && <p className="mt-2 text-sm text-on-surface-variant font-medium">{text}</p>}
  </div>
);

export default LoadingSpinner;