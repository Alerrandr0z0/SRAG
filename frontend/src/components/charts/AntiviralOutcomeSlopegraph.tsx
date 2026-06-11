import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface TreatmentWindowItem {
  window: string;
  total: number;
  cure_rate: number;
  death_rate: number;
  margin: number;
}

interface AntiviralOutcomeSlopegraphProps {
  data: TreatmentWindowItem[] | null;
}

const CURE_COLOR = '#16a34a';
const DEATH_COLOR = '#dc2626';
const MARGIN_COLOR = '#0f766e';

const AntiviralOutcomeSlopegraph: React.FC<AntiviralOutcomeSlopegraphProps> = ({ data }) => {
  const theme = useThemeMode();

  const safeData = useMemo(() => {
    return Array.isArray(data) ? data : [];
  }, [data]);

  const option = useMemo(() => {
    if (safeData.length === 0) {
      return {
        title: {
          text: 'Sem dados de desfecho por janela terapêutica',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    const cats = safeData.map((d) => d.window);
    const cure = safeData.map((d) => d.cure_rate);
    const death = safeData.map((d) => d.death_rate);
    const margin = safeData.map((d) => d.margin);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: axisColor,
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        formatter: (params: unknown) => {
          const arr = params as Array<{ seriesName: string; value: number; dataIndex: number }>;
          if (!arr || arr.length === 0) return '';
          const idx = arr[0].dataIndex;
          const item = safeData[idx];
          if (!item) return '';
          let html = `<div style="font-weight:700;font-size:12px;margin-bottom:4px">${item.window} <span style="color:${textColor};font-weight:400">(${item.total} casos)</span></div>`;
          for (const p of arr) {
            const suffix = p.seriesName.includes('Margem') ? 'pp' : '%';
            const sign = p.seriesName.includes('Margem') && p.value > 0 ? '+' : '';
            html += `<div style="font-size:11px;display:flex;justify-content:space-between;gap:12px"><span>${p.seriesName}</span><b>${sign}${p.value}${suffix}</b></div>`;
          }
          return html;
        },
      },
      legend: {
        data: ['Cura', 'Óbito', 'Margem (cura−óbito)'],
        top: 0,
        textStyle: { color: textColor, fontSize: 11 },
        itemWidth: 14,
        itemHeight: 8,
      },
      grid: { left: '4%', right: '4%', bottom: '12%', top: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        data: cats,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { color: textColor, formatter: '{value}%' },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      },
      series: [
        {
          name: 'Margem (cura−óbito)',
          type: 'line',
          data: margin,
          smooth: true,
          symbolSize: 7,
          yAxisIndex: 0,
          lineStyle: { color: MARGIN_COLOR, width: 1.5, type: 'dashed' },
          itemStyle: { color: MARGIN_COLOR },
          areaStyle: { color: 'rgba(15, 118, 110, 0.12)' },
          label: {
            show: true,
            position: 'top',
            formatter: (params: { value: number }) =>
              params.value > 0 ? `+${params.value}pp` : `${params.value}pp`,
            fontSize: 9,
            color: MARGIN_COLOR,
            fontWeight: 500,
          },
        },
        {
          name: 'Cura',
          type: 'line',
          data: cure,
          smooth: true,
          symbolSize: 10,
          lineStyle: { color: CURE_COLOR, width: 2.5 },
          itemStyle: { color: CURE_COLOR },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            fontSize: 10,
            color: CURE_COLOR,
            fontWeight: 500,
            distance: 6,
          },
        },
        {
          name: 'Óbito',
          type: 'line',
          data: death,
          smooth: true,
          symbolSize: 10,
          lineStyle: { color: DEATH_COLOR, width: 2.5 },
          itemStyle: { color: DEATH_COLOR },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            fontSize: 10,
            color: DEATH_COLOR,
            fontWeight: 500,
            distance: 6,
          },
        },
      ],
    };
  }, [safeData, theme]);

  const { chartRef } = useEcharts(option, [safeData, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%' }} />;
};

export default AntiviralOutcomeSlopegraph;
