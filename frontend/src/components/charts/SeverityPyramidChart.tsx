import React from 'react';
import { COLORS } from '../../constants';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import { SeverityPyramidResponse } from '../../types/epi';

interface SeverityPyramidChartProps {
  data: SeverityPyramidResponse | null;
}

const SeverityPyramidChart: React.FC<SeverityPyramidChartProps> = ({ data }) => {
  const theme = useThemeMode();

  const getOption = () => {
    if (!data || data.length === 0) {
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

    const yAxisData = data.map((r) => r.age_group);

    // We want a symmetric silhouette based on total_cases.
    // Each side (left/right) will have total_cases / 2.
    // The segments inside will be based on the rates.

    const series = [
      // Right side (positive)
      {
        name: 'Óbito',
        type: 'bar',
        stack: 'right',
        data: data.map(r => (r.total_cases * (r.death_rate / 100)) / 2),
        itemStyle: { color: COLORS.DANGER },
      },
      {
        name: 'UTI (Sobrevivente)',
        type: 'bar',
        stack: 'right',
        data: data.map(r => (r.total_cases * (Math.max(0, r.uti_rate - r.death_rate) / 100)) / 2),
        itemStyle: { color: COLORS.ACCENT },
      },
      {
        name: 'Enfermaria/Não Internado',
        type: 'bar',
        stack: 'right',
        data: data.map(r => (r.total_cases * (Math.max(0, 100 - Math.max(r.uti_rate, r.death_rate)) / 100)) / 2),
        itemStyle: { color: COLORS.SECONDARY, opacity: 0.7 },
      },
      // Left side (negative) - exact mirror for symmetry
      {
        name: 'Óbito',
        type: 'bar',
        stack: 'left',
        barGap: '-100%',
        data: data.map(r => -((r.total_cases * (r.death_rate / 100)) / 2)),
        itemStyle: { color: COLORS.DANGER },
        silent: true, // Tooltip only needs to trigger once per row
      },
      {
        name: 'UTI (Sobrevivente)',
        type: 'bar',
        stack: 'left',
        barGap: '-100%',
        data: data.map(r => -((r.total_cases * (Math.max(0, r.uti_rate - r.death_rate) / 100)) / 2)),
        itemStyle: { color: COLORS.ACCENT },
        silent: true,
      },
      {
        name: 'Enfermaria/Não Internado',
        type: 'bar',
        stack: 'left',
        barGap: '-100%',
        data: data.map(r => -((r.total_cases * (Math.max(0, 100 - Math.max(r.uti_rate, r.death_rate)) / 100)) / 2)),
        itemStyle: { color: COLORS.SECONDARY, opacity: 0.7 },
        silent: true,
      }
    ];

    interface EChartsParam {
      name: string;
      marker: string;
      seriesName: string;
      value: number;
    }

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: EChartsParam[]) => {
          const groupName = params[0].name;
          const original = data.find((r) => r.age_group === groupName);
          if (!original) return '';

          let html = `<strong>${groupName}</strong><br/>`;
          html += `Total de Casos: <b>${original.total_cases}</b><br/><hr style="border:0;border-top:1px solid #eee;margin:4px 0"/>`;

          // Show mutually exclusive segments in tooltip
          const utiSurvivorRate = Math.max(0, original.uti_rate - original.death_rate);
          const othersRate = Math.max(0, 100 - Math.max(original.uti_rate, original.death_rate));

          html += `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${COLORS.DANGER}"></span> Óbito: <b>${original.death_rate.toFixed(1)}%</b><br/>`;
          html += `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${COLORS.ACCENT}"></span> UTI (Sobrevivente): <b>${utiSurvivorRate.toFixed(1)}%</b><br/>`;
          html += `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${COLORS.SECONDARY}"></span> Enfermaria/Leve: <b>${othersRate.toFixed(1)}%</b><br/>`;

          return html;
        },
      },
      legend: {
        data: ['Óbito', 'UTI (Sobrevivente)', 'Enfermaria/Não Internado'],
        bottom: 0,
        textStyle: { color: textColor },
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '12%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'Volume de Casos',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          formatter: (v: number) => Math.abs(v) * 2, // Total width is 2 * side width
          color: textColor
        },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: textColor, margin: 20 },
      },
      series,
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%', minHeight: '350px' }} />;
};

export default SeverityPyramidChart;
