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
  const [weeksWindow, setWeeksWindow] = useState('0');
  const [lookback] = useState('0');
  const [seriesMode, setSeriesMode] = useState('weekly');
  const [virusDetail, setVirusDetail] = useState('summary');
  const [dashboardYear, setDashboardYear] = useState<number[]>([]);
  const [showForecast, setShowForecast] = useState(false);

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
  const { data, status, lastUpdate } = useCoreData(
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
    undefined,
    maternalFilter,
    occupationFilter,
  );

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
      count: item.count,
    }));
  }, [unitsData.units]);

  useEffect(() => {
    if (panel === 'cidadao') {
      api
        .fetchOccupations(dashboardYear, zoneFilter, bairroFilter)
        .then((res) => setAvailableOccupations(res.map((o) => o.label)))
        .catch((err) => console.error('Failed to fetch occupations', err));
    }
  }, [panel, dashboardYear, zoneFilter, bairroFilter]);

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

  const currentTrends = data?.trends;

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
      type: 'Bairro',
      val: f,
      remover: () => setBairroFilter(bairroFilter.filter((i) => i !== f)),
    })),
    ...unitFilter.map((f) => ({
      type: 'Unid',
      val: f,
      remover: () => setUnitFilter(unitFilter.filter((i) => i !== f)),
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
        lastUpdate={lastUpdate}
      />

      <main className="app-shell">
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

            <section className="main-grid">
              <article className="panel">
                <div className="section-header">
                  <div className="stack" style={{ gap: 4 }}>
                    <h3 style={{ margin: 0 }}>Histórico de Notificações</h3>
                    {currentTrends && (
                      <div
                        className="filters"
                        style={{ fontSize: '12px', color: '#64748b', gap: 12 }}
                      >
                        <span>
                          Total: <b>{currentTrends.history.reduce((s, h) => s + h.total, 0)}</b>
                        </span>
                        <span>
                          Média:{' '}
                          <b>
                            {(
                              currentTrends.history.reduce((s, h) => s + h.total, 0) /
                              (currentTrends.history.length || 1)
                            ).toFixed(1)}
                            /semana
                          </b>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="filters">
                    <button
                      className={`pill-btn ${showForecast ? 'active' : ''}`}
                      onClick={() => setShowForecast(!showForecast)}
                      style={{
                        marginRight: '1.5rem',
                        padding: '0.4rem 1rem',
                        border: showForecast
                          ? '1px solid var(--primary-teal)'
                          : '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: showForecast ? 1 : 0.6 }}
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      {showForecast ? 'Ocultar Previsão' : 'Mostrar Previsão'}
                    </button>
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
                <div className="chart-wrap">
                  {currentTrends && (
                    <TrendChart
                      history={currentTrends.history}
                      forecast={currentTrends.forecast}
                      thresholds={currentTrends.thresholds}
                      composition={currentTrends.composition}
                      baseCumulative={currentTrends.base_cumulative}
                      seriesMode={seriesMode}
                      showForecast={showForecast}
                    />
                  )}
                </div>
              </article>
            </section>
          </>
        )}

        {panel !== 'notebooks' && (
          <section className="secondary-grid">
            <article className="panel viral-profile-panel">
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
                ruralSectorsGeo={
                  territoryData.ruralSectorsGeo as import('geojson').FeatureCollection
                }
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
            <AuditPanel loading={auditData.loading} completeness={auditData.completeness} />
          )}

          {panel === 'notebooks' && <NotebooksPanel />}
        </section>
      </main>
    </div>
  );
}

export default App;
