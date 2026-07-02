import type { FeatureCollection } from 'geojson';
import React, { useEffect, useMemo, useState } from 'react';
import * as Epi from '../../types/epi';
import DelayByUnitRidgelinePlot from '../charts/DelayByUnitRidgelinePlot';
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
  delayByBairro: Epi.BairroDelayRecord[];
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
  delayByBairro,
}) => {
  const availableModes = useMemo(() => {
    if (zoneFilter.length === 0) return ['Urbana', 'Rural'];
    return zoneFilter.map((k) => ZONE_FILTER_TO_MAP[k]).filter((v): v is string => v !== undefined);
  }, [zoneFilter]);

  const [mapZoneMode, setMapZoneMode] = useState('Urbana');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [showUnits, setShowUnits] = useState(false);

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
          title="Localidades notificadas"
          subtitle="Top 10 com busca e paginação"
          searchPlaceholder="Buscar localidade"
          columns={[
            { key: 'bairro', label: 'Localidade' },
            { key: 'count', label: 'Notificados', align: 'right' },
            { key: 'curados', label: 'Curados', align: 'right' },
            { key: 'obitos', label: 'Óbitos', align: 'right' },
            { key: 'ignorados', label: 'Ignorados', align: 'right' },
          ]}
          rows={bairroRows}
        />
      </article>

      {/* Ridgeline — atraso de notificação por localidade */}
      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <div>
            <h3>Atraso de Notificação por Localidade</h3>
            <p className="meta">Distribuição de dias entre primeiros sintomas e notificação</p>
          </div>
        </div>
        <div style={{ marginTop: '15px' }}>
          <DelayByUnitRidgelinePlot
            data={
              delayByBairro.length > 0
                ? delayByBairro.map((d) => ({
                    id_unidade: d.bairro,
                    nome_fantasia: d.bairro,
                    total: d.total,
                    median_delay: d.median_delay,
                    avg_delay: d.avg_delay,
                    delay_samples: d.delay_samples,
                  }))
                : null
            }
          />
        </div>
        <p
          className="meta"
          style={{
            marginTop: '10px',
            fontSize: '11px',
            fontStyle: 'italic',
            lineHeight: '1.4',
          }}
        >
          * Exibidas apenas localidades com ≥5 casos notificados. Amostra de até 100 casos por
          localidade.
        </p>
      </article>

      <article className="panel">
        <div className="section-header">
          <h3>Mapa territorial</h3>
          <div className="filters">
            <button
              type="button"
              onClick={() => setShowUnits((v) => !v)}
              aria-pressed={showUnits}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: showUnits ? 'var(--bg-status)' : 'var(--bg-panel)',
                color: showUnits ? '#0f766e' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: showUnits ? 600 : 500,
              }}
            >
              {showUnits ? 'Ocultar unidades' : 'Mostrar unidades'}
            </button>
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
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
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
            showUnits={showUnits}
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
