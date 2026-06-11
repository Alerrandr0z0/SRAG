import React, { useMemo } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import * as Epi from '../../types/epi';

type TooltipParam = { axisValue?: string; value?: number; marker?: string; seriesName?: string };

interface VaccinationProfileChartProps {
  vaccinationData: Epi.VaccinationProfile | null;
  selectedAgent?: string;
}

const VaccinationProfileChart: React.FC<VaccinationProfileChartProps> = ({
  vaccinationData,
  selectedAgent = '',
}) => {
  const option = useMemo(() => {
    if (!vaccinationData) return {};
    const covid = vaccinationData.covid_detailed || {};
    const gripe = vaccinationData.gripe || {};
    const isInfluenza = selectedAgent === 'Influenza';
    const isCovid = selectedAgent === 'COVID-19';

    const commonSeries = [
      {
        name: 'Não Vacinado',
        type: 'bar',
        stack: 'total',
        data: [gripe['Não Vacinado'] || 0, covid['Não Vacinado'] || 0],
        itemStyle: { color: '#b91c1c' },
      },
      {
        name: 'Ignorado',
        type: 'bar',
        stack: 'total',
        data: [gripe.Ignorado || 0, covid.Ignorado || 0],
        itemStyle: { color: '#94a3b8' },
      },
    ];

    if (isCovid) {
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: TooltipParam[]) => {
            if (!params.length) return '';
            const axisValue = params[0].axisValue;
            let res = `<div style="font-weight:bold;margin-bottom:5px;border-bottom:1px solid #eee;padding-bottom:3px;">${axisValue}</div>`;
            const items = params
              .filter((p) => p.value !== 0 && p.value !== undefined)
              .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
            if (items.length === 0) return `${axisValue}: Sem dados`;
            items.forEach((p) => {
              res += `<div style="display:flex;justify-content:space-between;gap:15px;font-size:12px;">
                              <span>${p.marker} ${p.seriesName}</span>
                              <span style="font-weight:bold;">${p.value}</span>
                          </div>`;
            });
            return `<div style="min-width:180px;">${res}</div>`;
          },
        },
        legend: { bottom: 0, textStyle: { fontSize: 9 }, type: 'scroll' },
        grid: { top: 40, left: '10%', right: '10%', bottom: 80, containLabel: true },
        xAxis: { type: 'value', name: 'Casos' },
        yAxis: { type: 'category', data: ['COVID-19'] },
        series: [
          {
            name: 'Bivalente',
            type: 'bar',
            stack: 'total',
            data: [covid.Bivalente || 0],
            itemStyle: { color: '#0f766e' },
          },
          {
            name: 'Reforços',
            type: 'bar',
            stack: 'total',
            data: [(covid['1º Reforço'] || 0) + (covid['2º Reforço'] || 0)],
            itemStyle: { color: '#1d4ed8' },
          },
          {
            name: 'Esquema Completo',
            type: 'bar',
            stack: 'total',
            data: [covid['Esquema Completo'] || 0],
            itemStyle: { color: '#b45309' },
          },
          {
            name: 'Dose 1',
            type: 'bar',
            stack: 'total',
            data: [covid['Dose 1'] || 0],
            itemStyle: { color: '#ca8a04' },
          },
          ...commonSeries.map((s) => ({ ...s, data: [s.data[1]] })),
        ],
      };
    }

    if (isInfluenza) {
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: TooltipParam[]) => {
            if (!params.length) return '';
            const axisValue = params[0].axisValue;
            let res = `<div style="font-weight:bold;margin-bottom:5px;border-bottom:1px solid #eee;padding-bottom:3px;">${axisValue}</div>`;
            const items = params
              .filter((p) => p.value !== 0 && p.value !== undefined)
              .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
            if (items.length === 0) return `${axisValue}: Sem dados`;
            items.forEach((p) => {
              res += `<div style="display:flex;justify-content:space-between;gap:15px;font-size:12px;">
                              <span>${p.marker} ${p.seriesName}</span>
                              <span style="font-weight:bold;">${p.value}</span>
                          </div>`;
            });
            return `<div style="min-width:180px;">${res}</div>`;
          },
        },
        legend: { bottom: 0, textStyle: { fontSize: 9 }, type: 'scroll' },
        grid: { top: 40, left: '10%', right: '10%', bottom: 80, containLabel: true },
        xAxis: { type: 'value', name: 'Casos' },
        yAxis: { type: 'category', data: ['Influenza'] },
        series: [
          {
            name: 'Protegido (Campanha Atual)',
            type: 'bar',
            stack: 'total',
            data: [gripe['Protegido (Campanha Atual)'] || 0],
            itemStyle: { color: '#15803d' },
          },
          {
            name: 'Gripe: Dose 2',
            type: 'bar',
            stack: 'total',
            data: [gripe['Gripe: Dose 2'] || 0],
            itemStyle: { color: '#16a34a' },
          },
          {
            name: 'Gripe: Dose 1',
            type: 'bar',
            stack: 'total',
            data: [gripe['Gripe: Dose 1'] || 0],
            itemStyle: { color: '#4ade80' },
          },
          {
            name: 'Gripe: Dose Única',
            type: 'bar',
            stack: 'total',
            data: [gripe['Gripe: Dose Única'] || 0],
            itemStyle: { color: '#86efac' },
          },
          {
            name: 'Imunidade Vencida',
            type: 'bar',
            stack: 'total',
            data: [gripe['Imunidade Vencida'] || 0],
            itemStyle: { color: '#ca8a04' },
          },
          ...commonSeries.map((s) => ({ ...s, data: [s.data[0]] })),
        ],
      };
    }

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: TooltipParam[]) => {
          if (!params.length) return '';
          const axisValue = params[0].axisValue; // 'Gripe' ou 'COVID-19'
          let res = `<div style="font-weight:bold;margin-bottom:5px;border-bottom:1px solid #eee;padding-bottom:3px;">${axisValue}</div>`;

          // Filtrar apenas os itens que pertencem a esta barra e possuem valor > 0
          const items = params
            .filter((p) => p.value !== 0 && p.value !== undefined)
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

          if (items.length === 0) return `${axisValue}: Sem dados`;

          items.forEach((p) => {
            res += `<div style="display:flex;justify-content:space-between;gap:15px;font-size:12px;">
                            <span>${p.marker} ${p.seriesName}</span>
                            <span style="font-weight:bold;">${p.value}</span>
                        </div>`;
          });
          return `<div style="min-width:180px;">${res}</div>`;
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 9 }, type: 'scroll' },
      grid: { top: 40, left: '10%', right: '10%', bottom: 80, containLabel: true },
      xAxis: { type: 'value', name: 'Casos' },
      yAxis: { type: 'category', data: ['Gripe', 'COVID-19'] },
      series: [
        // COVID Series
        {
          name: 'Bivalente',
          type: 'bar',
          stack: 'total',
          data: [0, covid.Bivalente || 0],
          itemStyle: { color: '#0f766e' },
        },
        {
          name: 'Reforços',
          type: 'bar',
          stack: 'total',
          data: [0, (covid['1º Reforço'] || 0) + (covid['2º Reforço'] || 0)],
          itemStyle: { color: '#1d4ed8' },
        },
        {
          name: 'Esquema Completo',
          type: 'bar',
          stack: 'total',
          data: [0, covid['Esquema Completo'] || 0],
          itemStyle: { color: '#b45309' },
        },
        {
          name: 'Dose 1',
          type: 'bar',
          stack: 'total',
          data: [0, covid['Dose 1'] || 0],
          itemStyle: { color: '#ca8a04' },
        },

        // GRIPE Series (Categorias Granulares)
        {
          name: 'Protegido (Campanha Atual)',
          type: 'bar',
          stack: 'total',
          data: [gripe['Protegido (Campanha Atual)'] || 0, 0],
          itemStyle: { color: '#15803d' },
        },
        {
          name: 'Gripe: Dose 2',
          type: 'bar',
          stack: 'total',
          data: [gripe['Gripe: Dose 2'] || 0, 0],
          itemStyle: { color: '#16a34a' },
        },
        {
          name: 'Gripe: Dose 1',
          type: 'bar',
          stack: 'total',
          data: [gripe['Gripe: Dose 1'] || 0, 0],
          itemStyle: { color: '#4ade80' },
        },
        {
          name: 'Gripe: Dose Única',
          type: 'bar',
          stack: 'total',
          data: [gripe['Gripe: Dose Única'] || 0, 0],
          itemStyle: { color: '#86efac' },
        },
        {
          name: 'Imunidade Vencida',
          type: 'bar',
          stack: 'total',
          data: [gripe['Imunidade Vencida'] || 0, 0],
          itemStyle: { color: '#ca8a04' },
        },

        // COMMON (Compartilhados)
        {
          name: 'Não Vacinado',
          type: 'bar',
          stack: 'total',
          data: [gripe['Não Vacinado'] || 0, covid['Não Vacinado'] || 0],
          itemStyle: { color: '#b91c1c' },
        },
        {
          name: 'Ignorado',
          type: 'bar',
          stack: 'total',
          data: [gripe.Ignorado || 0, covid.Ignorado || 0],
          itemStyle: { color: '#94a3b8' },
        },
        {
          name: 'Inconsistência',
          type: 'bar',
          stack: 'total',
          data: [gripe.Inconsistência || 0, 0],
          itemStyle: { color: '#475569' },
        },
      ],
    };
  }, [vaccinationData, selectedAgent]);

  const { chartRef } = useEcharts(option, [vaccinationData, selectedAgent]);

  return <div ref={chartRef} className="echart-host" style={{ width: '100%', height: '100%' }} />;
};

export default VaccinationProfileChart;
