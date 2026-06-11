import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';

interface AntiviralItem {
  label: string;
  count: number;
  specifications?: string[];
}

interface AntiviralDonutChartProps {
  data: AntiviralItem[];
}

const DRUG_COLORS: Record<string, string> = {
  'Oseltamivir': '#0f766e',
  'Paxlovid': '#6d28d9',
  'Zanamivir': '#b45309',
  'Lagevrio': '#0284c7',
  'Olumiant': '#ec4899',
  'Outro (Gripe)': '#64748b',
  'Outro (COVID)': '#475569',
};

interface EChartsPieParam {
  name: string;
  value: number;
  percent: number;
  marker: string;
}

const AntiviralDonutChart: React.FC<AntiviralDonutChartProps> = ({ data }) => {
  const safeData = useMemo(() => {
    return (Array.isArray(data) ? data : []).filter((item) => item.count > 0);
  }, [data]);

  const option = useMemo(() => {
    const chartData = safeData.map((item) => {
      const color = DRUG_COLORS[item.label] || '#94a3b8';
      return {
        value: item.count,
        name: item.label,
        itemStyle: { color },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1e293b',
        borderColor: '#475569',
        textStyle: { color: '#f8fafc' },
        formatter: (params: EChartsPieParam) => {
          const item = safeData.find((d) => d.label === params.name);
          const specs = item?.specifications;
          let tooltipHtml = `${params.marker} <b>${params.name}</b>: ${params.value} (${params.percent}%)`;
          if (specs && specs.length > 0) {
            tooltipHtml += `<br/><span style="font-size: 10px; color: #94a3b8; padding-left: 14px;">(${specs.join(', ')})</span>`;
          }
          return tooltipHtml;
        },
      },
      legend: {
        orient: 'vertical',
        right: '8%',
        top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 10 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 8,
        formatter: (name: string) => {
          const item = safeData.find((d) => d.label === name);
          return `${name} (${item ? item.count : 0})`;
        },
      },
      series: [
        {
          name: 'Fármacos',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#1e293b',
            borderWidth: 2,
          },
          label: { show: false },
          labelLine: { show: false },
          data: chartData,
        },
      ],
    };
  }, [safeData]);

  const { chartRef } = useEcharts(option, [safeData]);
  const hasData = safeData.length > 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!hasData && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '0.8rem',
            zIndex: 10,
            background: 'var(--bg-panel)',
          }}
        >
          <p>Sem dados de antiviral.</p>
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '100%', opacity: hasData ? 1 : 0 }} />
    </div>
  );
};

export default AntiviralDonutChart;
