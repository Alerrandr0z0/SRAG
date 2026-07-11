import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface LethalityGroupedBarChartProps {
  xLabels: string[];
  yLabels: string[];
  matrix: number[][]; // [yIdx][xIdx]
  valueName?: string;
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
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const splitColor = isDark ? '#334155' : '#e2e8f0';

    // Transform matrix to dataset array: [xIndex, yIndex, value]
    const data: number[][] = [];
    let maxValue = 0;

    yLabels.forEach((_, yIdx) => {
      xLabels.forEach((_, xIdx) => {
        const val = matrix[yIdx]?.[xIdx] || 0;
        if (val > 0) {
          data.push([xIdx, yIdx, val]);
          if (val > maxValue) maxValue = val;
        }
      });
    });

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const xName = xLabels[params.value[0]];
          const yName = yLabels[params.value[1]];
          const val = params.value[2];
          return `<strong>${yName}</strong><br/>Idade: ${xName}<br/>Letalidade: <strong>${val.toFixed(1)}%</strong>`;
        },
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: '15%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: textColor, rotate: 30, interval: 0 },
        splitLine: { show: true, lineStyle: { color: splitColor, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: yLabels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: textColor },
        splitLine: { show: true, lineStyle: { color: splitColor, type: 'dashed' } },
      },
      visualMap: {
        type: 'continuous',
        min: 0,
        max: maxValue > 0 ? maxValue : 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 15,
        itemHeight: 200,
        inRange: {
          color: ['#fef08a', '#f97316', '#b91c1c'],
          symbolSize: [10, 40], // Automatically scales the bubbles!
        },
        textStyle: { color: textColor },
        formatter: (value: number) => `${value.toFixed(1)}%`,
      },
      series: [
        {
          name: 'Letalidade',
          type: 'scatter',
          data: data,
          animationDelay: (idx: number) => idx * 10,
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [xLabels, yLabels, matrix, theme]);

  return <div ref={chartRef} style={{ height: '400px', width: '100%' }} />;
};

export default LethalityGroupedBarChart;
