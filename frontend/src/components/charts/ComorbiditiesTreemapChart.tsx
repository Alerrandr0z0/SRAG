import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface ComorbiditiesTreemapItem {
  name: string;
  value: number; // case count
  deaths: number;
  lethality: number; // CFR %
}

interface ComorbiditiesTreemapChartProps {
  data: ComorbiditiesTreemapItem[] | null;
}

const ComorbiditiesTreemapChart: React.FC<ComorbiditiesTreemapChartProps> = ({ data }) => {
  const theme = useThemeMode();

  const getOption = () => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: 'Sem dados de comorbidades disponíveis',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // Format data for treemap: each node value must be an array [count, lethality]
    // In ECharts treemap, if value is an array, the first element represents the size.
    const treemapData = data
      .filter((d) => d.value > 0) // Only show comorbidities with cases
      .map((d) => ({
        name: d.name,
        value: [d.value, d.lethality, d.deaths],
      }));

    // Find max lethality for visualMap scaling
    const maxLethality = Math.max(...data.map((d) => d.lethality), 1);

    return {
      tooltip: {
        formatter: (params: { data?: { name: string; value: [number, number, number] } }) => {
          if (!params.data) return '';
          const [count, lethality, deaths] = params.data.value;
          return `Comorbidade: <b>${params.data.name}</b><br/>Casos: <b>${count}</b><br/>Óbitos: <b>${deaths}</b><br/>Letalidade (CFR): <b>${lethality}%</b>`;
        },
      },
      visualMap: {
        min: 0,
        max: maxLethality,
        dimension: 1, // Color by lethality
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 12,
        itemHeight: 150,
        text: ['Letalidade (%)', ''],
        inRange: {
          color: ['#fef3c7', '#f59e0b', '#b45309', '#78350f'], // Amber/Brown tones
        },
        textStyle: { color: textColor, fontSize: 10 },
      },
      series: [
        {
          name: 'Comorbidades',
          type: 'treemap',
          visibleMin: 300,
          data: treemapData,
          leafDepth: 1,
          label: {
            show: true,
            formatter: '{b}\n({c} casos)',
          },
          itemStyle: {
            borderColor: isDark ? '#1e293b' : '#fff',
            borderWidth: 1,
            gapWidth: 1,
          },
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div ref={chartRef} style={{ flex: 1, minHeight: '300px' }} />
      <p
        style={{
          margin: '0.5rem 0 0 0',
          fontSize: '0.75rem',
          color: '#94a3b8',
          lineHeight: 1.3,
          textAlign: 'center',
        }}
      >
        ⚠️ Nota: Os fatores de risco e comorbidades são baseados nas fichas de notificação preenchidas. Fichas com valores em branco ou ignorados não são contabilizadas, podendo subestimar as prevalências.
      </p>
    </div>
  );
};

export default ComorbiditiesTreemapChart;
