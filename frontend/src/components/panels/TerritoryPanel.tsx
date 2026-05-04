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
  ruralData: { sectors: any[]; points: any[]; center: any } | null;
  ruralSectorsGeo: any;
}

const TerritoryPanel: React.FC<TerritoryPanelProps> = ({
  loading,
  territory,
  boundary,
  choropleth,
  ruralData,
  ruralSectorsGeo,
}) => {
  const [mapZoneMode, setMapZoneMode] = useState('Urbana');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);

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
          <select
            value={mapZoneMode}
            onChange={(e) => {
              setMapZoneMode(e.target.value);
              setSelectedSectors([]);
            }}
          >
            <option value="Urbana">Urbana</option>
            <option value="Rural">Rural</option>
          </select>
        </label>
      </div>
      <LeafletMap
        boundary={boundary}
        choropleth={choropleth}
        ruralData={ruralData}
        ruralSectorsGeo={ruralSectorsGeo}
        mapZoneMode={mapZoneMode}
        selectedSectors={selectedSectors}
        onSectorSelect={(sectors: any) => setSelectedSectors(sectors)}
      />
    </div>
  );
};

export default TerritoryPanel;
