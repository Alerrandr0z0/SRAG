import React from 'react';
import LabChart from '../charts/LabChart';
import NotificationDelayChart from '../charts/NotificationDelayChart';
import VigilanceDonutChart from '../charts/VigilanceDonutChart';
import KpiCard from '../ui/KpiCard';
import TreatmentByAgentChart from '../charts/TreatmentByAgentChart';
import GenomicVariantsChart from '../charts/GenomicVariantsChart';
import VirusStackedTrendChart from '../charts/VirusStackedTrendChart';
import ImagingProfileChart from '../charts/ImagingProfileChart';
import BarChart from '../charts/BarChart';
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
  const antiviral = laboratoryNetwork?.antiviral_usage;
  const delaySeries = laboratoryNetwork?.notification_delay || [];
  const latestDelay = delaySeries.length ? delaySeries[delaySeries.length - 1] : undefined;
  const mortalityByTreatmentAgent = laboratoryNetwork?.mortality_by_treatment_agent || [];
  const fluSubtypes = laboratoryNetwork?.influenza_subtypes || [];
  const virusTrends = laboratoryNetwork?.virus_trends || [];
  const virusRanking = laboratoryNetwork?.virus_ranking || [];
  const imagingProfile = laboratoryNetwork?.imaging_profile || { raiox: [], tomo: [] };
  const serologyProfile = laboratoryNetwork?.serology_profile || { types: [], igg: [], igm: [] };
  const antiviralTypes = laboratoryNetwork?.antiviral_types || [];

  const metricCards = [
    { label: 'Positividade', value: `${overall?.positive_rate || 0}%`, className: 'vigilance-metric vigilance-metric--green' },
    { label: 'Co-detecção', value: `${overall?.codetection_cases || 0}`, className: 'vigilance-metric vigilance-metric--red' },
    { label: 'Adesão Antiviral', value: `${antiviral?.adherence_rate || 0}%`, className: 'vigilance-metric vigilance-metric--teal' },
    { label: 'Tempo Resposta', value: `${overall?.median_turnaround_days || 0}d`, className: 'vigilance-metric vigilance-metric--amber' },
    { label: 'Atraso Notif.', value: `${latestDelay?.median_delay || 0}d`, className: 'vigilance-metric vigilance-metric--slate' },
  ];

  return (
    <div className="stack vigilance-shell" style={{ gap: '1.5rem' }}>
      <header className="vigilance-clean-header">
        <div>
          <p className="eyebrow">Vigilância</p>
          <h2 style={{ margin: '0.25rem 0' }}>Monitoramento Laboratorial & Genômico</h2>
        </div>
        <div className="vigilance-badge">Total: {overall?.tested_cases || 0} exames processados</div>
      </header>

      <div className="vigilance-metric-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {metricCards.map((card) => (
          <KpiCard key={card.label} label={card.label} value={card.value} className={card.className} />
        ))}
      </div>

      {/* BLOCO 1: CIRCULAÇÃO VIRAL */}
      <div className="vigilance-insight-grid">
        <article className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Circulação Viral</p>
              <h3>Evolução de Positivos por Semana</h3>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: '300px' }}>
            <VirusStackedTrendChart data={virusTrends} />
          </div>
        </article>

        <article className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Ranking</p>
              <h3>Agentes Identificados</h3>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: '300px' }}>
            <BarChart
              labels={virusRanking.map(v => v.label)}
              data={virusRanking.map(v => v.count)}
              horizontal={true}
              color="#0d9488"
            />
          </div>
        </article>
      </div>

      {/* BLOCO 2: GENÔMICA SARS-CoV-2 */}
      <article className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Genômica</p>
            <h3>Dominância de Variantes (SARS-CoV-2)</h3>
          </div>
        </div>
        <div className="chart-wrap" style={{ height: '300px' }}>
          <GenomicVariantsChart data={laboratoryNetwork?.genomic_variants || { weeks: [], variants: {} }} />
        </div>
      </article>

      {/* BLOCO 3: CLÍNICA E SUBTIPAGEM */}
      <div className="vigilance-insight-grid">
        <article className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Subtipagem</p>
              <h3>Perfil de Influenza (A e B)</h3>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: '300px' }}>
            {fluSubtypes.length > 0 ? (
              <VigilanceDonutChart title="Subtipos de Influenza" data={fluSubtypes} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                <p>Nenhuma subtipagem detectada.</p>
              </div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Intervenção</p>
              <h3>Óbitos por Tratamento e Agente</h3>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: '300px' }}>
            <TreatmentByAgentChart data={mortalityByTreatmentAgent} />
          </div>
        </article>
      </div>

      {/* BLOCO 4: IMAGEM E QUALIDADE */}
      <div className="vigilance-insight-grid">
        <article className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Imagem</p>
              <h3>Perfil Radiológico (RX vs Tomo)</h3>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: '300px' }}>
            <ImagingProfileChart data={imagingProfile} />
          </div>
        </article>

        <article className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Qualidade</p>
              <h3>Critério de Encerramento</h3>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: '300px' }}>
            <VigilanceDonutChart title="Critério de Encerramento" data={laboratoryNetwork?.closure_criteria || []} />
          </div>
        </article>
      </div>

      {/* BLOCO 5: DIAGNÓSTICO AVANÇADO E TRATAMENTO */}
      <div className="vigilance-insight-grid">
        <article className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Imunologia</p>
              <h3>Sorologia SARS-CoV-2 (Tipos e IgG)</h3>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '280px' }}>
            <VigilanceDonutChart title="Metodologia" data={serologyProfile.types} />
            <VigilanceDonutChart title="Resultado IgG" data={serologyProfile.igg} />
          </div>
        </article>

        <article className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Terapêutica</p>
              <h3>Arsenal de Antivirais Utilizados</h3>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: '280px' }}>
            {antiviralTypes.length > 0 ? (
              <VigilanceDonutChart title="Distribuição de Fármacos" data={antiviralTypes} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                <p>Sem detalhamento de fármacos antiviral.</p>
              </div>
            )}
          </div>
        </article>
      </div>

      {/* BLOCO 6: OPERACIONAL */}
      <article className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Oportunidade</p>
            <h3>Agilidade de Notificação</h3>
          </div>
        </div>
        <div className="chart-wrap" style={{ height: '250px' }}>
          <NotificationDelayChart data={delaySeries} />
        </div>
      </article>

      <article className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Rede</p>
            <h3>Volume por Unidade Laboratorial</h3>
          </div>
        </div>
        <div className="chart-wrap" style={{ height: '350px' }}>
          {laboratoryNetwork?.labs && <LabChart data={laboratoryNetwork.labs} />}
        </div>
      </article>
    </div>
  );
};

export default VigilancePanel;
