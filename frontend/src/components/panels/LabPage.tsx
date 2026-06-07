import React, { useState } from 'react';
import * as Epi from '../../types/epi';
import { useThemeMode } from '../../hooks/useThemeMode';
import AntiviralOutcomeChart from '../charts/AntiviralOutcomeChart';
import ClosureCriteriaAgentChart from '../charts/ClosureCriteriaAgentChart';
import ImagingVolcanoChart from '../charts/ImagingVolcanoChart';
import NotificationDelayChart from '../charts/NotificationDelayChart';
import PositivitySampleTypeChart from '../charts/PositivitySampleTypeChart';
import TherapeuticKdeChart from '../charts/TherapeuticKdeChart';
import RankTable from '../ui/RankTable';

interface LabPageProps {
  data: Epi.DashboardData | null;
  qualityByLaboratory: Epi.LaboratorioQualityScore[];
}

const OMS_PCR_TARGET_DAYS = 7;
const LATENCY_MAX_SCALE = 30;

const latencySeverity = (median: number | null | undefined) => {
  if (median == null) return { tone: 'slate', label: 'Sem dados', color: '#475569' };
  if (median <= OMS_PCR_TARGET_DAYS) return { tone: 'green', label: 'Adequado', color: '#16a34a' };
  if (median <= 14) return { tone: 'amber', label: 'Atenção', color: '#d97706' };
  return { tone: 'red', label: 'Crítico', color: '#dc2626' };
};

const LatencyBoxplotKpi: React.FC<{
  median: number | null | undefined;
  boxplotData: number[] | undefined;
  count: number | undefined;
}> = ({ median, boxplotData, count }) => {
  const theme = useThemeMode();
  const isDark = theme === 'dark';
  const trackColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0';
  const metaColor = isDark ? '#14b8a6' : '#0f766e';
  const labelColor = isDark ? '#94a3b8' : '#64748b';

  const sev = latencySeverity(median);
  const hasData = Array.isArray(boxplotData) && boxplotData.length === 5;
  const w = 220;
  const h = 36;
  const padX = 8;
  const trackY = h / 2;
  const scaleX = (v: number) => padX + (Math.min(v, LATENCY_MAX_SCALE) / LATENCY_MAX_SCALE) * (w - 2 * padX);

  if (!hasData) {
    return (
      <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 11 }}>Sem dados de latência disponíveis</div>
    );
  }

  const [minV, q1, med, q3, maxV] = boxplotData as [number, number, number, number, number];
  const xMin = scaleX(minV);
  const xQ1 = scaleX(q1);
  const xMed = scaleX(med);
  const xQ3 = scaleX(q3);
  const xMax = scaleX(maxV);
  const xTarget = scaleX(OMS_PCR_TARGET_DAYS);
  const targetLabel = `${xTarget - 14 > 0 ? xTarget - 14 : xTarget + 2}`;

  return (
    <div style={{ marginTop: 6 }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="Distribuição da latência RT-PCR">
        <line
          x1={padX}
          x2={w - padX}
          y1={trackY}
          y2={trackY}
          stroke={trackColor}
          strokeWidth={1}
        />
        <line
          x1={xTarget}
          x2={xTarget}
          y1={4}
          y2={h - 4}
          stroke={metaColor}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text x={Number(targetLabel)} y={11} fontSize={9} fill={metaColor} textAnchor="middle">
          meta
        </text>
        <line x1={xMin} x2={xQ1} y1={trackY} y2={trackY} stroke={sev.color} strokeWidth={1.2} />
        <line x1={xQ3} x2={xMax} y1={trackY} y2={trackY} stroke={sev.color} strokeWidth={1.2} />
        <line x1={xMin} x2={xMin} y1={trackY - 5} y2={trackY + 5} stroke={sev.color} strokeWidth={1.2} />
        <line x1={xMax} x2={xMax} y1={trackY - 5} y2={trackY + 5} stroke={sev.color} strokeWidth={1.2} />
        <rect
          x={xQ1}
          y={trackY - 8}
          width={Math.max(xQ3 - xQ1, 1)}
          height={16}
          fill={sev.color}
          fillOpacity={isDark ? 0.25 : 0.18}
          stroke={sev.color}
          strokeWidth={1.2}
        />
        <line
          x1={xMed}
          x2={xMed}
          y1={trackY - 8}
          y2={trackY + 8}
          stroke={sev.color}
          strokeWidth={2.4}
        />
        <text x={w - padX} y={h - 2} fontSize={9} fill={labelColor} textAnchor="end">
          {count != null ? `n=${count} · máx ${maxV}d` : `máx ${maxV}d`}
        </text>
      </svg>
    </div>
  );
};

const CoverageKpi: React.FC<{
  rate: number | null | undefined;
  collected: number | null | undefined;
  total: number | null | undefined;
}> = ({ rate, collected, total }) => {
  if (rate == null) {
    return <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-muted)' }}>—</div>;
  }
  const tone = rate >= 90 ? '#16a34a' : rate >= 80 ? '#d97706' : '#dc2626';
  const ratio = Math.max(0, Math.min(rate, 100)) / 100;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: tone, lineHeight: 1.1 }}>
        {rate}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>%</span>
      </div>
      <div
        role="progressbar"
        style={{
          marginTop: 4,
          height: 5,
          borderRadius: 3,
          background: 'rgba(148, 163, 184, 0.15)',
          overflow: 'hidden',
        }}
        aria-label="Barra de progresso de cobertura"
      >
        <div style={{ width: `${ratio * 100}%`, height: '100%', background: tone }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        {collected != null && total != null ? `${collected}/${total} coletados` : 'meta ≥ 80%'}
      </div>
    </div>
  );
};

const TestedKpi: React.FC<{
  tested: number | null | undefined;
  total: number | null | undefined;
}> = ({ tested, total }) => {
  if (tested == null || total == null || total === 0) {
    return <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-muted)' }}>—</div>;
  }
  const rate = Number(((tested / total) * 100).toFixed(1));
  const ratio = Math.max(0, Math.min(rate, 100)) / 100;
  const tone = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: tone, lineHeight: 1.1 }}>
        {rate}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>%</span>
      </div>
      <div
        role="progressbar"
        style={{
          marginTop: 4,
          height: 5,
          borderRadius: 3,
          background: 'rgba(148, 163, 184, 0.15)',
          overflow: 'hidden',
        }}
        aria-label="Barra de progresso de testados"
      >
        <div style={{ width: `${ratio * 100}%`, height: '100%', background: tone }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        {tested} de {total} casos testados
      </div>
    </div>
  );
};

const TurnaroundKpi: React.FC<{
  days: number | null | undefined;
}> = ({ days }) => {
  if (days == null) {
    return <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-muted)' }}>—</div>;
  }
  const tone = days <= 2 ? '#16a34a' : days <= 4 ? '#d97706' : '#dc2626';
  const roundedDays = Math.round(days);
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: tone, lineHeight: 1.1 }}>
          {roundedDays}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {roundedDays === 1 ? 'dia (média)' : 'dias (média)'}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
        coleta ao resultado do exame
      </div>
    </div>
  );
};

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
  const treatment = lab?.treatment_metrics;
  const delaySeries = lab?.notification_delay || [];
  const antiviralTypes = lab?.antiviral_types || [];
  const latencyPerDrug = treatment?.antiviral_latency_per_drug || [];
  const sampleTypeDist = lab?.quality_metrics?.sample_type_distribution || [];

  const [delayWeeks, setDelayWeeks] = useState('0');

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

  const totalTreated = antiviralTypes.reduce(
    (sum: number, a: { count: number }) => sum + a.count,
    0,
  );

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

      <section className="vigilance-block" style={{ marginTop: '1.5rem' }}>
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
      </section>

      <section className="vigilance-block" style={{ marginTop: '2rem' }}>
        <article className="panel">
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <h3 style={{ margin: 0 }}>Performance Diagnóstica</h3>
              <p className="meta" style={{ margin: 0 }}>
                Da coleta da amostra ao resultado laboratorial
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '0.85rem',
                minHeight: '110px',
                background: 'var(--bg-status)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
              }}
            >
              <div className="meta" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                Taxa de Testagem
              </div>
              <TestedKpi
                tested={lab?.overall?.tested_cases ?? null}
                total={lab?.quality_metrics?.testing_coverage?.total ?? null}
              />
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '0.85rem',
                minHeight: '110px',
                background: 'var(--bg-status)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
              }}
            >
              <div className="meta" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                Cobertura
              </div>
              <CoverageKpi
                rate={lab?.quality_metrics?.testing_coverage?.rate ?? null}
                collected={lab?.quality_metrics?.testing_coverage?.collected ?? null}
                total={lab?.quality_metrics?.testing_coverage?.total ?? null}
              />
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '0.85rem',
                minHeight: '110px',
                background: 'var(--bg-status)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
              }}
            >
              <div
                className="meta"
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}
              >
                <span>Latência RT-PCR</span>
                {lab?.quality_metrics?.diagnostic_latency?.median != null && (
                  <span
                    title={latencySeverity(lab.quality_metrics.diagnostic_latency.median).label}
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: latencySeverity(lab.quality_metrics.diagnostic_latency.median).color,
                    }}
                  />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: latencySeverity(lab?.quality_metrics?.diagnostic_latency?.median).color,
                      lineHeight: 1.1,
                    }}
                  >
                    {lab?.quality_metrics?.diagnostic_latency?.median ?? '—'}
                  </span>
                  {lab?.quality_metrics?.diagnostic_latency?.median != null && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>d (mediana)</span>
                  )}
                </div>
                <LatencyBoxplotKpi
                  median={lab?.quality_metrics?.diagnostic_latency?.median ?? null}
                  boxplotData={lab?.quality_metrics?.diagnostic_latency?.boxplot_data}
                  count={lab?.quality_metrics?.diagnostic_latency?.count}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '0.85rem',
                minHeight: '110px',
                background: 'var(--bg-status)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
              }}
            >
              <div
                className="meta"
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}
              >
                <span>Tempo de Resposta (Média)</span>
                {lab?.overall?.avg_turnaround_days != null && (
                  <span
                    title={
                      lab.overall.avg_turnaround_days <= 2
                        ? 'Adequado'
                        : lab.overall.avg_turnaround_days <= 4
                        ? 'Atenção'
                        : 'Crítico'
                    }
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background:
                        lab.overall.avg_turnaround_days <= 2
                          ? '#16a34a'
                          : lab.overall.avg_turnaround_days <= 4
                          ? '#d97706'
                          : '#dc2626',
                    }}
                  />
                )}
              </div>
              <TurnaroundKpi days={lab?.overall?.avg_turnaround_days} />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginTop: '1.25rem',
            }}
          >
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Positividade por Tipo de Amostra
              </div>
              <div className="chart-wrap" style={{ minHeight: '260px' }}>
                <PositivitySampleTypeChart data={lab?.positivity_by_sample_type ?? null} />
              </div>
            </div>
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Critério de Confirmação por Agente
              </div>
              <div className="chart-wrap" style={{ minHeight: '260px' }}>
                <ClosureCriteriaAgentChart data={lab?.closure_by_agent ?? null} />
              </div>
            </div>
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Distribuição de Amostras
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {(() => {
                  const total = sampleTypeDist.reduce(
                    (s: number, x: { count: number }) => s + x.count,
                    0,
                  ) || 1;
                  return sampleTypeDist.slice(0, 5).map(
                    (item: { label: string; count: number }, i: number) => {
                      const pct = (item.count / total) * 100;
                      return (
                        <div key={i}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '11px',
                              marginBottom: '3px',
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{item.label}</span>
                            <span style={{ color: '#64748b' }}>
                              {item.count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: '6px',
                              background: 'var(--bg-pill)',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: i === 0 ? '#0f766e' : '#94a3b8',
                                transition: 'width 0.3s',
                              }}
                            />
                          </div>
                        </div>
                      );
                    },
                  );
                })()}
              </div>
            </div>
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Encerramento dos Casos
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {(lab?.closure_criteria || []).map(
                  (c: { label: string; count: number }, i: number) => {
                    const total =
                      (lab?.closure_criteria || []).reduce(
                        (s: number, x: { count: number }) => s + x.count,
                        0,
                      ) || 1;
                    const pct = (c.count / total) * 100;
                    const colors = ['#0f766e', '#888780', '#b4b2a9', '#d3d1c7'];
                    return (
                      <div key={i}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            marginBottom: '3px',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{c.label}</span>
                          <span style={{ color: '#64748b' }}>
                            {c.count} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '6px',
                            background: 'var(--bg-pill)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: colors[i] || '#94a3b8',
                              transition: 'width 0.3s',
                            }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="vigilance-block" style={{ marginTop: '2rem' }}>
        <article className="panel">
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <h3 style={{ margin: 0 }}>Oportunidade Terapêutica</h3>
              <p className="meta" style={{ margin: 0 }}>
                Distribuição de latência (sintomas → antiviral) por droga
              </p>
            </div>
            {antiviralTypes.length > 0 && (
              <div className="filters" style={{ fontSize: '12px', color: '#64748b', gap: 12 }}>
                <span>
                  Tratados: <b>{totalTreated}</b>
                </span>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(1, antiviralTypes.length)}, 1fr)`,
              gap: '0.5rem',
              marginTop: '1rem',
            }}
          >
            {antiviralTypes.map((a: { label: string; count: number }, i: number) => {
              const pct = totalTreated > 0 ? (a.count / totalTreated) * 100 : 0;
              const isRare = a.label.toLowerCase().includes('zanamivir');
              const isWarn = a.label.toLowerCase().includes('outro');
              const tone = isRare ? '#94a3b8' : isWarn ? '#d97706' : '#0f766e';
              return (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-status)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '20px', fontWeight: 700, color: tone }}>
                    {pct.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {a.count} casos
                  </div>
                </div>
              );
            })}
          </div>

          <div className="chart-wrap" style={{ minHeight: '320px', marginTop: '1rem' }}>
            {latencyPerDrug.length > 0 ? (
              <TherapeuticKdeChart
                data={latencyPerDrug.map((d) => ({
                  drug: d.drug,
                  samples: d.latency_samples,
                  count: d.count,
                }))}
                domain={[0, 15]}
                unit="d"
                referenceLine={2}
                referenceLabel="meta 2d"
                xLabel="Dias (sintomas → antiviral)"
              />
            ) : (
              <p className="meta" style={{ textAlign: 'center', padding: '2rem' }}>
                Aguardando dados de latência por antiviral...
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="vigilance-block" style={{ marginTop: '2rem' }}>
        <article className="panel">
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <h3 style={{ margin: 0 }}>Desfecho Clínico</h3>
              <p className="meta" style={{ margin: 0 }}>
                Achados de imagem e impacto do tratamento antiviral na letalidade
              </p>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Achados de Imagem × Gravidade
              </div>
              <div className="chart-wrap" style={{ minHeight: '360px' }}>
                {lab?.imaging_by_severity ? (
                  <ImagingVolcanoChart data={lab.imaging_by_severity} />
                ) : (
                  <p className="meta" style={{ textAlign: 'center', padding: '2rem' }}>
                    Aguardando dados de imagem por gravidade...
                  </p>
                )}
              </div>
            </div>
            <div>
              <div
                className="meta"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Impacto Clínico do Antiviral
              </div>
              <div className="chart-wrap" style={{ minHeight: '360px' }}>
                <AntiviralOutcomeChart data={treatment?.antiviral_outcome_impact ?? null} />
              </div>
            </div>
          </div>
        </article>
      </section>
    </>
  );
};

export default LabPage;
