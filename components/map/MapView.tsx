'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Map, GeoJSONSource, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Bell, Crosshair, X, Sparkles } from 'lucide-react';
import { RoadFeatureProperties } from '@/types/geojson';
import { SavedLocation, UserAlert } from '@/types/db';
import RiskLegend from './RiskLegend';
import RoadDetailDrawer from './RoadDetailDrawer';
import ProactiveAlertBanner from '../alerts/ProactiveAlertBanner';
import SavePlaceModal from '../places/SavePlaceModal';
import SavedPlacesDrawer from '../places/SavedPlacesDrawer';

// Fix for Next.js: maplibre-gl v4+ uses ES Modules (sealed objects) — property mutation won't work.
// setWorkerUrl() is the official API to point to the pre-built worker served as a static file.
if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre-gl-worker.mjs');
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);

  // State to track which road was clicked
  const [selectedRoad, setSelectedRoad] = useState<RoadFeatureProperties | null>(null);

  // Feature 6: Saved Places and Alerts state
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [isLoadingSafety, setIsLoadingSafety] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSafetyDrawerOpen, setIsSafetyDrawerOpen] = useState(false);
  const [isPickingLocationOnMap, setIsPickingLocationOnMap] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string | undefined>(undefined);

  const isPickingRef = useRef(isPickingLocationOnMap);

  useEffect(() => {
    isPickingRef.current = isPickingLocationOnMap;
  }, [isPickingLocationOnMap]);

  // 1. Fetch user saved locations and alerts
  const refreshSafetyData = useCallback(async () => {
    try {
      setIsLoadingSafety(true);
      const [placesRes, alertsRes] = await Promise.all([
        fetch('/api/user/saved-locations'),
        fetch('/api/user/alerts'),
      ]);

      if (placesRes.ok) {
        const placesData = await placesRes.json();
        setSavedLocations(placesData.saved_locations || []);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }
    } catch (err) {
      console.error('Error fetching safety data:', err);
    } finally {
      setIsLoadingSafety(false);
    }
  }, []);

  // Periodic polling for alerts (e.g. following weather sync updates)
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [placesRes, alertsRes] = await Promise.all([
          fetch('/api/user/saved-locations'),
          fetch('/api/user/alerts'),
        ]);
        if (!isMounted) return;
        if (placesRes.ok) {
          const placesData = await placesRes.json();
          setSavedLocations(placesData.saved_locations || []);
        }
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setAlerts(alertsData.alerts || []);
        }
      } catch (err) {
        console.error('Error polling safety data:', err);
      }
    };

    load();
    const interval = setInterval(load, 25000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Render Saved Place Markers on the Map
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add marker for each saved place
    savedLocations.forEach((place) => {
      const el = document.createElement('div');
      el.className = 'group cursor-pointer select-none';

      const isElevated =
        place.nearest_road_risk_level === 'HIGH' ||
        place.nearest_road_risk_level === 'SEVERE';

      const getIconEmoji = (lbl: string) => {
        const l = lbl.toLowerCase();
        if (l.includes('home')) return '🏠';
        if (l.includes('work') || l.includes('office')) return '💼';
        if (l.includes('school')) return '🎒';
        return '📍';
      };

      el.innerHTML = `
        <div style="
          background: ${isElevated ? '#fef2f2' : '#ffffff'};
          border: 2px solid ${isElevated ? '#ef4444' : '#2563eb'};
          color: ${isElevated ? '#991b1b' : '#1e3a8a'};
          border-radius: 9999px;
          padding: 3px 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          transition: transform 0.2s ease;
        ">
          <span>${getIconEmoji(place.label)}</span>
          <span>${place.label}</span>
          ${isElevated ? '<span style="color:#ef4444;font-size:10px;">⚠️</span>' : ''}
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        map.current?.flyTo({
          center: [place.longitude, place.latitude],
          zoom: 15.5,
          essential: true,
        });
      });

      const marker = new Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [savedLocations]);

  // 3. Initialize MapLibre
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new Map({
      container: mapContainer.current,
      style:
        process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
        'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [
        Number(process.env.NEXT_PUBLIC_DEFAULT_LNG || 77.2167),
        Number(process.env.NEXT_PUBLIC_DEFAULT_LAT || 28.6315),
      ],
      zoom: Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM || 14),
    });

    map.current.on('load', () => {
      if (!map.current) return;

      map.current.addSource('roads', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'roads-layer',
        type: 'line',
        source: 'roads',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
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
            '#94a3b8',
          ],
        },
      });

      // INTERACTIVITY: Change cursor to pointer on hover
      map.current.on('mouseenter', 'roads-layer', () => {
        if (map.current && !isPickingRef.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      map.current.on('mouseleave', 'roads-layer', () => {
        if (map.current && !isPickingRef.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });

      // INTERACTIVITY: Click event for roads
      map.current.on('click', 'roads-layer', (e) => {
        if (isPickingRef.current) return; // Ignore if user is pinning a location
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          setSelectedRoad(feature.properties as unknown as RoadFeatureProperties);
        }
      });

      // INTERACTIVITY: Map-level click for picking coordinates
      map.current.on('click', (e) => {
        if (isPickingRef.current) {
          setPickedCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          setIsPickingLocationOnMap(false);
          if (map.current) {
            map.current.getCanvas().style.cursor = '';
          }
          setIsSaveModalOpen(true);
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
          console.error('Failed to fetch road risks:', err);
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

  // Update cursor when picking mode toggles
  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = isPickingLocationOnMap ? 'crosshair' : '';
  }, [isPickingLocationOnMap]);

  // Handle escape key to cancel picking mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPickingLocationOnMap) {
        setIsPickingLocationOnMap(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPickingLocationOnMap]);

  // Alert Actions
  const handleDismissAlert = async (alertId: string) => {
    // Optimistic UI update
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
    );
    try {
      await fetch(`/api/user/alerts/${alertId}`, { method: 'PATCH' });
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const handleMarkAllAlertsRead = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    try {
      await fetch('/api/user/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      });
    } catch (err) {
      console.error('Failed to mark all alerts read:', err);
    }
  };

  const handleDeletePlace = async (id: string) => {
    try {
      const res = await fetch(`/api/user/saved-locations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSavedLocations((prev) => prev.filter((p) => p.id !== id));
        refreshSafetyData();
      }
    } catch (err) {
      console.error('Failed to delete saved location:', err);
    }
  };

  const handleLocatePlace = (latitude: number, longitude: number) => {
    map.current?.flyTo({
      center: [longitude, latitude],
      zoom: 15.5,
      essential: true,
    });
  };

  const handleLocateAlert = (alert: UserAlert) => {
    if (alert.longitude !== undefined && alert.latitude !== undefined) {
      map.current?.flyTo({
        center: [alert.longitude, alert.latitude],
        zoom: 15.5,
        essential: true,
      });
    }
  };

  // Quick action from RoadDetailDrawer: save current road
  const handleSaveRoadAsPlace = (road: RoadFeatureProperties) => {
    // Center of map or default coordinates
    const center = map.current?.getCenter();
    setPickedCoords({
      lat: center ? center.lat : 28.6315,
      lng: center ? center.lng : 77.2167,
    });
    setPickedLabel(road.road_name);
    setIsSaveModalOpen(true);
  };

  const unreadAlertsCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Floating Top Citizen Navigation Header */}
      <header className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex items-center justify-between">
        {/* Brand Tag */}
        <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/80 text-white backdrop-blur-md border border-slate-700/60 shadow-xl">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-wide text-white uppercase flex items-center gap-1">
              FloodLens <Sparkles className="w-3 h-3 text-cyan-400" />
            </span>
            <span className="text-[10px] text-slate-300 font-medium">Citizen Safety Network</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Save Place Button */}
          <button
            type="button"
            onClick={() => {
              const center = map.current?.getCenter();
              setPickedCoords({
                lat: center ? center.lat : 28.6315,
                lng: center ? center.lng : 77.2167,
              });
              setIsSaveModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 cursor-pointer active:scale-95"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Save Place</span>
          </button>

          {/* Citizen Safety Hub Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsSafetyDrawerOpen(true)}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-white text-xs font-bold transition-all backdrop-blur-md border border-slate-700/60 shadow-xl cursor-pointer active:scale-95"
          >
            <Bell className="w-4 h-4 text-slate-200" />
            <span className="hidden sm:inline">Safety Hub</span>
            {unreadAlertsCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse shadow-sm shadow-red-500">
                {unreadAlertsCount}
              </span>
            ) : savedLocations.length > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-200 text-[10px] font-medium">
                {savedLocations.length}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      {/* Picking Location Guide Overlay */}
      {isPickingLocationOnMap && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <Crosshair className="w-4 h-4 animate-spin" />
          <span>Click anywhere on the map to pin this place</span>
          <button
            type="button"
            onClick={() => setIsPickingLocationOnMap(false)}
            className="p-1 rounded-full hover:bg-blue-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Proactive Alert Banner (Top Center) */}
      <ProactiveAlertBanner
        alerts={alerts}
        onDismiss={handleDismissAlert}
        onLocate={handleLocateAlert}
        onViewAll={() => setIsSafetyDrawerOpen(true)}
      />

      {/* Map Legend */}
      <RiskLegend />

      {/* Road Inspection Drawer */}
      <RoadDetailDrawer
        road={selectedRoad}
        onClose={() => setSelectedRoad(null)}
        onSaveAsPlace={handleSaveRoadAsPlace}
      />

      {/* Save Place Dialog Modal */}
      <SavePlaceModal
        key={`${pickedCoords?.lat}-${pickedCoords?.lng}-${pickedLabel}`}
        isOpen={isSaveModalOpen}
        onClose={() => {
          setIsSaveModalOpen(false);
          setPickedLabel(undefined);
        }}
        initialCoords={pickedCoords}
        initialLabel={pickedLabel}
        onStartMapPick={() => setIsPickingLocationOnMap(true)}
        onSaveSuccess={(newPlace) => {
          setSavedLocations((prev) => [newPlace, ...prev]);
          refreshSafetyData();
          setPickedLabel(undefined);
        }}
      />

      {/* Citizen Safety Hub & Alert History Drawer */}
      <SavedPlacesDrawer
        isOpen={isSafetyDrawerOpen}
        onClose={() => setIsSafetyDrawerOpen(false)}
        savedLocations={savedLocations}
        alerts={alerts}
        isLoading={isLoadingSafety}
        onAddNewPlace={() => {
          setIsSafetyDrawerOpen(false);
          const center = map.current?.getCenter();
          setPickedCoords({
            lat: center ? center.lat : 28.6315,
            lng: center ? center.lng : 77.2167,
          });
          setIsSaveModalOpen(true);
        }}
        onDeletePlace={handleDeletePlace}
        onMarkAlertRead={handleDismissAlert}
        onMarkAllAlertsRead={handleMarkAllAlertsRead}
        onLocatePlace={handleLocatePlace}
        onLocateAlert={handleLocateAlert}
      />
    </div>
  );
}