import { useEffect, useMemo, useState } from 'react';
import './App.css';

import AuditPanel from './components/panels/AuditPanel';
import CitizenPanel from './components/panels/CitizenPanel';
import LabPage from './components/panels/LabPage';
// Panels
import TerritoryPanel from './components/panels/TerritoryPanel';
import UnitsPanel from './components/panels/UnitsPanel';
import VigilancePage from './components/panels/VigilancePage';
import GlobalFilterBar from './components/ui/GlobalFilterBar';
import KpiCard from './components/ui/KpiCard';
// UI Components
import Sidebar from './components/ui/Sidebar';
import { useAuditData } from './hooks/useAuditData';
import { useCitizenData } from './hooks/useCitizenData';
import { useCoreData } from './hooks/useCoreData';
import { useTerritoryData } from './hooks/useTerritoryData';
import { useUnitsData } from './hooks/useUnitsData';
import { api } from './services/api';

// Hooks

function App() {
  // Config State
  const [panel, setPanel] = useState('vigilancia');
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
  const [dashboardYear, setDashboardYear] = useState<number[]>([]);
  const [dashboardMonth, setDashboardMonth] = useState<number[]>([]);
  const [dashboardDay, setDashboardDay] = useState<number[]>([]);
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

  // Core Data Hook
  const { data, status, lastUpdateIso } = useCoreData(
    '0',
    '0',
    'summary',
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
    dashboardMonth,
    dashboardDay,
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
    agentFilter,
    maternalFilter,
    occupationFilter,
    dashboardMonth,
    dashboardDay,
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
    dashboardMonth,
    dashboardDay,
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
    dashboardMonth,
    dashboardDay,
  );
  const auditData = useAuditData(
    panel === 'auditoria' || panel === 'laboratorio',
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
    dashboardMonth,
    dashboardDay,
  );
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
      municipio: item.municipio,
      uf: item.uf,
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
    } else if (selectedAgent === 'COVID-19') {
      setSwimmerVirus('covid');
    }
  }, [agentFilter]);

  // KPIs Memo
  const kpis = useMemo(() => {
    if (!data?.summary) {
      return { total: 0, notif: 0, uti: '0%', death: '0%', deathCount: 0, next: '--' };
    }
    return {
      total: data.summary.total ?? 0,
      notif: data.summary.notification_total ?? 0,
      uti: data.summary.uti_total ?? 0,
      death: `${data.summary.death_rate ?? 0}%`,
      deathCount: data.summary.death_count ?? 0,
      next: data.trends?.forecast?.[0]?.predicted_cases?.toString() ?? '--',
    };
  }, [data]);

  const availableYears = data?.summary?.available_years || [];

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
    ...dashboardMonth.map((f) => ({
      type: 'Mês',
      val: String(f),
      remover: () => setDashboardMonth([]),
    })),
    ...dashboardDay.map((f) => ({
      type: 'Dia',
      val: String(f),
      remover: () => setDashboardDay([]),
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
    setDashboardMonth([]);
    setDashboardDay([]);
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
              dashboardMonth={dashboardMonth}
              setDashboardMonth={setDashboardMonth}
              dashboardDay={dashboardDay}
              setDashboardDay={setDashboardDay}
            />

            <section className="kpi-grid">
              <KpiCard label="Total Notificações" value={kpis.notif} />
              <KpiCard label="Total Internações" value={kpis.total} />
              <KpiCard label="Total UTI" value={kpis.uti} />
              <KpiCard label="Óbitos" value={kpis.deathCount} />
              <KpiCard label="Letalidade" value={kpis.death} />
            </section>

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
                delayByBairro={territoryData.delayByBairro}
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
                delayByUnit={data?.laboratoryNetwork?.delay_by_unit ?? null}
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
            <VigilancePage
              data={data}
              agentFilter={agentFilter}
              citizenTab={citizenTab}
              raceFilter={raceFilter}
              genderFilter={genderFilter}
              zoneFilter={zoneFilter}
              bairroFilter={bairroFilter}
              unitFilter={unitFilter}
              dashboardYear={dashboardYear}
              maternalFilter={maternalFilter}
              occupationFilter={occupationFilter}
              dashboardMonth={dashboardMonth}
              dashboardDay={dashboardDay}
            />
          )}

          {panel === 'laboratorio' && (
            <LabPage data={data} qualityByLaboratory={auditData.qualityByLaboratory} />
          )}

          {panel === 'auditoria' && (
            <AuditPanel
              loading={auditData.loading}
              completeness={auditData.completeness}
              completenessTrend={auditData.completenessTrend}
              qualityByUnit={auditData.qualityByUnit}
              qualityByBairro={auditData.qualityByBairro}
              inconsistencies={auditData.inconsistencies}
              timelinessFlow={auditData.timelinessFlow}
            />
          )}

        </section>
      </main>
    </div>
  );
}

export default App;
