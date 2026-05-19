import React, { useState } from 'react';
import { COLORS } from '../../constants';
import { useEcharts } from '../../hooks/useEcharts';
import {
  buildNotificationDelaySeries,
  formatNotificationDelayTooltip,
} from '../../utils/chartData';

interface NotificationDelayChartProps {
  data: Array<{ epi_week: string; median_delay: number; record_count: number }>;
  forcedWeeks?: string;
}

const NotificationDelayChart: React.FC<NotificationDelayChartProps> = ({ data, forcedWeeks }) => {
  const [internalWeeks] = useState('0'); // 0 = Tudo

  const weeksWindow = forcedWeeks ?? internalWeeks;

  const getOption = () => {
    const { weeks, delays, counts } = buildNotificationDelaySeries(data || [], weeksWindow);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: Array<{ name?: string; seriesName?: string; value?: number }>) =>
          formatNotificationDelayTooltip(params),
      },
      legend: {
        data: ['Volume', 'Mediana de Atraso'],
        bottom: 0,
      },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '25px', containLabel: true },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLabel: { rotate: 35, fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Notificações',
          splitLine: { show: false },
        },
        {
          type: 'value',
          name: 'Dias',
          position: 'right',
          splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } },
        },
      ],
      series: [
        {
          name: 'Volume',
          type: 'bar',
          data: counts,
          itemStyle: { color: '#cbd5e1' },
          barMaxWidth: 20,
        },
        {
          name: 'Mediana de Atraso',
          type: 'line',
          yAxisIndex: 1,
          data: delays,
          smooth: true,
          itemStyle: { color: COLORS.DANGER },
          lineStyle: { width: 3 },
          symbolSize: 8,
          markLine: {
            silent: true,
            data: [{ yAxis: 7, label: { formatter: 'Meta: 7d', position: 'end' } }],
            lineStyle: { color: '#ef4444', type: 'dotted', width: 2 },
          },
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, weeksWindow]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%' }} />;
};

export default NotificationDelayChart;
