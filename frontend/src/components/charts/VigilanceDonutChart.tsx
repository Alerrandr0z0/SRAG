import React from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { buildDonutItems } from '../../utils/chartData';

interface VigilanceDonutChartProps {
  data: Array<{ label: string; count: number }>;
  title: string;
}

const VigilanceDonutChart: React.FC<VigilanceDonutChartProps> = ({ data, title }) => {
  const colors = [
    '#0f766e', '#0d9488', '#2dd4bf', '#99f6e4', '#ccfbf1',
    '#64748b', '#94a3b8', '#cbd5e1'
  ];

  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 11, fontWeight: 700, color: '#64748b' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: <b>{c}</b> ({d}%)'
    },
    legend: {
      show: false
    },
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['50%', '80%'],
        center: data.length < 8 ? ['40%', '50%'] : ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold',
            formatter: '{b}'
          }
        },
        labelLine: {
          show: false
        },
        data: buildDonutItems(data, colors).map((item) => ({
          value: item.value,
          name: item.name,
          itemStyle: { color: item.color },
        }))
      }
    ]
  };

  const { chartRef } = useEcharts(option, [data, title]);

  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
        <p>Sem dados para exibição.</p>
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
};

export default VigilanceDonutChart;
