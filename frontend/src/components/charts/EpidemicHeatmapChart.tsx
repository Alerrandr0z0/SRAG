import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import { EpidemicHeatmapResponse } from '../../types/epi';

interface EpidemicHeatmapChartProps {
  data: EpidemicHeatmapResponse | null;
}

const EpidemicHeatmapChart: React.FC<EpidemicHeatmapChartProps> = ({ data }) => {
  const theme = useThemeMode();

  const getOption = () => {
    if (!data?.weeks || data.weeks.length === 0) {
      return {
        title: {
          text: 'Sem dados de incidência temporal',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // Find the max value in the data to scale visualMap
    let maxVal = 1;
    for (const point of data.data) {
      if (point[2] > maxVal) {
        maxVal = point[2];
      }
    }

    return {
      tooltip: {
        position: 'top',
        formatter: (params: { value: [number, number, number] }) => {
          const weekIdx = params.value[0];
          const ageIdx = params.value[1];
          const count = params.value[2];
          return `Semana: <b>${data.weeks[weekIdx]}</b><br/>Faixa Etária: <b>${data.age_groups[ageIdx]}</b><br/>Casos: <b>${count}</b>`;
        },
      },
      grid: {
        top: 20,
        right: '5%',
        bottom: 80,
        left: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.weeks,
        axisLine: { show: true, lineStyle: { color: axisColor } },
        axisLabel: { rotate: 45, color: textColor, fontSize: 10 },
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category',
        data: data.age_groups,
        axisLine: { show: true, lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, fontSize: 10 },
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        itemWidth: 12,
        itemHeight: 150,
        inRange: {
          color: ['#eff6ff', '#93c5fd', '#1d4ed8', '#1e3a8a'],
        },
        textStyle: { color: textColor },
      },
      series: [
        {
          name: 'Casos por SE',
          type: 'heatmap',
          data: data.data,
          label: {
            show: false,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.5)',
            },
          },
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '320px' }}>
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default EpidemicHeatmapChart;
