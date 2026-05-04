import React, { useEffect, useRef } from 'react';
import { COLORS } from '../../constants';
import * as Epi from '../../types/epi';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

interface RiskFactorsChartProps {
  data: Epi.CitizenBootstrap['risk_factors_full'];
}

const RiskFactorsChart: React.FC<RiskFactorsChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;
      if (chartInstance.current) chartInstance.current.destroy();
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: data.map((x) => x.factor),
          datasets: [{
            data: data.map((x) => x.count),
            backgroundColor: COLORS.ACCENT,
            borderRadius: 7
          }],
        },
        options: {
          indexAxis: 'y',
          maintainAspectRatio: false,
          layout: {
            padding: { left: 10, right: 20 }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (c: any) => `Casos: ${c.raw}`
              }
            }
          },
          scales: {
            x: { beginAtZero: true, grid: { display: false } },
            y: {
              ticks: {
                font: { size: 10 },
                callback: function(value: any) {
                  const label = this.getLabelForValue(value);
                  return label.length > 15 ? label.substr(0, 15) + '...' : label;
                }
              }
            }
          }
        },
      });
    }
    render();
    return () => { cancelled = true; };
  }, [data]);

  return <canvas ref={canvasRef} />;
};

export default RiskFactorsChart;
