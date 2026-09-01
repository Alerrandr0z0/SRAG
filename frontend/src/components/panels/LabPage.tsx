import * as d3 from 'd3';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import * as Epi from '../../types/epi';
import AntiviralDonutChart from '../charts/AntiviralDonutChart';
import AntiviralOutcomeSlopegraph from '../charts/AntiviralOutcomeSlopegraph';
import ClosureCriteriaAgentChart from '../charts/ClosureCriteriaAgentChart';
import ImagingVolcanoChart from '../charts/ImagingVolcanoChart';
import PositivitySampleTypeChart from '../charts/PositivitySampleTypeChart';
import TherapeuticKdeChart from '../charts/TherapeuticKdeChart';
import RankTable from '../ui/RankTable';

interface LabPageProps {
  data: Epi.DashboardData | null;
  qualityByLaboratory: Epi.LaboratorioQualityScore[];
}

const OMS_PCR_TARGET_DAYS = 7;
const LATENCY_MAX_SCALE = 30;
const TURNAROUND_TARGET_DAYS = 2;
const TURNAROUND_MAX_SCALE = 21;

const latencySeverity = (median: number | null | undefined) => {
  if (median == null) return { tone: 'slate', label: 'Sem dados', color: '#475569' };
  if (median <= OMS_PCR_TARGET_DAYS) return { tone: 'green', label: 'Adequado', color: '#16a34a' };
  if (median <= 14) return { tone: 'amber', label: 'Atenção', color: '#d97706' };
  return { tone: 'red', label: 'Crítico', color: '#dc2626' };
};

const turnaroundSeverity = (days: number | null | undefined) => {
  if (days == null) return { tone: 'slate', label: 'Sem dados', color: '#475569' };
  if (days <= TURNAROUND_TARGET_DAYS) return { tone: 'green', label: 'Adequado', color: '#16a34a' };
  if (days <= 4) return { tone: 'amber', label: 'Atenção', color: '#d97706' };
  return { tone: 'red', label: 'Crítico', color: '#dc2626' };
};

const coverageSeverity = (rate: number | null | undefined) => {
  if (rate == null) return { tone: 'slate', label: 'Sem dados', color: '#475569' };
  if (rate >= 90) return { tone: 'green', label: 'Adequado', color: '#16a34a' };
  if (rate >= 80) return { tone: 'amber', label: 'Atenção', color: '#d97706' };
  return { tone: 'red', label: 'Crítico', color: '#dc2626' };
};

const testedSeverity = (rate: number | null | undefined) => {
  if (rate == null) return { tone: 'slate', label: 'Sem dados', color: '#475569' };
  if (rate >= 80) return { tone: 'green', label: 'Adequado', color: '#16a34a' };
  if (rate >= 60) return { tone: 'amber', label: 'Atenção', color: '#d97706' };
  return { tone: 'red', label: 'Crítico', color: '#dc2626' };
};

const StatusDot: React.FC<{ color: string; meta: string; title?: string }> = ({
  color,
  meta,
  title,
}) => (
  <span
    title={title}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 9,
      color: 'var(--text-muted)',
      letterSpacing: 0.2,
    }}
  >
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 0 2px ${color}22`,
      }}
    />
    {meta}
  </span>
);

const MiniBoxplot: React.FC<{
  data: [number, number, number, number, number];
  meta: number;
  maxScale: number;
  color: string;
  gradientId: string;
  count?: number;
  p25Label?: number;
  p75Label?: number;
  worstCaseTooltip?: string;
  outerTooltip?: string;
  worstCaseThreshold?: number;
}> = ({
  data,
  meta,
  maxScale,
  color,
  gradientId,
  count,
  p25Label,
  p75Label,
  worstCaseTooltip: _worstCaseTooltip,
  outerTooltip: _outerTooltip,
  worstCaseThreshold,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useThemeMode();
  const [hoverInfo, setHoverInfo] = useState<{
    show: boolean;
    x: number;
    y: number;
    containerWidth: number;
  }>({ show: false, x: 0, y: 0, containerWidth: 0 });

  const themeColors = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      trackColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
      metaColor: isDark ? '#14b8a6' : '#0f766e',
      labelColor: isDark ? '#94a3b8' : '#64748b',
      gradientTop: isDark ? 0.5 : 0.42,
      gradientBottom: isDark ? 0.32 : 0.24,
    };
  }, [theme]);

  const [minV, q1, med, q3, maxV] = data;
  const worstColor = theme === 'dark' ? '#f87171' : '#dc2626';
  const iqr = q3 - q1;
  const upperFence = q3 + 1.5 * iqr;
  const showWorstCase = maxV > (worstCaseThreshold ?? meta) && maxV > q3;

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const w = 240;
    const h = 56;
    const padX = 10;
    const trackY = h / 2 + 2;
    const scaleX = (v: number) => padX + (Math.min(v, maxScale) / maxScale) * (w - 2 * padX);

    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', 'xMidYMid meet');

    const defs = svg.append('defs');
    const grad = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', 1);
    grad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', color)
      .attr('stop-opacity', themeColors.gradientTop);
    grad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', color)
      .attr('stop-opacity', themeColors.gradientBottom);

    const xMin = scaleX(minV);
    const xQ1 = scaleX(q1);
    const xMed = scaleX(med);
    const xQ3 = scaleX(q3);
    const xMax = scaleX(maxV);
    const xTarget = scaleX(meta);
    const xUpperFence = scaleX(Math.min(upperFence, maxScale));

    svg
      .append('line')
      .attr('x1', xTarget)
      .attr('x2', xTarget)
      .attr('y1', 10)
      .attr('y2', trackY + 10)
      .attr('stroke', themeColors.metaColor)
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3 3');
    svg
      .append('text')
      .attr('x', xTarget)
      .attr('y', 6)
      .attr('font-size', 9)
      .attr('fill', themeColors.metaColor)
      .attr('text-anchor', 'middle')
      .attr('font-weight', 600)
      .text(`meta ${meta}d`);

    // Whisker lines
    svg
      .append('line')
      .attr('x1', xMin)
      .attr('x2', xQ1)
      .attr('y1', trackY)
      .attr('y2', trackY)
      .attr('stroke', color)
      .attr('stroke-width', 1.4);
    svg
      .append('line')
      .attr('x1', xQ3)
      .attr('x2', xUpperFence)
      .attr('y1', trackY)
      .attr('y2', trackY)
      .attr('stroke', color)
      .attr('stroke-width', 1.4);

    // Whisker ticks
    svg
      .append('line')
      .attr('x1', xMin)
      .attr('x2', xMin)
      .attr('y1', trackY - 6)
      .attr('y2', trackY + 6)
      .attr('stroke', color)
      .attr('stroke-width', 1.4);
    svg
      .append('line')
      .attr('x1', xUpperFence)
      .attr('x2', xUpperFence)
      .attr('y1', trackY - 6)
      .attr('y2', trackY + 6)
      .attr('stroke', color)
      .attr('stroke-width', 1.4);

    if (showWorstCase) {
      svg
        .append('line')
        .attr('x1', xUpperFence)
        .attr('x2', xMax)
        .attr('y1', trackY)
        .attr('y2', trackY)
        .attr('stroke', color)
        .attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '2 2');
    }

    svg
      .append('rect')
      .attr('x', xQ1)
      .attr('y', trackY - 10)
      .attr('width', Math.max(xQ3 - xQ1, 1))
      .attr('height', 20)
      .attr('fill', `url(#${gradientId})`)
      .attr('stroke', color)
      .attr('stroke-width', 1.4)
      .attr('rx', 2);

    const medianColor = theme === 'dark' ? '#ffffff' : '#0f172a';
    svg
      .append('line')
      .attr('x1', xMed)
      .attr('x2', xMed)
      .attr('y1', trackY - 10)
      .attr('y2', trackY + 10)
      .attr('stroke', medianColor)
      .attr('stroke-width', 2);

    if (showWorstCase) {
      const worstLabelX = Math.min(xMax, w - padX - 4);
      const worstAnchor = xMax > w - padX - 30 ? 'end' : 'middle';
      svg
        .append('line')
        .attr('x1', xMax)
        .attr('x2', xMax)
        .attr('y1', trackY - 14)
        .attr('y2', trackY - 6)
        .attr('stroke', worstColor)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '1.5 1.5');
      svg
        .append('circle')
        .attr('cx', xMax)
        .attr('cy', trackY - 18)
        .attr('r', 3.5)
        .attr('fill', worstColor)
        .attr('stroke', 'white')
        .attr('stroke-width', 1.2);
      svg
        .append('text')
        .attr('x', worstLabelX)
        .attr('y', trackY - 22)
        .attr('font-size', 10)
        .attr('fill', worstColor)
        .attr('text-anchor', worstAnchor)
        .attr('font-weight', 700)
        .text(`pior caso · ${maxV}d`);
    }

    svg
      .append('text')
      .attr('x', padX)
      .attr('y', h - 4)
      .attr('font-size', 9)
      .attr('fill', themeColors.labelColor)
      .text(
        p25Label != null && p75Label != null
          ? `P25 ${p25Label}d · P75 ${p75Label}d`
          : `n=${count ?? '?'}`,
      );
  }, [
    meta,
    maxScale,
    color,
    gradientId,
    count,
    p25Label,
    p75Label,
    themeColors,
    minV,
    q1,
    med,
    q3,
    maxV,
    upperFence,
    showWorstCase,
    theme,
    worstColor,
  ]);

  const isRightHalf = hoverInfo.show && hoverInfo.x > hoverInfo.containerWidth * 0.55;

  return (
    <div
      style={{ position: 'relative', marginTop: 6 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverInfo({
          show: true,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          containerWidth: rect.width,
        });
      }}
      onMouseLeave={() => {
        setHoverInfo({ show: false, x: 0, y: 0, containerWidth: 0 });
      }}
    >
      <svg ref={svgRef} width="100%" height={56} aria-label="Boxplot de distribuição" />
      {hoverInfo.show && (
        <div
          style={{
            position: 'absolute',
            left: isRightHalf ? hoverInfo.x - 12 : hoverInfo.x + 12,
            transform: isRightHalf ? 'translateX(-100%)' : 'none',
            top: hoverInfo.y - 12,
            width: 'max-content',
            minWidth: '140px',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            color: '#f8fafc',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '10px',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(4px)',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div
              style={{
                fontWeight: 600,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '3px',
                marginBottom: '3px',
              }}
            >
              Distribuição do Tempo
            </div>
            <div>
              Mínimo: <b>{minV}d</b>
            </div>
            <div>
              Q1 (P25): <b>{q1}d</b>
            </div>
            <div>
              Mediana (P50): <b>{med}d</b>
            </div>
            <div>
              Q3 (P75): <b>{q3}d</b>
            </div>
            <div>
              Máximo: <b>{maxV}d</b>
            </div>
            <div
              style={{
                marginTop: '2px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: '2px',
              }}
            >
              Meta: <b style={{ color: themeColors.metaColor }}>≤ {meta}d</b>
            </div>
            <div style={{ opacity: 0.8, fontSize: '9px', marginTop: '2px' }}>
              Volume: {count ?? '?'} casos
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LatencyBoxplotKpi: React.FC<{
  median: number | null | undefined;
  boxplotData: number[] | undefined;
  count: number | undefined;
  p99: number | null | undefined;
}> = ({ median, boxplotData, count, p99 }) => {
  const sev = latencySeverity(median);
  const hasData = Array.isArray(boxplotData) && boxplotData.length === 5;

  if (!hasData) {
    return (
      <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 11 }}>
        Sem dados de latência disponíveis
      </div>
    );
  }

  const [_minV, q1, _med, q3, maxV] = boxplotData as [number, number, number, number, number];
  const tooltip = `P25=${q1}d · P50=${median}d · P75=${q3}d · máx=${maxV}d (n=${count ?? '?'})`;
  const worstCaseTooltip =
    maxV > (p99 ?? maxV)
      ? `Pior caso: ${maxV}d. Único valor além de P99 (${p99}d). n=1/${count ?? '?'}.`
      : `Pior caso: ${maxV}d. Valor máximo da distribuição. n=1/${count ?? '?'}.`;

  return (
    <MiniBoxplot
      data={boxplotData as [number, number, number, number, number]}
      meta={OMS_PCR_TARGET_DAYS}
      maxScale={LATENCY_MAX_SCALE}
      color={sev.color}
      gradientId="latency-box-gradient"
      count={count}
      p25Label={q1}
      p75Label={q3}
      worstCaseTooltip={worstCaseTooltip}
      outerTooltip={tooltip}
      worstCaseThreshold={OMS_PCR_TARGET_DAYS}
    />
  );
};

const RateDonutKpi: React.FC<{
  rate: number;
  label: string;
  color: string;
  title?: string;
}> = ({ rate, label, color, title }) => {
  const theme = useThemeMode();

  const option = useMemo(() => {
    const isDark = theme === 'dark';
    const trackColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)';
    const tooltipBorderColor = isDark ? '#334155' : '#e2e8f0';
    const tooltipBgColor = isDark ? '#0f172a' : '#ffffff';
    const tooltipTextColor = isDark ? '#f8fafc' : '#0f172a';

    return {
      tooltip: {
        show: true,
        trigger: 'item',
        backgroundColor: tooltipBgColor,
        borderColor: tooltipBorderColor,
        textStyle: { color: tooltipTextColor, fontSize: 11 },
        formatter: (params: { dataIndex: number; value: number }) => {
          const name = params.dataIndex === 0 ? 'Taxa Registrada' : 'Pendente';
          return `<div style="font-weight:600;margin-bottom:4px;white-space:normal;max-width:180px">${title || label}</div>
                    <div>${name}: <b>${params.value.toFixed(1)}%</b></div>`;
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['62%', '84%'],
          center: ['50%', '50%'],
          silent: false,
          label: {
            show: true,
            position: 'center',
            formatter: `${rate}%`,
            fontSize: 16,
            fontWeight: 800,
            color,
          },
          data: [
            { value: rate, itemStyle: { color } },
            { value: 100 - rate, itemStyle: { color: trackColor } },
          ],
          itemStyle: { borderRadius: 3, borderColor: 'transparent', borderWidth: 0 },
        },
      ],
    };
  }, [rate, color, theme, title, label]);

  const { chartRef } = useEcharts(option, [rate, color, theme, title, label]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
      }}
    >
      <div ref={chartRef} style={{ width: 105, height: 105 }} />
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          fontWeight: 500,
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
    </div>
  );
};

const TurnaroundKpi: React.FC<{
  days: number | null | undefined;
  median: number | null | undefined;
  p90: number | null | undefined;
  boxplot: number[] | undefined;
  count: number | undefined;
}> = ({ days, median, p90, boxplot, count }) => {
  if (days == null) {
    return <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-muted)' }}>—</div>;
  }
  const sev = turnaroundSeverity(days);
  const roundedDays = Math.round(days);

  const hasBox = Array.isArray(boxplot) && boxplot.length === 5;
  const [_minV, q1, _med, q3, maxV] = (boxplot ?? [0, 0, 0, 0, 0]) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const outerTooltip = `P25=${q1}d · P50=${median ?? _med}d · P75=${q3}d · máx=${maxV}d (n=${count ?? '?'})`;
  const worstCaseTooltip =
    maxV > (p90 ?? maxV)
      ? `Pior caso: ${maxV}d. Único valor além de P90 (${p90}d). n=1/${count ?? '?'}.`
      : `Pior caso: ${maxV}d. Valor máximo da distribuição. n=1/${count ?? '?'}.`;

  return (
    <div
      style={{ marginTop: 4 }}
      title="Tempo de resposta médio entre coleta e resultado. Mostra média (P50=0 oculta outliers)."
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: sev.color, lineHeight: 1.1 }}>
          {roundedDays}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
          {roundedDays === 1 ? 'dia (média)' : 'dias (média)'}
        </span>
      </div>
      {p90 != null && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 3,
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
          }}
        >
          <span>
            P90: <b style={{ color: 'var(--text)' }}>{Math.round(p90)}d</b>
          </span>
          {count != null && <span style={{ opacity: 0.7 }}>· n={count}</span>}
        </div>
      )}
      {hasBox && (
        <MiniBoxplot
          data={boxplot as [number, number, number, number, number]}
          meta={TURNAROUND_TARGET_DAYS}
          maxScale={TURNAROUND_MAX_SCALE}
          color={sev.color}
          gradientId="turnaround-box-gradient"
          count={count}
          p25Label={q1}
          p75Label={q3}
          worstCaseTooltip={worstCaseTooltip}
          outerTooltip={outerTooltip}
          worstCaseThreshold={TURNAROUND_TARGET_DAYS}
        />
      )}
    </div>
  );
};

const getAlertLevel = (score: number, turnaround: number, coverage: number) => {
  const penalty = (100 - score) * 0.5 + Math.min(turnaround, 30) * 1.5 + (100 - coverage) * 0.3;
  if (penalty >= 85) return { label: 'Crítico', tone: 'critical' as const };
  if (penalty >= 60) return { label: 'Alerta', tone: 'warning' as const };
  return { label: 'Estável', tone: 'info' as const };
};

const formatMetric = (value: number | null | undefined, suffix = '') => {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value}${suffix}`;
};

const LabPage: React.FC<LabPageProps> = ({ data, qualityByLaboratory }) => {
  const lab = data?.laboratoryNetwork;
  const treatment = lab?.treatment_metrics;
  const antiviralTypes = lab?.antiviral_types || [];
  const latencyPerDrug = treatment?.antiviral_latency_per_drug || [];
  const sampleTypeDist = lab?.quality_metrics?.sample_type_distribution || [];
  const treatmentWindowOutcomes = treatment?.treatment_window_outcomes || [];

  const labRows = [...qualityByLaboratory]
    .sort((a, b) => {
      const aTurnaround = a.median_turnaround_days ?? Number.NaN;
      const bTurnaround = b.median_turnaround_days ?? Number.NaN;
      const aCoverage = a.resultado_pct ?? Number.NaN;
      const bCoverage = b.resultado_pct ?? Number.NaN;

      const aAlert = getAlertLevel(
        a.score,
        Number.isNaN(aTurnaround) ? 0 : aTurnaround,
        Number.isNaN(aCoverage) ? 0 : aCoverage,
      );
      const bAlert = getAlertLevel(
        b.score,
        Number.isNaN(bTurnaround) ? 0 : bTurnaround,
        Number.isNaN(bCoverage) ? 0 : bCoverage,
      );
      const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
      const sevDiff = severityOrder[aAlert.tone] - severityOrder[bAlert.tone];
      if (sevDiff !== 0) return sevDiff;
      return (
        a.score - b.score ||
        (Number.isNaN(bTurnaround) ? 0 : bTurnaround) -
          (Number.isNaN(aTurnaround) ? 0 : aTurnaround)
      );
    })
    .map((lab) => {
      const turnaround = lab.median_turnaround_days ?? Number.NaN;
      const coverage = lab.resultado_pct ?? Number.NaN;
      const alert = getAlertLevel(
        lab.score,
        Number.isNaN(turnaround) ? 0 : turnaround,
        Number.isNaN(coverage) ? 0 : coverage,
      );
      return {
        key: lab.laboratorio,
        values: {
          laboratorio: <strong>{lab.laboratorio}</strong>,
          total: <strong>{lab.total}</strong>,
          score: <strong>{lab.score}%</strong>,
          median_turnaround_days: <strong>{formatMetric(lab.median_turnaround_days, 'd')}</strong>,
          cobertura: <strong>{formatMetric(lab.resultado_pct, '%')}</strong>,
          sinal_alarme: <span>{alert.label}</span>,
        },
        sortValues: {
          laboratorio: lab.laboratorio,
          total: lab.total,
          score: lab.score,
          median_turnaround_days: Number.isFinite(turnaround) ? turnaround : -1,
          cobertura: Number.isFinite(coverage) ? coverage : -1,
          sinal_alarme: alert.label,
        },
      };
    });

  const totalTreated = antiviralTypes.reduce(
    (sum: number, a: { count: number }) => sum + a.count,
    0,
  );

  return (
    <>
      <section className="vigilance-block">
        <article className="panel">
          <RankTable
            title="Desempenho por Laboratório"
            subtitle={
              <>
                Ranqueamento da qualidade operacional dos laboratórios responsáveis pelo diagnóstico
                laboratorial:
                <br />
                <br />• <b>Score de qualidade:</b> média de completude das quatro variáveis do bloco
                diagnóstico — amostra, data de coleta, data de resultado e resultado final.
                Formalmente, Score = (Σ completude<sub>i</sub> ÷ 4) × 100, em escala 0–100%. Ordena
                preenchimento e rastreabilidade e prioriza a classificação da tabela (desempate por
                latência e conclusão). Escores baixos sinalizam subregistro ou fluxo fragmentado.
                <br />
                <br />• <b>Latência mediana:</b> mediana em dias entre coleta e liberação do RT-PCR;
                valores elevados indicam gargalo.
                <br />
                <br />• <b>Conclusão de exames:</b> percentual de amostras com resultado final
                reportado; baixa indica represamento.
                <br />
                <br />• <b>Sinal de alerta:</b> classificação combinada (score, latência e
                cobertura) para priorização de supervisão.
              </>
            }
            subtitlePosition="bottom"
            searchPlaceholder="Buscar laboratório..."
            columns={[
              { key: 'laboratorio', label: 'Laboratório', sortable: true },
              { key: 'total', label: 'Volume testado', align: 'right', sortable: true },
              {
                key: 'median_turnaround_days',
                label: 'Latência mediana',
                align: 'right',
                sortable: true,
              },
              { key: 'cobertura', label: 'Conclusão de exames', align: 'right', sortable: true },
              { key: 'score', label: 'Score de qualidade', align: 'right', sortable: true },
              { key: 'sinal_alarme', label: 'Sinal de alerta', sortable: true },
            ]}
            rows={labRows}
            exportable={{
              filename: 'desempenho_laboratorios',
              title: 'Desempenho por Laboratório',
            }}
            initialPageSize={10}
          />
        </article>
      </section>

      <section className="vigilance-block" style={{ marginTop: '2rem' }}>
        <article className="panel">
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <h3 style={{ margin: 0 }}>Performance Diagnóstica</h3>
            </div>
          </div>

          <div
            className="responsive-grid-4col"
            style={{
              marginTop: '1rem',
            }}
          >
            <div
              className="card-box"
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '170px',
              }}
            >
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}
              >
                <span>Resultado Laboratorial</span>
                <StatusDot
                  color={
                    testedSeverity(
                      lab?.overall?.tested_cases != null &&
                        lab?.quality_metrics?.testing_coverage?.total
                        ? (lab.overall.tested_cases / lab.quality_metrics.testing_coverage.total) *
                            100
                        : null,
                    ).color
                  }
                  meta="meta ≥ 80%"
                  title="Casos com PCR ou teste antigênico processado e com resultado disponível. Meta ≥ 80%."
                />
              </div>
              <div
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <RateDonutKpi
                  rate={
                    lab?.overall?.tested_cases != null &&
                    lab?.quality_metrics?.testing_coverage?.total
                      ? Number(
                          (
                            (lab.overall.tested_cases /
                              lab.quality_metrics.testing_coverage.total) *
                            100
                          ).toFixed(1),
                        )
                      : 0
                  }
                  label={
                    lab?.overall?.tested_cases != null &&
                    lab?.quality_metrics?.testing_coverage?.total
                      ? `${lab.overall.tested_cases} de ${lab.quality_metrics.testing_coverage.total}`
                      : '—'
                  }
                  color={
                    testedSeverity(
                      lab?.overall?.tested_cases != null &&
                        lab?.quality_metrics?.testing_coverage?.total
                        ? (lab.overall.tested_cases / lab.quality_metrics.testing_coverage.total) *
                            100
                        : null,
                    ).color
                  }
                  title="Casos com PCR ou teste antigênico processado e com resultado disponível."
                />
              </div>
            </div>

            <div
              className="card-box"
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '170px',
              }}
            >
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}
              >
                <span>Coleta de Amostra</span>
                <StatusDot
                  color={
                    coverageSeverity(lab?.quality_metrics?.testing_coverage?.rate ?? null).color
                  }
                  meta="meta ≥ 80%"
                  title="Casos com amostra laboratorial coletada. Meta ≥ 80%."
                />
              </div>
              <div
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <RateDonutKpi
                  rate={lab?.quality_metrics?.testing_coverage?.rate ?? 0}
                  label={
                    lab?.quality_metrics?.testing_coverage?.collected != null &&
                    lab?.quality_metrics?.testing_coverage?.total
                      ? `${lab.quality_metrics.testing_coverage.collected} de ${lab.quality_metrics.testing_coverage.total}`
                      : '—'
                  }
                  color={
                    coverageSeverity(lab?.quality_metrics?.testing_coverage?.rate ?? null).color
                  }
                  title="Casos com amostra laboratorial coletada."
                />
              </div>
            </div>

            <div
              className="card-box"
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '170px',
              }}
            >
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}
              >
                <span>Latência RT-PCR</span>
                <StatusDot
                  color={latencySeverity(lab?.quality_metrics?.diagnostic_latency?.median).color}
                  meta={`meta ≤ ${OMS_PCR_TARGET_DAYS}d`}
                  title="Mediana do tempo entre coleta e resultado (P50). Meta OMS ≤ 7d."
                />
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: latencySeverity(lab?.quality_metrics?.diagnostic_latency?.median)
                        .color,
                      lineHeight: 1.1,
                    }}
                  >
                    {lab?.quality_metrics?.diagnostic_latency?.median ?? '—'}
                  </span>
                  {lab?.quality_metrics?.diagnostic_latency?.median != null && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                      d (mediana)
                    </span>
                  )}
                </div>
                {lab?.quality_metrics?.diagnostic_latency?.p95 != null && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginTop: 3,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                    }}
                  >
                    <span>
                      P95:{' '}
                      <b style={{ color: 'var(--text)' }}>
                        {Math.round(lab.quality_metrics.diagnostic_latency.p95)}d
                      </b>
                    </span>
                    {lab.quality_metrics.diagnostic_latency.count != null && (
                      <span style={{ opacity: 0.7 }}>
                        · n={lab.quality_metrics.diagnostic_latency.count}
                      </span>
                    )}
                  </div>
                )}
                <LatencyBoxplotKpi
                  median={lab?.quality_metrics?.diagnostic_latency?.median ?? null}
                  boxplotData={lab?.quality_metrics?.diagnostic_latency?.boxplot_data}
                  count={lab?.quality_metrics?.diagnostic_latency?.count}
                  p99={lab?.quality_metrics?.diagnostic_latency?.p99 ?? null}
                />
              </div>
            </div>

            <div
              className="card-box"
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '170px',
              }}
            >
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}
              >
                <span>Tempo de Resposta (Média)</span>
                <StatusDot
                  color={turnaroundSeverity(lab?.overall?.avg_turnaround_days ?? null).color}
                  meta={`meta ≤ ${TURNAROUND_TARGET_DAYS}d`}
                  title="Tempo médio entre coleta e resultado. Meta ≤ 2d."
                />
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <TurnaroundKpi
                  days={lab?.overall?.avg_turnaround_days ?? null}
                  median={lab?.overall?.median_turnaround_days ?? null}
                  p90={lab?.overall?.turnaround_p90 ?? null}
                  boxplot={lab?.overall?.turnaround_boxplot ?? undefined}
                  count={lab?.overall?.turnaround_count ?? undefined}
                />
              </div>
            </div>
          </div>

          <div
            className="responsive-grid-2col"
            style={{
              marginTop: '1.25rem',
            }}
          >
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Positividade por Tipo de Amostra
              </div>
              <div className="chart-wrap" style={{ minHeight: '260px' }}>
                <PositivitySampleTypeChart data={lab?.positivity_by_sample_type ?? null} />
              </div>
            </div>
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Critério de Confirmação por Agente
              </div>
              <div className="chart-wrap" style={{ minHeight: '260px' }}>
                <ClosureCriteriaAgentChart data={lab?.closure_by_agent ?? null} />
              </div>
            </div>
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Distribuição de Amostras
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {(() => {
                  const total =
                    sampleTypeDist.reduce((s: number, x: { count: number }) => s + x.count, 0) || 1;
                  return sampleTypeDist
                    .slice(0, 5)
                    .map((item: { label: string; count: number }, i: number) => {
                      const pct = (item.count / total) * 100;
                      return (
                        <div key={i}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '11px',
                              marginBottom: '3px',
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{item.label}</span>
                            <span style={{ color: '#64748b' }}>
                              {item.count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: '6px',
                              background: 'var(--bg-pill)',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: i === 0 ? '#0f766e' : '#94a3b8',
                                transition: 'width 0.3s',
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Encerramento dos Casos
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {(lab?.closure_criteria || []).map(
                  (c: { label: string; count: number }, i: number) => {
                    const total =
                      (lab?.closure_criteria || []).reduce(
                        (s: number, x: { count: number }) => s + x.count,
                        0,
                      ) || 1;
                    const pct = (c.count / total) * 100;
                    const colors = ['#0f766e', '#888780', '#b4b2a9', '#d3d1c7'];
                    return (
                      <div key={i}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            marginBottom: '3px',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{c.label}</span>
                          <span style={{ color: '#64748b' }}>
                            {c.count} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '6px',
                            background: 'var(--bg-pill)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: colors[i] || '#94a3b8',
                              transition: 'width 0.3s',
                            }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="vigilance-block" style={{ marginTop: '2rem' }}>
        <article className="panel">
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <h3 style={{ margin: 0 }}>Latência ao tratamento e desfecho clínico</h3>
            </div>
            {antiviralTypes.length > 0 && (
              <div className="filters" style={{ fontSize: '12px', color: '#64748b', gap: 12 }}>
                <span>
                  Tratados: <b>{totalTreated}</b>
                </span>
              </div>
            )}
          </div>

          <div
            className="responsive-grid-4col"
            style={{
              marginTop: '1rem',
            }}
          >
            <div
              style={{
                background: 'var(--bg-status)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.85rem',
                minHeight: '88px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div className="meta" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                Mediana latência
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
                  {lab?.quality_metrics?.diagnostic_latency?.median ?? '—'}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                    d
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  sintomas → antiviral
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-status)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.85rem',
                minHeight: '88px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div className="meta" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                Tratados ≤ 2d
              </div>
              {(() => {
                const w1 = treatmentWindowOutcomes.find((w) => w.window === '≤ 1d');
                const w2 = treatmentWindowOutcomes.find((w) => w.window === '2d');
                const treatedTotal = treatmentWindowOutcomes
                  .filter((w) => w.window !== 's/ antiviral')
                  .reduce((s, w) => s + w.total, 0);
                const early = (w1?.total ?? 0) + (w2?.total ?? 0);
                const pct = treatedTotal > 0 ? (early / treatedTotal) * 100 : null;
                const tone =
                  pct == null
                    ? '#475569'
                    : pct >= 50
                      ? '#16a34a'
                      : pct >= 25
                        ? '#d97706'
                        : '#dc2626';
                return (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: tone, lineHeight: 1.1 }}>
                      {pct == null ? '—' : `${pct.toFixed(0)}`}
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                        %
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      dentro da janela ideal
                    </div>
                  </div>
                );
              })()}
            </div>

            <div
              style={{
                background: 'var(--bg-status)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.85rem',
                minHeight: '88px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div className="meta" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                Cura se ≤ 2d
              </div>
              {(() => {
                const w1 = treatmentWindowOutcomes.find((w) => w.window === '≤ 1d');
                const w2 = treatmentWindowOutcomes.find((w) => w.window === '2d');
                const n = (w1?.total ?? 0) + (w2?.total ?? 0);
                const cure =
                  (w1?.total ?? 0) * (w1?.cure_rate ?? 0) + (w2?.total ?? 0) * (w2?.cure_rate ?? 0);
                const rate = n > 0 ? cure / n : null;
                const noAntivir = treatmentWindowOutcomes.find((w) => w.window === 's/ antiviral');
                const tone =
                  rate == null
                    ? '#475569'
                    : rate >= 80
                      ? '#16a34a'
                      : rate >= 60
                        ? '#d97706'
                        : '#dc2626';
                return (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: tone, lineHeight: 1.1 }}>
                      {rate == null ? '—' : `${rate.toFixed(0)}`}
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                        %
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      vs {noAntivir?.cure_rate.toFixed(0) ?? '—'}% sem antiviral
                    </div>
                  </div>
                );
              })()}
            </div>

            <div
              style={{
                background: 'var(--bg-status)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.85rem',
                minHeight: '88px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div className="meta" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                Óbito se &gt; 5d
              </div>
              {(() => {
                const w = treatmentWindowOutcomes.find((x) => x.window === '> 5d');
                const rate = w && w.total > 0 ? w.death_rate : null;
                const tone =
                  rate == null
                    ? '#475569'
                    : rate >= 25
                      ? '#dc2626'
                      : rate >= 15
                        ? '#d97706'
                        : '#16a34a';
                return (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: tone, lineHeight: 1.1 }}>
                      {rate == null ? '—' : `${rate.toFixed(0)}`}
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                        %
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      tratamento tardio
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div
            className="layout-grid responsive-grid-split"
            style={{
              marginTop: '1.25rem',
            }}
          >
            {/* Left KDE Chart */}
            <div
              className="card-box"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '12px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Oportunidade terapêutica</span>
                <span className="rank-tooltip-wrapper">
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
                  <div
                    className="rank-tooltip-content"
                    style={{ width: '320px', left: '0%', transform: 'none' }}
                  >
                    Distribuição temporal entre início de sintomas e início do antiviral, por
                    fármaco:
                    <br />
                    <br />• <b>Densidade por fármaco (KDE normalizada):</b> cada curva representa um
                    antiviral; o pico indica a latência mais frequente e a largura da cauda revela
                    variabilidade operacional.
                    <br />
                    <br />• <b>Meta 2 dias (linha tracejada vermelha):</b> limite considerado
                    oportuno. Picos à esquerda da meta indicam entrega oportuna; picos à direita e
                    caudas longas sinalizam atraso sistêmico e perda de janela terapêutica.
                  </div>
                </span>
              </div>
              <div
                className="chart-wrap"
                style={{ minHeight: '420px', height: '420px', width: '100%' }}
              >
                {latencyPerDrug.length > 0 ? (
                  <TherapeuticKdeChart
                    data={latencyPerDrug.map((d) => ({
                      drug: d.drug,
                      samples: d.latency_samples,
                      count: d.count,
                      specifications: d.specifications,
                    }))}
                    domain={[0, 15]}
                    unit="d"
                    referenceLine={2}
                    referenceLabel="meta 2d"
                    xLabel="Dias (sintomas → antiviral)"
                  />
                ) : (
                  <p className="meta" style={{ textAlign: 'center', padding: '2rem' }}>
                    Aguardando dados de latência por antiviral...
                  </p>
                )}
              </div>
            </div>

            {/* Right column stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Slopegraph */}
              <div
                className="card-box"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    marginBottom: '8px',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Impacto clínico do antiviral</span>
                  <span className="rank-tooltip-wrapper">
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
                    <div
                      className="rank-tooltip-content"
                      style={{ width: '320px', left: '0%', transform: 'none' }}
                    >
                      Evolução das taxas de desfecho por janela de tempo entre sintomas e antiviral:
                      <br />
                      <br />• <b>Cura (linha verde) e Óbito (linha vermelha):</b> proporções por
                      janela terapêutica. Declínio da cura e elevação do óbito nas janelas tardias
                      evidenciam perda de efetividade com o atraso.
                      <br />
                      <br />• <b>Margem cura−óbito (tracejada petróleo com área):</b> benefício
                      líquido. Estreitamento ou inversão sinaliza janela onde o efeito clínico se
                      atenua e orienta antecipação na atenção primária.
                    </div>
                  </span>
                </div>
                <div
                  className="chart-wrap"
                  style={{ minHeight: '200px', height: '200px', width: '100%' }}
                >
                  {treatmentWindowOutcomes.length > 0 ? (
                    <AntiviralOutcomeSlopegraph data={treatmentWindowOutcomes} />
                  ) : (
                    <p className="meta" style={{ textAlign: 'center', padding: '2rem' }}>
                      Aguardando dados de desfecho por janela...
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom row side-by-side */}
              <div
                className="responsive-grid-2col"
                style={{
                  width: '100%',
                }}
              >
                {/* Donut Chart Box */}
                <div
                  className="card-box"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '160px',
                    height: 'auto',
                  }}
                >
                  <div
                    className="meta"
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      marginBottom: '2px',
                      letterSpacing: '0.05em',
                      color: 'var(--text-main)',
                    }}
                  >
                    Distribuição de Fármacos
                  </div>
                  <div
                    className="chart-wrap"
                    style={{ minHeight: '130px', height: 'auto', width: '100%' }}
                  >
                    <AntiviralDonutChart data={antiviralTypes} />
                  </div>
                </div>

                {/* Progress Bars Box */}
                <div
                  className="card-box"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '160px',
                    height: 'auto',
                  }}
                >
                  <div
                    className="meta"
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      marginBottom: '2px',
                      letterSpacing: '0.05em',
                      color: 'var(--text-main)',
                    }}
                  >
                    Casos por Janela
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      justifyContent: 'center',
                      height: '120px',
                    }}
                  >
                    {(() => {
                      const treatedWindows = treatmentWindowOutcomes.filter(
                        (w) => w.window !== 's/ antiviral',
                      );
                      const totalAll = treatedWindows.reduce((s, x) => s + x.total, 0) || 1;
                      return treatedWindows.map((w, i) => {
                        const pct = (w.total / totalAll) * 100;
                        const palette = ['#16a34a', '#0284c7', '#ca8a04', '#dc2626'];
                        const color = palette[i] || '#94a3b8';
                        return (
                          <div key={w.window}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '10px',
                                marginBottom: '3px',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{w.window}</span>
                              <span style={{ color: '#64748b' }}>
                                {w.total} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                            <div
                              style={{
                                width: '100%',
                                height: '6px',
                                background: 'var(--border-subtle)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: '100%',
                                  background: color,
                                  transition: 'width 0.3s',
                                }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="vigilance-block" style={{ marginTop: '2rem' }}>
        <article className="panel">
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <h3
                style={{
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Imagem e Gravidade</span>
                <span className="rank-tooltip-wrapper">
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
                  <div
                    className="rank-tooltip-content"
                    style={{ width: '320px', left: '0%', transform: 'none' }}
                  >
                    Relação entre achados de imagem e gravidade clínica, com escala compartilhada
                    entre Raio-X e Tomografia:
                    <br />
                    <br />• <b>UTI (eixo X) e Letalidade - CFR (eixo Y):</b> proporção de casos com
                    o achado que evoluíram para UTI e para óbito. Tamanho da bolha proporcional ao
                    volume de casos.
                    <br />
                    <br />• <b>Quadrantes e Alto Risco (área avermelhada superior direita):</b>{' '}
                    medianas tracejadas particionam o espaço; achados acima da mediana em ambos os
                    eixos concentram maior severidade. Quadrante inferior esquerdo associa-se a
                    menor risco. Maior dispersão vertical na tomografia indica melhor discriminação
                    de risco.
                  </div>
                </span>
              </h3>
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <div className="imaging-volcano-wrap">
              {lab?.imaging_by_severity ? (
                <ImagingVolcanoChart data={lab.imaging_by_severity} />
              ) : (
                <p className="meta" style={{ textAlign: 'center', padding: '2rem' }}>
                  Aguardando dados de imagem por gravidade...
                </p>
              )}
            </div>
          </div>
        </article>
      </section>
    </>
  );
};

export default LabPage;
