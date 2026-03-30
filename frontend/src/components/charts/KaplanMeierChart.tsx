import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import * as Epi from '../../types/epi';

interface KaplanMeierChartProps {
  survivalData: Epi.VaccineSurvival | null;
}

const KaplanMeierChart: React.FC<KaplanMeierChartProps> = ({ survivalData }) => {
  const option = useMemo(() => {
    if (!survivalData) return {};
    const covid = survivalData.covid || {};
    const gripe = survivalData.gripe || {};
    const mapCoords = (timeline: number[], values: number[]) => (timeline || []).map((t, i) => [t, values[i]]);
    
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 10 },
      grid: { top: 40, left: 60, right: 30, bottom: 80 },
      xAxis: { type: 'value', min: 0, max: 24, name: 'Meses após última dose', nameLocation: 'middle', nameGap: 35 },
      yAxis: { type: 'value', name: 'Probabilidade (%)', min: 0, max: 100 },
      series: [
        { name: 'COVID-19', data: mapCoords(covid.timeline, covid.survival), type: 'line', step: 'end', symbol: 'none', lineStyle: { color: '#0f766e', width: 3 }, z: 10 },
        { name: 'COVID IC Low', type: 'line', data: mapCoords(covid.timeline, covid.ci_lower), lineStyle: { opacity: 0 }, stack: 'covid-ci', symbol: 'none' },
        { name: 'COVID IC Band', type: 'line', data: mapCoords(covid.timeline, (covid.ci_upper || []).map((v, i) => v - (covid.ci_lower[i] || 0))), lineStyle: { opacity: 0 }, areaStyle: { color: '#0f766e', opacity: 0.15 }, stack: 'covid-ci', symbol: 'none' },
        { name: 'Gripe', data: mapCoords(gripe.timeline, gripe.survival), type: 'line', step: 'end', symbol: 'none', lineStyle: { color: '#1d4ed8', width: 3 }, z: 10 },
        { name: 'Gripe IC Low', type: 'line', data: mapCoords(gripe.timeline, gripe.ci_lower), lineStyle: { opacity: 0 }, stack: 'gripe-ci', symbol: 'none' },
        { name: 'Gripe IC Band', type: 'line', data: mapCoords(gripe.timeline, (gripe.ci_upper || []).map((v, i) => v - (gripe.ci_lower[i] || 0))), lineStyle: { opacity: 0 }, areaStyle: { color: '#1d4ed8', opacity: 0.15 }, stack: 'gripe-ci', symbol: 'none' }
      ]
    };
  }, [survivalData]);

  const { chartRef } = useEcharts(option, [survivalData]);

  return <div ref={chartRef} className="echart-host" style={{ width: '100%', height: '100%' }} />;
};

export default KaplanMeierChart;
