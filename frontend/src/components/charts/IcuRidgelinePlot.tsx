import React, { useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";
import * as d3 from "d3";
import { IcuBottleneckRecord, TemporalGrouping } from "../../types/epi";

interface IcuRidgelinePlotProps {
  data?: IcuBottleneckRecord[];
  groupBy: TemporalGrouping;
}

const IcuRidgelinePlot: React.FC<IcuRidgelinePlotProps> = ({ data = [], groupBy }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    containerRef.current.innerHTML = "";

    try {
        // 1. Processamento e Labels
        const grouped = data.map(d => {
            const dateObj = new Date(d.date + "T00:00:00");
            let groupKey = "";
            let displayLabel = "";
            const year = dateObj.getFullYear();
            
            if (groupBy === 'year') {
                groupKey = year.toString();
                displayLabel = `Ano ${year}`;
            } else if (groupBy === 'month') {
                groupKey = d.date.substring(0, 7);
                const monthName = dateObj.toLocaleString('pt-BR', { month: 'short' });
                displayLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year.toString().slice(2)}`;
            } else {
                const firstDayOfYear = new Date(year, 0, 1);
                const pastDaysOfYear = (dateObj.getTime() - firstDayOfYear.getTime()) / 86400000;
                const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
                groupKey = `${year}-W${weekNum.toString().padStart(2, '0')}`;
                displayLabel = `Sem. ${weekNum}/${year.toString().slice(2)}`;
            }
            return { ...d, groupKey, displayLabel };
        });

        // 2. Filtro de Significância
        const counts = d3.rollup(grouped, v => v.length, d => d.groupKey);
        const threshold = groupBy === 'year' ? 20 : (groupBy === 'month' ? 8 : 3);
        
        const validKeys = Array.from(counts.keys())
            .filter(k => (counts.get(k) || 0) >= threshold)
            .sort();

        const displayKeys = validKeys.slice(-12);
        const filteredData = grouped.filter(d => displayKeys.includes(d.groupKey));

        if (filteredData.length === 0) return;

        // 3. Eixo X Dinâmico (P95)
        const p95 = d3.quantile(filteredData.map(d => d.wait_days).sort(d3.ascending), 0.95) || 10;
        const xMax = Math.max(Math.ceil(p95), 5); 

        const labelMap = Object.fromEntries(filteredData.map(d => [d.groupKey, d.displayLabel]));

        // 4. Renderização com Plot.groupX (Para alinhar exatamente no dia 0)
        const plot = Plot.plot({
          width: containerRef.current.clientWidth,
          height: displayKeys.length * 60,
          marginLeft: 100,
          marginRight: 40,
          style: {
            background: "transparent",
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "11px"
          },
          x: {
            label: "Dias de espera (Internação ➔ UTI)",
            grid: true,
            domain: [0, xMax],
            ticks: d3.range(0, xMax + 1, xMax > 10 ? 2 : 1)
          },
          fy: {
            label: null,
            domain: displayKeys,
            padding: 0
          },
          marks: [
            Plot.ruleX([0], { stroke: "#cbd5e1", strokeWidth: 1.5 }),
            
            // Usamos groupX para dados discretos (dias inteiros) -> Alinhamento perfeito no 0
            Plot.areaY(filteredData, Plot.normalizeY(
                "extent",
                Plot.groupX(
                    {y: "count"}, 
                    {
                        x: "wait_days", 
                        fy: "groupKey", 
                        fill: "#0f766e", 
                        fillOpacity: 0.25,
                        curve: "monotone-x" // Curva que passa exatamente pelos pontos
                    }
                )
            )),
            
            Plot.lineY(filteredData, Plot.normalizeY(
                "extent",
                Plot.groupX(
                    {y: "count"}, 
                    {
                        x: "wait_days", 
                        fy: "groupKey", 
                        stroke: "#0f766e", 
                        strokeWidth: 2,
                        curve: "monotone-x"
                    }
                )
            )),

            // Labels Laterais
            Plot.text(displayKeys.map(k => ({ groupKey: k, label: labelMap[k] })), {
                x: 0,
                fy: "groupKey",
                frameAnchor: "left",
                dx: -95,
                text: "label",
                fontWeight: "600",
                fontSize: 11,
                fill: "#475569"
            })
          ]
        });
    
        containerRef.current.append(plot);
    } catch (err) {
        console.error("Erro ao renderizar Ridgeline Plot:", err);
    }
  }, [data, groupBy]);

  return (
    <div style={{ width: "100%" }}>
      <div ref={containerRef} style={{ width: "100%" }} />
      {(!data || data.length === 0) && (
        <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
          Aguardando dados de evolução UTI...
        </div>
      )}
    </div>
  );
};

export default IcuRidgelinePlot;
