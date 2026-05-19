import React, { useState } from 'react';
import { COLORS } from '../../constants';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface EpidemicCurveChartProps {
  virusTrends: Array<{ epi_week: string; virus: string; count: number }>;
  positivityTrend: Array<{
    epi_week: string;
    tested: number;
    positive: number;
    positivity_rate: number;
  }>;
  forcedMode?: Mode;
  forcedWeeks?: string;
}

type Mode = 'composicao' | 'positividade' | 'acumulado';

const AGENT_COLORS: Record<string, string> = {
  VSR: '#0f766e',
  Influenza: '#1d4ed8',
  'COVID-19': '#b91c1c',
  'Outros Vírus': '#7c3aed',
  'Outro Agente': '#475569',
  'Não Especificada': '#94a3b8',
};

const EpidemicCurveChart: React.FC<EpidemicCurveChartProps> = ({
  virusTrends,
  positivityTrend,
  forcedMode,
  forcedWeeks,
}) => {
  const [internalMode] = useState<Mode>('positividade');
  const [internalWeeks] = useState('0'); // 0 = Tudo
  const theme = useThemeMode();

  const mode = forcedMode ?? internalMode;
  const weeksWindow = forcedWeeks ?? internalWeeks;

  const getOption = () => {
    // 1. Get full sorted weeks
    let allWeeks = Array.from(new Set(virusTrends.map((d) => d.epi_week))).sort();

    // 2. Filter by window if applicable
    if (weeksWindow !== '0') {
      const limit = parseInt(weeksWindow, 10);
      allWeeks = allWeeks.slice(-limit);
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    if (mode === 'composicao') {
      const agents = Array.from(new Set(virusTrends.map((d) => d.virus))).filter(Boolean);

      const series = agents.map((agent) => {
        const data = allWeeks.map((week) => {
          const found = virusTrends.find((d) => d.epi_week === week && d.virus === agent);
          return found ? found.count : 0;
        });
        return {
          name: agent,
          type: 'line',
          stack: 'Total',
          areaStyle: {},
          emphasis: { focus: 'series' },
          data,
          itemStyle: { color: AGENT_COLORS[agent] || COLORS.SECONDARY },
          symbol: 'none',
        };
      });

      return {
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: agents, bottom: 0, icon: 'circle', textStyle: { color: textColor } },
        grid: { left: '30px', right: '4%', bottom: '60px', top: '25px', containLabel: true },
        xAxis: [
          {
            type: 'category',
            boundaryGap: false,
            data: allWeeks,
            axisLine: { show: true, lineStyle: { color: axisColor } },
            axisLabel: { color: textColor },
          },
        ],
        yAxis: [
          {
            type: 'value',
            name: 'Casos Positivos',
            axisLine: { show: false },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
          },
        ],
        series,
      };
    } else if (mode === 'acumulado') {
      // Calculate cumulative sum of totals per week
      const weeklyTotals = allWeeks.map((week) => {
        return virusTrends.filter((d) => d.epi_week === week).reduce((sum, d) => sum + d.count, 0);
      });

      let currentSum = 0;
      const cumulativeData = weeklyTotals.map((val) => {
        currentSum += val;
        return currentSum;
      });

      return {
        tooltip: { trigger: 'axis' },
        grid: { left: '40px', right: '4%', bottom: '60px', top: '25px', containLabel: true },
        xAxis: [
          {
            type: 'category',
            boundaryGap: false,
            data: allWeeks,
            axisLine: { show: true, lineStyle: { color: axisColor } },
            axisLabel: { color: textColor },
          },
        ],
        yAxis: [
          {
            type: 'value',
            name: 'Total Acumulado',
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
          },
        ],
        series: [
          {
            name: 'Acumulado',
            type: 'line',
            data: cumulativeData,
            itemStyle: { color: COLORS.PRIMARY },
            areaStyle: { color: 'rgba(15,118,110,0.1)' },
            smooth: true,
          },
        ],
      };
    } else {
      const filteredPositivity = positivityTrend.filter((d) => allWeeks.includes(d.epi_week));
      const weeks = filteredPositivity.map((d) => d.epi_week);
      const tested = filteredPositivity.map((d) => d.tested);
      const positive = filteredPositivity.map((d) => d.positive);
      const rates = filteredPositivity.map((d) => d.positivity_rate);

      return {
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: {
          data: ['Exames', 'Positivos', 'Taxa (%)'],
          bottom: 0,
          textStyle: { color: textColor },
        },
        grid: { left: '3%', right: '3%', bottom: '15%', top: '25px', containLabel: true },
        xAxis: [
          {
            type: 'category',
            data: weeks,
            axisPointer: { type: 'shadow' },
            axisLine: { show: true, lineStyle: { color: axisColor } },
            axisLabel: { color: textColor },
          },
        ],
        yAxis: [
          {
            type: 'value',
            name: 'Volume',
            min: 0,
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
          },
          {
            type: 'value',
            name: 'Taxa (%)',
            min: 0,
            max: 100,
            position: 'right',
            axisLabel: { formatter: '{value}%', color: textColor },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: 'Exames',
            type: 'bar',
            data: tested,
            itemStyle: { color: isDark ? '#334155' : '#e2e8f0' },
            barGap: '-100%',
            barCategoryGap: '30%',
          },
          { name: 'Positivos', type: 'bar', data: positive, itemStyle: { color: COLORS.PRIMARY } },
          {
            name: 'Taxa (%)',
            type: 'line',
            yAxisIndex: 1,
            data: rates,
            itemStyle: { color: '#ef4444' },
            lineWidth: 3,
            symbolSize: 6,
          },
        ],
      };
    }
  };

  const { chartRef } = useEcharts(getOption(), [
    virusTrends,
    positivityTrend,
    mode,
    weeksWindow,
    theme,
  ]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%' }} />;
};

export default EpidemicCurveChart;
