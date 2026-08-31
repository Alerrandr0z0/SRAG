import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import type { ComorbiditiesTreemapItem } from '../../types/epi';

interface ComorbiditiesTreemapChartProps {
  data: ComorbiditiesTreemapItem[] | null;
}

interface CustomRenderParams {
  coordSys: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface CustomRenderApi {
  value: (dimension: number) => number;
  coord: (data: [number, number]) => [number, number];
  size: (data: [number, number]) => [number, number];
  style: (extra?: Record<string, unknown>) => Record<string, unknown>;
  visual: (key: string) => string;
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

    // Filter out zero-case or zero-OR data to prevent log-scale issues
    // Sort in ascending order because ECharts category yAxis renders index 0 at the bottom
    const filtered = data
      .filter((d) => d.value > 0 && d.odds_ratio > 0)
      .sort((a, b) => a.odds_ratio - b.odds_ratio);

    if (filtered.length === 0) {
      return {
        title: {
          text: 'Sem comorbidades com dados suficientes para análise de OR',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const categories = filtered.map((d) => d.name);

    // Whiskers and ticks for 95% CI
    const customData = filtered.map((d, index) => [d.odds_ratio, index, d.ci_lower, d.ci_upper]);

    // Scatter data for Odds Ratio point
    const scatterData = filtered.map((d, index) => [
      d.odds_ratio,
      index,
      d.ci_lower,
      d.ci_upper,
      d.prevalence,
      d.value,
      d.deaths,
      d.lethality,
      d.name,
    ]);

    return {
      grid: {
        left: 140, // fixed pixel width for category labels
        right: 60, // increased to avoid whiskers clipping at the edge
        top: 10,
        bottom: 30,
        containLabel: false,
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f1f5f9' : '#0f172a', fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
        formatter: (params: { data: unknown[] }) => {
          const d = params.data;
          if (!d || d.length < 9) return '';
          const name = d[8] as string;
          const or = d[0] as number;
          const ciLower = d[2] as number;
          const ciUpper = d[3] as number;
          const prev = d[4] as number;
          const cases = d[5] as number;
          const deaths = d[6] as number;
          const leth = d[7] as number;

          const swatchColor =
            or > 1.0 && ciLower > 1.0
              ? '#ef4444'
              : or < 1.0 && ciUpper < 1.0
                ? '#3b82f6'
                : '#94a3b8';

          const swatch = `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${swatchColor};margin-right:6px;vertical-align:middle"></span>`;
          const associationText =
            or > 1.0 && ciLower > 1.0
              ? '<span style="color:#ef4444;font-weight:600">Aumenta risco de óbito</span>'
              : or < 1.0 && ciUpper < 1.0
                ? '<span style="color:#3b82f6;font-weight:600">Fator de proteção</span>'
                : '<span style="color:#94a3b8">Sem associação significativa</span>';

          return `<div style="min-width:240px">${swatch}<strong>${name}</strong>
            <div style="margin: 4px 0 8px 0; font-size:11px">${associationText}</div>
            <table style="width:100%;font-size:11px;border-collapse:collapse">
              <tr style="border-bottom:1px solid ${isDark ? '#334155' : '#e2e8f0'}"><td style="color:#64748b;padding:3px 0">Odds Ratio (OR)</td><td style="text-align:right;padding:3px 0"><b>${or.toFixed(2)}</b></td></tr>
              <tr style="border-bottom:1px solid ${isDark ? '#334155' : '#e2e8f0'}"><td style="color:#64748b;padding:3px 0">IC 95%</td><td style="text-align:right;padding:3px 0"><b>[${ciLower.toFixed(2)}, ${ciUpper.toFixed(2)}]</b></td></tr>
              <tr style="border-bottom:1px solid ${isDark ? '#334155' : '#e2e8f0'}"><td style="color:#64748b;padding:3px 0">Prevalência</td><td style="text-align:right;padding:3px 0"><b>${prev.toFixed(1)}%</b> (${cases.toLocaleString('pt-BR')} casos)</td></tr>
              <tr style="border-bottom:1px solid ${isDark ? '#334155' : '#e2e8f0'}"><td style="color:#64748b;padding:3px 0">Óbitos / CFR</td><td style="text-align:right;padding:3px 0"><b>${deaths} óbitos</b> (${leth.toFixed(1)}%)</td></tr>
            </table>
          </div>`;
        },
      },
      xAxis: {
        type: 'log',
        name: 'Odds Ratio (OR) — Escala Log',
        nameLocation: 'center',
        nameGap: 25,
        min: 0.1,
        max: 10,
        axisLabel: {
          color: isDark ? '#cbd5e1' : '#475569',
          formatter: (value: number) => {
            if (value === 0.1) return '0.1';
            if (value === 0.2) return '0.2';
            if (value === 0.5) return '0.5';
            if (value === 1) return '1';
            if (value === 2) return '2';
            if (value === 5) return '5';
            if (value === 10) return '10';
            return value.toString();
          },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: isDark ? '#334155' : '#e2e8f0',
            type: 'dotted',
          },
        },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          color: isDark ? '#ffffff' : '#0f172a',
          fontSize: 10,
          margin: 12,
          interval: 0, // Force ECharts to render every single category label
        },
        axisLine: {
          lineStyle: {
            color: isDark ? '#334155' : '#cbd5e1',
          },
        },
        splitLine: {
          show: false,
        },
      },
      series: [
        {
          type: 'custom',
          name: 'IC 95%',
          renderItem: (_params: CustomRenderParams, api: CustomRenderApi) => {
            const categoryIndex = api.value(1);
            const rawLow = api.value(2);
            const rawHigh = api.value(3);
            const or = api.value(0);

            // Clamp values to visible x-axis scale to prevent spilling outside grid boundaries
            const low = Math.max(0.1, rawLow);
            const high = Math.min(10, rawHigh);

            const pLow = api.coord([low, categoryIndex]);
            const pHigh = api.coord([high, categoryIndex]);

            // If coordinates are outside graph area or invalid, don't render
            if (Number.isNaN(pLow[0]) || Number.isNaN(pHigh[0])) {
              return null;
            }

            const tickSize = 3;
            const isSig = (or > 1.0 && rawLow > 1.0) || (or < 1.0 && rawHigh < 1.0);
            const strokeColor = isSig
              ? isDark
                ? '#cbd5e1'
                : '#475569'
              : isDark
                ? 'rgba(148, 163, 184, 0.35)'
                : 'rgba(148, 163, 184, 0.55)';
            const lineWidth = isSig ? 1.5 : 0.8;

            return {
              type: 'group',
              children: [
                {
                  type: 'line',
                  shape: {
                    x1: pLow[0],
                    y1: pLow[1],
                    x2: pHigh[0],
                    y2: pHigh[1],
                  },
                  style: api.style({
                    stroke: strokeColor,
                    lineWidth: lineWidth,
                  }),
                },
                {
                  type: 'line',
                  shape: {
                    x1: pLow[0],
                    y1: pLow[1] - tickSize,
                    x2: pLow[0],
                    y2: pLow[1] + tickSize,
                  },
                  style: api.style({
                    stroke: strokeColor,
                    lineWidth: lineWidth,
                  }),
                },
                {
                  type: 'line',
                  shape: {
                    x1: pHigh[0],
                    y1: pHigh[1] - tickSize,
                    x2: pHigh[0],
                    y2: pHigh[1] + tickSize,
                  },
                  style: api.style({
                    stroke: strokeColor,
                    lineWidth: lineWidth,
                  }),
                },
              ],
            };
          },
          encode: {
            x: [2, 3],
            y: 1,
          },
          data: customData,
          z: 10,
        },
        {
          type: 'scatter',
          name: 'Odds Ratio (OR)',
          symbol: 'circle',
          symbolSize: (val: unknown) => {
            if (!Array.isArray(val) || val.length < 5) return 10;
            const prevalence = val[4] as number;
            // Scale point size based on prevalence of comorbidity (min 8px, max 20px)
            return Math.max(8, Math.min(8 + prevalence * 0.4, 20));
          },
          data: scatterData,
          itemStyle: {
            color: (params: { data?: unknown }) => {
              const d = params.data;
              if (!Array.isArray(d) || d.length < 4) return '#94a3b8';
              const or = d[0] as number;
              const ciLower = d[2] as number;
              const ciUpper = d[3] as number;

              // Significantly increased risk (OR > 1 & lower bound > 1) -> Red
              if (or > 1.0 && ciLower > 1.0) return '#ef4444';
              // Significantly protective (OR < 1 & upper bound < 1) -> Blue
              if (or < 1.0 && ciUpper < 1.0) return '#3b82f6';
              // Non-significant -> Gray
              return '#94a3b8';
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              show: true,
              position: 'end',
              formatter: 'Sem associação (OR=1.0)',
              fontSize: 9,
              color: isDark ? '#64748b' : '#94a3b8',
            },
            lineStyle: {
              type: 'dashed',
              color: isDark ? '#475569' : '#cbd5e1',
              width: 1.5,
            },
            data: [{ xAxis: 1.0 }],
          },
          z: 20,
        },
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div ref={chartRef} style={{ flex: 1, minHeight: 0 }} />
      <div
        style={{
          margin: '0.25rem 0 0 0',
          fontSize: '0.72rem',
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          lineHeight: 1.3,
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          gap: '1.25rem',
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              marginRight: '4px',
            }}
          />
          Associação c/ Óbito (OR &gt; 1)
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              marginRight: '4px',
            }}
          />
          Fator Protetor (OR &lt; 1)
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#94a3b8',
              marginRight: '4px',
            }}
          />
          Sem Significado Estatístico
        </span>
        <span>
          <span style={{ fontSize: '0.68rem', color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
            Tamanho (Prevalência):
          </span>
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#94a3b8',
              margin: '0 3px 0 6px',
              verticalAlign: 'middle',
            }}
          />{' '}
          5%
          <span
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#94a3b8',
              margin: '0 3px 0 6px',
              verticalAlign: 'middle',
            }}
          />{' '}
          15%
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: '#94a3b8',
              margin: '0 3px 0 6px',
              verticalAlign: 'middle',
            }}
          />{' '}
          30%+
        </span>
      </div>
    </div>
  );
};

export default ComorbiditiesTreemapChart;
