import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  className?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, className = '' }) => {
  return (
    <article className={`panel ${className}`}>
      <p>{label}</p>
      <h2>{value}</h2>
    </article>
  );
};

export default KpiCard;
