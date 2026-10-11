'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import {
  LocateFixed,
  UserCircle,
  AlertTriangle,
  Bookmark,
  Plus,
  X,
  Navigation,
  Clock,
  CheckCircle,
  XCircle,
  Wind,
} from 'lucide-react';
import SearchBar from './SearchBar';
import SavedPlacesDrawer from '../places/SavedPlacesDrawer';
import FloodActionsModal from '../modal/FloodActionsModal';
import { SavedLocation, UserAlert } from '@/types/db';

if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre-gl-worker.mjs');
}

export interface Incident {
  id: string;
  road_name: string;
  lng: number;
  lat: number;
  severity?: string | number;
  depth?: number;
  time?: string;
  image_url?: string;
}

// Helper to generate a realistic looking AQI scatter plot for the MapLibre heatmap
const generateMockAqiGrid = (lng: number, lat: number, baseAqi: number) => {
  const features = [];
  for (let i = 0; i < 50; i++) {
    const dLng = (Math.random() - 0.5) * 0.15;
    const dLat = (Math.random() - 0.5) * 0.15;
    const variance = (Math.random() - 0.5) * 60;
    features.push({
      type: 'Feature' as const,
      properties: { aqi: Math.max(0, baseAqi + variance) },
      geometry: {
        type: 'Point' as const,
        coordinates: [lng + dLng, lat + dLat],
      },
    });
  }
  return { type: 'FeatureCollection' as const, features };
};

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const selectedPinMarker = useRef<maplibregl.Marker | null>(null);
  const incidentMarkers = useRef<{ [key: string]: maplibregl.Marker }>({});
  const savedPlaceMarkers = useRef<maplibregl.Marker[]>([]);
  const watchIdRef = useRef<number | null>(null);

  const [userLoc, setUserLoc] = useState<{ lng: number; lat: number } | null>(null);
  const [selectedPinCoords, setSelectedPinCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [gpsDebugMsg, setGpsDebugMsg] = useState<string | null>('Locating...');

  // UI State Controls
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isSafetyDrawerOpen, setIsSafetyDrawerOpen] = useState(false);
  const [isFloodActionsModalOpen, setIsFloodActionsModalOpen] = useState(false);
  const [floodActionsTab, setFloodActionsTab] = useState<'report' | 'save'>('report');

  // Safety Hub data
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [isLoadingSafety, setIsLoadingSafety] = useState(false);

  // Proximity Alert State
  const [nearbyAlert, setNearbyAlert] = useState<Incident | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);

  // Air Quality States
  const [aqiData, setAqiData] = useState<number | null>(null);
  const [showAqiLayer, setShowAqiLayer] = useState(false);

  // Fetch Live Air Quality (Open-Meteo AQI)
  useEffect(() => {
    const lat = userLoc?.lat || 28.6315;
    const lng = userLoc?.lng || 77.2167;
    const fetchLiveAQI = async () => {
      try {
        const res = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi`
        );
        const data = await res.json();
        if (data?.current?.us_aqi !== undefined) {
          setAqiData(data.current.us_aqi);
        } else {
          setAqiData(215); // Fallback for New Delhi area
        }
      } catch (err) {
        console.warn('AQI Fetch Error, using local fallback:', err);
        setAqiData(215);
      }
    };
    fetchLiveAQI();
  }, [userLoc]);

  // Update AQI GeoJSON source data when AQI data or location is ready
  useEffect(() => {
    if (!map.current || aqiData === null) return;
    const source = map.current.getSource('aqi-source') as maplibregl.GeoJSONSource | undefined;
    if (source && typeof source.setData === 'function') {
      const lng = userLoc?.lng || 77.2167;
      const lat = userLoc?.lat || 28.6315;
      source.setData(generateMockAqiGrid(lng, lat, aqiData) as any);
    }
  }, [aqiData, userLoc]);

  // Toggle MapLibre AQI Heatmap Layer visibility
  useEffect(() => {
    if (!map.current || !map.current.getLayer('aqi-heatmap')) return;
    map.current.setLayoutProperty('aqi-heatmap', 'visibility', showAqiLayer ? 'visible' : 'none');
  }, [showAqiLayer]);

  // Fetch Live Community Incidents
  const refreshIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/active');
      if (res.ok) {
        const data = await res.json();
        setActiveIncidents(data.incidents || []);
      }
    } catch (err) {
      console.warn('Error fetching active incidents:', err);
    }
  }, []);

  useEffect(() => {
    refreshIncidents();
  }, [refreshIncidents]);

  // Load Saved Locations & Alerts
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
      console.warn('Error fetching safety data:', err);
    } finally {
      setIsLoadingSafety(false);
    }
  }, []);

  useEffect(() => {
    refreshSafetyData();
  }, [refreshSafetyData]);

  // Community Verification Handler
  const handleCommunityVerify = async (status: 'YES' | 'NO', incidentId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(incidentId));
    setNearbyAlert(null);

    if (status === 'NO') {
      if (incidentMarkers.current[incidentId]) {
        incidentMarkers.current[incidentId].remove();
        delete incidentMarkers.current[incidentId];
      }
      setActiveIncidents((prev) => prev.filter((inc) => inc.id !== incidentId));
      setSelectedIncident(null);

      try {
        await fetch('/api/reports/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'DISMISS', reportId: incidentId }),
        });
      } catch (e) {
        console.warn('Community dismissal logged locally', e);
      }
    } else {
      try {
        await fetch('/api/reports/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'CONFIRM', reportId: incidentId }),
        });
      } catch (e) {
        console.warn('Community confirm logged locally', e);
      }
    }
  };

  // Robust GPS Requester
  const requestLocation = useCallback((isUserGesture = false, fly = true) => {
    if (!('geolocation' in navigator)) {
      setGpsDebugMsg('GPS Unsupported');
      if (isUserGesture) alert('Geolocation is not supported by this browser.');
      return;
    }

    setGpsDebugMsg('Acquiring GPS Fix...');

    const queryPosition = (highAccuracy: boolean, timeout: number) => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout,
          maximumAge: 30000,
        });
      });
    };

    const onGotPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setUserLoc({ lng: longitude, lat: latitude });
      setGpsDebugMsg(`GPS Active (±${Math.round(accuracy)}m)`);

      const currentMap = map.current;
      if (currentMap) {
        if (fly) {
          currentMap.flyTo({ center: [longitude, latitude], zoom: 17, essential: true });
        }

        if (!userMarker.current) {
          const dot = document.createElement('div');
          dot.className =
            'w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_20px_rgba(59,130,246,0.9)] animate-pulse';
          userMarker.current = new maplibregl.Marker({ element: dot })
            .setLngLat([longitude, latitude])
            .addTo(currentMap);
        } else {
          userMarker.current.setLngLat([longitude, latitude]);
        }
      }

      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (p) => {
            const { latitude: lat, longitude: lng, accuracy: acc } = p.coords;
            setUserLoc({ lng, lat });
            setGpsDebugMsg(`GPS Active (±${Math.round(acc)}m)`);
            if (userMarker.current) {
              userMarker.current.setLngLat([lng, lat]);
            }
          },
          (err) => {
            if (err.code === 1) setGpsDebugMsg('GPS Blocked');
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
        );
      }
    };

    queryPosition(true, 8000)
      .then(onGotPosition)
      .catch((err: GeolocationPositionError) => {
        if (err.code === 1) {
          setGpsDebugMsg('GPS Blocked (Tap URL bar to allow)');
        } else {
          queryPosition(false, 10000)
            .then(onGotPosition)
            .catch((fallbackErr: GeolocationPositionError) => {
              if (fallbackErr.code === 1) {
                setGpsDebugMsg('GPS Blocked');
              } else if (fallbackErr.code === 3) {
                setGpsDebugMsg('GPS Timed Out (Tap to Retry)');
              } else {
                setGpsDebugMsg('GPS Unavailable');
              }
            });
        }
      });
  }, []);

  // Recenter GPS
  const flyToUser = () => {
    if (userLoc && map.current) {
      map.current.flyTo({ center: [userLoc.lng, userLoc.lat], zoom: 17, essential: true });
    } else {
      requestLocation(true, true);
    }
  };

  // Open Flood Actions modal with chosen tab and coordinates
  const openFloodActionsWithTab = (tab: 'report' | 'save', coords?: { lng: number; lat: number }) => {
    setFloodActionsTab(tab);
    if (coords) setSelectedPinCoords(coords);
    setIsFloodActionsModalOpen(true);
  };

  const clearSelectedPin = () => {
    setSelectedPinCoords(null);
    if (selectedPinMarker.current) {
      selectedPinMarker.current.remove();
      selectedPinMarker.current = null;
    }
  };

  // Map Initialization
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const initializedMap = new maplibregl.Map({
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
      center: [77.2167, 28.6315],
      zoom: 15,
      attributionControl: false,
    });

    map.current = initializedMap;

    initializedMap.on('load', () => {
      requestLocation(false, true);

      // ADD AQI HEATMAP LAYER (Hidden by default, toggleable via AQI pill)
      initializedMap.addSource('aqi-source', {
        type: 'geojson',
        data: generateMockAqiGrid(77.2167, 28.6315, aqiData || 215),
      });

      initializedMap.addLayer({
        id: 'aqi-heatmap',
        type: 'heatmap',
        source: 'aqi-source',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'aqi'], 0, 0, 300, 1],
          'heatmap-intensity': 1.2,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)',
            0.2,
            'rgb(103,169,207)',
            0.4,
            'rgb(209,229,240)',
            0.6,
            'rgb(253,219,199)',
            0.8,
            'rgb(239,138,98)',
            1,
            'rgb(178,24,43)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 20, 15, 60],
          'heatmap-opacity': 0.7,
        },
      });

      // Map Click: Drops selected map location pin and displays action card
      initializedMap.on('click', (e) => {
        setSelectedIncident(null);
        const { lng, lat } = e.lngLat;
        setSelectedPinCoords({ lng, lat });

        const pinElement = document.createElement('div');
        pinElement.innerHTML = `
          <div class="w-9 h-9 bg-slate-900 rounded-full flex items-center justify-center shadow-xl border-2 border-white transform transition-transform animate-bounce cursor-pointer">
            <span class="text-white font-black text-lg">!</span>
          </div>
        `;

        if (selectedPinMarker.current) selectedPinMarker.current.remove();
        selectedPinMarker.current = new maplibregl.Marker({ element: pinElement, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(initializedMap);
      });
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.current?.remove();
      map.current = null;
    };
  }, [requestLocation, aqiData]);

  // Synchronize Active Incident SVG Markers
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance) return;

    const activeIds = new Set(activeIncidents.map((i) => i.id));
    Object.keys(incidentMarkers.current).forEach((id) => {
      if (!activeIds.has(id)) {
        incidentMarkers.current[id].remove();
        delete incidentMarkers.current[id];
      }
    });

    activeIncidents.forEach((incident) => {
      if (incidentMarkers.current[incident.id]) return;

      const el = document.createElement('div');
      el.innerHTML = `
        <div class="relative flex items-center justify-center w-14 h-14 cursor-pointer group">
          <div class="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-50"></div>
          <svg xmlns="http://www.w3.org/2000/svg" class="relative z-10 w-10 h-10 drop-shadow-xl transform group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="#ef4444" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <path d="M12 7v5M12 15h.01" stroke="white" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
      `;

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setSelectedIncident(incident);
        clearSelectedPin();
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([incident.lng, incident.lat])
        .addTo(mapInstance);

      incidentMarkers.current[incident.id] = marker;
    });
  }, [activeIncidents]);

  // Synchronize Saved Places on Map
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance) return;

    savedPlaceMarkers.current.forEach((m) => m.remove());
    savedPlaceMarkers.current = [];

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
        if (place.latitude && place.longitude) {
          mapInstance.flyTo({ center: [place.longitude, place.latitude], zoom: 17, essential: true });
        }
      });

      if (place.latitude && place.longitude) {
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([place.longitude, place.latitude])
          .addTo(mapInstance);
        savedPlaceMarkers.current.push(marker);
      }
    });
  }, [savedLocations]);

  // Proximity Radar Alert Engine
  useEffect(() => {
    if (!map.current || !userLoc) return;

    const checkProximity = () => {
      if (!map.current) return;

      const userPt = map.current.project([userLoc.lng, userLoc.lat]);

      const activeHazard = activeIncidents.find((inc) => {
        if (dismissedAlerts.has(inc.id)) return false;

        const incPt = map.current!.project([inc.lng, inc.lat]);
        const distance = Math.sqrt(Math.pow(incPt.x - userPt.x, 2) + Math.pow(incPt.y - userPt.y, 2));
        return distance < 100;
      });

      if (activeHazard) setNearbyAlert(activeHazard);
    };

    const timeout = setTimeout(checkProximity, 1500);
    return () => clearTimeout(timeout);
  }, [userLoc, dismissedAlerts, activeIncidents]);

  // UI Helpers: AQI Colors & Quality Descriptor
  const getAqiColor = (aqi: number) => {
    if (aqi <= 50) return 'bg-emerald-500 text-white border-emerald-600';
    if (aqi <= 100) return 'bg-yellow-400 text-yellow-950 border-yellow-500';
    if (aqi <= 150) return 'bg-orange-500 text-white border-orange-600';
    if (aqi <= 200) return 'bg-red-500 text-white border-red-600';
    return 'bg-purple-600 text-white border-purple-700';
  };

  const getAqiText = (aqi: number) => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy (Sensitive)';
    if (aqi <= 200) return 'Unhealthy';
    return 'Hazardous';
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* TOP NAVIGATION OVERLAY */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex flex-col gap-2 pointer-events-none max-w-xl mx-auto">
        {/* Row 1: Search & Desktop Saved Button & Profile */}
        <div className="flex items-center gap-2">
          <div className="flex-1 pointer-events-auto">
            <SearchBar
              onLocationSelect={(lng, lat) => {
                if (map.current) {
                  map.current.flyTo({ center: [lng, lat], zoom: 17, essential: true });
                }
              }}
            />
          </div>

          {/* Desktop/Tablet: Saved button just right to the search bar */}
          <button
            onClick={() => setIsSafetyDrawerOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-3 bg-white rounded-2xl shadow-lg border border-slate-200 pointer-events-auto font-bold text-xs text-slate-800 hover:bg-slate-50 transition-all cursor-pointer shrink-0"
            title="Saved Places & Alerts"
          >
            <Bookmark className="w-4 h-4 text-blue-600" />
            <span>Saved ({savedLocations.length})</span>
          </button>

          {/* User profile avatar */}
          <button
            onClick={() => setIsSafetyDrawerOpen(true)}
            className="w-12 h-12 bg-white rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center pointer-events-auto shrink-0 bg-opacity-90 backdrop-blur hover:bg-slate-50 transition-colors cursor-pointer"
            title="Saved Places & Alerts"
          >
            <UserCircle className="w-7 h-7 text-slate-700" />
          </button>
        </div>

        {/* Mobile (<sm): small Saved button just below the search bar */}
        <div className="flex sm:hidden justify-start pointer-events-auto">
          <button
            onClick={() => setIsSafetyDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 font-bold text-xs text-slate-800 active:scale-95 transition-all cursor-pointer"
            title="Saved Places & Alerts"
          >
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            <span>Saved ({savedLocations.length})</span>
          </button>
        </div>
      </div>

      {/* GPS Status Pill */}
      <div className="absolute top-28 left-4 right-4 z-20 pointer-events-none flex justify-center">
        <button
          onClick={() => requestLocation(true, true)}
          className="pointer-events-auto p-2 rounded-lg text-xs font-bold text-center border shadow-md bg-white/80 backdrop-blur text-slate-700 w-max mx-auto hover:bg-white active:scale-95 transition-all cursor-pointer"
        >
          {gpsDebugMsg}
        </button>
      </div>

      {/* IN-APP PROXIMITY NOTIFICATION POP-UP */}
      {nearbyAlert && (
        <div className="absolute top-36 left-4 right-4 z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up max-w-md mx-auto">
          <div className="bg-red-500 p-3 text-white flex items-center">
            <AlertTriangle className="w-6 h-6 mr-3 animate-pulse" />
            <span className="font-bold tracking-wide">COMMUNITY RADAR ALERT</span>
          </div>
          <div className="p-5">
            <p className="text-slate-700 font-medium mb-1">
              Approaching hazard on <span className="font-black text-slate-900">{nearbyAlert.road_name}</span>.
            </p>
            <p className="text-sm text-slate-500 mb-5">Is this area still flooded?</p>

            <div className="flex gap-3">
              <button
                onClick={() => handleCommunityVerify('YES', nearbyAlert.id)}
                className="flex-1 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 font-bold py-3 rounded-xl transition-colors flex justify-center items-center cursor-pointer"
              >
                <CheckCircle className="w-5 h-5 mr-2" /> Still Flooded
              </button>
              <button
                onClick={() => handleCommunityVerify('NO', nearbyAlert.id)}
                className="flex-1 bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 font-bold py-3 rounded-xl transition-colors flex justify-center items-center cursor-pointer"
              >
                <XCircle className="w-5 h-5 mr-2" /> It&apos;s Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Recenter GPS, Zoom, AQI & Action Button Controls */}
      <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-2 pointer-events-auto items-center">
        {/* Exclamation Mark Action Button (Appears at top when location is clicked, without bounce animation) */}
        {selectedPinCoords && !isFloodActionsModalOpen && (
          <button
            onClick={() => openFloodActionsWithTab('report', selectedPinCoords)}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl shadow-xl border-2 border-white flex flex-col items-center justify-center transition-all cursor-pointer"
            title="Open Flood Actions for Selected Location"
          >
            <span className="text-xl font-black leading-none select-none">!</span>
            <span className="text-[7px] font-black uppercase tracking-tight leading-none mt-0.5">Action</span>
          </button>
        )}

        <button
          onClick={flyToUser}
          className="w-12 h-12 bg-white text-blue-600 rounded-2xl shadow-lg border border-slate-200 hover:bg-blue-50 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
          title="Locate Me"
        >
          <LocateFixed className="w-5 h-5" />
        </button>

        <div className="flex flex-col bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => map.current?.zoomIn()}
            className="w-12 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-base transition-colors cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <div className="w-full h-px bg-slate-200" />
          <button
            onClick={() => map.current?.zoomOut()}
            className="w-12 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-base transition-colors cursor-pointer"
            title="Zoom Out"
          >
            −
          </button>
        </div>

        {/* AQI Heatmap Layer Toggle Button */}
        <button
          onClick={() => setShowAqiLayer((prev) => !prev)}
          className={`w-12 h-12 rounded-2xl shadow-lg border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
            showAqiLayer
              ? 'bg-blue-600 text-white border-blue-700 shadow-blue-500/30 ring-2 ring-blue-400'
              : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
          }`}
          title={showAqiLayer ? 'Hide Air Quality Heatmap' : 'Show Air Quality Heatmap'}
        >
          <div className="relative flex items-center justify-center">
            <Wind className={`w-3.5 h-3.5 ${showAqiLayer ? 'text-white' : 'text-slate-600'}`} />
            {aqiData !== null && (
              <span
                className={`absolute -top-1 -right-2 w-2 h-2 rounded-full border border-white ${
                  aqiData <= 50
                    ? 'bg-emerald-500'
                    : aqiData <= 100
                    ? 'bg-yellow-400'
                    : aqiData <= 150
                    ? 'bg-orange-500'
                    : aqiData <= 200
                    ? 'bg-red-500'
                    : 'bg-purple-600'
                }`}
              />
            )}
          </div>
          <span className={`text-[10px] font-black font-mono leading-none mt-1 ${showAqiLayer ? 'text-white' : 'text-slate-900'}`}>
            {aqiData !== null ? aqiData : 'AQI'}
          </span>
          <span className={`text-[7px] font-extrabold uppercase tracking-wider leading-none mt-0.5 ${showAqiLayer ? 'text-blue-100' : 'text-slate-400'}`}>
            AQI
          </span>
        </button>
      </div>

      {/* INCIDENT INFO CARD (When user clicks flooded hazard pin) */}
      {selectedIncident && !isFloodActionsModalOpen && !isSafetyDrawerOpen && (
        <div className="absolute bottom-24 left-4 right-4 z-20 max-w-sm mx-auto pointer-events-auto animate-slide-up">
          <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-red-600 text-[10px] font-extrabold uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>COMMUNITY REPORTED HAZARD</span>
                </div>
                <h4 className="text-sm font-black text-slate-900 mt-0.5">
                  {selectedIncident.road_name || 'Flooded Segment'}
                </h4>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-3 mt-3 items-center">
              {selectedIncident.image_url ? (
                <div className="w-16 h-16 bg-slate-200 rounded-xl overflow-hidden shrink-0 relative">
                  <img
                    src={selectedIncident.image_url}
                    alt="Flood Evidence"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-xl flex flex-col items-center justify-center shrink-0 text-red-500">
                  <AlertTriangle className="w-6 h-6 mb-0.5" />
                  <span className="text-[9px] font-black uppercase">Alert</span>
                </div>
              )}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center text-xs text-slate-600 bg-slate-50 p-1.5 rounded-lg">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                  <span>{selectedIncident.time || 'Reported recently'}</span>
                </div>
                <div className="flex items-center text-xs text-slate-600 bg-slate-50 p-1.5 rounded-lg">
                  <Navigation className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                  <span>Verified by Citizens</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOOD ACTIONS MODAL (Dual Tab: Report Flood & Save Place) */}
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
          await refreshIncidents();
          await refreshSafetyData();
        }}
        onSelectOnMap={() => {
          setIsFloodActionsModalOpen(false);
        }}
      />

      {/* CITIZEN SAFETY HUB (Saved Places & Alerts Drawer) */}
      <SavedPlacesDrawer
        isOpen={isSafetyDrawerOpen}
        onClose={() => setIsSafetyDrawerOpen(false)}
        savedLocations={savedLocations}
        alerts={alerts}
        isLoading={isLoadingSafety}
        onAddNewPlace={() => openFloodActionsWithTab('save')}
        onDeletePlace={async (id) => {
          const res = await fetch(`/api/user/saved-locations/${id}`, { method: 'DELETE' });
          if (res.ok) await refreshSafetyData();
        }}
        onMarkAlertRead={async (alertId) => {
          await fetch(`/api/user/alerts/${alertId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_read: true }),
          });
          await refreshSafetyData();
        }}
        onMarkAllAlertsRead={async () => {
          await fetch('/api/user/alerts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mark_all: true }),
          });
          await refreshSafetyData();
        }}
        onLocatePlace={(lat, lng) => {
          if (map.current) {
            map.current.flyTo({ center: [lng, lat], zoom: 17, essential: true });
          }
          setIsSafetyDrawerOpen(false);
        }}
        onLocateAlert={(alert) => {
          if (alert.longitude && alert.latitude && map.current) {
            map.current.flyTo({ center: [alert.longitude, alert.latitude], zoom: 17, essential: true });
          }
          setIsSafetyDrawerOpen(false);
        }}
      />
    </div>
  );
}