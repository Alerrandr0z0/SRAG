import React, { useEffect, useMemo, useState } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import type { HospitalizationDurationData } from '../../types/epi';

interface HospitalizationHistogramProps {
  data: HospitalizationDurationData | null;
}

const MAX_DAY_CAP = 45;
const MIN_BIN_COUNT = 1;

const formatDays = (value: number) => `${value.toFixed(1)}d`;

const HospitalizationHistogram: React.FC<HospitalizationHistogramProps> = ({ data }) => {
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
    if (!data) return {};
    if (data.cure_count === 0 && data.death_count === 0) {
      return {
        title: {
          text: 'Sem dados de internação para os filtros atuais',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 13, fontWeight: 500 },
        },
      };
    }

    const allValues = [...data.cure, ...data.death];
    const observedMax = allValues.length
      ? allValues.reduce((m, v) => (v > m ? v : m), Number.NEGATIVE_INFINITY)
      : 0;
    const maxDay = Math.min(MAX_DAY_CAP, Math.max(MIN_BIN_COUNT, Math.ceil(observedMax)));
    const bins = Array.from({ length: maxDay + 1 }, (_, i) => String(i));

    const buildBins = (values: number[]) =>
      bins.map((dayStr) => {
        const day = Number(dayStr);
        return [dayStr, values.filter((value) => Math.floor(value) === day).length];
      });

    const cureCounts = buildBins(data.cure);
    const deathCounts = buildBins(data.death);

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const hasCure = data.cure_count > 0;
    const hasDeath = data.death_count > 0;

    const pattern =
      hasCure && hasDeath && data.median_death > 0 && data.median_death < data.median_cure * 0.5
        ? `Óbito precoce vs. cura tardia — mediana ${formatDays(data.median_death)}`
        : 'Distribuições parcialmente sobrepostas';

    const series: Array<Record<string, unknown>> = [];
    if (hasCure) {
      series.push({
        name: 'Cura',
        type: 'bar',
        data: cureCounts,
        barGap: '-100%',
        barCategoryGap: '20%',
        itemStyle: {
          color: 'rgba(15, 118, 110, 0.65)',
          borderRadius: [3, 3, 0, 0],
        },
        emphasis: { focus: 'series' },
      });
    }
    if (hasDeath) {
      series.push({
        name: 'Óbito',
        type: 'bar',
        data: deathCounts,
        itemStyle: {
          color: 'rgba(220, 38, 38, 0.6)',
          borderRadius: [3, 3, 0, 0],
        },
        emphasis: { focus: 'series' },
      });
    }

    return {
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'cross', crossStyle: { color: textColor } },
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        borderColor: axisColor,
        textStyle: { color: isDark ? '#f8fafc' : '#1e293b' },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params)
            ? (params as Array<{
                axisValueLabel: string;
                seriesName: string;
                value: [string, number];
              }>)
            : [];
          if (!arr.length) return '';
          const day = arr[0].axisValueLabel;
          const rows = arr
            .filter((p) => p.seriesName === 'Cura' || p.seriesName === 'Óbito')
            .map((p) => `${p.seriesName}: <b>${p.value[1]}</b> casos`);
          if (rows.length === 0) return `Dia ${day}d`;
          return [`<b>Dia ${day}d</b>`, ...rows].join('<br/>');
        },
      },
      legend: {
        bottom: 0,
        left: 'center',
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 10,
        textStyle: { color: textColor, fontSize: isNarrow ? 9.5 : 11 },
        data: [
          ...(hasCure ? ['Cura'] : []),
          ...(hasDeath ? ['Óbito'] : []),
        ],
      },
      grid: {
        top: 30,
        left: isNarrow ? 15 : 60,
        right: isNarrow ? 15 : 35,
        bottom: 60,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: bins,
        name: isNarrow ? 'Dias' : 'Dias de internação até o desfecho',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: textColor, fontSize: isNarrow ? 10 : 11 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          hideOverlap: false,
          interval: (idx: number, _val: string) => idx % 5 === 0 || idx === maxDay,
          formatter: (val: string) => `${val}d`,
        },
        axisLine: { lineStyle: { color: axisColor } },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: isNarrow ? 'Casos' : 'Frequência de pacientes (Casos)',
          nameLocation: 'middle',
          nameGap: 40,
          nameTextStyle: { color: textColor, fontSize: isNarrow ? 10 : 11 },
          minInterval: 1,
          axisLabel: {
            color: textColor,
            fontSize: 10,
            hideOverlap: true,
            formatter: (val: number) => (Math.floor(val) === val ? val.toLocaleString('pt-BR') : ''),
          },
          axisLine: { show: true, lineStyle: { color: axisColor } },
          splitLine: { lineStyle: { type: 'dashed', color: axisColor } },
        },
      ],
      series,
      animation: false,
      aria: { enabled: true, description: pattern },
    };
  }, [data, theme, isNarrow]);

  const { chartRef } = useEcharts(option, [data, theme, isNarrow]);

  return <div ref={chartRef} className="echart-host" style={{ minHeight: 340 }} />;
};

export default HospitalizationHistogram;
