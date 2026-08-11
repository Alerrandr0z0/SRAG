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
    const lcl = chartData[0]?.lcl || 0;

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
            label: 'Limite Inferior (LCL)',
            data: timeKeys.map(() => lcl),
            borderColor: COLORS.SUCCESS,
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
  if (!data || data.control_chart.length === 0) {
    return (
      <div className="w-full h-[300px] flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
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
        <span className="text-xs text-slate-400 mt-1">
          Nenhum registro encontrado para os filtros selecionados
        </span>
      </div>
    );
  }

  return (
    <div className="responsive-grid-2col" style={{ marginTop: '1.5rem' }}>
      <div className="chart-wrap" style={{ height: '350px', minHeight: '300px' }}>
        <canvas ref={canvasControl} />
      </div>
      <div className="chart-wrap" style={{ height: '350px', minHeight: '300px' }}>
        <canvas ref={canvasContrast} />
      </div>
    </div>
  );
}
