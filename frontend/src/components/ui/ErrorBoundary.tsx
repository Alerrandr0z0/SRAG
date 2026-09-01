import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px 16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            background: 'var(--bg-panel)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
            {this.props.fallbackTitle ?? 'Não foi possível carregar esta visualização'}
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.5 }}>
            Ocorreu um erro ao renderizar este gráfico. Tente ajustar os filtros ou recarregar a página.
          </div>
          {this.state.message && (
            <div
              style={{
                marginTop: 8,
                fontSize: 10,
                color: 'var(--text-muted)',
                wordBreak: 'break-word',
              }}
            >
              {this.state.message}
            </div>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: null })}
            style={{
              marginTop: 12,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-panel)',
              color: 'var(--text-main)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
