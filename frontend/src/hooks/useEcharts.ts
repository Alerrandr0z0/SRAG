import { useEffect, useRef } from 'react';
import echarts from '../lib/echarts-heatmap';

export function useEcharts(opt: unknown, dependencies: unknown[] = []) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<{ setOption: (_option: unknown) => void; resize: () => void; dispose: () => void } | null>(null);
  const dependencyKey = JSON.stringify(dependencies);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const instance = chartInstance.current;
    if (!instance) return;

    if (opt) {
      instance.setOption(opt);
    }

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [opt, dependencyKey]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return { chartRef, chartInstance };
}
