import { useEffect, useRef, useState } from 'react';

type ChartLike = { destroy: () => void };
type ChartCtor = {
  new (el: HTMLCanvasElement, options: unknown): ChartLike;
  defaults: {
    color: string;
    borderColor: string;
    [key: string]: unknown;
  };
};

let chartLoader: Promise<ChartCtor>;

function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart as unknown as ChartCtor);
  }

  return chartLoader;
}

export function useChartJs<TOptions>(buildOptions: () => TOptions, dependencies: unknown[] = []) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<ChartLike | null>(null);
  const buildOptionsRef = useRef(buildOptions);
  const [currentTheme, setCurrentTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'light',
  );

  // Sincroniza o ref com a versão mais recente da função buildOptions
  useEffect(() => {
    buildOptionsRef.current = buildOptions;
  });

  // Escuta mudanças de tema no <html>
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      setCurrentTheme(theme);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;

      if (chartInstance.current) chartInstance.current.destroy();

      Chart.defaults.color = currentTheme === 'dark' ? '#94a3b8' : '#64748b';
      Chart.defaults.borderColor = currentTheme === 'dark' ? '#334155' : '#e2e8f0';

      // Usamos buildOptionsRef.current() para garantir que pegamos a lógica mais nova
      // sem depender da estabilidade da função passada por parâmetro.
      chartInstance.current = new Chart(canvasRef.current, buildOptionsRef.current());
    };

    render();

    // ResizeObserver garante que o gráfico se ajuste ao container
    let resizeObserver: ResizeObserver | null = null;
    if (
      typeof ResizeObserver !== 'undefined' &&
      canvasRef.current &&
      canvasRef.current.parentElement
    ) {
      resizeObserver = new ResizeObserver(() => {
        if (chartInstance.current) {
          (chartInstance.current as unknown as { resize: () => void }).resize();
        }
      });
      resizeObserver.observe(canvasRef.current.parentElement);
    }

    return () => {
      cancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [currentTheme, ...dependencies]);

  return { canvasRef, chartInstance };
}
