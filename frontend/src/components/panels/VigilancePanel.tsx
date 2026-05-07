import React from 'react';
import NotificationDelayChart from '../charts/NotificationDelayChart';
import KpiCard from '../ui/KpiCard';
import GenomicVariantsChart from '../charts/GenomicVariantsChart';
import EpidemicCurveChart from '../charts/EpidemicCurveChart';
import BarChart from '../charts/BarChart';
import HeatmapChart from '../charts/HeatmapChart';
import ReinfectionTrendChart from '../charts/ReinfectionTrendChart';
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
  const fluSubtypes = laboratoryNetwork?.influenza_subtypes || [];
  const virusTrends = laboratoryNetwork?.virus_trends || [];
  const antiviralTypes = laboratoryNetwork?.antiviral_types || [];
  const positivityTrend = laboratoryNetwork?.positivity_trend || [];
  const reinfectionTrend = laboratoryNetwork?.reinfection_trend || [];

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
    antiviral: (antiviralTypes || []).map(a => {
      const pct = (a.count / (laboratoryNetwork?.antiviral_usage.total_indicated || a.count || 1)) * 100;
      let status: "ok" | "warn" | "raro" = "ok";
      if (a.label.toLowerCase().includes("zanamivir")) status = "raro";
      else if (a.label.toLowerCase().includes("outro")) status = "warn";
      return { nome: a.label, pct, casos: a.count, status };
    }),
    oportunidade: mapBoxPlot(treatment?.antiviral_latency?.boxplot_data, "Oportunidade"),
    oportunidadeMeta: 2
  };

  const metricCards = [
    { label: 'Positividade Geral', value: `${overall?.positive_rate || 0}%`, className: 'vigilance-metric vigilance-metric--green' },
    { label: 'Testados', value: `${overall?.tested_cases || 0}`, className: 'vigilance-metric vigilance-metric--slate' },
    { label: 'Co-detecção', value: `${overall?.codetection_cases || 0}`, className: 'vigilance-metric vigilance-metric--red' },
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

      <div className="vigilance-metric-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {metricCards.map((card) => (
          <KpiCard key={card.label} label={card.label} value={card.value} className={card.className} />
        ))}
      </div>

      {/* BLOCO 1: CIRCULAÇÃO VIRAL CONFIRMADA */}
      <section className="vigilance-block">
        <div className="vigilance-insight-grid" style={{ gridTemplateColumns: '1fr' }}>
          <article className="panel">
            <div className="chart-wrap" style={{ height: '400px' }}>
              <EpidemicCurveChart virusTrends={virusTrends} positivityTrend={positivityTrend} />
            </div>
          </article>
        </div>
      </section>

      {/* BLOCO 2: SEVERIDADE VIRAL (Layout Flat) */}
      <section className="vigilance-block">
        <h3 className="block-title">Letalidade por Agente e Idade</h3>
        <div style={{ marginTop: '1rem', height: '400px' }}>
          <HeatmapChart 
            xLabels={laboratoryNetwork?.agent_lethality_heatmap?.age_bands || []}
            yLabels={laboratoryNetwork?.agent_lethality_heatmap?.agents || []}
            matrix={laboratoryNetwork?.agent_lethality_heatmap?.matrix || []}
            valueName="Letalidade (%)"
            colors={['#fff1f2', '#f43f5e', '#9f1239']} // Red/Rose scale for lethality
          />
        </div>
      </section>

      {/* ATRASO DE NOTIFICAÇÃO */}
      <section className="vigilance-block">
        <div className="vigilance-insight-grid" style={{ gridTemplateColumns: '1fr' }}>
          <article className="panel">
            <div className="chart-wrap" style={{ height: '400px' }}>
              <NotificationDelayChart data={delaySeries} />
            </div>
          </article>
        </div>
      </section>

      {/* QUALIDADE E PERFORMANCE ASSISTENCIAL (MOVIDO PARA CIMA) */}
      <section className="vigilance-block">
        <QualidadePerformance data={performanceData} />
      </section>

      {/* BLOCO 3: VIGILÂNCIA GENÔMICA */}
      <section className="vigilance-block">
        <h3 className="block-title">Vigilância Genômica</h3>
        <div className="vigilance-insight-grid">
          <article className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Evolução SARS-CoV-2</p>
                <h3>Dominância de Variantes</h3>
              </div>
            </div>
            <div className="chart-wrap" style={{ height: '300px' }}>
              <GenomicVariantsChart data={laboratoryNetwork?.genomic_variants || { weeks: [], variants: {} }} />
            </div>
          </article>
          <article className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Subtipagem Influenza</p>
                <h3>Perfil de Influenza (A e B)</h3>
              </div>
            </div>
            <div className="chart-wrap" style={{ height: '300px' }}>
              {fluSubtypes.length > 0 ? (
                <BarChart
                  labels={fluSubtypes.map((v) => v.label)}
                  data={fluSubtypes.map((v) => v.count)}
                  horizontal={true}
                  color="#b91c1c"
                />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <p>Nenhuma subtipagem detectada.</p>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* BLOCO 4: EFETIVIDADE VACINAL */}
      <section className="vigilance-block">
        <h3 className="block-title">Efetividade Vacinal</h3>
        <div className="vigilance-insight-grid" style={{ gridTemplateColumns: '1fr' }}>
          <article className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Análise de Sobrevivência</p>
                <h3>Tempo até Infecção Pós-Vacina (Kaplan-Meier)</h3>
              </div>
            </div>
            <div className="chart-wrap" style={{ height: '400px' }}>
              {laboratoryNetwork?.vaccine_survival && (
                <KaplanMeierChart survivalData={laboratoryNetwork.vaccine_survival} />
              )}
            </div>
          </article>
        </div>
      </section>

      {/* BLOCO 5: CO-DETECÇÃO E SURTOS (Layout Flat) */}
      <section className="vigilance-block">
        <h3 className="block-title">Co-detecção e Surtos</h3>
        <div style={{ marginTop: '1rem', height: '400px' }}>
          <HeatmapChart 
            xLabels={laboratoryNetwork?.codetection_matrix?.labels || []}
            yLabels={laboratoryNetwork?.codetection_matrix?.labels || []}
            matrix={laboratoryNetwork?.codetection_matrix?.matrix || []}
            valueName="Casos Co-detectados"
            colors={['#fff1f2', '#fda4af', '#e11d48']}
          />
        </div>
      </section>

      {/* MONITORAMENTO DE REINFECÇÕES */}
      <section className="vigilance-block">
        <h3 className="block-title">Monitoramento de Reinfecções</h3>
        <div className="vigilance-insight-grid" style={{ gridTemplateColumns: 'minmax(240px, 0.7fr) minmax(0, 1.3fr)' }}>
          <div className="stack" style={{ gap: '1rem' }}>
            <KpiCard 
              label="Total Reinfecções" 
              value={overall?.reinfection_total || 0} 
              className="vigilance-metric vigilance-metric--pink" 
            />
            <article className="panel" style={{ padding: '1.25rem', flexGrow: 1 }}>
              <p className="meta" style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                Casos onde houve registro anterior positivo com intervalo ≥ 90 dias, conforme Campo 96 (VG_REINF) do SIVEP-Gripe.
              </p>
            </article>
          </div>
          <article className="panel">
             <div className="chart-wrap" style={{ height: '300px' }}>
                <ReinfectionTrendChart data={reinfectionTrend} />
             </div>
          </article>
        </div>
      </section>
    </div>
  );
};

export default VigilancePanel;
