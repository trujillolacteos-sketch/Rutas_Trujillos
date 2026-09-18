import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    (this as any).setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-600 bg-red-50 rounded-xl m-4 border border-red-200">
          <h1 className="text-xl font-bold mb-4">Algo salió mal en este componente.</h1>
          <p className="font-mono text-sm whitespace-pre-wrap">{this.state.error?.toString()}</p>
          <details className="mt-4 text-xs font-mono whitespace-pre-wrap opacity-70">
            <summary>Ver detalles de la traza (stack trace)</summary>
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default ErrorBoundary;
