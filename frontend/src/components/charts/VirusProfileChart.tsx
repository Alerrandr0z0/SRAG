import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import * as Epi from '../../types/epi';

interface VirusProfileChartProps {
  data: Epi.VirusData[];
}

const VirusProfileChart: React.FC<VirusProfileChartProps> = ({ data }) => {
  const { canvasRef } = useChartJs(
    () => ({
      type: 'doughnut',
      data: {
        labels: data.map((d) => d.virus),
        datasets: [
          {
            data: data.map((d) => d.count),
            backgroundColor: COLORS.CHART,
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false, // Custom HTML legend below
          },
        },
      },
    }),
    [data],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '4px 6px',
          marginTop: '10px',
          padding: '0 4px',
        }}
      >
        {data.map((d, index) => {
          const color = COLORS.CHART[index % COLORS.CHART.length];
          return (
            <div
              key={d.virus}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '9px',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
                title={`${d.virus}: ${d.count}`}
              >
                {d.virus}: <b>{d.count}</b>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirusProfileChart;
