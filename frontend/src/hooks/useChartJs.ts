import { useEffect, useRef } from 'react';

type ChartLike = { destroy: () => void };
type ChartCtor = { new (el: HTMLCanvasElement, options: unknown): ChartLike };

let chartLoader: Promise<ChartCtor>;

function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart as ChartCtor);
  }

  return chartLoader;
}

export function useChartJs<TOptions>(buildOptions: () => TOptions, dependencies: unknown[] = []) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<ChartLike | null>(null);
  const buildOptionsRef = useRef(buildOptions);
  const dependencyKey = JSON.stringify(dependencies);

  useEffect(() => {
    buildOptionsRef.current = buildOptions;
  }, [buildOptions]);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;

      if (chartInstance.current) chartInstance.current.destroy();

      chartInstance.current = new Chart(canvasRef.current, buildOptionsRef.current());
    };

    render();

    return () => {
      cancelled = true;
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [dependencyKey]);

  return { canvasRef, chartInstance };
}
