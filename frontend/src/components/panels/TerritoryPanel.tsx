import type { FeatureCollection } from 'geojson';
import React, { useEffect, useMemo, useState } from 'react';
import * as Epi from '../../types/epi';
import LeafletMap from '../charts/LeafletMap';
import RankTable from '../ui/RankTable';

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
  ruralData: {
    sectors: Array<{ sector: string; count: number }>;
    points: unknown[];
    center: { lat: number; lon: number } | null;
    urban_points?: Array<{
      codigo_cnes: string;
      label: string;
      count: number;
      latitude?: number | null;
      longitude?: number | null;
      endereco?: string | null;
      zona?: string;
      bairro?: string | null;
    }>;
    urban_center?: { lat: number; lon: number } | null;
  } | null;
  ruralSectorsGeo: FeatureCollection;
  zoneFilter: string[];
}

const ZONE_FILTER_TO_MAP: Record<string, string> = {
  URBANA: 'Urbana',
  RURAL: 'Rural',
  PERIURBANA: 'Periurbana',
};

const TerritoryPanel: React.FC<TerritoryPanelProps> = ({
  loading,
  territory,
  boundary,
  choropleth,
  ruralData,
  ruralSectorsGeo,
  zoneFilter,
}) => {
  const availableModes = useMemo(() => {
    if (zoneFilter.length === 0) return ['Urbana', 'Rural'];
    return zoneFilter
      .map((k) => ZONE_FILTER_TO_MAP[k])
      .filter((v): v is string => v !== undefined);
  }, [zoneFilter]);

  const [mapZoneMode, setMapZoneMode] = useState('Urbana');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);

  useEffect(() => {
    if (availableModes.length === 1) {
      setMapZoneMode(availableModes[0]);
    } else if (!availableModes.includes(mapZoneMode)) {
      setMapZoneMode(availableModes[0] || 'Urbana');
    }
  }, [availableModes, mapZoneMode]);

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

  const bairroRows = useMemo(
    () =>
      (territory?.bairros || []).map((item) => ({
        key: item.bairro,
        values: {
          bairro: item.bairro,
          count: item.count,
          curados: item.curados ?? 0,
          obitos: item.obitos ?? 0,
          ignorados: item.ignorados ?? 0,
        },
      })),
    [territory?.bairros],
  );

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      {loading && <p className="meta">Carregando dados territoriais...</p>}

      <article className="panel" style={{ boxShadow: 'none' }}>
        <RankTable
          title="Bairros notificados"
          subtitle="Top 10 com busca e paginação"
          searchPlaceholder="Buscar bairro"
          columns={[
            { key: 'bairro', label: 'Bairro' },
            { key: 'count', label: 'Notificados', align: 'right' },
            { key: 'curados', label: 'Curados', align: 'right' },
            { key: 'obitos', label: 'Óbitos', align: 'right' },
            { key: 'ignorados', label: 'Ignorados', align: 'right' },
          ]}
          rows={bairroRows}
        />
      </article>

      <article className="panel">
        <div className="section-header">
          <div>
            <h3>Mapa territorial</h3>
            <p className="meta">Cada bairro recebe uma cor na escala amarelo→vermelho conforme sua posição entre 0 e o bairro com mais casos — proporção linear direta</p>
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
                {availableModes.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
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
