import React, { useMemo } from "react";
import { useEcharts } from "../../hooks/useEcharts";

interface SankeyChartProps {
  nodes: { name: string }[];
  links: { source: string; target: string; value: number; pct?: number }[];
}

const SankeyChart: React.FC<SankeyChartProps> = ({ nodes, links }) => {
  const option = useMemo(() => {
    if (!nodes.length || !links.length) return {};

    const colorMap: Record<string, string> = {
      Comunitária: "#10b981",
      "Infecção Hospitalar": "#ea580c",
      "Origem (Ignorado)": "#94a3b8",
      "Internado em Enfermaria": "#0d9488",
      "Internado em UTI": "#1e3a8a",
      "Internação (Ignorado)": "#cbd5e1",
      "Sem Suporte": "#94a3b8",
      "Vent. Não Inv.": "#facc15",
      "Vent. Invasiva": "#dc2626",
      "Suporte (Ignorado)": "#e2e8f0",
      Cura: "#059669",
      Óbito: "#9f1239",
      "Em Aberto": "#cbd5e1",
    };

    const totalCases = links
      .filter((l) =>
        ["Comunitária", "Infecção Hospitalar", "Origem (Ignorado)"].includes(
          l.source,
        ),
      )
      .reduce((sum, l) => sum + l.value, 0);

    const coloredNodes = nodes.map((n) => {
      const isNoise = n.name.includes("(Ignorado)") || n.name === "Em Aberto";

      // Calcular volume do nó para o TOOLTIP apenas
      const nodeVolume =
        links
          .filter((l) => l.source === n.name)
          .reduce((sum, l) => sum + l.value, 0) ||
        links
          .filter((l) => l.target === n.name)
          .reduce((sum, l) => sum + l.value, 0);

      const nodePct = totalCases > 0 ? ((nodeVolume / totalCases) * 100).round(1) : 0;

      return {
        name: n.name,
        value: nodeVolume,
        nodePct,
        itemStyle: {
          color: colorMap[n.name] || "#ccc",
          opacity: isNoise ? 0.4 : 1,
          borderWidth: isNoise ? 1 : 0,
          borderColor: "#94a3b8",
        },
      };
    });

    const coloredLinks = links.map((l) => {
      const isNoise =
        l.source.includes("(Ignorado)") ||
        l.target.includes("(Ignorado)") ||
        l.target === "Em Aberto";
      return {
        ...l,
        lineStyle: {
          opacity: isNoise ? 0.05 : 0.25,
          color: "gradient",
        },
      };
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tooltipBg = isDark ? 'rgba(30, 41, 59, 0.98)' : 'rgba(255, 255, 255, 0.98)';
    const tooltipBorder = isDark ? '#475569' : '#e2e8f0';
    const mainTextColor = isDark ? '#f8fafc' : '#1e293b';
    const mutedTextColor = isDark ? '#94a3b8' : '#64748b';
    const labelColor = isDark ? '#cbd5e1' : '#475569';

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: tooltipBg,
        padding: [10, 15],
        borderColor: tooltipBorder,
        borderWidth: 1,
        textStyle: { color: mainTextColor },
        formatter: (params: unknown) => {
          const p = params as { dataType: string; name: string; data: { nodePct?: number; value: number; source: string; target: string; pct?: number } };
          if (p.dataType === "node") {
            const isNoise =
              p.name.includes("(Ignorado)") || p.name === "Em Aberto";
            return `
                    <div style="font-size:10px; color:${mutedTextColor}; margin-bottom:4px;">
                        ${isNoise ? "QUALIDADE DE DADO" : "MARCO CLÍNICO"}
                    </div>
                    <b style="font-size:14px; color:${mainTextColor};">${p.name}</b><br/>
                    <div style="margin-top:8px; display:flex; justify-content:space-between; gap:20px;">
                        <span>Volume:</span> <b>${p.data.value} casos</b>
                    </div>
                    <div style="display:flex; justify-content:space-between; gap:20px;">
                        <span>Representatividade:</span> <b>${p.data.nodePct}%</b>
                    </div>
                `;
          }
          return `
                <div style="font-size:10px; color:${mutedTextColor}; margin-bottom:4px;">FLUXO DE PACIENTES</div>
                <div style="margin-bottom:8px;">
                    <b style="color:${mainTextColor};">${p.data.source}</b> ➔ <b style="color:${mainTextColor};">${p.data.target}</b>
                </div>
                <div style="display:flex; justify-content:space-between; gap:20px;">
                    <span>Volume:</span> <b>${p.data.value} casos</b>
                </div>
                <div style="display:flex; justify-content:space-between; gap:20px;">
                    <span>Proporção na Origem:</span> <b style="color:#3b82f6;">${p.data.pct}%</b>
                </div>
            `;
        },
      },
      series: [
        {
          type: "sankey",
          layout: "none",
          emphasis: { focus: "adjacency" },
          data: coloredNodes,
          links: coloredLinks,
          nodeWidth: 18,
          nodeGap: 18,
          draggable: false,
          label: {
            position: "right",
            fontSize: 11,
            color: labelColor,
            fontWeight: "bold",
            distance: 10,
          },
          lineStyle: {
            curveness: 0.5,
          },
        },
      ],
    };
  }, [nodes, links]);

  const { chartRef } = useEcharts(option, [nodes, links]);

  return <div ref={chartRef} className="echart-host" />;
};

// Extensão de arredondamento
declare global {
  interface Number {
    round(precision: number): number;
  }
}
Number.prototype.round = function (p: number) {
  const f = Math.pow(10, p);
  return Math.round(this.valueOf() * f) / f;
};

export default SankeyChart;
