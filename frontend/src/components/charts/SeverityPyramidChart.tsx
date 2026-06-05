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
    const utiRates = data.map((r) => r.uti_rate);
    const supportRates = data.map((r) => r.support_rate);
    const deathRates = data.map((r) => r.death_rate);

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
          const total = original ? original.total_cases : 0;
          let tooltipHtml = `<strong>${groupName}</strong> (N=${total})<br/>`;
          for (const p of params) {
            tooltipHtml += `${p.marker} ${p.seriesName}: <strong>${p.value}%</strong><br/>`;
          }
          return tooltipHtml;
        },
      },
      legend: {
        data: ['Taxa de UTI', 'Suporte Ventilatório', 'Taxa de Óbito'],
        bottom: 0,
        textStyle: { color: textColor },
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '10%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'Taxa (%)',
        max: 100,
        axisLabel: { formatter: '{value}%', color: textColor },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        axisLine: { show: true, lineStyle: { color: axisColor } },
        axisLabel: { color: textColor },
      },
      series: [
        {
          name: 'Taxa de UTI',
          type: 'bar',
          data: utiRates,
          itemStyle: { color: COLORS.SECONDARY },
        },
        {
          name: 'Suporte Ventilatório',
          type: 'bar',
          data: supportRates,
          itemStyle: { color: COLORS.ACCENT },
        },
        {
          name: 'Taxa de Óbito',
          type: 'bar',
          data: deathRates,
          itemStyle: { color: COLORS.DANGER },
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%', minHeight: '350px' }} />;
};

export default SeverityPyramidChart;
