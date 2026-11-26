import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan pada tampilan aplikasi.',
    };
  }

  handleResetData = () => {
    try {
      localStorage.removeItem('sim_serpo_state_v2');
      localStorage.removeItem('sim_serpo_user_v2');
      localStorage.removeItem('sim_serpo_platform_v1');
      sessionStorage.removeItem('sim_serpo_user_v2');
    } catch {
      // ignore storage cleanup errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
          <div
            role="alert"
            className="bg-white rounded-xl border border-[#E2E8F0] max-w-md w-full p-6 shadow-sm space-y-4 text-center"
          >
            <h1 className="text-lg font-bold text-[#0F172A]">
              Terjadi kendala saat memuat aplikasi
            </h1>
            <p className="text-xs text-[#475569] leading-relaxed">
              {this.state.errorMessage ??
                'Data lokal kemungkinan rusak atau tidak sesuai versi skema terbaru.'}
            </p>
            <button
              type="button"
              onClick={this.handleResetData}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#E61E25] hover:bg-[#C81920] text-white text-xs font-semibold transition-colors"
            >
              Reset data
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
