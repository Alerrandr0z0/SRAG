import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface AntiviralOutcomeItem {
  group: string;
  cure_rate: number;
  death_rate: number;
  total: number;
}

interface AntiviralOutcomeChartProps {
  data: AntiviralOutcomeItem[] | null;
}

const AntiviralOutcomeChart: React.FC<AntiviralOutcomeChartProps> = ({ data }) => {
  const theme = useThemeMode();

  const getOption = () => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: 'Sem dados de impacto de antiviral',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const xAxisData = data.map((d) => d.group);
    const cureRates = data.map((d) => d.cure_rate);
    const deathRates = data.map((d) => d.death_rate);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ seriesName: string; value: number }>) => {
          if (params.length === 0) return '';
          const dataIndex = (params[0] as { dataIndex?: number }).dataIndex ?? 0;
          const item = data[dataIndex];
          let html = `Grupo: <b>${item.group}</b> (Total = ${item.total})<br/>`;
          for (const param of params) {
            html += `${param.seriesName}: <b>${param.value}%</b><br/>`;
          }
          return html;
        },
      },
      legend: {
        data: ['Taxa de Cura', 'Taxa de Óbito (Letalidade)'],
        bottom: 0,
        textStyle: { color: textColor },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLine: { show: true, lineStyle: { color: axisColor } },
        axisLabel: { color: textColor },
      },
      yAxis: {
        type: 'value',
        name: 'Percentual (%)',
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          color: textColor,
        },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
      },
      series: [
        {
          name: 'Taxa de Cura',
          type: 'bar',
          barMaxWidth: 40,
          emphasis: { focus: 'series' },
          data: cureRates,
          itemStyle: { color: '#059669' }, // Emerald 600
        },
        {
          name: 'Taxa de Óbito (Letalidade)',
          type: 'bar',
          barMaxWidth: 40,
          emphasis: { focus: 'series' },
          data: deathRates,
          itemStyle: { color: '#dc2626' }, // Red 600
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%', minHeight: '320px' }} />;
};

export default AntiviralOutcomeChart;
