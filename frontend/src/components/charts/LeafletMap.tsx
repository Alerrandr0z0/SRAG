import React, { useEffect, useRef } from 'react';

let leafletLoader: Promise<any>;
function loadLeaflet() {
  if (!leafletLoader) {
    leafletLoader = Promise.all([
      import('leaflet'),
      import('leaflet/dist/leaflet.css')
    ]).then(([mod]) => mod);
  }
  return leafletLoader;
}

interface LeafletMapProps {
  boundary: any;
  choropleth: any;
  macroPoints: any;
  mapZoneMode: string;
}

const LeafletMap: React.FC<LeafletMapProps> = ({ 
  boundary, 
  choropleth, 
  macroPoints, 
  mapZoneMode 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const boundaryLayer = useRef<any>(null);
  const overlayLayer = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function renderMap() {
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;

      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current).setView([-5.18, -37.34], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
      }

      if (boundaryLayer.current) boundaryLayer.current.remove();
      if (overlayLayer.current) overlayLayer.current.remove();

      if (boundary?.features?.length) {
        boundaryLayer.current = L.geoJSON(boundary, { 
          style: { color: '#1e293b', weight: 2, fillOpacity: 0.05 } 
        }).addTo(mapInstance.current);
      }

      if (mapZoneMode === 'Urbana' && choropleth?.feature_collection?.features?.length) {
        overlayLayer.current = L.geoJSON(choropleth.feature_collection, {
          style: (f: any) => ({ 
            color: '#0f172a', 
            weight: 1, 
            fillColor: f.properties.count > 0 ? '#14b8a6' : '#99f6e4', 
            fillOpacity: 0.8 
          })
        }).addTo(mapInstance.current);
      } else {
        const modeKey = mapZoneMode === 'Rural' ? 'Rural' : 'Periurbana';
        const points = macroPoints?.[modeKey]?.points || [];
        const lg = L.layerGroup();
        points.forEach((p: any) => {
          L.circleMarker([p.LAT, p.LON], { 
            radius: 10, 
            fillColor: '#0f766e', 
            fillOpacity: 0.6 
          }).addTo(lg);
        });
        overlayLayer.current = lg.addTo(mapInstance.current);
      }
    }
    renderMap();
    return () => { 
      cancelled = true; 
    };
  }, [boundary, choropleth, macroPoints, mapZoneMode]);

  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return <div className="map" ref={mapRef} />;
};

export default LeafletMap;
