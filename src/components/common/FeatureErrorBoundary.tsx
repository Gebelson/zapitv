import React from 'react';

interface FeatureErrorBoundaryProps {
  children: React.ReactNode;
  featureName: string;
  onClose?: () => void;
  closeLabel?: string;
  fallback?: React.ReactNode;
}

export class FeatureErrorBoundary extends React.Component<FeatureErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.featureName}] Falha ao renderizar:`, error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 p-4 text-white" role="alertdialog" aria-modal="true" aria-label={`Erro em ${this.props.featureName}`}>
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0f19] p-6 text-center shadow-2xl">
          <h2 className="text-xl font-black">Não foi possível abrir {this.props.featureName} agora</h2>
          <p className="mt-3 text-sm text-gray-400">A página continua disponível. Tente novamente em instantes.</p>
          <button
            type="button"
            className="mt-6 rounded-xl bg-[#007df7] px-6 py-3 text-sm font-bold text-white"
            onClick={this.props.onClose ?? (() => window.location.reload())}
          >
            {this.props.closeLabel ?? (this.props.onClose ? 'Voltar aos detalhes' : 'Recarregar página')}
          </button>
        </div>
      </div>
    );
  }
}
