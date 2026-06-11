import React from 'react';
import { COLORS } from '../../constants';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import { GravityCascadeResponse } from '../../types/epi';

interface GravityCascadeChartProps {
  data: GravityCascadeResponse | null;
  mode: 'volume' | 'rate';
}

const GravityCascadeChart: React.FC<GravityCascadeChartProps> = ({ data, mode }) => {
  const theme = useThemeMode();

  const getOption = () => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: 'Sem dados disponíveis',
          left: 'center',
          top: 'center',
          textStyle: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
      };
    }

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const xAxisData = data.map((d) => d.epi_week);

    if (mode === 'volume') {
      const notified = data.map((d) => d.notified);
      const hospitalized = data.map((d) => d.hospitalized);
      const uti = data.map((d) => d.uti);
      const death = data.map((d) => d.death);

      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
        },
        legend: {
          data: ['Notificados', 'Hospitalizados', 'UTI', 'Óbitos'],
          bottom: 0,
          textStyle: { color: textColor },
        },
        grid: {
          left: '3%',
          right: '3%',
          bottom: '10%',
          top: 35,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xAxisData,
          axisLine: { show: true, lineStyle: { color: axisColor } },
          axisLabel: { color: textColor },
        },
        yAxis: {
          type: 'value',
          name: 'Nº de Pacientes',
          axisLabel: { color: textColor },
          splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
        },
        series: [
          {
            name: 'Notificados',
            type: 'line',
            symbol: 'none',
            smooth: true,
            data: notified,
            itemStyle: { color: '#94a3b8' },
            areaStyle: { color: 'rgba(148,163,184,0.1)' },
          },
          {
            name: 'Hospitalizados',
            type: 'line',
            symbol: 'none',
            smooth: true,
            data: hospitalized,
            itemStyle: { color: COLORS.PRIMARY },
            areaStyle: { color: 'rgba(15,118,110,0.2)' },
          },
          {
            name: 'UTI',
            type: 'line',
            symbol: 'none',
            smooth: true,
            data: uti,
            itemStyle: { color: COLORS.ACCENT },
            areaStyle: { color: 'rgba(180,83,9,0.25)' },
          },
          {
            name: 'Óbitos',
            type: 'line',
            symbol: 'none',
            smooth: true,
            data: death,
            itemStyle: { color: COLORS.DANGER },
            areaStyle: { color: 'rgba(185,28,28,0.3)' },
          },
        ],
      };
    } else {
      // Rates Mode
      // Hospitalization Rate = hospitalized / notified * 100
      // UTI Rate = uti / hospitalized * 100
      // Death Rate = death / uti * 100 (or death / hospitalized * 100)
      // Let's compute rates out of notified for consistency in cascading, or subset-rates
      const hospRate = data.map((d) =>
        d.notified > 0 ? parseFloat(((d.hospitalized / d.notified) * 100).toFixed(1)) : 0,
      );
      const utiRate = data.map((d) =>
        d.hospitalized > 0 ? parseFloat(((d.uti / d.hospitalized) * 100).toFixed(1)) : 0,
      );
      const deathRate = data.map((d) =>
        d.hospitalized > 0 ? parseFloat(((d.death / d.hospitalized) * 100).toFixed(1)) : 0,
      );

      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
        },
        legend: {
          data: ['Taxa Internação (%)', 'Taxa UTI (%)', 'Taxa Letalidade (%)'],
          bottom: 0,
          textStyle: { color: textColor },
        },
        grid: {
          left: '3%',
          right: '3%',
          bottom: '10%',
          top: 35,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xAxisData,
          axisLine: { show: true, lineStyle: { color: axisColor } },
          axisLabel: { color: textColor },
        },
        yAxis: {
          type: 'value',
          name: 'Percentual (%)',
          max: 100,
          axisLabel: { formatter: '{value}%', color: textColor },
          splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
        },
        series: [
          {
            name: 'Taxa Internação (%)',
            type: 'line',
            symbol: 'none',
            smooth: true,
            data: hospRate,
            itemStyle: { color: COLORS.PRIMARY },
            lineStyle: { width: 2.5 },
          },
          {
            name: 'Taxa UTI (%)',
            type: 'line',
            symbol: 'none',
            smooth: true,
            data: utiRate,
            itemStyle: { color: COLORS.ACCENT },
            lineStyle: { width: 2.5 },
          },
          {
            name: 'Taxa Letalidade (%)',
            type: 'line',
            symbol: 'none',
            smooth: true,
            data: deathRate,
            itemStyle: { color: COLORS.DANGER },
            lineStyle: { width: 2.5 },
          },
        ],
      };
    }
  };

  const { chartRef } = useEcharts(getOption(), [data, mode, theme]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
};

export default GravityCascadeChart;
