import React, { useState } from 'react';
import * as Epi from '../../types/epi';
import EpidemicCurveChart from '../charts/EpidemicCurveChart';
import HeatmapChart from '../charts/HeatmapChart';
import KaplanMeierChart from '../charts/KaplanMeierChart';
import NotificationDelayChart from '../charts/NotificationDelayChart';
import QualidadePerformance, {
  BoxStats,
  QualidadePerformanceData,
} from '../charts/QualidadePerformance';
import KpiCard from '../ui/KpiCard';

interface VigilancePanelProps {
  loading: boolean;
  laboratoryNetwork: Epi.LaboratoryNetwork | undefined;
}

const VigilancePanel: React.FC<VigilancePanelProps> = ({ loading, laboratoryNetwork }) => {
  const [curveMode, setCurveMode] = useState<'composicao' | 'positividade' | 'acumulado'>(
    'positividade',
  );
  const [curveWeeks, setCurveWeeks] = useState('0');
  const [delayWeeks, setDelayWeeks] = useState('0');

  if (loading) return <p className="meta">Carregando inteligência de vigilância...</p>;

  const overall = laboratoryNetwork?.overall;
  const quality = laboratoryNetwork?.quality_metrics;
  const treatment = laboratoryNetwork?.treatment_metrics;
  const delaySeries = laboratoryNetwork?.notification_delay || [];
  const virusTrends = laboratoryNetwork?.virus_trends || [];
  const antiviralTypes = laboratoryNetwork?.antiviral_types || [];
  const positivityTrend = laboratoryNetwork?.positivity_trend || [];

  // Data mapping for QualidadePerformance (D3)
  const mapBoxPlot = (data: number[] | undefined, label: string): BoxStats => {
    const vals = data && data.length === 5 ? data : [0, 0, 0, 0, 0];
    return { min: vals[0], q1: vals[1], median: vals[2], q3: vals[3], max: vals[4], label };
  };

  const closureTotal =
    (laboratoryNetwork?.closure_criteria || []).reduce((s, c) => s + c.count, 0) || 1;
  const criteriaColors = ['#0f766e', '#888780', '#b4b2a9', '#d3d1c7'];

  const performanceData: QualidadePerformanceData = {
    criterios: (laboratoryNetwork?.closure_criteria || []).map((c, i) => ({
      label: c.label,
      valor: (c.count / closureTotal) * 100,
      color: criteriaColors[i] || '#94a3b8',
    })),
    latencia: mapBoxPlot(quality?.diagnostic_latency?.boxplot_data, 'Latência'),
    antiviral: (() => {
      const types = antiviralTypes || [];
      const totalTreatments = types.reduce((sum, a) => sum + a.count, 0) || 1;
      return types.map((a) => {
        const pct = (a.count / totalTreatments) * 100;
        let status: 'ok' | 'warn' | 'raro' = 'ok';
        if (a.label.toLowerCase().includes('zanamivir')) status = 'raro';
        else if (a.label.toLowerCase().includes('outro')) status = 'warn';
        return { nome: a.label, pct, casos: a.count, status };
      });
    })(),
    oportunidade: mapBoxPlot(treatment?.antiviral_latency?.boxplot_data, 'Oportunidade'),
    oportunidadeMeta: 2,
    coberturaTestagem: {
      collected: quality?.testing_coverage?.collected || 0,
      total: quality?.testing_coverage?.total || 0,
      rate: quality?.testing_coverage?.rate || 0,
    },
    distribuicaoAmostra: quality?.sample_type_distribution || [],
  };

  const metricCards = [
    {
      label: 'Positividade Geral',
      value: `${overall?.positive_rate || 0}%`,
      className: 'vigilance-metric vigilance-metric--green',
    },
    {
      label: 'Testados',
      value: `${overall?.tested_cases || 0}`,
      className: 'vigilance-metric vigilance-metric--slate',
    },
    {
      label: 'Co-detecção',
      value: `${overall?.codetection_cases || 0}`,
      className: 'vigilance-metric vigilance-metric--red',
    },
    {
      label: 'Reinfecções',
      value: `${overall?.reinfection_total || 0}`,
      className: 'vigilance-metric vigilance-metric--pink',
    },
    {
      label: 'Adesão Antiviral (48h)',
      value: `${overall?.protocol_48h_adherence_rate || 0}%`,
      className: 'vigilance-metric vigilance-metric--teal',
    },
    {
      label: 'Latência Diagnóstica',
      value: `${overall?.median_turnaround_days || 0}d`,
      className: 'vigilance-metric vigilance-metric--amber',
    },
  ];

  return (
    <div className="stack vigilance-shell" style={{ gap: '2rem' }}>
      <header className="vigilance-clean-header">
        <div>
          <p className="eyebrow">Inteligência Epidemiológica</p>
          <h2 style={{ margin: '0.25rem 0' }}>Monitoramento de Processos e Patógenos</h2>
        </div>
      </header>

      <div className="vigilance-metric-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {metricCards.map((card) => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.value}
            className={card.className}
          />
        ))}
      </div>

      {/* BLOCO 1: CIRCULAÇÃO VIRAL CONFIRMADA */}
      <section className="vigilance-block">
        <div className="vigilance-insight-grid" style={{ gridTemplateColumns: '1fr' }}>
          <article className="panel">
            <div className="section-header">
              <div className="stack" style={{ gap: 4 }}>
                <h3 style={{ margin: 0 }}>Circulação Viral Confirmada</h3>
                {virusTrends.length > 0 && (
                  <div className="filters" style={{ fontSize: '12px', color: '#64748b', gap: 12 }}>
                    <span>
                      Total Positivos: <b>{virusTrends.reduce((s, h) => s + h.count, 0)}</b>
                    </span>
                  </div>
                )}
              </div>
              <div className="filters">
                <div className="pill-group">
                  {[
                    { v: '0', l: 'Tudo' },
                    { v: '52', l: '52s' },
                    { v: '26', l: '26s' },
                    { v: '12', l: '12s' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      className={`pill-btn ${curveWeeks === opt.v ? 'active' : ''}`}
                      onClick={() => setCurveWeeks(opt.v)}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                <select
                  value={curveMode}
                  onChange={(e) =>
                    setCurveMode(e.target.value as 'composicao' | 'positividade' | 'acumulado')
                  }
                >
                  <option value="composicao">Composição</option>
                  <option value="acumulado">Acumulado</option>
                  <option value="positividade">Taxa de Positividade</option>
                </select>
              </div>
            </div>
            <div className="chart-wrap chart-wrap--tall">
              <EpidemicCurveChart
                virusTrends={virusTrends}
                positivityTrend={positivityTrend}
                forcedMode={curveMode}
                forcedWeeks={curveWeeks}
              />
            </div>
          </article>
        </div>
      </section>

      {/* BLOCO 2: SEVERIDADE VIRAL */}
      <section className="vigilance-block">
        <article className="panel">
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <h3 style={{ margin: 0 }}>Letalidade por Agente e Idade</h3>
            </div>
          </div>
          <div className="chart-wrap chart-wrap--tall">
            <HeatmapChart
              xLabels={laboratoryNetwork?.agent_lethality_heatmap?.age_bands || []}
              yLabels={laboratoryNetwork?.agent_lethality_heatmap?.agents || []}
              matrix={laboratoryNetwork?.agent_lethality_heatmap?.matrix || []}
              valueName="Letalidade (%)"
              colors={['#fff1f2', '#f43f5e', '#9f1239']}
            />
          </div>
        </article>
      </section>

      {/* ATRASO DE NOTIFICAÇÃO */}
      <section className="vigilance-block">
        <div className="vigilance-insight-grid" style={{ gridTemplateColumns: '1fr' }}>
          <article className="panel">
            <div className="section-header">
              <div className="stack" style={{ gap: 4 }}>
                <h3 style={{ margin: 0 }}>Atraso de Notificação</h3>
                {delaySeries.length > 0 && (
                  <div
                    className="filters"
                    style={{ fontSize: '12px', color: '#64748b', gap: 12, marginTop: '4px' }}
                  >
                    <span>
                      Média Atraso:{' '}
                      <b>
                        {(
                          delaySeries.reduce((s, d) => s + d.median_delay, 0) / delaySeries.length
                        ).toFixed(1)}{' '}
                        dias
                      </b>
                    </span>
                  </div>
                )}
              </div>
              <div className="filters">
                <div className="pill-group">
                  {[
                    { v: '0', l: 'Tudo' },
                    { v: '52', l: '52s' },
                    { v: '26', l: '26s' },
                    { v: '12', l: '12s' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      className={`pill-btn ${delayWeeks === opt.v ? 'active' : ''}`}
                      onClick={() => setDelayWeeks(opt.v)}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="chart-wrap chart-wrap--tall">
              <NotificationDelayChart data={delaySeries} forcedWeeks={delayWeeks} />
            </div>
          </article>
        </div>
      </section>

      {/* BLOCO 3: QUALIDADE E PERFORMANCE ASSISTENCIAL */}
      <section className="vigilance-block">
        <article className="panel">
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <h3 style={{ margin: 0 }}>Qualidade e Performance Assistencial</h3>
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', minHeight: '400px' }}>
            <QualidadePerformance data={performanceData} />
          </div>
        </article>
      </section>

      {/* BLOCO 4: EFETIVIDADE VACINAL */}
      <section className="vigilance-block">
        <article className="panel">
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <h3 style={{ margin: 0 }}>Tempo até Infecção Pós-Vacina</h3>
            </div>
          </div>
          <div className="chart-wrap chart-wrap--tall">
            {laboratoryNetwork?.vaccine_survival && (
              <KaplanMeierChart survivalData={laboratoryNetwork.vaccine_survival} />
            )}
          </div>
        </article>
      </section>
    </div>
  );
};

export default VigilancePanel;
