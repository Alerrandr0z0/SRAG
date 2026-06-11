import React from 'react';
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

export interface ImagingVolcanoData {
  raiox: FindingItem[];
  tomo: FindingItem[];
}

interface ImagingVolcanoChartProps {
  data: ImagingVolcanoData | null;
}

const RAIOX_COLOR = '#0284c7';
const TOMO_COLOR = '#0f766e';

const symbolSize = (total: number) => {
  const scaled = Math.sqrt(Math.max(total, 1)) * 4.5;
  return Math.max(14, Math.min(scaled, 60));
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const buildPanelOption = (
  list: FindingItem[],
  color: string,
  sharedScale: { xMin: number; xMax: number; yMin: number; yMax: number },
  theme: 'light' | 'dark',
  emptyMessage: string,
) => {
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  if (list.length === 0) {
    return {
      title: {
        text: emptyMessage,
        left: 'center',
        top: 'center',
        textStyle: { color: textColor, fontSize: 12 },
      },
    };
  }

  const medianUti = median(list.map((p) => p.uti_rate));
  const medianDeath = median(list.map((p) => p.death_rate));

  const data = list.map((item) => ({
    name: item.finding,
    value: [
      Number(item.uti_rate.toFixed(1)),
      Number(item.death_rate.toFixed(1)),
      item.total,
      item.uti_count,
      item.death_count,
    ],
    symbolSize: symbolSize(item.total),
  }));

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderColor: axisColor,
      textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
      formatter: (params: {
        seriesName: string;
        name: string;
        value: [number, number, number, number, number];
      }) => {
        const [uti, cfr, total, utiCount, deathCount] = params.value;
        return `
            <div style="font-weight:700;font-size:12px;margin-bottom:4px">${params.name}</div>
            <table style="font-size:11px;border-collapse:collapse">
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">Casos totais</td><td style="font-weight:600;text-align:right">${total}</td></tr>
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">UTI</td><td style="font-weight:600;text-align:right">${utiCount} (${uti}%)</td></tr>
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">Óbitos</td><td style="font-weight:600;text-align:right">${deathCount} (${cfr}%)</td></tr>
            </table>
          `;
      },
    },
    grid: { left: '8%', right: '6%', bottom: '14%', top: '10%', containLabel: true },
    xAxis: {
      name: 'UTI (%)',
      nameLocation: 'middle',
      nameGap: 22,
      nameTextStyle: { color: textColor, fontSize: 10 },
      type: 'value',
      min: sharedScale.xMin,
      max: sharedScale.xMax,
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: textColor, formatter: '{value}%', fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
    },
    yAxis: {
      name: 'CFR (%)',
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { color: textColor, fontSize: 10 },
      type: 'value',
      min: sharedScale.yMin,
      max: sharedScale.yMax,
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: textColor, formatter: '{value}%', fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
    },
    series: [
      {
        type: 'scatter',
        data,
        itemStyle: {
          color,
          opacity: 0.7,
          borderColor: color,
          borderWidth: 1.5,
        },
        emphasis: {
          scale: 1.15,
          itemStyle: { opacity: 1, borderWidth: 2 },
          label: {
            show: true,
            fontWeight: 700,
            color: isDark ? '#f8fafc' : '#0f172a',
          },
        },
        label: {
          show: true,
          position: (params: { value: [number, number, number, number, number] }) =>
            params.value[1] > medianDeath ? 'top' : 'bottom',
          formatter: '{b}',
          color: isDark ? '#f8fafc' : '#0f172a',
          fontSize: 9,
          fontWeight: 600,
          textBorderColor: isDark ? '#0f172a' : '#ffffff',
          textBorderWidth: 2.5,
        },
        labelLayout: {
          hideOverlap: true,
          moveOverlap: 'shiftY',
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: textColor, opacity: 0.8, width: 1.2 },
          label: {
            color: textColor,
            fontSize: 9,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            padding: [2, 4],
            borderColor: axisColor,
            borderWidth: 0.5,
            borderRadius: 2,
          },
          data: [
            { xAxis: medianUti, name: `UTI ${medianUti.toFixed(0)}%` },
            { yAxis: medianDeath, name: `CFR ${medianDeath.toFixed(0)}%` },
          ],
        },
        markArea: {
          silent: true,
          itemStyle: { color: '#e11d48', opacity: 0.15 },
          data: [
            [
              { xAxis: medianUti, yAxis: medianDeath },
              { xAxis: sharedScale.xMax, yAxis: sharedScale.yMax },
            ],
          ],
        },
      },
    ],
  };
};

const computeSharedScale = (data: ImagingVolcanoData) => {
  const allPoints = [...data.raiox, ...data.tomo];
  if (allPoints.length === 0) {
    return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
  }
  const utiRates = allPoints.map((p) => p.uti_rate);
  const cfrRates = allPoints.map((p) => p.death_rate);
  const xMin = Math.max(0, Math.floor(Math.min(...utiRates) - 8));
  const xMax = Math.min(100, Math.ceil(Math.max(...utiRates) + 8));
  const yMin = Math.max(0, Math.floor(Math.min(...cfrRates) - 6));
  const yMax = Math.min(100, Math.ceil(Math.max(...cfrRates) + 6));
  return { xMin, xMax, yMin, yMax };
};

const PanelHeader: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
      }}
    />
    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
  </div>
);

const GlobalLegend: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const mutedColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        marginTop: 12,
        fontSize: 10,
        color: mutedColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 16,
            height: 0,
            borderTop: `1.5px dashed ${mutedColor}`,
            opacity: 0.6,
            display: 'inline-block',
          }}
        />
        Mediana UTI / CFR
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 10,
            height: 10,
            background: 'rgba(225, 29, 72, 0.14)',
            border: '1px solid rgba(225, 29, 72, 0.35)',
            display: 'inline-block',
            borderRadius: 2,
          }}
        />
        Alto Risco (acima das medianas)
      </span>
      <span>
        Tamanho da bolha: <b>proporcional aos casos</b>
      </span>
    </div>
  );
};

const ImagingVolcanoChart: React.FC<ImagingVolcanoChartProps> = ({ data }) => {
  const theme = useThemeMode();
  const isDark = theme === 'dark';
  const borderColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'var(--border-subtle)';
  const cardBg = isDark ? 'var(--bg-status)' : 'var(--bg-status)';

  const sharedScale = computeSharedScale(data ?? { raiox: [], tomo: [] });
  const raioxOption = buildPanelOption(
    data?.raiox ?? [],
    RAIOX_COLOR,
    sharedScale,
    theme,
    'Sem achados de Raio-X',
  );
  const tomoOption = buildPanelOption(
    data?.tomo ?? [],
    TOMO_COLOR,
    sharedScale,
    theme,
    'Sem achados de Tomografia',
  );

  const rxRef = useEcharts(raioxOption, [data, theme]);
  const tcRef = useEcharts(tomoOption, [data, theme]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginTop: 4,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            background: cardBg,
            border: `0.5px solid ${borderColor}`,
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PanelHeader color={RAIOX_COLOR} label="Raio-X" />
          <div ref={rxRef.chartRef} style={{ flex: 1, minHeight: 240 }} />
        </div>
        <div
          style={{
            background: cardBg,
            border: `0.5px solid ${borderColor}`,
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PanelHeader color={TOMO_COLOR} label="Tomografia" />
          <div ref={tcRef.chartRef} style={{ flex: 1, minHeight: 240 }} />
        </div>
      </div>
      <GlobalLegend theme={theme} />
    </div>
  );
};

export default ImagingVolcanoChart;
