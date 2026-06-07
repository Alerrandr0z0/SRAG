import * as d3 from 'd3';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThemeMode } from '../../hooks/useThemeMode';

export interface UnitDelayRecord {
  id_unidade: string;
  nome_fantasia: string;
  total: number;
  median_delay: number;
  avg_delay: number;
  delay_samples: number[];
}

interface DelayByUnitRidgelinePlotProps {
  data: UnitDelayRecord[] | null;
}

const WARN_THRESHOLD = 5;
const CRIT_THRESHOLD = 10;
const ACCEPTABLE_LIMIT = 7;

const getRidgeColor = (median: number): string => {
  if (median <= WARN_THRESHOLD) return '#0f766e';
  if (median <= CRIT_THRESHOLD) return '#d97706';
  return '#dc2626';
};

const getStatusLabel = (median: number): string => {
  if (median <= WARN_THRESHOLD) return 'Adequado';
  if (median <= CRIT_THRESHOLD) return 'Atenção';
  return 'Crítico';
};

const MIN_CASES = 5;

function kde(
  values: number[],
  thresholds: number[],
  bandwidth: number,
): { x: number; y: number }[] {
  const n = values.length;
  if (n === 0) return thresholds.map((x) => ({ x, y: 0 }));
  const invN = 1 / n;
  const invSqrt2PI = 1 / Math.sqrt(2 * Math.PI);
  return thresholds.map((x) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const u = (x - values[i]) / bandwidth;
      sum += Math.exp(-0.5 * u * u);
    }
    return { x, y: (sum * invN * invSqrt2PI) / bandwidth };
  });
}

const formatUnitName = (name: string | undefined, fallback: string, max = 32): string => {
  const v = name && name.trim().length > 0 ? name : fallback;
  return v.length > max ? `${v.substring(0, max - 1)}…` : v;
};

const DelayByUnitRidgelinePlot: React.FC<DelayByUnitRidgelinePlotProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    name: string;
    median: number;
    avg: number;
    total: number;
    p75: number;
    p90: number;
  } | null>(null);
  const [page, setPage] = useState(0);

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
      stripeEven: isDark ? '#1e293b' : '#ffffff',
      stripeOdd: isDark ? '#0f172a' : '#f8fafc',
    };
  }, [theme]);

  const pageCount = useMemo(() => {
    if (!data || data.length === 0) return 1;
    const valid = data.filter((d) => d.total >= MIN_CASES && d.delay_samples.length >= 2);
    const list = valid.length > 0 ? valid : data;
    return Math.max(1, Math.ceil(list.length / 8));
  }, [data]);

  useEffect(() => {
    if (page >= pageCount) {
      setPage(pageCount - 1);
    }
  }, [pageCount, page]);

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    try {
      const sortedAll = [...data].sort((a, b) => a.median_delay - b.median_delay);
      let validUnits = sortedAll.filter((d) => d.total >= MIN_CASES && d.delay_samples.length >= 2);
      if (validUnits.length === 0) {
        validUnits = sortedAll.filter((d) => d.delay_samples.length >= 1);
      }
      if (validUnits.length === 0) return;

      const maxGroups = 8;
      const totalPages = Math.max(1, Math.ceil(validUnits.length / maxGroups));
      const currentPage = Math.min(page, totalPages - 1);
      const pagedUnits = validUnits.slice(
        currentPage * maxGroups,
        Math.min(validUnits.length, (currentPage + 1) * maxGroups),
      );
      if (pagedUnits.length === 0) return;

      const xMax = 30;
      const numBins = 80;
      const xThresholds = d3.range(0, xMax + 0.01, xMax / numBins);

      interface RidgeGroup {
        key: string;
        label: string;
        median: number;
        avg: number;
        total: number;
        p75: number;
        p90: number;
        normDensity: { x: number; y: number }[];
      }

      const groups: RidgeGroup[] = pagedUnits.map((unit) => {
        const values = unit.delay_samples.slice();
        const sorted = [...values].sort(d3.ascending);
        const p75 = d3.quantile(sorted, 0.75) ?? 0;
        const p90 = d3.quantile(sorted, 0.9) ?? 0;
        const stddev = d3.deviation(values) ?? 1;
        const bandwidth = Math.max(0.9 * stddev * values.length ** -0.2, 0.5);
        const density = kde(values, xThresholds, bandwidth);
        const maxDensity = d3.max(density, (d) => d.y) || 0;
        const normDensity = density.map((pt) => ({
          x: pt.x,
          y: maxDensity > 0 ? pt.y / maxDensity : 0,
        }));
        return {
          key: unit.id_unidade,
          label: formatUnitName(unit.nome_fantasia, unit.id_unidade),
          median: unit.median_delay,
          avg: unit.avg_delay,
          total: unit.total,
          p75,
          p90,
          normDensity,
        };
      });

      const containerWidth = svgRef.current.parentElement?.clientWidth || 820;
      const margin = { top: 32, right: 24, bottom: 44, left: 168 };
      const width = containerWidth - margin.left - margin.right;
      const rowHeight = 56;
      const ridgeHeightMax = rowHeight * 0.82;
      const height = groups.length * rowHeight + margin.top + margin.bottom;

      svg
        .attr('width', containerWidth)
        .attr('height', height)
        .attr('viewBox', `0 0 ${containerWidth} ${height}`);

      const defs = svg.append('defs');
      const makeGradient = (id: string, color: string) => {
        const grad = defs
          .append('linearGradient')
          .attr('id', id)
          .attr('x1', '0%')
          .attr('x2', '100%');
        grad
          .append('stop')
          .attr('offset', '0%')
          .attr('stop-color', color)
          .attr('stop-opacity', 0.04);
        grad
          .append('stop')
          .attr('offset', '40%')
          .attr('stop-color', color)
          .attr('stop-opacity', 0.18);
        grad
          .append('stop')
          .attr('offset', '100%')
          .attr('stop-color', color)
          .attr('stop-opacity', 0.05);
      };
      makeGradient('fill-good', '#0f766e');
      makeGradient('fill-warn', '#d97706');
      makeGradient('fill-crit', '#dc2626');

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
      const x = d3.scaleLinear().domain([0, xMax]).range([0, width]);
      const y = d3.scaleLinear().domain([0, 1]).range([0, ridgeHeightMax]);
      const plotBottom = height - margin.top - margin.bottom;

      groups.forEach((_, i) => {
        g.append('rect')
          .attr('x', 0)
          .attr('y', i * rowHeight)
          .attr('width', width)
          .attr('height', rowHeight)
          .attr('fill', i % 2 === 0 ? themeColors.stripeEven : themeColors.stripeOdd)
          .attr('fill-opacity', 0.55);
      });

      const xTicks = x.ticks(xMax > 8 ? Math.ceil(xMax / 2) : xMax);
      g.selectAll('.grid-line')
        .data(xTicks)
        .join('line')
        .attr('class', 'grid-line')
        .attr('x1', (d) => x(d))
        .attr('x2', (d) => x(d))
        .attr('y1', 0)
        .attr('y2', plotBottom)
        .attr('stroke', themeColors.border)
        .attr('stroke-width', 1);

      g.append('line')
        .attr('x1', x(ACCEPTABLE_LIMIT))
        .attr('x2', x(ACCEPTABLE_LIMIT))
        .attr('y1', 0)
        .attr('y2', plotBottom)
        .attr('stroke', themeColors.muted)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3');

      svg
        .append('text')
        .attr('x', x(ACCEPTABLE_LIMIT) + margin.left + 5)
        .attr('y', margin.top - 10)
        .attr('fill', themeColors.text)
        .attr('font-size', '9.5px')
        .attr('font-weight', '600')
        .text(`${ACCEPTABLE_LIMIT}d — limite aceitável`);

      g.append('g')
        .attr('transform', `translate(0,${plotBottom})`)
        .call(
          d3
            .axisBottom(x)
            .tickValues(xTicks)
            .tickSize(4)
            .tickFormat((d) => `${d}d`),
        )
        .call((sel) => sel.select('.domain').attr('stroke', themeColors.muted))
        .call((sel) =>
          sel
            .selectAll('.tick text')
            .attr('fill', themeColors.text)
            .attr('font-size', '10px')
            .attr('dy', '1.2em'),
        )
        .call((sel) => sel.selectAll('.tick line').attr('stroke', themeColors.muted));

      svg
        .append('text')
        .attr('x', margin.left + width / 2)
        .attr('y', height - 5)
        .attr('text-anchor', 'middle')
        .attr('fill', themeColors.text)
        .attr('font-size', '9.5px')
        .text('DIAS ENTRE SINTOMAS E NOTIFICAÇÃO');

      const area = d3
        .area<{ x: number; y: number }>()
        .x((d) => x(d.x))
        .y0(0)
        .y1((d) => -y(d.y))
        .curve(d3.curveBasis);
      const line = d3
        .line<{ x: number; y: number }>()
        .x((d) => x(d.x))
        .y((d) => -y(d.y))
        .curve(d3.curveBasis);

      const ridgeGroups = g
        .selectAll('.ridge-group')
        .data(groups)
        .join('g')
        .attr('class', 'ridge-group')
        .attr('transform', (_, i) => `translate(0,${i * rowHeight + rowHeight * 0.88})`);

      ridgeGroups
        .append('path')
        .attr('d', (d) => area(d.normDensity) ?? '')
        .attr('fill', (d) =>
          d.median <= WARN_THRESHOLD
            ? 'url(#fill-good)'
            : d.median <= CRIT_THRESHOLD
              ? 'url(#fill-warn)'
              : 'url(#fill-crit)',
        );
      ridgeGroups
        .append('path')
        .attr('d', (d) => area(d.normDensity) ?? '')
        .attr('fill', (d) => getRidgeColor(d.median))
        .attr('fill-opacity', 0.12);
      ridgeGroups
        .append('path')
        .attr('d', (d) => line(d.normDensity) ?? '')
        .attr('fill', 'none')
        .attr('stroke', (d) => getRidgeColor(d.median))
        .attr('stroke-width', 2);
      ridgeGroups
        .append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', themeColors.border)
        .attr('stroke-width', 0.5);

      ridgeGroups
        .append('line')
        .attr('x1', (d) => x(d.p75))
        .attr('x2', (d) => x(d.p75))
        .attr('y1', -y(0.28))
        .attr('y2', 0)
        .attr('stroke', (d) => getRidgeColor(d.median))
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '3,2')
        .attr('opacity', 0.55);
      ridgeGroups
        .append('line')
        .attr('x1', (d) => x(d.median))
        .attr('x2', (d) => x(d.median))
        .attr('y1', -y(0.8))
        .attr('y2', 0)
        .attr('stroke', (d) => getRidgeColor(d.median))
        .attr('stroke-width', 2.5);

      ridgeGroups
        .append('text')
        .attr('x', (d) => x(d.median))
        .attr('y', -y(0.85) - 6 || -9)
        .attr('text-anchor', 'middle')
        .attr('fill', (d) => getRidgeColor(d.median))
        .attr('font-size', '9.5px')
        .attr('font-weight', '700')
        .attr('paint-order', 'stroke')
        .attr('stroke', themeColors.bg)
        .attr('stroke-width', 3)
        .text((d) => `${d.median.toFixed(1)}d`);

      const labelG = ridgeGroups.append('g').attr('transform', 'translate(-8,0)');
      labelG
        .append('text')
        .attr('x', 0)
        .attr('y', -14)
        .attr('text-anchor', 'end')
        .attr('fill', themeColors.main)
        .attr('font-size', '10.5px')
        .attr('font-weight', '600')
        .text((d) => d.label);
      labelG
        .append('text')
        .attr('x', 0)
        .attr('y', -1)
        .attr('text-anchor', 'end')
        .attr('fill', themeColors.text)
        .attr('font-size', '9.5px')
        .attr('font-weight', '500')
        .text((d) => `${d.total} casos`);

      ridgeGroups
        .append('rect')
        .attr('x', 0)
        .attr('y', -ridgeHeightMax)
        .attr('width', width)
        .attr('height', ridgeHeightMax + 4)
        .attr('fill', 'transparent')
        .on('mousemove', (event, d) => {
          const [mx, my] = d3.pointer(event, svgRef.current!);
          setTooltip({
            visible: true,
            x: mx,
            y: my,
            name: d.label,
            median: d.median,
            avg: d.avg,
            total: d.total,
            p75: d.p75,
            p90: d.p90,
          });
        })
        .on('mouseleave', () => setTooltip(null));
    } catch (err) {
      console.error('Erro render Ridgeline por Unidade:', err);
    }
  }, [data, themeColors, page]);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          padding: '8px 0 4px',
          marginBottom: '2px',
          flexWrap: 'wrap',
        }}
      >
        {[
          { color: '#0f766e', label: 'Adequado' },
          { color: '#d97706', label: 'Atenção' },
          { color: '#dc2626', label: 'Crítico' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '3px', borderRadius: '2px', background: color }} />
            <span style={{ fontSize: '11px', color: themeColors.text }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', position: 'relative' }}>
        <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x + 14,
              top: Math.max(0, tooltip.y - 20),
              background: themeColors.bg,
              border: `1px solid ${themeColors.border}`,
              borderRadius: '8px',
              padding: '10px 14px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
              minWidth: '200px',
              zIndex: 20,
            }}
          >
            <div
              style={{
                fontWeight: '700',
                fontSize: '12px',
                color: themeColors.main,
                marginBottom: '8px',
                borderBottom: `1px solid ${themeColors.border}`,
                paddingBottom: '6px',
              }}
            >
              {tooltip.name}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '4px 14px',
                alignItems: 'baseline',
              }}
            >
              {[
                { label: 'Total casos', value: String(tooltip.total) },
                {
                  label: 'Mediana',
                  value: `${tooltip.median.toFixed(1)}d`,
                  color: getRidgeColor(tooltip.median),
                },
                { label: 'Média', value: `${tooltip.avg.toFixed(1)}d` },
                { label: 'P75', value: `${tooltip.p75.toFixed(1)}d` },
                { label: 'P90', value: `${tooltip.p90.toFixed(1)}d` },
              ].map(({ label, value, color }) => (
                <React.Fragment key={label}>
                  <span style={{ fontSize: '10px', color: themeColors.text }}>{label}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: color ?? themeColors.main,
                      textAlign: 'right',
                    }}
                  >
                    {value}
                  </span>
                </React.Fragment>
              ))}
            </div>
            <div
              style={{
                marginTop: '8px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: themeColors.panel,
                textAlign: 'center',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.04em',
                color: getRidgeColor(tooltip.median),
                border: `1px solid ${themeColors.border}`,
              }}
            >
              {getStatusLabel(tooltip.median).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 0 4px',
            marginTop: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: `1px solid ${themeColors.border}`,
              background: themeColors.bg,
              color: page === 0 ? themeColors.muted : themeColors.main,
              fontWeight: 600,
              fontSize: '12px',
              cursor: page === 0 ? 'default' : 'pointer',
              opacity: page === 0 ? 0.5 : 1,
            }}
          >
            ‹ Anterior
          </button>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: `1px solid ${i === page ? 'var(--primary-teal)' : themeColors.border}`,
                background: i === page ? 'var(--primary-teal)' : themeColors.bg,
                color: i === page ? '#fff' : themeColors.text,
                fontWeight: i === page ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: `1px solid ${themeColors.border}`,
              background: themeColors.bg,
              color: page === pageCount - 1 ? themeColors.muted : themeColors.main,
              fontWeight: 600,
              fontSize: '12px',
              cursor: page === pageCount - 1 ? 'default' : 'pointer',
              opacity: page === pageCount - 1 ? 0.5 : 1,
            }}
          >
            Próximo ›
          </button>
        </div>
      )}
    </div>
  );
};

export default DelayByUnitRidgelinePlot;
