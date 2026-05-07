import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import * as Epi from '../../types/epi';

type HeatmapPoint = [number, number, number];
type HeatmapTooltip = { value: HeatmapPoint };

interface SymptomsHeatmapProps {
  labels: Epi.CitizenBootstrap['symptoms_heatmap']['labels'];
  matrix: Epi.CitizenBootstrap['symptoms_heatmap']['matrix'];
}

const SymptomsHeatmap: React.FC<SymptomsHeatmapProps> = ({ labels, matrix }) => {
  const option = useMemo(() => {
    const plotData: HeatmapPoint[] = [];
    let maxVal = 1;
    for (let y = 0; y < labels.length; y += 1) {
      for (let x = 0; x < labels.length; x += 1) {
        const value = Number(matrix?.[y]?.[x] || 0);
        if (value > maxVal) maxVal = value;
        plotData.push([x, y, value]);
      }
    }

    return {
      tooltip: {
        position: 'top',
        formatter: (params: HeatmapTooltip) => `${labels[params.value[1]]} x ${labels[params.value[0]]}: ${params.value[2]}`
      },
      grid: { top: 40, left: 150, right: 20, bottom: 60 },
      xAxis: {
        type: 'category',
        data: labels,
        splitArea: { show: true },
        axisLabel: { rotate: 45, interval: 0, fontSize: 10 }
      },
      yAxis: {
        type: 'category',
        data: labels,
        splitArea: { show: true },
        inverse: true,
        axisLabel: { fontSize: 10 }
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#eff6ff', '#93c5fd', '#1d4ed8'] }
      },
      series: [{
        name: 'Sinais e Sintomas',
        type: 'heatmap',
        data: plotData,
        label: { show: true, fontSize: 9, color: '#333' },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.35)' } }
      }],
    };
  }, [labels, matrix]);

  const { chartRef } = useEcharts(option, [labels, matrix]);

  return <div ref={chartRef} className="echart-host" style={{ width: '100%', height: '100%' }} />;
};

export default SymptomsHeatmap;
