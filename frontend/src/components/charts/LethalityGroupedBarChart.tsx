import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface LethalityGroupedBarChartProps {
  xLabels: string[];
  yLabels: string[];
  matrix: number[][]; // [yIdx][xIdx]
}

const AGENT_COLORS: Record<string, string> = {
  VSR: '#0f766e',
  Influenza: '#2563eb',
  'COVID-19': '#ea580c',
  'Outros Vírus': '#10b981',
  'Outro Agente': '#dc2626',
  'Não Especificada': '#94a3b8',
};

const LethalityGroupedBarChart: React.FC<LethalityGroupedBarChartProps> = ({
  xLabels,
  yLabels,
  matrix,
}) => {
  const theme = useThemeMode();

  const getOption = () => {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const axisColor = isDark ? '#334155' : '#e2e8f0';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    // Construir as séries de linhas
    const series = yLabels
      .map((agent, yIdx) => {
        const dataPoints = xLabels.map((_, xIdx) => {
          return matrix[yIdx]?.[xIdx] ?? 0;
        });

        // Só plota se tiver algum caso com letalidade > 0 para evitar poluição de agentes zerados
        const hasData = dataPoints.some((val) => val > 0);
        if (!hasData) return null;

        const color = AGENT_COLORS[agent] || '#64748b';

        return {
          name: agent,
          type: 'line',
          data: dataPoints,
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: true,
          smooth: true,
          lineStyle: {
            width: 2,
            color: color,
          },
          itemStyle: {
            color: color,
          },
        };
      })
      .filter(Boolean);

    const activeLegends = yLabels.filter((_agent, yIdx) => {
      const dataPoints = xLabels.map((_, xIdx) => matrix[yIdx]?.[xIdx] ?? 0);
      return dataPoints.some((val) => val > 0);
    });

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: axisColor,
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        // biome-ignore lint/suspicious/noExplicitAny: ECharts formatter parameters are dynamically typed as any array
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          let html = `<strong>${params[0].name}</strong><br/>`;
          params.forEach((p) => {
            html += `${p.marker} ${p.seriesName}: <b>${p.value.toFixed(1)}%</b><br/>`;
          });
          return html;
        },
      },
      legend: {
        data: activeLegends,
        bottom: 0,
        textStyle: { color: textColor, fontSize: 9 },
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: {
        left: 10,
        right: 15,
        bottom: 45, // Mais espaço para a legenda na parte inferior
        top: 35,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, rotate: 25, fontSize: 9 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Letalidade (CFR %)',
        nameTextStyle: { color: textColor, fontSize: 9 },
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, formatter: '{value}%', fontSize: 9 },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
        min: 0,
        max: 100,
      },
      series,
    };
  };

  const { chartRef } = useEcharts(getOption(), [xLabels, yLabels, matrix, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%' }} />;
};

export default LethalityGroupedBarChart;
