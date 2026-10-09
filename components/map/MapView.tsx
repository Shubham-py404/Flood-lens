'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Map, GeoJSONSource, setWorkerUrl } from 'maplibre-gl';
import type { MapMouseEvent, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import RiskLegend from './RiskLegend';
import RoadDetailDrawer from './RoadDetailDrawer';

// Fix for Next.js: maplibre-gl v4+ uses ES Modules (sealed objects) — property mutation won't work.
// setWorkerUrl() is the official API to point to the pre-built worker served as a static file.
if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre-gl-worker.mjs');
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  
  // State to track which road was clicked
  const [selectedRoad, setSelectedRoad] = useState<any | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new Map({
      container: mapContainer.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [
        Number(process.env.NEXT_PUBLIC_DEFAULT_LNG || 77.2167),
        Number(process.env.NEXT_PUBLIC_DEFAULT_LAT || 28.6315)
      ],
      zoom: Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM || 14),
    });

    map.current.on('load', () => {
      if (!map.current) return;

      map.current.addSource('roads', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.current.addLayer({
        id: 'roads-layer',
        type: 'line',
        source: 'roads',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-width': 6,
          'line-color': [
            'match',
            ['get', 'current_risk_level'],
            'LOW', '#22c55e',      
            'MODERATE', '#eab308', 
            'HIGH', '#f97316',     
            'SEVERE', '#ef4444',   
            '#94a3b8'              
          ]
        }
      });

      // INTERACTIVITY: Change cursor to pointer on hover
      map.current.on('mouseenter', 'roads-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'roads-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      // INTERACTIVITY: Click event to open the drawer
      map.current.on('click', 'roads-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          setSelectedRoad(feature.properties);
        }
      });

      const fetchRoads = async () => {
        const bounds = map.current?.getBounds();
        if (!bounds) return;

        const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
        
        try {
          const res = await fetch(`/api/risk/area?bbox=${bbox}`);
          const data = await res.json();
          
          if (map.current?.getSource('roads')) {
            (map.current.getSource('roads') as GeoJSONSource).setData(data);
          }
        } catch (err) {
          console.error("Failed to fetch road risks:", err);
        }
      };

      fetchRoads();
      map.current.on('moveend', fetchRoads);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      <RiskLegend />

      <RoadDetailDrawer 
        road={selectedRoad} 
        onClose={() => setSelectedRoad(null)} 
      />
    </div>
  );
}