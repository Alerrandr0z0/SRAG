import React, { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../../constants';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import { SymptomSignature } from '../../types/epi';

interface Props {
  signature: SymptomSignature;
  selectedAgent?: string;
}

const SymptomsSignatureGrid: React.FC<Props> = ({ signature, selectedAgent = '' }) => {
  const { labels = [], bands = [], matrices = {} } = signature || {};
  const theme = useThemeMode();

  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 980 : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 980);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const option = useMemo(() => {
    const isDark = theme === 'dark';
    const titleColor = isDark ? '#f8fafc' : '#334155';
    const axisColor = isDark ? '#e2e8f0' : '#64748b';
    const labelColor = isDark ? '#f1f5f9' : '#475569';
    const splitLineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
    const cellBorderColor = isDark ? '#1e293b' : '#fff';
    const tooltipBg = isDark ? 'rgba(30, 41, 59, 0.98)' : 'rgba(255, 255, 255, 0.98)';
    const tooltipBorder = isDark ? '#475569' : '#e2e8f0';
    const tooltipTextColor = isDark ? '#f8fafc' : '#1e293b';

    const hasData =
      Array.isArray(labels) &&
      labels.length > 0 &&
      Array.isArray(bands) &&
      bands.length > 0 &&
      matrices &&
      typeof matrices === 'object' &&
      Object.keys(matrices).length > 0;

    if (!hasData) {
      return {
        title: {
          text: 'Dados laboratoriais insuficientes para gerar a assinatura clínica de sintomas',
          left: 'center',
          top: 'middle',
          textStyle: { color: '#94a3b8', fontSize: 14 },
        },
        series: [],
      };
    }

    const pathogens = [
      { key: 'covid', title: 'COVID-19' },
      { key: 'gripe', title: 'Influenza' },
      { key: 'vsr', title: 'VSR' },
    ].filter((p) => {
      if (selectedAgent === 'COVID-19')
        return p.key === 'covid' && !!matrices[p.key as keyof typeof matrices];
      if (selectedAgent === 'Influenza')
        return p.key === 'gripe' && !!matrices[p.key as keyof typeof matrices];
      return !!matrices[p.key as keyof typeof matrices];
    });

    if (pathogens.length === 0) {
      return {
        title: { text: 'Nenhum patógeno disponível para exibição', left: 'center', top: 'middle' },
        series: [],
      };
    }

    // Calculando o máximo global para escala compartilhada baseado na prevalência (%)
    let globalMax = 0;
    Object.values(matrices).forEach((matrix) => {
      if (matrix && Array.isArray(matrix)) {
        matrix.forEach((row) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
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
      const left = isNarrow ? 26 : 15 + idx * 28;
      const width = isNarrow ? 68 : 24;
      const top = isNarrow ? 8 + idx * 30 : 12;
      const height = isNarrow ? 20 : null;
      const bottom = isNarrow ? null : '18%';

      grids.push({
        left: `${left}%`,
        width: `${width}%`,
        top: isNarrow ? `${top}%` : '12%',
        height: height ? `${height}%` : undefined,
        bottom: bottom || undefined,
        containLabel: false,
      });

      titles.push({
        text: p.title,
        left: isNarrow ? `${left + width / 2}%` : `${left + width / 2}%`,
        textAlign: 'center',
        top: isNarrow ? `${top - 6}%` : '2%',
        textStyle: { fontSize: 13, fontWeight: 'bold', color: titleColor },
      });

      xAxes.push({
        type: 'category',
        data: bands,
        gridIndex: idx,
        axisLabel: { interval: 0, rotate: 35, fontSize: 9, color: axisColor },
        splitArea: { show: true },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: splitLineColor } },
      });

      yAxes.push({
        type: 'category',
        data: labels,
        gridIndex: idx,
        inverse: true,
        axisLabel: {
          show: isNarrow ? true : idx === 0,
          fontSize: 9,
          color: labelColor,
          width: isNarrow ? 90 : 120,
          overflow: 'break',
          interval: 0,
        },
        splitArea: { show: true },
        axisTick: { show: false },
        axisLine: { show: false },
      });

      const matrixData = matrices[p.key as keyof typeof matrices] as [number, number][][];
      const plotData: Array<{
        value: [number, number, number, number];
        label: {
          show: boolean;
          color: string;
        };
      }> = [];

      if (matrixData && Array.isArray(matrixData)) {
        matrixData.forEach((row, yIdx) => {
          if (Array.isArray(row)) {
            row.forEach((cell, xIdx) => {
              if (Array.isArray(cell) && cell.length >= 2) {
                const prevalence = cell[0];
                const count = cell[1];
                // Dynamic cell label text contrast
                const cellTextColor = prevalence > 40 ? '#ffffff' : '#1e293b';
                plotData.push({
                  value: [xIdx, yIdx, prevalence, count],
                  label: {
                    show: true,
                    color: cellTextColor,
                  },
                });
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
          formatter: (params: { value: [number, number, number, number] }) => {
            const pr = params.value;
            return pr[2] > 0 ? `${Math.round(pr[2])}%` : '';
          },
        },
        itemStyle: {
          borderColor: cellBorderColor,
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
        confine: true,
        backgroundColor: tooltipBg,
        borderWidth: 1,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipTextColor },
        formatter: (params: { value: [number, number, number, number] }) => {
          const p = params.value;
          const symptomIdx = p[1];
          const bandIdx = p[0];
          const symptom = labels[symptomIdx];
          const band = bands[bandIdx];

          let res = `<div style="font-weight:bold;margin-bottom:8px;border-bottom:1px solid ${tooltipBorder};padding-bottom:4px;">${symptom} <span style="font-weight:normal;color:${axisColor};">(${band})</span></div>`;

          pathogens.forEach((pa) => {
            const m = matrices[pa.key as keyof typeof matrices] as [number, number][][];
            const cell = m?.[symptomIdx] ? m[symptomIdx][bandIdx] : [0, 0];
            const prevalence = cell[0];
            const count = cell[1];

            const color =
              pa.key === 'covid' ? '#0f766e' : pa.key === 'gripe' ? '#1d4ed8' : '#b45309';
            const bullet = `<span style="display:inline-block;margin-right:8px;border-radius:2px;width:10px;height:10px;background-color:${color};"></span>`;

            res += `<div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:2px;">
                        <span>${bullet} ${pa.title}</span>
                        <span><b style="font-size:12px;">${prevalence}%</b> <span style="color:${axisColor};font-size:10px;">(${count} casos)</span></span>
                    </div>`;
          });
          return res;
        },
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
        textStyle: { fontSize: 10, color: axisColor },
        itemWidth: 15,
        itemHeight: 150,
      },
      title: titles,
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series: series,
    };
  }, [labels, bands, matrices, selectedAgent, isNarrow, theme]);

  const { chartRef } = useEcharts(option, [signature, selectedAgent], { replaceOnUpdate: true });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: isNarrow ? '750px' : '500px',
        position: 'relative',
      }}
    >
      <div ref={chartRef} className="echart-host" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default SymptomsSignatureGrid;
