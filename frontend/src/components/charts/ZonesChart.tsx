import React from 'react';
import { COLORS } from '../../constants';
import * as Epi from '../../types/epi';
import { useChartJs } from '../../hooks/useChartJs';

interface ZonesChartProps {
  data: Epi.ZoneStats[];
}

const ZonesChart: React.FC<ZonesChartProps> = ({ data }) => {
  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels: data.map((z) => z.zona),
        datasets: [{
          data: data.map((z) => z.count),
          backgroundColor: COLORS.PRIMARY,
          borderRadius: 7,
        }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    }),
    [data],
  );

  return <canvas ref={canvasRef} />;
};

export default ZonesChart;
