import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface PositivitySampleTypeItem {
  sample_type: string;
  tested: number;
  positive: number;
  positivity_rate: number;
}

interface PositivitySampleTypeChartProps {
  data: PositivitySampleTypeItem[] | null;
}

const PositivitySampleTypeChart: React.FC<PositivitySampleTypeChartProps> = ({ data }) => {
  const theme = useThemeMode();

  const getOption = () => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: 'Sem dados de positividade por tipo de amostra',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const xAxisData = data.map((d) => d.sample_type);
    const testedData = data.map((d) => d.tested);
    const positivityRates = data.map((d) => d.positivity_rate);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: Array<{ seriesName: string; value: number }>) => {
          if (params.length === 0) return '';
          const dataIndex = (params[0] as { dataIndex?: number }).dataIndex ?? 0;
          const item = data[dataIndex];
          return `
            Tipo de Amostra: <b>${item.sample_type}</b><br/>
            Casos Testados: <b>${item.tested}</b><br/>
            Casos Positivos: <b>${item.positive}</b><br/>
            Taxa Positividade: <b>${item.positivity_rate}%</b>
          `;
        },
      },
      legend: {
        data: ['Casos Testados', 'Taxa de Positividade (%)'],
        bottom: 0,
        textStyle: { color: textColor },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: 35,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLine: { show: true, lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, fontSize: 10, rotate: 15 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Casos Testados',
          axisLabel: { color: textColor },
          splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
        },
        {
          type: 'value',
          name: 'Positividade (%)',
          min: 0,
          max: 100,
          axisLabel: {
            formatter: '{value}%',
            color: textColor,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Casos Testados',
          type: 'bar',
          barMaxWidth: 40,
          data: testedData,
          itemStyle: { color: '#14b8a6' }, // Teal 500
        },
        {
          name: 'Taxa de Positividade (%)',
          type: 'line',
          yAxisIndex: 1,
          data: positivityRates,
          symbolSize: 8,
          lineStyle: { width: 3 },
          itemStyle: { color: '#f43f5e' }, // Rose 500
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%', minHeight: '350px' }} />;
};

export default PositivitySampleTypeChart;
