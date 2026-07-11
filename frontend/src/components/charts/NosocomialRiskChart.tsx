import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import type { NosocomialRiskResponse } from '../../types/epi';

interface Props {
  data: NosocomialRiskResponse | null;
  loading: boolean;
}

export function NosocomialRiskChart({ data, loading }: Props) {
  const { canvasRef: canvasControl } = useChartJs(() => {
    if (!data || data.control_chart.length === 0) return { type: 'line', data: { datasets: [] } };

    const chartData = data.control_chart;
    const timeKeys = chartData.map((d) => d.time_key);
    const rates = chartData.map((d) => d.rate);
    const mean = chartData[0]?.mean || 0;
    const ucl = chartData[0]?.ucl || 0;

    return {
      type: 'line',
      data: {
        labels: timeKeys,
        datasets: [
          {
            label: 'Taxa Nosocomial',
            data: rates,
            borderColor: COLORS.PRIMARY,
            backgroundColor: COLORS.PRIMARY,
            borderWidth: 2,
            tension: 0.3,
          },
          {
            label: 'Limite Crítico (UCL)',
            data: timeKeys.map(() => ucl),
            borderColor: COLORS.DANGER,
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Média Histórica',
            data: timeKeys.map(() => mean),
            borderColor: COLORS.WARNING,
            borderDash: [2, 2],
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Radar de Risco Nosocomial (Taxa / 1k)' },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true },
        },
      },
    };
  }, [data]);

  const { canvasRef: canvasContrast } = useChartJs(() => {
    if (!data) return { type: 'bar', data: { datasets: [] } };

    const lethality = data.lethality;
    return {
      type: 'bar',
      data: {
        labels: ['SRAG Nosocomial', 'SRAG Comunitária'],
        datasets: [
          {
            label: 'Letalidade (CFR %)',
            data: [lethality.nosocomial, lethality.community],
            backgroundColor: [COLORS.DANGER, COLORS.SUCCESS],
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Custo Oculto: Letalidade (Comunitária vs Hospitalar)' },
        },
        scales: {
          x: { max: 100, beginAtZero: true },
        },
      },
    };
  }, [data]);

  if (loading)
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-400">Carregando...</div>
    );
  if (!data || data.control_chart.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full mt-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-[350px]">
        <canvas ref={canvasControl} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-[350px]">
        <canvas ref={canvasContrast} />
      </div>
    </div>
  );
}
