import React from 'react';
import { useChartJs } from '../../hooks/useChartJs';

interface ImagingProfileChartProps {
  data: {
    raiox: Array<{ label: string; count: number }>;
    tomo: Array<{ label: string; count: number }>;
  };
}

const RESULT_COLORS: Record<string, string> = {
  // Raio-X
  Normal: '#10b981',
  Infiltrado: '#f59e0b',
  Consolidação: '#ef4444',
  Misto: '#8b5cf6',
  Outro: '#64748b',
  // Tomografia
  Típico: '#059669',
  Indeterminado: '#fbbf24',
  Atípico: '#f87171',
  Negativo: '#3b82f6',
};

const ImagingProfileChart: React.FC<ImagingProfileChartProps> = ({ data }) => {
  const labels = ['Raio-X', 'Tomografia'];
  const allPossibleLabels = Array.from(
    new Set([...data.raiox.map((d) => d.label), ...data.tomo.map((d) => d.label)]),
  );
  const raioxTotal = data.raiox.reduce((s, d) => s + d.count, 0) || 1;
  const tomoTotal = data.tomo.reduce((s, d) => s + d.count, 0) || 1;

  const datasets = allPossibleLabels
    .map((label) => ({
      label,
      data: [
        Number(
          (((data.raiox.find((d) => d.label === label)?.count || 0) / raioxTotal) * 100).toFixed(1),
        ),
        Number(
          (((data.tomo.find((d) => d.label === label)?.count || 0) / tomoTotal) * 100).toFixed(1),
        ),
      ],
      backgroundColor: RESULT_COLORS[label] || '#e2e8f0',
      borderWidth: 0,
      borderRadius: 4,
    }))
    .filter((ds) => ds.data[0] > 0 || ds.data[1] > 0);

  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: { labels, datasets },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: {
            stacked: true,
            min: 0,
            max: 100,
            ticks: { callback: (v: string | number) => `${v}%` },
          },
          y: { stacked: true },
        },
      },
    }),
    [data, labels, datasets],
  );

  return <canvas ref={canvasRef} />;
};

export default ImagingProfileChart;
