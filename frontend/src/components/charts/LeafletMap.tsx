import * as d3 from 'd3';
import type { FeatureCollection } from 'geojson';
import type * as L from 'leaflet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeMode } from '../../hooks/useThemeMode';
import { formatRangeValue, getChoroplethStyle } from './LeafletMap.helpers';

interface ChoroplethType {
  feature_collection?: FeatureCollection;
}

interface UrbanPoint {
  codigo_cnes?: string;
  label?: string;
  count: number;
  latitude?: number | null;
  longitude?: number | null;
  endereco?: string | null;
  zona?: string;
  bairro?: string | null;
}

interface LeafletMapProps {
  boundary: FeatureCollection | null;
  choropleth: ChoroplethType | null;
  ruralData: {
    sectors: Array<{
      codigo_cnes?: string;
      label?: string;
      sector?: string;
      count: number;
      latitude?: number | null;
      longitude?: number | null;
      endereco?: string | null;
      zona?: string;
      bairro?: string | null;
    }>;
    center: { lat: number; lon: number } | null;
    urban_points?: UrbanPoint[];
    urban_center?: { lat: number; lon: number } | null;
  } | null;
  ruralSectorsGeo: FeatureCollection;
  mapZoneMode: string;
  selectedSectors?: string[];
  onSectorSelect?: (sectors: string[]) => void;
}

const SECTOR_FILL: Record<string, string> = {
  N: '#0f766e',
  S: '#d97706',
  L: '#2563eb',
  O: '#dc2626',
};

const LeafletMap: React.FC<LeafletMapProps> = ({
  boundary,
  choropleth,
  ruralData,
  ruralSectorsGeo,
  mapZoneMode,
  selectedSectors = [],
  onSectorSelect,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const boundaryLayer = useRef<L.GeoJSON | null>(null);
  const overlayLayer = useRef<L.LayerGroup | null>(null);
  const theme = useThemeMode();

  const colorScale = useMemo(() => {
    if (mapZoneMode !== 'Urbana' || !choropleth?.feature_collection?.features?.length) {
      return null;
    }

    const counts = choropleth.feature_collection.features.map(
      (f) => (f.properties?.count as number) || 0,
    );
    const maxCount = d3.max(counts) || 1;
    return d3.scaleSequential().domain([0, maxCount]).interpolator(d3.interpolateYlOrRd);
  }, [choropleth, mapZoneMode]);

  const maxVal = colorScale ? colorScale.domain()[1] : 0;
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(maxVal);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [hoveringBar, setHoveringBar] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRangeMin(0);
    setRangeMax(maxVal);
    setHoverValue(null);
  }, [maxVal]);

  const handleSectorClick = useCallback(
    (sector: string) => {
      if (!onSectorSelect) return;
      const next = selectedSectors.includes(sector)
        ? selectedSectors.filter((s) => s !== sector)
        : [...selectedSectors, sector];
      onSectorSelect(next);
    },
    [selectedSectors, onSectorSelect],
  );

  useEffect(() => {
    let cancelled = false;
    async function renderMap() {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapRef.current) return;

      const lightTiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      const tileUrl = theme === 'dark' ? darkTiles : lightTiles;

      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView([-5.18, -37.34], 12);

        tileLayerRef.current = L.tileLayer(tileUrl, {
          attribution: theme === 'dark' ? '&copy; CartoDB' : '&copy; OpenStreetMap',
        }).addTo(mapInstance.current);
      } else {
        tileLayerRef.current?.setUrl(tileUrl);
      }

      if (boundaryLayer.current) boundaryLayer.current.remove();
      if (overlayLayer.current) overlayLayer.current.remove();

      if (boundary?.features?.length) {
        boundaryLayer.current = L.geoJSON(boundary, {
          style: { color: '#1e293b', weight: 2.5, fillOpacity: 0 },
        }).addTo(mapInstance.current);
      }

      if (mapZoneMode === 'Urbana') {
        if (mapInstance.current) {
          mapInstance.current.setView([-5.18, -37.34], 12);
        }

        const urbanLayer = L.layerGroup();

        if (choropleth?.feature_collection?.features?.length) {
          L.geoJSON(choropleth.feature_collection, {
            style: (f) => {
              const feature = f as { properties?: { bairro?: string; count?: number } };
              const count = (feature.properties?.count as number) || 0;
              const hoveredCount = hoveringBar ? hoverValue : null;
              const baseFill =
                count > 0 && colorScale
                  ? colorScale(count)
                  : theme === 'dark'
                    ? '#334155'
                    : '#e2e8f0';
              return getChoroplethStyle({
                count,
                rangeMin,
                rangeMax,
                hoverValue: hoveredCount,
                theme,
                colorForCount: baseFill,
              });
            },
          onEachFeature: (feature, layer) => {
            const feat = feature as { properties?: { bairro?: string; count?: number } };
            if (feat.properties?.bairro) {
              const c = feat.properties.count || 0;
              layer.bindTooltip(
                `<strong>${feat.properties.bairro}</strong><br/>${c} ${c === 1 ? 'caso' : 'casos'}`,
                { sticky: true },
              );
            }
          },
        }).addTo(urbanLayer);
        }

        const urbPts = ruralData?.urban_points?.filter(
          (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number',
        );
        if (urbPts?.length) {
          urbPts.forEach((pt) => {
            const marker = L.circleMarker([pt.latitude as number, pt.longitude as number], {
              radius: Math.max(5, Math.min(12, 5 + (pt.count || 0) / 4)),
              color: '#2563eb',
              weight: 2,
              fillColor: '#60a5fa',
              fillOpacity: 0.7,
            });
            marker.bindTooltip(
              `<strong>${pt.label || pt.codigo_cnes || 'Unidade'}</strong><br/>${pt.count} casos${pt.bairro ? `<br/>${pt.bairro}` : ''}${pt.endereco ? `<br/>${pt.endereco}` : ''}`,
              { sticky: true },
            );
            marker.addTo(urbanLayer);
          });
        }

        overlayLayer.current = urbanLayer.addTo(mapInstance.current);
      } else if (mapZoneMode === 'Rural') {
        const lg = L.layerGroup();

        const unitPoints = ruralData?.sectors?.filter(
          (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number',
        );

        if (unitPoints?.length) {
          unitPoints.forEach((unit) => {
            const marker = L.circleMarker([unit.latitude as number, unit.longitude as number], {
              radius: Math.max(5, Math.min(14, 5 + (unit.count || 0) / 4)),
              color: '#f59e0b',
              weight: 2,
              fillColor: '#fb923c',
              fillOpacity: 0.7,
            });
            marker.bindTooltip(
              `<strong>${unit.label || unit.codigo_cnes || 'Unidade'}</strong><br/>${unit.count} casos${unit.endereco ? `<br/>${unit.endereco}` : ''}`,
              { sticky: true },
            );
            marker.addTo(lg);
          });
        }

        if (ruralSectorsGeo?.features) {
          L.geoJSON(ruralSectorsGeo, {
            style: (f) => {
              const feature = f as { properties?: { sector?: string } };
              const sector = feature.properties?.sector as string | undefined;
              const sectorData = ruralData?.sectors?.find((s) => s.sector === sector);
              void sectorData;

              const isSelected = selectedSectors.includes(sector || '');
              const fillColor = SECTOR_FILL[sector || ''] || '#cbd5e1';
              const strokeColor = isSelected ? '#f59e0b' : '#334155';

              return {
                color: strokeColor,
                weight: isSelected ? 4 : 1.2,
                fillColor,
                fillOpacity: isSelected ? 0.45 : 0.2,
                dashArray: isSelected ? '' : '3, 3',
              };
            },
            onEachFeature: (feature, layer) => {
              const feat = feature as { properties?: { sector?: string } };
              const sector = feat.properties?.sector as string | undefined;
              const sectorData = ruralData?.sectors?.find((s) => s.sector === sector);
              if (sectorData) {
                layer.bindTooltip(
                  `<strong>Setor ${sectorData.sector}</strong><br/>${sectorData.count} casos`,
                  { sticky: true },
                );
              }
              layer.on('click', () => handleSectorClick(sector || ''));
            },
          }).addTo(lg);
        }

        overlayLayer.current = lg.addTo(mapInstance.current);

        if (ruralData?.center && mapInstance.current) {
          mapInstance.current.setView([ruralData.center.lat, ruralData.center.lon], 10);
        }
      } else if (mapZoneMode === 'Periurbana') {
        overlayLayer.current = L.layerGroup().addTo(mapInstance.current);
      }
    }
    renderMap();
    return () => {
      cancelled = true;
    };
  }, [
    boundary,
    choropleth,
    ruralData,
    ruralSectorsGeo,
    mapZoneMode,
    selectedSectors,
    handleSectorClick,
    colorScale,
    theme,
    rangeMin,
    rangeMax,
    hoverValue,
    hoveringBar,
  ]);

  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div className="map" ref={mapRef} />

      {mapZoneMode === 'Urbana' && colorScale && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 1000,
            background: theme === 'dark' ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)',
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(4px)',
            border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
            minWidth: 180,
          }}
        >
            <p
            style={{
              margin: '0 0 6px 0',
              fontSize: '10px',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Casos por Bairro
            </p>
            <div style={{ position: 'relative' }}>
              <div
                ref={barRef}
                onMouseMove={(e) => {
                  if (!barRef.current) return;
                  const rect = barRef.current.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setHoveringBar(true);
                  setHoverValue(Math.round(Math.min(Math.max(pct, 0), 1) * maxVal));
                }}
                onMouseLeave={() => {
                  setHoveringBar(false);
                  setHoverValue(null);
                }}
                style={{
                  width: '100%',
                  height: 12,
                  borderRadius: 4,
                cursor: 'crosshair',
                background:
                  'linear-gradient(to right, #fff7ec, #fee8c8, #fdd49e, #fdbb84, #fc8d59, #ef6548, #d7301f, #990000)',
              }}
            />
            {hoverValue !== null && (
              <div
                style={{
                  position: 'absolute',
                  top: -22,
                  left: `${(hoverValue / maxVal) * 100}%`,
                  transform: 'translateX(-50%)',
                  background: theme === 'dark' ? '#1e293b' : '#0f172a',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {hoverValue.toLocaleString('pt-BR')}
              </div>
            )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 9, color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                {formatRangeValue(rangeMin)}
              </span>
              <span style={{ fontSize: 9, color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                {formatRangeValue(rangeMax)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: theme === 'dark' ? '#cbd5e1' : '#334155' }}>
                Mín: {formatRangeValue(rangeMin)}
              </span>
              <span style={{ fontSize: 10, color: theme === 'dark' ? '#cbd5e1' : '#334155' }}>
                Máx: {formatRangeValue(rangeMax)}
              </span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="range"
                min={0}
                max={maxVal}
                step={1}
                value={rangeMin}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRangeMin(Math.min(v, rangeMax));
                }}
                style={{ flex: 1, height: 4, accentColor: '#f97316' }}
              />
              <input
                type="range"
                min={0}
                max={maxVal}
                step={1}
                value={rangeMax}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRangeMax(Math.max(v, rangeMin));
                }}
                style={{ flex: 1, height: 4, accentColor: '#dc2626' }}
              />
            </div>
          </div>
      )}

      {mapZoneMode === 'Rural' && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 1000,
            background: theme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.9)',
            color: 'white',
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: 140,
            backdropFilter: 'blur(4px)',
            border: `1px solid ${theme === 'dark' ? '#334155' : '#334155'}`,
          }}
        >
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: '10px',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Distribuição Rural
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(['N', 'S', 'L', 'O'] as const).map((s) => {
              const isSelected = selectedSectors.includes(s);
              if (selectedSectors.length > 0 && !isSelected) return null;

              const sectorData = ruralData?.sectors?.find((item) => item.sector === s);
              const count = sectorData?.count || 0;
              const color = SECTOR_FILL[s];

              return (
                <div
                  key={s}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color,
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Setor {s}</span>
                  </div>
                  <b style={{ fontSize: '13px', color: '#f59e0b' }}>{count}</b>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mapZoneMode === 'Rural' && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1000,
            background: theme === 'dark' ? '#1e293b' : 'white',
            borderRadius: 999,
            padding: '8px 10px',
            boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {(['N', 'S', 'L', 'O'] as const).map((s) => {
            const isSelected = selectedSectors.includes(s);
            const stroke = SECTOR_FILL[s];
            return (
              <button
                key={s}
                onClick={() => handleSectorClick(s)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: 999,
                  border: isSelected
                    ? `2px solid ${stroke}`
                    : `1px solid ${theme === 'dark' ? '#475569' : '#e2e8f0'}`,
                  background: isSelected ? `${stroke}20` : theme === 'dark' ? '#1e293b' : 'white',
                  color: isSelected ? stroke : theme === 'dark' ? '#f8fafc' : '#0f172a',
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            );
          })}
          {selectedSectors.length > 0 && (
            <button
              onClick={() => onSectorSelect?.([])}
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                background: theme === 'dark' ? '#334155' : '#f8fafc',
                border: `1px solid ${theme === 'dark' ? '#475569' : '#e2e8f0'}`,
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              Limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LeafletMap;
