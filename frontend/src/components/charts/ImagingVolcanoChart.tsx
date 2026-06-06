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

const ImagingVolcanoChart: React.FC<ImagingVolcanoChartProps> = ({ data }) => {
  const theme = useThemeMode();

  const getOption = () => {
    const raiox = data?.raiox ?? [];
    const tomo = data?.tomo ?? [];

    if (!data || (raiox.length === 0 && tomo.length === 0)) {
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
    const axisColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    const allPoints = [...raiox, ...tomo];
    const medianUti = (() => {
      const sorted = [...allPoints.map((p) => p.uti_rate)].sort((a, b) => a - b);
      if (sorted.length === 0) return 0;
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    })();
    const medianDeath = (() => {
      const sorted = [...allPoints.map((p) => p.death_rate)].sort((a, b) => a - b);
      if (sorted.length === 0) return 0;
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    })();

    const toSeriesData = (list: FindingItem[]) =>
      list.map((item) => ({
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
            <div style="font-weight:700;font-size:12px;margin-bottom:6px">${params.name}</div>
            <div style="font-size:11px;color:${textColor};margin-bottom:6px">${params.seriesName}</div>
            <table style="font-size:11px;border-collapse:collapse">
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">Casos totais</td><td style="font-weight:600;text-align:right">${total}</td></tr>
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">UTI</td><td style="font-weight:600;text-align:right">${utiCount} (${uti}%)</td></tr>
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">Óbitos</td><td style="font-weight:600;text-align:right">${deathCount} (${cfr}%)</td></tr>
            </table>
          `;
        },
      },
      legend: {
        data: ['Raio-X', 'Tomografia'],
        bottom: 0,
        textStyle: { color: textColor },
        itemWidth: 14,
        itemHeight: 10,
      },
      grid: { left: '4%', right: '4%', bottom: '14%', top: '8%', containLabel: true },
      xAxis: {
        name: 'Taxa de UTI (%)',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: textColor, fontSize: 11 },
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, formatter: '{value}%' },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      },
      yAxis: {
        name: 'Letalidade (CFR %)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: textColor, fontSize: 11 },
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, formatter: '{value}%' },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      },
      series: [
        {
          name: 'Raio-X',
          type: 'scatter',
          data: toSeriesData(raiox),
          itemStyle: {
            color: RAIOX_COLOR,
            opacity: 0.7,
            borderColor: RAIOX_COLOR,
            borderWidth: 1.5,
          },
          emphasis: {
            scale: 1.15,
            itemStyle: { opacity: 1, borderWidth: 2 },
            label: { show: true, formatter: '{b}', position: 'top', color: textColor, fontSize: 10 },
          },
          label: { show: false },
          labelLayout: { moveOverlap: 'shiftY' },
        },
        {
          name: 'Tomografia',
          type: 'scatter',
          data: toSeriesData(tomo),
          itemStyle: {
            color: TOMO_COLOR,
            opacity: 0.7,
            borderColor: TOMO_COLOR,
            borderWidth: 1.5,
          },
          emphasis: {
            scale: 1.15,
            itemStyle: { opacity: 1, borderWidth: 2 },
            label: { show: true, formatter: '{b}', position: 'top', color: textColor, fontSize: 10 },
          },
          label: { show: false },
          labelLayout: { moveOverlap: 'shiftY' },
        },
      ],
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { type: 'dashed', color: textColor, opacity: 0.5, width: 1 },
        label: { color: textColor, fontSize: 9 },
        data: [
          { xAxis: medianUti, name: `Mediana UTI ${medianUti.toFixed(0)}%` },
          { yAxis: medianDeath, name: `Mediana CFR ${medianDeath.toFixed(0)}%` },
        ],
      },
      markArea: {
        silent: true,
        itemStyle: { color: '#e11d48', opacity: 0.06 },
        data: [
          [
            { xAxis: medianUti, yAxis: medianDeath },
            { xAxis: 100, yAxis: 100 },
          ],
        ],
      },
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          fontSize: 11,
          color: 'var(--text-muted)',
          padding: '4px 0 6px',
          flexWrap: 'wrap',
        }}
      >
        <span>
          <b>Eixo X</b>: UTI%
        </span>
        <span>
          <b>Eixo Y</b>: CFR%
        </span>
        <span>
          <b>Tamanho</b>: √(casos totais)
        </span>
        <span>
          <b>Cor</b>: modalidade
        </span>
        <span style={{ color: '#e11d48' }}>
          ● Quadrante superior-direito = alto risco
        </span>
      </div>
      <div ref={chartRef} style={{ flex: 1, minHeight: 360 }} />
    </div>
  );
};

export default ImagingVolcanoChart;
