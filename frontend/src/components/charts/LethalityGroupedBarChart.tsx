import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface LethalityGroupedBarChartProps {
  xLabels: string[];
  yLabels: string[];
  matrix: number[][];
  valueName?: string;
}

interface EChartsTooltipParams {
  name: string;
  marker: string;
  seriesName: string;
  value: number;
}

const LethalityGroupedBarChart: React.FC<LethalityGroupedBarChartProps> = ({
  xLabels,
  yLabels,
  matrix,
  valueName = 'Letalidade (CFR %)',
}) => {
  const theme = useThemeMode();

  const getOption = () => {
    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const series = yLabels
      .map((virus, yIdx) => {
        const data = xLabels.map((_, xIdx) => matrix[yIdx]?.[xIdx] || 0);
        const hasData = data.some((v) => v > 0);
        if (!hasData) return null;

        return {
          name: virus,
          type: 'bar',
          data,
          barMaxWidth: 40,
          emphasis: { focus: 'series' },
        };
      })
      .filter(Boolean);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: EChartsTooltipParams[]) => {
          let html = `<strong>${params[0].name}</strong><br/>`;
          params.forEach((p) => {
            if (p.value > 0) {
              html += `${p.marker} ${p.seriesName}: <strong>${p.value.toFixed(1)}%</strong><br/>`;
            }
          });
          return html;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: textColor },
        type: 'scroll',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, rotate: 30 },
      },
      yAxis: {
        type: 'value',
        name: valueName,
        axisLabel: { formatter: '{value}%', color: textColor },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
      },
      series,
    };
  };

  const { chartRef } = useEcharts(getOption(), [xLabels, yLabels, matrix, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%' }} />;
};

export default LethalityGroupedBarChart;
