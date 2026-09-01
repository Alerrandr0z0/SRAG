import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { buildDonutItems } from '../../utils/chartData';

interface VigilanceDonutChartProps {
  data: Array<{ label: string; count: number }>;
  title: string;
}

const DONUT_COLORS = [
  '#0f766e',
  '#0d9488',
  '#2dd4bf',
  '#99f6e4',
  '#ccfbf1',
  '#64748b',
  '#94a3b8',
  '#cbd5e1',
];

const VigilanceDonutChart: React.FC<VigilanceDonutChartProps> = ({ data, title }) => {
  const option = useMemo(() => {
    // Garantia de que data é um array válido
    const safeData = Array.isArray(data) ? data : [];
    const donutData = buildDonutItems(safeData, DONUT_COLORS).map((item) => ({
      value: item.value,
      name: item.name,
      itemStyle: { color: item.color },
    }));

    return {
      title: {
        text: title || '',
        left: 'center',
        textStyle: { fontSize: 11, fontWeight: 700, color: '#64748b' },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        appendToBody: false,
        formatter: '{b}: <b>{c}</b> ({d}%)',
        extraCssText: 'max-width:220px;white-space:normal;word-break:break-word;',
      },
      legend: {
        show: false,
      },
      series: [
        {
          name: title || 'Distribuição',
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold',
              formatter: '{b}',
            },
          },
          labelLine: {
            show: false,
          },
          data: donutData,
        },
      ],
    };
  }, [data, title]);

  const { chartRef } = useEcharts(option, [data, title]);

  const hasData = Array.isArray(data) && data.length > 0;

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
          <p>Sem dados para exibição.</p>
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '100%', opacity: hasData ? 1 : 0 }} />
    </div>
  );
};

export default VigilanceDonutChart;
