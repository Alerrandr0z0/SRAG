import React, { useMemo, useState } from 'react';
import { useEcharts } from '../../hooks/useEcharts';
import { useThemeMode } from '../../hooks/useThemeMode';
import * as Epi from '../../types/epi';
import RankTable, { RankTableColumn } from '../ui/RankTable';

interface AuditPanelProps {
  loading: boolean;
  completeness: Epi.DataCompletenessGroup[];
  completenessTrend: Epi.CompletenessTrendPoint[];
  qualityByUnit: Epi.UnitQualityScore[];
  qualityByBairro: Epi.BairroQualityScore[];
  qualityByLaboratory: Epi.LaboratorioQualityScore[];
  inconsistencies: Epi.LogicalInconsistency[];
}

const getScoreColor = (score: number, isDark = false) => {
  if (score >= 90) return isDark ? '#34d399' : '#059669'; // Emerald 400 vs 600
  if (score >= 70) return isDark ? '#2dd4bf' : '#0f766e'; // Teal 400 vs 700
  if (score >= 50) return isDark ? '#fbbf24' : '#d97706'; // Amber 400 vs 600
  return isDark ? '#f87171' : '#ef4444'; // Red 400 vs 600
};

const getSeverityBadge = (severity: 'critical' | 'warning' | 'info') => {
  switch (severity) {
    case 'critical':
      return {
        label: 'Crítico',
        bg: 'rgba(239, 68, 68, 0.12)',
        color: '#f87171',
        border: 'rgba(239, 68, 68, 0.3)',
      };
    case 'warning':
      return {
        label: 'Alerta',
        bg: 'rgba(245, 158, 11, 0.12)',
        color: '#fbbf24',
        border: 'rgba(245, 158, 11, 0.3)',
      };
    case 'info':
      return {
        label: 'Informativo',
        bg: 'rgba(59, 130, 246, 0.12)',
        color: '#60a5fa',
        border: 'rgba(59, 130, 246, 0.3)',
      };
  }
};

const SHORT_LABELS: Record<string, string> = {
  R1: 'Óbito sem data',
  R2: 'Internação sem data',
  R3: 'UTI sem data',
  R4: 'PCR sem classificação',
  R5: 'Antiviral sem data',
  R6: 'Coleta sem resultado',
  R7: 'Classificação sem critério',
  R8: 'Evolução anterior aos sintomas',
};

const BLOCK_COLORS = ['#0f766e', '#7c3aed', '#dc2626', '#ca8a04', '#0891b2'];

const BLOCK_LABELS = [
  'Identificação do Caso',
  'Demografia e Residência',
  'Linha do Cuidado',
  'Coleta e Diagnóstico',
  'Vacinação e Gestação',
];

const CompletenessTrendChart: React.FC<{ data: Epi.CompletenessTrendPoint[] }> = ({ data }) => {
  const theme = useThemeMode();
  const getOption = () => {
    const isDark = theme === 'dark';
    const axisColor = isDark ? '#475569' : '#cbd5e1';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const splitLineColor = isDark ? '#334155' : '#f1f5f9';

    const weeks = data.map((d) => d.epi_week);
    const series = BLOCK_LABELS.map((label, i) => {
      const values = data.map((d) => d.blocks?.[label] ?? d.score);
      return {
        name: label,
        type: 'line',
        data: values,
        smooth: true,
        showSymbol: data.length < 50,
        symbolSize: 4,
        lineStyle: { width: 2 },
        itemStyle: { color: BLOCK_COLORS[i % BLOCK_COLORS.length] },
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: axisColor, width: 1, type: 'dashed' } },
      },
      legend: {
        data: BLOCK_LABELS,
        top: 0,
        textStyle: { color: textColor, fontSize: 10 },
        itemWidth: 14,
        itemHeight: 10,
      },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '20%', containLabel: true },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLabel: { rotate: 35, fontSize: 10, color: textColor },
        axisLine: { lineStyle: { color: axisColor } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%', color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { type: 'dashed', color: splitLineColor } },
      },
      series,
    };
  };

  const { chartRef } = useEcharts(getOption(), [data, theme]);
  return <div ref={chartRef} style={{ height: '320px', width: '100%' }} />;
};

const AuditPanel: React.FC<AuditPanelProps> = ({
  loading,
  completeness,
  completenessTrend,
  qualityByUnit,
  qualityByBairro,
  qualityByLaboratory,
  inconsistencies,
}) => {
  const theme = useThemeMode();
  const isDark = theme === 'dark';

  const [qualMode, setQualMode] = useState<'unidade' | 'localidade' | 'laboratorio'>('unidade');
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedMun, setSelectedMun] = useState('');
  const [munSearch, setMunSearch] = useState('');
  const [showMunDropdown, setShowMunDropdown] = useState(false);

  const availableUfs = useMemo(() => {
    const ufs = new Set<string>();
    (qualityByUnit || []).forEach((u) => {
      if (u.uf) ufs.add(u.uf);
    });
    return Array.from(ufs).sort();
  }, [qualityByUnit]);

  const availableMuns = useMemo(() => {
    const muns = new Set<string>();
    (qualityByUnit || []).forEach((u) => {
      if (u.municipio && (!selectedUf || u.uf === selectedUf)) {
        muns.add(u.municipio);
      }
    });
    return Array.from(muns).sort();
  }, [qualityByUnit, selectedUf]);

  const filteredAvailableMuns = useMemo(() => {
    const term = munSearch.toLowerCase().trim();
    if (!term) return availableMuns;
    return availableMuns.filter((m) => m.toLowerCase().includes(term));
  }, [availableMuns, munSearch]);

  const filteredQualityUnits = useMemo(() => {
    return (qualityByUnit || []).filter((item) => {
      const matchUf = !selectedUf || item.uf === selectedUf;
      const matchMun = !selectedMun || item.municipio === selectedMun;
      return matchUf && matchMun;
    });
  }, [qualityByUnit, selectedUf, selectedMun]);

  const localidadeData = useMemo(() => {
    return (qualityByBairro || []).map((b) => ({
      key: b.bairro,
      bairro: b.bairro,
      total: b.total,
      score: Math.round(b.score),
      worst_field: b.worst_field,
      worst_rate: b.worst_rate,
    }));
  }, [qualityByBairro]);

  const severitySummary = useMemo(() => {
    const counts = { critical: 0, warning: 0, info: 0 };
    inconsistencies.forEach((i) => {
      if (i.count > 0) counts[i.severity]++;
    });
    return counts;
  }, [inconsistencies]);

  if (loading) return <p className="meta">Carregando central de qualidade de dados...</p>;

  const globalScore =
    completeness.length > 0
      ? Math.round(completeness.reduce((acc, c) => acc + c.overall_score, 0) / completeness.length)
      : 0;
  const totalNotifications = qualityByUnit.reduce((acc, q) => acc + q.total, 0);
  const criticalFieldsCount = completeness.reduce(
    (acc, group) => acc + group.fields.filter((f) => f.rate < 50).length,
    0,
  );
  const totalInconsistencies = inconsistencies.reduce((acc, inc) => acc + inc.count, 0);
  const worstUnit = qualityByUnit[0];

  const qualTitle =
    qualMode === 'unidade'
      ? 'Qualidade por Unidade'
      : qualMode === 'localidade'
        ? 'Qualidade por Localidade'
        : 'Qualidade por Laboratório';

  const qualSubtitle =
    qualMode === 'unidade'
      ? 'Completude global e principal gargalo por unidade notificadora'
      : qualMode === 'localidade'
        ? 'Completude global agregada por município'
        : 'Completude global por laboratório';

  const qualPlaceholder =
    qualMode === 'unidade'
      ? 'Filtrar por unidade ou CNES...'
      : qualMode === 'localidade'
        ? 'Filtrar por município...'
        : 'Filtrar por laboratório...';

  const qualColumns: RankTableColumn[] =
    qualMode === 'unidade'
      ? [
          { key: 'estabelecimento', label: 'Unidade Notificadora' },
          { key: 'localizacao', label: 'Localização' },
          { key: 'total', label: 'Notificações', align: 'right' },
          { key: 'score', label: 'Score Geral (%)', align: 'right' },
          { key: 'worst_field', label: 'Campo Mais Negligenciado' },
          { key: 'worst_rate', label: 'Completude Campo (%)', align: 'right' },
        ]
      : qualMode === 'localidade'
        ? [
            { key: 'localizacao', label: 'Bairro/Comunidade' },
            { key: 'total', label: 'Notificações', align: 'right' },
            { key: 'score', label: 'Score Geral (%)', align: 'right' },
            { key: 'worst_field', label: 'Pior Campo' },
            { key: 'worst_rate', label: 'Completude (%)', align: 'right' },
          ]
        : [
            { key: 'laboratorio', label: 'Laboratório' },
            { key: 'total', label: 'Exames', align: 'right' },
            { key: 'score', label: 'Score Geral (%)', align: 'right' },
            { key: 'diagnostico_score', label: 'Diagnóstico (%)', align: 'right' },
            { key: 'resultado_pct', label: 'Resultado (%)', align: 'right' },
          ];

  const qualRows =
    qualMode === 'unidade'
      ? filteredQualityUnits.map((unit) => ({
          key: `${unit.nome_fantasia} ${unit.id_unidade}`,
          values: {
            estabelecimento: (
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {unit.nome_fantasia}
                </span>
                <br />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  CNES: {unit.id_unidade}
                </span>
              </div>
            ),
            localizacao:
              unit.municipio && unit.uf ? `${unit.municipio} - ${unit.uf}` : 'Não informado',
            total: <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{unit.total}</span>,
            score: (
              <span style={{ fontWeight: 800, color: getScoreColor(unit.score, isDark) }}>
                {unit.score}%
              </span>
            ),
            worst_field: (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                {unit.worst_field}
              </span>
            ),
            worst_rate: (
              <span style={{ fontWeight: 700, color: getScoreColor(unit.worst_rate, isDark) }}>
                {unit.worst_rate}%
              </span>
            ),
          },
        }))
      : qualMode === 'localidade'
        ? localidadeData.map((loc) => ({
            key: loc.bairro,
            values: {
              localizacao: (
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{loc.bairro}</span>
              ),
              total: loc.total,
              score: (
                <span style={{ fontWeight: 800, color: getScoreColor(loc.score, isDark) }}>
                  {loc.score}%
                </span>
              ),
              worst_field: (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {loc.worst_field}
                </span>
              ),
              worst_rate: (
                <span style={{ fontWeight: 700, color: getScoreColor(loc.worst_rate, isDark) }}>
                  {loc.worst_rate}%
                </span>
              ),
            },
          }))
        : (qualityByLaboratory || []).map((lab) => ({
            key: lab.laboratorio,
            values: {
              laboratorio: (
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {lab.laboratorio}
                </span>
              ),
              total: lab.total,
              score: (
                <span style={{ fontWeight: 800, color: getScoreColor(lab.score, isDark) }}>
                  {lab.score}%
                </span>
              ),
              diagnostico_score: (
                <span
                  style={{ fontWeight: 700, color: getScoreColor(lab.diagnostico_score, isDark) }}
                >
                  {lab.diagnostico_score}%
                </span>
              ),
              resultado_pct: (
                <span style={{ fontWeight: 700, color: getScoreColor(lab.resultado_pct, isDark) }}>
                  {lab.resultado_pct}%
                </span>
              ),
            },
          }));

  return (
    <div className="stack" style={{ gap: '2rem' }}>
      <header>
        <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Central de Inteligência de Qualidade de Dados
        </h2>
        <p className="sub" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
          Monitoramento de integridade, completude e consistência lógica das notificações de SRAG.
        </p>
      </header>

      {/* SECTION 1: Score Geral + KPIs */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <article
          className="panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            background: isDark
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: isDark ? '1px solid var(--border-color)' : 'none',
            color: '#f8fafc',
          }}
        >
          <div style={{ position: 'relative', width: '70px', height: '70px' }}>
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle
                cx="35"
                cy="35"
                r="28"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="6"
              />
              <circle
                cx="35"
                cy="35"
                r="28"
                fill="none"
                stroke={getScoreColor(globalScore, isDark)}
                strokeWidth="6"
                strokeDasharray={2 * Math.PI * 28}
                strokeDashoffset={2 * Math.PI * 28 - (globalScore / 100) * (2 * Math.PI * 28)}
                strokeLinecap="round"
                transform="rotate(-90 35 35)"
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
              <text x="35" y="45" textAnchor="middle" fontSize="14" fontWeight="900" fill="#f8fafc">
                {globalScore}%
              </text>
            </svg>
          </div>
          <div>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: '#94a3b8',
                fontWeight: 700,
              }}
            >
              Completude Geral
            </span>
            <h4 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
              Score Global
            </h4>
          </div>
        </article>

        <article
          className="panel"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          <span
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            Registros Analisados
          </span>
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text-main)',
            }}
          >
            {totalNotifications}
          </p>
        </article>

        <article
          className="panel"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          <span
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            Inconsistências Lógicas
          </span>
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: '1.75rem',
              fontWeight: 800,
              color:
                totalInconsistencies > 0
                  ? isDark
                    ? '#f87171'
                    : '#ef4444'
                  : isDark
                    ? '#34d399'
                    : '#059669',
            }}
          >
            {totalInconsistencies}
          </p>
        </article>

        <article
          className="panel"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          <span
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            Campos Críticos (&lt;50%)
          </span>
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: '1.75rem',
              fontWeight: 800,
              color:
                criticalFieldsCount > 0
                  ? isDark
                    ? '#fbbf24'
                    : '#d97706'
                  : isDark
                    ? '#34d399'
                    : '#059669',
            }}
          >
            {criticalFieldsCount}
          </p>
        </article>

        <article
          className="panel"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          <span
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            Menor Completude
          </span>
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: '1.1rem',
              fontWeight: 800,
              color: isDark ? '#f87171' : '#ef4444',
            }}
          >
            {worstUnit ? `${worstUnit.score}%` : 'N/A'}
          </p>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {worstUnit ? worstUnit.nome_fantasia : ''}
          </span>
        </article>
      </section>

      {/* SECTION 2: Completude por Bloco de Dados */}
      <section>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h3
            style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}
          >
            Completude por Bloco de Dados
          </h3>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}
        >
          {completeness.map((group) => (
            <article
              key={group.group}
              className="panel"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.75rem',
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                  }}
                >
                  {group.group}
                </h4>
                <div>
                  <svg width="46" height="46" viewBox="0 0 46 46">
                    <circle
                      cx="23"
                      cy="23"
                      r="18"
                      fill="none"
                      stroke="var(--border-subtle)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="23"
                      cy="23"
                      r="18"
                      fill="none"
                      stroke={getScoreColor(group.overall_score, isDark)}
                      strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 18}
                      strokeDashoffset={
                        2 * Math.PI * 18 - (group.overall_score / 100) * (2 * Math.PI * 18)
                      }
                      strokeLinecap="round"
                      transform="rotate(-90 23 23)"
                    />
                    <text
                      x="23"
                      y="31"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="800"
                      fill="var(--text-main)"
                    >
                      {group.overall_score}%
                    </text>
                  </svg>
                </div>
              </div>

              <div className="stack" style={{ gap: '1rem', flex: 1 }}>
                {group.fields.map((field) => (
                  <div key={field.field}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                        fontSize: '11px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {field.field}
                      </span>
                      <span style={{ fontWeight: 700, color: getScoreColor(field.rate, isDark) }}>
                        {field.rate}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        background: 'var(--bg-pill)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(field.rate, 100)}%`,
                          background: getScoreColor(field.rate, isDark),
                          borderRadius: '3px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* SECTION 3: Tendência Temporal de Completude */}
      <section>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-main)',
              }}
            >
              Tendência Temporal de Completude
            </h3>
            <p
              className="meta"
              style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}
            >
              Evolução do score médio por bloco semântico por Semana Epidemiológica.
            </p>
          </div>
        </div>
        <div
          style={{
            height: '320px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {completenessTrend.length > 0 ? (
            <CompletenessTrendChart data={completenessTrend} />
          ) : (
            <p className="meta">Nenhum dado temporal disponível para gerar o gráfico.</p>
          )}
        </div>
      </section>

      {/* SECTION 5: Problemas de Preenchimento */}
      <section className="panel" style={{ height: 'fit-content' }}>
        <div className="section-header" style={{ marginBottom: '1.25rem' }}>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-main)',
              }}
            >
              Problemas de Preenchimento
            </h3>
            <p
              className="meta"
              style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}
            >
              Registros com dados ausentes ou logicamente inconsistentes.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {(
              [
                { key: 'critical', label: 'Críticas', color: '#f87171' },
                { key: 'warning', label: 'Alertas', color: '#fbbf24' },
                { key: 'info', label: 'Info', color: '#60a5fa' },
              ] as const
            ).map(
              (s) =>
                severitySummary[s.key] > 0 && (
                  <span
                    key={s.key}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: s.color,
                      background: isDark ? `${s.color}15` : `${s.color}12`,
                      padding: '3px 8px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {severitySummary[s.key]} {s.label}
                  </span>
                ),
            )}
          </div>
        </div>

        <div
          className="stack"
          style={{ gap: '1rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}
        >
          {inconsistencies.length === 0 ? (
            <p className="meta">Nenhuma inconsistência lógica detectada no banco de dados.</p>
          ) : (
            inconsistencies.map((inc) => {
              const badge = getSeverityBadge(inc.severity);
              const label = SHORT_LABELS[inc.rule] || inc.rule;
              return (
                <div
                  key={inc.rule}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg-status)',
                    border: `1px solid ${badge.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {inc.severity === 'critical' ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={badge.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ flexShrink: 0 }}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      ) : inc.severity === 'warning' ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={badge.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ flexShrink: 0 }}
                        >
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={badge.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ flexShrink: 0 }}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      )}
                      <span
                        style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}
                      >
                        {label}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          background: 'var(--bg-pill)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        {inc.rule}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color:
                          inc.count > 0
                            ? isDark
                              ? '#f87171'
                              : '#ef4444'
                            : isDark
                              ? '#34d399'
                              : '#059669',
                      }}
                    >
                      {inc.pct}% ({inc.count} / {totalNotifications})
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                      lineHeight: 1.4,
                    }}
                  >
                    {inc.description}
                  </p>

                  {inc.count > 0 && (
                    <div
                      style={{
                        width: '100%',
                        height: '4px',
                        background: 'var(--bg-pill)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${inc.pct}%`,
                          height: '100%',
                          background: badge.color,
                          borderRadius: '2px',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* SECTION 4: Qualidade por Estabelecimento */}
      <article className="panel" style={{ boxShadow: 'none' }}>
        <RankTable
          title={qualTitle}
          subtitle={qualSubtitle}
          searchPlaceholder={qualPlaceholder}
          columns={qualColumns}
          rows={qualRows}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div className="pill-group">
              {[
                { v: 'unidade', l: 'Unidade' },
                { v: 'localidade', l: 'Localidade' },
                { v: 'laboratorio', l: 'Laboratório' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  className={`pill-btn ${qualMode === opt.v ? 'active' : ''}`}
                  onClick={() => setQualMode(opt.v as typeof qualMode)}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            {qualMode !== 'localidade' && (
              <>
                <label
                  htmlFor="uf-select-audit"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  UF
                </label>
                <select
                  id="uf-select-audit"
                  value={selectedUf}
                  onChange={(e) => {
                    setSelectedUf(e.target.value);
                    setSelectedMun('');
                    setMunSearch('');
                  }}
                  className="rank-search"
                  style={{ minWidth: '72px', width: 'auto' }}
                >
                  <option value="">Todas</option>
                  {availableUfs.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                <label
                  htmlFor="mun-search-audit"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Município
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="mun-search-audit"
                    type="text"
                    placeholder="Buscar cidade..."
                    value={munSearch}
                    onChange={(e) => {
                      setMunSearch(e.target.value);
                      setShowMunDropdown(true);
                    }}
                    onFocus={() => setShowMunDropdown(true)}
                    className="rank-search"
                    style={{ minWidth: '150px', paddingRight: '24px' }}
                  />
                  {(munSearch || selectedMun) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMunSearch('');
                        setSelectedMun('');
                      }}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '0',
                        lineHeight: '1',
                      }}
                    >
                      ×
                    </button>
                  )}
                  {showMunDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: '0',
                        width: '100%',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        zIndex: 100,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        marginTop: '4px',
                      }}
                    >
                      {filteredAvailableMuns.map((mun) => (
                        <button
                          key={mun}
                          type="button"
                          onClick={() => {
                            setSelectedMun(mun);
                            setMunSearch(mun);
                            setShowMunDropdown(false);
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '6px 10px',
                            fontSize: '11px',
                            textAlign: 'left',
                            border: 'none',
                            background: selectedMun === mun ? 'rgba(15, 118, 110, 0.12)' : 'none',
                            color: selectedMun === mun ? 'var(--text-main)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontWeight: selectedMun === mun ? 600 : 'normal',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-status)';
                            e.currentTarget.style.color = 'var(--text-main)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                              selectedMun === mun ? 'rgba(15, 118, 110, 0.12)' : 'none';
                            e.currentTarget.style.color =
                              selectedMun === mun ? 'var(--text-main)' : 'var(--text-muted)';
                          }}
                        >
                          {mun}
                        </button>
                      ))}
                      {filteredAvailableMuns.length === 0 && (
                        <div
                          style={{
                            padding: '8px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                          }}
                        >
                          Nenhuma cidade
                        </div>
                      )}
                    </div>
                  )}
                  {/* Click outside detection helper */}
                  {showMunDropdown && (
                    <div
                      onClick={() => setShowMunDropdown(false)}
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 99,
                        background: 'transparent',
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </RankTable>
      </article>

      {/* FOOTER: Nota Metodológica */}
      <article
        className="panel"
        style={{
          background: 'var(--bg-active-pill)',
          border: '1px dashed var(--border-active-pill)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start',
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>💡</span>
        <div>
          <h4
            style={{
              margin: '0 0 4px 0',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-active-pill)',
            }}
          >
            Nota Metodológica e Estratégia de Qualidade
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: 'var(--text-main)',
              opacity: 0.9,
              lineHeight: 1.6,
            }}
          >
            Esta central analisa a completude (campos preenchidos com valores válidos, ignorando
            códigos 9 de "Ignorado" e nulos) e a consistência (regras lógicas cruzadas que validam a
            coerência clínica das datas e registros). Um Score Global superior a 90% é recomendado
            para a tomada de decisões de saúde municipal seguras. Ações de educação continuada para
            digitadores das unidades notificadoras devem priorizar os{' '}
            <strong>estabelecimentos com menor score</strong> e os
            <strong>campos mais negligenciados</strong> apontados no ranking acima.
          </p>
        </div>
      </article>
    </div>
  );
};

export default AuditPanel;
