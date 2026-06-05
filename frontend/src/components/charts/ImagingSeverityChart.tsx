import React, { useState } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface FindingItem {
  finding: string;
  total: number;
  uti_count: number;
  uti_rate: number;
  death_count: number;
  death_rate: number;
}

interface ImagingSeverityData {
  raiox: FindingItem[];
  tomo: FindingItem[];
}

interface ImagingSeverityChartProps {
  data: ImagingSeverityData | null;
}

type ScanType = 'raiox' | 'tomo';

const ImagingSeverityChart: React.FC<ImagingSeverityChartProps> = ({ data }) => {
  const theme = useThemeMode();
  const [scanType, setScanType] = useState<ScanType>('tomo');

  const getOption = () => {
    const list = data ? data[scanType] : [];
    if (!data || list.length === 0) {
      return {
        title: {
          text: 'Sem dados de imagem por gravidade',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const xAxisData = list.map((item) => item.finding);
    const utiRates = list.map((item) => item.uti_rate);
    const deathRates = list.map((item) => item.death_rate);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ seriesName: string; value: number }>) => {
          if (params.length === 0) return '';
          const dataIndex = (params[0] as { dataIndex?: number }).dataIndex ?? 0;
          const item = list[dataIndex];
          let html = `Achado: <b>${item.finding}</b> (Total = ${item.total})<br/>`;
          for (const param of params) {
            html += `${param.seriesName}: <b>${param.value}%</b><br/>`;
          }
          return html;
        },
      },
      legend: {
        data: ['Taxa de UTI', 'Letalidade (CFR)'],
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
          name: 'Taxa de UTI',
          type: 'bar',
          barMaxWidth: 30,
          emphasis: { focus: 'series' },
          data: utiRates,
          itemStyle: { color: '#0284c7' }, // Sky 600
        },
        {
          name: 'Letalidade (CFR)',
          type: 'bar',
          barMaxWidth: 30,
          emphasis: { focus: 'series' },
          data: deathRates,
          itemStyle: { color: '#e11d48' }, // Rose 600
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, scanType, theme]);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <div className="pill-group">
          <button
            type="button"
            className={`pill-btn ${scanType === 'tomo' ? 'active' : ''}`}
            onClick={() => setScanType('tomo')}
          >
            Tomografia (TC)
          </button>
          <button
            type="button"
            className={`pill-btn ${scanType === 'raiox' ? 'active' : ''}`}
            onClick={() => setScanType('raiox')}
          >
            Raio-X de Tórax
          </button>
        </div>
      </div>
      <div ref={chartRef} style={{ flex: 1, minHeight: '300px' }} />
    </div>
  );
};

export default ImagingSeverityChart;
