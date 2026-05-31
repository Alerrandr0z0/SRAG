import * as d3 from 'd3';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { COLORS } from '../../constants';
import { useThemeMode } from '../../hooks/useThemeMode';
import { AggregatedTimeline } from '../../types/epi';

type GripeStatus = 'protegido' | 'vencida' | 'nao_vacinado' | 'ignorado' | 'inconsistencia';

export interface EnrichedTimeline extends AggregatedTimeline {
  gripe_status?: GripeStatus;
  internP25: number;
  internP75: number;
  desfP25: number;
  desfP75: number;
  doseP25?: number | null;
  doseP75?: number | null;
  n: number;
  uti_pct: number;
}

type TooltipMetric = {
  label: string;
  value: string;
  color?: string;
};

type TooltipState = {
  x: number;
  y: number;
  title: string;
  badge: string;
  badgeColor: string;
  outcome: string;
  outcomeColor: string;
  chips: Array<{ label: string; value: string; color?: string }>;
  metrics: TooltipMetric[];
};

type MarkerKind = 'dose' | 'internacao' | 'cura' | 'obito' | 'presintoma' | 'bandaiqr';

const PERFIL_LABELS: Record<string, string> = {
  bivalente: 'Bivalente',
  reforco_2: '2º Reforço',
  reforco_1: '1º Reforço',
  completo: 'Esquema Completo',
  dose_1: 'Dose 1',
  nao_vacinado: 'Não Vacinado',
  ignorado: 'Ignorado',
};

const GRIPE_LABELS: Record<GripeStatus, string> = {
  protegido: 'Protegida',
  vencida: 'Vencida',
  nao_vacinado: 'Não vacinada',
  ignorado: 'Ignorado',
  inconsistencia: 'Inconsistente',
};

const MARKER_LEGEND: Array<{ kind: MarkerKind; label: string; hint?: string }> = [
  { kind: 'dose', label: 'Última dose' },
  { kind: 'internacao', label: 'Internação' },
  { kind: 'cura', label: 'Cura predominante' },
  { kind: 'obito', label: 'Óbito predominante' },
  { kind: 'presintoma', label: 'Pré-sintoma' },
  { kind: 'bandaiqr', label: 'Banda IQR', hint: 'Faixa P25–P75' },
];

const GRIPE_LEGEND: Array<{ status: GripeStatus; label: string; hint: string }> = [
  { status: 'protegido', label: 'Protegida', hint: '≤365d da campanha' },
  { status: 'vencida', label: 'Vencida', hint: '>365d da campanha' },
  { status: 'nao_vacinado', label: 'Não vacinada', hint: 'Sem registro de vacinação' },
  { status: 'ignorado', label: 'Ignorado', hint: 'Dados não informados' },
  { status: 'inconsistencia', label: 'Inconsistente', hint: 'Dados conflitantes' },
];

const LEGEND_DIAMOND_PATH = d3.symbol().type(d3.symbolDiamond).size(92)() ?? undefined;
const LEGEND_STAR_PATH = d3.symbol().type(d3.symbolStar).size(120)() ?? undefined;
const LEGEND_CROSS_PATH = d3.symbol().type(d3.symbolCross).size(120)() ?? undefined;

const perfilLabel = (raw: string): string => PERFIL_LABELS[raw] ?? raw;

const getGripeColor = (status: GripeStatus | undefined): string => {
  switch (status) {
    case 'protegido':
      return '#0f766e';
    case 'vencida':
      return '#d97706';
    case 'nao_vacinado':
      return '#dc2626';
    case 'inconsistencia':
      return '#7c3aed';
    default:
      return '#94a3b8';
  }
};

const getGripeLabel = (status: GripeStatus | undefined): string =>
  (status && GRIPE_LABELS[status]) || GRIPE_LABELS.ignorado;

const getUtiColor = (pct: number): string => {
  if (pct >= 40) return '#dc2626';
  if (pct >= 30) return '#d97706';
  return '#64748b';
};

const isObito = (d: AggregatedTimeline) => d.taxa_obito > d.taxa_cura;

const formatDays = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.abs(value).toFixed(0)}d`;
};

const formatBeforeSymptoms = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.abs(value).toFixed(0)}d antes`;
};

const formatRange = (start: number | null | undefined, end: number | null | undefined): string => {
  if (start == null || end == null || Number.isNaN(start) || Number.isNaN(end)) return '—';
  const [a, b] = [start, end].sort((left, right) => left - right);
  return `IQR ${a.toFixed(0)}–${b.toFixed(0)}d`;
};

const formatPct = (value: number): string => `${(value * 100).toFixed(0)}%`;

const SwimmerLegendIcon: React.FC<{ kind: MarkerKind }> = ({ kind }) => {
  switch (kind) {
    case 'dose':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" fill="#64748b" stroke="white" strokeWidth="1.5" />
        </svg>
      );
    case 'internacao':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <g transform="translate(12 12)">
            <path d={LEGEND_DIAMOND_PATH} fill="#475569" stroke="white" strokeWidth="1.5" />
          </g>
        </svg>
      );
    case 'cura':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <g transform="translate(12 12)">
            <path d={LEGEND_STAR_PATH} fill={COLORS.SUCCESS} stroke="white" strokeWidth="1.2" />
          </g>
        </svg>
      );
    case 'obito':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <g transform="translate(12 12)">
            <path
              d={LEGEND_CROSS_PATH}
              transform="rotate(45)"
              fill={COLORS.DANGER}
              stroke="white"
              strokeWidth="1.2"
            />
          </g>
        </svg>
      );
    case 'presintoma':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <line
            x1="3"
            y1="12"
            x2="21"
            y2="12"
            stroke="#94a3b8"
            strokeWidth="2.5"
            strokeDasharray="4 2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'bandaiqr':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="3"
            y="7"
            width="18"
            height="10"
            rx="2"
            fill="#0f766e"
            fillOpacity="0.15"
            stroke="#0f766e"
            strokeOpacity="0.3"
          />
        </svg>
      );
  }
};

interface AggregatedSwimmerPlotProps {
  data: EnrichedTimeline[];
  swimmerVirus?: 'covid' | 'gripe';
}

const AggregatedSwimmerPlot: React.FC<AggregatedSwimmerPlotProps> = ({
  data,
  swimmerVirus = 'gripe',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const theme = useThemeMode();

  const themeColors = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      bg: isDark ? '#1e293b' : '#ffffff',
      panel: isDark ? '#0f172a' : '#f8fafc',
      border: isDark ? '#334155' : '#e2e8f0',
      text: isDark ? '#94a3b8' : '#64748b',
      main: isDark ? '#f8fafc' : '#0f172a',
      muted: isDark ? '#475569' : '#cbd5e1',
      contrast: isDark ? '#0f172a' : '#ffffff',
      rowHover: isDark ? '#334155' : '#f1f5f9',
      doseLine: isDark ? '#475569' : '#e2e8f0',
      timelineBgPre: isDark ? '#0f172a' : '#f8fafc',
      timelineBgPost: isDark ? '#1e293b' : '#fffbf5',
    };
  }, [theme]);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const colorByKey = Object.fromEntries(
      data.map((d) => [d.perfil, getGripeColor(d.gripe_status)]),
    ) as Record<string, string>;

    const sorted = [...data].sort((a, b) => {
      const aT = (a.mediana_sintoma_internacao ?? 0) + (a.mediana_internacao_desfecho ?? 0);
      const bT = (b.mediana_sintoma_internacao ?? 0) + (b.mediana_internacao_desfecho ?? 0);
      return aT - bT;
    });
    const nMax = d3.max(sorted, (d) => d.n) ?? 1;
    const strokeW = (d: EnrichedTimeline) => 1.5 + (d.n / nMax) * 4.5;

    const totalWidth = svgRef.current.clientWidth || 900;
    const leftMargin = totalWidth < 600 ? 140 : 250;
    const MARGIN = { top: 76, right: 96, bottom: 76, left: leftMargin };
    const ROW_H = 68;
    const INLINE_W = 52;
    const CW = Math.max(280, totalWidth - MARGIN.left - MARGIN.right);
    const CH = sorted.length * ROW_H;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', CH + MARGIN.top + MARGIN.bottom);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const xMin =
      d3.min(sorted, (d) => Math.min(d.mediana_dose_sintoma ?? 0, d.doseP25 ?? 0)) ?? -180;
    const xMax =
      d3.max(sorted, (d) => {
        const base = (d.mediana_sintoma_internacao ?? 0) + (d.mediana_internacao_desfecho ?? 0);
        return base + (d.desfP75 ?? 0);
      }) ?? 60;

    const xScale = d3
      .scaleLinear()
      .domain([xMin - 25, xMax + 40])
      .range([0, CW]);
    const yScale = d3
      .scaleBand()
      .domain(sorted.map((d) => d.perfil))
      .range([0, CH])
      .padding(0.34);

    // Background rectangles
    g.append('rect')
      .attr('x', 0)
      .attr('y', -MARGIN.top)
      .attr('width', xScale(0))
      .attr('height', CH + MARGIN.top)
      .attr('fill', themeColors.timelineBgPre)
      .attr('opacity', 0.75);

    g.append('rect')
      .attr('x', xScale(0))
      .attr('y', -MARGIN.top)
      .attr('width', CW - xScale(0))
      .attr('height', CH + MARGIN.top)
      .attr('fill', themeColors.timelineBgPost)
      .attr('opacity', 0.75);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', -MARGIN.top)
      .attr('y2', CH)
      .attr('stroke', themeColors.border)
      .attr('stroke-width', 1);

    const headerY = -MARGIN.top + 10;
    const t0TextY = headerY + 16;
    const t0LineY = t0TextY + 8;

    g.append('text')
      .attr('x', 0)
      .attr('y', headerY)
      .attr('text-anchor', 'start')
      .attr('font-size', '9px')
      .attr('font-weight', '700')
      .attr('letter-spacing', '.08em')
      .attr('fill', themeColors.text)
      .text('HISTÓRICO VACINAL');

    g.append('text')
      .attr('x', CW)
      .attr('y', headerY)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('font-weight', '700')
      .attr('letter-spacing', '.08em')
      .attr('fill', themeColors.text)
      .text('EVOLUÇÃO CLÍNICA');

    g.append('text')
      .attr('x', xScale(0))
      .attr('y', t0TextY)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('fill', themeColors.main)
      .text('T0 — INÍCIO DOS SINTOMAS');

    g.append('line')
      .attr('x1', xScale(0))
      .attr('x2', xScale(0))
      .attr('y1', t0LineY)
      .attr('y2', CH)
      .attr('stroke', themeColors.text)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,3');

    g.append('g')
      .attr('transform', `translate(0, ${CH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(8)
          .tickSize(-CH)
          .tickFormat(() => ''),
      )
      .call((gg) => gg.select('.domain').remove())
      .call((gg) =>
        gg
          .selectAll('.tick line')
          .attr('stroke', themeColors.border)
          .attr('stroke-dasharray', '3,3'),
      );

    g.append('g')
      .attr('transform', `translate(0, ${CH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(8)
          .tickFormat((d) => `${+d}d`),
      )
      .call((gg) => gg.select('.domain').attr('stroke', themeColors.border))
      .call((gg) => gg.selectAll('.tick line').attr('stroke', themeColors.border))
      .call((gg) => gg.selectAll('text').attr('fill', themeColors.text).attr('font-size', '10px'));

    const updateTooltip = (event: PointerEvent, d: EnrichedTimeline, color: string) => {
      const container = chartWrapRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const width = 320;
      const height = 240;
      setTooltip({
        x: Math.max(
          12,
          Math.min(event.clientX - rect.left + 16, Math.max(12, rect.width - width - 12)),
        ),
        y: Math.max(
          12,
          Math.min(event.clientY - rect.top - 18, Math.max(12, rect.height - height - 12)),
        ),
        title: perfilLabel(d.perfil),
        badge: getGripeLabel(d.gripe_status),
        badgeColor: color,
        outcome: isObito(d) ? 'Óbito predominante' : 'Cura predominante',
        outcomeColor: isObito(d) ? COLORS.DANGER : COLORS.SUCCESS,
        chips: [
          { label: 'N', value: d.n.toLocaleString('pt-BR') },
          { label: 'UTI', value: `${d.uti_pct}%`, color: getUtiColor(d.uti_pct) },
        ],
        metrics: [
          { label: 'Última dose', value: formatBeforeSymptoms(d.mediana_dose_sintoma) },
          {
            label: 'Sintomas → internação',
            value: `${formatDays(d.mediana_sintoma_internacao)} · ${formatRange(d.internP25, d.internP75)}`,
          },
          {
            label: 'Internação → desfecho',
            value: `${formatDays(d.mediana_internacao_desfecho)} · ${formatRange(d.desfP25, d.desfP75)}`,
          },
          { label: 'Cura', value: formatPct(d.taxa_cura), color: COLORS.SUCCESS },
          { label: 'Óbito', value: formatPct(d.taxa_obito), color: COLORS.DANGER },
        ],
      });
    };

    sorted.forEach((raw) => {
      const d = raw as EnrichedTimeline;
      const cy = yScale(d.perfil)! + yScale.bandwidth() / 2;
      const color = colorByKey[d.perfil] ?? '#94a3b8';
      const sw = strokeW(d);
      const bandH = yScale.bandwidth() * 0.42;

      const doseX = d.mediana_dose_sintoma != null ? xScale(d.mediana_dose_sintoma) : null;
      const doseP25X = d.doseP25 != null ? xScale(d.doseP25) : null;
      const internX = xScale(d.mediana_sintoma_internacao ?? 0);
      const internP75X = xScale(d.internP75 ?? 0);
      const desfX = xScale(
        (d.mediana_sintoma_internacao ?? 0) + (d.mediana_internacao_desfecho ?? 0),
      );
      const desfP75X = xScale((d.mediana_sintoma_internacao ?? 0) + (d.desfP75 ?? 0));

      const row = g.append('g').datum(d).attr('class', 'cohort').style('cursor', 'pointer');

      row
        .append('rect')
        .attr('class', 'row-hover-bg')
        .attr('x', -MARGIN.left + 4)
        .attr('y', cy - yScale.bandwidth() / 2 - 8)
        .attr('width', CW + MARGIN.left + MARGIN.right - 8)
        .attr('height', yScale.bandwidth() + 16)
        .attr('rx', 12)
        .attr('fill', themeColors.bg)
        .attr('stroke', themeColors.border)
        .attr('opacity', 0);

      row
        .append('text')
        .attr('x', -MARGIN.left + 12)
        .attr('y', cy - 4)
        .attr('font-size', totalWidth < 600 ? '11px' : '13px')
        .attr('font-weight', '700')
        .attr('fill', themeColors.main)
        .text(perfilLabel(d.perfil));

      const sub = row
        .append('text')
        .attr('x', -MARGIN.left + 12)
        .attr('y', cy + 10)
        .attr('font-size', totalWidth < 600 ? '9px' : '10px')
        .attr('fill', themeColors.text)
        .style('font-variant-numeric', 'tabular-nums');

      sub.append('tspan').text(`N=${d.n.toLocaleString('pt-BR')} · `);
      sub
        .append('tspan')
        .attr('fill', getUtiColor(d.uti_pct))
        .attr('font-weight', '700')
        .text(`UTI ${d.uti_pct}%`);

      if (doseP25X != null) {
        row
          .append('rect')
          .attr('x', doseP25X)
          .attr('y', cy - bandH / 2)
          .attr('width', xScale(0) - doseP25X)
          .attr('height', bandH)
          .attr('fill', color)
          .attr('opacity', 0.1)
          .attr('rx', 2);
      }
      row
        .append('rect')
        .attr('x', xScale(0))
        .attr('y', cy - bandH / 2)
        .attr('width', internP75X - xScale(0))
        .attr('height', bandH)
        .attr('fill', color)
        .attr('opacity', 0.15)
        .attr('rx', 2);
      row
        .append('rect')
        .attr('x', internX)
        .attr('y', cy - bandH / 2)
        .attr('width', desfP75X - internX)
        .attr('height', bandH)
        .attr('fill', color)
        .attr('opacity', 0.2)
        .attr('rx', 2);

      if (doseX != null) {
        row
          .append('line')
          .attr('x1', doseX)
          .attr('x2', xScale(0))
          .attr('y1', cy)
          .attr('y2', cy)
          .attr('stroke', color)
          .attr('stroke-width', sw * 0.55)
          .attr('stroke-dasharray', '5,3')
          .attr('opacity', 0.6);
        row
          .append('circle')
          .attr('cx', doseX)
          .attr('cy', cy)
          .attr('r', 4.5)
          .attr('fill', color)
          .attr('stroke', themeColors.bg)
          .attr('stroke-width', 1.5);
      }
      row
        .append('line')
        .attr('x1', xScale(0))
        .attr('x2', internX)
        .attr('y1', cy)
        .attr('y2', cy)
        .attr('stroke', color)
        .attr('stroke-width', sw);
      row
        .append('line')
        .attr('x1', internX)
        .attr('x2', desfX)
        .attr('y1', cy)
        .attr('y2', cy)
        .attr('stroke', color)
        .attr('stroke-width', sw * 1.6);
      row
        .append('path')
        .attr('d', d3.symbol().type(d3.symbolDiamond).size(90)())
        .attr('transform', `translate(${internX}, ${cy})`)
        .attr('fill', themeColors.text)
        .attr('stroke', themeColors.bg)
        .attr('stroke-width', 1.5);

      if (!isObito(d)) {
        row
          .append('path')
          .attr('d', d3.symbol().type(d3.symbolStar).size(160)())
          .attr('transform', `translate(${desfX}, ${cy})`)
          .attr('fill', COLORS.SUCCESS)
          .attr('stroke', themeColors.bg)
          .attr('stroke-width', 1.5);
      } else {
        row
          .append('path')
          .attr('d', d3.symbol().type(d3.symbolCross).size(140)())
          .attr('transform', `translate(${desfX}, ${cy}) rotate(45)`)
          .attr('fill', COLORS.DANGER)
          .attr('stroke', themeColors.bg)
          .attr('stroke-width', 1.5);
      }

      const barX = Math.min(desfX + 14, CW - INLINE_W - 28);
      row
        .append('rect')
        .attr('x', barX)
        .attr('y', cy - 6)
        .attr('width', INLINE_W * d.taxa_cura)
        .attr('height', 12)
        .attr('fill', COLORS.SUCCESS)
        .attr('rx', 2);
      row
        .append('rect')
        .attr('x', barX + INLINE_W * d.taxa_cura)
        .attr('y', cy - 6)
        .attr('width', INLINE_W * d.taxa_obito)
        .attr('height', 12)
        .attr('fill', COLORS.DANGER)
        .attr('rx', 0);

      const pct = isObito(d) ? d.taxa_obito : d.taxa_cura;
      row
        .append('text')
        .attr('x', Math.min(barX + INLINE_W + 6, CW - 4))
        .attr('y', cy + 4)
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('fill', isObito(d) ? COLORS.DANGER : COLORS.SUCCESS)
        .text(`${(pct * 100).toFixed(0)}%`);

      row
        .on('pointerenter', (event: PointerEvent) => {
          row.raise();
          g.selectAll('g.cohort').attr('opacity', (subD) => (subD === d ? 1 : 0.18));
          row.select('rect.row-hover-bg').attr('opacity', 0.85);
          updateTooltip(event, d, color);
        })
        .on('pointermove', (event: PointerEvent) => updateTooltip(event, d, color))
        .on('pointerleave', () => {
          g.selectAll('g.cohort').attr('opacity', 1);
          row.select('rect.row-hover-bg').attr('opacity', 0);
          setTooltip(null);
        });
    });
  }, [data, themeColors]);

  const hasData = data.length > 0;

  return (
    <div
      style={{
        background: themeColors.bg,
        borderRadius: '12px',
        padding: '8px 0',
        boxShadow: 'var(--shadow-panel)',
        border: `1px solid ${themeColors.border}`,
      }}
    >
      {hasData ? (
        <div
          ref={chartWrapRef}
          style={{ position: 'relative', padding: '0 clamp(12px, 3vw, 24px)' }}
        >
          <svg ref={svgRef} style={{ width: '100%', display: 'block', overflow: 'visible' }} />
          {tooltip && (
            <div
              style={{
                position: 'absolute',
                zIndex: 20,
                minWidth: '260px',
                maxWidth: '330px',
                background: themeColors.bg,
                border: `1px solid ${themeColors.border}`,
                borderRadius: '12px',
                padding: '12px 14px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
                pointerEvents: 'none',
                left: tooltip.x,
                top: tooltip.y,
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: themeColors.main }}>
                {tooltip.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '999px',
                    padding: '3px 8px',
                    border: '1px solid',
                    borderColor: tooltip.badgeColor,
                    color: tooltip.badgeColor,
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  {tooltip.badge}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '999px',
                    padding: '3px 8px',
                    border: '1px solid',
                    borderColor: tooltip.outcomeColor,
                    color: tooltip.outcomeColor,
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  {tooltip.outcome}
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '4px 12px',
                  alignItems: 'baseline',
                  marginTop: '10px',
                }}
              >
                {tooltip.metrics.map((metric) => (
                  <React.Fragment key={metric.label}>
                    <span style={{ fontSize: '10px', color: themeColors.text }}>
                      {metric.label}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: metric.color ?? themeColors.main,
                        textAlign: 'right',
                      }}
                    >
                      {metric.value}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            margin: '0 clamp(12px, 3vw, 24px) 16px',
            padding: '28px 16px',
            textAlign: 'center',
            color: themeColors.text,
            fontSize: '13px',
            background: themeColors.panel,
            border: `1px dashed ${themeColors.muted}`,
            borderRadius: '12px',
          }}
        >
          Sem coortes para exibir.
        </div>
      )}

      {hasData && (
        <div style={{ padding: '12px clamp(12px, 3vw, 24px) 18px', display: 'grid', gap: '12px' }}>
          <div
            style={{
              background: themeColors.panel,
              border: `1px solid ${themeColors.border}`,
              borderRadius: '14px',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                marginBottom: '10px',
                fontSize: '11px',
                fontWeight: 700,
                color: themeColors.text,
                textTransform: 'uppercase',
              }}
            >
              Marcadores
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '8px',
              }}
            >
              {MARKER_LEGEND.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    border: `1px solid ${themeColors.border}`,
                    borderRadius: '10px',
                    background: themeColors.bg,
                  }}
                >
                  <SwimmerLegendIcon kind={item.kind} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: themeColors.main }}>
                      {item.label}
                    </div>
                    {item.hint && (
                      <div style={{ fontSize: '10px', color: themeColors.text }}>{item.hint}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {swimmerVirus === 'gripe' && (
            <div
              style={{
                background: themeColors.panel,
                border: `1px solid ${themeColors.border}`,
                borderRadius: '14px',
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  marginBottom: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: themeColors.text,
                  textTransform: 'uppercase',
                }}
              >
                Status vacinal da gripe
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '8px',
                }}
              >
                {GRIPE_LEGEND.map((item) => (
                  <div
                    key={item.status}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      border: `1px solid ${themeColors.border}`,
                      borderRadius: '10px',
                      background: themeColors.bg,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 28,
                        height: 3,
                        borderRadius: 999,
                        background: getGripeColor(item.status),
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: themeColors.main }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '10px', color: themeColors.text }}>{item.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AggregatedSwimmerPlot;
