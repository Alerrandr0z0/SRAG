import React, { useMemo, useState } from 'react';
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

function fillMissingWeeks(data: Epi.EpiWeekData[]): Epi.EpiWeekData[] {
  if (data.length < 2) return data;
  const m = (s: string) => {
    const p = s.split('-');
    return { year: Number.parseInt(p[0], 10), week: Number.parseInt(p[1], 10) };
  };
  const first = m(data[0].epi_week);
  const last = m(data[data.length - 1].epi_week);
  const entries = new Map(data.map((d) => [d.epi_week, d.total]));
  const result: Epi.EpiWeekData[] = [];
  const maxWeeks = (y: number) => (y === last.year ? last.week : 53);
  const minWeeks = (y: number) => (y === first.year ? first.week : 1);

  for (let y = first.year; y <= last.year; y++) {
    for (let w = minWeeks(y); w <= maxWeeks(y); w++) {
      const key = `${y}-${String(w).padStart(2, '0')}`;
      result.push({ epi_week: key, total: entries.get(key) ?? 0 });
    }
  }
  return result;
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
  thresholds: defaultThresholds,
  composition,
  baseCumulative = 0,
  seriesMode,
  weeksWindow = '0',
  showForecast = false,
}) => {
  const [internalMode] = useState('weekly');
  const filledHistory = useMemo(() => fillMissingWeeks(history), [history]);
  const theme = useThemeMode();

  const [thresholds, setThresholds] = useState<
    { medium: number; high: number; very_high: number } | undefined
  >(defaultThresholds);
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

    const allWeeks = [
      ...filledHistory.map((d) => d.epi_week),
      ...(showForecast ? forecast.map((d) => d.epi_week) : []),
    ];
    const windowLimit = weeksWindow === '0' ? 0 : Number.parseInt(weeksWindow, 10);
    const totalWeeks = allWeeks.length;
    const windowStart = windowLimit > 0 ? Math.max(0, totalWeeks - windowLimit) : 0;
    const windowEnd = totalWeeks > 0 ? totalWeeks - 1 : 0;
    const dataZoom =
      windowLimit > 0
        ? [{ type: 'inside', startValue: windowStart, endValue: windowEnd, zoomLock: true }]
        : [{ type: 'inside', start: 0, end: 100, zoomLock: true }];

    const yearGroups: Array<{ year: number; start: string; end: string }> = [];
    for (const w of allWeeks) {
      const y = Number.parseInt(w.split('-')[0], 10);
      if (!yearGroups.length || yearGroups[yearGroups.length - 1].year !== y) {
        yearGroups.push({ year: y, start: w, end: w });
      } else {
        yearGroups[yearGroups.length - 1].end = w;
      }
    }
    const yearMarkAreaData = yearGroups.map((g, i) => [
      { xAxis: g.start, itemStyle: { color: i % 2 === 0 ? 'rgba(15,118,110,0.18)' : 'transparent' } },
      { xAxis: g.end },
    ]);
    const yearMarkLineData = yearGroups.slice(1).map((g) => ({
      xAxis: g.start,
      label: {
        formatter: String(g.year),
        position: 'end' as const,
        fontSize: 10,
        fontWeight: 'bold' as const,
        color: textColor,
        backgroundColor: isDark ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.85)',
        padding: [1, 4] as [number, number],
      },
      lineStyle: { color: axisColor, type: 'dashed' as const, width: 1 },
      silent: true,
    }));
    const yearMark = {
      markArea: { silent: true, data: yearMarkAreaData as any },
      markLine: {
        silent: true, symbol: 'none', data: yearMarkLineData,
      },
    };

    const histValues =
      mode === 'cumulative'
        ? cumulative(
            filledHistory.map((d) => d.total),
            baseCumulative,
          )
        : filledHistory.map((d) => d.total);
    const histLast = histValues.at(-1) ?? 0;

    const thresholdMarkLine = thresholds
      ? {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed' as const, width: 1.5 },
          label: {
            formatter: (p: { name?: string; value?: number }) =>
              `${p.name || ''} (${Math.round(p.value || 0)})`,
            position: 'insideEndTop' as const,
            fontSize: 9,
            fontWeight: 'bold' as const,
            backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.8)',
            padding: [2, 4],
          },
          data: [
            {
              yAxis: thresholds.medium,
              name: 'Médio',
              lineStyle: { color: '#fbbf24' as string },
            },
            {
              yAxis: thresholds.high,
              name: 'Alto',
              lineStyle: { color: '#f97316' as string },
            },
            {
              yAxis: thresholds.very_high,
              name: 'Muito Alto',
              lineStyle: { color: '#ef4444' as string },
            },
          ],
        }
      : undefined;

    function historyData() {
      return showForecast ? [...histValues, ...forecast.map(() => null)] : histValues;
    }

    const baseSeries = {
      name: 'Histórico',
      type: 'line' as const,
      data: historyData(),
      itemStyle: { color: COLORS.PRIMARY },
      areaStyle: { color: 'rgba(15,118,110,0.12)' },
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 2 },
      markArea: yearMark.markArea,
      markLine: thresholdMarkLine
        ? { silent: true, symbol: 'none', data: [...yearMarkLineData, ...thresholdMarkLine.data] }
        : yearMark.markLine,
    };

    if (mode === 'composition' && composition) {
      const viruses = Array.from(new Set(composition.map((c) => c.virus))).filter(Boolean);
      const series = viruses.map((virus, idx) => ({
        name: virus,
        type: 'line' as const,
        stack: 'Total',
        areaStyle: {},
        symbol: 'none',
        emphasis: { focus: 'series' },
        itemStyle: { color: VIRUS_COLORS[virus] || COLORS.SECONDARY },
        data: allWeeks.map((week, i) => {
          if (i < filledHistory.length) {
            const found = composition.find((c) => c.epi_week === week && c.virus === virus);
            return found ? found.count : 0;
          }
          const weekTotal = forecast[i - filledHistory.length]?.predicted_cases || 0;
          return weekTotal / Math.max(viruses.length, 1);
        }),
        ...(idx === 0 ? yearMark : {}),
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
        xAxis: [
          {
            type: 'category',
            boundaryGap: false,
            data: allWeeks,
            axisLine: { show: true, lineStyle: { color: axisColor } },
            axisLabel: { color: textColor, rotate: weeksWindow === '0' ? 0 : 45, margin: 14, formatter: (v: string) => `S${v.split('-')[1]}` },
          },
        ],
        yAxis: [
          {
            type: 'value',
            name: 'Casos',
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
          },
        ],
        series,
      };
    }

    if (mode === 'cumulative') {
      const cumulativeData = cumulative(histValues, 0);
      const forecastData = cumulative(
        forecast.map((f) => f.predicted_cases),
        histLast,
      );

      return {
        animation: true,
        animationDuration: 300,
        animationDurationUpdate: 700,
        animationEasing: 'cubicOut',
        animationEasingUpdate: 'cubicOut',
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        grid: { left: '40px', right: '4%', bottom: '40px', top: '25px', containLabel: true },
        dataZoom,
        xAxis: [
          {
            type: 'category',
            boundaryGap: false,
            data: allWeeks,
            axisLine: { show: true, lineStyle: { color: axisColor } },
            axisLabel: { color: textColor, rotate: weeksWindow === '0' ? 0 : 45, margin: 14, formatter: (v: string) => `S${v.split('-')[1]}` },
          },
        ],
        yAxis: [
          {
            type: 'value',
            name: 'Total acumulado',
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
          },
        ],
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
            ...yearMark,
            markLine: undefined,
            markArea: yearMark.markArea,
          },
        ],
      };
    }

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
          return `Semana ${week}<br/>Notificações: <b>${Math.round(total).toLocaleString('pt-BR')}</b>`;
        },
      },
      grid: { left: '3%', right: '3%', bottom: '15%', top: '25px', containLabel: true },
      dataZoom,
      xAxis: [
        {
          type: 'category',
          data: allWeeks,
          axisPointer: { type: 'shadow' },
          axisLine: { show: true, lineStyle: { color: axisColor } },
          axisLabel: { color: textColor, rotate: 35, margin: 14, fontSize: 10, formatter: (v: string) => `S${v.split('-')[1]}` },
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
      ],
      series: [baseSeries],
    };
  };

  const { chartRef } = useEcharts(getOption(), [
    filledHistory,
    forecast,
    thresholds,
    composition,
    baseCumulative,
    mode,
    weeksWindow,
    theme,
    showForecast,
  ]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={chartRef} key={mode} style={{ height: '100%', width: '100%' }} />
      {thresholds && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: 11,
            flexWrap: 'wrap',
            background: 'var(--bg-panel)',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          {[
            { key: 'medium', label: 'Médio', color: '#fbbf24' },
            { key: 'high', label: 'Alto', color: '#f97316' },
            { key: 'very_high', label: 'Muito Alto', color: '#ef4444' },
          ].map(({ key, label, color }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color, fontWeight: 700, fontSize: 14, lineHeight: '10px' }}>━</span>
              <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
              <input
                type="number"
                value={Math.round(thresholds[key as keyof typeof thresholds])}
                onChange={(e) => {
                  const val = Number.parseFloat(e.target.value);
                  if (Number.isNaN(val) || val < 0) return;
                  setThresholds({ ...thresholds, [key]: val });
                }}
                inputMode="numeric"
                style={{
                  width: 60,
                  padding: '1px 4px',
                  fontSize: 11,
                  border: `1px solid ${color}`,
                  borderRadius: 4,
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                }}
                aria-label={`Limite ${label}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrendChart;
