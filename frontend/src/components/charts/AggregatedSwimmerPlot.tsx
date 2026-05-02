import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { AggregatedTimeline } from '../../types/epi';
import { COLORS } from '../../constants';

interface SwimmerPlotProps {
  data: AggregatedTimeline[];
  mode?: 'full' | 'simplified';
}

const getCohortLineColor = (d: AggregatedTimeline): string => {
  const p = d.status_key;
  if (p === 'nao_vacinado')                               return COLORS.DANGER;
  if (p === 'bivalente' || p === 'reforco_2')             return COLORS.PRIMARY;
  if (p === 'reforco_1' || p === 'completo' || p === 'protegido') return '#14b8a6';
  if (p === 'dose_1' || p === 'vencida')                  return COLORS.WARNING;
  return '#cbd5e1';
};

const isObito = (d: AggregatedTimeline) => d.taxa_obito > d.taxa_cura;

const AggregatedSwimmerPlot: React.FC<SwimmerPlotProps> = ({ data, mode = 'full' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.length) return;

    const friendlyLabels: Record<string, string> = {
      'bivalente': 'Bivalente', 'reforco_2': '2º Reforço', 'reforco_1': '1º Reforço',
      'completo': 'Esquema Completo', 'dose_1': 'Dose 1', 'nao_vacinado': 'Não Vacinado',
      'protegido': 'Gripe: Protegido', 'vencida': 'Gripe: Vencida', 'dose_unica': 'Gripe: Dose Única', 'dose_2': 'Gripe: Dose 2'
    };

    // ── 1. Preparação ─────────────────────────────────────────────────────
    const sorted = [...data].sort((a, b) => {
      if (mode === 'full') {
        const aObito = isObito(a) ? 1 : 0;
        const bObito = isObito(b) ? 1 : 0;
        if (bObito !== aObito) return bObito - aObito;
      }
      return (a.mediana_dose_sintoma ?? 0) - (b.mediana_dose_sintoma ?? 0);
    });

    // ── 2. Dimensões ──────────────────────────────────────────────────────
    const width = containerRef.current.clientWidth;
    const margin = { top: 80, right: 100, bottom: 100, left: 180 };
    const rowHeight = 64;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = sorted.length * rowHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', chartHeight + margin.top + margin.bottom);

    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // ── 3. Escalas ────────────────────────────────────────────────────────
    const xMin = -180;
    const xMax = mode === 'full' ? 60 : 10;

    const xScale = d3.scaleLinear()
      .domain([xMin - 10, xMax + 10])
      .range([0, chartWidth]);

    const yScale = d3.scaleBand()
      .domain(sorted.map(d => d.perfil))
      .range([0, chartHeight])
      .padding(0.5);

    // ── 4. Zonas de Fundo ─────────────────────────────────────────────────
    g.append('rect')
      .attr('x', xScale(xMin - 10))
      .attr('y', -20)
      .attr('width', xScale(0) - xScale(xMin - 10))
      .attr('height', chartHeight + 40)
      .attr('fill', '#f1f5f9')
      .attr('opacity', 0.4)
      .attr('rx', 4);

    if (mode === 'full') {
      g.append('rect')
        .attr('x', xScale(0))
        .attr('y', -20)
        .attr('width', xScale(xMax + 10) - xScale(0))
        .attr('height', chartHeight + 40)
        .attr('fill', '#fffbeb')
        .attr('opacity', 0.3)
        .attr('rx', 4);
    }

    const zoneLabel = (text: string, x: number, anchor: string) =>
      g.append('text')
        .attr('x', x)
        .attr('y', -45)
        .attr('text-anchor', anchor)
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .attr('letter-spacing', '0.1em')
        .attr('fill', '#64748b')
        .text(text);

    zoneLabel('◀ HISTÓRICO VACINAL', xScale(0) - 15, 'end');
    if (mode === 'full') zoneLabel('EVOLUÇÃO CLÍNICA ▶', xScale(0) + 15, 'start');

    // ── 5. Eixo X (Intervalo 15d no passado e 5d no futuro) ────────────────
    const ticksPast = d3.range(-180, 0, 15);
    const ticksFuture = d3.range(0, 65, 5);
    const customTicks = [...ticksPast, ...ticksFuture];

    const xAxis = g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale).tickValues(customTicks).tickFormat(d => `${+d}d`));

    xAxis.select('.domain').attr('stroke', '#cbd5e1');
    xAxis.selectAll('.tick line').attr('stroke', '#e2e8f0');
    xAxis.selectAll('text')
      .attr('fill', d => d === 0 ? '#1e293b' : '#64748b')
      .attr('font-weight', d => d === 0 ? '800' : 'normal')
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    // ── 6. Tooltip (Arredondado e Normalizado) ─────────────────────────────
    const tooltip = d3.select(tooltipRef.current);

    const showTooltip = (event: any, d: AggregatedTimeline) => {
      const label = friendlyLabels[d.perfil] || d.perfil;

      const vaxInfo = d.mediana_dose_sintoma
        ? `<li>Última dose: <b>${Math.abs(Math.round(d.mediana_dose_sintoma))} dias</b> antes</li>`
        : '<li>Sem registro de vacina</li>';

      const clinicalInfo = mode === 'full' ? `
        <li style="margin-top:5px; border-top:1px solid #eee; padding-top:5px;">Internação: <b>${Math.round(d.mediana_sintoma_internacao)} dias</b> após sintomas</li>
        <li>Desfecho Total: <b>T+${Math.round(d.mediana_sintoma_internacao + d.mediana_internacao_desfecho)} dias</b></li>
        <li>Taxa de ${isObito(d) ? 'Óbito' : 'Cura'}: <b>${(Math.max(d.taxa_cura, d.taxa_obito)*100).toFixed(0)}%</b></li>
      ` : '';

      tooltip
        .style('opacity', 1)
        .html(`
          <div style="font-weight:bold; color:#1e293b; margin-bottom:4px; font-size:13px;">${label}</div>
          <ul style="list-style:none; padding:0; margin:0; font-size:12px; color:#475569; line-height:1.6;">
            ${vaxInfo}
            ${clinicalInfo}
          </ul>
        `);

      const [mx, my] = d3.pointer(event, containerRef.current);
      tooltip.style('left', (mx + 20) + 'px').style('top', (my - 40) + 'px');
    };

    // ── 7. Renderização das Coortes ────────────────────────────────────────
    const cohorts = g.selectAll('.cohort')
      .data(sorted)
      .enter()
      .append('g')
      .attr('class', 'cohort')
      .attr('transform', d => `translate(0, ${yScale(d.perfil)! + yScale.bandwidth()/2})`)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
          d3.select(event.currentTarget).select('.bg-line').attr('opacity', 0.25);
          showTooltip(event, d);
      })
      .on('mousemove', (event) => {
          const [mx, my] = d3.pointer(event, containerRef.current);
          tooltip.style('left', (mx + 20) + 'px').style('top', (my - 40) + 'px');
      })
      .on('mouseout', (event) => {
          d3.select(event.currentTarget).select('.bg-line').attr('opacity', 0.1);
          tooltip.style('opacity', 0);
      });

    cohorts.append('line')
      .attr('class', 'bg-line')
      .attr('x1', d => xScale(d.mediana_dose_sintoma ?? 0))
      .attr('x2', d => xScale(mode === 'full' ? (d.mediana_sintoma_internacao + d.mediana_internacao_desfecho) : 0))
      .attr('stroke', d => getCohortLineColor(d))
      .attr('stroke-width', 16)
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.1);

    cohorts.append('line')
      .attr('x1', d => xScale(d.mediana_dose_sintoma ?? 0))
      .attr('x2', xScale(0))
      .attr('stroke', d => getCohortLineColor(d))
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2');

    if (mode === 'full') {
      cohorts.append('line')
        .attr('x1', xScale(0))
        .attr('x2', d => xScale(d.mediana_sintoma_internacao + d.mediana_internacao_desfecho))
        .attr('stroke', d => getCohortLineColor(d))
        .attr('stroke-width', 3);
    }

    cohorts.filter(d => d.mediana_dose_sintoma != null)
      .append('circle').attr('cx', d => xScale(d.mediana_dose_sintoma!)).attr('r', 5)
      .attr('fill', d => getCohortLineColor(d)).attr('stroke', '#fff').attr('stroke-width', 2);

    if (mode === 'full') {
      cohorts.append('path')
        .attr('d', d3.symbol().type(d3.symbolDiamond).size(80)())
        .attr('transform', d => `translate(${xScale(d.mediana_sintoma_internacao)}, 0)`)
        .attr('fill', '#475569').attr('stroke', '#fff').attr('stroke-width', 1.5);

      const desfecho = cohorts.append('g')
        .attr('transform', d => `translate(${xScale(d.mediana_sintoma_internacao + d.mediana_internacao_desfecho)}, 0)`);

      desfecho.append('path')
        .attr('d', d => d3.symbol().type(isObito(d) ? d3.symbolCross : d3.symbolStar).size(160)())
        .attr('transform', d => isObito(d) ? 'rotate(45)' : '')
        .attr('fill', d => isObito(d) ? COLORS.DANGER : COLORS.SUCCESS)
        .attr('stroke', '#fff').attr('stroke-width', 1.5);
    }

    g.append('g')
      .call(d3.axisLeft(yScale).tickFormat(d => friendlyLabels[d] || d))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('.tick line').remove())
      .call(gg => gg.selectAll('text').attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#334155'));

    g.append('line')
      .attr('x1', xScale(0)).attr('x2', xScale(0))
      .attr('y1', -10).attr('y2', chartHeight + 10)
      .attr('stroke', '#475569').attr('stroke-width', 2).attr('stroke-dasharray', '4,4');

  }, [data, mode]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative', paddingBottom: '20px' }}>
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          opacity: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          border: '1px solid #cbd5e1',
          padding: '12px',
          borderRadius: '8px',
          pointerEvents: 'none',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          zIndex: 1000,
          minWidth: '220px',
          transition: 'opacity 0.1s ease',
          fontFamily: "'IBM Plex Sans', sans-serif"
        }}
      />
      <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
    </div>
  );
};

export default AggregatedSwimmerPlot;
