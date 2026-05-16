import { useState, useMemo, useEffect } from 'react';
import './App.css';

// API
import { api } from './services/api';

// Hooks
import { useCoreData } from './hooks/useCoreData';
import { useTerritoryData } from './hooks/useTerritoryData';
import { useUnitsData } from './hooks/useUnitsData';
import { useCitizenData } from './hooks/useCitizenData';
import { useAuditData } from './hooks/useAuditData';

// UI Components
import Sidebar from './components/ui/Sidebar';
import KpiCard from './components/ui/KpiCard';
import CitizenFilterBar from './components/ui/CitizenFilterBar';
import TerritoryFilterBar from './components/ui/TerritoryFilterBar';
import UnitsFilterBar from './components/ui/UnitsFilterBar';

// Charts
import TrendChart from './components/charts/TrendChart';
import VirusProfileChart from './components/charts/VirusProfileChart';

// Panels
import TerritoryPanel from './components/panels/TerritoryPanel';
import UnitsPanel from './components/panels/UnitsPanel';
import CitizenPanel from './components/panels/CitizenPanel';
import VigilancePanel from './components/panels/VigilancePanel';
import AuditPanel from './components/panels/AuditPanel';
import NotebooksPanel from './components/panels/NotebooksPanel';

function App() {
  // Config State
  const [panel, setPanel] = useState('territorio');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const [weeksWindow, setWeeksWindow] = useState('0'); // Init in 'Tudo'
  const [lookback] = useState('0');
  const [seriesMode, setSeriesMode] = useState('weekly');
  const [virusDetail, setVirusDetail] = useState('summary');
  const [dashboardYear, setDashboardYear] = useState<number[]>([]);

  // Citizen State
  const [citizenTab, setCitizenTab] = useState<string[]>([]);
  const [raceFilter, setRaceFilter] = useState<string[]>([]);
  const [genderFilter, setGenderFilter] = useState<string[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string[]>([]);
  const [bairroFilter, setBairroFilter] = useState<string[]>([]);
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [maternalFilter, setMaternalFilter] = useState<string[]>([]);
  const [occupationFilter, setOccupationFilter] = useState<string[]>([]);
  const [availableOccupations, setAvailableOccupations] = useState<string[]>([]);
  const [swimmerVirus, setSwimmerVirus] = useState<'covid' | 'gripe'>('covid');

  // Core Data Hook
  const { data, status, lastUpdate, error } = useCoreData(
    weeksWindow,
    lookback,
    virusDetail,
    citizenTab,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    dashboardYear,
    undefined, // agents
    maternalFilter,
    occupationFilter
  );

  // Lazy Loaded Data Hooks
  const territoryData = useTerritoryData(panel === 'territorio', 'Urbana', citizenTab, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, dashboardYear, maternalFilter, occupationFilter);
  const unitsData = useUnitsData(panel === 'unidades', swimmerVirus, citizenTab, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, dashboardYear, maternalFilter, occupationFilter);
  const citizenData = useCitizenData(panel === 'cidadao', citizenTab, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, dashboardYear, maternalFilter, occupationFilter);
  const auditData = useAuditData(panel === 'auditoria', citizenTab, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, dashboardYear, maternalFilter, occupationFilter);
  const vigilanceLoading = panel === 'vigilancia' && !data?.laboratoryNetwork;

  const bairrosList = useMemo(() => {
    const combined = [
      ...(territoryData.entities?.urban_bairros || []),
      ...(territoryData.entities?.rural_comunidades || [])
    ];
    // Remove duplicates by label (keeping the one with highest count)
    const uniqueMap = new Map<string, number>();
    combined.forEach(item => {
      const current = uniqueMap.get(item.label) || 0;
      if (item.count > current) uniqueMap.set(item.label, item.count);
    });
    return Array.from(uniqueMap.entries()).map(([name, count]) => ({ name, count }));
  }, [territoryData.entities]);

  useEffect(() => {
    if (panel === 'cidadao') {
      api.fetchOccupations(dashboardYear, zoneFilter, bairroFilter)
        .then(res => setAvailableOccupations(res.map(o => o.label)))
        .catch(err => console.error("Failed to fetch occupations", err));
    }
  }, [panel, dashboardYear, zoneFilter, bairroFilter]);

  // KPIs Memo
  const kpis = useMemo(() => {
    if (!data?.summary) {
      return { total: 0, uti: '0%', death: '0%', next: '--' };
    }
    return {
      total: data.summary.total ?? 0,
      uti: data.summary.uti_total ?? 0,
      death: `${data.summary.death_rate ?? 0}%`,
      next: data.trends?.forecast?.[0]?.predicted_cases?.toString() ?? '--',
    };
  }, [data]);

  const availableYears = data?.summary?.available_years || [];

  const currentTrends = data?.trends;

  const activeFilters = [
    ...citizenTab.map(f => ({ type: 'Perfil', val: f, remover: () => setCitizenTab(citizenTab.filter(i => i !== f)) })),
    ...raceFilter.map(f => ({ type: 'Raça', val: f, remover: () => setRaceFilter(raceFilter.filter(i => i !== f)) })),
    ...genderFilter.map(f => ({ type: 'Gênero', val: f, remover: () => setGenderFilter(genderFilter.filter(i => i !== f)) })),
    ...zoneFilter.map(f => ({ type: 'Zona', val: f, remover: () => setZoneFilter(zoneFilter.filter(i => i !== f)) })),
    ...bairroFilter.map(f => ({ type: 'Bairro', val: f, remover: () => setBairroFilter(bairroFilter.filter(i => i !== f)) })),
    ...unitFilter.map(f => ({ type: 'Unid', val: f, remover: () => setUnitFilter(unitFilter.filter(i => i !== f)) })),
    ...maternalFilter.map(f => ({ type: 'Materno', val: f, remover: () => setMaternalFilter(maternalFilter.filter(i => i !== f)) })),
    ...occupationFilter.map(f => ({ type: 'Ocupação', val: f, remover: () => setOccupationFilter(occupationFilter.filter(i => i !== f)) }))
  ];

  const clearAllFilters = () => {
    setCitizenTab([]);
    setRaceFilter([]);
    setGenderFilter([]);
    setZoneFilter([]);
    setBairroFilter([]);
    setUnitFilter([]);
    setMaternalFilter([]);
    setOccupationFilter([]);
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePanel={panel}
        setPanel={setPanel}
        theme={theme}
        setTheme={setTheme}
      />

      <main className="app-shell">
        {panel !== 'notebooks' && (
          <>
            <section className="panel header-panel">
              <div style={{ flex: 1 }}>
                <h1>Painel SRAG - Mossoró/RN</h1>
                {activeFilters.length === 0 ? (
                  <p className="sub">Monitoramento de gravidade e perfil viral.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginRight: '4px', letterSpacing: '0.05em' }}>FILTROS ATIVOS:</span>
                    {activeFilters.map(f => (
                      <div key={`${f.type}-${f.val}`} className="global-filter-chip">
                        <span style={{ opacity: 0.6, marginRight: '3px' }}>{f.type}:</span>
                        <strong>{f.val}</strong>
                        <button onClick={f.remover} className="global-filter-close">
                          <svg viewBox="0 0 14 14" width="12" height="12"><path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    ))}
                    <button onClick={clearAllFilters} className="global-filter-clear">Limpar Tudo</button>
                  </div>
                )}
              </div>
              <div className="status-grid status-grid--wide">
                <div><p>Sincronização</p><strong>{status === 'online' ? 'BANCO ATIVO' : 'OFFLINE'}</strong></div>
                <div><p>Atualização</p><strong>{lastUpdate ? new Date(lastUpdate).toLocaleDateString() : '---'}</strong></div>
                <div className="status-year">
                  <p>Ano</p>
                  <select value={dashboardYear[0] ? String(dashboardYear[0]) : ''} onChange={(e) => setDashboardYear(e.target.value ? [Number(e.target.value)] : [])}>
                    <option value="">Todos</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="kpi-grid">
              <KpiCard label="Total Internações" value={kpis.total} />
              <KpiCard label="Total UTI" value={kpis.uti} />
              <KpiCard label="Letalidade" value={kpis.death} />
              <KpiCard label="PROJEÇÃO" value={kpis.next} />
            </section>

            <section className="main-grid">
              <article className="panel">
                <div className="section-header">
                  <div className="stack" style={{ gap: 4 }}>
                    <h3 style={{ margin: 0 }}>Tendência</h3>
                    {currentTrends && (
                      <div className="filters" style={{ fontSize: '12px', color: '#64748b', gap: 12 }}>
                        <span>Total: <b>{currentTrends.history.reduce((s, h) => s + h.total, 0)}</b></span>
                        <span>Média: <b>{(currentTrends.history.reduce((s, h) => s + h.total, 0) / (currentTrends.history.length || 1)).toFixed(1)}/s</b></span>
                      </div>
                    )}
                  </div>
                  <div className="filters">
                    <div className="pill-group">
                      {[
                        { v: '0', l: 'Tudo' },
                        { v: '52', l: '52s' },
                        { v: '26', l: '26s' },
                        { v: '12', l: '12s' }
                      ].map(opt => (
                        <button
                          key={opt.v}
                          className={`pill-btn ${weeksWindow === opt.v ? 'active' : ''}`}
                          onClick={() => setWeeksWindow(opt.v)}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                    <select value={seriesMode} onChange={e => setSeriesMode(e.target.value)}>
                      <option value="weekly">Semanal</option>
                      <option value="cumulative">Acumulada</option>
                      <option value="composition">Composição</option>
                    </select>
                  </div>
                </div>
                <div className="chart-wrap">
                  {currentTrends && (
                    <TrendChart
                      history={currentTrends.history}
                      forecast={currentTrends.forecast}
                      thresholds={currentTrends.thresholds}
                      composition={currentTrends.composition}
                      baseCumulative={currentTrends.base_cumulative}
                      seriesMode={seriesMode}
                    />
                  )}
                </div>
              </article>
            </section>
          </>
        )}

      {/* FILTROS GLOBAIS (Cards Próprios) */}
      {panel === 'territorio' && (
        <section className="main-grid">
          <article className="panel">
            <TerritoryFilterBar
              zoneFilter={zoneFilter} setZoneFilter={setZoneFilter}
              bairroFilter={bairroFilter} setBairroFilter={setBairroFilter}
              bairrosList={bairrosList}
            />
          </article>
        </section>
      )}

      {panel === 'unidades' && (
        <section className="main-grid">
          <article className="panel">
            <UnitsFilterBar
              unitFilter={unitFilter} setUnitFilter={setUnitFilter}
              unitsList={(unitsData.units || []).map((item) => ({ id_unidade: item.id_unidade, count: item.count }))}
            />
          </article>
        </section>
      )}

      {panel === 'cidadao' && (
        <section className="main-grid">
          <article className="panel">
            <CitizenFilterBar
              citizenTab={citizenTab}
              setCitizenTab={setCitizenTab}
              raceFilter={raceFilter}
              setRaceFilter={setRaceFilter}
              genderFilter={genderFilter}
              setGenderFilter={setGenderFilter}
              maternalFilter={maternalFilter}
              setMaternalFilter={setMaternalFilter}
              occupationFilter={occupationFilter}
              setOccupationFilter={setOccupationFilter}
              occupationOptions={availableOccupations}
            />
          </article>
        </section>
      )}
      {panel !== 'notebooks' && (
        <section className="secondary-grid">
          <article className="panel">
            <div className="section-header">
              <h3>Perfil viral</h3>
              <select value={virusDetail} onChange={(e) => setVirusDetail(e.target.value)}>
                <option value="summary">Resumido</option>
                <option value="detailed">Detalhado (Geral)</option>
                <option value="covid_detailed">Detalhado COVID-19</option>
                <option value="influenza_detailed">Detalhado Influenza</option>
              </select>
            </div>
            <div className="chart-wrap">
              {data?.virus && <VirusProfileChart data={data.virus} />}
            </div>
          </article>

          <article className="panel alerts">
            <h3>Resumo operacional</h3>
            {error ? <p className="error-box">{error}</p> : (
              <ul className="list">
                <li><span>Total UTI</span><span>{kpis.uti}</span></li>
                <li><span>Taxa de óbito</span><span>{kpis.death}</span></li>
                <li><span>Projeção próxima semana</span><span>{kpis.next}</span></li>
              </ul>
            )}
          </article>
        </section>
      )}

      <section className="main-grid">
        {panel === 'territorio' && (
          <article className="panel">
            <TerritoryPanel
              loading={territoryData.loading}
              territory={territoryData.territory}
              boundary={territoryData.boundary as import('geojson').FeatureCollection | null}
              choropleth={territoryData.choropleth}
              ruralData={territoryData.ruralData}
              ruralSectorsGeo={territoryData.ruralSectorsGeo as import('geojson').FeatureCollection}
            />
          </article>
        )}

        {panel === 'unidades' && (
          <article className="panel">
            <UnitsPanel
              loading={unitsData.loading}
              units={unitsData.units}
              hospitalization={unitsData.hospitalization}
              clinicalFlow={unitsData.clinicalFlow}
              timelineData={unitsData.timelineData}
              icuBottleneck={unitsData.icuBottleneck}
              swimmerVirus={swimmerVirus}
              setSwimmerVirus={setSwimmerVirus}
              dashboardYear={dashboardYear}
            />
          </article>
        )}

        {panel === 'cidadao' && (
          <article className="panel">
            <CitizenPanel
              loading={citizenData.loading}
              pyramid={citizenData.pyramid}
              schooling={citizenData.schooling}
              occupation={citizenData.occupation}
              animalContact={citizenData.animalContact}
              symptomsSignature={citizenData.symptomsSignature}
              riskFactors={citizenData.riskFactors}
              maternalProfile={citizenData.maternalProfile}
              vaccination={citizenData.vaccination}
              genderFilter={genderFilter}
            />
          </article>
        )}

        {panel === 'vigilancia' && (
          <article className="panel">
            <VigilancePanel
              loading={vigilanceLoading}
              laboratoryNetwork={data?.laboratoryNetwork}
            />
          </article>
        )}

        {panel === 'auditoria' && (
          <AuditPanel
            loading={auditData.loading}
            completeness={auditData.completeness}
          />
        )}

        {panel === 'notebooks' && (
          <NotebooksPanel />
        )}
      </section>
    </main>
  </div>
  );
}

export default App;
