import { useEffect, useRef, useCallback, useState } from 'react';
import echarts from '../lib/echarts-heatmap';

/**
 * Hook robusto para gerenciar o ciclo de vida do ECharts no React.
 * Utiliza callback ref para detectar a montagem tardia e MutationObserver para o tema.
 */
export function useEcharts(opt: any, dependencies: any[] = []) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [currentTheme, setCurrentTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');
  const chartInstance = useRef<any>(null);
  const dependencyKey = JSON.stringify(dependencies);

  // Escuta mudanças de tema no <html>
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      setCurrentTheme(theme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const chartRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setContainer(node);
    }
  }, []);

  // 1. Inicialização e Destruição (Reativo ao container e ao tema)
  useEffect(() => {
    if (!container) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    const instance = echarts.init(container, currentTheme);
    chartInstance.current = instance;

    const resizeObserver = new ResizeObserver(() => {
      if (instance && !instance.isDisposed()) {
        requestAnimationFrame(() => {
          if (!instance.isDisposed()) instance.resize();
        });
      }
    });
    resizeObserver.observe(container);

    if (opt) {
      // Forçamos o background transparente para não conflitar com os cards do dashboard
      instance.setOption({ ...opt, backgroundColor: 'transparent' }, true);
    }

    return () => {
      resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [container, currentTheme]);

  // 2. Atualização de Dados
  useEffect(() => {
    const instance = chartInstance.current;
    if (instance && opt && !instance.isDisposed()) {
      try {
        instance.setOption({ ...opt, backgroundColor: 'transparent' }, true);
        instance.resize();
      } catch (err) {
        console.error("ECharts Error:", err);
      }
    }
  }, [opt, dependencyKey]);

  return { chartRef };
}
