import React, { useMemo, useState } from 'react';
import * as Epi from '../../types/epi';
import AggregatedSwimmerPlot from '../charts/AggregatedSwimmerPlot';
import HospitalizationHistogram from '../charts/HospitalizationHistogram';
import IcuRidgelinePlot from '../charts/IcuRidgelinePlot';
import SankeyChart from '../charts/SankeyChart';
import UnitsChart from '../charts/UnitsChart';

interface UnitsPanelProps {
  loading: boolean;
  units: Epi.UnitStats[];
  hospitalization: number[];
  clinicalFlow: Epi.ClinicalFlow;
  timelineData: Epi.AggregatedTimeline[];
  icuBottleneck: Epi.IcuBottleneckRecord[];
  swimmerVirus: 'covid' | 'gripe';
  setSwimmerVirus: (v: 'covid' | 'gripe') => void;
  dashboardYear?: number[];
  chartDebug?: boolean;
}

const UnitsPanel: React.FC<UnitsPanelProps> = ({
  loading,
  units,
  hospitalization,
  clinicalFlow,
  timelineData,
  icuBottleneck = [],
  swimmerVirus,
  setSwimmerVirus,
  dashboardYear = [],
}) => {
  const isYearSelected = dashboardYear.length > 0;
  const [icuGroupBy, setIcuGroupBy] = useState<Epi.TemporalGrouping>('year');

  // Ajuste automático: Se um ano for selecionado e o modo estiver como "ano", muda para "mês"
  React.useEffect(() => {
    if (isYearSelected && icuGroupBy === 'year') {
      setIcuGroupBy('month');
    }
  }, [isYearSelected, icuGroupBy]);

  const icuSummary = useMemo(() => {
    if (!icuBottleneck?.length) return null;
    const total = icuBottleneck.length;
    const sameDay = icuBottleneck.filter((d) => d.wait_days === 0).length;
    const waitMore = total - sameDay;
    return {
      total,
      sameDay,
      sameDayRate: ((sameDay / total) * 100).toFixed(1),
      waitMore,
      waitMoreRate: ((waitMore / total) * 100).toFixed(1),
    };
  }, [icuBottleneck]);

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      {loading && <p className="meta">Carregando dados de unidades...</p>}

      <article className="panel">
        <div className="section-header">
          <h3>Unidades notificadoras</h3>
        </div>
        <div className="chart-wrap">
          <UnitsChart data={units || []} />
        </div>
      </article>

      <article className="panel">
        <div className="section-header">
          <h3>Tempo de Internação</h3>
        </div>
        <div className="chart-wrap">
          <HospitalizationHistogram data={hospitalization || []} />
        </div>
      </article>

      <article className="panel">
        <div className="section-header">
          <h3>Fluxo da Jornada Clínica</h3>
        </div>
        <div className="chart-wrap--tall">
          {clinicalFlow?.nodes && clinicalFlow?.links && (
            <SankeyChart
              nodes={clinicalFlow.nodes as Array<{ name: string }>}
              links={
                clinicalFlow.links as Array<{
                  source: string;
                  target: string;
                  value: number;
                  pct?: number;
                }>
              }
            />
          )}
        </div>
      </article>

      {/* Ridgeline Plot com Contexto de Volume */}
      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <div>
            <h3>Gargalo de Acesso à UTI</h3>
            <p className="meta">Análise de eficiência na admissão crítica</p>
          </div>
          <div className="filters">
            <div
              className="tab-row"
              style={{
                gridTemplateColumns: `repeat(${isYearSelected ? 2 : 3}, 80px)`,
                gap: '4px',
              }}
            >
              {(['year', 'month', 'week'] as const)
                .filter((mode) => !(isYearSelected && mode === 'year'))
                .map((mode) => (
                  <button
                    key={mode}
                    className={`tab-btn ${icuGroupBy === mode ? 'active' : ''}`}
                    style={{
                      padding: '4px',
                      fontSize: '11px',
                      borderRadius: '6px',
                    }}
                    onClick={() => setIcuGroupBy(mode)}
                  >
                    {mode === 'year' ? 'Ano' : mode === 'month' ? 'Mês' : 'Semana'}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Quadro de Contexto Híbrido */}
        {icuSummary && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-status)',
              padding: '16px',
              borderRadius: '8px',
              marginTop: '15px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Perfil de Admissão
                </span>
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    height: '8px',
                    marginTop: '6px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: 'var(--bg-pill)',
                  }}
                >
                  <div
                    style={{
                      width: `${icuSummary.sameDayRate}%`,
                      background: '#0f766e',
                    }}
                  ></div>
                  <div
                    style={{
                      width: `${icuSummary.waitMoreRate}%`,
                      background: '#d97706',
                    }}
                  ></div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '30px' }}>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#0f766e',
                    fontWeight: 'bold',
                  }}
                >
                  ● Admissão no Mesmo Dia
                </span>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                  {icuSummary.sameDayRate}%{' '}
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      fontWeight: 'normal',
                    }}
                  >
                    ({icuSummary.sameDay} casos)
                  </span>
                </div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#d97706',
                    fontWeight: 'bold',
                  }}
                >
                  ● Tempo de Espera {'>'} 0d
                </span>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                  {icuSummary.waitMoreRate}%{' '}
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      fontWeight: 'normal',
                    }}
                  >
                    ({icuSummary.waitMore} casos)
                  </span>
                </div>
              </div>
            </div>
            <p
              style={{
                margin: '10px 0 0 0',
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              O gráfico abaixo detalha apenas os {icuSummary.waitMoreRate}% de pacientes que não
              foram admitidos imediatamente.
            </p>
          </div>
        )}

        <div style={{ marginTop: '25px' }}>
          <IcuRidgelinePlot data={icuBottleneck} groupBy={icuGroupBy} />
        </div>

        <p
          className="meta"
          style={{
            marginTop: '10px',
            fontSize: '11px',
            fontStyle: 'italic',
            lineHeight: '1.4',
          }}
        >
          * Exibidos apenas períodos com ≥{' '}
          {icuGroupBy === 'year' ? 50 : icuGroupBy === 'month' ? 20 : 10} admissões.
        </p>
      </article>

      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <h3>Jornada Clínica por Perfil Vacinal</h3>
          <div className="filters">
            <select
              value={swimmerVirus}
              onChange={(e) => setSwimmerVirus(e.target.value as 'covid' | 'gripe')}
              style={{ padding: '4px 8px', borderRadius: '6px' }}
            >
              <option value="covid">Visão COVID-19</option>
              <option value="gripe">Visão Influenza</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '20px' }}>
          <AggregatedSwimmerPlot data={timelineData} swimmerVirus={swimmerVirus} />
        </div>
      </article>
    </div>
  );
};

export default UnitsPanel;
