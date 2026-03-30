import React, { useState } from 'react';
import BairrosChart from '../charts/BairrosChart';
import ZonesChart from '../charts/ZonesChart';
import LeafletMap from '../charts/LeafletMap';
import * as Epi from '../../types/epi';

interface TerritoryPanelProps {
  loading: boolean;
  territory: Epi.TerritoryBootstrap['territory'];
  boundary: any;
  choropleth: Epi.TerritoryBootstrap['choropleth'] | null;
  macroPoints: Record<string, { available: boolean; points: any[] }>;
}

const TerritoryPanel: React.FC<TerritoryPanelProps> = ({
  loading,
  territory,
  boundary,
  choropleth,
  macroPoints
}) => {
  const [mapZoneMode, setMapZoneMode] = useState('Urbana');

  return (
    <div className="stack">
      {loading && <p className="meta">Carregando dados territoriais...</p>}
      
      <h3>Bairros com mais casos</h3>
      <div className="chart-wrap">
        <BairrosChart data={territory?.bairros || []} />
      </div>

      <h3>Distribuição urbana/rural</h3>
      <div className="chart-wrap">
        <ZonesChart data={territory?.zonas || []} />
      </div>

      <h3>Mapa territorial</h3>
      <div className="filters">
        <label>
          Zona
          <select value={mapZoneMode} onChange={(e) => setMapZoneMode(e.target.value)}>
            <option value="Urbana">Urbana</option>
            <option value="Rural">Rural</option>
          </select>
        </label>
      </div>
      <LeafletMap 
        boundary={boundary}
        choropleth={choropleth}
        macroPoints={macroPoints}
        mapZoneMode={mapZoneMode}
      />
    </div>
  );
};

export default TerritoryPanel;
