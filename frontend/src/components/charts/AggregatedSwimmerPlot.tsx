import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { AggregatedTimeline } from '../../types/epi';
import { COLORS } from '../../constants';

type GripeStatus = 'protegido' | 'vencida' | 'nao_vacinado' | 'ignorado';

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
};

const MARKER_LEGEND: Array<{ kind: MarkerKind; label: string; hint: string }> = [
  { kind: 'dose', label: 'Última dose', hint: 'Círculo' },
  { kind: 'internacao', label: 'Internação', hint: 'Losango' },
  { kind: 'cura', label: 'Cura predominante', hint: 'Estrela' },
  { kind: 'obito', label: 'Óbito predominante', hint: 'X' },
  { kind: 'presintoma', label: 'Pré-sintoma', hint: 'Traço pontilhado' },
  { kind: 'bandaiqr', label: 'Banda IQR', hint: 'Faixa P25–P75' },
];

const GRIPE_LEGEND: Array<{ status: GripeStatus; label: string; hint: string }> = [
  { status: 'protegido', label: 'Protegida', hint: '≤365d da campanha' },
  { status: 'vencida', label: 'Vencida', hint: '>365d da campanha' },
  { status: 'nao_vacinado', label: 'Não vacinada', hint: 'Sem vacina' },
  { status: 'ignorado', label: 'Ignorado', hint: 'Sem classificação' },
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

const legendCardStyle: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '12px 14px',
};

const legendTitleStyle: React.CSSProperties = {
  marginBottom: '10px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#64748b',
};

const legendGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '10px',
};

const legendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  background: '#fff',
};

const legendItemTextStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const legendItemLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.2,
  color: '#0f172a',
};

const legendItemHintStyle: React.CSSProperties = {
  fontSize: '10px',
  lineHeight: 1.2,
  color: '#64748b',
};

const tooltipStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  minWidth: '260px',
  maxWidth: '330px',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '12px 14px',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
  pointerEvents: 'none',
};

const chipBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  borderRadius: '999px',
  padding: '3px 8px',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '.04em',
  color: '#334155',
};

const titleStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#0f172a',
};

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
            <path d={LEGEND_CROSS_PATH} transform="rotate(45)" fill={COLORS.DANGER} stroke="white" strokeWidth="1.2" />
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
          <rect x="3" y="7" width="18" height="10" rx="2" fill="#0f766e" fillOpacity="0.15" stroke="#0f766e" strokeOpacity="0.3" />
        </svg>
      );
  }
};

const LegendItem: React.FC<{ icon: React.ReactNode; label: string; hint: string }> = ({
  icon,
  label,
  hint,
}) => (
  <div style={legendItemStyle}>
    <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div style={legendItemTextStyle}>
      <div style={legendItemLabelStyle}>{label}</div>
      <div style={legendItemHintStyle}>{hint}</div>
    </div>
  </div>
);

interface AggregatedSwimmerPlotProps {
  data: EnrichedTimeline[];
  debug?: boolean;
}

const AggregatedSwimmerPlot: React.FC<AggregatedSwimmerPlotProps> = ({ data, debug = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const debugRef = useRef(debug);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  useEffect(() => {
    if (!svgRef.current || !data.length) {
      return;
    }

    if (debugRef.current && import.meta.env.DEV) {
      // Mostra os dados principais para inspecionar outliers e quebras visuais.
      console.table(
        data.map(d => ({
          perfil: perfilLabel(d.perfil),
          gripe_status: d.gripe_status ?? 'ignorado',
          n: d.n,
          uti_pct: d.uti_pct,
          dose: d.mediana_dose_sintoma,
          internacao: d.mediana_sintoma_internacao,
          desfecho: d.mediana_internacao_desfecho,
          cura: d.taxa_cura,
          obito: d.taxa_obito,
        })),
      );
    }

    const colorByKey = Object.fromEntries(
      data.map(d => [d.perfil, getGripeColor(d.gripe_status)]),
    ) as Record<string, string>;

    const sorted = [...data].sort((a, b) => {
      const aOb = isObito(a) ? 1 : 0;
      const bOb = isObito(b) ? 1 : 0;
      if (bOb !== aOb) return bOb - aOb;
      const aT = (a.mediana_sintoma_internacao ?? 0) + (a.mediana_internacao_desfecho ?? 0);
      const bT = (b.mediana_sintoma_internacao ?? 0) + (b.mediana_internacao_desfecho ?? 0);
      return aT - bT;
    });

    const dividerIdx = sorted.findIndex(d => !isObito(d));
    const nMax = d3.max(sorted, d => d.n) ?? 1;
    const strokeW = (d: EnrichedTimeline) => 1.5 + (d.n / nMax) * 4.5;

    const MARGIN = { top: 76, right: 96, bottom: 76, left: 250 };
    const ROW_H = 68;
    const INLINE_W = 52;
    const totalWidth = svgRef.current.clientWidth || 900;
    const CW = Math.max(320, totalWidth - MARGIN.left - MARGIN.right);
    const CH = sorted.length * ROW_H;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', CH + MARGIN.top + MARGIN.bottom);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const xMin = d3.min(sorted, d => Math.min(d.mediana_dose_sintoma ?? 0, d.doseP25 ?? 0)) ?? -180;
    const xMax = d3.max(sorted, d => {
      const base = (d.mediana_sintoma_internacao ?? 0) + (d.mediana_internacao_desfecho ?? 0);
      return base + (d.desfP75 ?? 0);
    }) ?? 60;

    const xScale = d3.scaleLinear().domain([xMin - 25, xMax + 40]).range([0, CW]);
    const yScale = d3.scaleBand().domain(sorted.map(d => d.perfil)).range([0, CH]).padding(0.34);

    g.append('rect')
      .attr('x', 0)
      .attr('y', -MARGIN.top)
      .attr('width', xScale(0))
      .attr('height', CH + MARGIN.top)
      .attr('fill', '#f8fafc')
      .attr('opacity', 0.75);

    g.append('rect')
      .attr('x', xScale(0))
      .attr('y', -MARGIN.top)
      .attr('width', CW - xScale(0))
      .attr('height', CH + MARGIN.top)
      .attr('fill', '#fffbf5')
      .attr('opacity', 0.75);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', -MARGIN.top)
      .attr('y2', CH)
      .attr('stroke', '#e2e8f0')
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
      .attr('fill', '#94a3b8')
      .text('HISTÓRICO VACINAL');

    g.append('text')
      .attr('x', CW)
      .attr('y', headerY)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('font-weight', '700')
      .attr('letter-spacing', '.08em')
      .attr('fill', '#94a3b8')
      .text('EVOLUÇÃO CLÍNICA');

    g.append('text')
      .attr('x', xScale(0))
      .attr('y', t0TextY)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('fill', '#334155')
      .text('T0 — INÍCIO DOS SINTOMAS');

    g.append('line')
      .attr('x1', xScale(0))
      .attr('x2', xScale(0))
      .attr('y1', t0LineY)
      .attr('y2', CH)
      .attr('stroke', '#475569')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,3');

    g.append('g')
      .attr('transform', `translate(0, ${CH})`)
      .call(d3.axisBottom(xScale).ticks(8).tickSize(-CH).tickFormat(() => ''))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('.tick line').attr('stroke', '#e2e8f0').attr('stroke-dasharray', '3,3'));

    g.append('g')
      .attr('transform', `translate(0, ${CH})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat(d => `${+d}d`))
      .call(gg => gg.select('.domain').attr('stroke', '#e2e8f0'))
      .call(gg => gg.selectAll('.tick line').attr('stroke', '#e2e8f0'))
      .call(gg => gg.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px'));

    g.append('text')
      .attr('x', CW / 2)
      .attr('y', CH + 52)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#94a3b8')
      .text('Dias relativos ao início dos sintomas (T0 = 0)  ·  Mediana por coorte');

    const setFocus = (perfil: string | null) => {
      g.selectAll<SVGGElement, EnrichedTimeline>('g.cohort')
        .attr('opacity', d => (!perfil || d.perfil === perfil ? 1 : 0.18));

      g.selectAll<SVGRectElement, EnrichedTimeline>('rect.row-hover-bg')
        .attr('opacity', d => (!perfil || d.perfil === perfil ? 0.85 : 0));
    };

    const updateTooltip = (event: PointerEvent, d: EnrichedTimeline, color: string) => {
      const container = chartWrapRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const width = 320;
      const height = 240;
      const maxX = Math.max(12, rect.width - width - 12);
      const maxY = Math.max(12, rect.height - height - 12);

      setTooltip({
        x: Math.max(12, Math.min(event.clientX - rect.left + 16, maxX)),
        y: Math.max(12, Math.min(event.clientY - rect.top - 18, maxY)),
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
          { label: 'Sintomas → internação', value: `${formatDays(d.mediana_sintoma_internacao)} · ${formatRange(d.internP25, d.internP75)}` },
          { label: 'Internação → desfecho', value: `${formatDays(d.mediana_internacao_desfecho)} · ${formatRange(d.desfP25, d.desfP75)}` },
          { label: 'Cura', value: formatPct(d.taxa_cura), color: COLORS.SUCCESS },
          { label: 'Óbito', value: formatPct(d.taxa_obito), color: COLORS.DANGER },
        ],
      });
    };

    sorted.forEach(raw => {
      const d = raw as EnrichedTimeline;
      const cy = yScale(d.perfil)! + yScale.bandwidth() / 2;
      const color = colorByKey[d.perfil] ?? '#94a3b8';
      const sw = strokeW(d);
      const bandH = yScale.bandwidth() * 0.42;

      const doseX = d.mediana_dose_sintoma != null ? xScale(d.mediana_dose_sintoma) : null;
      const doseP25X = d.doseP25 != null ? xScale(d.doseP25) : null;
      const internX = xScale(d.mediana_sintoma_internacao ?? 0);
      const internP75X = xScale(d.internP75 ?? 0);
      const desfX = xScale((d.mediana_sintoma_internacao ?? 0) + (d.mediana_internacao_desfecho ?? 0));
      const desfP75X = xScale((d.mediana_sintoma_internacao ?? 0) + (d.desfP75 ?? 0));

      const row = g.append('g').datum(d).attr('class', 'cohort').style('cursor', 'pointer');

      row.append('rect')
        .attr('class', 'row-hover-bg')
        .attr('x', -MARGIN.left + 4)
        .attr('y', cy - yScale.bandwidth() / 2 - 8)
        .attr('width', CW + MARGIN.left + MARGIN.right - 8)
        .attr('height', yScale.bandwidth() + 16)
        .attr('rx', 12)
        .attr('fill', '#fff')
        .attr('stroke', '#cbd5e1')
        .attr('opacity', 0);

      const labelX = -MARGIN.left + 12;

      row.append('text')
        .attr('x', labelX)
        .attr('y', cy - 4)
        .attr('font-size', '13px')
        .attr('font-weight', '700')
        .attr('fill', '#0f172a')
        .text(perfilLabel(d.perfil));

      const sub = row.append('text')
        .attr('x', labelX)
        .attr('y', cy + 10)
        .attr('font-size', '10px')
        .attr('fill', '#94a3b8')
        .style('font-variant-numeric', 'tabular-nums');

      sub.append('tspan').text(`N=${d.n.toLocaleString('pt-BR')} · `);
      sub.append('tspan').attr('fill', getUtiColor(d.uti_pct)).attr('font-weight', '700').text(`UTI ${d.uti_pct}%`);

      if (doseP25X != null) {
        row.append('rect')
          .attr('x', doseP25X)
          .attr('y', cy - bandH / 2)
          .attr('width', xScale(0) - doseP25X)
          .attr('height', bandH)
          .attr('fill', color)
          .attr('opacity', 0.07)
          .attr('rx', 2);
      }

      row.append('rect')
        .attr('x', xScale(0))
        .attr('y', cy - bandH / 2)
        .attr('width', internP75X - xScale(0))
        .attr('height', bandH)
        .attr('fill', color)
        .attr('opacity', 0.1)
        .attr('rx', 2);

      row.append('rect')
        .attr('x', internX)
        .attr('y', cy - bandH / 2)
        .attr('width', desfP75X - internX)
        .attr('height', bandH)
        .attr('fill', color)
        .attr('opacity', 0.15)
        .attr('rx', 2);

      if (doseX != null) {
        row.append('line')
          .attr('x1', doseX)
          .attr('x2', xScale(0))
          .attr('y1', cy)
          .attr('y2', cy)
          .attr('stroke', color)
          .attr('stroke-width', sw * 0.55)
          .attr('stroke-dasharray', '5,3')
          .attr('opacity', 0.5);

        row.append('circle')
          .attr('cx', doseX)
          .attr('cy', cy)
          .attr('r', 4.5)
          .attr('fill', color)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5)
          .append('title')
          .text(`Última dose: ${Math.abs(d.mediana_dose_sintoma!)}d antes dos sintomas`);
      }

      row.append('line')
        .attr('x1', xScale(0))
        .attr('x2', internX)
        .attr('y1', cy)
        .attr('y2', cy)
        .attr('stroke', color)
        .attr('stroke-width', sw);

      row.append('line')
        .attr('x1', internX)
        .attr('x2', desfX)
        .attr('y1', cy)
        .attr('y2', cy)
        .attr('stroke', color)
        .attr('stroke-width', sw * 1.6);

      row.append('path')
        .attr('d', d3.symbol().type(d3.symbolDiamond).size(90)())
        .attr('transform', `translate(${internX}, ${cy})`)
        .attr('fill', '#475569')
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .append('title')
        .text(`Internação: mediana ${d.mediana_sintoma_internacao}d após sintomas (IQR ${d.internP25}–${d.internP75}d)`);

      const desfG = row.append('g').attr('transform', `translate(${desfX}, ${cy})`);

      if (!isObito(d)) {
        desfG.append('path')
          .attr('d', d3.symbol().type(d3.symbolStar).size(160)())
          .attr('fill', COLORS.SUCCESS)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5)
          .append('title')
          .text(`Cura: ${formatPct(d.taxa_cura)}  |  Óbito: ${formatPct(d.taxa_obito)}`);
      } else {
        desfG.append('path')
          .attr('d', d3.symbol().type(d3.symbolCross).size(140)())
          .attr('transform', 'rotate(45)')
          .attr('fill', COLORS.DANGER)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5)
          .append('title')
          .text(`Óbito: ${formatPct(d.taxa_obito)}  |  Cura: ${formatPct(d.taxa_cura)}`);
      }

      const barX = Math.min(desfX + 14, CW - INLINE_W - 28);
      const barY = cy - 6;
      const barH = 12;
      const curaW = INLINE_W * d.taxa_cura;
      const obitoW = INLINE_W * d.taxa_obito;

      row.append('rect')
        .attr('x', barX)
        .attr('y', barY)
        .attr('width', curaW)
        .attr('height', barH)
        .attr('fill', COLORS.SUCCESS)
        .attr('rx', 2);

      row.append('rect')
        .attr('x', barX + curaW)
        .attr('y', barY)
        .attr('width', obitoW)
        .attr('height', barH)
        .attr('fill', COLORS.DANGER)
        .attr('rx', 0);

      const pct = isObito(d) ? d.taxa_obito : d.taxa_cura;
      const pctColor = isObito(d) ? COLORS.DANGER : COLORS.SUCCESS;
      row.append('text')
        .attr('x', Math.min(barX + INLINE_W + 6, CW - 4))
        .attr('y', cy + 4)
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('fill', pctColor)
        .style('font-variant-numeric', 'tabular-nums')
        .text(`${(pct * 100).toFixed(0)}%`);

      row.on('pointerenter', (event: PointerEvent) => {
        row.raise();
        setFocus(d.perfil);
        updateTooltip(event, d, color);
      });

      row.on('pointermove', (event: PointerEvent) => {
        updateTooltip(event, d, color);
      });

      row.on('pointerleave', () => {
        setFocus(null);
        setTooltip(null);
      });
    });

    if (dividerIdx > 0) {
      const divY = yScale(sorted[dividerIdx].perfil)! - ROW_H * 0.12;

      g.append('line')
        .attr('x1', -MARGIN.left + 8)
        .attr('x2', CW + MARGIN.right - 8)
        .attr('y1', divY)
        .attr('y2', divY)
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4');

      g.append('text')
        .attr('x', -MARGIN.left + 8)
        .attr('y', yScale(sorted[0].perfil)! - 10)
        .attr('font-size', '9px')
        .attr('font-weight', '700')
        .attr('letter-spacing', '.06em')
        .attr('fill', COLORS.DANGER)
        .text('ÓBITO PREDOMINANTE');

      g.append('text')
        .attr('x', -MARGIN.left + 8)
        .attr('y', divY + 12)
        .attr('font-size', '9px')
        .attr('font-weight', '700')
        .attr('letter-spacing', '.06em')
        .attr('fill', COLORS.SUCCESS)
        .text('CURA PREDOMINANTE');
    }
  }, [data]);

  const hasData = data.length > 0;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '8px 0',
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}
    >
      <div style={{ padding: '16px 24px 4px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
          Mediana de tempo entre eventos por coorte vacinal. Passe o mouse sobre uma linha para ver os detalhes.
          {' '}<strong>Cor</strong> = status vacinal Influenza. <strong>Espessura</strong> = volume de casos (N).
          {' '}<strong>Banda</strong> = IQR (P25–P75). <strong>Barra</strong> = composição cura/óbito.
        </p>
      </div>

      {hasData ? (
        <div ref={chartWrapRef} style={{ position: 'relative', padding: '0 24px' }}>
          <svg ref={svgRef} style={{ width: '100%', display: 'block', overflow: 'visible' }} />

          {tooltip && (
            <div style={{ ...tooltipStyle, left: tooltip.x, top: tooltip.y }}>
              <div style={titleStyle}>{tooltip.title}</div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                <span style={{ ...chipBaseStyle, borderColor: tooltip.badgeColor, color: tooltip.badgeColor }}>
                  {tooltip.badge}
                </span>
                <span style={{ ...chipBaseStyle, borderColor: tooltip.outcomeColor, color: tooltip.outcomeColor }}>
                  {tooltip.outcome}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {tooltip.chips.map(chip => (
                  <span key={chip.label} style={{ ...chipBaseStyle, color: chip.color ?? '#334155' }}>
                    {chip.label}: {chip.value}
                  </span>
                ))}
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
                {tooltip.metrics.map(metric => (
                  <React.Fragment key={metric.label}>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{metric.label}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: metric.color ?? '#334155',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
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
        <div style={{ margin: '0 24px 16px', padding: '28px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
          Sem coortes para exibir.
        </div>
      )}

      {hasData && (
        <div style={{ padding: '12px 24px 18px', display: 'grid', gap: '12px' }}>
          <div style={legendCardStyle}>
            <div style={legendTitleStyle}>Marcadores</div>
            <div style={legendGridStyle}>
              {MARKER_LEGEND.map(item => (
                <LegendItem
                  key={item.label}
                  icon={<SwimmerLegendIcon kind={item.kind} />}
                  label={item.label}
                  hint={item.hint}
                />
              ))}
            </div>
          </div>

          <div style={legendCardStyle}>
            <div style={legendTitleStyle}>Status vacinal da gripe</div>
            <div style={legendGridStyle}>
              {GRIPE_LEGEND.map(item => (
                <LegendItem
                  key={item.status}
                  icon={
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
                  }
                  label={item.label}
                  hint={item.hint}
                />
              ))}
            </div>
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
              A cor da linha representa o status vacinal; a espessura, o volume de casos (N).
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AggregatedSwimmerPlot;
