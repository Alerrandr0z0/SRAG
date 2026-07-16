import type { TooltipItem } from 'chart.js';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import type { DiagnosticResilienceResponse } from '../../types/epi';

interface Props {
  data: DiagnosticResilienceResponse | null;
  loading: boolean;
}

export function DiagnosticResilienceChart({ data, loading }: Props) {
  const { canvasRef: canvasArea } = useChartJs(() => {
    if (!data || data.streamgraph.length === 0) return { type: 'line', data: { datasets: [] } };

    const streamData = data.streamgraph;
    const timeKeys = Array.from(new Set(streamData.map((d) => d.time_key))).sort();
    const methods = Array.from(new Set(streamData.map((d) => d.diag_method)));

    const datasets = methods.map((method, i) => {
      const color = COLORS.CHART[i % COLORS.CHART.length];
      return {
        label: method,
        data: timeKeys.map((tk) => {
          const point = streamData.find((d) => d.time_key === tk && d.diag_method === method);
          return point ? point.count : 0;
        }),
        backgroundColor: `${color}80`,
        borderColor: color,
        borderWidth: 1,
        fill: true,
        tension: 0.4,
      };
    });

    return {
      type: 'line',
      data: { labels: timeKeys, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Transição Tecnológica Diagnóstica' },
        },
        scales: {
          x: { grid: { display: false } },
          y: { stacked: true, beginAtZero: true },
        },
      },
    };
  }, [data]);

  const { canvasRef: canvasScatter } = useChartJs(() => {
    if (!data || data.scatter.length === 0) return { type: 'bubble', data: { datasets: [] } };

    const datasets = data.scatter.map((d, i) => ({
      label: d.diag_method,
      data: [{ x: d.avg_latency, y: d.volume, r: Math.min(Math.max(d.volume / 10, 5), 40) }],
      backgroundColor: `${COLORS.CHART[i % COLORS.CHART.length]}B0`,
    }));

    return {
      type: 'bubble',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Latência vs Volume por Método' },
          tooltip: {
            callbacks: {
              label: (ctx: TooltipItem<'bubble'>) =>
                `${ctx.dataset.label}: ${ctx.parsed.x} dias (latência), ${ctx.parsed.y} casos`,
            },
          },
        },
        scales: {
          x: { title: { display: true, text: 'Latência Mediana (dias)' }, beginAtZero: true },
          y: { title: { display: true, text: 'Volume de Casos' }, beginAtZero: true },
        },
      },
    };
  }, [data]);

  if (loading)
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-400">Carregando...</div>
    );
  if (!data || data.streamgraph.length === 0) {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-[350px]">
        <canvas ref={canvasArea} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-[350px]">
        <canvas ref={canvasScatter} />
      </div>
    </div>
  );
}
