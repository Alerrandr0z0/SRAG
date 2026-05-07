import React, { useState } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { COLORS } from '../../constants';
import { buildNotificationDelaySeries, formatNotificationDelayTooltip } from '../../utils/chartData';

interface NotificationDelayChartProps {
  data: Array<{ epi_week: string; median_delay: number; record_count: number }>;
}

const NotificationDelayChart: React.FC<NotificationDelayChartProps> = ({ data }) => {
  const [weeksWindow, setWeeksWindow] = useState('0'); // 0 = Tudo

  const getOption = () => {
    const { weeks, delays, counts } = buildNotificationDelaySeries(data || [], weeksWindow);

    return {
      title: {
        text: 'Atraso de Notificação por Semana',
        left: 0,
        top: 0,
        textStyle: { fontSize: 20, color: '#1e293b', fontWeight: 600 }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: Array<{ name?: string; seriesName?: string; value?: number }>) => formatNotificationDelayTooltip(params)
      },
      legend: {
        data: ['Volume', 'Mediana de Atraso'],
        bottom: 0
      },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '60px', containLabel: true },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLabel: { rotate: 35, fontSize: 10 }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Notificações',
          splitLine: { show: false }
        },
        {
          type: 'value',
          name: 'Dias',
          position: 'right',
          splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } }
        }
      ],
      series: [
        {
          name: 'Volume',
          type: 'bar',
          data: counts,
          itemStyle: { color: '#cbd5e1' },
          barMaxWidth: 20
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
            lineStyle: { color: '#ef4444', type: 'dotted', width: 2 }
          }
        }
      ]
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, weeksWindow]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <div className="pill-group">
          {[
            { v: '0', l: 'Tudo' },
            { v: '52', l: '52s' },
            { v: '26', l: '26s' },
            { v: '12', l: '12s' }
          ].map(opt => (
            <button
              key={opt.v}
              className={`pill-btn ${weeksWindow === opt.v ? 'active' : ''}`}
              onClick={() => setWeeksWindow(opt.v)}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartRef} style={{ flexGrow: 1, width: '100%' }} />
    </div>
  );
};

export default NotificationDelayChart;
