import React, { ReactNode } from 'react';

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: string;
  className?: string;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({
  title,
  subtitle,
  children,
  height = '320px',
  className = '',
}) => {
  return (
    <article className={`panel ${className}`}>
      <div className="section-header">
        <h3>{title}</h3>
      </div>
      {subtitle && <p className="meta">{subtitle}</p>}
      <div className="chart-wrap" style={{ height }}>
        {children}
      </div>
    </article>
  );
};

export default ChartWrapper;
