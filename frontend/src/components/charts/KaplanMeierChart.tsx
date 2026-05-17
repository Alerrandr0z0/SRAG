import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import * as Epi from '../../types/epi';
import { useThemeMode } from '../../hooks/useThemeMode';

interface KaplanMeierChartProps {
  survivalData: Epi.VaccineSurvival | null;
}

const KaplanMeierChart: React.FC<KaplanMeierChartProps> = ({ survivalData }) => {
  const theme = useThemeMode();
  const option = useMemo(() => {
    if (!survivalData) return {};
    const covid = survivalData.covid || {};
    const gripe = survivalData.gripe || {};
    const mapCoords = (timeline: number[], values: number[]) => (timeline || []).map((t, i) => [t, values[i]]);
    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#cbd5e1';
    const textColor = isDark ? '#cbd5e1' : '#334155';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    return {
      tooltip: { trigger: 'axis' },
      legend: {
        show: true,
        top: 0,
        left: 'center',
        data: ['COVID-19', 'Gripe'],
        textStyle: { fontSize: 13, color: textColor }
      },
      grid: { top: 60, left: 60, right: 30, bottom: 60 },
      xAxis: {
        type: 'value',
        min: 0,
        max: 24,
        name: 'Meses após última dose',
        nameLocation: 'middle',
        nameGap: 35,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value',
        name: 'Probabilidade (%)',
        min: 0,
        max: 100,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        { name: 'COVID-19', data: mapCoords(covid.timeline, covid.survival), type: 'line', step: 'end', symbol: 'none', lineStyle: { color: '#0f766e', width: 3 }, z: 10 },
        { name: 'COVID IC Low', type: 'line', data: mapCoords(covid.timeline, covid.ci_lower), lineStyle: { opacity: 0 }, stack: 'covid-ci', symbol: 'none' },
        { name: 'COVID IC Band', type: 'line', data: mapCoords(covid.timeline, (covid.ci_upper || []).map((v, i) => v - (covid.ci_lower[i] || 0))), lineStyle: { opacity: 0 }, areaStyle: { color: '#0f766e', opacity: 0.15 }, stack: 'covid-ci', symbol: 'none' },
        { name: 'Gripe', data: mapCoords(gripe.timeline, gripe.survival), type: 'line', step: 'end', symbol: 'none', lineStyle: { color: '#1d4ed8', width: 3 }, z: 10 },
        { name: 'Gripe IC Low', type: 'line', data: mapCoords(gripe.timeline, gripe.ci_lower), lineStyle: { opacity: 0 }, stack: 'gripe-ci', symbol: 'none' },
        { name: 'Gripe IC Band', type: 'line', data: mapCoords(gripe.timeline, (gripe.ci_upper || []).map((v, i) => v - (gripe.ci_lower[i] || 0))), lineStyle: { opacity: 0 }, areaStyle: { color: '#1d4ed8', opacity: 0.15 }, stack: 'gripe-ci', symbol: 'none' }
      ]
    };
  }, [survivalData, theme]);

  const { chartRef } = useEcharts(option, [survivalData]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div ref={chartRef} className="echart-host" style={{ width: '100%', flex: 1 }} />
      <p className="meta" style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px' }}>
        Representa a probabilidade estimada de evitar hospitalização grave ao longo do tempo.
        As áreas claras indicam o intervalo de confiança estatística.
      </p>
    </div>
  );
};

export default KaplanMeierChart;
