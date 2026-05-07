import React from 'react';
import { useChartJs } from '../../hooks/useChartJs';

interface MaternalOutcomeChartProps {
  data: Array<{
    group: string;
    cure: number;
    icu: number;
    death: number;
    total: number;
  }>;
}

const MaternalOutcomeChart: React.FC<MaternalOutcomeChartProps> = ({ data }) => {
  const labels = data.map(d => d.group);
  const cureData = data.map(d => (d.cure / d.total) * 100);
  const icuData = data.map(d => (d.icu / d.total) * 100);
  const deathData = data.map(d => (d.death / d.total) * 100);

  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Cura (Sem UTI)',
            data: cureData,
            backgroundColor: '#0d9488',
            stack: 'outcome',
          },
          {
            label: 'UTI (Sobrevivente)',
            data: icuData,
            backgroundColor: '#d97706',
            stack: 'outcome',
          },
          {
            label: 'Óbito',
            data: deathData,
            backgroundColor: '#be123c',
            stack: 'outcome',
          },
        ],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: (context: { raw: unknown; dataIndex: number; datasetIndex: number; dataset: { label?: string } }) => {
                const val = Number(context.raw);
                const originalVal = context.datasetIndex === 0
                  ? data[context.dataIndex].cure
                  : context.datasetIndex === 1
                    ? data[context.dataIndex].icu
                    : data[context.dataIndex].death;
                return `${context.dataset.label}: ${val.toFixed(1)}% (${originalVal} casos)`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            max: 100,
            ticks: { callback: (val: string | number) => `${val}%` },
          },
          y: { stacked: true },
        },
      },
    }),
    [data, labels, cureData, icuData, deathData],
  );

  return <canvas ref={canvasRef} />;
};

export default MaternalOutcomeChart;
