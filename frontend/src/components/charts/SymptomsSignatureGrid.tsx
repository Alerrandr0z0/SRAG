import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { SymptomSignature } from '../../types/epi';
import { COLORS } from '../../constants';

interface Props {
  signature: SymptomSignature;
}

const SymptomsSignatureGrid: React.FC<Props> = ({ signature }) => {
  const { labels = [], bands = [], matrices = {} } = signature || {};

  const option = useMemo(() => {
    const hasData = Array.isArray(labels) && labels.length > 0 && 
                    Array.isArray(bands) && bands.length > 0 && 
                    matrices && typeof matrices === 'object' && Object.keys(matrices).length > 0;

    if (!hasData) {
        return {
            title: {
                text: 'Dados laboratoriais insuficientes para gerar a assinatura clínica de sintomas',
                left: 'center',
                top: 'middle',
                textStyle: { color: '#94a3b8', fontSize: 14 }
            },
            series: []
        };
    }

    const pathogens = [
      { key: 'covid', title: 'COVID-19' },
      { key: 'gripe', title: 'Influenza' },
      { key: 'vsr', title: 'VSR' }
    ].filter(p => !!matrices[p.key as keyof typeof matrices]);

    if (pathogens.length === 0) {
        return {
            title: { text: 'Nenhum patógeno disponível para exibição', left: 'center', top: 'middle' },
            series: []
        };
    }

    // Calculando o máximo global para escala compartilhada baseado na prevalência (%)
    let globalMax = 0;
    Object.values(matrices).forEach(matrix => {
      if (matrix && Array.isArray(matrix)) {
          matrix.forEach(row => {
            if (Array.isArray(row)) {
                row.forEach(cell => {
                    const val = Array.isArray(cell) ? cell[0] : 0;
                    if (val > globalMax) globalMax = val;
                });
            }
          });
      }
    });
    if (globalMax === 0) globalMax = 100;

    const grids: Array<Record<string, unknown>> = [];
    const xAxes: Array<Record<string, unknown>> = [];
    const yAxes: Array<Record<string, unknown>> = [];
    const series: Array<Record<string, unknown>> = [];
    const titles: Array<Record<string, unknown>> = [];

    pathogens.forEach((p, idx) => {
      const left = 15 + idx * 28;
      const width = 24;

      grids.push({
        left: `${left}%`,
        width: `${width}%`,
        top: '12%',
        bottom: '18%',
        containLabel: false
      });

      titles.push({
        text: p.title,
        left: `${left + width/2}%`,
        textAlign: 'center',
        top: '2%',
        textStyle: { fontSize: 13, fontWeight: 'bold', color: '#334155' }
      });

      xAxes.push({
        type: 'category',
        data: bands,
        gridIndex: idx,
        axisLabel: { interval: 0, rotate: 35, fontSize: 9, color: '#64748b' },
        splitArea: { show: true },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e2e8f0' } }
      });

      yAxes.push({
        type: 'category',
        data: labels,
        gridIndex: idx,
        inverse: true,
        axisLabel: {
          show: idx === 0,
          fontSize: 10,
          color: '#475569',
          width: 130,
          overflow: 'break',
          interval: 0
        },
        splitArea: { show: true },
        axisTick: { show: false },
        axisLine: { show: false }
      });

      const matrixData = matrices[p.key as keyof typeof matrices] as any[][];
      const plotData: Array<[number, number, number, number]> = [];

      if (matrixData && Array.isArray(matrixData)) {
          matrixData.forEach((row, yIdx) => {
            if (Array.isArray(row)) {
                row.forEach((cell, xIdx) => {
                  if (Array.isArray(cell) && cell.length >= 2) {
                    plotData.push([xIdx, yIdx, cell[0], cell[1]]);
                  }
                });
            }
          });
      }

      series.push({
        name: p.title,
        type: 'heatmap',
        xAxisIndex: idx,
        yAxisIndex: idx,
        data: plotData,
        label: {
          show: true,
          fontSize: 9,
          color: '#1e293b',
          formatter: (params: { value: any }) => {
            const pr = params.value as [number, number, number, number];
            return pr[2] > 0 ? `${Math.round(pr[2])}%` : '';
          },
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1,
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' },
        },
      });
    });

    return {
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b' },
        formatter: (params: { value: any }) => {
          const p = params.value as [number, number, number, number];
          const symptomIdx = p[1];
          const bandIdx = p[0];
          const symptom = labels[symptomIdx];
          const band = bands[bandIdx];

          let res = `<div style="font-weight:bold;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">${symptom} <span style="font-weight:normal;color:#64748b;">(${band})</span></div>`;

          pathogens.forEach(pa => {
            const m = matrices[pa.key as keyof typeof matrices] as any[][];
            const cell = (m && m[symptomIdx]) ? m[symptomIdx][bandIdx] : [0, 0];
            const prevalence = cell[0];
            const count = cell[1];

            const color = pa.key === 'covid' ? '#0f766e' : (pa.key === 'gripe' ? '#1d4ed8' : '#b45309');
            const bullet = `<span style="display:inline-block;margin-right:8px;border-radius:2px;width:10px;height:10px;background-color:${color};"></span>`;

            res += `<div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:2px;">
                        <span>${bullet} ${pa.title}</span>
                        <span><b style="font-size:12px;">${prevalence}%</b> <span style="color:#64748b;font-size:10px;">(${count} casos)</span></span>
                    </div>`;
          });
          return res;
        }
      },
      visualMap: {
        min: 0,
        max: globalMax,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '2%',
        inRange: { color: COLORS.HEATMAP },
        precision: 0,
        text: ['+Freq', '-Freq'],
        textStyle: { fontSize: 10, color: '#64748b' },
        itemWidth: 15,
        itemHeight: 150
      },
      title: titles,
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series: series
    };
  }, [labels, bands, matrices]);

  const { chartRef } = useEcharts(option, [signature]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }}>
      <div ref={chartRef} className="echart-host" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default SymptomsSignatureGrid;
