import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { SymptomSignature } from '../../types/epi';
import { COLORS } from '../../constants';

interface Props {
  signature: SymptomSignature;
}

const SymptomsSignatureGrid: React.FC<Props> = ({ signature }) => {
  const { labels, bands, matrices } = signature;

  const option = useMemo(() => {
    if (!labels || !labels.length || !bands || !bands.length || !matrices) {
        return {
            title: {
                text: 'Dados insuficientes para gerar a assinatura clínica',
                left: 'center',
                top: 'middle',
                textStyle: { color: '#94a3b8', fontSize: 14 }
            }
        };
    }

    const pathogens = [
      { key: 'covid', title: 'COVID-19' },
      { key: 'gripe', title: 'Influenza' },
      { key: 'vsr', title: 'VSR' }
    ];

    // Calculando o máximo global para escala compartilhada baseado na prevalência (%)
    let globalMax = 0;
    Object.values(matrices).forEach(matrix => {
      if (matrix) {
          matrix.forEach(row => {
            row.forEach(cell => {
              const val = cell[0]; // Prevalência
              if (val > globalMax) globalMax = val;
            });
          });
      }
    });
    if (globalMax === 0) globalMax = 100;

    const grids: any[] = [];
    const xAxes: any[] = [];
    const yAxes: any[] = [];
    const series: any[] = [];
    const titles: any[] = [];

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

      const matrixData = matrices[p.key as keyof typeof matrices];
      const plotData: any[] = [];
      
      if (matrixData) {
          matrixData.forEach((row, yIdx) => {
            row.forEach((cell, xIdx) => {
              // plotData: [x, y, prevalence, count]
              plotData.push([xIdx, yIdx, cell[0], cell[1]]);
            });
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
            formatter: (params: any) => params.value[2] > 0 ? `${Math.round(params.value[2])}%` : '' 
        },
        itemStyle: {
            borderColor: '#fff',
            borderWidth: 1
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' }
        }
      });
    });

    return {
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b' },
        formatter: (params: any) => {
          const symptomIdx = params.value[1];
          const bandIdx = params.value[0];
          const symptom = labels[symptomIdx];
          const band = bands[bandIdx];
          
          let res = `<div style="font-weight:bold;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">${symptom} <span style="font-weight:normal;color:#64748b;">(${band})</span></div>`;
          
          pathogens.forEach(p => {
            const m = matrices[p.key as keyof typeof matrices];
            const cell = m ? m[symptomIdx][bandIdx] : [0, 0];
            const prevalence = cell[0];
            const count = cell[1];
            
            const color = p.key === 'covid' ? '#0f766e' : (p.key === 'gripe' ? '#1d4ed8' : '#b45309');
            const bullet = `<span style="display:inline-block;margin-right:8px;border-radius:2px;width:10px;height:10px;background-color:${color};"></span>`;
            
            res += `<div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:2px;">
                        <span>${bullet} ${p.title}</span>
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
  }, [signature]);

  const { chartRef } = useEcharts(option, [signature]);

  return <div ref={chartRef} className="echart-host" style={{ width: '100%', height: '100%', minHeight: '500px' }} />;
};

export default SymptomsSignatureGrid;
