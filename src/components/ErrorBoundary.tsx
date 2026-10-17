import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon, HomeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-surface-container-low flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center justify-center mb-6">
                <div className="rounded-full bg-error-container p-4">
                  <ExclamationTriangleIcon className="h-12 w-12 text-error" />
                </div>
              </div>

              <h1 className="text-3xl font-bold text-on-surface text-center mb-4">
                Oops! Something went wrong
              </h1>

              <p className="text-on-surface-variant text-center mb-6">
                We encountered an unexpected error. Don't worry, our team has been notified and we're working on it.
              </p>

              {/* Error Details (only in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 bg-error-container border border-outline-variant rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-on-error-container mb-2">Error Details (Development Only):</h3>
                  <p className="text-sm text-error font-mono mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="text-sm text-error">
                      <summary className="cursor-pointer font-semibold mb-1">Stack Trace</summary>
                      <pre className="whitespace-pre-wrap overflow-auto max-h-60 bg-error-container p-2 rounded">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleReload}
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                >
                  <ArrowPathIcon className="h-5 w-5 mr-2" />
                  Reload Page
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="inline-flex items-center justify-center px-6 py-3 border border-outline-variant text-base font-medium rounded-md text-on-surface-variant bg-white hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                >
                  <HomeIcon className="h-5 w-5 mr-2" />
                  Go Home
                </button>
              </div>

              {/* Help Text */}
              <div className="mt-8 text-center">
                <p className="text-sm text-on-surface-variant">
                  If this problem persists, please contact our support team.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
