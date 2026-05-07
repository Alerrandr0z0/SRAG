import React, { useState } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { COLORS } from '../../constants';

interface EpidemicCurveChartProps {
  virusTrends: Array<{ epi_week: string; virus: string; count: number }>;
  positivityTrend: Array<{ epi_week: string; tested: number; positive: number; positivity_rate: number }>;
}

type Mode = 'composicao' | 'positividade' | 'acumulado';

const AGENT_COLORS: Record<string, string> = {
  'VSR': '#0f766e',
  'Influenza': '#1d4ed8',
  'COVID-19': '#b91c1c',
  'Outros Vírus': '#7c3aed',
  'Outro Agente': '#475569',
  'Não Especificada': '#94a3b8',
};

const EpidemicCurveChart: React.FC<EpidemicCurveChartProps> = ({ virusTrends, positivityTrend }) => {
  const [mode, setMode] = useState<Mode>('positividade');
  const [weeksWindow, setWeeksWindow] = useState('0'); // 0 = Tudo

  const getOption = () => {
    // 1. Get full sorted weeks
    let allWeeks = Array.from(new Set(virusTrends.map(d => d.epi_week))).sort();
    
    // 2. Filter by window if applicable
    if (weeksWindow !== '0') {
      const limit = parseInt(weeksWindow);
      allWeeks = allWeeks.slice(-limit);
    }

    const baseTitle = {
      text: 'Circulação Viral Confirmada',
      left: 0,
      top: 0,
      textStyle: { 
        fontSize: 20, 
        color: '#1e293b', 
        fontWeight: 600,
        fontFamily: 'inherit'
      }
    };

    if (mode === 'composicao') {
      const agents = Array.from(new Set(virusTrends.map(d => d.virus))).filter(Boolean);

      const series = agents.map(agent => {
        const data = allWeeks.map(week => {
          const found = virusTrends.find(d => d.epi_week === week && d.virus === agent);
          return found ? found.count : 0;
        });
        return {
          name: agent,
          type: 'line',
          stack: 'Total',
          areaStyle: {},
          emphasis: { focus: 'series' },
          data,
          itemStyle: { color: AGENT_COLORS[agent] || COLORS.SECONDARY },
          symbol: 'none'
        };
      });

      return {
        title: baseTitle,
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: agents, bottom: 0, icon: 'circle' },
        grid: { left: '30px', right: '4%', bottom: '60px', top: '25px', containLabel: true },
        xAxis: [{ type: 'category', boundaryGap: false, data: allWeeks }],
        yAxis: [{ type: 'value', name: 'Casos Positivos' }],
        series
      };
    } else if (mode === 'acumulado') {
      // Calculate cumulative sum of totals per week
      const weeklyTotals = allWeeks.map(week => {
        return virusTrends
          .filter(d => d.epi_week === week)
          .reduce((sum, d) => sum + d.count, 0);
      });

      let currentSum = 0;
      const cumulativeData = weeklyTotals.map(val => {
        currentSum += val;
        return currentSum;
      });

      return {
        title: baseTitle,
        tooltip: { trigger: 'axis' },
        grid: { left: '40px', right: '4%', bottom: '60px', top: '25px', containLabel: true },
        xAxis: [{ type: 'category', boundaryGap: false, data: allWeeks }],
        yAxis: [{ type: 'value', name: 'Total Acumulado' }],
        series: [{
          name: 'Acumulado',
          type: 'line',
          data: cumulativeData,
          itemStyle: { color: COLORS.PRIMARY },
          areaStyle: { color: 'rgba(15,118,110,0.1)' },
          smooth: true
        }]
      };
    } else {
      const filteredPositivity = positivityTrend.filter(d => allWeeks.includes(d.epi_week));
      const weeks = filteredPositivity.map((d) => d.epi_week);
      const tested = filteredPositivity.map((d) => d.tested);
      const positive = filteredPositivity.map((d) => d.positive);
      const rates = filteredPositivity.map((d) => d.positivity_rate);

      return {
        title: baseTitle,
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: ['Exames', 'Positivos', 'Taxa (%)'], bottom: 0 },
        grid: { left: '3%', right: '3%', bottom: '15%', top: '25px', containLabel: true },
        xAxis: [{ type: 'category', data: weeks, axisPointer: { type: 'shadow' } }],
        yAxis: [
          { type: 'value', name: 'Volume', min: 0 },
          { type: 'value', name: 'Taxa (%)', min: 0, max: 100, position: 'right', axisLabel: { formatter: '{value}%' } }
        ],
        series: [
          { name: 'Exames', type: 'bar', data: tested, itemStyle: { color: '#e2e8f0' }, barGap: '-100%', barCategoryGap: '30%' },
          { name: 'Positivos', type: 'bar', data: positive, itemStyle: { color: COLORS.PRIMARY } },
          { name: 'Taxa (%)', type: 'line', yAxisIndex: 1, data: rates, itemStyle: { color: '#ef4444' }, lineWidth: 3, symbolSize: 6 }
        ]
      };
    }
  };

  const { chartRef } = useEcharts(getOption(), [virusTrends, positivityTrend, mode, weeksWindow]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', gap: '1rem', alignItems: 'center' }}>
        <div className="pill-group">
          {[
            { v: '0', l: 'Tudo' },
            { v: '52', l: '52s' },
            { v: '26', l: '26s' },
            { v: '12', l: '12s' }
          ].map(opt => (
            <button
              key={opt.v}
              className={`pill-btn ${weeksWindow === opt.v ? 'active' : ''}`}
              onClick={() => setWeeksWindow(opt.v)}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            >
              {opt.l}
            </button>
          ))}
        </div>
        
        <select 
          value={mode} 
          onChange={e => setMode(e.target.value as Mode)}
          style={{ fontSize: '0.8rem', padding: '0.25rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
        >
          <option value="composicao">Composição</option>
          <option value="acumulado">Acumulado</option>
          <option value="positividade">Taxa de Positividade</option>
        </select>
      </div>
      <div ref={chartRef} style={{ flexGrow: 1, width: '100%' }} />
    </div>
  );
};

export default EpidemicCurveChart;
