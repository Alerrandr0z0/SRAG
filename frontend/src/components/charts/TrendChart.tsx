import React, { useEffect, useRef } from 'react';
import { COLORS } from '../../constants';
import { buildBand } from '../../utils/math';
import * as Epi from '../../types/epi';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

interface TrendChartProps {
  history: Epi.EpiWeekData[];
  forecast: Epi.ForecastEntry[];
  seriesMode: string;
}

const TrendChart: React.FC<TrendChartProps> = ({ history, forecast, seriesMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;

      const labels = [
        ...history.map((d) => d.epi_week),
        ...forecast.map((d) => d.epi_week),
      ];
      
      let hist = history.map((d) => d.total);
      let histLast = hist.length ? hist[hist.length - 1] : 0;
      
      const cumulative = (values: number[]) => {
        let sum = 0;
        return values.map((v) => {
          sum += Number(v || 0);
          return sum;
        });
      };

      if (seriesMode === 'cumulative') {
        hist = cumulative(hist);
        histLast = hist.length ? hist[hist.length - 1] : 0;
      }

      const band = buildBand(labels, forecast, history.length, seriesMode, histLast);
      
      let prev = labels.map((_, i) => {
        const len = hist.length;
        if (len === 0) return null;
        if (i < len - 1) return null;
        if (i === len - 1) return hist[len - 1];
        
        if (seriesMode === 'cumulative') {
          const fRaw = forecast.map((f) => f.predicted_cases);
          const fCum = cumulative(fRaw).map((v) => v + histLast);
          return fCum[i - len] ?? null;
        }
        return forecast[i - len]?.predicted_cases ?? null;
      });

      if (chartInstance.current) chartInstance.current.destroy();

      chartInstance.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Histórico',
              data: hist,
              borderColor: COLORS.PRIMARY,
              backgroundColor: 'rgba(15,118,110,0.08)',
              fill: true,
              borderWidth: 3,
              tension: 0.2,
            },
            {
              label: 'Limite inferior',
              data: band.lower,
              borderColor: 'rgba(185,28,28,0)',
              pointRadius: 0,
              fill: false,
            },
            {
              label: 'Faixa prevista',
              data: band.upper,
              borderColor: 'rgba(185,28,28,0)',
              backgroundColor: 'rgba(185,28,28,0.12)',
              pointRadius: 0,
              fill: '-1',
            },
            {
              label: 'Previsão',
              data: prev,
              borderColor: COLORS.DANGER,
              borderDash: [7, 5],
              borderWidth: 2.5,
              tension: 0.2,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
          },
          scales: {
            y: { beginAtZero: true },
            x: { grid: { display: false } },
          },
        },
      });
    };

    render();

    return () => {
      cancelled = true;
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [history, forecast, seriesMode]);

  return <canvas ref={canvasRef} />;
};

export default TrendChart;
