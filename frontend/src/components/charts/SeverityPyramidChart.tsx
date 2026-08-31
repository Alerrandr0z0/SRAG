import React from 'react';
import { COLORS } from '../../constants';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import type { SeverityPyramidResponse } from '../../types/epi';

interface Props {
  severityData: SeverityPyramidResponse | null;
  lethalityData: {
    age_bands: string[];
    agents: string[];
    matrix: number[][];
  } | null;
}

const AGENT_COLORS: Record<string, string> = {
  VSR: '#0f766e',
  Influenza: '#2563eb',
  'COVID-19': '#ea580c',
  'Outros Vírus': '#10b981',
  'Outro Agente': '#dc2626',
  'Não Especificada': '#94a3b8',
};

export const SeverityPyramidChart: React.FC<Props> = ({ severityData, lethalityData }) => {
  const theme = useThemeMode();

  const option = React.useMemo(() => {
    if (!severityData || severityData.length === 0) return null;

    const isDark = theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const axisColor = isDark ? '#334155' : '#e2e8f0';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    // X Axis categories are the age groups
    const xCategories = severityData.map((r) => r.age_group);

    // Stacked bars calculation for each age group:
    // We want stacks for: 'Óbito', 'UTI (Sobrevivente)', 'Enfermaria/Não Internado'
    const deathsData = severityData.map((r) => Math.round(r.total_cases * (r.death_rate / 100)));
    const utiSurvivorsData = severityData.map((r) =>
      Math.round(r.total_cases * (Math.max(0, r.uti_rate - r.death_rate) / 100)),
    );
    const wardData = severityData.map((r) =>
      Math.round(r.total_cases * (Math.max(0, 100 - Math.max(r.uti_rate, r.death_rate)) / 100)),
    );

    const barSeries = [
      {
        name: 'Óbito',
        type: 'bar',
        stack: 'severity',
        yAxisIndex: 0,
        data: deathsData,
        itemStyle: { color: COLORS.DANGER },
      },
      {
        name: 'UTI (Sobrevivente)',
        type: 'bar',
        stack: 'severity',
        yAxisIndex: 0,
        data: utiSurvivorsData,
        itemStyle: { color: COLORS.ACCENT },
      },
      {
        name: 'Enfermaria/Não Internado',
        type: 'bar',
        stack: 'severity',
        yAxisIndex: 0,
        data: wardData,
        itemStyle: { color: COLORS.SECONDARY, opacity: 0.5 },
      },
    ];

    // CFR line series for each agent:
    // biome-ignore lint/suspicious/noExplicitAny: lineSeries is mapped dynamically
    const lineSeries: any[] = [];
    const activeLegendAgents: string[] = [];

    if (lethalityData) {
      const { age_bands, agents, matrix } = lethalityData;
      agents.forEach((agent, yIdx) => {
        const cfrPoints = xCategories.map((ageGroup) => {
          // Align by age group name
          const xIdx = age_bands.indexOf(ageGroup);
          if (xIdx === -1) return 0;
          return matrix[yIdx]?.[xIdx] ?? 0;
        });

        const hasCfr = cfrPoints.some((val) => val > 0);
        if (hasCfr) {
          activeLegendAgents.push(agent);
          const color = AGENT_COLORS[agent] || '#64748b';
          lineSeries.push({
            name: `${agent} (CFR)`,
            type: 'line',
            yAxisIndex: 1, // right axis
            data: cfrPoints,
            symbol: 'circle',
            symbolSize: 6,
            showSymbol: true,
            smooth: true,
            z: 10, // Ensure lines draw on top of bars
            lineStyle: { width: 2, color: color },
            itemStyle: { color: color },
          });
        }
      });
    }

    const allSeries = [...barSeries, ...lineSeries];
    const legendData = [
      'Óbito',
      'UTI (Sobrevivente)',
      'Enfermaria/Não Internado',
      ...activeLegendAgents.map((a) => `${a} (CFR)`),
    ];

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: axisColor,
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        // biome-ignore lint/suspicious/noExplicitAny: ECharts formatter parameters are dynamically typed
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          const ageGroup = params[0].name;
          const originalSev = severityData.find((r) => r.age_group === ageGroup);

          let html = `<div style="font-weight:700;margin-bottom:6px">${ageGroup}</div>`;
          if (originalSev) {
            html += `<div style="font-size:11px;color:${textColor};margin-bottom:4px">Total de Casos: <b>${originalSev.total_cases}</b></div>`;
          }

          html += '<table style="font-size:11px;border-collapse:collapse;width:100%">';

          // Volume / Severity details
          params.forEach((p) => {
            if (p.seriesIndex < 3) {
              // Bar series
              const rate = originalSev
                ? p.seriesName === 'Óbito'
                  ? originalSev.death_rate
                  : p.seriesName === 'UTI (Sobrevivente)'
                    ? Math.max(0, originalSev.uti_rate - originalSev.death_rate)
                    : Math.max(0, 100 - Math.max(originalSev.uti_rate, originalSev.death_rate))
                : 0;
              html += `<tr>
                <td style="padding:2px 8px 2px 0">${p.marker} ${p.seriesName}</td>
                <td style="text-align:right;font-weight:600;padding-left:12px">${p.value} (${rate.toFixed(1)}%)</td>
              </tr>`;
            } else {
              // Line series
              html += `<tr>
                <td style="padding:2px 8px 2px 0">${p.marker} ${p.seriesName}</td>
                <td style="text-align:right;font-weight:600;padding-left:12px;color:${p.color}">${p.value.toFixed(1)}%</td>
              </tr>`;
            }
          });

          html += '</table>';
          return html;
        },
      },
      legend: {
        data: legendData,
        bottom: 0,
        textStyle: { color: textColor, fontSize: 9 },
        itemWidth: 10,
        itemHeight: 8,
        type: 'scroll',
      },
      grid: {
        left: 15,
        right: 15,
        bottom: 50,
        top: 35,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xCategories,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, rotate: 25, fontSize: 9 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Volume de Casos',
          nameTextStyle: { color: textColor, fontSize: 9 },
          axisLine: { show: true, lineStyle: { color: axisColor } },
          axisLabel: { color: textColor, fontSize: 9 },
          splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
        },
        {
          type: 'value',
          name: 'Letalidade (CFR %)',
          nameTextStyle: { color: textColor, fontSize: 9 },
          axisLine: { show: true, lineStyle: { color: axisColor } },
          axisLabel: { color: textColor, formatter: '{value}%', fontSize: 9 },
          splitLine: { show: false },
          min: 0,
          max: 100,
        },
      ],
      series: allSeries,
    };
  }, [severityData, lethalityData, theme]);

  const { chartRef } = useEcharts(option || {}, [option]);

  return <div ref={chartRef} style={{ height: '100%', width: '100%' }} />;
};

export default SeverityPyramidChart;
