import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F6F2] flex items-center justify-center p-6 font-sans">
          <div className="bg-white border border-[#DFE4DD] rounded-xl max-w-md w-full p-6 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-lg bg-[#B74747]/10 border border-[#B74747]/20 flex items-center justify-center text-[#B74747]">
              <AlertTriangle size={20} />
            </div>
            
            <div>
              <h2 className="text-base font-semibold text-[#202925]">Interface Interruption</h2>
              <p className="text-xs text-[#68736C] mt-1">
                A rendering issue was caught by PredictX error boundary. Your data and session are safe.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-[#FAFBF9] border border-[#DFE4DD] rounded-md p-3 font-mono text-[11px] text-[#B74747] overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 px-3 py-2 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Reload Application</span>
              </button>
              <button
                onClick={this.handleReset}
                className="px-3 py-2 rounded-md border border-[#DFE4DD] bg-white hover:bg-[#F0F2ED] text-[#202925] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Home size={13} />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

