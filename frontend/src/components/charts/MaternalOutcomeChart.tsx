import React, { useEffect, useRef } from 'react';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;

      if (chartInstance.current) chartInstance.current.destroy();

      const labels = data.map(d => d.group);
      
      // Calculate percentages for 100% stacked bar
      const cureData = data.map(d => (d.cure / d.total) * 100);
      const icuData = data.map(d => (d.icu / d.total) * 100);
      const deathData = data.map(d => (d.death / d.total) * 100);

      chartInstance.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Cura (Sem UTI)',
              data: cureData,
              backgroundColor: '#0d9488', // Teal 600
              stack: 'outcome',
            },
            {
              label: 'UTI (Sobrevivente)',
              data: icuData,
              backgroundColor: '#d97706', // Amber 600
              stack: 'outcome',
            },
            {
              label: 'Óbito',
              data: deathData,
              backgroundColor: '#be123c', // Rose 700
              stack: 'outcome',
            }
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
                font: { size: 11 }
              }
            },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  const val = context.raw as number;
                  const groupIdx = context.dataIndex;
                  const originalVal = context.datasetIndex === 0 
                    ? data[groupIdx].cure 
                    : context.datasetIndex === 1 
                      ? data[groupIdx].icu 
                      : data[groupIdx].death;
                  return `${context.dataset.label}: ${val.toFixed(1)}% (${originalVal} casos)`;
                }
              }
            }
          },
          scales: {
            x: {
              stacked: true,
              max: 100,
              ticks: { callback: (val: any) => `${val}%` }
            },
            y: {
              stacked: true,
            }
          }
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
  }, [data]);

  return <canvas ref={canvasRef} />;
};

export default MaternalOutcomeChart;
