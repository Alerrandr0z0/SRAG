import React, { useMemo, useState } from 'react';
import * as Epi from '../../types/epi';
import AggregatedSwimmerPlot from '../charts/AggregatedSwimmerPlot';
import DelayByUnitRidgelinePlot, { UnitDelayRecord } from '../charts/DelayByUnitRidgelinePlot';
import HospitalizationHistogram from '../charts/HospitalizationHistogram';
import SankeyChart from '../charts/SankeyChart';
import RankTable from '../ui/RankTable';

const formatDays = (value: number) => `${value.toFixed(1)}d`;
const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}d`;
const formatRatio = (value: number) => `${value.toFixed(1)}x`;

interface KpiTileProps {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}

const KpiTile: React.FC<KpiTileProps> = ({ label, value, accent, sub }) => (
  <div
    style={{
      background: 'var(--bg-status)',
      borderRadius: 6,
      padding: '10px 12px',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: 18, fontWeight: 500, color: accent }}>{value}</div>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    {sub && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
  </div>
);

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
  dashboardYear?: number[];
  chartDebug?: boolean;
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
  dashboardYear: _dashboardYear = [],
}) => {
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedMun, setSelectedMun] = useState('');
  const [munSearch, setMunSearch] = useState('');
  const [showMunDropdown, setShowMunDropdown] = useState(false);

  const selectedAgent = etiologicAgentFilter[0] || 'Todos';
  const showCovid = selectedAgent !== 'Influenza';
  const showGripe = selectedAgent !== 'COVID-19';

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

  const filteredUnits = useMemo(() => {
    return (units || []).filter((item) => {
      const matchUf = !selectedUf || item.uf === selectedUf;
      const matchMun = !selectedMun || item.municipio === selectedMun;
      return matchUf && matchMun;
    });
  }, [units, selectedUf, selectedMun]);

  const unitRows = useMemo(
    () =>
      filteredUnits.map((item) => ({
        key: item.nome_fantasia ? `${item.id_unidade}-${item.nome_fantasia}` : item.id_unidade,
        values: {
          unidade: item.nome_fantasia || item.id_unidade,
          localizacao:
            item.municipio && item.uf ? `${item.municipio} - ${item.uf}` : 'Não informado',
          count: item.count,
          curados: item.curados ?? 0,
          obitos: item.obitos ?? 0,
          ignorados: item.ignorados ?? 0,
        },
      })),
    [filteredUnits],
  );

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      {loading && <p className="meta">Carregando dados de unidades...</p>}

      <article className="panel" style={{ boxShadow: 'none' }}>
        <RankTable
          title="Unidades notificadoras"
          searchPlaceholder="Buscar unidade"
          columns={[
            { key: 'unidade', label: 'Unidade' },
            { key: 'localizacao', label: 'Localização' },
            { key: 'count', label: 'Notificados', align: 'right' },
            { key: 'curados', label: 'Curados', align: 'right' },
            { key: 'obitos', label: 'Óbitos', align: 'right' },
            { key: 'ignorados', label: 'Ignorados', align: 'right' },
          ]}
          rows={unitRows}
        >
          {/* UF Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label
              htmlFor="uf-select"
              style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}
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
              style={{
                fontSize: '11px',
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-panel)',
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <option value="">Todas</option>
              {availableUfs.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>

          {/* Searchable Municipality Filter Autocomplete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
            <label
              htmlFor="mun-search"
              style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}
            >
              Município
            </label>
            <div style={{ position: 'relative', width: '150px' }}>
              <input
                id="mun-search"
                type="text"
                placeholder="Buscar cidade..."
                value={munSearch}
                onChange={(e) => {
                  setMunSearch(e.target.value);
                  setShowMunDropdown(true);
                }}
                onFocus={() => setShowMunDropdown(true)}
                style={{
                  fontSize: '11px',
                  padding: '5px 24px 5px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-panel)',
                  color: 'var(--text-main)',
                  width: '100%',
                }}
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
            </div>
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
        </RankTable>
      </article>

      <article className="panel">
        <div className="section-header">
          <h3>Tempo de Internação</h3>
        </div>
        {hospitalization && (hospitalization.cure_count > 0 || hospitalization.death_count > 0) && (
          <div
            className="responsive-grid-4col"
            style={{
              marginBottom: 12,
            }}
          >
            <KpiTile
              label="Mediana cura"
              value={hospitalization.cure_count > 0 ? formatDays(hospitalization.median_cure) : '—'}
              accent="#0f6e56"
              sub={
                hospitalization.cure_count > 0 ? `${hospitalization.cure_count} casos` : undefined
              }
            />
            <KpiTile
              label="Mediana óbito"
              value={
                hospitalization.death_count > 0 ? formatDays(hospitalization.median_death) : '—'
              }
              accent="#a32d2d"
              sub={
                hospitalization.death_count > 0 ? `${hospitalization.death_count} casos` : undefined
              }
            />
            <KpiTile
              label="Diferença"
              value={
                hospitalization.cure_count > 0 && hospitalization.death_count > 0
                  ? formatSigned(hospitalization.difference)
                  : '—'
              }
              accent="var(--text-main)"
            />
            <KpiTile
              label="Razão cura/óbito"
              value={
                hospitalization.cure_count > 0 &&
                hospitalization.death_count > 0 &&
                hospitalization.ratio > 0
                  ? formatRatio(hospitalization.ratio)
                  : '—'
              }
              accent="#d97706"
            />
          </div>
        )}
        <div className="chart-wrap" style={{ height: 'auto', minHeight: '360px' }}>
          <HospitalizationHistogram data={hospitalization} />
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

      {/* Ridgeline Plot por Unidade — distribuição de atrasos de notificação */}
      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <div>
            <h3>Atraso de Notificação por Unidade</h3>
            <p className="meta">Distribuição de dias entre primeiros sintomas e notificação</p>
          </div>
        </div>
        <div style={{ marginTop: '15px' }}>
          <DelayByUnitRidgelinePlot data={delayByUnit} />
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
          * Exibidas apenas unidades com ≥5 casos notificados. Amostra de até 100 casos por unidade.
        </p>
      </article>

      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <h3>
            {selectedAgent === 'Influenza'
              ? 'Jornada Clínica por Perfil Vacinal - Influenza'
              : selectedAgent === 'COVID-19'
                ? 'Jornada Clínica por Perfil Vacinal - COVID-19'
                : 'Jornada Clínica por Perfil Vacinal'}
          </h3>
          <div className="filters">
            <select
              value={swimmerVirus}
              onChange={(e) => setSwimmerVirus(e.target.value as 'covid' | 'gripe')}
              style={{ padding: '4px 8px', borderRadius: '6px' }}
            >
              {showCovid && <option value="covid">Visão COVID-19</option>}
              {showGripe && <option value="gripe">Visão Influenza</option>}
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
