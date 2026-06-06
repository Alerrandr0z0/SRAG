import { useCallback, useEffect, useRef, useState } from 'react';
import echarts from '../lib/echarts-heatmap';

/**
 * Hook robusto para gerenciar o ciclo de vida do ECharts no React.
 * Utiliza callback ref para detectar a montagem tardia e MutationObserver para o tema.
 */
export function useEcharts(
  opt: Record<string, unknown> | undefined | null,
  dependencies: unknown[] = [],
  options: { replaceOnUpdate?: boolean } = {},
) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [currentTheme, setCurrentTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'light',
  );
  const chartInstance = useRef<ReturnType<typeof echarts.init> | null>(null);
  const optRef = useRef(opt);

  // Sincroniza o ref com a versão mais recente do objeto de opções
  useEffect(() => {
    optRef.current = opt;
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

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (instance && !instance.isDisposed()) {
              requestAnimationFrame(() => {
                if (!instance.isDisposed()) instance.resize();
              });
            }
          })
        : null;
    if (resizeObserver) resizeObserver.observe(container);

    if (optRef.current) {
      instance.setOption({ ...optRef.current, backgroundColor: 'transparent' }, false);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [container, currentTheme]);

  // 2. Atualização de Dados (Reativo ao array de dependências explícito)
  useEffect(() => {
    const instance = chartInstance.current;
    if (instance && optRef.current && !instance.isDisposed()) {
      try {
        if (options.replaceOnUpdate) {
          (instance as { clear?: () => void }).clear?.();
        }
        // notMerge: true replaces the entire option so leftover keys from a
        // previous render (e.g. `title: 'Sem dados disponíveis'` set when data
        // was null) do not persist after real data arrives.
        instance.setOption({ ...optRef.current, backgroundColor: 'transparent' }, true);
        instance.resize();
      } catch (err) {
        console.error('ECharts Error:', err);
      }
    }
  }, [...dependencies, options.replaceOnUpdate]);

  return { chartRef };
}
