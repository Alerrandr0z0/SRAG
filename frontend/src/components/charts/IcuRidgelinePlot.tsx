import * as d3 from 'd3';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThemeMode } from '../../hooks/useThemeMode';
import { IcuBottleneckRecord, TemporalGrouping } from '../../types/epi';

interface IcuRidgelinePlotProps {
  data?: IcuBottleneckRecord[];
  groupBy: TemporalGrouping;
}

const WARN_THRESHOLD = 2;
const CRIT_THRESHOLD = 4;
const ACCEPTABLE_LIMIT = 3;

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

const MIN_CASES: Record<TemporalGrouping, number> = {
  year: 50,
  month: 20,
  week: 10,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const buildKeys = (d: IcuBottleneckRecord, groupBy: TemporalGrouping) => {
  const dateObj = new Date(`${d.date}T00:00:00`);
  const year = dateObj.getFullYear();
  if (groupBy === 'year') {
    return { groupKey: year.toString(), displayLabel: `Ano ${year}` };
  }
  if (groupBy === 'month') {
    const groupKey = d.date.substring(0, 7);
    const mName = dateObj.toLocaleString('pt-BR', { month: 'short' });
    return {
      groupKey,
      displayLabel: `${mName.charAt(0).toUpperCase() + mName.slice(1)}/${String(year).slice(2)}`,
    };
  }
  const firstDay = new Date(year, 0, 1);
  const pastDays = (dateObj.getTime() - firstDay.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
  return {
    groupKey: `${year}-W${weekNum.toString().padStart(2, '0')}`,
    displayLabel: `Sem. ${weekNum}/${String(year).slice(2)}`,
  };
};

function kde(
  values: number[],
  thresholds: number[],
  bandwidth: number,
): { x: number; y: number }[] {
  const n = values.length;
  if (n === 0) return thresholds.map((x) => ({ x, y: 0 }));
  const h = bandwidth;
  const invN = 1 / n;
  const invSqrt2PI = 1 / Math.sqrt(2 * Math.PI);
  return thresholds.map((x) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const u = (x - values[i]) / h;
      sum += Math.exp(-0.5 * u * u);
    }
    return { x, y: (sum * invN * invSqrt2PI) / h };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
const IcuRidgelinePlot: React.FC<IcuRidgelinePlotProps> = ({ data = [], groupBy }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    label: string;
    median: number;
    sameDayRate: number;
    totalCases: number;
    waitingCases: number;
    p75: number;
    p90: number;
  } | null>(null);
  const [page, setPage] = useState(0);

  const pageCount = useMemo(() => {
    if (data.length === 0) return 1;
    const enriched = data.map((d) => ({ ...d, ...buildKeys(d, groupBy) }));
    const counts = d3.rollup(
      enriched,
      (v) => v.length,
      (d) => d.groupKey,
    );
    let keys = Array.from(counts.keys())
      .filter((k) => (counts.get(k) ?? 0) >= MIN_CASES[groupBy])
      .sort();
    if (keys.length === 0) {
      keys = Array.from(counts.keys()).sort();
    }
    return Math.max(1, Math.ceil(keys.length / 10));
  }, [data, groupBy]);

  useEffect(() => {
    if (page >= pageCount) {
      setPage(pageCount - 1);
    }
  }, [pageCount, page]);

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

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    try {
      const enriched = data.map((d) => ({ ...d, ...buildKeys(d, groupBy) }));
      const counts = d3.rollup(
        enriched,
        (v) => v.length,
        (d) => d.groupKey,
      );
      let validKeys = Array.from(counts.keys())
        .filter((k) => (counts.get(k) ?? 0) >= MIN_CASES[groupBy])
        .sort();

      const maxGroups = 10;
      if (validKeys.length === 0) {
        validKeys = Array.from(counts.keys()).sort();
      }
      const totalPages = Math.max(1, Math.ceil(validKeys.length / maxGroups));
      const currentPage = Math.min(page, totalPages - 1);
      validKeys = validKeys.slice(
        -(currentPage + 1) * maxGroups,
        -(currentPage * maxGroups) || undefined,
      );
      validKeys.reverse();

      const filteredAll = enriched.filter((d) => validKeys.includes(d.groupKey));
      if (filteredAll.length === 0) return;

      const statsByKey = d3.rollup(
        filteredAll,
        (v) => {
          const total = v.length;
          const sameDay = v.filter((d) => d.wait_days === 0).length;
          const waitData = v
            .filter((d) => d.wait_days > 0)
            .map((d) => d.wait_days)
            .sort(d3.ascending);
          const medianWait = waitData.length > 0 ? (d3.median(waitData) ?? 0) : 0;
          const p75 = waitData.length > 0 ? (d3.quantile(waitData, 0.75) ?? 0) : 0;
          const p90 = waitData.length > 0 ? (d3.quantile(waitData, 0.9) ?? 0) : 0;
          return {
            total,
            waitingCases: waitData.length,
            sameDayRate: (sameDay / total) * 100,
            medianWait,
            p75,
            p90,
          };
        },
        (d) => d.groupKey,
      );

      const ridgeData = filteredAll.filter((d) => d.wait_days > 0);
      if (ridgeData.length === 0) return;

      const xMax = 10;
      const numBins = 100;
      const xThresholds = d3.range(0, xMax + 0.01, xMax / numBins);
      const allWaits = ridgeData.map((d) => d.wait_days);
      const globalStddev = d3.deviation(allWaits) ?? 1;
      const bandwidth = 0.9 * globalStddev * allWaits.length ** -0.2;
      const bw = Math.max(bandwidth, 0.25);
      const labelMap = Object.fromEntries(filteredAll.map((d) => [d.groupKey, d.displayLabel]));

      interface RidgeGroup {
        key: string;
        label: string;
        median: number;
        sameDayRate: number;
        totalCases: number;
        waitingCases: number;
        p75: number;
        p90: number;
        normDensity: { x: number; y: number }[];
      }

      const groups: RidgeGroup[] = [];
      for (const key of validKeys) {
        const values = ridgeData.filter((d) => d.groupKey === key).map((d) => d.wait_days);
        const stats = statsByKey.get(key)!;
        if (values.length === 0) continue;
        const density = kde(values, xThresholds, bw);
        const maxDensity = d3.max(density, (d) => d.y) || 0;
        const normDensity = density.map((pt) => ({
          x: pt.x,
          y: maxDensity > 0 ? pt.y / maxDensity : 0,
        }));
        groups.push({
          key,
          label: labelMap[key],
          median: stats.medianWait,
          sameDayRate: stats.sameDayRate,
          totalCases: stats.total,
          waitingCases: stats.waitingCases,
          p75: stats.p75,
          p90: stats.p90,
          normDensity,
        });
      }

      const containerWidth = svgRef.current.parentElement?.clientWidth || 820;
      const margin = { top: 36, right: 24, bottom: 44, left: 152 };
      const width = containerWidth - margin.left - margin.right;
      const rowHeight = 52;
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
        .text('DIAS DE ESPERA ATÉ ADMISSÃO NA UTI');

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
        .append('circle')
        .attr('cx', (d) => x(d.median))
        .attr('cy', (d) => {
          const nearestPt = d.normDensity.reduce((prev, cur) =>
            Math.abs(cur.x - d.median) < Math.abs(prev.x - d.median) ? cur : prev,
          );
          return -y(nearestPt.y * 0.96) || 0;
        })
        .attr('r', 3.5)
        .attr('fill', (d) => getRidgeColor(d.median))
        .attr('stroke', themeColors.bg)
        .attr('stroke-width', 1.5);

      ridgeGroups
        .append('text')
        .attr('x', (d) => x(d.median))
        .attr('y', (d) => {
          const nearestPt = d.normDensity.reduce((prev, cur) =>
            Math.abs(cur.x - d.median) < Math.abs(prev.x - d.median) ? cur : prev,
          );
          return -y(nearestPt.y * 0.96) - 9 || -9;
        })
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
        .attr('fill', (d) =>
          d.sameDayRate >= 85 ? '#0f766e' : d.sameDayRate >= 70 ? '#d97706' : '#dc2626',
        )
        .attr('font-size', '9.5px')
        .attr('font-weight', '500')
        .text((d) => `${d.sameDayRate.toFixed(0)}% mesmo dia`);

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
            label: d.label,
            median: d.median,
            sameDayRate: d.sameDayRate,
            totalCases: d.totalCases,
            waitingCases: d.waitingCases,
            p75: d.p75,
            p90: d.p90,
          });
        })
        .on('mouseleave', () => setTooltip(null));
    } catch (err) {
      console.error('Erro render Ridgeline:', err);
    }
  }, [data, groupBy, themeColors, page]);

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
          { color: '#0f766e', label: `Adequado` },
          { color: '#d97706', label: `Atenção` },
          { color: '#dc2626', label: `Crítico` },
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
              minWidth: '190px',
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
              {tooltip.label}
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
                { label: 'Total casos', value: String(tooltip.totalCases) },
                { label: 'Aguardaram', value: String(tooltip.waitingCases) },
                {
                  label: 'Mediana espera',
                  value: `${tooltip.median.toFixed(1)}d`,
                  color: getRidgeColor(tooltip.median),
                },
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

export default IcuRidgelinePlot;
