import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import * as Epi from '../../types/epi';

interface PiramideEtariaProps {
  data: Epi.PyramidRow[];
}

const PiramideEtariaChart: React.FC<PiramideEtariaProps> = ({ data = [] }) => {
  const maleValues = data.map((r) => Number(r.male || 0));
  const femaleValues = data.map((r) => Number(r.female || 0));
  const maxAbs = Math.max(1, ...maleValues, ...femaleValues) * 1.1;

  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels: data.map((r) => r.age_band || 'N/A'),
        datasets: [
          {
            label: 'Masculino',
            data: maleValues.map((v) => -v),
            backgroundColor: COLORS.SECONDARY,
          },
          {
            label: 'Feminino',
            data: femaleValues,
            backgroundColor: COLORS.ACCENT,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context: { dataset: { label?: string }; raw: number }) => {
                const label = context.dataset.label ?? '';
                const value = Math.abs(context.raw);
                return `${label}: ${value} casos`;
              },
            },
          },
        },
        scales: {
          x: {
            min: -maxAbs,
            max: maxAbs,
            ticks: { callback: (value: string | number) => Math.abs(Number(value)) },
          },
          y: { stacked: true },
        },
      },
    }),
    [data, maxAbs, maleValues, femaleValues],
  );

  return <canvas ref={canvasRef} />;
};

export default PiramideEtariaChart;
