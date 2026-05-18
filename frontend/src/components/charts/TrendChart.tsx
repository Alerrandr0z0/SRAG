import React, { useEffect, useRef } from 'react';
import { COLORS } from '../../constants';
import { useThemeMode } from '../../hooks/useThemeMode';
import * as Epi from '../../types/epi';
import { buildBand } from '../../utils/math';

type ChartLike = { destroy: () => void };
type ChartCtor = { new (el: HTMLCanvasElement, _options: unknown): ChartLike };

let chartLoader: Promise<ChartCtor>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart as ChartCtor);
  }
  return chartLoader;
}

interface TrendChartProps {
  history: Epi.EpiWeekData[];
  forecast: Epi.ForecastEntry[];
  thresholds?: { medium: number; high: number; very_high: number };
  composition?: Array<{ epi_week: string; virus: string; count: number }>;
  baseCumulative?: number;
  seriesMode: string;
  showForecast?: boolean;
}

const VIRUS_COLORS: Record<string, string> = {
  'COVID-19': '#0f766e',
  Influenza: '#1d4ed8',
  VSR: '#b45309',
  'Outros Vírus': '#7c3aed',
  'Outro Agente': '#4b5563',
  'Não Especificada': '#94a3b8',
  'Em Investigação': '#cbd5e1',
};

const TrendChart: React.FC<TrendChartProps> = ({
  history,
  forecast,
  thresholds,
  composition,
  baseCumulative = 0,
  seriesMode,
  showForecast = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ChartLike | null>(null);
  const theme = useThemeMode();

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current || !tooltipRef.current) return;

      const labels = showForecast
        ? [...history.map((d) => d.epi_week), ...forecast.map((d) => d.epi_week)]
        : history.map((d) => d.epi_week);

      const historyLen = history.length;
      if (historyLen === 0) return;

      let hist = history.map((d) => d.total);

      const cumulativeFunc = (values: number[], initial = 0) => {
        let sum = initial;
        return values.map((v) => {
          sum += Number(v || 0);
          return sum;
        });
      };

      if (seriesMode === 'cumulative') {
        hist = cumulativeFunc(hist, baseCumulative);
      }

      const histLast = hist.length ? hist[hist.length - 1] : 0;
      const band = buildBand(labels, forecast, historyLen, seriesMode, histLast);

      const datasets: Array<Record<string, unknown>> = [];
      const virusProportions: Record<string, number> = {};
      if (seriesMode === 'composition' && composition) {
        const viruses = Array.from(new Set(composition.map((c) => c.virus)));
        const historyWeeks = history.map((h) => h.epi_week);

        const lastWeeks = historyWeeks.slice(-4);
        const lastComp = composition.filter((c) => lastWeeks.includes(c.epi_week));
        const totalLast = lastComp.reduce((sum, c) => sum + c.count, 0);

        if (totalLast > 0) {
          viruses.forEach((v) => {
            const count = lastComp
              .filter((c) => c.virus === v)
              .reduce((sum, c) => sum + c.count, 0);
            virusProportions[v] = count / totalLast;
          });
        } else {
          viruses.forEach((v) => (virusProportions[v] = 1 / viruses.length));
        }

        viruses.forEach((v) => {
          const data = labels
            .map((w, i) => {
              if (i < historyLen) {
                const entry = composition.find((c) => c.epi_week === w && c.virus === v);
                return entry ? entry.count : 0;
              }
              if (showForecast) {
                const weekTotal = forecast[i - historyLen]?.predicted_cases || 0;
                return weekTotal * (virusProportions[v] || 0);
              }
              return null;
            })
            .filter((v) => v !== null);

          datasets.push({
            label: v,
            data: data,
            backgroundColor: (context: {
              chart: {
                ctx: CanvasRenderingContext2D;
                scales: { x?: { getPixelForValue: (value: string) => number } };
              };
            }) => {
              const chart = context.chart;
              const { ctx, scales } = chart;
              if (!scales.x) return VIRUS_COLORS[v] || '#ccc';

              const x = scales.x.getPixelForValue(labels[historyLen - 1]);
              if (Number.isNaN(x) || !Number.isFinite(x)) return VIRUS_COLORS[v] || '#ccc';

              const gradient = ctx.createLinearGradient(x - 1, 0, x + 1, 0);
              gradient.addColorStop(0, VIRUS_COLORS[v] || '#ccc');
              gradient.addColorStop(1, `${VIRUS_COLORS[v] || '#ccc'}99`);
              return gradient;
            },
            borderColor: 'white',
            borderWidth: 1,
            fill: true,
            pointRadius: 0,
            pointHitRadius: 0,
            stacked: 'stack1',
          });
        });
      } else {
        datasets.push({
          label: 'Histórico',
          data: showForecast ? [...hist, ...forecast.map(() => null)] : hist,
          borderColor: COLORS.PRIMARY,
          backgroundColor: 'rgba(15,118,110,0.08)',
          fill: true,
          borderWidth: 3,
          tension: 0.2,
          z: 10,
        });

        if (showForecast) {
          const prev = labels.map((_, i) => {
            if (i < historyLen - 1) return null;
            if (i === historyLen - 1) return hist[historyLen - 1];
            if (seriesMode === 'cumulative') {
              const fRaw = forecast.map((f) => f.predicted_cases);
              const fCum = cumulativeFunc(fRaw, histLast);
              return fCum[i - historyLen] ?? null;
            }
            return forecast[i - historyLen]?.predicted_cases ?? null;
          });

          datasets.push({
            label: 'Previsão',
            data: prev,
            borderColor: COLORS.DANGER,
            borderDash: [7, 5],
            borderWidth: 2.5,
            tension: 0.2,
            pointRadius: 0,
            pointHitRadius: 0,
            z: 20,
          });
        }
      }

      if (showForecast) {
        datasets.push(
          {
            label: 'Limite inferior',
            data: band.lower,
            borderColor: 'transparent',
            pointRadius: 0,
            pointHitRadius: 0,
            fill: false,
          },
          {
            label: 'Faixa prevista',
            data: band.upper,
            borderColor: 'transparent',
            backgroundColor: 'rgba(185,28,28,0.1)',
            pointRadius: 0,
            pointHitRadius: 0,
            fill: '-1',
          },
        );
      }

      if (chartInstance.current) chartInstance.current.destroy();

      const isDark = theme === 'dark';
      const axisColor = isDark ? '#475569' : '#e2e8f0';
      const textColor = isDark ? '#cbd5e1' : '#64748b';
      const statusPlugin = {
        id: 'statusPlugin',
        beforeDraw: (chart: {
          ctx: CanvasRenderingContext2D;
          chartArea: { top: number; bottom: number; right: number };
          scales: { x?: { getPixelForValue: (value: string) => number } };
        }) => {
          const {
            ctx,
            chartArea: { top, bottom, right },
            scales: { x },
          } = chart;
          if (!x || !showForecast) return;
          const lastHistX = x.getPixelForValue(labels[historyLen - 1]);
          if (Number.isNaN(lastHistX) || !Number.isFinite(lastHistX)) return;

          ctx.save();
          ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(241, 245, 249, 0.6)';
          ctx.fillRect(lastHistX, top, right - lastHistX, bottom - top);

          ctx.strokeStyle = isDark ? '#cbd5e1' : '#64748b';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.moveTo(lastHistX, top);
          ctx.lineTo(lastHistX, bottom);
          ctx.stroke();

          ctx.fillStyle = isDark ? '#cbd5e1' : '#64748b';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('PREVISÃO', lastHistX + 10, top + 15);
          ctx.restore();
        },
      };

      const alertPlugin = {
        id: 'alertThresholds',
        afterDraw: (chart: {
          ctx: CanvasRenderingContext2D;
          chartArea: { top: number; bottom: number; right: number; left: number };
          scales: { y?: { getPixelForValue: (value: number) => number } };
        }) => {
          if (!thresholds || seriesMode === 'cumulative') return;
          const {
            ctx,
            chartArea: { left, right },
            scales: { y },
          } = chart;
          if (!y) return;

          const drawLabel = (val: number, label: string, color: string) => {
            const yPos = y.getPixelForValue(val);
            if (Number.isNaN(yPos) || yPos < chart.chartArea.top || yPos > chart.chartArea.bottom)
              return;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(left, yPos);
            ctx.lineTo(right, yPos);
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(label, left + 5, yPos - 5);
            ctx.restore();
          };
          drawLabel(thresholds.medium, 'MÉDIO', '#fbbf24');
          drawLabel(thresholds.high, 'ALTO', '#f97316');
          drawLabel(thresholds.very_high, 'MUITO ALTO', '#ef4444');
        },
      };

      const maxVal = Math.max(...hist, ...(thresholds ? [thresholds.medium] : []));

      const externalTooltipHandler = (context: {
        chart: { canvas: HTMLCanvasElement };
        tooltip: any;
      }) => {
        const { tooltip } = context;
        const tooltipEl = tooltipRef.current;
        if (!tooltipEl) return;

        if (tooltip.opacity === 0) {
          tooltipEl.style.opacity = '0';
          return;
        }

        if (tooltip.body) {
          const dataIndex = tooltip.dataPoints[0].dataIndex;
          const isForecast = dataIndex >= historyLen;
          const week = labels[dataIndex];

          // 1. Calculate Total
          let total = 0;
          if (seriesMode === 'cumulative') {
            const histVal = hist[dataIndex] || 0;
            const prevVal =
              dataIndex >= historyLen - 1
                ? (seriesMode === 'cumulative'
                    ? cumulativeFunc(
                        forecast.map((f) => f.predicted_cases),
                        histLast,
                      )[dataIndex - historyLen]
                    : forecast[dataIndex - historyLen]?.predicted_cases) || 0
                : 0;
            total = dataIndex < historyLen ? histVal : prevVal || histLast;
          } else {
            total = tooltip.dataPoints.reduce(
              (
                sum: number,
                dp: { dataset: { label?: string }; dataIndex: number; raw: unknown },
              ) => {
                const label = dp.dataset.label ?? '';
                if (['Limite inferior', 'Faixa prevista'].includes(label)) return sum;
                if (dp.dataIndex === historyLen - 1 && label === 'Previsão') return sum;
                return sum + Number(dp.raw || 0);
              },
              0,
            );
          }

          // 2. Build Content (ECharts Aesthetic)
          let breakdownItems: Array<{ label: string; value: number; color: string }> = [];

          if (seriesMode === 'composition' || (composition && seriesMode !== 'cumulative')) {
            if (isForecast) {
              breakdownItems = Object.entries(virusProportions)
                .filter(([_, prop]) => prop > 0)
                .map(([v, prop]) => ({
                  label: v,
                  value: Math.round(total * prop),
                  color: VIRUS_COLORS[v] || '#ccc',
                }))
                .sort((a, b) => b.value - a.value);
            } else {
              breakdownItems = composition
                ? composition
                    .filter((c) => c.epi_week === week)
                    .map((c) => ({
                      label: c.virus,
                      value: c.count,
                      color: VIRUS_COLORS[c.virus] || '#ccc',
                    }))
                    .sort((a, b) => b.value - a.value)
                : [];
            }
          } else {
            if (isForecast) {
              breakdownItems.push({
                label: 'Previsão',
                value: Math.round(total),
                color: COLORS.DANGER,
              });
            } else {
              breakdownItems.push({
                label: 'Notificações',
                value: Math.round(total),
                color: COLORS.PRIMARY,
              });
            }
          }

          let innerHtml = `<div class="ct-title">Semana ${week}</div>`;
          for (const item of breakdownItems) {
            innerHtml += `
              <div class="ct-item">
                <span class="ct-marker" style="background: ${item.color}"></span>
                <span class="ct-label">${item.label}</span>
                <span class="ct-value">${item.value.toLocaleString('pt-BR')}</span>
              </div>`;
          }

          if (seriesMode !== 'cumulative' && breakdownItems.length > 1) {
            innerHtml += `
              <div class="ct-total-row" style="margin-top: 6px; border-top: 1px solid var(--border-subtle); padding-top: 4px;">
                <span style="font-size: 11px; font-weight: 700;">TOTAL</span>
                <span class="ct-value" style="font-weight: 800;">${Math.round(total).toLocaleString('pt-BR')}</span>
              </div>`;
          }

          tooltipEl.innerHTML = innerHtml;
        }

        // Standard ECharts dynamic positioning logic
        const top = tooltip.caretY - 10;
        const left = tooltip.caretX + 20;

        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
      };

      chartInstance.current = new Chart(canvasRef.current, {
        type: 'line',
        plugins: [statusPlugin, alertPlugin],
        data: { labels, datasets },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                usePointStyle: true,
                boxWidth: 10,
                filter: (item: { text: string }) =>
                  !['Limite inferior', 'Faixa prevista', 'Previsão'].includes(item.text),
              },
            },
            tooltip: {
              enabled: false,
              external: externalTooltipHandler,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              stacked: seriesMode === 'composition',
              suggestedMax: maxVal * 1.1,
              title: { display: true, text: 'Casos', color: textColor },
              ticks: { color: textColor },
              grid: { color: axisColor },
            },
            x: {
              grid: { color: axisColor },
              ticks: { color: textColor },
            },
          },
        },
      });
    };

    render();

    let resizeObserver: ResizeObserver | null = null;
    if (
      typeof ResizeObserver !== 'undefined' &&
      canvasRef.current &&
      canvasRef.current.parentElement
    ) {
      resizeObserver = new ResizeObserver(() => {
        if (chartInstance.current) {
          (chartInstance.current as unknown as { resize: () => void }).resize();
        }
      });
      resizeObserver.observe(canvasRef.current.parentElement);
    }

    return () => {
      cancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: managed via dependencies spread
  }, [history, forecast, thresholds, composition, baseCumulative, seriesMode, theme, showForecast]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <canvas ref={canvasRef} />
      <div
        ref={tooltipRef}
        id="chartjs-tooltip"
        className="custom-chartjs-tooltip"
        style={{ position: 'absolute', pointerEvents: 'none', opacity: 0 }}
      />
    </div>
  );
};

export default TrendChart;
