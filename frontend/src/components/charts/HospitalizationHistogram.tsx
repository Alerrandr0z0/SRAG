import React, { useMemo } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  TitleComponent,
  MarkLineComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import type { HospitalizationDurationData } from '../../types/epi';

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  TitleComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

interface HospitalizationHistogramProps {
  data: HospitalizationDurationData | null;
}

const MAX_DAY = 90;
const MIN_BIN_COUNT = 1;

const formatDays = (value: number) => `${value.toFixed(1)}d`;

const HospitalizationHistogram: React.FC<HospitalizationHistogramProps> = ({ data }) => {
  const theme = useThemeMode();

  const option = useMemo(() => {
    if (!data) return {};

    const allValues = [...data.cure, ...data.death];
    const observedMax = allValues.length ? Math.max(...allValues) : 0;
    const maxDay = Math.min(MAX_DAY, Math.max(MIN_BIN_COUNT, Math.ceil(observedMax)));
    const bins = Array.from({ length: maxDay + 1 }, (_, i) => i);

    const buildBins = (values: number[]) =>
      bins.map((day) => [day, values.filter((value) => Math.floor(value) === day).length]);

    const cureCounts = buildBins(data.cure);
    const deathCounts = buildBins(data.death);

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const titleColor = isDark ? '#f8fafc' : '#1e293b';
    const gridBg = isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(248, 250, 252, 0.6)';

    const hasCure = data.cure_count > 0;
    const hasDeath = data.death_count > 0;
    const hasKde = data.kde_x.length > 0 && data.kde_cure.length > 0 && data.kde_death.length > 0;

    const pattern =
      hasCure && hasDeath && data.median_death > 0 && data.median_death < data.median_cure * 0.5
        ? `Obito precoce vs. cura tardia - mediana ${formatDays(data.median_death)}`
        : 'Distribuicoes parcialmente sobrepostas';

    const medianLines: Array<{
      xAxis: number;
      lineStyle: { color: string; type: 'dashed'; width: number };
    }> = [];
    if (hasCure && data.median_cure <= maxDay) {
      medianLines.push({
        xAxis: data.median_cure,
        lineStyle: { color: '#0f6e56', type: 'dashed', width: 2 },
      });
    }
    if (hasDeath && data.median_death <= maxDay) {
      medianLines.push({
        xAxis: data.median_death,
        lineStyle: { color: '#a32d2d', type: 'dashed', width: 2 },
      });
    }

    const series: Array<Record<string, unknown>> = [];
    if (hasCure) {
      series.push({
        name: 'Cura',
        type: 'bar',
        data: cureCounts,
        barGap: '-100%',
        barCategoryGap: '30%',
        itemStyle: {
          color: 'rgba(29, 158, 117, .65)',
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: { focus: 'series' },
      });
    }
    if (hasDeath) {
      series.push({
        name: 'Obito',
        type: 'bar',
        data: deathCounts,
        itemStyle: {
          color: 'rgba(226, 75, 74, .55)',
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: { focus: 'series' },
      });
    }
    if (hasKde) {
      const maxKde = Math.max(maxDay, ...data.kde_x);
      series.push({
        name: 'KDE Cura',
        type: 'line',
        data: data.kde_x
          .filter((x) => x <= maxKde)
          .map((x, i) => [x, data.kde_cure[i] ?? 0]),
        smooth: 0.5,
        symbol: 'none',
        lineStyle: { color: '#0f6e56', width: 2.5 },
        z: 3,
        silent: true,
        tooltip: { show: false },
      });
      series.push({
        name: 'KDE Obito',
        type: 'line',
        data: data.kde_x
          .filter((x) => x <= maxKde)
          .map((x, i) => [x, data.kde_death[i] ?? 0]),
        smooth: 0.5,
        symbol: 'none',
        lineStyle: { color: '#a32d2d', width: 2.5 },
        z: 3,
        silent: true,
        tooltip: { show: false },
      });
    }
    if (medianLines.length > 0) {
      series.push({
        name: 'Mediana',
        type: 'line',
        data: bins.map((day) => [day, 0]),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        markLine: {
          symbol: 'none',
          silent: true,
          animation: false,
          label: { distance: 6 },
          data: medianLines,
        },
      });
    }

    return {
      backgroundColor: gridBg,
      title: {
        text: 'Distribuicao do tempo ate o desfecho clinico',
        left: 'center',
        top: 8,
        textStyle: { color: titleColor, fontSize: 13, fontWeight: 500 },
      },
      legend: {
        top: 36,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 10,
        textStyle: { color: textColor, fontSize: 11 },
        data: ['Cura', 'Obito', 'KDE', 'Mediana'],
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: textColor } },
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        borderColor: axisColor,
        textStyle: { color: isDark ? '#f8fafc' : '#1e293b' },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? (params as Array<{ axisValueLabel: string; seriesName: string; value: [number, number] }>) : [];
          if (!arr.length) return '';
          const day = arr[0].axisValueLabel;
          const rows = arr
            .filter((p) => p.seriesName === 'Cura' || p.seriesName === 'Obito')
            .map((p) => `${p.seriesName}: ${p.value[1]} casos`);
          if (rows.length === 0) return `Dia ${day}d`;
          return [`Dia ${day}d`, ...rows].join('<br/>');
        },
      },
      grid: { top: 80, left: 56, right: 56, bottom: 50, containLabel: true },
      graphic: [
        ...(hasCure
          ? [
              {
                type: 'group',
                right: 4,
                top: 70,
                children: [
                  {
                    type: 'rect',
                    shape: { width: 96, height: 28, r: 4 },
                    style: {
                      fill: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.92)',
                      stroke: axisColor,
                      lineWidth: 0.5,
                    },
                  },
                  {
                    type: 'text',
                    left: 6,
                    top: 4,
                    style: {
                      text: `Cura: ${formatDays(data.median_cure)}`,
                      fill: '#0f6e56',
                      font: 'bold 11px sans-serif',
                    },
                  },
                  {
                    type: 'text',
                    left: 6,
                    top: 16,
                    style: {
                      text: `Óbito: ${formatDays(data.median_death)}`,
                      fill: '#a32d2d',
                      font: 'bold 11px sans-serif',
                    },
                  },
                ],
              },
            ]
          : []),
      ],
      xAxis: {
        type: 'category',
        data: bins,
        name: 'Dias de internacao ate desfecho',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: textColor, fontSize: 11 },
        min: 0,
        max: maxDay,
        axisLabel: {
          color: textColor,
          fontSize: 10,
          hideOverlap: true,
          interval: 'auto',
          maxInterval: 0,
          formatter: (val: string | number) => `${val}d`,
        },
        axisLine: { lineStyle: { color: axisColor } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Frequencia de pacientes',
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10, hideOverlap: true },
        axisLine: { lineStyle: { color: axisColor } },
        splitLine: { lineStyle: { type: 'dashed', color: axisColor } },
      },
      series,
      animation: false,
      aria: { enabled: true, description: pattern },
    };
  }, [data, theme]);

  const { chartRef } = useEcharts(option, [data, theme]);

  return (
    <div ref={chartRef} className="echart-host" style={{ minHeight: 320 }} />
  );
};

export default HospitalizationHistogram;
