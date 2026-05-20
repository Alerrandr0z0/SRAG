import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import * as Epi from '../../types/epi';

interface UnitsChartProps {
  data: Epi.UnitStats[];
}

const UnitsChart: React.FC<UnitsChartProps> = ({ data }) => {
  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels: data.map((u) => u.nome_fantasia || u.id_unidade),
        datasets: [
          {
            data: data.map((u) => u.count),
            backgroundColor: COLORS.PRIMARY,
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
    [data],
  );

  return <canvas ref={canvasRef} />;
};

export default UnitsChart;
