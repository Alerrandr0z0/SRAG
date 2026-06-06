import React, { useState } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface ClosureCriteriaAgentData {
  agent: string;
  total: number;
  Laboratorial: number;
  'Vínculo Epidemiológico': number;
  'Clínico / Imagem': number;
  Óbito: number;
  'Ignorado/Em Aberto': number;
}

interface ClosureCriteriaAgentChartProps {
  data: ClosureCriteriaAgentData[] | null;
}

type Mode = 'volume' | 'percentage';

const ClosureCriteriaAgentChart: React.FC<ClosureCriteriaAgentChartProps> = ({ data }) => {
  const theme = useThemeMode();
  const [mode, setMode] = useState<Mode>('volume');

  const getOption = () => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: 'Sem dados de critério de encerramento',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const xAxisData = data.map((d) => d.agent);

    const criteriaList = [
      'Laboratorial',
      'Vínculo Epidemiológico',
      'Clínico / Imagem',
      'Óbito',
      'Ignorado/Em Aberto',
    ] as const;

    const colors = {
      Laboratorial: '#0f766e', // Teal 700
      'Vínculo Epidemiológico': '#6d28d9', // Violet 700
      'Clínico / Imagem': '#b45309', // Amber 700
      Óbito: '#be123c', // Rose 700
      'Ignorado/Em Aberto': '#64748b', // Slate 500
    };

    const series = criteriaList.map((criterion) => {
      const seriesData = data.map((d) => {
        const val = d[criterion] || 0;
        if (mode === 'percentage') {
          return d.total > 0 ? parseFloat(((val / d.total) * 100).toFixed(1)) : 0;
        }
        return val;
      });

      return {
        name: criterion,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: seriesData,
        itemStyle: { color: colors[criterion] },
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ seriesName: string; value: number }>) => {
          if (params.length === 0) return '';
          // Find agent index using param's dataIndex
          const dataIndex = (params[0] as { dataIndex?: number }).dataIndex ?? 0;
          const agent = xAxisData[dataIndex];
          const total = data[dataIndex]?.total || 0;
          let html = `Agente: <b>${agent}</b> (N = ${total})<br/>`;
          for (const item of params) {
            const suffix = mode === 'percentage' ? '%' : '';
            html += `${item.seriesName}: <b>${item.value}${suffix}</b><br/>`;
          }
          return html;
        },
      },
      legend: {
        data: criteriaList,
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
        axisLabel: { color: textColor, fontSize: 11 },
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
      series,
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

export default ClosureCriteriaAgentChart;
