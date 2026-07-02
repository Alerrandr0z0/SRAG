import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  className?: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
  loading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, className = '', loading = false }) => {
  const renderValue = () => {
    const valStr = String(value);
    if (valStr.endsWith('%')) {
      const num = valStr.slice(0, -1);
      return (
        <>
          {num}
          <span className="kpi-value-unit">%</span>
        </>
      );
    }
    return value;
  };

  return (
    <article className={`panel kpi-card ${loading ? 'kpi-card--loading' : ''} ${className}`}>
      {loading ? (
        <div className="kpi-card-skeleton">
          <div className="kpi-skeleton-label" />
          <div className="kpi-skeleton-value" />
        </div>
      ) : (
        <>
          <p className="kpi-label">{label}</p>
          <h2 className="kpi-value">{renderValue()}</h2>
        </>
      )}
    </article>
  );
};

export default KpiCard;
