import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import * as Epi from '../../types/epi';

interface VirusProfileChartProps {
  data: Epi.VirusData[];
}

export const VIRUS_COLOR_MAP: Record<string, string> = {
  // COVID-19 e variantes
  'COVID-19': '#ea580c',
  'SARS-CoV-2': '#ea580c',
  Ômicron: '#f97316',
  Delta: '#c2410c',
  Alfa: '#fb923c',
  Beta: '#d97706',
  Gama: '#b45309',
  Recombinante: '#f59e0b',
  Outra: '#e11d48',
  'Não sequenciado': '#9a3412',

  // Influenza e subtipos
  Influenza: '#2563eb',
  'Influenza A': '#1d4ed8',
  'A/H1N1 pdm09': '#1e40af',
  'A/H3N2': '#3b82f6',
  'A (Não subtipado)': '#60a5fa',
  'A (Não subtipável)': '#93c5fd',
  'Influenza B': '#0284c7',
  'B/Victoria': '#06b6d4',
  'B/Yamagata': '#0891b2',
  'Influenza (Não tipada)': '#1d4ed8',

  // VSR e outros
  VSR: '#0f766e',
  'Outros Vírus': '#9333ea',
  'Outro Agente': '#e11d48',
  'Não Especificada': '#64748b',
  'Em investigacao': '#64748b',
  'Em Investigação': '#64748b',
  'Nenhum Influenza detectado': '#64748b',
  'Nenhum COVID-19 detectado': '#64748b',
};

const FALLBACK_COLORS = [
  '#ea580c',
  '#2563eb',
  '#0f766e',
  '#9333ea',
  '#e11d48',
  '#0284c7',
  '#d97706',
  '#64748b',
];

export const getVirusColor = (virusName: string, index: number): string => {
  if (VIRUS_COLOR_MAP[virusName]) {
    return VIRUS_COLOR_MAP[virusName];
  }
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

const VirusProfileChart: React.FC<VirusProfileChartProps> = ({ data }) => {
  const theme = useThemeMode();
  const isDark = theme === 'dark';

  const total = useMemo(() => (data || []).reduce((sum, d) => sum + d.count, 0), [data]);

  const option = useMemo(() => {
    if (!data?.length || total === 0) return {};

    const textColor = isDark ? '#94a3b8' : '#64748b';
    const axisColor = isDark ? '#334155' : '#e2e8f0';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    // Para empilhar no ECharts em 1 única barra vertical:
    // Cada vírus vira uma série do tipo 'bar' com stack: 'total'
    const series = data.map((d, idx) => {
      const pct = total ? Number(((d.count / total) * 100).toFixed(1)) : 0;
      const color = getVirusColor(d.virus, idx);

      return {
        name: d.virus,
        type: 'bar',
        stack: 'total',
        barWidth: '70%',
        data: [pct],
        itemStyle: {
          color: color,
          borderColor: isDark ? '#0f172a' : '#ffffff',
          borderWidth: 1,
        },
      };
    });

    return {
      tooltip: {
        trigger: 'item',
        renderMode: 'html',
        appendToBody: true,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: axisColor,
        borderWidth: 1,
        padding: [6, 10],
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 11 },
        // biome-ignore lint/suspicious/noExplicitAny: ECharts tooltip params dynamically typed
        formatter: (params: any) => {
          const virusName = params.seriesName;
          const virusItem = data.find((d) => d.virus === virusName);
          const count = virusItem ? virusItem.count : 0;
          const pct = params.value;
          return `${params.marker} <b>${virusName}</b><br/>Casos: <b>${count.toLocaleString('pt-BR')}</b> (${pct}%)`;
        },
      },
      grid: {
        top: 10,
        bottom: 25,
        left: 35,
        right: 10,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: ['Perfil'],
        show: false,
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 25,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 9,
          formatter: '{value}%',
        },
        splitLine: {
          lineStyle: {
            color: gridColor,
            type: 'dashed',
          },
        },
      },
      series,
    };
  }, [data, total, isDark]);

  const { chartRef } = useEcharts(option, [data, total, isDark]);

  if (!data?.length || total === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        Sem dados de perfil viral para os filtros atuais.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default VirusProfileChart;
