import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

export interface ComorbiditiesTreemapItem {
  name: string;
  value: number; // case count
  deaths: number;
  lethality: number; // CFR %
}

export type ComorbidityMetric = 'cases' | 'lethality' | 'deaths';

interface ComorbiditiesTreemapChartProps {
  data: ComorbiditiesTreemapItem[] | null;
  metric: ComorbidityMetric;
  topN: number;
}

interface EChartsTreemapParams {
  data: {
    name: string;
    value: number;
    deaths: number;
    lethality: number;
  };
}

const METRIC_LABEL: Record<ComorbidityMetric, string> = {
  cases: 'casos',
  deaths: 'óbitos',
  lethality: '%',
};

const ComorbiditiesTreemapChart: React.FC<ComorbiditiesTreemapChartProps> = ({
  data,
  metric,
  topN,
}) => {
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

    const sorted = [...data]
      .filter((d) => d.value > 0)
      .sort((a, b) => {
        if (metric === 'cases') return b.value - a.value;
        if (metric === 'deaths') return b.deaths - a.deaths;
        return b.lethality - a.lethality;
      })
      .slice(0, topN);

    const maxLethality = Math.max(...data.map((d) => d.lethality), 1);

    const getLethalityColor = (lethality: number) => {
      const ratio = Math.min(lethality / maxLethality, 1);
      if (ratio < 0.25) return '#fef3c7';
      if (ratio < 0.5) return '#f59e0b';
      if (ratio < 0.75) return '#b45309';
      return '#78350f';
    };

    const getMetricValue = (d: ComorbiditiesTreemapItem): number => {
      if (metric === 'cases') return d.value;
      if (metric === 'deaths') return d.deaths;
      return d.lethality;
    };

    const treemapData = sorted.map((d) => ({
      name: d.name,
      value: getMetricValue(d),
      deaths: d.deaths,
      lethality: d.lethality,
      itemStyle: {
        color: getLethalityColor(d.lethality),
      },
    }));

    return {
      tooltip: {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f1f5f9' : '#0f172a', fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
        formatter: (params: EChartsTreemapParams) => {
          const d = params.data;
          if (!d) return '';
          const swatch = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${getLethalityColor(d.lethality)};margin-right:6px;vertical-align:middle"></span>`;
          return `<div style="min-width:200px">${swatch}<strong>${d.name}</strong>
            <table style="margin-top:6px;width:100%;font-size:11px">
              <tr><td style="color:#64748b">Casos</td><td style="text-align:right"><b>${d.value.toLocaleString('pt-BR')}</b></td></tr>
              <tr><td style="color:#64748b">Óbitos</td><td style="text-align:right"><b>${d.deaths.toLocaleString('pt-BR')}</b></td></tr>
              <tr><td style="color:#64748b">Letalidade (CFR)</td><td style="text-align:right"><b>${d.lethality.toFixed(1)}%</b></td></tr>
            </table>
          </div>`;
        },
      },
      series: [
        {
          name: 'Comorbidades',
          type: 'treemap',
          data: treemapData,
          breadcrumb: { show: false },
          roam: false,
          nodeClick: false,
          label: {
            show: true,
            position: 'inside',
            formatter:
              metric === 'lethality'
                ? '{name|{b}}\n{val|{c}%}'
                : `{name|{b}}\n{val|{c} ${METRIC_LABEL[metric]}}`,
            rich: {
              name: {
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 16,
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowBlur: 2,
              },
              val: {
                color: 'rgba(255,255,255,0.9)',
                fontSize: 10,
                lineHeight: 14,
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowBlur: 2,
              },
            },
            overflow: 'truncate',
            ellipsis: '…',
          },
          upperLabel: { show: false },
          itemStyle: {
            borderColor: isDark ? '#1e293b' : '#fff',
            borderWidth: 1,
            gapWidth: 1,
          },
          emphasis: {
            upperLabel: { show: false },
            itemStyle: { borderColor: '#0f766e', borderWidth: 2 },
          },
          levels: [
            {
              itemStyle: {
                borderColor: isDark ? '#1e293b' : '#fff',
                borderWidth: 1,
                gapWidth: 1,
              },
            },
          ],
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, metric, topN, theme]);

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
