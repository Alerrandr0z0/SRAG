import React, { useState } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import { VentilatorySupportResponse } from '../../types/epi';

interface VentilatorySupportChartProps {
  data: VentilatorySupportResponse | null;
}

type Mode = 'volume' | 'percentage';

const VentilatorySupportChart: React.FC<VentilatorySupportChartProps> = ({ data }) => {
  const theme = useThemeMode();
  const [mode, setMode] = useState<Mode>('volume');

  const getOption = () => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: 'Sem dados de suporte ventilatório',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const xAxisData = data.map((d) => d.epi_week);

    let seriesData: {
      invasive: number[];
      nonInvasive: number[];
      noSupport: number[];
      ignored: number[];
    };

    if (mode === 'volume') {
      seriesData = {
        invasive: data.map((d) => d.invasive),
        nonInvasive: data.map((d) => d.non_invasive),
        noSupport: data.map((d) => d.no_support),
        ignored: data.map((d) => d.ignored),
      };
    } else {
      // Percentage Mode (100% stacked bar)
      seriesData = {
        invasive: [],
        nonInvasive: [],
        noSupport: [],
        ignored: [],
      };

      for (const d of data) {
        const total = d.invasive + d.non_invasive + d.no_support + d.ignored;
        if (total > 0) {
          seriesData.invasive.push(parseFloat(((d.invasive / total) * 100).toFixed(1)));
          seriesData.nonInvasive.push(parseFloat(((d.non_invasive / total) * 100).toFixed(1)));
          seriesData.noSupport.push(parseFloat(((d.no_support / total) * 100).toFixed(1)));
          seriesData.ignored.push(parseFloat(((d.ignored / total) * 100).toFixed(1)));
        } else {
          seriesData.invasive.push(0);
          seriesData.nonInvasive.push(0);
          seriesData.noSupport.push(0);
          seriesData.ignored.push(0);
        }
      }
    }

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ seriesName: string; value: number }>) => {
          let html = `Semana: <b>${xAxisData[0]}</b>`; // default week index
          if (params.length > 0) {
            // Find week index using param's dataIndex
            const dataIndex = (params[0] as { dataIndex?: number }).dataIndex ?? 0;
            html = `Semana: <b>${xAxisData[dataIndex]}</b><br/>`;
          }
          for (const item of params) {
            const suffix = mode === 'percentage' ? '%' : '';
            html += `${item.seriesName}: <b>${item.value}${suffix}</b><br/>`;
          }
          return html;
        },
      },
      legend: {
        data: ['Invasivo', 'Não Invasivo', 'Sem Suporte', 'Ignorado'],
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
        type: 'category',
        data: xAxisData,
        axisLine: { show: true, lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, rotate: 45, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: mode === 'percentage' ? 'Percentual (%)' : 'Pacientes',
        max: mode === 'percentage' ? 100 : undefined,
        axisLabel: {
          formatter: mode === 'percentage' ? '{value}%' : '{value}',
          color: textColor,
        },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
      },
      series: [
        {
          name: 'Invasivo',
          type: 'bar',
          stack: 'total',
          emphasis: { focus: 'series' },
          data: seriesData.invasive,
          itemStyle: { color: '#b91c1c' }, // Red 700
        },
        {
          name: 'Não Invasivo',
          type: 'bar',
          stack: 'total',
          emphasis: { focus: 'series' },
          data: seriesData.nonInvasive,
          itemStyle: { color: '#ca8a04' }, // Yellow 600
        },
        {
          name: 'Sem Suporte',
          type: 'bar',
          stack: 'total',
          emphasis: { focus: 'series' },
          data: seriesData.noSupport,
          itemStyle: { color: '#15803d' }, // Green 700
        },
        {
          name: 'Ignorado',
          type: 'bar',
          stack: 'total',
          emphasis: { focus: 'series' },
          data: seriesData.ignored,
          itemStyle: { color: '#94a3b8' }, // Slate 400
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, mode, theme]);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <div className="pill-group">
          <button
            type="button"
            className={`pill-btn ${mode === 'volume' ? 'active' : ''}`}
            onClick={() => setMode('volume')}
          >
            Absoluto
          </button>
          <button
            type="button"
            className={`pill-btn ${mode === 'percentage' ? 'active' : ''}`}
            onClick={() => setMode('percentage')}
          >
            Proporção (%)
          </button>
        </div>
      </div>
      <div ref={chartRef} style={{ flex: 1, minHeight: '300px' }} />
    </div>
  );
};

export default VentilatorySupportChart;
