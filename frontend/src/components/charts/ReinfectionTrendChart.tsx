import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';

interface ReinfectionTrendChartProps {
  data: Array<{ epi_week: string; count: number }>;
}

const ReinfectionTrendChart: React.FC<ReinfectionTrendChartProps> = ({ data }) => {
  const weeks = data?.map((d) => d.epi_week) || [];
  const counts = data?.map((d) => d.count) || [];

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown[]) => {
        const p = params[0] as { name: string; value: number };
        return `Semana: ${p.name}<br/>Reinfecções: <b>${p.value}</b>`;
      },
    },
    grid: { left: '3%', right: '4%', bottom: '5%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: weeks,
      axisLabel: { rotate: 35, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      name: 'Casos',
    },
    series: [
      {
        name: 'Reinfecções',
        type: 'line',
        data: counts,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: '#ec4899' }, // Pink/Rose for reinfections
        lineStyle: { width: 3 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(236, 72, 153, 0.3)' },
              { offset: 1, color: 'rgba(236, 72, 153, 0)' },
            ],
          },
        },
      },
    ],
  };

  const { chartRef } = useEcharts(option, [data]);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
        }}
      >
        <p>Nenhum caso de reinfecção registrado no período.</p>
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
};

export default ReinfectionTrendChart;
