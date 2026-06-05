import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface UnitDelayItem {
  id_unidade: string;
  nome_fantasia: string;
  total: number;
  median_delay: number;
  avg_delay: number;
}

interface DelayByUnitChartProps {
  data: UnitDelayItem[] | null;
}

const DelayByUnitChart: React.FC<DelayByUnitChartProps> = ({ data }) => {
  const theme = useThemeMode();

  const getOption = () => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: 'Sem dados de atraso por unidade',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // Sort ascending by median_delay to have the highest delay on top in horizontal bar
    const sortedData = [...data].sort((a, b) => a.median_delay - b.median_delay);

    const yAxisData = sortedData.map((d) => {
      const name = d.nome_fantasia || d.id_unidade || 'Desconhecida';
      return name.length > 30 ? `${name.substring(0, 28)}...` : name;
    });

    const medianDelays = sortedData.map((d) => d.median_delay);
    const avgDelays = sortedData.map((d) => d.avg_delay);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ seriesName: string; value: number }>) => {
          if (params.length === 0) return '';
          const dataIndex = (params[0] as { dataIndex?: number }).dataIndex ?? 0;
          const item = sortedData[dataIndex];
          const name = item.nome_fantasia || item.id_unidade || 'Desconhecida';
          let html = `<b>${name}</b><br/>Casos Notificados: <b>${item.total}</b><br/>`;
          for (const param of params) {
            html += `${param.seriesName}: <b>${param.value} dias</b><br/>`;
          }
          return html;
        },
      },
      legend: {
        data: ['Atraso Mediano', 'Atraso Médio'],
        bottom: 0,
        textStyle: { color: textColor },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'Dias de Atraso',
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        axisLine: { show: true, lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, fontSize: 10 },
      },
      series: [
        {
          name: 'Atraso Mediano',
          type: 'bar',
          emphasis: { focus: 'series' },
          data: medianDelays,
          itemStyle: { color: '#eab308' }, // Yellow 500
        },
        {
          name: 'Atraso Médio',
          type: 'bar',
          emphasis: { focus: 'series' },
          data: avgDelays,
          itemStyle: { color: '#f97316' }, // Orange 500
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%', minHeight: '400px' }} />;
};

export default DelayByUnitChart;
