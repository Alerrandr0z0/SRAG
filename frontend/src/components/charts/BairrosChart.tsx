import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import * as Epi from '../../types/epi';
import { topItems } from '../../utils/chartData';

interface BairrosChartProps {
  data: Epi.NeighborhoodStats[];
}

const BairrosChart: React.FC<BairrosChartProps> = ({ data }) => {
  const items = topItems(data);
  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels: items.map((b) => b.bairro),
        datasets: [
          {
            data: items.map((b) => b.count),
            backgroundColor: COLORS.SECONDARY,
            borderRadius: 7,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    }),
    [items],
  );

  return <canvas ref={canvasRef} />;
};

export default BairrosChart;
