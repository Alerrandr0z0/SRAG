import React, { useEffect, useMemo, useState } from 'react';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useVigilanceExtraData } from '../../hooks/useVigilanceExtraData';
import { api } from '../../services/api';
import * as Epi from '../../types/epi';
import ComorbiditiesTreemapChart from '../charts/ComorbiditiesTreemapChart';
import { DiagnosticResilienceChart } from '../charts/DiagnosticResilienceChart';
import EpidemicCurveChart from '../charts/EpidemicCurveChart';
import IcuRidgelinePlot from '../charts/IcuRidgelinePlot';
import { NosocomialRiskChart } from '../charts/NosocomialRiskChart';
import NotificationDelayChart from '../charts/NotificationDelayChart';
import SeverityPyramidChart from '../charts/SeverityPyramidChart';
import TrendChart from '../charts/TrendChart';
import VirusProfileChart from '../charts/VirusProfileChart';

/* ─────── Props ─────── */

interface VigilancePageProps {
  data: Epi.DashboardData | null;
  agentFilter: string[];
  citizenTab: string[];
  raceFilter: string[];
  genderFilter: string[];
  zoneFilter: string[];
  bairroFilter: string[];
  unitFilter: string[];
  dashboardYear: number[];
  maternalFilter: string[];
  occupationFilter: string[];
  schoolingFilter?: string[];
  riskFilter?: string[];
  dashboardMonth: number[];
  dashboardDay: number[];
}

/* ─────── Sub-componentes memoizados ─────── */

interface HistorySectionProps {
  data: Epi.DashboardData | null;
  currentTrends: Epi.TrendsData | null;
  casosMode: 'notificados' | 'confirmados' | 'atrasados';
  weeksWindow: string;
  seriesMode: string;
  curveMode: 'composicao' | 'positividade' | 'acumulado';
  curveWeeks: string;
  delayWeeks: string;
  delaySeries: Array<{ epi_week: string; median_delay: number; record_count: number }>;
  onCasosMode: (v: 'notificados' | 'confirmados' | 'atrasados') => void;
  onWeeksWindow: (v: string) => void;
  onSeriesMode: (v: string) => void;
  onCurveMode: (v: 'composicao' | 'positividade' | 'acumulado') => void;
  onCurveWeeks: (v: string) => void;
  onDelayWeeks: (v: string) => void;
}
const VigilanceHistorySection = React.memo<HistorySectionProps>(
  ({
    data,
    currentTrends,
    casosMode,
    weeksWindow,
    seriesMode,
    curveMode,
    curveWeeks,
    delayWeeks,
    delaySeries,
    onCasosMode,
    onWeeksWindow,
    onSeriesMode,
    onCurveMode,
    onCurveWeeks,
    onDelayWeeks,
  }) => (
    <section className="main-grid">
      <article className="panel">
        <div className="section-header">
          <div className="stack vigilance-history-summary" style={{ gap: 4 }}>
            <h3 style={{ margin: 0 }}>Histórico de casos</h3>
            {casosMode === 'notificados' && currentTrends && (
              <div className="vigilance-history-stats">
                <span>
                  Total: <b>{currentTrends.history.reduce((s, h) => s + h.total, 0)}</b>
                </span>
              </div>
            )}
            {casosMode === 'confirmados' && data?.laboratoryNetwork?.virus_trends && (
              <div className="vigilance-history-stats">
                <span>
                  Total Positivos:{' '}
                  <b>
                    {data.laboratoryNetwork.virus_trends.reduce(
                      (s: number, h: { epi_week: string; virus: string; count: number }) =>
                        s + h.count,
                      0,
                    )}
                  </b>
                </span>
              </div>
            )}
            {casosMode === 'atrasados' && delaySeries.length > 0 && (
              <div className="vigilance-history-stats">
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
          <div className="filters vigilance-history-controls">
            <div className="pill-group">
              <button
                type="button"
                className={`pill-btn ${casosMode === 'notificados' ? 'active' : ''}`}
                onClick={() => onCasosMode('notificados')}
              >
                Notificados
              </button>
              <button
                type="button"
                className={`pill-btn ${casosMode === 'confirmados' ? 'active' : ''}`}
                onClick={() => onCasosMode('confirmados')}
              >
                Confirmados
              </button>
              <button
                type="button"
                className={`pill-btn ${casosMode === 'atrasados' ? 'active' : ''}`}
                onClick={() => onCasosMode('atrasados')}
              >
                Atrasados
              </button>
            </div>
            {casosMode === 'notificados' && (
              <>
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
                      className={`pill-btn ${weeksWindow === opt.v ? 'active' : ''}`}
                      onClick={() => onWeeksWindow(opt.v)}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                <select value={seriesMode} onChange={(e) => onSeriesMode(e.target.value)}>
                  <option value="weekly">Semanal</option>
                  <option value="cumulative">Acumulada</option>
                  <option value="composition">Composição</option>
                </select>
              </>
            )}
            {casosMode === 'confirmados' && (
              <>
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
                      onClick={() => onCurveWeeks(opt.v)}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                <select
                  value={curveMode}
                  onChange={(e) =>
                    onCurveMode(e.target.value as 'composicao' | 'positividade' | 'acumulado')
                  }
                >
                  <option value="positividade">Taxa de Positividade</option>
                  <option value="acumulado">Acumulado</option>
                  <option value="composicao">Composição</option>
                </select>
              </>
            )}
            {casosMode === 'atrasados' && (
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
                    onClick={() => onDelayWeeks(opt.v)}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="chart-wrap chart-wrap--tall">
          {casosMode === 'notificados' && currentTrends && (
            <TrendChart
              history={currentTrends.history}
              forecast={currentTrends.forecast}
              thresholds={currentTrends.thresholds}
              composition={currentTrends.composition}
              baseCumulative={currentTrends.base_cumulative}
              seriesMode={seriesMode}
              weeksWindow={weeksWindow}
              showForecast={false}
            />
          )}
          {casosMode === 'confirmados' && data?.laboratoryNetwork && (
            <EpidemicCurveChart
              virusTrends={data.laboratoryNetwork.virus_trends || []}
              positivityTrend={data.laboratoryNetwork.positivity_trend || []}
              forcedMode={curveMode as 'composicao' | 'positividade' | 'acumulado'}
              forcedWeeks={curveWeeks}
            />
          )}
          {casosMode === 'atrasados' && (
            <NotificationDelayChart data={delaySeries} forcedWeeks={delayWeeks} />
          )}
        </div>
      </article>
    </section>
  ),
);

interface ViralSectionProps {
  virus: Epi.VirusData[] | null;
  virusDetail: string;
  agentFilter: string[];
  onVirusDetail: (v: string) => void;
}
const VigilanceViralProfile = React.memo<ViralSectionProps>(
  ({ virus, virusDetail, agentFilter, onVirusDetail }) => {
    const theme = useThemeMode();
    const isDark = theme === 'dark';
    const borderColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'var(--border-subtle)';
    const cardBg = isDark ? 'var(--bg-status)' : 'var(--bg-status)';

    return (
      <article
        className="panel viral-profile-panel"
        style={{
          background: cardBg,
          border: `0.5px solid ${borderColor}`,
          borderRadius: 8,
          padding: '12px',
          height: '380px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginBottom: '8px',
          }}
        >
          <h3
            style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}
          >
            Perfil viral
          </h3>
          <select
            value={virusDetail}
            onChange={(e) => onVirusDetail(e.target.value)}
            style={{
              width: '100%',
              fontSize: '10px',
              padding: '2px 4px',
              height: '22px',
            }}
            onFocus={() => {
              if (agentFilter[0] && virusDetail === 'summary') {
                onVirusDetail(
                  agentFilter[0] === 'Influenza' ? 'influenza_detailed' : 'covid_detailed',
                );
              }
            }}
          >
            {!agentFilter[0] && <option value="summary">Resumido</option>}
            {!agentFilter[0] && <option value="detailed">Detalhado (Geral)</option>}
            {agentFilter[0] !== 'Influenza' && (
              <option value="covid_detailed">Detalhado COVID-19</option>
            )}
            {agentFilter[0] !== 'COVID-19' && (
              <option value="influenza_detailed">Detalhado Influenza</option>
            )}
          </select>
        </div>
        <div className="chart-wrap" style={{ flex: 1, minHeight: 0 }}>
          {virus && <VirusProfileChart data={virus} />}
        </div>
      </article>
    );
  },
);

const VigilanceSeverityPyramidSection = React.memo<{
  severityData: Epi.SeverityPyramidResponse | null;
  lethalityData: {
    age_bands: string[];
    agents: string[];
    matrix: number[][];
  } | null;
}>(({ severityData, lethalityData }) => (
  <article className="panel" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
    <div className="section-header">
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>Gravidade e Letalidade (CFR) por Faixa Etária</span>
        <span className="rank-tooltip-wrapper">
          <button
            type="button"
            className="rank-tooltip-trigger"
            aria-label="Informações sobre o gráfico"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
          <div className="rank-tooltip-content" style={{ width: '320px', left: '0%', transform: 'none' }}>
            Distribuição etária da gravidade e da letalidade:<br/><br/>
            • <b>Volume (barras empilhadas, eixo esquerdo):</b> total de casos na faixa, segmentado em Óbito, UTI em sobreviventes e Enfermaria/Não Internado.<br/><br/>
            • <b>Letalidade por agente (linhas, eixo direito):</b> CFR % na faixa etária para cada vírus. Leitura cruzada: barras mostram carga, linhas mostram risco relativo por idade.
          </div>
        </span>
      </h3>
    </div>
    <div className="chart-wrap chart-wrap--tall" style={{ flex: 1, minHeight: 0 }}>
      <SeverityPyramidChart severityData={severityData} lethalityData={lethalityData} />
    </div>
  </article>
));

const VigilanceIcuBottleneckSection = React.memo<{
  data: Epi.IcuBottleneckRecord[];
  dashboardYear: number[];
}>(({ data, dashboardYear }) => {
  const isYearSelected = dashboardYear.length > 0;
  const [groupBy, setGroupBy] = useState<Epi.TemporalGrouping>('year');

  React.useEffect(() => {
    if (isYearSelected && groupBy === 'year') {
      setGroupBy('month');
    }
  }, [isYearSelected, groupBy]);

  const summary = useMemo(() => {
    if (!data?.length) return null;
    const total = data.length;
    const sameDay = data.filter((d) => d.wait_days === 0).length;
    const waitMore = total - sameDay;
    return {
      total,
      sameDay,
      sameDayRate: ((sameDay / total) * 100).toFixed(1),
      waitMore,
      waitMoreRate: ((waitMore / total) * 100).toFixed(1),
    };
  }, [data]);

  return (
    <article className="panel">
      <div className="section-header">
        <div className="stack" style={{ gap: 4 }}>
          <h3 style={{ margin: 0 }}>Gargalo de Acesso à UTI</h3>
          <p className="meta">Análise de eficiência na admissão crítica</p>
        </div>
        <div className="filters vigilance-history-controls">
          <div className="pill-group">
            {(['year', 'month', 'week'] as const)
              .filter((mode) => !(isYearSelected && mode === 'year'))
              .map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`pill-btn ${groupBy === mode ? 'active' : ''}`}
                  onClick={() => setGroupBy(mode)}
                >
                  {mode === 'year' ? 'Ano' : mode === 'month' ? 'Mês' : 'Semana'}
                </button>
              ))}
          </div>
        </div>
      </div>

      {summary && (
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
                <div style={{ width: `${summary.sameDayRate}%`, background: '#0f766e' }}></div>
                <div style={{ width: `${summary.waitMoreRate}%`, background: '#d97706' }}></div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '30px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#0f766e', fontWeight: 'bold' }}>
                ● Admissão no Mesmo Dia
              </span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                {summary.sameDayRate}%{' '}
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    fontWeight: 'normal',
                  }}
                >
                  ({summary.sameDay} casos)
                </span>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>
                ● Tempo de Espera {'>'} 0d
              </span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                {summary.waitMoreRate}%{' '}
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    fontWeight: 'normal',
                  }}
                >
                  ({summary.waitMore} casos)
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
            O gráfico abaixo detalha apenas os {summary.waitMoreRate}% de pacientes que não foram
            admitidos imediatamente.
          </p>
        </div>
      )}

      <div style={{ marginTop: '25px' }}>
        <IcuRidgelinePlot data={data} groupBy={groupBy} />
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
        * Exibidos apenas períodos com ≥ {groupBy === 'year' ? 50 : groupBy === 'month' ? 20 : 10}{' '}
        admissões.
      </p>
    </article>
  );
});

const VigilanceComorbiditiesSection = React.memo<{ data: Epi.ComorbiditiesTreemapResponse | null }>(
  ({ data }) => {
    return (
      <article
        className="panel"
        style={{ height: '380px', display: 'flex', flexDirection: 'column' }}
      >
        <div
          className="section-header"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div className="stack" style={{ gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>Associação de Comorbidades com o Óbito (Odds Ratio)</h3>
              <div
                className="kpi-tooltip-wrapper"
                style={{ display: 'inline-block', cursor: 'help' }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '1px solid var(--text-muted)',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                  }}
                >
                  ?
                </span>
                <div
                  className="kpi-tooltip-content"
                  style={{
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '280px',
                    maxWidth: '280px',
                    textAlign: 'left',
                    bottom: '120%',
                  }}
                >
                  <p style={{ margin: '0 0 6px 0' }}>
                    <strong>Métrica (Odds Ratio):</strong> Mede a chance de óbito de notificados com
                    a comorbidade comparada a pacientes sem ela. Valores &gt; 1.0 com limites do
                    Intervalo de Confiança de 95% (linhas horizontais) acima de 1.0 indicam risco
                    significativamente aumentado.
                  </p>
                  <p style={{ margin: '0 0 6px 0' }}>
                    <strong>Ordenação:</strong> Comorbidades ordenadas por magnitude de risco
                    decrescente (do maior risco no topo para o maior fator protetor na base).
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Escala Logarítmica (Eixo X):</strong> Utiliza uma escala logarítmica
                    para representar com clareza variações de risco pequenas (0.1 a 1) e grandes (1
                    a 50) no mesmo espaço visual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="chart-wrap chart-wrap--tall" style={{ flex: 1, minHeight: 0 }}>
          <ComorbiditiesTreemapChart data={data} />
        </div>
      </article>
    );
  },
);

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

const _Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 30,
  color = 'var(--primary)',
}) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
};

const VigilancePage: React.FC<VigilancePageProps> = ({
  data,
  agentFilter,
  citizenTab,
  raceFilter,
  genderFilter,
  zoneFilter,
  bairroFilter,
  unitFilter,
  dashboardYear,
  maternalFilter,
  occupationFilter,
  schoolingFilter = [],
  riskFilter = [],
  dashboardMonth,
  dashboardDay,
}) => {
  const [casosMode, setCasosMode] = useState<'notificados' | 'confirmados' | 'atrasados'>(
    'notificados',
  );
  const [weeksWindow, setWeeksWindow] = useState('0');
  const [delayWeeks, setDelayWeeks] = useState('0');
  const delaySeries = data?.laboratoryNetwork?.notification_delay || [];
  const [seriesMode, setSeriesMode] = useState('weekly');
  const [curveMode, setCurveMode] = useState<'composicao' | 'positividade' | 'acumulado'>(
    'positividade',
  );
  const [curveWeeks, setCurveWeeks] = useState('0');
  const [virusDetail, setVirusDetail] = useState('summary');
  const [trends, setTrends] = useState<Epi.TrendsData | null>(null);
  const [virus, setVirus] = useState<Epi.VirusData[] | null>(null);
  const [_seasonalTrends, setSeasonalTrends] = useState<Epi.SeasonalTrendsResponse | null>(null);
  const [severityPyramid, setSeverityPyramid] = useState<Epi.SeverityPyramidResponse | null>(null);
  const [_gravityCascade, setGravityCascade] = useState<Epi.GravityCascadeResponse | null>(null);
  const [comorbidities, setComorbidities] = useState<Epi.ComorbiditiesTreemapResponse | null>(null);
  const [_ventilatorySupport, setVentilatorySupport] =
    useState<Epi.VentilatorySupportResponse | null>(null);
  const [icuBottleneck, setIcuBottleneck] = useState<Epi.IcuBottleneckRecord[]>([]);
  const { diagResData, diagResLoading, nosoRiskData, nosoRiskLoading } = useVigilanceExtraData(
    true,
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    agentFilter,
    maternalFilter,
    occupationFilter,
    schoolingFilter,
    riskFilter,
    dashboardMonth,
    dashboardDay,
  );
  const lookback = '0';

  useEffect(() => {
    let active = true;
    api
      .fetchVirus(
        virusDetail,
        citizenTab,
        raceFilter,
        genderFilter,
        zoneFilter,
        bairroFilter,
        unitFilter,
        dashboardYear,
        agentFilter,
        maternalFilter,
        occupationFilter,
        schoolingFilter,
        riskFilter,
        dashboardMonth,
        dashboardDay,
      )
      .then((res) => {
        if (active) setVirus(res);
      });
    return () => {
      active = false;
    };
  }, [
    virusDetail,
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    agentFilter,
    maternalFilter,
    occupationFilter,
    schoolingFilter,
    riskFilter,
    dashboardMonth,
    dashboardDay,
  ]);

  useEffect(() => {
    let active = true;
    api
      .fetchTrends(
        weeksWindow,
        lookback,
        citizenTab,
        raceFilter,
        genderFilter,
        zoneFilter,
        bairroFilter,
        unitFilter,
        dashboardYear,
        agentFilter,
        maternalFilter,
        occupationFilter,
        schoolingFilter,
        riskFilter,
        dashboardMonth,
        dashboardDay,
      )
      .then((res) => {
        if (active) setTrends(res);
      });
    return () => {
      active = false;
    };
  }, [
    weeksWindow,
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    agentFilter,
    maternalFilter,
    occupationFilter,
    schoolingFilter,
    riskFilter,
    dashboardMonth,
    dashboardDay,
  ]);

  useEffect(() => {
    const selectedAgent = agentFilter[0];
    if (selectedAgent === 'Influenza' && virusDetail !== 'influenza_detailed')
      setVirusDetail('influenza_detailed');
    if (selectedAgent === 'COVID-19' && virusDetail !== 'covid_detailed')
      setVirusDetail('covid_detailed');
  }, [agentFilter, virusDetail]);

  useEffect(() => {
    let active = true;
    api
      .fetchSeasonalTrends(
        citizenTab,
        raceFilter,
        genderFilter,
        zoneFilter,
        bairroFilter,
        unitFilter,
        dashboardYear,
        agentFilter,
        maternalFilter,
        occupationFilter,
        schoolingFilter,
        riskFilter,
        dashboardMonth,
        dashboardDay,
      )
      .then((res) => {
        if (active) setSeasonalTrends(res);
      })
      .catch((err) => console.error('Failed to fetch seasonal trends', err));
    return () => {
      active = false;
    };
  }, [
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    agentFilter,
    maternalFilter,
    occupationFilter,
    schoolingFilter,
    riskFilter,
    dashboardMonth,
    dashboardDay,
  ]);

  useEffect(() => {
    let active = true;
    api
      .fetchSeverityPyramid(
        citizenTab,
        raceFilter,
        genderFilter,
        zoneFilter,
        bairroFilter,
        unitFilter,
        dashboardYear,
        agentFilter,
        maternalFilter,
        occupationFilter,
        schoolingFilter,
        riskFilter,
        dashboardMonth,
        dashboardDay,
      )
      .then((res) => {
        if (active) setSeverityPyramid(res);
      })
      .catch((err) => console.error('Failed to fetch severity pyramid', err));
    return () => {
      active = false;
    };
  }, [
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    agentFilter,
    maternalFilter,
    occupationFilter,
    schoolingFilter,
    riskFilter,
    dashboardMonth,
    dashboardDay,
  ]);

  useEffect(() => {
    let active = true;
    api
      .fetchGravityCascade(
        citizenTab,
        raceFilter,
        genderFilter,
        zoneFilter,
        bairroFilter,
        unitFilter,
        dashboardYear,
        agentFilter,
        maternalFilter,
        occupationFilter,
        schoolingFilter,
        riskFilter,
        dashboardMonth,
        dashboardDay,
      )
      .then((res) => {
        if (active) setGravityCascade(res);
      })
      .catch((err) => console.error('Failed to fetch gravity cascade', err));
    return () => {
      active = false;
    };
  }, [
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    agentFilter,
    maternalFilter,
    occupationFilter,
    schoolingFilter,
    riskFilter,
    dashboardMonth,
    dashboardDay,
  ]);

  useEffect(() => {
    let active = true;
    api
      .fetchIcuBottleneck(
        citizenTab,
        raceFilter,
        genderFilter,
        zoneFilter,
        bairroFilter,
        unitFilter,
        dashboardYear,
        agentFilter,
        maternalFilter,
        occupationFilter,
        schoolingFilter,
        riskFilter,
        dashboardMonth,
        dashboardDay,
      )
      .then((res) => {
        if (active) setIcuBottleneck(res);
      })
      .catch((err) => console.error('Failed to fetch icu bottleneck', err));
    return () => {
      active = false;
    };
  }, [
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    agentFilter,
    maternalFilter,
    occupationFilter,
    schoolingFilter,
    riskFilter,
    dashboardMonth,
    dashboardDay,
  ]);

  useEffect(() => {
    let active = true;
    api
      .fetchComorbiditiesTreemap(
        citizenTab,
        raceFilter,
        genderFilter,
        zoneFilter,
        bairroFilter,
        unitFilter,
        dashboardYear,
        agentFilter,
        maternalFilter,
        occupationFilter,
        schoolingFilter,
        riskFilter,
        dashboardMonth,
        dashboardDay,
      )
      .then((res) => {
        if (active) setComorbidities(res);
      })
      .catch((err) => console.error('Failed to fetch comorbidities treemap', err));
    return () => {
      active = false;
    };
  }, [
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    agentFilter,
    maternalFilter,
    occupationFilter,
    schoolingFilter,
    riskFilter,
    dashboardMonth,
    dashboardDay,
  ]);

  useEffect(() => {
    let active = true;
    api
      .fetchVentilatorySupport(
        citizenTab,
        raceFilter,
        genderFilter,
        zoneFilter,
        bairroFilter,
        unitFilter,
        dashboardYear,
        agentFilter,
        maternalFilter,
        occupationFilter,
        schoolingFilter,
        riskFilter,
        dashboardMonth,
        dashboardDay,
      )
      .then((res) => {
        if (active) setVentilatorySupport(res);
      })
      .catch((err) => console.error('Failed to fetch ventilatory support', err));
    return () => {
      active = false;
    };
  }, [
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    agentFilter,
    maternalFilter,
    occupationFilter,
    schoolingFilter,
    riskFilter,
    dashboardMonth,
    dashboardDay,
  ]);

  const currentTrends = trends ?? data?.trends ?? null;

  return (
    <>
      <VigilanceHistorySection
        data={data}
        currentTrends={currentTrends}
        casosMode={casosMode}
        weeksWindow={weeksWindow}
        seriesMode={seriesMode}
        curveMode={curveMode}
        curveWeeks={curveWeeks}
        delayWeeks={delayWeeks}
        delaySeries={delaySeries}
        onCasosMode={setCasosMode}
        onWeeksWindow={setWeeksWindow}
        onSeriesMode={setSeriesMode}
        onCurveMode={setCurveMode}
        onCurveWeeks={setCurveWeeks}
        onDelayWeeks={setDelayWeeks}
      />
      <section className="secondary-grid" style={{ gridTemplateColumns: '1fr', marginTop: '2rem' }}>
        <VigilanceSeverityPyramidSection
          severityData={severityPyramid}
          lethalityData={data?.laboratoryNetwork?.agent_lethality_heatmap ?? null}
        />
      </section>

      <section
        className="vigilance-top-grid"
        style={{
          marginTop: '2rem',
        }}
      >
        <VigilanceViralProfile
          virus={virus}
          virusDetail={virusDetail}
          agentFilter={agentFilter}
          onVirusDetail={setVirusDetail}
        />
        <NosocomialRiskChart data={nosoRiskData} diagData={diagResData} loading={nosoRiskLoading} />
        <DiagnosticResilienceChart data={diagResData} loading={diagResLoading} />
      </section>

      {riskFilter.length === 0 && (
        <section
          className="secondary-grid"
          style={{ gridTemplateColumns: '1fr', marginTop: '2rem' }}
        >
          <VigilanceComorbiditiesSection data={comorbidities} />
        </section>
      )}
      <section className="secondary-grid" style={{ gridTemplateColumns: '1fr', marginTop: '2rem' }}>
        <VigilanceIcuBottleneckSection data={icuBottleneck} dashboardYear={dashboardYear} />
      </section>
    </>
  );
};

export default VigilancePage;
