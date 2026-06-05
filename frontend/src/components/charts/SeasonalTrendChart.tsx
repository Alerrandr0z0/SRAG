import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import { SeasonalTrendsResponse } from '../../types/epi';

interface SeasonalTrendChartProps {
  data: SeasonalTrendsResponse | null;
}

const YEAR_COLORS: Record<string, string> = {
  '2020': '#f59e0b', // Amber
  '2021': '#10b981', // Emerald
  '2022': '#3b82f6', // Blue
  '2023': '#8b5cf6', // Violet
  '2024': '#ec4899', // Pink
  '2025': '#ef4444', // Red
  '2026': '#06b6d4', // Cyan
};

const SeasonalTrendChart: React.FC<SeasonalTrendChartProps> = ({ data }) => {
  const theme = useThemeMode();

  const getOption = () => {
    if (!data?.years || data.years.length === 0) {
      return {
        title: {
          text: 'Sem dados disponíveis',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // X-axis: weeks
    const xAxisData = data.weeks.map((w) => `SE ${w}`);

    // Create a series for each year
    const series = data.years.map((year) => {
      const yearData = data.series[year] || [];
      return {
        name: year,
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: yearData,
        itemStyle: { color: YEAR_COLORS[year] || '#94a3b8' },
        lineStyle: { width: 2.5 },
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: data.years,
        bottom: 0,
        icon: 'circle',
        textStyle: { color: textColor },
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '10%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisData,
        axisLine: { show: true, lineStyle: { color: axisColor } },
        axisLabel: { color: textColor },
      },
      yAxis: {
        type: 'value',
        name: 'Nº de Casos',
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
      },
      series,
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%', minHeight: '350px' }} />;
};

export default SeasonalTrendChart;
