import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface DrugSamples {
  drug: string;
  samples: number[];
  count: number;
  specifications?: string[];
}

interface TherapeuticKdeChartProps {
  data: DrugSamples[] | null;
  domain: [number, number];
  unit: string;
  referenceLine?: number;
  referenceLabel?: string;
  xLabel: string;
}

function kde(values: number[], thresholds: number[], bandwidth: number): number[] {
  const n = values.length;
  if (n === 0) return thresholds.map(() => 0);
  const h = bandwidth;
  const invN = 1 / n;
  const invSqrt2PI = 1 / Math.sqrt(2 * Math.PI);
  return thresholds.map((x) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const u = (x - values[i]) / h;
      sum += Math.exp(-0.5 * u * u);
    }
    return (sum * invN * invSqrt2PI) / h;
  });
}

const DRUG_PALETTE = ['#0f766e', '#6d28d9', '#b45309', '#be123c', '#64748b'];

const TherapeuticKdeChart: React.FC<TherapeuticKdeChartProps> = ({
  data,
  domain,
  unit,
  referenceLine,
  referenceLabel,
  xLabel,
}) => {
  const theme = useThemeMode();

  const seriesData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const [dMin, dMax] = domain;
    const numBins = 80;
    const thresholds = Array.from(
      { length: numBins + 1 },
      (_, i) => dMin + ((dMax - dMin) * i) / numBins,
    );
    return data.map((d, i) => {
      const sorted = [...d.samples].sort((a, b) => a - b);
      const stddev =
        sorted.length > 2
          ? Math.sqrt(
              sorted.reduce(
                (s, v) => s + (v - sorted.reduce((a, b) => a + b, 0) / sorted.length) ** 2,
                0,
              ) /
                (sorted.length - 1),
            )
          : domain[1] / 4;
      const bandwidth = Math.max(0.5, 0.9 * stddev * sorted.length ** -0.2);
      const density = kde(d.samples, thresholds, bandwidth);
      const maxDensity = Math.max(...density, 1e-10);
      const normDensity = density.map((v) => v / maxDensity);
      return {
        name: d.drug,
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        data: normDensity,
        lineStyle: { width: 2.5, color: DRUG_PALETTE[i % DRUG_PALETTE.length] },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: `${DRUG_PALETTE[i % DRUG_PALETTE.length]}00` },
              { offset: 0.5, color: `${DRUG_PALETTE[i % DRUG_PALETTE.length]}22` },
              { offset: 1, color: `${DRUG_PALETTE[i % DRUG_PALETTE.length]}00` },
            ],
          } as unknown as Record<string, unknown>,
        },
        emphasis: { focus: 'series' },
      };
    });
  }, [data, domain]);

  const getOption = () => {
    if (!data || data.length === 0 || seriesData.length === 0) {
      return {
        title: {
          text: 'Sem dados',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const xAxisData = Array.from({ length: 81 }, (_, i) => {
      const [dMin, dMax] = domain;
      return +(dMin + ((dMax - dMin) * i) / 80).toFixed(unit === 'anos' ? 1 : 0);
    });

    const markLines: Array<{
      xAxis: number;
      label: {
        formatter: string;
        color: string;
        fontWeight: number;
        fontSize: number;
        position: 'insideEndTop';
      };
      lineStyle: { color: string; width: number; type: 'dashed' };
      silent: true;
    }> = [];
    if (referenceLine != null) {
      const refVal = referenceLine;
      const refIndex = xAxisData.findIndex((v) => v >= refVal);
      if (refIndex !== -1) {
        markLines.push({
          xAxis: refIndex,
          label: {
            formatter: referenceLabel ?? `meta ${refVal}${unit}`,
            color: '#dc2626',
            fontWeight: 700,
            fontSize: 10,
            position: 'insideEndTop' as const,
          },
          lineStyle: { color: '#dc2626', width: 1.5, type: 'dashed' as const },
          silent: true,
        });
      }
    }

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (
          params: Array<{
            seriesName: string;
            dataIndex: number;
            value: number;
            marker: string;
          }>,
        ) => {
          if (params.length === 0) return '';
          const idx = params[0].dataIndex;
          const xVal = xAxisData[idx];
          let html = `<b>${xVal}${unit}</b><br/>`;
          params.sort((a, b) => b.value - a.value);
          for (const p of params) {
            const record = data.find((d) => d.drug === p.seriesName);
            const cnt = record?.count ?? 0;
            const med = record ? [...record.samples].sort((a, b) => a - b) : [];
            const median = med.length > 0 ? med[Math.floor(med.length / 2)] : 0;
            html += `${p.marker} <b>${p.seriesName}</b> (n=${cnt}, mediana=${median.toFixed(1)}${unit})<br/>`;
            if (record?.specifications && record.specifications.length > 0) {
              html += `<div style="font-size: 10px; color: #cbd5e1; padding-left: 18px; max-width: 280px; white-space: normal;">• ${record.specifications.join(', ')}</div>`;
            }
          }
          return html;
        },
      },
      legend: {
        data: data.map((d) => d.drug),
        bottom: 0,
        textStyle: { color: textColor, fontSize: 11 },
        selectedMode: true,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        name: xLabel,
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: string) => `${v}${unit}`,
        },
        axisLine: { lineStyle: { color: axisColor } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        show: true,
        axisLabel: {
          color: textColor,
          fontSize: 9,
          formatter: (v: number) => (v >= 0.01 ? `${(v * 100).toFixed(0)}%` : ''),
        },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
        name: 'Densidade relativa',
        nameTextStyle: { color: textColor, fontSize: 9 },
      },
      series: seriesData.map((s) => ({
        ...s,
        markLine: markLines.length > 0 ? { silent: true, data: markLines } : undefined,
      })),
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, domain, referenceLine, theme]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%', minHeight: '260px' }} />;
};

export default TherapeuticKdeChart;
