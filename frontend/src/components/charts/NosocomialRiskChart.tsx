import type { TooltipItem } from 'chart.js';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import type { DiagnosticResilienceResponse, NosocomialRiskResponse } from '../../types/epi';

interface Props {
  data: NosocomialRiskResponse | null;
  diagData: DiagnosticResilienceResponse | null;
  loading: boolean;
}

export function NosocomialRiskChart({ data, diagData, loading }: Props) {
  const { canvasRef: canvasControl } = useChartJs(() => {
    if (!data || data.control_chart.length === 0) return { type: 'line', data: { datasets: [] } };

    const chartData = data.control_chart;
    const timeKeys = chartData.map((d) => d.time_key);
    // Formatando de "01" para "SE 1"
    const formattedLabels = timeKeys.map((tk) => `SE ${parseInt(tk, 10)}`);
    const rates = chartData.map((d) => d.rate);
    const mean = chartData[0]?.mean || 0;
    const ucl = chartData[0]?.ucl || 0;

    // Métodos Diagnósticos no Eixo Y1 (Esquerda) como Barras Empilhadas
    const methods = Array.from(new Set(diagData?.streamgraph?.map((d) => d.diag_method) || []));
    const methodDatasets = methods.map((method, i) => {
      const color = COLORS.CHART[i % COLORS.CHART.length];
      return {
        type: 'bar' as const,
        label: method,
        data: timeKeys.map((tk) => {
          const point = diagData?.streamgraph?.find(
            (d) => d.time_key === tk && d.diag_method === method,
          );
          return point ? point.count : 0;
        }),
        backgroundColor: `${color}35`,
        borderColor: color,
        borderWidth: 0.5,
        yAxisID: 'y1',
        order: 2,
      };
    });

    // Controle Nosocomial no Eixo Y2 (Direita) como Linha
    const nosoDatasets = [
      {
        type: 'line' as const,
        label: 'Taxa Nosocomial',
        data: rates,
        borderColor: '#e11d48',
        backgroundColor: '#e11d48',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        yAxisID: 'y2',
        order: 1,
      },
      {
        type: 'line' as const,
        label: 'Limite Crítico (UCL)',
        data: timeKeys.map(() => ucl),
        borderColor: '#f43f5e',
        borderDash: [5, 5],
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y2',
        order: 1,
      },
      {
        type: 'line' as const,
        label: 'Média Histórica',
        data: timeKeys.map(() => mean),
        borderColor: '#eab308',
        borderDash: [2, 2],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y2',
        order: 1,
      },
    ];

    return {
      type: 'bar',
      data: {
        labels: formattedLabels,
        datasets: [...nosoDatasets, ...methodDatasets],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index' as const,
          intersect: false,
        },
        plugins: {
          tooltip: {
            filter: (item: TooltipItem<'bar' | 'line'>) => item.raw !== 0,
            padding: 6,
            bodySpacing: 3,
            titleSpacing: 3,
            titleFont: { size: 9, weight: 'bold' },
            bodyFont: { size: 9 },
          },
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              font: { size: 9 },
            },
          },
          title: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            stacked: true,
            ticks: {
              autoSkip: true,
              maxTicksLimit: 12,
              font: { size: 9 },
            },
          },
          y1: {
            type: 'linear' as const,
            position: 'left' as const,
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: 'Volume Diagnósticos Semanal', font: { size: 10 } },
            ticks: { font: { size: 9 } },
          },
          y2: {
            type: 'linear' as const,
            position: 'right' as const,
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Taxa Nosocomial (por 1.000)', font: { size: 10 } },
            ticks: { font: { size: 9 } },
          },
        },
      },
    };
  }, [data, diagData]);

  if (loading) {
    return (
      <article
        style={{
          background: 'transparent',
          border: 'none',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '380px',
          width: '100%',
        }}
      >
        <span className="text-slate-400">Carregando...</span>
      </article>
    );
  }

  if (!data || data.control_chart.length === 0) {
    return (
      <article
        style={{
          background: 'transparent',
          border: 'none',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '380px',
          width: '100%',
        }}
      >
        <svg
          className="w-8 h-8 text-slate-300 mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <span className="text-sm font-medium text-slate-500">Volume de dados insuficiente</span>
      </article>
    );
  }

  return (
    <article
      style={{
        background: 'transparent',
        border: 'none',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        height: '380px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
        Dinâmica Temporal: Capacidade de Testagem e Risco Nosocomial
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <canvas ref={canvasControl} />
      </div>
    </article>
  );
}
