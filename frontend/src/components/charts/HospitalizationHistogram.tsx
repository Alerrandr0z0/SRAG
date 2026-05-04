import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { COLORS } from '../../constants';

interface HospitalizationHistogramProps {
  data: number[];
}

const HospitalizationHistogram: React.FC<HospitalizationHistogramProps> = ({ data }) => {
  const option = useMemo(() => {
    if (!data.length) return {};

    // Agrupar dados por dia (bins)
    const bins: Record<number, number> = {};
    data.forEach(d => {
        const day = Math.floor(d);
        if (day >= 0 && day <= 90) bins[day] = (bins[day] || 0) + 1;
    });

    const maxDay = Math.min(60, Math.max(0, ...data));
    const fullData: [number, number][] = [];
    for (let i = 0; i <= maxDay; i++) {
        fullData.push([i, bins[i] || 0]);
    }

    // Média Móvel para Suavização da Tendência (Linha)
    const smoothedData = fullData.map((val, idx) => {
      const windowSize = 2; // Janela menor para não achatar demais os picos
      let sum = 0, count = 0;
      for (let i = idx - windowSize; i <= idx + windowSize; i++) {
        if (i >= 0 && i < fullData.length) {
            sum += fullData[i][1];
            count++;
        }
      }
      return [val[0], sum / count];
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#94a3b8' } },
        formatter: (params: any[]) => {
            const b = params.find(p => p.seriesName === 'Frequência');
            if (!b) return '';
            return `Permanência: <b>${b.value[0]} dias</b><br/>Volume: <b>${b.value[1]} casos</b>`;
        }
      },
      grid: { top: 40, left: 50, right: 30, bottom: 60, containLabel: false },
      xAxis: {
        type: 'value',
        name: 'Dias de Internação',
        nameLocation: 'middle',
        nameGap: 35,
        min: 0,
        max: maxDay,
        splitLine: { show: false },
        axisLabel: { color: '#64748b' }
      },
      yAxis: {
        type: 'value',
        name: 'Casos',
        splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } },
        axisLabel: { color: '#64748b' }
      },
      series: [
        {
            name: 'Frequência',
            data: fullData,
            type: 'bar',
            barWidth: '90%',
            itemStyle: {
                color: COLORS.PRIMARY,
                opacity: 0.6,
                borderRadius: [4, 4, 0, 0]
            }
        },
        {
            name: 'Tendência',
            data: smoothedData,
            type: 'line',
            smooth: true,
            symbol: 'none',
            lineStyle: { color: COLORS.DANGER, width: 3, shadowBlur: 8, shadowColor: 'rgba(185, 28, 28, 0.3)' }
        }
      ]
    };
  }, [data]);

  const { chartRef } = useEcharts(option, [data]);

  return <div ref={chartRef} className="echart-host" />;
};

export default HospitalizationHistogram;
