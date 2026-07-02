import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  className?: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
  loading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  className = '',
  type = 'info',
  loading = false,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success': // Internações
        return (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        );
      case 'warning': // UTI
        return (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 'danger': // Óbitos / Letalidade
        return (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        );
      default:
        return (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
    }
  };

  const renderValue = () => {
    const valStr = String(value);
    if (valStr.endsWith('%')) {
      const num = valStr.slice(0, -1);
      return (
        <>
          {num}
          <span style={{ fontSize: '0.65em', opacity: 0.8, marginLeft: '2px', fontWeight: 600 }}>
            %
          </span>
        </>
      );
    }
    return value;
  };

  return (
    <article
      className={`panel kpi-card kpi-card--${type} ${loading ? 'kpi-card--loading' : ''} ${className}`}
    >
      {loading ? (
        <div className="kpi-card-skeleton">
          <div className="kpi-skeleton-label" />
          <div className="kpi-skeleton-value" />
        </div>
      ) : (
        <div className="kpi-card-content" style={{ width: '100%' }}>
          <div className="kpi-card-header">
            <p className="kpi-label">{label}</p>
            <span className="kpi-icon">{getIcon()}</span>
          </div>
          <h2 className="kpi-value">{renderValue()}</h2>
        </div>
      )}
    </article>
  );
};

export default KpiCard;
