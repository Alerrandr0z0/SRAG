import React, { useMemo } from "react";
import { useEcharts } from "../../hooks/useEcharts";

type HeatmapPoint = [number, number, number];
type HeatmapTooltip = { value: HeatmapPoint };

interface HeatmapChartProps {
  xLabels: string[];
  yLabels: string[];
  matrix: number[][];
  valueName?: string;
  colors?: string[];
}

const HeatmapChart: React.FC<HeatmapChartProps> = ({
  xLabels,
  yLabels,
  matrix,
  valueName = "Valor",
  colors = ["#f8fafc", "#93c5fd", "#1d4ed8"],
}) => {
  const option = useMemo(() => {
    const data: HeatmapPoint[] = [];
    let maxVal = 1;

    // Matrix: rows are yLabels, columns are xLabels
    for (let y = 0; y < yLabels.length; y++) {
      for (let x = 0; x < xLabels.length; x++) {
        const val = matrix[y]?.[x] || 0;
        if (val > maxVal) maxVal = val;
        data.push([x, y, val]);
      }
    }

    return {
      tooltip: {
        position: "top",
        formatter: (params: HeatmapTooltip) => {
          return `${yLabels[params.value[1]]} @ ${xLabels[params.value[0]]}<br/><b>${valueName}: ${params.value[2]}</b>`;
        },
      },
      grid: {
        top: 20,
        right: "10%",
        bottom: 70,
        left: "5%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: xLabels,
        splitArea: { show: true },
        axisLabel: { rotate: 35, interval: 0, fontSize: 10 },
      },
      yAxis: {
        type: "category",
        data: yLabels,
        splitArea: { show: true },
        inverse: true,
        axisLabel: { fontSize: 10 },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        itemWidth: 12,
        itemHeight: 120,
        inRange: { color: colors },
      },
      series: [
        {
          name: valueName,
          type: "heatmap",
          data: data,
          label: {
          show: true,
          fontSize: 9,
          formatter: (p: HeatmapTooltip) => (p.value[2] > 0 ? p.value[2] : ""),
        },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" },
          },
        },
      ],
    };
  }, [xLabels, yLabels, matrix, valueName, colors]);

  const { chartRef } = useEcharts(option, [xLabels, yLabels, matrix]);

  if (!xLabels.length || !yLabels.length || !matrix.length) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
        }}
      >
        <p>Aguardando processamento de matriz de incidência.</p>
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: "100%", height: "100%" }} />;
};

export default HeatmapChart;
