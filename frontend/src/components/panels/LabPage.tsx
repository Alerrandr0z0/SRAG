import React, { useState } from 'react';
import * as Epi from '../../types/epi';
import AntiviralOutcomeChart from '../charts/AntiviralOutcomeChart';
import ClosureCriteriaAgentChart from '../charts/ClosureCriteriaAgentChart';
import DiagnosticLatencyTimeline from '../charts/DiagnosticLatencyTimeline';
import ImagingVolcanoChart from '../charts/ImagingVolcanoChart';
import NotificationDelayChart from '../charts/NotificationDelayChart';
import PositivitySampleTypeChart from '../charts/PositivitySampleTypeChart';
import QualidadePerformance, {
  BoxStats,
  QualidadePerformanceData,
} from '../charts/QualidadePerformance';
import KpiCard from '../ui/KpiCard';
import RankTable from '../ui/RankTable';

interface LabPageProps {
  data: Epi.DashboardData | null;
  qualityByLaboratory: Epi.LaboratorioQualityScore[];
}

const LabKpiSection = React.memo<{ data: Epi.DashboardData | null }>(({ data }) => (
  <div className="vigilance-metric-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
    <KpiCard
      label="Testados"
      value={
        data?.laboratoryNetwork?.overall?.tested_cases == null
          ? '—'
          : `${data.laboratoryNetwork.overall.tested_cases}`
      }
      className="vigilance-metric vigilance-metric--green"
    />
    <KpiCard
      label="Cobertura de Testagem"
      value={
        data?.laboratoryNetwork?.quality_metrics?.testing_coverage?.rate == null
          ? '—'
          : `${data.laboratoryNetwork.quality_metrics.testing_coverage.rate}%`
      }
      className="vigilance-metric vigilance-metric--amber"
    />
    <KpiCard
      label="Latência Diagnóstica"
      value={
        data?.laboratoryNetwork?.quality_metrics?.diagnostic_latency?.median == null
          ? '—'
          : `${data.laboratoryNetwork.quality_metrics.diagnostic_latency.median}d`
      }
      className="vigilance-metric vigilance-metric--teal"
    />
    <KpiCard
      label="Positividade Geral"
      value={
        data?.laboratoryNetwork?.overall?.positive_rate == null
          ? '—'
          : `${data.laboratoryNetwork.overall.positive_rate}%`
      }
      className="vigilance-metric vigilance-metric--slate"
    />
  </div>
));

const LabSpecimenClassificationSection = React.memo<{
  positivityData: Epi.LaboratoryNetwork['positivity_by_sample_type'];
  closureData: Epi.LaboratoryNetwork['closure_by_agent'];
}>(({ positivityData, closureData }) => (
  <section className="secondary-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '2rem' }}>
    <article className="panel">
      <div className="section-header">
        <h3 style={{ margin: 0 }}>Positividade por Tipo de Amostra</h3>
      </div>
      <div className="chart-wrap chart-wrap--tall" style={{ minHeight: '350px' }}>
        <PositivitySampleTypeChart data={positivityData ?? null} />
      </div>
    </article>
    <article className="panel">
      <div className="section-header">
        <h3 style={{ margin: 0 }}>Critério de Confirmação por Agente</h3>
      </div>
      <div className="chart-wrap chart-wrap--tall" style={{ minHeight: '350px' }}>
        <ClosureCriteriaAgentChart data={closureData ?? null} />
      </div>
    </article>
  </section>
));

const LabDiagnosticLatencySection = React.memo<{
  latencyData: Epi.LaboratoryNetwork['diagnostic_latency_phases'];
}>(({ latencyData }) => (
  <section className="vigilance-block">
    <article className="panel">
      <div className="section-header">
        <h3 style={{ margin: 0 }}>Fluxo de Latência Diagnóstica (Medianas)</h3>
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        <DiagnosticLatencyTimeline data={latencyData ?? null} />
      </div>
    </article>
  </section>
));

const LabImagingSection = React.memo<{
  severityData: Epi.LaboratoryNetwork['imaging_by_severity'];
}>(({ severityData }) => (
  <section className="vigilance-block">
    <article className="panel">
      <div className="section-header">
        <div className="stack" style={{ gap: 4 }}>
          <h3 style={{ margin: 0 }}>Achados de Imagem × Gravidade Clínica</h3>
          <div className="vigilance-history-stats">
            <span>
              Cada achado é uma bolha: posição por <b>UTI% × CFR%</b>, tamanho por volume de casos, cor por modalidade.
            </span>
          </div>
        </div>
      </div>
      <div className="chart-wrap chart-wrap--tall" style={{ minHeight: '420px' }}>
        {severityData ? <ImagingVolcanoChart data={severityData} /> : (
          <p className="meta">Aguardando dados de imagem por gravidade...</p>
        )}
      </div>
    </article>
  </section>
));

const LabAntiviralImpactSection = React.memo<{
  antiviralData:
    | Array<{ group: string; cure_rate: number; death_rate: number; total: number }>
    | undefined;
}>(({ antiviralData }) => (
  <section className="secondary-grid" style={{ gridTemplateColumns: '1fr', marginTop: '2rem' }}>
    <article className="panel">
      <div className="section-header">
        <h3 style={{ margin: 0 }}>Impacto Clínico do Tratamento Antiviral</h3>
      </div>
      <div className="chart-wrap chart-wrap--tall" style={{ minHeight: '320px' }}>
        <AntiviralOutcomeChart data={antiviralData ?? null} />
      </div>
    </article>
  </section>
));

const getAlertLevel = (score: number, turnaround: number, coverage: number) => {
  const penalty = (100 - score) * 0.5 + Math.min(turnaround, 30) * 1.5 + (100 - coverage) * 0.3;
  if (penalty >= 85) return { label: 'Crítico', tone: 'critical' as const };
  if (penalty >= 60) return { label: 'Alerta', tone: 'warning' as const };
  return { label: 'Estável', tone: 'info' as const };
};

const formatMetric = (value: number | null | undefined, suffix = '') => {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value}${suffix}`;
};

const LabPage: React.FC<LabPageProps> = ({ data, qualityByLaboratory }) => {
  const lab = data?.laboratoryNetwork;
  const quality = lab?.quality_metrics;
  const treatment = lab?.treatment_metrics;
  const delaySeries = lab?.notification_delay || [];
  const antiviralTypes = lab?.antiviral_types || [];

  const [delayWeeks, setDelayWeeks] = useState('0');

  const mapBoxPlot = (vals: number[] | undefined, label: string): BoxStats => {
    const v = vals && vals.length === 5 ? vals : [0, 0, 0, 0, 0];
    return { min: v[0], q1: v[1], median: v[2], q3: v[3], max: v[4], label };
  };

  const closureTotal =
    (lab?.closure_criteria || []).reduce((s: number, c: { count: number }) => s + c.count, 0) || 1;
  const criteriaColors = ['#0f766e', '#888780', '#b4b2a9', '#d3d1c7'];

  const performanceData: QualidadePerformanceData = {
    criterios: (lab?.closure_criteria || []).map(
      (c: { label: string; count: number }, i: number) => ({
        label: c.label,
        valor: (c.count / closureTotal) * 100,
        color: criteriaColors[i] || '#94a3b8',
      }),
    ),
    latencia: mapBoxPlot(quality?.diagnostic_latency?.boxplot_data, 'Latência'),
    antiviral: (() => {
      const types = antiviralTypes || [];
      const totalTreatments =
        types.reduce((sum: number, a: { count: number }) => sum + a.count, 0) || 1;
      return types.map((a: { label: string; count: number }) => {
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

  const labRows = [...qualityByLaboratory]
    .sort((a, b) => {
      const aTurnaround = a.median_turnaround_days ?? Number.NaN;
      const bTurnaround = b.median_turnaround_days ?? Number.NaN;
      const aCoverage = a.resultado_pct ?? Number.NaN;
      const bCoverage = b.resultado_pct ?? Number.NaN;

      const aAlert = getAlertLevel(
        a.score,
        Number.isNaN(aTurnaround) ? 0 : aTurnaround,
        Number.isNaN(aCoverage) ? 0 : aCoverage,
      );
      const bAlert = getAlertLevel(
        b.score,
        Number.isNaN(bTurnaround) ? 0 : bTurnaround,
        Number.isNaN(bCoverage) ? 0 : bCoverage,
      );
      const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
      const sevDiff = severityOrder[aAlert.tone] - severityOrder[bAlert.tone];
      if (sevDiff !== 0) return sevDiff;
      return (
        a.score - b.score ||
        (Number.isNaN(bTurnaround) ? 0 : bTurnaround) -
          (Number.isNaN(aTurnaround) ? 0 : aTurnaround)
      );
    })
    .map((lab) => {
      const turnaround = lab.median_turnaround_days ?? Number.NaN;
      const coverage = lab.resultado_pct ?? Number.NaN;
      const alert = getAlertLevel(
        lab.score,
        Number.isNaN(turnaround) ? 0 : turnaround,
        Number.isNaN(coverage) ? 0 : coverage,
      );
      return {
        key: lab.laboratorio,
        values: {
          laboratorio: <strong>{lab.laboratorio}</strong>,
          total: <strong>{lab.total}</strong>,
          score: <strong>{lab.score}%</strong>,
          median_turnaround_days: <strong>{formatMetric(lab.median_turnaround_days, 'd')}</strong>,
          cobertura: <strong>{formatMetric(lab.resultado_pct, '%')}</strong>,
          sinal_alarme: <span>{alert.label}</span>,
        },
      };
    });

  return (
    <>
      <section className="vigilance-block">
        <article className="panel">
          <RankTable
            title="Desempenho por Laboratório"
            subtitle="Score de qualidade = completude média dos blocos do diagnóstico, cuidado, demografia, identificação e vacinação. Cobertura diagnóstica = percentual de exames com resultado disponível."
            searchPlaceholder="Buscar laboratório..."
            columns={[
              { key: 'laboratorio', label: 'Laboratório' },
              { key: 'total', label: 'Volume testado', align: 'right' },
              { key: 'median_turnaround_days', label: 'Latência mediana', align: 'right' },
              { key: 'cobertura', label: 'Cobertura diagnóstica', align: 'right' },
              { key: 'score', label: 'Score de qualidade', align: 'right' },
              { key: 'sinal_alarme', label: 'Sinal de alerta' },
            ]}
            rows={labRows}
            initialPageSize={10}
          >
            <span className="meta" style={{ margin: 0 }}>
              Alerta combinado prioriza score, latência e cobertura.
            </span>
          </RankTable>
        </article>
      </section>

      <header className="vigilance-clean-header">
        <div>
          <p className="eyebrow">Gestão Laboratorial</p>
          <h2 style={{ margin: '0.25rem 0' }}>Qualidade, Performance e Oportunidade</h2>
        </div>
      </header>

      <LabKpiSection data={data} />

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
                          delaySeries.reduce(
                            (s: number, d: { median_delay: number }) => s + d.median_delay,
                            0,
                          ) / delaySeries.length
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

      <LabSpecimenClassificationSection
        positivityData={lab?.positivity_by_sample_type}
        closureData={lab?.closure_by_agent}
      />

      <LabDiagnosticLatencySection latencyData={lab?.diagnostic_latency_phases} />

      <LabImagingSection severityData={lab?.imaging_by_severity} />

      <LabAntiviralImpactSection antiviralData={treatment?.antiviral_outcome_impact} />
    </>
  );
};

export default LabPage;
