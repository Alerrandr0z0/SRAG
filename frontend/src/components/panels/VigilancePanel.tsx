import React from 'react';
import NotificationDelayChart from '../charts/NotificationDelayChart';
import KpiCard from '../ui/KpiCard';
import EpidemicCurveChart from '../charts/EpidemicCurveChart';
import HeatmapChart from '../charts/HeatmapChart';
import KaplanMeierChart from '../charts/KaplanMeierChart';
import QualidadePerformance, { QualidadePerformanceData, BoxStats } from '../charts/QualidadePerformance';
import * as Epi from '../../types/epi';

interface VigilancePanelProps {
  loading: boolean;
  laboratoryNetwork: Epi.LaboratoryNetwork | undefined;
}

const VigilancePanel: React.FC<VigilancePanelProps> = ({
  loading,
  laboratoryNetwork,
}) => {
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

  const closureTotal = (laboratoryNetwork?.closure_criteria || []).reduce((s, c) => s + c.count, 0) || 1;
  const criteriaColors = ["#0f766e", "#888780", "#b4b2a9", "#d3d1c7"];
  
  const performanceData: QualidadePerformanceData = {
    criterios: (laboratoryNetwork?.closure_criteria || []).map((c, i) => ({
      label: c.label,
      valor: (c.count / closureTotal) * 100,
      color: criteriaColors[i] || "#94a3b8"
    })),
    latencia: mapBoxPlot(quality?.diagnostic_latency?.boxplot_data, "Latência"),
    antiviral: (() => {
      const types = antiviralTypes || [];
      const totalTreatments = types.reduce((sum, a) => sum + a.count, 0) || 1;
      return types.map(a => {
        const pct = (a.count / totalTreatments) * 100;
        let status: "ok" | "warn" | "raro" = "ok";
        if (a.label.toLowerCase().includes("zanamivir")) status = "raro";
        else if (a.label.toLowerCase().includes("outro")) status = "warn";
        return { nome: a.label, pct, casos: a.count, status };
      });
    })(),
    oportunidade: mapBoxPlot(treatment?.antiviral_latency?.boxplot_data, "Oportunidade"),
    oportunidadeMeta: 2,
    coberturaTestagem: {
      collected: quality?.testing_coverage?.collected || 0,
      total: quality?.testing_coverage?.total || 0,
      rate: quality?.testing_coverage?.rate || 0
    },
    distribuicaoAmostra: quality?.sample_type_distribution || []
  };

  const metricCards = [
    { label: 'Positividade Geral', value: `${overall?.positive_rate || 0}%`, className: 'vigilance-metric vigilance-metric--green' },
    { label: 'Testados', value: `${overall?.tested_cases || 0}`, className: 'vigilance-metric vigilance-metric--slate' },
    { label: 'Co-detecção', value: `${overall?.codetection_cases || 0}`, className: 'vigilance-metric vigilance-metric--red' },
    { label: 'Reinfecções', value: `${overall?.reinfection_total || 0}`, className: 'vigilance-metric vigilance-metric--pink' },
    { label: 'Adesão Antiviral (48h)', value: `${overall?.protocol_48h_adherence_rate || 0}%`, className: 'vigilance-metric vigilance-metric--teal' },
    { label: 'Latência Diagnóstica', value: `${overall?.median_turnaround_days || 0}d`, className: 'vigilance-metric vigilance-metric--amber' },
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
          <KpiCard key={card.label} label={card.label} value={card.value} className={card.className} />
        ))}
      </div>

      {/* BLOCO 1: CIRCULAÇÃO VIRAL CONFIRMADA */}
      <section className="vigilance-block">
        <div className="vigilance-insight-grid" style={{ gridTemplateColumns: '1fr' }}>
          <article className="panel">
            <div className="section-header">
              <h3 style={{ margin: 0 }}>Circulação Viral Confirmada</h3>
              <div className="filters"></div>
            </div>
            <div className="chart-wrap" style={{ height: '400px', marginTop: '1rem' }}>
              <EpidemicCurveChart virusTrends={virusTrends} positivityTrend={positivityTrend} />
            </div>
          </article>
        </div>
      </section>

      {/* BLOCO 2: SEVERIDADE VIRAL (Layout Flat) */}
      <section className="vigilance-block">
        <article className="panel">
          <div className="section-header">
            <h3 style={{ margin: 0 }}>Letalidade por Agente e Idade</h3>
            <div className="filters"></div>
          </div>
          <div style={{ marginTop: '1.5rem', height: '400px' }}>
            <HeatmapChart 
              xLabels={laboratoryNetwork?.agent_lethality_heatmap?.age_bands || []}
              yLabels={laboratoryNetwork?.agent_lethality_heatmap?.agents || []}
              matrix={laboratoryNetwork?.agent_lethality_heatmap?.matrix || []}
              valueName="Letalidade (%)"
              colors={['#fff1f2', '#f43f5e', '#9f1239']} // Red/Rose scale for lethality
            />
          </div>
        </article>
      </section>

      {/* ATRASO DE NOTIFICAÇÃO */}
      <section className="vigilance-block">
        <div className="vigilance-insight-grid" style={{ gridTemplateColumns: '1fr' }}>
          <article className="panel">
            <div className="section-header">
              <h3 style={{ margin: 0 }}>Atraso de Notificação (Sintomas vs Cadastro)</h3>
              <div className="filters"></div>
            </div>
            <div className="chart-wrap" style={{ height: '400px', marginTop: '1rem' }}>
              <NotificationDelayChart data={delaySeries} />
            </div>
          </article>
        </div>
      </section>

      {/* BLOCO 3: QUALIDADE E PERFORMANCE ASSISTENCIAL */}
      <section className="vigilance-block">
        <article className="panel">
          <div className="section-header">
            <h3 style={{ margin: 0 }}>Qualidade e Performance Assistencial</h3>
            <div className="filters"></div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <QualidadePerformance data={performanceData} />
          </div>
        </article>
      </section>

      {/* BLOCO 4: EFETIVIDADE VACINAL */}
      <section className="vigilance-block">
        <article className="panel">
          <div className="section-header">
            <h3 style={{ margin: 0 }}>Tempo até Infecção Pós-Vacina (Kaplan-Meier)</h3>
            <div className="filters"></div>
          </div>
          <div className="chart-wrap" style={{ height: '400px', marginTop: '1rem' }}>
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
