import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import type { DiagnosticResilienceResponse } from '../../types/epi';

interface Props {
  data: DiagnosticResilienceResponse | null;
  loading: boolean;
}

const getMethodColor = (method: string) => {
  if (method === 'Infecção Nosocomial') return '#e11d48';
  if (method === 'Infecção Comunitária') return '#ea580c';
  if (method === 'RT-PCR') return '#0f766e';
  if (method === 'Antígeno Rápido') return '#0d9488';
  if (method === 'Clínico-Imagem') return '#ca8a04';
  if (method === 'Clínico') return '#854d0e';
  if (method === 'Clínico-Epidemiológico') return '#2563eb';
  return '#64748b';
};

const symbolSize = (total: number) => {
  const scaled = Math.sqrt(Math.max(total, 1)) * 3.5;
  return Math.max(12, Math.min(scaled, 40));
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export function DiagnosticResilienceChart({ data, loading }: Props) {
  const theme = useThemeMode();
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';
  const borderColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'var(--border-subtle)';
  const cardBg = isDark ? 'var(--bg-status)' : 'var(--bg-status)';

  // Gráfico ECharts Volcano (Eficácia Diagnóstica e Letalidade)
  const volcanoOption = React.useMemo(() => {
    if (!data?.scatter || data.scatter.length === 0) return null;

    const list = data.scatter;
    const latencyValues = list.map((p) => p.avg_latency ?? 0);
    const cfrRates = list.map((p) => p.death_rate ?? 0);

    const xMax = Math.min(60, Math.ceil(Math.max(...latencyValues) + 1.5));
    const yMax = Math.min(100, Math.ceil(Math.max(...cfrRates) + 4));

    const medianLatency = median(latencyValues) ?? 0;
    const medianDeath = median(cfrRates) ?? 0;

    const seriesData = list.map((item) => ({
      name: item.diag_method,
      value: [
        item.avg_latency ?? 0,
        item.death_rate ?? 0,
        item.volume ?? 0,
        item.uti_count ?? 0,
        item.uti_rate ?? 0,
        item.death_count ?? 0,
      ],
      symbolSize: symbolSize(item.volume ?? 0),
      itemStyle: {
        color: getMethodColor(item.diag_method),
        opacity: 0.8,
        borderColor: getMethodColor(item.diag_method),
        borderWidth: 1.5,
      },
    }));

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: axisColor,
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        formatter: (params: {
          name: string;
          value: [number, number, number, number, number, number];
        }) => {
          const [latency, cfr, total, utiCount, utiRate, deathCount] = params.value;
          return `
            <div style="font-weight:700;font-size:12px;margin-bottom:4px">${params.name}</div>
            <table style="font-size:11px;border-collapse:collapse">
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">Casos Totais</td><td style="font-weight:600;text-align:right">${total}</td></tr>
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">Latência Mediana</td><td style="font-weight:600;text-align:right">${latency.toFixed(1)} dias</td></tr>
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">Letalidade (CFR)</td><td style="font-weight:600;text-align:right">${deathCount} (${cfr.toFixed(1)}%)</td></tr>
              <tr><td style="padding:1px 8px 1px 0;color:${textColor}">Admissão UTI</td><td style="font-weight:600;text-align:right">${utiCount} (${utiRate.toFixed(1)}%)</td></tr>
            </table>
          `;
        },
      },
      grid: { left: 10, right: 14, bottom: 28, top: 32, containLabel: true },
      xAxis: {
        name: 'Latência Mediana (dias)',
        nameLocation: 'middle',
        nameGap: 18,
        nameTextStyle: { color: textColor, fontSize: 10 },
        type: 'value',
        min: 0,
        max: xMax === 0 ? 10 : xMax,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, formatter: '{value}d', fontSize: 10 },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      },
      yAxis: {
        name: 'Letalidade (CFR %)',
        nameLocation: 'end',
        nameGap: 8,
        nameTextStyle: { color: textColor, fontSize: 10, align: 'left' },
        type: 'value',
        min: 0,
        max: yMax === 0 ? 10 : yMax,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor, formatter: '{value}%', fontSize: 10 },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      },
      series: [
        {
          type: 'scatter',
          data: seriesData,
          emphasis: {
            scale: 1.15,
            itemStyle: { opacity: 1, borderWidth: 2 },
            label: {
              show: true,
              fontWeight: 700,
              color: isDark ? '#f8fafc' : '#0f172a',
            },
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{b}',
            color: isDark ? '#f8fafc' : '#0f172a',
            fontSize: 9,
            fontWeight: 600,
            textBorderColor: isDark ? '#0f172a' : '#ffffff',
            textBorderWidth: 2.5,
          },
          labelLayout: {
            hideOverlap: true,
            moveOverlap: 'shiftY',
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { type: 'dashed', color: textColor, opacity: 0.8, width: 1.2 },
            label: {
              color: textColor,
              fontSize: 9,
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              padding: [2, 4],
              borderColor: axisColor,
              borderWidth: 0.5,
              borderRadius: 2,
            },
            data: [
              { xAxis: medianLatency, name: `Mediana Latência: ${medianLatency.toFixed(1)}d` },
              { yAxis: medianDeath, label: { position: 'insideEndTop' } },
            ],
          },
          markArea: {
            silent: true,
            itemStyle: { color: '#e11d48', opacity: 0.1 },
            data: [
              [
                { xAxis: medianLatency, yAxis: medianDeath },
                { xAxis: xMax, yAxis: yMax },
              ],
            ],
          },
        },
      ],
    };
  }, [data, isDark, axisColor, textColor, gridColor]);

  const volcanoRef = useEcharts(volcanoOption || {}, [volcanoOption]);

  if (loading) {
    return (
      <article
        className="panel"
        style={{
          background: cardBg,
          border: `0.5px solid ${borderColor}`,
          borderRadius: 8,
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '380px',
          width: '100%',
        }}
      >
        <span className="text-slate-400">Carregando...</span>
      </article>
    );
  }

  if (!data || data.scatter.length === 0) {
    return (
      <article
        className="panel"
        style={{
          background: cardBg,
          border: `0.5px solid ${borderColor}`,
          borderRadius: 8,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '380px',
          width: '100%',
        }}
      >
        <svg
          className="w-8 h-8 text-slate-300 mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <span className="text-sm font-medium text-slate-500">Volume de dados insuficiente</span>
      </article>
    );
  }

  return (
    <article
      className="panel"
      style={{
        background: cardBg,
        border: `0.5px solid ${borderColor}`,
        borderRadius: 8,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        height: '380px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>Eficácia Diagnóstica vs. Letalidade (CFR)</span>
        <div className="rank-tooltip-wrapper">
          <button
            type="button"
            className="rank-tooltip-trigger"
            aria-label="Informações sobre o gráfico"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
          <div className="rank-tooltip-content rank-tooltip-content--align-right" style={{ width: '320px' }}>
            Este quadrante correlaciona a qualidade epidemiológica (eixo X) com a severidade clínica dos desfechos (eixo Y):<br/><br/>
            • <b>Eficácia Diagnóstica (Eixo X):</b> Percentual de casos com agente etiológico identificado. Baixa eficácia (esquerda) significa excesso de casos rotulados como 'SRAG Não Especificada' (cegueira epidemiológica).<br/><br/>
            • <b>Letalidade - CFR (Eixo Y):</b> Proporção de óbitos entre os casos confirmados. Zonas de <b>Alto Risco (Quadrante Superior Esquerdo)</b> representam o pior cenário: alta letalidade combinada a um baixo esclarecimento diagnóstico, indicando subnotificação grave ou falhas severas na assistência clínica em tempo oportuno.
          </div>
        </div>
      </div>
      <div ref={volcanoRef.chartRef} style={{ flex: 1, minHeight: 0 }} />
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 6,
          fontSize: 9,
          color: textColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 12,
              height: 0,
              borderTop: `1px dashed ${textColor}`,
              opacity: 0.6,
              display: 'inline-block',
            }}
          />
          Mediana Latência / CFR
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              background: 'rgba(225, 29, 72, 0.1)',
              border: '1px solid rgba(225, 29, 72, 0.2)',
              display: 'inline-block',
              borderRadius: 2,
            }}
          />
          Alto Risco
        </span>
        <span>
          Tamanho: <b>casos</b>
        </span>
      </div>
    </article>
  );
}
