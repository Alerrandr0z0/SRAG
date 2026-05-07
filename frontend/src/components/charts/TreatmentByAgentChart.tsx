import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';

interface TreatmentByAgentChartProps {
  data: Array<{ treatment: string; agent: string; deaths: number }>;
}

const AGENT_COLORS: Record<string, string> = {
  'VSR': '#0f766e',
  'Influenza': '#1d4ed8',
  'COVID-19': '#b91c1c',
  'Outros Vírus': '#7c3aed',
  'Outro Agente': '#475569',
  'Não Especificada': '#94a3b8',
};

const TreatmentByAgentChart: React.FC<TreatmentByAgentChartProps> = ({ data }) => {
  const treatments = ['Invasivo', 'Não Invasivo', 'Sem Suporte', 'Ignorado'];
  const agents = Array.from(new Set(data.map((d) => d.agent))).filter(Boolean);

  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels: treatments,
        datasets: agents.map((agent) => ({
          label: agent,
          data: treatments.map((t) => data.filter((d) => d.treatment === t && d.agent === agent).reduce((sum, d) => sum + d.deaths, 0)),
          backgroundColor: AGENT_COLORS[agent] || COLORS.SECONDARY,
          borderWidth: 0,
          borderRadius: 6,
        })),
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
        },
      },
    }),
    [data, agents],
  );

  return <canvas ref={canvasRef} />;
};

export default TreatmentByAgentChart;
