import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { useThemeMode } from "../../hooks/useThemeMode";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface DiagnosticoCriterio {
  label:  string;
  valor:  number; // percentual 0-100
  color:  string;
}

export interface BoxStats {
  min:    number;
  q1:     number;
  median: number;
  q3:     number;
  max:    number;
  label?: string;
}

export interface AntiviralItem {
  nome:   string;
  pct:    number;
  casos:  number;
  status: "ok" | "warn" | "raro";
}

export interface QualidadePerformanceData {
  criterios:        DiagnosticoCriterio[];
  latencia:         BoxStats;
  antiviral:        AntiviralItem[];
  oportunidade:     BoxStats;
  oportunidadeMeta: number; // dias — janela terapêutica (ex: 2)
  coberturaTestagem: {
    collected: number;
    total: number;
    rate: number;
  };
  distribuicaoAmostra: {
    label: string;
    count: number;
  }[];
}

// ─── Componente Tooltip Centralizado ─────────────────────────────────────────

interface TooltipState {
  show: boolean;
  x: number;
  y: number;
  content: string | React.ReactNode;
}

const Tooltip: React.FC<TooltipState> = ({ show, x, y, content }) => {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed',
      left: x + 15,
      top: y - 10,
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '11px',
      pointerEvents: 'none',
      zIndex: 9999,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
      lineHeight: 1.5,
      maxWidth: '200px',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      {content}
    </div>
  );
};

// ─── Sub-componente: BoxPlot ─────────────────────────────────────────────────

interface BoxPlotProps {
  stats:       BoxStats;
  color:       string;
  metaVal?:    number;
  metaLabel?:  string;
  height?:     number;
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
  themeColors: Record<string, string>;
}

const BoxPlot: React.FC<BoxPlotProps> = ({
  stats,
  color,
  metaVal,
  metaLabel,
  height = 120,
  onHover,
  onLeave,
  themeColors
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const margin = { top: 28, right: 40, bottom: 24, left: 16 };
    const totalW = svgRef.current.clientWidth || 360;
    const w      = totalW - margin.left - margin.right;
    const h      = height - margin.top - margin.bottom;
    const cy     = h / 2;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", "100%").attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Escala X
    const xDomain = [
      Math.min(stats.min, metaVal ?? stats.min) - 0.5,
      Math.max(stats.max, metaVal ?? stats.max) + 1,
    ];
    const xScale = d3.scaleLinear().domain(xDomain).range([0, w]);

    // Grid vertical
    g.append("g")
      .attr("transform", `translate(0, ${h})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(6)
          .tickSize(-h)
          .tickFormat(d => `${+d}d`)
      )
      .call(gg => gg.select(".domain").remove())
      .call(gg => gg.selectAll(".tick line")
        .attr("stroke", themeColors.grid).attr("stroke-dasharray", "3,3"))
      .call(gg => gg.selectAll("text")
        .attr("fill", themeColors.text).attr("font-size", "10px").attr("dy", "1em"));

    // Linha de meta (atrás de tudo)
    if (metaVal != null) {
      const mx = xScale(metaVal);
      g.append("line")
        .attr("x1", mx).attr("x2", mx)
        .attr("y1", -margin.top + 6).attr("y2", h)
        .attr("stroke", themeColors.crit)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,3");

      g.append("text")
        .attr("x", mx + 4)
        .attr("y", -margin.top + 14)
        .attr("font-size", "10px")
        .attr("font-weight", "600")
        .attr("fill", themeColors.crit)
        .text(metaLabel ?? `meta ${metaVal}d`);
    }

    // Whisker esquerdo (min → q1)
    g.append("line")
      .attr("x1", xScale(stats.min)).attr("x2", xScale(stats.q1))
      .attr("y1", cy).attr("y2", cy)
      .attr("stroke", color).attr("stroke-width", 1.5);

    // Whisker direito (q3 → max)
    g.append("line")
      .attr("x1", xScale(stats.q3)).attr("x2", xScale(stats.max))
      .attr("y1", cy).attr("y2", cy)
      .attr("stroke", color).attr("stroke-width", 1.5);

    // Caps (min e max)
    [stats.min, stats.max].forEach(v => {
      g.append("line")
        .attr("x1", xScale(v)).attr("x2", xScale(v))
        .attr("y1", cy - 10).attr("y2", cy + 10)
        .attr("stroke", color).attr("stroke-width", 1.5);
    });

    // IQR box
    g.append("rect")
      .attr("x", xScale(stats.q1))
      .attr("y", cy - 16)
      .attr("width", Math.max(4, xScale(stats.q3) - xScale(stats.q1)))
      .attr("height", 32)
      .attr("fill", color + "33")
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr("rx", 3)
      .style("cursor", "pointer")
      .on("mouseenter", (e) => {
        onHover(e, (
          <div>
            <strong>Distribuição:</strong><br/>
            Q1: {stats.q1}d<br/>
            Mediana: <strong>{stats.median}d</strong><br/>
            Q3: {stats.q3}d<br/>
            Min/Max: {stats.min}-{stats.max}d
          </div>
        ));
      })
      .on("mouseleave", onLeave);

    // Linha de mediana
    g.append("line")
      .attr("x1", xScale(stats.median)).attr("x2", xScale(stats.median))
      .attr("y1", cy - 16).attr("y2", cy + 16)
      .attr("stroke", color).attr("stroke-width", 3);

    // Label mediana
    g.append("text")
      .attr("x", xScale(stats.median))
      .attr("y", cy - 22)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", color)
      .text(`med ${stats.median}d`);

    // Labels min/max
    g.append("text")
      .attr("x", xScale(stats.min))
      .attr("y", cy + 28)
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", themeColors.text)
      .text(`${stats.min}d`);

    g.append("text")
      .attr("x", xScale(stats.max))
      .attr("y", cy + 28)
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", themeColors.text)
      .text(`${stats.max}d`);

  }, [stats, color, metaVal, metaLabel, height, onHover, onLeave, themeColors]);

  return (
    <svg
      ref={svgRef}
      onMouseLeave={onLeave}
      style={{ width: "100%", display: "block", overflow: "visible" }}
    />
  );
};

// ─── Sub-componente: Barra 100% ──────────────────────────────────────────────

const Barra100: React.FC<{
  criterios: DiagnosticoCriterio[],
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
  themeColors: Record<string, string>;
}> = ({ criterios, onHover, onLeave, themeColors }) => {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggle = (label: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const visibleCriterios = criterios.filter(c => !hidden.has(c.label));
  const total = visibleCriterios.reduce((s, c) => s + c.valor, 0);

  return (
    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {/* Barra empilhada */}
      <div style={{
        display: "flex", height: "40px",
        borderRadius: "8px", overflow: "hidden",
        background: themeColors.pill,
      }}>
        {criterios.map((c, i) => (
          !hidden.has(c.label) && (
            <div
              key={i}
              onMouseEnter={(e) => onHover(e, (
                <div>
                  <strong>{c.label}</strong><br/>
                  Participação: <strong>{c.valor.toFixed(1)}%</strong>
                </div>
              ))}
              onMouseLeave={onLeave}
              style={{
                width: `${total > 0 ? (c.valor / total) * 100 : 0}%`,
                background: c.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 600,
                color: "white",
                transition: "width .4s, opacity .2s",
                cursor: 'pointer'
              }}
            >
               {c.valor >= 10 ? `${c.valor.toFixed(0)}%` : ""}
            </div>
          )
        ))}
        {visibleCriterios.length === 0 && (
           <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: themeColors.text }}>
              Selecione uma categoria abaixo
           </div>
        )}
      </div>

      {/* Legenda Iterativa */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "16px",
      }}>
        {criterios.map((c, i) => (
          <button
            key={i}
            onClick={() => toggle(c.label)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              fontSize: "11px", color: hidden.has(c.label) ? themeColors.neutral : themeColors.text,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              transition: 'color 0.2s'
            }}
          >
            <span style={{
              width: "12px", height: "12px",
              borderRadius: "3px",
              background: hidden.has(c.label) ? themeColors.pill : c.color,
              flexShrink: 0,
              transition: 'background 0.2s'
            }} />
            <span style={{ textDecoration: hidden.has(c.label) ? 'line-through' : 'none' }}>
              {c.label} {c.valor.toFixed(1)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Sub-componente: KPI cards antiviral ─────────────────────────────────────

const AntiviralKPIs: React.FC<{ items: AntiviralItem[], themeColors: Record<string, string> }> = ({ items, themeColors }) => {
  const theme = useThemeMode();

  const getBadgeColors = (status: string) => {
    const isDark = theme === 'dark';
    if (status === 'ok') return isDark ? { bg: '#134e4a', color: '#5eead4' } : { bg: "#e1f5ee", color: "#085041" };
    if (status === 'warn') return isDark ? { bg: '#451a03', color: '#fbbf24' } : { bg: "#faeeda", color: "#633806" };
    return isDark ? { bg: '#1e293b', color: '#cbd5e1' } : { bg: "#f1efe8", color: "#444441" };
  };

  return (
    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)`,
        gap: "10px",
      }}>
        {items.map((item, i) => {
          const badge = getBadgeColors(item.status);
          const valColor = item.status === "ok"
            ? themeColors.ok
            : item.status === "warn"
            ? themeColors.warn
            : themeColors.neutral;

          return (
            <div key={i} style={{
              background: themeColors.status,
              borderRadius: "8px",
              padding: "20px 10px",
              textAlign: "center",
              transition: 'transform 0.2s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{
                fontSize: "24px", fontWeight: 600, color: valColor,
              }}>
                {item.pct.toFixed(1)}%
              </div>
              <div style={{ fontSize: "12px", color: themeColors.text, marginTop: "2px" }}>
                {item.nome}
              </div>
              <div style={{ fontSize: "10px", color: themeColors.neutral, marginTop: "1px" }}>
                {item.casos} casos
              </div>
              <span style={{
                display: "inline-block",
                marginTop: "6px",
                fontSize: "9px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "4px",
                background: badge.bg,
                color: badge.color,
              }}>
                {item.status === 'ok' ? 'padrão' : item.status === 'warn' ? 'atenção' : 'raro'}
              </span>
            </div>
          );
        })}
        {items.length === 0 && (
           <div style={{ gridColumn: 'span 3', padding: '20px', textAlign: 'center', color: themeColors.text, fontSize: '12px' }}>
              Nenhum antiviral registrado.
           </div>
        )}
      </div>
    </div>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

interface QualidadePerformanceProps {
  data: QualidadePerformanceData;
}

const QualidadePerformance: React.FC<QualidadePerformanceProps> = ({ data }) => {
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, x: 0, y: 0, content: "" });
  const theme = useThemeMode();

  const themeColors = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      ok:      "#0f766e",
      warn:    "#d97706",
      crit:    "#dc2626",
      neutral: isDark ? "#475569" : "#94a3b8",
      grid:    isDark ? "#334155" : "#e2e8f0",
      text:    isDark ? "#94a3b8" : "#64748b",
      main:    isDark ? "#f8fafc" : "#0f172a",
      bg:      isDark ? "#1e293b" : "#ffffff",
      border:  isDark ? "#334155" : "#e2e8f0",
      status:  isDark ? "#0f172a" : "#f8fafc",
      pill:    isDark ? "#334155" : "#f1f5f9"
    };
  }, [theme]);

  const handleHover = (_e: React.MouseEvent | unknown, content: React.ReactNode) => {
    setTooltip({
      show: true,
      x: (_e as React.MouseEvent).clientX || 0,
      y: (_e as React.MouseEvent).clientY || 0,
      content
    });
  };

  const handleLeave = () => setTooltip(prev => ({ ...prev, show: false }));

  const cards = [
    {
      title: "Eficiência diagnóstica",
      sub:   "Critério de encerramento dos casos",
      content: <Barra100 criterios={data.criterios} onHover={handleHover} onLeave={handleLeave} themeColors={themeColors} />,
    },
    {
      title: "Latência laboratorial",
      sub:   "Dias entre coleta da amostra e resultado do RT-PCR",
      content: (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <BoxPlot
            stats={data.latencia}
            onHover={handleHover}
            onLeave={handleLeave}
            themeColors={themeColors}
            color={
              data.latencia.median <= 1
                ? themeColors.ok
                : data.latencia.median <= 3
                ? themeColors.warn
                : themeColors.crit
            }
            metaVal={1}
            metaLabel="meta OMS ≤ 1d"
            height={150}
          />
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "12px",
            marginTop: "12px",
          }}>
            {[
              { label: "Mediana", val: `${data.latencia.median}d`,  color: themeColors.ok    },
              { label: "P75",     val: `${data.latencia.q3}d`,      color: themeColors.warn  },
              { label: "Máx",     val: `${data.latencia.max}d`,     color: themeColors.text  },
              { label: "Meta OMS",val: "≤ 1d",                      color: themeColors.crit  },
            ].map((l, i) => (
              <span key={i} style={{
                display: "flex", alignItems: "center", gap: "5px",
                fontSize: "11px", color: themeColors.text,
              }}>
                <span style={{
                  width: "10px", height: "3px",
                  borderRadius: "2px", background: l.color,
                  flexShrink: 0,
                }} />
                {l.label}: <strong style={{ color: l.color }}>{l.val}</strong>
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Perfil terapêutico",
      sub:   "Uso de antiviral para gripe — distribuição por tipo",
      content: <AntiviralKPIs items={data.antiviral} themeColors={themeColors} />,
    },
    {
      title: "Oportunidade de tratamento",
      sub:   `Meta: ${data.oportunidadeMeta}d (janela terapêutica)`,
      content: (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <BoxPlot
            stats={data.oportunidade}
            onHover={handleHover}
            onLeave={handleLeave}
            themeColors={themeColors}
            color={
              data.oportunidade.median <= data.oportunidadeMeta
                ? themeColors.ok
                : data.oportunidade.median <= data.oportunidadeMeta * 2
                ? themeColors.warn
                : themeColors.crit
            }
            metaVal={data.oportunidadeMeta}
            metaLabel={`meta ${data.oportunidadeMeta}d (48h)`}
            height={150}
          />
          <div style={{
            marginTop: "14px", padding: "12px 14px",
            background: data.oportunidade.median <= data.oportunidadeMeta ? (theme === 'dark' ? '#064e3b' : '#f0fdf4') : (theme === 'dark' ? '#7f1d1d' : '#fcebeb'),
            borderRadius: "8px",
            borderLeft: `4px solid ${data.oportunidade.median <= data.oportunidadeMeta ? themeColors.ok : themeColors.crit}`,
            fontSize: "12px", color: data.oportunidade.median <= data.oportunidadeMeta ? (theme === 'dark' ? '#6ee7b7' : '#166534') : (theme === 'dark' ? '#fca5a5' : '#791f1f'), lineHeight: 1.5,
          }}>
            {data.oportunidade.median <= data.oportunidadeMeta
              ? `Mediana de ${data.oportunidade.median}d está dentro da janela terapêutica recomendada.`
              : `Mediana de ${data.oportunidade.median}d está acima da janela de ${data.oportunidadeMeta * 24}h. Indica diagnóstico tardio.`
            }
          </div>
        </div>
      ),
    },
    {
      title: "Cobertura de testagem",
      sub:   "Proporção de casos com amostra laboratorial coletada",
      content: (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px' }}>
             <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke={themeColors.pill} strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="54" fill="none" stroke={data.coberturaTestagem.rate >= 80 ? themeColors.ok : themeColors.warn}
                  strokeWidth="12" strokeDasharray={`${(data.coberturaTestagem.rate / 100) * 339.29} 339.29`}
                  strokeLinecap="round" transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
             </svg>
             <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, color: themeColors.main }}>{data.coberturaTestagem.rate}%</span>
             </div>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '12px', color: themeColors.text }}>
            <strong>{data.coberturaTestagem.collected}</strong> amostras de <strong>{data.coberturaTestagem.total}</strong> casos
          </p>
        </div>
      )
    },
    {
      title: "Distribuição de amostras",
      sub:   "Tipos de material biológico coletado",
      content: (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
          {data.distribuicaoAmostra.slice(0, 5).map((item, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: themeColors.text }}>{item.label}</span>
                <span style={{ color: themeColors.neutral }}>{item.count}</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: themeColors.pill, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${(item.count / Math.max(1, data.coberturaTestagem.collected)) * 100}%`,
                  height: '100%',
                  background: i === 0 ? themeColors.ok : themeColors.neutral,
                  borderRadius: '3px'
                }} />
              </div>
            </div>
          ))}
          {data.distribuicaoAmostra.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: themeColors.neutral }}>Sem dados de amostra.</p>
          )}
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: "0", fontFamily: "inherit" }}>
      <Tooltip {...tooltip} />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "16px",
      }}>
        {cards.map((card, i) => (
          <div key={i} style={{
            background: themeColors.bg,
            border: `1px solid ${themeColors.border}`,
            borderRadius: "12px",
            padding: "24px",
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '320px',
            boxShadow: theme === 'dark' ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: "14px", fontWeight: 600, color: themeColors.main,
              marginBottom: "2px",
            }}>
              {card.title}
            </div>
            <div style={{
              fontSize: "11px", color: themeColors.text, marginBottom: "20px",
              lineHeight: 1.4,
            }}>
              {card.sub}
            </div>
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              {card.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QualidadePerformance;
