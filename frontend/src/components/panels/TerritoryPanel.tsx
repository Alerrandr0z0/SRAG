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
        sortValues: {
          bairro: item.bairro,
          count: item.count,
          curados: item.curados ?? 0,
          obitos: item.obitos ?? 0,
          ignorados: item.ignorados ?? 0,
        },
        searchText: item.bairro.toLowerCase(),
      })),
    [territory?.bairros],
  );

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      {loading && <p className="meta">Carregando dados territoriais...</p>}

      <article className="panel">
        <RankTable
          title="Localidades notificadas"
          searchPlaceholder="Buscar localidade"
          columns={[
            { key: 'bairro', label: 'Localidade', sortable: true },
            { key: 'count', label: 'Notificados', align: 'right', sortable: true },
            { key: 'curados', label: 'Curados', align: 'right', sortable: true },
            { key: 'obitos', label: 'Óbitos', align: 'right', sortable: true },
            { key: 'ignorados', label: 'Ignorados', align: 'right', sortable: true },
          ]}
          rows={bairroRows}
          exportable={{ filename: 'localidades_notificadas', title: 'Localidades notificadas' }}
        />
      </article>

      {/* Ridgeline — atraso de notificação por localidade */}
      <article className="panel" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <div>
            <h3>Atraso de Notificação por Localidade</h3>
          </div>
          <div className="rank-tooltip-wrapper">
            <button
              type="button"
              className="rank-tooltip-trigger"
              aria-label="Sobre o atraso de notificação por localidade"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
            <div className="rank-tooltip-content rank-tooltip-content--align-right" style={{ width: '340px' }}>
              <div>
                <b>Atraso de Notificação por Localidade</b>
                <br />
                Distribuição de dias entre os primeiros sintomas e a notificação da ficha por bairro/localidade.
              </div>
              <br />• <b>Ordenação por Risco (Descendente)</b>: as localidades com maior mediana de atraso aparecem no topo para destacar as regiões com menor tempestividade.
              <br />• <b>Classificação por Mediana</b>: Adequado ≤5d, Atenção ≤10d, Crítico &gt;10d.
              <br />• Linha tracejada em <b>7d</b>: limite operacional de oportunidade (Portaria SVS/MS).
              <br />• Passe o mouse na linha de cada localidade para ver o nome completo sem truncamento, média, P75 e P90.
              <br />• Exibidas apenas localidades com ≥5 casos notificados.
            </div>
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
          * Exibidas apenas localidades com ≥5 casos notificados.
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
