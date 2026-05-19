import React, { useState } from 'react';
import { COLORS } from '../../constants';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import * as Epi from '../../types/epi';

interface TrendChartProps {
  history: Epi.EpiWeekData[];
  forecast: Epi.ForecastEntry[];
  thresholds?: { medium: number; high: number; very_high: number };
  composition?: Array<{ epi_week: string; virus: string; count: number }>;
  baseCumulative?: number;
  seriesMode: string;
  weeksWindow?: string;
  showForecast?: boolean;
}

const VIRUS_COLORS: Record<string, string> = {
  'COVID-19': '#0f766e',
  Influenza: '#1d4ed8',
  VSR: '#b45309',
  'Outros Vírus': '#7c3aed',
  'Outro Agente': '#4b5563',
  'Não Especificada': '#94a3b8',
  'Em Investigação': '#cbd5e1',
};

const TrendChart: React.FC<TrendChartProps> = ({
  history,
  forecast,
  thresholds,
  composition,
  baseCumulative = 0,
  seriesMode,
  weeksWindow = '0',
  showForecast = false,
}) => {
  const [internalMode] = useState('weekly');
  const theme = useThemeMode();

  const mode = seriesMode || internalMode;

  const getOption = () => {
    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const cumulative = (values: number[], initial = 0) => {
      let sum = initial;
      return values.map((v) => {
        sum += Number(v || 0);
        return sum;
      });
    };

    const allWeeks = [...history.map((d) => d.epi_week), ...(showForecast ? forecast.map((d) => d.epi_week) : [])];
    const windowLimit = weeksWindow === '0' ? 0 : Number.parseInt(weeksWindow, 10);
    const totalWeeks = allWeeks.length;
    const windowStart = windowLimit > 0 ? Math.max(0, totalWeeks - windowLimit) : 0;
    const windowEnd = totalWeeks > 0 ? totalWeeks - 1 : 0;
    const dataZoom =
      windowLimit > 0
        ? [{ type: 'inside', startValue: windowStart, endValue: windowEnd, zoomLock: true }]
        : [{ type: 'inside', start: 0, end: 100, zoomLock: true }];

    const histValues =
      mode === 'cumulative' ? cumulative(history.map((d) => d.total), baseCumulative) : history.map((d) => d.total);
    const histLast = histValues.at(-1) ?? 0;

    if (mode === 'composition' && composition) {
      const viruses = Array.from(new Set(composition.map((c) => c.virus))).filter(Boolean);
      const series = viruses.map((virus) => ({
        name: virus,
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        symbol: 'none',
        emphasis: { focus: 'series' },
        itemStyle: { color: VIRUS_COLORS[virus] || COLORS.SECONDARY },
        data: allWeeks.map((week, i) => {
          if (i < history.length) {
            const found = composition.find((c) => c.epi_week === week && c.virus === virus);
            return found ? found.count : 0;
          }
          const weekTotal = forecast[i - history.length]?.predicted_cases || 0;
          return weekTotal / Math.max(viruses.length, 1);
        }),
      }));

      return {
        animation: true,
        animationDuration: 300,
        animationDurationUpdate: 700,
        animationEasing: 'cubicOut',
        animationEasingUpdate: 'cubicOut',
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: viruses, bottom: 0, icon: 'circle', textStyle: { color: textColor } },
        grid: { left: '30px', right: '4%', bottom: '60px', top: '25px', containLabel: true },
        dataZoom,
        graphic: [{ type: 'text', left: 'center', bottom: 8, style: { text: '⚠ Semanas sem notificações são omitidas', fontSize: 10, fill: textColor } }],
        xAxis: [{ type: 'category', boundaryGap: false, data: allWeeks, axisLine: { show: true, lineStyle: { color: axisColor } }, axisLabel: { color: textColor, rotate: weeksWindow === '0' ? 0 : 45, margin: 14 } }],
        yAxis: [{ type: 'value', name: 'Casos', axisLabel: { color: textColor }, splitLine: { lineStyle: { color: axisColor, type: 'dashed' } } }],
        series,
      };
    }

    if (mode === 'cumulative') {
      const cumulativeData = cumulative(histValues, 0);
      const forecastData = cumulative(forecast.map((f) => f.predicted_cases), histLast);

      return {
        animation: true,
        animationDuration: 300,
        animationDurationUpdate: 700,
        animationEasing: 'cubicOut',
        animationEasingUpdate: 'cubicOut',
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        grid: { left: '40px', right: '4%', bottom: '60px', top: '25px', containLabel: true },
        dataZoom,
        graphic: [{ type: 'text', left: 'center', bottom: 8, style: { text: '⚠ Semanas sem notificações são omitidas', fontSize: 10, fill: textColor } }],
        xAxis: [{ type: 'category', boundaryGap: false, data: allWeeks, axisLine: { show: true, lineStyle: { color: axisColor } }, axisLabel: { color: textColor, rotate: weeksWindow === '0' ? 0 : 45, margin: 14 } }],
        yAxis: [{ type: 'value', name: 'Total acumulado', axisLabel: { color: textColor }, splitLine: { lineStyle: { color: axisColor, type: 'dashed' } } }],
        series: [
          {
            name: 'Histórico',
            type: 'line',
            data: [...cumulativeData, ...forecastData],
            itemStyle: { color: COLORS.PRIMARY },
            areaStyle: { color: 'rgba(15,118,110,0.1)' },
            smooth: true,
            symbol: 'none',
            universalTransition: true,
          },
        ],
      };
    }

    const historyData = showForecast ? [...histValues, ...forecast.map(() => null)] : histValues;

    return {
      animation: true,
      animationDuration: 300,
      animationDurationUpdate: 700,
      animationEasing: 'cubicOut',
      animationEasingUpdate: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        confine: true,
        formatter: (params: Array<{ name?: string; seriesName?: string; value?: number }>) => {
          const week = params[0]?.name ?? '';
          const total = params.find((p) => p.seriesName === 'Histórico')?.value ?? 0;
          const isForecast = params.some((p) => p.seriesName === 'Previsão');
          return `Semana ${week}<br/>${isForecast ? 'Previsão' : 'Notificações'}: <b>${Math.round(total).toLocaleString('pt-BR')}</b>`;
        },
      },
      grid: { left: '3%', right: '3%', bottom: '15%', top: '25px', containLabel: true },
      dataZoom,
      graphic: [{ type: 'text', left: 'center', bottom: 8, style: { text: '⚠ Semanas sem notificações são omitidas', fontSize: 10, fill: textColor } }],
      xAxis: [{ type: 'category', data: allWeeks, axisPointer: { type: 'shadow' }, axisLine: { show: true, lineStyle: { color: axisColor } }, axisLabel: { color: textColor, rotate: weeksWindow === '0' ? 0 : 45, margin: 14 } }],
      yAxis: [{ type: 'value', name: 'Volume', min: 0, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: axisColor, type: 'dashed' } } }],
      series: [
        {
          name: 'Histórico',
          type: 'bar',
          data: historyData,
          itemStyle: { color: COLORS.PRIMARY },
          barMaxWidth: 20,
          universalTransition: true,
        },
        ...(showForecast
          ? [
              {
                name: 'Previsão',
                type: 'line',
                data: [...Array(history.length).fill(null), ...forecast.map((f) => f.predicted_cases)],
                itemStyle: { color: COLORS.DANGER },
                lineStyle: { width: 2.5, type: 'dashed' },
                symbol: 'none',
                universalTransition: true,
              },
            ]
          : []),
      ],
    };
  };

  const { chartRef } = useEcharts(getOption(), [history, forecast, thresholds, composition, baseCumulative, mode, weeksWindow, theme, showForecast]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%' }} />;
};

export default TrendChart;
