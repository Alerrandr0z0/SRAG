import { useState, useMemo, useEffect } from 'react';
import './App.css';

// Hooks
import { useCoreData } from './hooks/useCoreData';
import { useTerritoryData } from './hooks/useTerritoryData';
import { useUnitsData } from './hooks/useUnitsData';
import { useCitizenData } from './hooks/useCitizenData';

// UI Components
import KpiCard from './components/ui/KpiCard';

// Charts
import TrendChart from './components/charts/TrendChart';
import VirusProfileChart from './components/charts/VirusProfileChart';

// Panels
import TerritoryPanel from './components/panels/TerritoryPanel';
import UnitsPanel from './components/panels/UnitsPanel';
import CitizenPanel from './components/panels/CitizenPanel';
import VigilancePanel from './components/panels/VigilancePanel';

// Services
import { api } from './services/api';

// Types
import * as Epi from './types/epi';

function App() {
  // Config State
  const [panel, setPanel] = useState('territorio');
  const [weeksWindow, setWeeksWindow] = useState('26');
  const [lookback, setLookback] = useState('8');
  const [seriesMode, setSeriesMode] = useState('weekly');
  const [virusDetail, setVirusDetail] = useState('summary');
  
  // Citizen State
  const [citizenTab, setCitizenTab] = useState<string[]>([]);
  const [raceFilter, setRaceFilter] = useState<string[]>([]);

  // Core Data Hook
  const { data, status, lastUpdate, error } = useCoreData(weeksWindow, lookback, virusDetail);

  // Lazy Loaded Data Hooks
  const territoryData = useTerritoryData(panel === 'territorio', 'Urbana'); 
  const unitsData = useUnitsData(panel === 'unidades');
  const citizenData = useCitizenData(panel === 'cidadao', citizenTab, raceFilter);
  const vigilanceLoading = panel === 'vigilancia' && !data?.laboratoryNetwork;

  // Helper to toggle multi-select items
  const toggleFilter = (list: string[], item: string) => {
    return list.includes(item) ? list.filter(i => i !== item) : [...list, item];
  };

  // Context Trends State
  const [territoryTrendZone, setTerritoryTrendZone] = useState('macro');
  const [territoryTrendEntity, setTerritoryTrendEntity] = useState('ALL');
  const [territoryTrendData, setTerritoryTrendData] = useState<Epi.TrendsData | null>(null);

  // KPIs Memo
  const kpis = useMemo(() => {
    if (!data?.summary) {
      return { total: 0, uti: '0%', death: '0%', next: '--' };
    }
    return {
      total: data.summary.total ?? 0,
      uti: `${data.summary.uti_rate ?? 0}%`,
      death: `${data.summary.death_rate ?? 0}%`,
      next: data.trends?.forecast?.[0]?.predicted_cases?.toString() ?? '--',
    };
  }, [data]);

  // Load Territory Specific Trends
  useEffect(() => {
    if (panel !== 'territorio' || !data) return;
    
    let active = true;
    async function loadTrend() {
      const zoneLabel = territoryTrendZone === 'urbana' ? 'Urbana' : 'Rural';
      const key = territoryTrendZone === 'macro' 
        ? 'ALL' 
        : territoryTrendEntity === 'ALL' 
          ? `ZONA::${zoneLabel}` 
          : `BAIRRO::${territoryTrendEntity}`;
      
      try {
        const payload = await api.fetchContextTrends(key, weeksWindow, lookback);
        if (active) setTerritoryTrendData(payload);
      } catch {
        if (active) setTerritoryTrendData(null);
      }
    }
    loadTrend();
    return () => { active = false; };
  }, [panel, territoryTrendZone, territoryTrendEntity, weeksWindow, lookback, !!data]);

  const panelButtons = [
    { key: 'territorio', label: 'Território' },
    { key: 'unidades', label: 'Unid. Saúde' },
    { key: 'cidadao', label: 'Cidadão' },
    { key: 'vigilancia', label: 'Vigilância' }
  ];

  const orderedCitizenTabs = [
    { key: 'crianca', label: 'Criança' },
    { key: 'adolescente', label: 'Adolescente' },
    { key: 'adulto', label: 'Adulto' },
    { key: 'idoso', label: 'Idoso' },
  ];

  const territoryEntityOptions = useMemo(() => {
    if (territoryTrendZone === 'macro') return [];
    return territoryTrendZone === 'urbana' 
      ? (territoryData.entities?.urban_bairros || []) 
      : (territoryData.entities?.rural_comunidades || []);
  }, [territoryData.entities, territoryTrendZone]);

  const currentTrends = useMemo(() => {
    if (panel === 'territorio' && territoryTrendData) return territoryTrendData;
    return data?.trends;
  }, [panel, territoryTrendData, data?.trends]);

  return (
    <main className="app-shell">
      <section className="panel header-panel">
        <div>
          <h1>Painel SRAG - Mossoró/RN</h1>
          <p className="sub">Monitoramento de gravidade e perfil viral.</p>
        </div>
        <div className="status-grid">
          <div><p>Atualização</p><strong>{lastUpdate}</strong></div>
          <div><p>Status</p><strong>{status}</strong></div>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Total" value={kpis.total} />
        <KpiCard label="UTI" value={kpis.uti} />
        <KpiCard label="Óbito" value={kpis.death} />
        <KpiCard label="Projeção" value={kpis.next} />
      </section>

      <section className="panel tabs-panel">
        <div className="tab-row">
          {panelButtons.map(b => (
            <button 
              key={b.key} 
              className={`tab-btn ${panel === b.key ? 'active' : ''}`} 
              onClick={() => setPanel(b.key)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <section className="main-grid">
        <article className="panel">
          <div className="toolbar">
            <h3>Tendência</h3>
            <div className="filters">
              {panel === 'territorio' && (
                <>
                  <select value={territoryTrendZone} onChange={e => setTerritoryTrendZone(e.target.value)}>
                    <option value="macro">Macro</option>
                    <option value="urbana">Urbana</option>
                    <option value="rural">Rural</option>
                  </select>
                  {territoryTrendZone !== 'macro' && (
                    <select value={territoryTrendEntity} onChange={e => setTerritoryTrendEntity(e.target.value)}>
                      <option value="ALL">Todas</option>
                      {territoryEntityOptions.map((i: any) => (
                        <option key={i.name} value={i.name}>{i.name}</option>
                      ))}
                    </select>
                  )}
                </>
              )}
              <select value={weeksWindow} onChange={e => setWeeksWindow(e.target.value)}>
                <option value="12">12s</option>
                <option value="26">26s</option>
                <option value="52">52s</option>
              </select>
              <select value={seriesMode} onChange={e => setSeriesMode(e.target.value)}>
                <option value="weekly">Semanal</option>
                <option value="cumulative">Acumulada</option>
              </select>
            </div>
          </div>
          <div className="chart-wrap">
            {currentTrends && (
              <TrendChart 
                history={currentTrends.history}
                forecast={currentTrends.forecast}
                seriesMode={seriesMode}
              />
            )}
          </div>
        </article>
      </section>

      {panel === 'cidadao' && (
        <>
          <section className="panel tabs-panel citizen-switch-panel">
            <div className="tab-row citizen-tab-row">
              {orderedCitizenTabs.map(t => (
                <button 
                  key={t.key} 
                  className={`tab-btn ${citizenTab.includes(t.key) ? 'active' : ''}`} 
                  onClick={() => setCitizenTab(prev => toggleFilter(prev, t.key))}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <section className="panel tabs-panel citizen-switch-panel">
            <div className="tab-row race-tab-row">
              {['Branca', 'Preta', 'Amarela', 'Parda', 'Indígena'].map(label => {
                const active = raceFilter.includes(label);
                const count = citizenData.raceProfile.find(r => r.label === label)?.count || 0;
                return (
                  <button 
                    key={label} 
                    className={`tab-btn ${active ? 'active' : ''}`} 
                    onClick={() => setRaceFilter(prev => toggleFilter(prev, label))}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className="secondary-grid">
        <article className="panel">
          <div className="section-header">
            <h3>Perfil viral</h3>
            <select value={virusDetail} onChange={(e) => setVirusDetail(e.target.value)}>
              <option value="summary">Resumido</option>
              <option value="detailed">Detalhado</option>
            </select>
          </div>
          <div className="chart-wrap">
            {data?.virus && <VirusProfileChart data={data.virus} />}
          </div>
        </article>

        <article className="panel alerts">
          <h3>Leitura operacional</h3>
          {error ? <p className="error-box">{error}</p> : (
            <ul>
              <li>Taxa de UTI: {kpis.uti}</li>
              <li>Taxa de óbito: {kpis.death}</li>
              <li>Projeção inicial: {kpis.next}</li>
            </ul>
          )}
        </article>
      </section>

      <section className="main-grid">
        {panel === 'territorio' && (
          <article className="panel">
            <TerritoryPanel 
              loading={territoryData.loading}
              territory={territoryData.territory}
              boundary={territoryData.boundary}
              choropleth={territoryData.choropleth}
              ruralData={territoryData.ruralData}
              ruralSectorsGeo={territoryData.ruralSectorsGeo}
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
              swimmerVirus={unitsData.swimmerVirus}
              setSwimmerVirus={unitsData.setSwimmerVirus}
            />
          </article>
        )}

        {panel === 'cidadao' && (
          <article className="panel">
            <CitizenPanel 
              loading={citizenData.loading}
              pyramid={citizenData.pyramid}
              schooling={citizenData.schooling}
              symptomsSignature={citizenData.symptomsSignature}
              riskFactors={citizenData.riskFactors}
              vaccination={citizenData.vaccination}
              survival={citizenData.survival}
              timelineData={citizenData.timelineData}
              swimmerVirus={citizenData.swimmerVirus}
              setSwimmerVirus={citizenData.setSwimmerVirus}
            />
          </article>
        )}

        {panel === 'vigilancia' && (
          <article className="panel">
            <VigilancePanel 
              loading={vigilanceLoading}
              kpis={{ total: kpis.total, uti: kpis.uti, death: kpis.death, next: kpis.next }}
              laboratoryNetwork={data?.laboratoryNetwork}
            />
          </article>
        )}
      </section>
    </main>
  );
}

export default App;
