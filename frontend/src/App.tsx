import { useEffect, useMemo, useState } from 'react';
import './App.css';

// Charts
import TrendChart from './components/charts/TrendChart';
import VirusProfileChart from './components/charts/VirusProfileChart';
import AuditPanel from './components/panels/AuditPanel';
import CitizenPanel from './components/panels/CitizenPanel';
import NotebooksPanel from './components/panels/NotebooksPanel';
// Panels
import TerritoryPanel from './components/panels/TerritoryPanel';
import UnitsPanel from './components/panels/UnitsPanel';
import VigilancePanel from './components/panels/VigilancePanel';
import GlobalFilterBar from './components/ui/GlobalFilterBar';
import KpiCard from './components/ui/KpiCard';
// UI Components
import Sidebar from './components/ui/Sidebar';
import { useAuditData } from './hooks/useAuditData';
import { useCitizenData } from './hooks/useCitizenData';
// Hooks
import { useCoreData } from './hooks/useCoreData';
import { useTerritoryData } from './hooks/useTerritoryData';
import { useUnitsData } from './hooks/useUnitsData';
// API
import { api } from './services/api';
import type * as Epi from './types/epi';

function App() {
  // Config State
  const [panel, setPanel] = useState('territorio');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);
  const [weeksWindow, setWeeksWindow] = useState('0');
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
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [maternalFilter, setMaternalFilter] = useState<string[]>([]);
  const [occupationFilter, setOccupationFilter] = useState<string[]>([]);
  const [availableOccupations, setAvailableOccupations] = useState<string[]>([]);
  const [swimmerVirus, setSwimmerVirus] = useState<'covid' | 'gripe'>('covid');
  const [trends, setTrends] = useState<Epi.TrendsData | null>(null);
  const [virus, setVirus] = useState<Epi.VirusData[] | null>(null);

  // Core Data Hook
  const { data, status, lastUpdateIso } = useCoreData(
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
    agentFilter,
    maternalFilter,
    occupationFilter,
  );

  useEffect(() => {
    if (panel !== 'vigilancia') return;
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
      )
      .then((res) => {
        if (active) setVirus(res);
      })
      .finally(() => {});
    return () => {
      active = false;
    };
  }, [panel, virusDetail, citizenTab, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, dashboardYear, agentFilter, maternalFilter, occupationFilter]);

  useEffect(() => {
    if (panel !== 'vigilancia') return;
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
      )
      .then((res) => {
        if (active) setTrends(res);
      })
      .finally(() => {});
    return () => {
      active = false;
    };
  }, [panel, weeksWindow, lookback, citizenTab, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, dashboardYear, agentFilter, maternalFilter, occupationFilter]);

  // Lazy Loaded Data Hooks
  const territoryData = useTerritoryData(
    panel === 'territorio',
    'Urbana',
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
  );
  const unitsData = useUnitsData(
    panel === 'unidades',
    swimmerVirus,
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
  );
  const citizenData = useCitizenData(
    panel === 'cidadao',
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
  );
  const auditData = useAuditData(
    panel === 'auditoria',
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
  );
  const vigilanceLoading = panel === 'vigilancia' && !data?.laboratoryNetwork;

  const bairrosList = useMemo(() => {
    const combined = [
      ...(territoryData.entities?.urban_bairros || []),
      ...(territoryData.entities?.rural_comunidades || []),
    ];
    const uniqueMap = new Map<string, number>();
    combined.forEach((item) => {
      const current = uniqueMap.get(item.label) || 0;
      if (item.count > current) uniqueMap.set(item.label, item.count);
    });
    return Array.from(uniqueMap.entries()).map(([name, count]) => ({ name, count }));
  }, [territoryData.entities]);

  const unitsList = useMemo(() => {
    return (unitsData.units || []).map((item) => ({
      id_unidade: item.id_unidade,
      nome_fantasia: item.nome_fantasia || item.id_unidade,
      count: item.count,
    }));
  }, [unitsData.units]);

  useEffect(() => {
    if (panel === 'cidadao') {
      api
        .fetchOccupations(dashboardYear, zoneFilter, bairroFilter, agentFilter)
        .then((res) => setAvailableOccupations(res.map((o) => o.label)))
        .catch((err) => console.error('Failed to fetch occupations', err));
    }
  }, [panel, dashboardYear, zoneFilter, bairroFilter, agentFilter]);

  useEffect(() => {
    const selectedAgent = agentFilter[0];
    if (selectedAgent === 'Influenza') {
      setSwimmerVirus('gripe');
      setVirusDetail('influenza_detailed');
    } else if (selectedAgent === 'COVID-19') {
      setSwimmerVirus('covid');
      setVirusDetail('covid_detailed');
    }
  }, [agentFilter]);

  useEffect(() => {
    const selectedAgent = agentFilter[0];
    if (selectedAgent === 'Influenza' && virusDetail !== 'influenza_detailed') {
      setVirusDetail('influenza_detailed');
    }
    if (selectedAgent === 'COVID-19' && virusDetail !== 'covid_detailed') {
      setVirusDetail('covid_detailed');
    }
  }, [agentFilter, virusDetail]);

  // KPIs Memo
  const kpis = useMemo(() => {
    if (!data?.summary) {
      return { total: 0, notif: 0, uti: '0%', death: '0%', next: '--' };
    }
    return {
      total: data.summary.total ?? 0,
      notif: data.summary.notification_total ?? 0,
      uti: data.summary.uti_total ?? 0,
      death: `${data.summary.death_rate ?? 0}%`,
      next: data.trends?.forecast?.[0]?.predicted_cases?.toString() ?? '--',
    };
  }, [data]);

  const availableYears = data?.summary?.available_years || [];

  const currentTrends = trends ?? data?.trends;

  const activeFilters = [
    ...citizenTab.map((f) => ({
      type: 'Perfil',
      val: f,
      remover: () => setCitizenTab(citizenTab.filter((i) => i !== f)),
    })),
    ...raceFilter.map((f) => ({
      type: 'Raça',
      val: f,
      remover: () => setRaceFilter(raceFilter.filter((i) => i !== f)),
    })),
    ...genderFilter.map((f) => ({
      type: 'Gênero',
      val: f,
      remover: () => setGenderFilter(genderFilter.filter((i) => i !== f)),
    })),
    ...zoneFilter.map((f) => ({
      type: 'Zona',
      val: f,
      remover: () => setZoneFilter(zoneFilter.filter((i) => i !== f)),
    })),
    ...bairroFilter.map((f) => ({
      type: 'Local',
      val: f,
      remover: () => setBairroFilter(bairroFilter.filter((i) => i !== f)),
    })),
    ...unitFilter.map((f) => {
      const unit = unitsList.find((u) => u.id_unidade === f);
      return {
        type: 'Unid',
        val: unit ? unit.nome_fantasia : f,
        remover: () => setUnitFilter(unitFilter.filter((i) => i !== f)),
      };
    }),
    ...agentFilter.map((f) => ({
      type: 'Agente',
      val: f,
      remover: () => setAgentFilter(agentFilter.filter((i) => i !== f)),
    })),
    ...maternalFilter.map((f) => ({
      type: 'Materno',
      val: f,
      remover: () => setMaternalFilter(maternalFilter.filter((i) => i !== f)),
    })),
    ...occupationFilter.map((f) => ({
      type: 'Ocupação',
      val: f,
      remover: () => setOccupationFilter(occupationFilter.filter((i) => i !== f)),
    })),
  ];

  const clearAllFilters = () => {
    setCitizenTab([]);
    setRaceFilter([]);
    setGenderFilter([]);
    setZoneFilter([]);
    setBairroFilter([]);
    setUnitFilter([]);
    setAgentFilter([]);
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
        status={status}
        lastUpdateIso={lastUpdateIso}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <main className="app-shell">
        {!sidebarOpen && (
          <button
            className="mobile-nav-toggle"
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <span />
            <span />
            <span />
          </button>
        )}

        {panel !== 'notebooks' && (
          <>
            <GlobalFilterBar
              years={availableYears}
              dashboardYear={dashboardYear}
              setDashboardYear={setDashboardYear}
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
              zoneFilter={zoneFilter}
              setZoneFilter={setZoneFilter}
              bairroFilter={bairroFilter}
              setBairroFilter={setBairroFilter}
              bairrosList={bairrosList}
              unitFilter={unitFilter}
              setUnitFilter={setUnitFilter}
              agentFilter={agentFilter}
              setAgentFilter={setAgentFilter}
              unitsList={unitsList}
              occupationOptions={availableOccupations}
              activeFilters={activeFilters}
              clearAllFilters={clearAllFilters}
            />

            <section className="kpi-grid">
              <KpiCard label="Total Notificações" value={kpis.notif} />
              <KpiCard label="Total Internações" value={kpis.total} />
              <KpiCard label="Total UTI" value={kpis.uti} />
              <KpiCard label="Letalidade" value={kpis.death} />
            </section>

          </>
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
                ruralSectorsGeo={
                  territoryData.ruralSectorsGeo as import('geojson').FeatureCollection
                }
                zoneFilter={zoneFilter}
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
                etiologicAgentFilter={agentFilter}
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
                etiologicAgentFilter={agentFilter}
              />
            </article>
          )}

          {panel === 'vigilancia' && (
            <>
              <section className="main-grid">
                <article className="panel">
                  <div className="section-header">
                    <div className="stack vigilance-history-summary" style={{ gap: 4 }}>
                      <h3 style={{ margin: 0 }}>Histórico de Notificações</h3>
                      {currentTrends && (
                        <div className="vigilance-history-stats">
                          <span>
                            Total: <b>{currentTrends.history.reduce((s, h) => s + h.total, 0)}</b>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="filters vigilance-history-controls">
                      <div className="pill-group">
                        {[
                          { v: '0', l: 'Tudo' },
                          { v: '52', l: '52s' },
                          { v: '26', l: '26s' },
                          { v: '12', l: '12s' },
                        ].map((opt) => (
                          <button
                            key={opt.v}
                            className={`pill-btn ${weeksWindow === opt.v ? 'active' : ''}`}
                            onClick={() => setWeeksWindow(opt.v)}
                          >
                            {opt.l}
                          </button>
                        ))}
                      </div>
                      <select value={seriesMode} onChange={(e) => setSeriesMode(e.target.value)}>
                        <option value="weekly">Semanal</option>
                        <option value="cumulative">Acumulada</option>
                        <option value="composition">Composição</option>
                      </select>
                    </div>
                  </div>
                  <div className="chart-wrap chart-wrap--tall">
                    {currentTrends && (
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
                  </div>
                </article>
              </section>
              <section className="secondary-grid">
                <article className="panel viral-profile-panel">
                  <div className="section-header">
                    <h3>Perfil viral</h3>
                    <select
                      value={virusDetail}
                      onChange={(e) => setVirusDetail(e.target.value)}
                      onFocus={() => {
                        if (agentFilter[0] && virusDetail === 'summary') {
                          setVirusDetail(agentFilter[0] === 'Influenza' ? 'influenza_detailed' : 'covid_detailed');
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
                  <div className="chart-wrap">
                    {virus && <VirusProfileChart data={virus} />}
                  </div>
                </article>
              </section>
              <article className="panel">
                <VigilancePanel
                  loading={vigilanceLoading}
                  laboratoryNetwork={data?.laboratoryNetwork}
                  etiologicAgentFilter={agentFilter}
                />
              </article>
            </>
          )}

          {panel === 'auditoria' && (
            <AuditPanel loading={auditData.loading} completeness={auditData.completeness} />
          )}

          {panel === 'notebooks' && <NotebooksPanel />}
        </section>
      </main>
    </div>
  );
}

export default App;
