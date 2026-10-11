'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import {
  LocateFixed,
  AlertTriangle,
  Bookmark,
  Plus,
  Bell,
  X,
  Navigation,
  Droplets,
  Layers,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import SearchBar from './SearchBar';
import SavedPlacesDrawer from '../places/SavedPlacesDrawer';
import FloodActionsModal from '../modal/FloodActionsModal';
import { SavedLocation, UserAlert } from '@/types/db';

if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre-gl-worker.mjs');
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const selectedPinMarker = useRef<maplibregl.Marker | null>(null);
  const savedPlaceMarkers = useRef<maplibregl.Marker[]>([]);

  const [userLoc, setUserLoc] = useState<{ lng: number; lat: number } | null>(null);
  const [gpsDebugMsg, setGpsDebugMsg] = useState<string | null>('Initializing GPS...');
  const [selectedPinCoords, setSelectedPinCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<any | null>(null);

  // Proximity Engine & Radar Alert State
  const [nearbyAlert, setNearbyAlert] = useState<any | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Community Verification Handler
  const handleCommunityVerify = async (status: 'YES' | 'NO', roadId: string) => {
    // 1. Immediately dismiss from view and mark ignored locally
    setDismissedAlerts((prev) => new Set(prev).add(roadId));
    setNearbyAlert(null);

    if (status === 'NO' && map.current) {
      // 2. Optimistically erase flood from user's map layers
      try {
        if (map.current.getLayer('roads-layer')) {
          const currentFilter = (map.current.getFilter('roads-layer') as any) || ['all'];
          map.current.setFilter('roads-layer', ['all', currentFilter, ['!=', ['get', 'id'], roadId]] as any);
        }
        if (map.current.getLayer('roads-glow')) {
          const currentFilter = (map.current.getFilter('roads-glow') as any) || ['all'];
          map.current.setFilter('roads-glow', ['all', currentFilter, ['!=', ['get', 'id'], roadId]] as any);
        }
      } catch (e) {
        console.warn('Error adjusting map filters:', e);
      }

      // 3. Inform DB in background to mark cleared
      try {
        await fetch('/api/reports/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'DISMISS', roadId }),
        });
      } catch (e) {
        console.error('Failed to clear incident from DB:', e);
      }
    } else if (status === 'YES') {
      try {
        await fetch('/api/reports/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'CONFIRM', roadId }),
        });
      } catch (e) {
        console.error('Failed to confirm incident in DB:', e);
      }
    }
  };

  // Modals & Drawers State
  const [isSafetyDrawerOpen, setIsSafetyDrawerOpen] = useState(false);
  const [isFloodActionsModalOpen, setIsFloodActionsModalOpen] = useState(false);
  const [floodActionsTab, setFloodActionsTab] = useState<'report' | 'save'>('report');

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [isLoadingSafety, setIsLoadingSafety] = useState(false);

  // Fetch Safety Hub Data
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

  useEffect(() => {
    refreshSafetyData();
  }, [refreshSafetyData]);

  // RE-CENTER FUNCTION (Tied to a direct User Gesture)
  const flyToUser = () => {
    if (!('geolocation' in navigator)) {
      setGpsDebugMsg('Geolocation is not supported by this browser.');
      return;
    }

    setGpsDebugMsg('Acquiring GPS fix...');

    // Force a fresh GPS request on user click
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude, accuracy } = pos.coords;
        setUserLoc({ lng: longitude, lat: latitude });
        setGpsDebugMsg(`GPS Lock: ${Math.round(accuracy)}m accuracy`);

        if (map.current) {
          map.current.flyTo({ center: [longitude, latitude], zoom: 17, essential: true });

          if (!userMarker.current) {
            const dot = document.createElement('div');
            dot.className =
              'w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_20px_rgba(59,130,246,0.8)]';
            userMarker.current = new maplibregl.Marker({ element: dot })
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          } else {
            userMarker.current.setLngLat([longitude, latitude]);
          }
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsDebugMsg('Error: User denied Geolocation.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsDebugMsg('Error: Location unavailable (GPS weak/off).');
            break;
          case error.TIMEOUT:
            setGpsDebugMsg('Error: GPS request timed out.');
            break;
          default:
            setGpsDebugMsg(`Error: ${error.message}`);
        }
        console.warn('GPS Button Error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Fly to specific location
  const handleLocatePlace = (lat: number, lng: number) => {
    if (map.current) {
      map.current.flyTo({ center: [lng, lat], zoom: 17, essential: true });
    }
    setIsSafetyDrawerOpen(false);
  };

  // Delete saved place
  const handleDeletePlace = async (id: string) => {
    const res = await fetch(`/api/user/saved-locations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refreshSafetyData();
    }
  };

  // Alert actions
  const handleMarkAlertRead = async (alertId: string) => {
    await fetch(`/api/user/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    });
    await refreshSafetyData();
  };

  const handleMarkAllAlertsRead = async () => {
    await fetch('/api/user/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all: true }),
    });
    await refreshSafetyData();
  };

  const openFloodActionsWithTab = (tab: 'report' | 'save', coords?: { lng: number; lat: number }) => {
    setFloodActionsTab(tab);
    if (coords) setSelectedPinCoords(coords);
    setIsFloodActionsModalOpen(true);
  };

  // Render Saved Places Markers on Map
  useEffect(() => {
    if (!map.current) return;

    // Clear old markers
    savedPlaceMarkers.current.forEach((m) => m.remove());
    savedPlaceMarkers.current = [];

    // Only render actual saved locations from the database
    savedLocations.forEach((place) => {
      const el = document.createElement('div');
      const isSevere =
        place.nearest_road_risk_level === 'SEVERE' || place.nearest_road_risk_level === 'HIGH';

      el.className =
        'flex items-center gap-1.5 px-2.5 py-1 bg-white/95 backdrop-blur-xs border rounded-full shadow-md text-xs font-bold cursor-pointer hover:scale-105 transition-all select-none whitespace-nowrap ' +
        (isSevere
          ? 'border-red-400 text-red-700 hover:border-red-600'
          : 'border-slate-300 text-slate-800 hover:border-blue-500');

      const iconEmoji =
        place.label.toLowerCase().includes('work') || place.label.toLowerCase().includes('office')
          ? '💼'
          : place.label.toLowerCase().includes('home')
          ? '🏠'
          : place.label.toLowerCase().includes('school')
          ? '🎓'
          : '📍';

      el.innerHTML = `<span>${iconEmoji}</span><span>${place.label}</span>`;

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        map.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 17 });
        setIsSafetyDrawerOpen(true);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map.current!);

      savedPlaceMarkers.current.push(marker);
    });
  }, [savedLocations]);

  // Main Map Initialization
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'google-streets': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'google-base-layer',
            type: 'raster',
            source: 'google-streets',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: [77.2198, 28.6291],
      zoom: 14,
      attributionControl: false,
    });

    map.current.on('load', () => {
      if (!map.current) return;

      map.current.resize();

      // GET INITIAL GPS
      if ('geolocation' in navigator) {
        const gpsOptions = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        };

        navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            setUserLoc({ lng: longitude, lat: latitude });
            setGpsDebugMsg(`GPS Lock: ${Math.round(accuracy)}m accuracy`);

            if (!userMarker.current && map.current) {
              const dot = document.createElement('div');
              dot.className =
                'w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_20px_rgba(59,130,246,0.8)]';
              userMarker.current = new maplibregl.Marker({ element: dot })
                .setLngLat([longitude, latitude])
                .addTo(map.current);
            } else if (userMarker.current) {
              userMarker.current.setLngLat([longitude, latitude]);
            }
          },
          (error) => {
            switch (error.code) {
              case error.PERMISSION_DENIED:
                setGpsDebugMsg('Error: User denied Geolocation.');
                break;
              case error.POSITION_UNAVAILABLE:
                setGpsDebugMsg('Error: Location unavailable (GPS weak/off).');
                break;
              case error.TIMEOUT:
                setGpsDebugMsg('Error: GPS request timed out.');
                break;
              default:
                setGpsDebugMsg(`Error: ${error.message}`);
            }
          },
          gpsOptions
        );
      } else {
        setGpsDebugMsg('Geolocation is not supported by this browser.');
      }

      // ADD POSTGIS SOURCES
      map.current.addSource('roads', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // THE "GLOW" LAYER: Only apply glow to SEVERE and HIGH roads
      map.current.addLayer({
        id: 'roads-glow',
        type: 'line',
        source: 'roads',
        filter: ['in', ['get', 'current_risk_level'], ['literal', ['SEVERE', 'HIGH']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width': 16,
          'line-blur': 10,
          'line-opacity': 0.6,
          'line-color': '#ef4444',
        },
      });

      // THE MAIN INCIDENT LAYER: Make LOW and MODERATE roads visible again
      map.current.addLayer({
        id: 'roads-layer',
        type: 'line',
        source: 'roads',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width': 6,
          'line-color': [
            'match',
            ['get', 'current_risk_level'],
            'SEVERE',
            '#ef4444',
            'HIGH',
            '#f97316',
            'MODERATE',
            '#eab308',
            'LOW',
            '#22c55e',
            '#94a3b8',
          ],
        },
      });

      // MAP CLICK ROUTER
      map.current.on('click', (e) => {
        if (!map.current) return;
        const features = map.current.queryRenderedFeatures(e.point, { layers: ['roads-layer'] });

        // Clicked existing flood risk road
        if (features.length > 0) {
          setSelectedRoad(features[0].properties);
          setSelectedPinCoords(null);
          if (selectedPinMarker.current) selectedPinMarker.current.remove();
          return;
        }

        // Clicked map empty space
        setSelectedRoad(null);
        setSelectedPinCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });

        // Clean drop pin
        const pinElement = document.createElement('div');
        pinElement.className = 'w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform';
        pinElement.innerHTML = `
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M12 21s-6-5.33-6-10a6 6 0 1112 0c0 4.67-6 10-6 10z"></path>
          </svg>
        `;

        if (selectedPinMarker.current) selectedPinMarker.current.remove();
        selectedPinMarker.current = new maplibregl.Marker({
          element: pinElement,
          anchor: 'bottom',
        })
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .addTo(map.current);
      });

      // Fetch dynamic roads data
      const fetchRoads = async () => {
        const bounds = map.current?.getBounds();
        if (!bounds) return;
        const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
        try {
          const res = await fetch(`/api/risk/area?bbox=${bbox}`);
          const data = await res.json();
          if (map.current?.getSource('roads')) {
            (map.current.getSource('roads') as maplibregl.GeoJSONSource).setData(data);
          }
        } catch (err) {}
      };

      fetchRoads();
      map.current.on('moveend', fetchRoads);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // PROXIMITY ENGINE LOOP: Scans screen space around user's GPS for high/severe flooded roads
  useEffect(() => {
    if (!map.current || !userLoc) return;

    const checkProximity = () => {
      if (!map.current) return;

      // Project user's GPS into screen pixels
      const point = map.current.project([userLoc.lng, userLoc.lat]);

      // Create a roughly ~150 meter invisible hit box on the screen
      const hitBox = [
        [point.x - 60, point.y - 60],
        [point.x + 60, point.y + 60],
      ] as [maplibregl.PointLike, maplibregl.PointLike];

      // Query if any red/severe roads intersect this hit box
      const nearbyFeatures = map.current.queryRenderedFeatures(hitBox, {
        layers: ['roads-layer'],
      });

      // Find first severe/high hazard not already dismissed by user
      const activeHazard = nearbyFeatures.find(
        (f) =>
          (f.properties?.current_risk_level === 'SEVERE' || f.properties?.current_risk_level === 'HIGH') &&
          !dismissedAlerts.has(f.properties?.id)
      );

      if (activeHazard) {
        setNearbyAlert(activeHazard.properties);
      }
    };

    const timeout = setTimeout(checkProximity, 1000);
    return () => clearTimeout(timeout);
  }, [userLoc, dismissedAlerts]);

  const clearSelectedPin = () => {
    setSelectedPinCoords(null);
    if (selectedPinMarker.current) selectedPinMarker.current.remove();
  };

  const unreadAlertsCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="relative w-full h-full min-h-[100dvh] overflow-hidden bg-slate-900 select-none">
      {/* 1. Full-Bleed Map Canvas */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* 2. Top Navigation Bar (Clean & Uncluttered) */}
      <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex items-center justify-between gap-3 max-w-4xl mx-auto">
        {/* Search Bar */}
        <div className="flex-1 pointer-events-auto max-w-md">
          <SearchBar
            onLocationSelect={(lng, lat) => {
              map.current?.flyTo({ center: [lng, lat], zoom: 17 });
              setSelectedPinCoords({ lng, lat });
            }}
          />
        </div>

        {/* Top Controls Cluster */}
        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          {/* Status Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/90 text-xs font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Delhi NCR</span>
          </div>

          {/* Citizen Safety Hub Trigger */}
          <button
            onClick={() => setIsSafetyDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer"
            title="Citizen Safety Hub"
          >
            <Bookmark className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden xs:inline">Safety Hub</span>
            {savedLocations.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-[10px] font-black">
                {savedLocations.length}
              </span>
            )}
            {unreadAlertsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping ml-0.5"></span>
            )}
          </button>
        </div>
      </div>

      {/* On-Screen GPS Debugger Pill */}
      {gpsDebugMsg && (
        <div className="absolute top-18 left-4 right-4 z-30 max-w-sm mx-auto pointer-events-auto animate-in fade-in duration-200">
          <div
            className={`p-2 rounded-xl text-xs font-bold text-center border shadow-md backdrop-blur-md flex items-center justify-between gap-2 ${
              gpsDebugMsg.includes('Error')
                ? 'bg-red-500/95 text-white border-red-600 shadow-red-950/20'
                : gpsDebugMsg.includes('Lock')
                ? 'bg-emerald-600/95 text-white border-emerald-700 shadow-emerald-950/20'
                : 'bg-slate-900/95 text-slate-100 border-slate-700 shadow-slate-950/20'
            }`}
          >
            <span className="truncate flex-1">{gpsDebugMsg}</span>
            <button
              onClick={() => setGpsDebugMsg(null)}
              className="text-white/70 hover:text-white text-xs cursor-pointer px-1"
              title="Dismiss GPS status"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Community Radar Proximity Alert Popup */}
      {nearbyAlert && (
        <div className="absolute top-20 left-4 right-4 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-red-200 overflow-hidden animate-in fade-in slide-in-from-top duration-300 max-w-md mx-auto pointer-events-auto">
          <div className="bg-red-600 px-4 py-2.5 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 animate-pulse text-amber-300" />
              <span className="font-extrabold text-[11px] tracking-wider uppercase">COMMUNITY RADAR ALERT</span>
            </div>
            <button
              onClick={() => {
                setDismissedAlerts((prev) => new Set(prev).add(nearbyAlert.id));
                setNearbyAlert(null);
              }}
              className="text-white/80 hover:text-white cursor-pointer"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-slate-800 text-xs font-semibold mb-1">
              You are approaching a reported hazard on <span className="font-black text-slate-900">{nearbyAlert.road_name || 'this street'}</span>.
            </p>
            <p className="text-xs text-slate-500 mb-3.5">Can you verify if this area is still flooded?</p>

            <div className="flex gap-2">
              <button
                onClick={() => handleCommunityVerify('YES', nearbyAlert.id)}
                className="flex-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Still Flooded</span>
              </button>
              <button
                onClick={() => handleCommunityVerify('NO', nearbyAlert.id)}
                className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>It&apos;s Clear</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Floating Map Controls (Right Side) */}
      <div className="absolute right-4 top-24 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={flyToUser}
          className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/90 flex items-center justify-center text-slate-700 hover:text-blue-600 active:scale-95 transition-all cursor-pointer"
          title="Locate Me"
        >
          <LocateFixed className="w-4 h-4" />
        </button>

        <div className="flex flex-col bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/90 overflow-hidden">
          <button
            onClick={() => map.current?.zoomIn()}
            className="w-10 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-sm transition-colors cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <div className="w-full h-px bg-slate-200"></div>
          <button
            onClick={() => map.current?.zoomOut()}
            className="w-10 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-sm transition-colors cursor-pointer"
            title="Zoom Out"
          >
            −
          </button>
        </div>
      </div>

      {/* 4. Map Pin Action Card (When user taps anywhere on map) */}
      {selectedPinCoords && !isFloodActionsModalOpen && !isSafetyDrawerOpen && (
        <div className="absolute bottom-24 left-4 right-4 z-20 max-w-sm mx-auto pointer-events-auto animate-in slide-in-from-bottom duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Selected Map Location
                </span>
                <p className="text-xs font-mono font-bold text-slate-800">
                  {selectedPinCoords.lat.toFixed(4)}, {selectedPinCoords.lng.toFixed(4)}
                </p>
              </div>
              <button
                onClick={clearSelectedPin}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openFloodActionsWithTab('report', selectedPinCoords)}
                className="py-2.5 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Report Hazard</span>
              </button>

              <button
                onClick={() => openFloodActionsWithTab('save', selectedPinCoords)}
                className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                <span>Save Place</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Road Hazard Info Card (When user clicks flooded street) */}
      {selectedRoad && !isFloodActionsModalOpen && !isSafetyDrawerOpen && (
        <div className="absolute bottom-24 left-4 right-4 z-20 max-w-sm mx-auto pointer-events-auto animate-in slide-in-from-bottom duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-red-600 text-[10px] font-extrabold uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{selectedRoad.current_risk_level || 'SEVERE'} RISK ROAD</span>
                </div>
                <h4 className="text-sm font-black text-slate-900 mt-0.5">
                  {selectedRoad.road_name || 'Flooded Segment'}
                </h4>
              </div>
              <button
                onClick={() => setSelectedRoad(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Risk Score</span>
              <span className="font-extrabold text-red-700 font-mono">
                {selectedRoad.current_risk_score ?? 81}/100
              </span>
            </div>

            <button
              onClick={() => openFloodActionsWithTab('report')}
              className="mt-3 w-full py-2 px-3 bg-red-600 hover:bg-red-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>Submit Street Condition Report</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Clean Bottom Floating Action Bar */}
      <div className="absolute bottom-6 left-4 right-4 z-20 pointer-events-none flex items-center justify-center max-w-md mx-auto">
        <div className="pointer-events-auto flex items-center gap-2.5 w-full bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200/90">
          <button
            onClick={() => openFloodActionsWithTab('report')}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Report Flood Hazard</span>
          </button>

          <button
            onClick={() => setIsSafetyDrawerOpen(true)}
            className="py-3 px-3.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs transition-colors cursor-pointer"
            title="My Saved Places & Alerts"
          >
            <Bookmark className="w-4 h-4 text-slate-600" />
            <span>Saved ({savedLocations.length})</span>
          </button>
        </div>
      </div>

      {/* 7. Flood Actions Bottom Sheet Modal */}
      <FloodActionsModal
        isOpen={isFloodActionsModalOpen}
        onClose={() => setIsFloodActionsModalOpen(false)}
        initialTab={floodActionsTab}
        currentCoords={selectedPinCoords || userLoc || { lat: 28.6291, lng: 77.2198 }}
        onRefreshGPS={flyToUser}
        onSavePlaceSuccess={async () => {
          await refreshSafetyData();
        }}
        onReportSuccess={async () => {
          await refreshSafetyData();
        }}
        onSelectOnMap={() => {
          setIsFloodActionsModalOpen(false);
        }}
      />

      {/* 8. Citizen Safety Hub (Bottom Sheet Drawer) */}
      <SavedPlacesDrawer
        isOpen={isSafetyDrawerOpen}
        onClose={() => setIsSafetyDrawerOpen(false)}
        savedLocations={savedLocations}
        alerts={alerts}
        isLoading={isLoadingSafety}
        onAddNewPlace={() => {
          openFloodActionsWithTab('save');
        }}
        onDeletePlace={handleDeletePlace}
        onMarkAlertRead={handleMarkAlertRead}
        onMarkAllAlertsRead={handleMarkAllAlertsRead}
        onLocatePlace={handleLocatePlace}
        onLocateAlert={(alert) => {
          if (alert.longitude && alert.latitude && map.current) {
            map.current.flyTo({ center: [alert.longitude, alert.latitude], zoom: 17 });
          }
          setIsSafetyDrawerOpen(false);
        }}
      />
    </div>
  );
}