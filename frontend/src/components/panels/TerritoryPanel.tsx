import React, { useMemo, useState } from 'react';
import BairrosChart from '../charts/BairrosChart';
import LeafletMap from '../charts/LeafletMap';
import * as Epi from '../../types/epi';
import type { FeatureCollection } from 'geojson';

const ZONE_COLORS: Record<string, string> = {
  Urbana: '#0f766e',
  Rural: '#d97706',
  Periurbana: '#7c3aed',
};

interface TerritoryPanelProps {
  loading: boolean;
  territory: Epi.TerritoryBootstrap['territory'];
  boundary: FeatureCollection | null;
  choropleth: Epi.TerritoryBootstrap['choropleth'] | null;
  ruralData: { sectors: Array<{ sector: string; count: number }>; points: unknown[]; center: { lat: number; lon: number } } | null;
  ruralSectorsGeo: FeatureCollection;
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

  const zoneSummary = useMemo(() => {
    const zonas = territory?.zonas || [];
    const total = zonas.reduce((s, z) => s + z.count, 0);
    const order = ['Urbana', 'Rural', 'Periurbana'] as const;
    return order
      .map((name) => {
        const found = zonas.find((z) => z.zona === name);
        const count = found?.count ?? 0;
        return {
          name,
          count,
          pct: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0',
          color: ZONE_COLORS[name],
        };
      })
      .filter((z) => z.count > 0);
  }, [territory?.zonas]);

  return (
    <div className="stack">
      {loading && <p className="meta">Carregando dados territoriais...</p>}

      <h3>Bairros com mais casos</h3>
      <div className="chart-wrap">
        <BairrosChart data={territory?.bairros || []} />
      </div>

      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <div>
            <h3>Mapa territorial</h3>
            <p className="meta">Distribuição geográfica das notificações</p>
          </div>
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
        </div>

        <div style={{ marginTop: '16px' }}>
          <LeafletMap
            boundary={boundary}
            choropleth={choropleth as { feature_collection?: FeatureCollection } | null}
            ruralData={ruralData}
            ruralSectorsGeo={ruralSectorsGeo}
            mapZoneMode={mapZoneMode}
            selectedSectors={selectedSectors}
            onSectorSelect={(sectors: string[]) => setSelectedSectors(sectors)}
          />
        </div>

        {zoneSummary.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-status)',
              padding: '16px',
              borderRadius: '8px',
              marginTop: '16px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Distribuição por Zona
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  height: '8px',
                  marginTop: '6px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  background: 'var(--bg-pill)',
                }}
              >
                {zoneSummary.map((z) => (
                  <div
                    key={z.name}
                    style={{
                      width: `${z.pct}%`,
                      background: z.color,
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '30px', marginTop: '12px', flexWrap: 'wrap' }}>
              {zoneSummary.map((z) => (
                <div key={z.name}>
                  <span
                    style={{
                      fontSize: '11px',
                      color: z.color,
                      fontWeight: 'bold',
                    }}
                  >
                    ● {z.name}
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    {z.pct}%{' '}
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        fontWeight: 'normal',
                      }}
                    >
                      ({z.count.toLocaleString('pt-BR')} casos)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
};

export default TerritoryPanel;
