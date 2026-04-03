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
  const [weeksWindow, setWeeksWindow] = useState('0'); // Init in 'Tudo'
  const [lookback] = useState('0');
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
  const [contextTrends, setContextTrends] = useState<Epi.TrendsData | null>(null);

  // KPIs Memo
  const kpis = useMemo(() => {
    if (!data?.summary) {
      return { total: 0, uti: '0%', death: '0%', next: '--' };
    }
    const trends = contextTrends || data.trends;
    return {
      total: data.summary.total ?? 0,
      uti: `${data.summary.uti_rate ?? 0}%`,
      death: `${data.summary.death_rate ?? 0}%`,
      next: trends?.forecast?.[0]?.predicted_cases?.toString() ?? '--',
    };
  }, [data, contextTrends]);

  // Sync entity options when territory zone changes
  useEffect(() => {
    setTerritoryTrendEntity('ALL');
  }, [territoryTrendZone]);

  const territoryEntityOptions = useMemo(() => {
    if (territoryTrendZone === 'macro') return [];
    return territoryTrendZone === 'urbana' 
      ? (territoryData.entities?.urban_bairros || []) 
      : (territoryData.entities?.rural_comunidades || []);
  }, [territoryData.entities, territoryTrendZone]);

  // Load Territory Specific Trends
  useEffect(() => {
    let cancelled = false;
    async function loadTrend() {
      if (panel !== 'territorio' || territoryTrendZone === 'macro') {
        setContextTrends(null);
        return;
      }
      const zoneLabel = territoryTrendZone === 'urbana' ? 'Urbana' : 'Rural';
      const key = territoryTrendEntity === 'ALL' 
          ? `ZONA::${zoneLabel}` 
          : `BAIRRO::${territoryTrendEntity}`;
      
      try {
        const payload = await api.fetchContextTrends(key, weeksWindow, lookback);
        if (!cancelled) setContextTrends(payload);
      } catch {
        if (!cancelled) setContextTrends(null);
      }
    }
    loadTrend();
    return () => { cancelled = true; };
  }, [panel, territoryTrendZone, territoryTrendEntity, weeksWindow, lookback]);

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

  const currentTrends = contextTrends || data?.trends;

  return (
    <main className="app-shell">
      <section className="panel header-panel">
        <div>
          <h1>Painel SRAG - Mossoró/RN</h1>
          <p className="sub">Monitoramento de gravidade e perfil viral.</p>
        </div>
        <div className="status-grid">
          <div><p>Sincronização</p><strong>{status === 'online' ? 'BANCO ATIVO' : 'OFFLINE'}</strong></div>
          <div><p>Atualização</p><strong>{lastUpdate ? new Date(lastUpdate).toLocaleDateString() : '---'}</strong></div>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Total Notificado" value={kpis.total} />
        <KpiCard label="Taxa de UTI" value={kpis.uti} />
        <KpiCard label="Letalidade" value={kpis.death} />
        <KpiCard label="Projeção (S+1)" value={kpis.next} />
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
          <div className="section-header">
            <div className="stack" style={{ gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0 }}>Tendência</h3>
              </div>
              {currentTrends && (
                <div className="filters" style={{ fontSize: '12px', color: '#64748b', gap: 12 }}>
                  <span>Total: <b>{currentTrends.history.reduce((s, h) => s + h.total, 0)}</b></span>
                  <span>Média: <b>{(currentTrends.history.reduce((s, h) => s + h.total, 0) / (currentTrends.history.length || 1)).toFixed(1)}/s</b></span>
                </div>
              )}
            </div>
            <div className="filters">
              {panel === 'territorio' && (
                <>
                  <label>
                    Zona
                    <select value={territoryTrendZone} onChange={e => setTerritoryTrendZone(e.target.value)}>
                      <option value="macro">Macro</option>
                      <option value="urbana">Urbana</option>
                      <option value="rural">Rural</option>
                    </select>
                  </label>
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
          <h3>Resumo operacional</h3>
          {error ? <p className="error-box">{error}</p> : (
            <ul className="list">
              <li><span>Taxa de UTI</span><span>{kpis.uti}</span></li>
              <li><span>Taxa de óbito</span><span>{kpis.death}</span></li>
              <li><span>Projeção próxima semana</span><span>{kpis.next}</span></li>
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
              raceProfile={citizenData.raceProfile}
              schooling={citizenData.schooling}
              symptomsSignature={citizenData.symptomsSignature}
              riskFactors={citizenData.riskFactors}
              vaccination={citizenData.vaccination}
              survival={citizenData.survival}
              timelineData={citizenData.timelineData}
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
