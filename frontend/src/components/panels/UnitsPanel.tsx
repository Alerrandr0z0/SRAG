import React, { useState } from 'react';
import UnitsChart from '../charts/UnitsChart';
import HospitalizationHistogram from '../charts/HospitalizationHistogram';
import SankeyChart from '../charts/SankeyChart';
import AggregatedSwimmerPlot from '../charts/AggregatedSwimmerPlot';
import IcuRidgelinePlot from '../charts/IcuRidgelinePlot';
import * as Epi from '../../types/epi';

interface UnitsPanelProps {
  loading: boolean;
  units: Epi.UnitStats[];
  hospitalization: number[];
  clinicalFlow: Epi.ClinicalFlow;
  timelineData: Epi.AggregatedTimeline[];
  icuBottleneck: Epi.IcuBottleneckRecord[];
  swimmerVirus: 'covid' | 'gripe';
  setSwimmerVirus: (v: 'covid' | 'gripe') => void;
}

const UnitsPanel: React.FC<UnitsPanelProps> = ({
  loading,
  units,
  hospitalization,
  clinicalFlow,
  timelineData,
  icuBottleneck,
  swimmerVirus,
  setSwimmerVirus
}) => {
  const [icuGroupBy, setIcuGroupBy] = useState<Epi.TemporalGrouping>('year');

  return (
    <div className="stack">
      {loading && <p className="meta">Carregando dados de unidades...</p>}
      
      <h3>Unidades notificadoras</h3>
      <div className="chart-wrap">
        <UnitsChart data={units || []} />
      </div>

      <h3>Tempo de Internação (Histograma)</h3>
      <div className="chart-wrap">
        <HospitalizationHistogram data={hospitalization || []} />
      </div>

      <h3>Fluxo da Jornada Clínica (Sankey)</h3>
      <div className="chart-wrap" style={{ height: '450px' }}>
        <SankeyChart nodes={clinicalFlow.nodes} links={clinicalFlow.links} />
      </div>

      {/* Ridgeline Plot Estatístico */}
      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <div>
            <h3>Gargalo de Acesso à UTI</h3>
            <p className="meta">Distribuição do tempo de resposta crítico</p>
          </div>
          <div className="filters">
            <div className="tab-row" style={{ gridTemplateColumns: 'repeat(3, 80px)', gap: '4px' }}>
              {(['year', 'month', 'week'] as const).map(mode => (
                <button 
                  key={mode}
                  className={`tab-btn ${icuGroupBy === mode ? 'active' : ''}`}
                  style={{ padding: '4px', fontSize: '11px', borderRadius: '6px' }}
                  onClick={() => setIcuGroupBy(mode)}
                >
                  {mode === 'year' ? 'Ano' : mode === 'month' ? 'Mês' : 'Semana'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Guia de Leitura Rápida (Sóbrio) */}
        <div style={{ 
            display: 'flex', 
            gap: '20px', 
            background: '#f8fafc', 
            padding: '12px', 
            borderRadius: '8px', 
            marginTop: '15px',
            border: '1px solid #e2e8f0'
        }}>
            <div style={{ flex: 1 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0f766e', textTransform: 'uppercase' }}>Fluxo Normal</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>Curvas concentradas à esquerda (0-2 dias) indicam que a rede está absorvendo os casos críticos com agilidade.</p>
            </div>
            <div style={{ width: '1px', background: '#e2e8f0' }}></div>
            <div style={{ flex: 1 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#b91c1c', textTransform: 'uppercase' }}>Saturação ou Fila</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>Curvas deslocadas para a direita ou achatadas indicam aumento no tempo de espera e possível pressão sobre os leitos.</p>
            </div>
        </div>
        
        <div style={{ marginTop: '25px' }}>
          <IcuRidgelinePlot data={icuBottleneck} groupBy={icuGroupBy} />
        </div>
        
        <p className="meta" style={{ marginTop: '10px', fontSize: '11px', fontStyle: 'italic', lineHeight: '1.4' }}>
          * As curvas são normalizadas individualmente para permitir a comparação da forma da distribuição entre diferentes períodos.<br/>
          * Períodos com volume de casos insuficiente para análise estatística confiável são automaticamente omitidos para reduzir ruído.
        </p>
      </article>

      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <h3>Jornada Clínica por Perfil Vacinal (Rede Geral)</h3>
          <div className="filters">
            <select 
              value={swimmerVirus} 
              onChange={(e) => setSwimmerVirus(e.target.value as any)}
              style={{ padding: '4px 8px', borderRadius: '6px' }}
            >
              <option value="covid">Visão COVID-19</option>
              <option value="gripe">Visão Influenza</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '20px' }}>
          <AggregatedSwimmerPlot data={timelineData} />
        </div>
      </article>
    </div>
  );
};

export default UnitsPanel;
