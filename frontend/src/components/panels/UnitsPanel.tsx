import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as Epi from '../../types/epi';
import AggregatedSwimmerPlot from '../charts/AggregatedSwimmerPlot';
import DelayByUnitRidgelinePlot, { UnitDelayRecord } from '../charts/DelayByUnitRidgelinePlot';
import HospitalizationHistogram from '../charts/HospitalizationHistogram';
import SankeyChart from '../charts/SankeyChart';
import ErrorBoundary from '../ui/ErrorBoundary';
import RankTable from '../ui/RankTable';

const formatDays = (value: number) => `${value.toFixed(1)}d`;
const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}d`;
const formatRatio = (value: number) => `${value.toFixed(1)}x`;

const quantile = (sorted: number[], p: number): number => {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
};


interface UnitsPanelProps {
  loading: boolean;
  units: Epi.UnitStats[];
  hospitalization: Epi.HospitalizationDurationData | null;
  clinicalFlow: Epi.ClinicalFlow;
  timelineData: Epi.AggregatedTimeline[];
  delayByUnit: UnitDelayRecord[] | null;
  swimmerVirus: 'covid' | 'gripe';
  setSwimmerVirus: (v: 'covid' | 'gripe') => void;
  etiologicAgentFilter?: string[];
}

const UnitsPanel: React.FC<UnitsPanelProps> = ({
  loading,
  units,
  hospitalization,
  clinicalFlow,
  timelineData,
  delayByUnit = [],
  swimmerVirus,
  setSwimmerVirus,
  etiologicAgentFilter = [],
}) => {
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedMun, setSelectedMun] = useState('');
  const [munSearch, setMunSearch] = useState('');
  const [showMunDropdown, setShowMunDropdown] = useState(false);
  const [activeMunIndex, setActiveMunIndex] = useState(-1);
  const munInputRef = useRef<HTMLInputElement>(null);
  const munListId = useId();

  const selectedAgent = etiologicAgentFilter[0] || 'Todos';
  const showCovid = selectedAgent !== 'Influenza';
  const showGripe = selectedAgent !== 'COVID-19';
  const singleVirusOption = (showCovid && !showGripe) || (!showCovid && showGripe);

  const availableUfs = useMemo(() => {
    const ufs = new Set<string>();
    (units || []).forEach((u) => {
      if (u.uf) ufs.add(u.uf);
    });
    return Array.from(ufs).sort();
  }, [units]);

  const availableMuns = useMemo(() => {
    const muns = new Set<string>();
    (units || []).forEach((u) => {
      if (u.municipio && (!selectedUf || u.uf === selectedUf)) {
        muns.add(u.municipio);
      }
    });
    return Array.from(muns).sort();
  }, [units, selectedUf]);

  const filteredAvailableMuns = useMemo(() => {
    const term = munSearch.toLowerCase().trim();
    if (!term) return availableMuns;
    return availableMuns.filter((m) => m.toLowerCase().includes(term));
  }, [availableMuns, munSearch]);

  useEffect(() => {
    // Reset keyboard navigation when the filtered city list changes
    void filteredAvailableMuns.length;
    setActiveMunIndex(-1);
  }, [filteredAvailableMuns]);

  useEffect(() => {
    if (!showMunDropdown) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMunDropdown(false);
        munInputRef.current?.blur();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(`[data-mun-dropdown="${munListId}"]`) &&
        !target.closest(`[data-mun-input="${munListId}"]`)
      ) {
        setShowMunDropdown(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('touchstart', onMouseDown as unknown as EventListener);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('touchstart', onMouseDown as unknown as EventListener);
    };
  }, [showMunDropdown, munListId]);

  const filteredUnits = useMemo(() => {
    return (units || []).filter((item) => {
      const matchUf = !selectedUf || item.uf === selectedUf;
      const matchMun = !selectedMun || item.municipio === selectedMun;
      return matchUf && matchMun;
    });
  }, [units, selectedUf, selectedMun]);

  const unitRows = useMemo(
    () =>
      filteredUnits.map((item) => {
        const unidadeLabel = item.nome_fantasia || item.id_unidade;
        const localizacaoLabel =
          item.municipio && item.uf ? `${item.municipio} - ${item.uf}` : 'Não informado';
        return {
          key: item.nome_fantasia ? `${item.id_unidade}-${item.nome_fantasia}` : item.id_unidade,
          searchText: `${unidadeLabel} ${localizacaoLabel} ${item.id_unidade}`.toLowerCase(),
          values: {
            unidade: unidadeLabel,
            localizacao: localizacaoLabel,
            count: item.count,
            curados: item.curados ?? 0,
            obitos: item.obitos ?? 0,
            ignorados: item.ignorados ?? 0,
          },
          sortValues: {
            unidade: unidadeLabel,
            localizacao: localizacaoLabel,
            count: item.count,
            curados: item.curados ?? 0,
            obitos: item.obitos ?? 0,
            ignorados: item.ignorados ?? 0,
          },
        };
      }),
    [filteredUnits],
  );

  const hospitalizationExtra = useMemo(() => {
    if (!hospitalization || (hospitalization.cure_count === 0 && hospitalization.death_count === 0))
      return null;
    const cureSorted = [...hospitalization.cure].sort((a, b) => a - b);
    const deathSorted = [...hospitalization.death].sort((a, b) => a - b);
    const allSorted = [...cureSorted, ...deathSorted].sort((a, b) => a - b);
    const p90Cure = cureSorted.length ? quantile(cureSorted, 0.9) : 0;
    const p90Death = deathSorted.length ? quantile(deathSorted, 0.9) : 0;
    const iqrCure =
      cureSorted.length >= 4
        ? `${quantile(cureSorted, 0.25).toFixed(0)}–${quantile(cureSorted, 0.75).toFixed(0)}d`
        : '—';
    const iqrDeath =
      deathSorted.length >= 4
        ? `${quantile(deathSorted, 0.25).toFixed(0)}–${quantile(deathSorted, 0.75).toFixed(0)}d`
        : '—';
    const prolongedCure = cureSorted.length
      ? cureSorted.filter((v) => v > 14).length / cureSorted.length
      : 0;
    const prolongedDeath = deathSorted.length
      ? deathSorted.filter((v) => v > 14).length / deathSorted.length
      : 0;
    const allP90 = allSorted.length ? quantile(allSorted, 0.9) : 0;
    return { p90Cure, p90Death, iqrCure, iqrDeath, prolongedCure, prolongedDeath, allP90 };
  }, [hospitalization]);

  const totalFlowCases = useMemo(() => {
    if (!clinicalFlow?.links?.length) return 0;
    const rootSources = ['Comunitária', 'Infecção Hospitalar', 'Origem (Ignorado)'];
    const rootTotal = clinicalFlow.links
      .filter((l) => rootSources.includes(l.source))
      .reduce((s, l) => s + l.value, 0);
    if (rootTotal > 0) return rootTotal;
    const targets = new Set(clinicalFlow.links.map((l) => l.target));
    const roots = clinicalFlow.nodes.filter((n) => !targets.has(n.name)).map((n) => n.name);
    return clinicalFlow.links
      .filter((l) => roots.includes(l.source))
      .reduce((s, l) => s + l.value, 0);
  }, [clinicalFlow]);

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      {loading && <p className="meta">Carregando dados de unidades...</p>}

      <article className="panel">
        <RankTable
          title="Unidades notificadoras"
          searchPlaceholder="Buscar unidade ou município (ex.: Mossoró)"
          columns={[
            { key: 'unidade', label: 'Unidade', sortable: true },
            { key: 'localizacao', label: 'Localização', sortable: true },
            { key: 'count', label: 'Notificados', align: 'right', sortable: true },
            { key: 'curados', label: 'Curados', align: 'right', sortable: true },
            { key: 'obitos', label: 'Óbitos', align: 'right', sortable: true },
            { key: 'ignorados', label: 'Ignorados', align: 'right', sortable: true },
          ]}
          rows={unitRows}
          exportable={{ filename: 'unidades_notificadoras', title: 'Unidades notificadoras' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <label
              htmlFor="uf-select"
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
              id="uf-select"
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <label
              htmlFor="mun-search"
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
            <div style={{ position: 'relative' }} data-mun-input={munListId}>
              <input
                ref={munInputRef}
                id="mun-search"
                type="text"
                placeholder="Buscar cidade..."
                value={munSearch}
                onChange={(e) => {
                  setMunSearch(e.target.value);
                  setShowMunDropdown(true);
                }}
                onFocus={() => setShowMunDropdown(true)}
                onKeyDown={(e) => {
                  if (!showMunDropdown && (e.key === 'ArrowDown' || e.key === 'Enter')) {
                    setShowMunDropdown(true);
                    return;
                  }
                  if (!showMunDropdown) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveMunIndex((i) => Math.min(filteredAvailableMuns.length - 1, i + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveMunIndex((i) => Math.max(0, i - 1));
                  } else if (e.key === 'Enter') {
                    if (activeMunIndex >= 0 && filteredAvailableMuns[activeMunIndex]) {
                      e.preventDefault();
                      const chosen = filteredAvailableMuns[activeMunIndex];
                      setSelectedMun(chosen);
                      setMunSearch(chosen);
                      setShowMunDropdown(false);
                    }
                  }
                }}
                role="combobox"
                aria-expanded={showMunDropdown}
                aria-controls={munListId}
                aria-autocomplete="list"
                aria-activedescendant={
                  activeMunIndex >= 0 ? `${munListId}-opt-${activeMunIndex}` : undefined
                }
                className="rank-search"
                style={{ minWidth: '150px', paddingRight: '24px' }}
              />
              {(munSearch || selectedMun) && (
                <button
                  type="button"
                  onClick={() => {
                    setMunSearch('');
                    setSelectedMun('');
                    setActiveMunIndex(-1);
                    munInputRef.current?.focus();
                  }}
                  aria-label="Limpar município"
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
                  id={munListId}
                  data-mun-dropdown={munListId}
                  role="listbox"
                  aria-label="Municípios disponíveis"
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
                  {filteredAvailableMuns.map((mun, idx) => {
                    const isActive = idx === activeMunIndex;
                    const isSelected = selectedMun === mun;
                    return (
                      <button
                        key={mun}
                        id={`${munListId}-opt-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelectedMun(mun);
                          setMunSearch(mun);
                          setShowMunDropdown(false);
                          setActiveMunIndex(-1);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '11px',
                          textAlign: 'left',
                          border: 'none',
                          background: isActive
                            ? 'var(--bg-status)'
                            : isSelected
                              ? 'rgba(15, 118, 110, 0.12)'
                              : 'none',
                          color: isActive || isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        {mun}
                      </button>
                    );
                  })}
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
            </div>
          </div>
        </RankTable>
      </article>

      <article className="panel">
        <div className="section-header">
          <div>
            <h3>Atraso de Notificação por Unidade</h3>
          </div>
          <div className="rank-tooltip-wrapper">
            <button
              type="button"
              className="rank-tooltip-trigger"
              aria-label="Sobre o atraso de notificação por unidade"
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
            <div className="rank-tooltip-content rank-tooltip-content--align-right" style={{ width: '340px' }}>
              <div>
                <b>Atraso de Notificação por Unidade</b>
                <br />
                Distribuição de dias entre os primeiros sintomas e a notificação da ficha de SRAG.
              </div>
              <br />• <b>Ordenação por Risco (Descendente)</b>: as unidades com maior mediana de atraso aparecem no topo para evidenciar gargalos críticos de oportunidade nas primeiras páginas.
              <br />• <b>Classificação por Mediana</b>: Adequado ≤5d, Atenção ≤10d, Crítico &gt;10d.
              <br />• Linha tracejada em <b>7d</b>: limite operacional de oportunidade (Portaria SVS/MS).
              <br />• Passe o mouse na linha de cada unidade para ver o nome completo sem truncamento, média, P75 e P90.
              <br />• Exibidas apenas unidades com ≥5 casos notificados.
            </div>
          </div>
        </div>
        <div style={{ marginTop: '15px' }}>
          {loading && !delayByUnit?.length ? (
            <p className="meta">Carregando distribuição por unidade...</p>
          ) : (
            <ErrorBoundary fallbackTitle="Falha ao carregar ridgeline por unidade">
              <DelayByUnitRidgelinePlot data={delayByUnit} />
            </ErrorBoundary>
          )}
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
          * Exibidas apenas unidades com ≥5 casos notificados.
        </p>
      </article>

      <article className="panel">
        <div className="section-header">
          <div>
            <h3>Fluxo da Jornada Clínica</h3>
          </div>
          <div className="rank-tooltip-wrapper">
            <button
              type="button"
              className="rank-tooltip-trigger"
              aria-label="Sobre o fluxo da jornada clínica"
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
            <div className="rank-tooltip-content rank-tooltip-content--align-right" style={{ width: '360px' }}>
              <div>
                <b>Fluxo da Jornada Clínica</b>
                <br />
                Diagrama de Sankey que mapeia a trajetória dos casos desde a origem da infecção até o
                desfecho hospitalar.
              </div>
              <br />• <b>Origem</b>: comunitária, infecção hospitalar ou ignorada.
              <br />• <b>Internação → Suporte</b>: enfermaria, UTI e uso de suporte ventilatório.
              <br />• <b>Desfecho</b>: cura/alta, óbito por SRAG ou óbito por outras causas.
              <br />• A espessura de cada fluxo é proporcional ao volume de casos; passe o mouse sobre os
              nós e conexões para ver contagens e proporções.
              {totalFlowCases > 0 && (
                <>
                  <br />• <b>{totalFlowCases.toLocaleString('pt-BR')} casos</b> com jornada mapeável nos
                  filtros atuais.
                </>
              )}
            </div>
          </div>
        </div>
        <div className="chart-wrap--tall">
          <ErrorBoundary fallbackTitle="Falha ao carregar Sankey da jornada clínica">
            {clinicalFlow?.nodes && clinicalFlow?.links ? (
              <SankeyChart nodes={clinicalFlow.nodes} links={clinicalFlow.links} />
            ) : (
              <p className="meta">Sem dados de fluxo para os filtros atuais.</p>
            )}
          </ErrorBoundary>
        </div>
      </article>

      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <h3>Tempo de Internação</h3>
          {hospitalizationExtra && (
            <span className="meta" style={{ fontSize: 11 }}>
              n={hospitalization!.cure_count + hospitalization!.death_count} casos com tempo válido
            </span>
          )}
        </div>
        {hospitalization && (hospitalization.cure_count > 0 || hospitalization.death_count > 0) ? (
          <div style={{ marginBottom: 16 }}>
            {/* Header com Síntese Comparativa (Diferença e Razão) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '8px 12px',
                background: 'var(--bg-status)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                marginBottom: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Comparativo de Permanência
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px' }}>
                <span>
                  Diferença: <b style={{ color: 'var(--text-main)' }}>{formatSigned(hospitalization.difference)}</b> em óbitos
                </span>
                <span style={{ color: 'var(--border-subtle)' }}>•</span>
                <span>
                  Razão Cura/Óbito: <b style={{ color: '#d97706' }}>{hospitalization.ratio > 0 ? formatRatio(hospitalization.ratio) : '—'}</b>
                </span>
              </div>
            </div>

            {/* 2 Cards Consolidados: Cura vs Óbito */}
            <div className="responsive-grid-split" style={{ gap: '12px' }}>
              {/* Card Cura */}
              <div
                style={{
                  background: 'var(--bg-status)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: '4px solid #0f766e',
                  borderRadius: '8px',
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Desfecho: Cura / Alta
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    n = <b>{hospitalization.cure_count.toLocaleString('pt-BR')}</b> casos
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: '#0f766e' }}>
                      {formatDays(hospitalization.median_cure)}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>mediana</span>
                  </div>
                  {hospitalizationExtra && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
                      P90: <b style={{ color: 'var(--text-main)' }}>{formatDays(hospitalizationExtra.p90Cure)}</b> (IQR {hospitalizationExtra.iqrCure})
                      <br />
                      Internação &gt;14d: <b style={{ color: 'var(--text-main)' }}>{(hospitalizationExtra.prolongedCure * 100).toFixed(1)}%</b>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Óbito */}
              <div
                style={{
                  background: 'var(--bg-status)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: '4px solid #dc2626',
                  borderRadius: '8px',
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Desfecho: Óbito por SRAG
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    n = <b>{hospitalization.death_count.toLocaleString('pt-BR')}</b> casos
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626' }}>
                      {formatDays(hospitalization.median_death)}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>mediana</span>
                  </div>
                  {hospitalizationExtra && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
                      P90: <b style={{ color: 'var(--text-main)' }}>{formatDays(hospitalizationExtra.p90Death)}</b> (IQR {hospitalizationExtra.iqrDeath})
                      <br />
                      Internação &gt;14d: <b style={{ color: 'var(--text-main)' }}>{(hospitalizationExtra.prolongedDeath * 100).toFixed(1)}%</b>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="meta" style={{ marginBottom: 10, fontSize: 12 }}>
            Sem casos com tempo de internação válido para os filtros atuais.
          </p>
        )}
        <div className="chart-wrap" style={{ height: 'auto', minHeight: '360px' }}>
          <ErrorBoundary fallbackTitle="Falha ao carregar histograma de internação">
            <HospitalizationHistogram data={hospitalization} />
          </ErrorBoundary>
        </div>
      </article>

      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3>
              {selectedAgent === 'Influenza'
                ? 'Jornada Clínica por Perfil Vacinal - Influenza'
                : selectedAgent === 'COVID-19'
                  ? 'Jornada Clínica por Perfil Vacinal - COVID-19'
                  : 'Jornada Clínica por Perfil Vacinal'}
            </h3>
            <div className="rank-tooltip-wrapper">
              <button
                type="button"
                className="rank-tooltip-trigger"
                aria-label="Sobre a Jornada Clínica por Perfil Vacinal"
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
              <div
                className="rank-tooltip-content rank-tooltip-content--align-right"
                style={{ width: '360px' }}
              >
                <div>
                  <b>Jornada Clínica por Perfil Vacinal</b>
                  <br />
                  Linha do tempo epidemiológica comparando o tempo até internação e a permanência
                  hospitalar conforme o esquema vacinal recebido.
                </div>
                <br />• <b>Eixo Dinâmico Unificado</b>: alinha todas as coortes na mesma régua proporcional (escalonada pela maior jornada visível) para permitir comparação direta entre grupos.
                <br />• <b>Ordenação Interativa</b>: clique nos cabeçalhos das colunas (Perfil, Última Dose, Jornada, UTI, Desfecho) para ordenar a tabela alternando ordem crescente e decrescente.
                <br />• <b>Ponto T0 (Sintomas)</b>: dia 0 do surgimento dos primeiros sintomas de SRAG.
                <br />• <b>Segmento T0→T1 (Pontilhado Azul)</b>: dias decorridos até a internação hospitalar.
                <br />• <b>Segmento T1→T2 (Sólido Teal)</b>: dias de permanência na enfermaria/UTI.
                <br />• <b>Última Dose</b>: mediana de dias entre a aplicação da vacina e o início dos sintomas.
                <br />• <b>Admissão UTI & Desfecho</b>: proporção de casos gravemente enfermos e taxa de Cura vs Óbito.
              </div>
            </div>
          </div>
          <div className="filters">
            {singleVirusOption ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'var(--bg-status)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {showCovid ? 'Visão COVID-19' : 'Visão Influenza'} (filtro de agente ativo)
              </span>
            ) : (
              <select
                value={swimmerVirus}
                onChange={(e) => setSwimmerVirus(e.target.value as 'covid' | 'gripe')}
                style={{ padding: '4px 8px', borderRadius: '6px' }}
                aria-label="Selecionar vírus da visão"
              >
                <option value="covid">Visão COVID-19</option>
                <option value="gripe">Visão Influenza</option>
              </select>
            )}
          </div>
        </div>
        <div style={{ marginTop: '20px' }}>
          <ErrorBoundary fallbackTitle="Falha ao carregar swimmer plot vacinal">
            <AggregatedSwimmerPlot data={timelineData} swimmerVirus={swimmerVirus} />
          </ErrorBoundary>
        </div>
      </article>
    </div>
  );
};

export default UnitsPanel;
