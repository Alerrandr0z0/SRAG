import React from 'react';
import { COLORS } from '../../constants';
import { useEcharts } from '../../hooks/useEcharts';

interface BoxPlotChartProps {
  data: number[]; // [min, Q1, median, Q3, max]
  yAxisName?: string;
  seriesName?: string;
  color?: string;
  targetValue?: number;
  targetLabel?: string;
}

const BoxPlotChart: React.FC<BoxPlotChartProps> = ({
  data,
  yAxisName = 'Dias',
  seriesName = 'Distribuição',
  color = COLORS.PRIMARY,
  targetValue,
  targetLabel = 'Meta',
}) => {
  const option = {
    tooltip: {
      trigger: 'item',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: [seriesName],
      axisLabel: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: yAxisName,
      splitArea: {
        show: true,
      },
    },
    series: [
      {
        name: seriesName,
        type: 'boxplot',
        data: [data],
        itemStyle: {
          color: '#f8fafc',
          borderColor: color,
          borderWidth: 2,
        },
        markLine:
          targetValue !== undefined
            ? {
                silent: true,
                symbol: 'none',
                data: [
                  {
                    yAxis: targetValue,
                    label: { formatter: targetLabel, position: 'end' },
                  },
                ],
                lineStyle: { color: '#ef4444', type: 'dashed', width: 2 },
              }
            : undefined,
      },
    ],
  };

  const { chartRef } = useEcharts(option, [data]);

  const hasData = data && data.length === 5 && !data.every((v) => v === 0);

  if (!hasData) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px dashed #e2e8f0',
        }}
      >
        <p style={{ fontSize: '0.85rem' }}>Dados de latência insuficientes para o período.</p>
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
};

export default BoxPlotChart;
