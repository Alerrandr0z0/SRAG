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

interface EChartsTreemapParams {
  data: {
    name: string;
    value: number;
    deaths: number;
    lethality: number;
  };
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

    // Find max lethality for coloring scaling
    const maxLethality = Math.max(...data.map((d) => d.lethality), 1);

    // Helper to map lethality to color
    const getLethalityColor = (lethality: number) => {
      const ratio = Math.min(lethality / maxLethality, 1);
      if (ratio < 0.25) return '#fef3c7';
      if (ratio < 0.5) return '#f59e0b';
      if (ratio < 0.75) return '#b45309';
      return '#78350f';
    };

    const treemapData = data
      .filter((d) => d.value > 0)
      .map((d) => ({
        name: d.name,
        value: d.value, // Size dimension (number)
        deaths: d.deaths,
        lethality: d.lethality,
        itemStyle: {
          color: getLethalityColor(d.lethality),
        },
      }));

    return {
      tooltip: {
        formatter: (params: EChartsTreemapParams) => {
          const d = params.data;
          if (!d) return '';
          return `Comorbidade: <b>${d.name}</b><br/>Casos: <b>${d.value}</b><br/>Óbitos: <b>${d.deaths}</b><br/>Letalidade (CFR): <b>${d.lethality}%</b>`;
        },
      },
      series: [
        {
          name: 'Comorbidades',
          type: 'treemap',
          data: treemapData,
          breadcrumb: { show: false },
          label: {
            show: true,
            formatter: '{b}',
            fontSize: 10,
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
        ⚠️ Nota: Os fatores de risco e comorbidades são baseados nas fichas de notificação
        preenchidas. Fichas com valores em branco ou ignorados não são contabilizadas, podendo
        subestimar as prevalências.
      </p>
    </div>
  );
};

export default ComorbiditiesTreemapChart;
