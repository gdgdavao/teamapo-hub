import React from 'react';
import apohubTitle from '@assets/apohub-title.svg';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const AuthShell: React.FC<AuthShellProps> = ({ title, subtitle, children, footer }) => {
  return (
    <div className="min-h-dvh bg-surface-container-low flex flex-col justify-center px-md py-lg sm:px-lg">
      <div className="w-full max-w-md mx-auto">
        <div className="flex justify-center mb-lg">
          <img src={apohubTitle} alt="APOHUB" className="h-12 sm:h-16" />
        </div>

        <div className="bg-surface border border-outline-variant rounded-lg p-md sm:p-lg shadow-elevation-0">
          <div className="mb-md text-center">
            <h1 className="text-2xl font-bold text-on-surface">{title}</h1>
            {subtitle && (
              <p className="mt-2xs text-sm text-on-surface-variant">{subtitle}</p>
            )}
          </div>
          {children}
        </div>

        {footer && <div className="mt-md text-center text-sm text-on-surface-variant">{footer}</div>}
      </div>
    </div>
  );
};

export default AuthShell;