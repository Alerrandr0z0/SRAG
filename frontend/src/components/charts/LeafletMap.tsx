import React, { useEffect, useRef, useCallback } from 'react';
import type { FeatureCollection } from 'geojson';
import type * as L from 'leaflet';

interface ChoroplethType {
  feature_collection?: FeatureCollection;
}

interface LeafletMapProps {
  boundary: FeatureCollection | null;
  choropleth: ChoroplethType | null;
  ruralData: { sectors: Array<{ sector: string; count: number }>; center: { lat: number; lon: number } } | null;
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

const ORDER_STROKE = {
  first: '#0f766e',
  second: '#f59e0b',
  idle: '#1e293b',
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
  const boundaryLayer = useRef<L.GeoJSON | null>(null);
  const overlayLayer = useRef<L.LayerGroup | null>(null);

  const handleSectorClick = useCallback((sector: string) => {
    if (!onSectorSelect) return;
    const next = selectedSectors.includes(sector)
      ? selectedSectors.filter(s => s !== sector)
      : [...selectedSectors, sector];
    onSectorSelect(next);
  }, [selectedSectors, onSectorSelect]);

  useEffect(() => {
    let cancelled = false;
    async function renderMap() {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapRef.current) return;

      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView([-5.18, -37.34], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
        }).addTo(mapInstance.current);
      }

      if (boundaryLayer.current) boundaryLayer.current.remove();
      if (overlayLayer.current) overlayLayer.current.remove();

      if (boundary?.features?.length) {
        boundaryLayer.current = L.geoJSON(boundary, {
          style: { color: '#1e293b', weight: 2.5, fillOpacity: 0 },
        }).addTo(mapInstance.current);
      }

      if (mapZoneMode === 'Urbana' && choropleth?.feature_collection?.features?.length) {
        overlayLayer.current = L.geoJSON(choropleth.feature_collection, {
          style: (f) => {
            const feature = f as { properties?: { bairro?: string; count?: number } };
            const count = feature.properties && (feature.properties as { count?: number }).count;
            return {
              color: '#0f172a',
              weight: 1,
              fillColor: count != null && count > 0 ? '#14b8a6' : '#e2e8f0',
              fillOpacity: 0.85,
            };
          },
          onEachFeature: (feature, layer) => {
            const feat = feature as { properties?: { bairro?: string } };
            if (feat.properties?.bairro) {
              layer.bindTooltip(
                `<strong>${feat.properties.bairro}</strong><br/>${feature.properties?.count || 0} casos`,
                { sticky: true }
              );
            }
          },
        }).addTo(mapInstance.current);
      } else if (mapZoneMode === 'Rural') {
        const lg = L.layerGroup();

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
                  { sticky: true }
                );
              }
              layer.on('click', () => handleSectorClick(sector || ''));
            },
          }).addTo(lg);
        }

        overlayLayer.current = lg.addTo(mapInstance.current);

        if (ruralData?.center && mapInstance.current) {
          mapInstance.current.setView(
            [ruralData.center.lat, ruralData.center.lon],
            10
          );
        }
      } else if (mapZoneMode === 'Periurbana') {
        overlayLayer.current = L.layerGroup().addTo(mapInstance.current);
      }
    }
    renderMap();
    return () => { cancelled = true; };
  }, [boundary, choropleth, ruralData, ruralSectorsGeo, mapZoneMode, selectedSectors, handleSectorClick]);

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

      {mapZoneMode === 'Rural' && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.9)',
            color: 'white',
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: 140,
            backdropFilter: 'blur(4px)',
            border: '1px solid #334155',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Distribuição Rural
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(['N', 'S', 'L', 'O'] as const).map(s => {
              const isSelected = selectedSectors.includes(s);
              if (selectedSectors.length > 0 && !isSelected) return null;

              const sectorData = ruralData?.sectors?.find(item => item.sector === s);
              const count = sectorData?.count || 0;
              const color = SECTOR_FILL[s];

              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.2)' }} />
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
            background: 'white',
            borderRadius: 999,
            padding: '8px 10px',
            boxShadow: '0 10px 24px rgba(15,23,42,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {(['N', 'S', 'L', 'O'] as const).map((s) => {
            const isSelected = selectedSectors.includes(s);
            const isVertical = s === 'N' || s === 'S';
            const stroke = isVertical ? ORDER_STROKE.first : ORDER_STROKE.second;
            return (
              <button
                key={s}
                onClick={() => handleSectorClick(s)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: 999,
                  border: isSelected ? `2px solid ${stroke}` : '1px solid #e2e8f0',
                  background: isSelected ? `${stroke}20` : 'white',
                  color: isSelected ? stroke : '#0f172a',
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            );
          })}
          {selectedSectors.length > 0 && (
            <button
              onClick={() => onSectorSelect && onSectorSelect([])}
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                color: '#0f172a',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
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
