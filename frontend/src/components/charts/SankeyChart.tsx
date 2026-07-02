import React, { useEffect, useMemo, useState } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';

interface SankeyChartProps {
  nodes: { name: string }[];
  links: { source: string; target: string; value: number; pct?: number }[];
}

const mobileLabels: Record<string, string> = {
  Comunitária: 'Comunit.',
  'Infecção Hospitalar': 'Hospit.',
  'Origem (Ignorado)': 'Orig. Ign.',
  'Internado em Enfermaria': 'Enfermaria',
  'Internado em UTI': 'UTI',
  'Internação (Ignorado)': 'Int. Ign.',
  'Sem Suporte': 'Sem Vent.',
  'Vent. Não Inv.': 'VNI',
  'Vent. Invasiva': 'VMI',
  'Suporte (Ignorado)': 'Sup. Ign.',
  Cura: 'Cura',
  Óbito: 'Óbito',
  'Em Aberto': 'Aberto',
  'Total de Casos': 'Total',
  'Notificação ≤7d': 'Notif ≤7d',
  'Notificação >7d': 'Notif >7d',
  'Sem Data Sintomas': 'S/ Sintomas',
  'Coleta no Prazo': 'Coleta OK',
  'Coleta Fora do Prazo': 'Coleta Atr.',
  'Sem Data Coleta': 'S/ Coleta',
  'Resultado ≤7d': 'Res ≤7d',
  'Resultado >7d': 'Res >7d',
  'Sem Data Resultado': 'S/ Resultado',
  'Tratamento ≤48h': 'Trat. ≤48h',
  'Tratamento >48h': 'Trat. >48h',
  'Sem Tratamento': 'S/ Tratamento',
};

const SankeyChart: React.FC<SankeyChartProps> = ({ nodes, links }) => {
  const theme = useThemeMode();
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 980 : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 980);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const option = useMemo(() => {
    if (!nodes.length || !links.length) return {};

    const colorMap: Record<string, string> = {
      Comunitária: '#10b981',
      'Infecção Hospitalar': '#ea580c',
      'Origem (Ignorado)': '#94a3b8',
      'Internado em Enfermaria': '#0d9488',
      'Internado em UTI': '#1e3a8a',
      'Internação (Ignorado)': '#cbd5e1',
      'Sem Suporte': '#94a3b8',
      'Vent. Não Inv.': '#facc15',
      'Vent. Invasiva': '#dc2626',
      'Suporte (Ignorado)': '#e2e8f0',
      Cura: '#059669',
      Óbito: '#9f1239',
      'Em Aberto': '#cbd5e1',
      // Timeliness flow nodes
      'Total de Casos': '#3b82f6',
      'Notificação ≤7d': '#10b981',
      'Notificação >7d': '#ef4444',
      'Sem Data Sintomas': '#94a3b8',
      'Coleta no Prazo': '#10b981',
      'Coleta Fora do Prazo': '#f59e0b',
      'Sem Data Coleta': '#94a3b8',
      'Resultado ≤7d': '#10b981',
      'Resultado >7d': '#ef4444',
      'Sem Data Resultado': '#94a3b8',
      'Tratamento ≤48h': '#10b981',
      'Tratamento >48h': '#ef4444',
      'Sem Tratamento': '#94a3b8',
    };

    const totalCases = links
      .filter((l) => ['Comunitária', 'Infecção Hospitalar', 'Origem (Ignorado)'].includes(l.source))
      .reduce((sum, l) => sum + l.value, 0);

    // Fallback: find root nodes (sources that are never targets)
    const rootTotal =
      totalCases > 0
        ? totalCases
        : (() => {
            const targetNames = new Set(links.map((l) => l.target));
            const rootNodes = nodes.filter((n) => !targetNames.has(n.name));
            return rootNodes.reduce((sum, n) => {
              return (
                sum + links.filter((l) => l.source === n.name).reduce((s, l) => s + l.value, 0)
              );
            }, 0);
          })();

    const coloredNodes = nodes.map((n) => {
      const isNoise =
        n.name.includes('(Ignorado)') || n.name === 'Em Aberto' || n.name.startsWith('Sem Data ');

      // Calcular volume do nó para o TOOLTIP apenas
      const nodeVolume =
        links.filter((l) => l.source === n.name).reduce((sum, l) => sum + l.value, 0) ||
        links.filter((l) => l.target === n.name).reduce((sum, l) => sum + l.value, 0);

      const nodePct = rootTotal > 0 ? ((nodeVolume / rootTotal) * 100).round(1) : 0;

      const isRightmost = ['Cura', 'Óbito', 'Em Aberto'].includes(n.name);
      const isTimelinessTerminal = [
        'Tratamento ≤48h',
        'Tratamento >48h',
        'Sem Tratamento',
      ].includes(n.name);
      const displayName = isNarrow ? mobileLabels[n.name] || n.name : n.name;
      const showLabel = !isNarrow || !isNoise;

      return {
        name: n.name,
        value: nodeVolume,
        nodePct,
        label: {
          position: isRightmost ? 'left' : isTimelinessTerminal ? 'right' : 'right',
          show: showLabel,
          formatter: () => displayName,
        },
        itemStyle: {
          color: colorMap[n.name] || '#ccc',
          opacity: isNoise ? 0.4 : 1,
          borderWidth: isNoise ? 1 : 0,
          borderColor: '#94a3b8',
        },
      };
    });

    const coloredLinks = links.map((l) => {
      const isNoise =
        l.source.includes('(Ignorado)') ||
        l.target.includes('(Ignorado)') ||
        l.target === 'Em Aberto' ||
        l.source.startsWith('Sem Data ') ||
        l.target.startsWith('Sem Data ');
      return {
        ...l,
        lineStyle: {
          opacity: isNoise ? 0.05 : 0.25,
          color: 'gradient',
        },
      };
    });

    const isDark = theme === 'dark';
    const tooltipBg = isDark ? 'rgba(30, 41, 59, 0.98)' : 'rgba(255, 255, 255, 0.98)';
    const tooltipBorder = isDark ? '#475569' : '#e2e8f0';
    const mainTextColor = isDark ? '#f8fafc' : '#1e293b';
    const mutedTextColor = isDark ? '#94a3b8' : '#64748b';
    const labelColor = isDark ? '#cbd5e1' : '#475569';

    return {
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: tooltipBg,
        padding: [10, 15],
        borderColor: tooltipBorder,
        borderWidth: 1,
        textStyle: { color: mainTextColor },
        formatter: (params: unknown) => {
          const p = params as {
            dataType: string;
            name: string;
            data: { nodePct?: number; value: number; source: string; target: string; pct?: number };
          };
          if (p.dataType === 'node') {
            const isNoise =
              p.name.includes('(Ignorado)') ||
              p.name === 'Em Aberto' ||
              p.name.startsWith('Sem Data ');
            return `
                    <div style="font-size:10px; color:${mutedTextColor}; margin-bottom:4px;">
                        ${isNoise ? 'QUALIDADE DE DADO' : 'MARCO CLÍNICO'}
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
          type: 'sankey',
          layout: 'none',
          emphasis: { focus: 'adjacency' },
          data: coloredNodes,
          links: coloredLinks,
          nodeWidth: isNarrow ? 12 : 18,
          nodeGap: isNarrow ? 12 : 48,
          draggable: false,
          label: {
            position: 'right',
            fontSize: isNarrow ? 8.5 : 11,
            color: labelColor,
            fontWeight: 'bold',
            distance: isNarrow ? 4 : 10,
          },
          lineStyle: {
            curveness: 0.5,
          },
        },
      ],
    };
  }, [nodes, links, theme, isNarrow]);

  const { chartRef } = useEcharts(option, [nodes, links, theme, isNarrow]);

  return <div ref={chartRef} className="echart-host" />;
};

// Extensão de arredondamento
declare global {
  interface Number {
    round(precision: number): number;
  }
}
Number.prototype.round = function (p: number) {
  const f = 10 ** p;
  return Math.round(this.valueOf() * f) / f;
};

export default SankeyChart;
