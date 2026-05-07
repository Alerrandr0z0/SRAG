import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';

interface GenomicVariantsChartProps {
  data: {
    weeks: string[];
    variants: Record<string, number[]>;
  };
}

const VARIANT_COLORS: Record<string, string> = {
  'Ômicron': '#0f766e',
  'Delta': '#1d4ed8',
  'Alfa': '#b91c1c',
  'Beta': '#7c3aed',
  'Gama': '#d97706',
  'Recombinante': '#0369a1',
  'Desconhecida': '#94a3b8',
  'Outra': '#475569'
};

const GenomicVariantsChart: React.FC<GenomicVariantsChartProps> = ({ data }) => {
  const weeks = data?.weeks || [];
  const variantsDict = data?.variants || {};
  const variantNames = Object.keys(variantsDict);
  const shouldRenderChart = weeks.length > 0 && variantNames.length > 0;

  const { canvasRef } = useChartJs(
    () => ({
      type: 'line',
      data: {
        labels: weeks,
        datasets: variantNames.map((variant) => ({
          label: variant,
          data: variantsDict[variant],
          backgroundColor: VARIANT_COLORS[variant] || COLORS.SECONDARY,
          borderColor: 'white',
          borderWidth: 1,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
        })),
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            callbacks: {
              label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) label += `${context.parsed.y}%`;
                return label;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { stacked: true, min: 0, max: 100, ticks: { callback: (value: string | number) => `${value}%` } },
        },
      },
    }),
    [weeks, variantNames, variantsDict],
  );

  if (!shouldRenderChart) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <p>Aguardando dados de sequenciamento genômico para o período selecionado.</p>
      </div>
    );
  }

  return <canvas ref={canvasRef} />;
};

export default GenomicVariantsChart;
