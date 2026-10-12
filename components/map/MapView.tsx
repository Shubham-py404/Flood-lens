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
  Route as RouteIcon,
  Compass,
} from 'lucide-react';
import SearchBar from './SearchBar';
import SavedPlacesDrawer from '../places/SavedPlacesDrawer';
import FloodActionsModal from '../modal/FloodActionsModal';
import AreaBriefPanel, { RouteOption, LocationReportBrief } from './AreaBriefPanel';
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

// Helper to generate a realistic looking AQI scatter plot around the area with realistic microclimate gradients
const generateMockAqiGrid = (lng: number, lat: number, baseAqi: number) => {
  const features = [];
  // Generate multi-tiered radial distribution of atmospheric sensor points
  const rings = [
    { count: 18, radius: 0.04, variance: 25 },
    { count: 32, radius: 0.10, variance: 45 },
    { count: 40, radius: 0.20, variance: 65 },
  ];

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * 2 * Math.PI + (Math.random() - 0.5) * 0.3;
      const dist = ring.radius * (0.6 + Math.random() * 0.8);
      const dLng = Math.cos(angle) * dist;
      const dLat = Math.sin(angle) * dist;
      
      // Micro-climate variation based on geographic dispersion
      const variance = (Math.random() - 0.45) * ring.variance;
      const calculatedAqi = Math.max(15, Math.min(480, Math.round(baseAqi + variance)));

      features.push({
        type: 'Feature' as const,
        properties: { 
          aqi: calculatedAqi,
          // Normalized weight 0.0 to 1.0 mapped to AQI scale (0 to 350+)
          weight: Math.min(1.0, Math.max(0.1, calculatedAqi / 300)),
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [lng + dLng, lat + dLat],
        },
      });
    }
  }

  // Also include the exact center point
  features.push({
    type: 'Feature' as const,
    properties: { 
      aqi: baseAqi, 
      weight: Math.min(1.0, Math.max(0.1, baseAqi / 300)) 
    },
    geometry: {
      type: 'Point' as const,
      coordinates: [lng, lat],
    },
  });

  return { type: 'FeatureCollection' as const, features };
};

export interface MapViewProps {
  targetLocation?: { lat: number; lng: number; title?: string } | null;
  initialShowAqiLayer?: boolean;
  liveAqi?: number | null;
  initialUserCoords?: { lat: number; lng: number } | null;
}

export default function MapView({ targetLocation, initialShowAqiLayer, liveAqi, initialUserCoords }: MapViewProps = {}) {
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
  const [isActionPlacementMode, setIsActionPlacementMode] = useState(false);
  const isActionPlacementModeRef = useRef(false);

  // Keep isActionPlacementModeRef in sync
  useEffect(() => {
    isActionPlacementModeRef.current = isActionPlacementMode;
  }, [isActionPlacementMode]);

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

  const searchTargetMarker = useRef<maplibregl.Marker | null>(null);

  // Air Quality States
  const [aqiData, setAqiData] = useState<number | null>(liveAqi || null);
  const [showAqiLayer, setShowAqiLayer] = useState(false);

  // Searched Location Brief & Safe Routing States
  const [searchedTarget, setSearchedTarget] = useState<{
    name: string;
    lng: number;
    lat: number;
    aqi?: number | null;
    hazards: LocationReportBrief[];
  } | null>(null);
  const [plannedRoutes, setPlannedRoutes] = useState<RouteOption[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [selectedRouteType, setSelectedRouteType] = useState<string | null>(null);
  const [activeNavigationRoute, setActiveNavigationRoute] = useState<{
    route: RouteOption;
    destinationName: string;
    destinationCoords: { lat: number; lng: number };
    hazards: LocationReportBrief[];
  } | null>(null);

  // Sync external live AQI prop if available
  useEffect(() => {
    if (liveAqi !== undefined && liveAqi !== null) {
      setAqiData(liveAqi);
    }
  }, [liveAqi]);

  // Sync external user coordinates prop if available (from browser GPS or IP geo)
  useEffect(() => {
    if (initialUserCoords) {
      setUserLoc((prev) => {
        if (!prev || prev.lat !== initialUserCoords.lat || prev.lng !== initialUserCoords.lng) {
          return { lng: initialUserCoords.lng, lat: initialUserCoords.lat };
        }
        return prev;
      });
    }
  }, [initialUserCoords]);

  // Sync external heatmap toggle trigger (e.g. from AirQualityView "View Heatmap on Map" button)
  useEffect(() => {
    if (initialShowAqiLayer !== undefined) {
      setShowAqiLayer(initialShowAqiLayer);
      if (initialShowAqiLayer && map.current) {
        // Automatically focus on current observation zone
        const targetLng = userLoc?.lng || (targetLocation ? targetLocation.lng : 77.2167);
        const targetLat = userLoc?.lat || (targetLocation ? targetLocation.lat : 28.6315);
        map.current.flyTo({ center: [targetLng, targetLat], zoom: 14, essential: true });
      }
    }
  }, [initialShowAqiLayer, userLoc, targetLocation]);

  // Fetch Live Air Quality (calls internal dynamic endpoint with local standard)
  useEffect(() => {
    const lat = userLoc?.lat || 28.6315;
    const lng = userLoc?.lng || 77.2167;
    const fetchLiveAQI = async () => {
      try {
        const res = await fetch(`/api/air-quality?lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = await res.json();
          const dynamicAqi = data.indian_aqi || data.aqi;
          if (dynamicAqi !== undefined && dynamicAqi !== null) {
            setAqiData(dynamicAqi);
            return;
          }
        }
        if (liveAqi) {
          setAqiData(liveAqi);
        }
      } catch (err) {
        console.warn('AQI Fetch Error, using live prop:', err);
        if (liveAqi) setAqiData(liveAqi);
      }
    };
    fetchLiveAQI();
  }, [userLoc, liveAqi]);

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

  // Focus and spotlight on map when targetLocation is passed from Insights or external trigger
  useEffect(() => {
    if (!targetLocation || !map.current) return;
    const { lng, lat, title } = targetLocation;
    map.current.flyTo({ center: [lng, lat], zoom: 17, essential: true });

    setSelectedPinCoords({ lng, lat });

    const pinElement = document.createElement('div');
    pinElement.innerHTML = `
      <div class="relative flex flex-col items-center cursor-pointer group">
        <div class="px-2.5 py-1 bg-slate-900/95 backdrop-blur-md text-white text-[11px] font-black rounded-xl shadow-lg border border-white/80 mb-1 max-w-[160px] truncate text-center">
          ${title || 'Reported Hazard'}
        </div>
        <div class="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center shadow-2xl border-2 border-white transform transition-transform animate-bounce">
          <span class="text-white font-black text-base">!</span>
        </div>
      </div>
    `;

    if (selectedPinMarker.current) selectedPinMarker.current.remove();
    selectedPinMarker.current = new maplibregl.Marker({ element: pinElement, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map.current);

    // If matches any active incident, select it to show bottom card
    const matched = activeIncidents.find(
      (inc) => Math.abs(inc.lat - lat) < 0.0005 && Math.abs(inc.lng - lng) < 0.0005
    );
    if (matched) {
      setSelectedIncident(matched);
    } else if (title) {
      setSelectedIncident({
        id: `target-${Date.now()}`,
        road_name: title,
        lat,
        lng,
        time: 'Locating requested spot',
      });
    }
  }, [targetLocation, activeIncidents]);

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

  // Dedicated effect to maintain the user location marker on the map whenever userLoc or map updates
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !userLoc) return;

    if (!userMarker.current) {
      const container = document.createElement('div');
      container.className = 'relative flex items-center justify-center pointer-events-none z-30';
      container.style.width = '40px';
      container.style.height = '40px';

      // Outer radar pulse
      const pulseRing = document.createElement('div');
      pulseRing.className = 'absolute inset-0 rounded-full bg-blue-500/35 animate-ping';
      container.appendChild(pulseRing);

      // Middle halo
      const halo = document.createElement('div');
      halo.className = 'absolute w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/50 shadow-sm';
      container.appendChild(halo);

      // Directional pointer / blue dot
      const centerDot = document.createElement('div');
      centerDot.className = 'relative z-10 w-5 h-5 bg-blue-600 border-[2.5px] border-white rounded-full shadow-[0_0_16px_rgba(37,99,235,1)] flex items-center justify-center';
      
      const innerCore = document.createElement('div');
      innerCore.className = 'w-1.5 h-1.5 bg-white rounded-full';
      centerDot.appendChild(innerCore);

      container.appendChild(centerDot);

      userMarker.current = new maplibregl.Marker({ element: container, anchor: 'center' })
        .setLngLat([userLoc.lng, userLoc.lat])
        .addTo(currentMap);
    } else {
      userMarker.current.setLngLat([userLoc.lng, userLoc.lat]);
    }
  }, [userLoc]);

  // Robust GPS Requester with automatic IP Geolocation fallback
  const requestLocation = useCallback((isUserGesture = false, fly = true) => {
    const fallbackToIp = async () => {
      try {
        const ipRes = await fetch('/api/geo/ip');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.lat && ipData.lng) {
            setUserLoc({ lng: ipData.lng, lat: ipData.lat });
            setGpsDebugMsg(`IP Location (${ipData.city || 'Local'})`);
            if (map.current && fly) {
              map.current.flyTo({ center: [ipData.lng, ipData.lat], zoom: 15, essential: true });
            }
            return;
          }
        }
      } catch (err) {
        console.warn('IP fallback failed:', err);
      }
      setGpsDebugMsg('GPS Unavailable');
    };

    if (!('geolocation' in navigator)) {
      setGpsDebugMsg('GPS Unsupported');
      fallbackToIp();
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
      if (currentMap && fly) {
        currentMap.flyTo({ center: [longitude, latitude], zoom: 17, essential: true });
      }

      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (p) => {
            const { latitude: lat, longitude: lng, accuracy: acc } = p.coords;
            setUserLoc({ lng, lat });
            setGpsDebugMsg(`GPS Active (±${Math.round(acc)}m)`);
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
          fallbackToIp();
        } else {
          queryPosition(false, 10000)
            .then(onGotPosition)
            .catch((fallbackErr: GeolocationPositionError) => {
              if (fallbackErr.code === 1) {
                setGpsDebugMsg('GPS Blocked');
              } else if (fallbackErr.code === 3) {
                setGpsDebugMsg('GPS Timed Out');
              }
              fallbackToIp();
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
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.1, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 1.0, 15, 2.2],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(34, 197, 94, 0)',       // Transparent base
            0.15,
            'rgba(34, 197, 94, 0.55)',    // Good: Emerald Green (#22c55e)
            0.35,
            'rgba(132, 204, 22, 0.65)',   // Satisfactory: Lime Green (#84cc16)
            0.55,
            'rgba(234, 179, 8, 0.75)',    // Moderate: Warm Amber (#eab308)
            0.72,
            'rgba(249, 115, 22, 0.85)',   // Poor / High: Orange (#f97316)
            0.88,
            'rgba(239, 68, 68, 0.90)',    // Very Poor / Severe: Bright Red (#ef4444)
            1.0,
            'rgba(147, 51, 234, 0.95)',   // Severe / Hazardous: Purple (#9333ea)
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 25, 14, 55, 18, 90],
          'heatmap-opacity': 0.78,
        },
      });

      // ADD DYNAMIC ROUTE LINE LAYER (For Safe Routing)
      initializedMap.addSource('route-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      initializedMap.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'route-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 8,
          'line-opacity': 0.85,
        },
      });

      initializedMap.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5,
          'line-opacity': 0.95,
        },
      });

      // Map Click: Drops selected map location pin ONLY when Add Action mode is active
      initializedMap.on('click', (e) => {
        setSelectedIncident(null);
        
        // If not in Add Action placement mode, clicking map just deselects active incident
        if (!isActionPlacementModeRef.current) {
          return;
        }

        const { lng, lat } = e.lngLat;
        setSelectedPinCoords({ lng, lat });

        const pinElement = document.createElement('div');
        pinElement.innerHTML = `
          <div class="w-10 h-10 bg-[#244837] rounded-full flex items-center justify-center shadow-2xl border-2 border-white transform transition-transform animate-bounce cursor-pointer">
            <span class="text-white font-black text-xl">!</span>
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

      // Dynamic color configuration based on incident severity range
      const sev = String(incident.severity || 'MODERATE').toUpperCase();
      let markerColor = '#eab308'; // Amber for MODERATE
      let pingColor = 'bg-amber-400';
      let haloColor = 'rgba(234, 179, 8, 0.45)';

      if (sev === 'SEVERE') {
        markerColor = '#ef4444'; // Red for SEVERE
        pingColor = 'bg-red-500';
        haloColor = 'rgba(239, 68, 68, 0.5)';
      } else if (sev === 'HIGH') {
        markerColor = '#f97316'; // Orange for HIGH
        pingColor = 'bg-orange-500';
        haloColor = 'rgba(249, 115, 22, 0.45)';
      } else if (sev === 'LOW') {
        markerColor = '#22c55e'; // Green for LOW
        pingColor = 'bg-emerald-400';
        haloColor = 'rgba(34, 197, 94, 0.4)';
      }

      const el = document.createElement('div');
      el.innerHTML = `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-9 h-9 drop-shadow-lg transform group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="${markerColor}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
      const riskLevel = String(place.nearest_road_risk_level || 'LOW').toUpperCase();
      
      let badgeStyle = 'border-emerald-300 text-emerald-800 hover:border-emerald-500 bg-white/95';
      if (riskLevel === 'SEVERE') {
        badgeStyle = 'border-rose-400 text-rose-700 hover:border-rose-600 bg-rose-50/90';
      } else if (riskLevel === 'HIGH') {
        badgeStyle = 'border-orange-400 text-orange-700 hover:border-orange-600 bg-orange-50/90';
      } else if (riskLevel === 'MODERATE') {
        badgeStyle = 'border-amber-400 text-amber-700 hover:border-amber-600 bg-amber-50/90';
      }

      el.className =
        `flex items-center gap-1.5 px-2.5 py-1 backdrop-blur-xs border rounded-full shadow-md text-xs font-bold cursor-pointer hover:scale-105 transition-all select-none whitespace-nowrap ${badgeStyle}`;

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

  // Distance formula helper (Haversine approx in meters)
  const computeDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handler: When user enters or selects a searched area
  const handleSearchLocationSelect = async (lng: number, lat: number, displayName: string) => {
    const currentMap = map.current;
    if (!currentMap) return;

    // 1. Pan & Zoom directly to the searched area with clear offset so sliding panel never overlaps the target marker
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    currentMap.flyTo({ 
      center: [lng, lat], 
      zoom: 15.5, 
      essential: true,
      // Generous bottom padding on mobile and left padding on desktop so marker is completely visible above/beside panel
      padding: isMobile 
        ? { top: 70, bottom: 420, left: 20, right: 20 } 
        : { top: 90, bottom: 60, left: 460, right: 60 }
    });

    // 2. Drop a distinct, dedicated Target Exploration Marker
    if (searchTargetMarker.current) {
      searchTargetMarker.current.remove();
    }

    const targetEl = document.createElement('div');
    targetEl.className = 'relative flex flex-col items-center cursor-pointer group z-20 pointer-events-auto';
    targetEl.innerHTML = `
      <div class="px-3 py-1 bg-[#1b382b]/95 backdrop-blur-md text-white text-[11px] font-black rounded-xl shadow-2xl border border-emerald-400 mb-1 max-w-[200px] truncate text-center ring-2 ring-emerald-500/20">
        📍 ${displayName.split(',')[0]}
      </div>
      <div class="w-10 h-10 bg-gradient-to-br from-[#244837] to-[#3a7d5c] rounded-full flex items-center justify-center shadow-2xl border-2 border-white transform transition-transform group-hover:scale-110 animate-bounce">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </div>
    `;

    targetEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const mobileNow = typeof window !== 'undefined' && window.innerWidth < 768;
      currentMap.flyTo({
        center: [lng, lat],
        zoom: 16.5,
        essential: true,
        padding: mobileNow ? { top: 70, bottom: 420, left: 20, right: 20 } : { top: 90, bottom: 60, left: 460, right: 60 }
      });
    });

    searchTargetMarker.current = new maplibregl.Marker({ element: targetEl, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(currentMap);

    // 3. Find all citizen reports within 5km radius of the searched target
    const hazardsInArea: LocationReportBrief[] = activeIncidents
      .map((inc) => {
        const dist = computeDistanceMeters(lat, lng, inc.lat, inc.lng);
        return {
          id: inc.id,
          title: inc.road_name || 'Reported Waterlogging',
          distance_m: dist,
          severity: String(inc.severity || 'MODERATE'),
          depth_cm: inc.depth,
          time: inc.time || 'Recently',
          image_url: inc.image_url,
        };
      })
      .filter((h) => h.distance_m <= 5000)
      .sort((a, b) => a.distance_m - b.distance_m);

    // 4. Fetch live localized AQI for this searched point
    let targetAqi: number | null = null;
    try {
      const aqiRes = await fetch(`/api/air-quality?lat=${lat}&lng=${lng}`);
      if (aqiRes.ok) {
        const aqData = await aqiRes.json();
        targetAqi = aqData.indian_aqi || aqData.aqi || null;
      }
    } catch {
      // ignore
    }

    setSearchedTarget({
      name: displayName,
      lng,
      lat,
      aqi: targetAqi,
      hazards: hazardsInArea,
    });

    // 5. Compute Safe Routing Options (from user current GPS location to searched destination)
    const originLat = userLoc?.lat || 28.6315;
    const originLng = userLoc?.lng || 77.2167;

    setIsLoadingRoutes(true);
    try {
      const routeRes = await fetch(
        `/api/routes/plan?startLat=${originLat}&startLng=${originLng}&endLat=${lat}&endLng=${lng}`
      );
      if (routeRes.ok) {
        const routeData = await routeRes.json();
        const routes: RouteOption[] = routeData.routes || [];
        setPlannedRoutes(routes);

        // Auto-select Clean Air Corridor (Least AQI) by default
        if (routes.length > 0) {
          handleRouteSelect(routes[0]);
        }
      }
    } catch (e) {
      console.warn('Failed to calculate safe routes:', e);
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  // Handler: When user clicks one of the 3 routing options
  const handleRouteSelect = (route: RouteOption) => {
    setSelectedRouteType(route.type);
    const currentMap = map.current;
    if (!currentMap) return;

    // Safety: ensure route-source and layers exist even if reloaded
    if (!currentMap.getSource('route-source')) {
      currentMap.addSource('route-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      currentMap.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'route-source',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 10,
          'line-opacity': 0.9,
        },
      });

      currentMap.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 6,
          'line-opacity': 1.0,
        },
      });
    }

    const source = currentMap.getSource('route-source') as maplibregl.GeoJSONSource | undefined;
    if (source && typeof source.setData === 'function') {
      const color =
        route.type === 'least_aqi'
          ? '#16a34a' // Green for Clean Air Corridor
          : route.type === 'least_flood'
          ? '#0284c7' // Blue for Flood Safe High Ground
          : '#334155'; // Dark Slate for Direct Highway

      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { color },
            geometry: route.geometry,
          },
        ],
      });

      // Fit map smoothly with panel-aware padding so the whole path from user to destination is framed perfectly
      if (route.geometry && route.geometry.coordinates && route.geometry.coordinates.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        route.geometry.coordinates.forEach((coord) => bounds.extend(coord));
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        currentMap.fitBounds(bounds, { 
          padding: isMobile 
            ? { top: 90, bottom: 380, left: 30, right: 30 } 
            : { top: 100, bottom: 80, left: 450, right: 80 }, 
          maxZoom: 15,
          duration: 1200,
        });
      }
    }
  };

  // Handler: Get Directions (Directly switches to in-app safe navigation route and view without redirecting externally)
  const handleGetDirections = (route: RouteOption) => {
    handleRouteSelect(route);
  };

  // Handler: Start Route (Activates real-time in-app navigation dashboard, tracks movement, and dismisses search exploration panel)
  const handleStartRoute = (route: RouteOption) => {
    const currentMap = map.current;
    if (!searchedTarget) return;

    // Save active navigation state with real-time tracking
    setActiveNavigationRoute({
      route,
      destinationName: searchedTarget.name,
      destinationCoords: { lat: searchedTarget.lat, lng: searchedTarget.lng },
      hazards: searchedTarget.hazards,
    });

    // Close the static search panel so the screen is uncluttered
    setSearchedTarget(null);

    // Keep route line rendered on map
    handleRouteSelect(route);

    if (currentMap) {
      const startCoord = userLoc
        ? [userLoc.lng, userLoc.lat]
        : route.geometry?.coordinates?.[0] || [searchedTarget.lng, searchedTarget.lat];

      let bearing = 0;
      if (route.geometry?.coordinates && route.geometry.coordinates.length > 1) {
        const p1 = route.geometry.coordinates[0];
        const p2 = route.geometry.coordinates[1];
        const dLon = p2[0] - p1[0];
        const dLat = p2[1] - p1[1];
        bearing = (Math.atan2(dLon, dLat) * 180) / Math.PI;
      }

      currentMap.easeTo({
        center: startCoord as [number, number],
        zoom: 17.5,
        pitch: 55,
        bearing,
        duration: 1500,
        essential: true,
      });
    }
  };

  // Handler: Stop Active Navigation
  const stopNavigation = () => {
    setActiveNavigationRoute(null);
    clearRouteOverlay();
    if (searchTargetMarker.current) {
      searchTargetMarker.current.remove();
      searchTargetMarker.current = null;
    }
    if (map.current) {
      map.current.easeTo({ pitch: 0, bearing: 0, zoom: 16, duration: 1000 });
    }
  };

  // Handler: Clear route line from map
  const clearRouteOverlay = () => {
    setSelectedRouteType(null);
    const currentMap = map.current;
    if (!currentMap) return;
    currentMap.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    const source = currentMap.getSource('route-source') as maplibregl.GeoJSONSource | undefined;
    if (source && typeof source.setData === 'function') {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  };

  const closeSearchedTargetPanel = () => {
    setSearchedTarget(null);
    setPlannedRoutes([]);
    clearRouteOverlay();
    if (searchTargetMarker.current) {
      searchTargetMarker.current.remove();
      searchTargetMarker.current = null;
    }
  };

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
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 z-20 flex flex-col gap-2 pointer-events-none max-w-xl mx-auto">
        {/* Row 1: Search & Profile */}
        <div className="flex items-center gap-2">
          <div className="flex-1 pointer-events-auto">
            <SearchBar
              onLocationSelect={(lng, lat, displayName) => {
                handleSearchLocationSelect(lng, lat, displayName);
              }}
            />
          </div>

          {/* User profile / Safety drawer trigger */}
          <button
            onClick={() => setIsSafetyDrawerOpen(true)}
            className="w-12 h-12 sm:w-13 sm:h-13 bg-white/90 backdrop-blur-xl rounded-full shadow-md border border-[#e2e0d8] flex items-center justify-center pointer-events-auto shrink-0 hover:bg-white text-[#244837] active:scale-95 transition-all cursor-pointer"
            title="Saved Places & Alerts"
          >
            <UserCircle className="w-7 h-7 text-[#244837]" />
          </button>
        </div>

        {/* Row 2: GPS Status Pill */}
        <div className="flex items-center justify-start gap-2 pointer-events-auto px-0.5">
          {/* GPS status chip */}
          <button
            onClick={() => requestLocation(true, true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/85 backdrop-blur-xl rounded-xl text-[11px] font-bold text-[#1c2621] border border-[#e2e0d8] shadow-xs hover:bg-white active:scale-95 transition-all cursor-pointer"
            title="Tap to Refresh Location"
          >
            <span className="w-2 h-2 rounded-full bg-[#3a7d5c] animate-pulse" />
            <span>{gpsDebugMsg}</span>
          </button>
        </div>

        {/* Action Placement Helper Banner */}
        {isActionPlacementMode && !selectedPinCoords && (
          <div className="pointer-events-auto bg-[#244837] text-white p-2.5 px-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-slide-up border border-[#3a7d5c]/60">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-semibold">Tap anywhere on map to drop action marker</span>
            </div>
            <button
              onClick={() => setIsActionPlacementMode(false)}
              className="text-[11px] font-bold text-emerald-200 hover:text-white px-2 py-0.5 rounded-lg bg-[#1b382b] border border-[#3a7d5c]/40 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* IN-APP PROXIMITY NOTIFICATION POP-UP */}
      {nearbyAlert && (
        <div className="absolute top-28 sm:top-24 left-4 right-4 z-40 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-red-200 overflow-hidden animate-slide-up max-w-md mx-auto">
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

      {/* Floating Action Buttons & Controls Dock */}
      {/* Positioned bottom-20 on mobile to clear the bottom navigation bar (h-16), and bottom-6 on desktop */}
      <div className="absolute bottom-20 md:bottom-6 right-3 sm:right-5 z-20 flex flex-col gap-3 pointer-events-auto items-center w-12 sm:w-14 shrink-0">
        {/* SAVED PLACES BUTTON (Integrated into right side dock) */}
        <button
          onClick={() => setIsSafetyDrawerOpen(true)}
          className="w-12 h-12 sm:w-14 sm:h-14 glass-button text-[#1c2621] rounded-2xl flex flex-col items-center justify-center cursor-pointer group"
          title={`Saved Places & Alerts (${savedLocations.length})`}
        >
          <Bookmark className="w-5 h-5 text-[#8a7258] group-hover:scale-110 transition-transform" />
          <span className="text-[8px] sm:text-[9px] font-black leading-none mt-0.5 text-[#55695d]">
            Saved{savedLocations.length > 0 ? ` (${savedLocations.length})` : ''}
          </span>
        </button>

        {/* ADD ACTION BUTTON (Toggles Pin Dropping Mode) */}
        {!selectedPinCoords ? (
          <button
            onClick={() => {
              setIsActionPlacementMode((prev) => !prev);
              setSelectedIncident(null);
            }}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-lg border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isActionPlacementMode
                ? 'bg-[#b8623b] text-white border-[#944e2e] ring-2 ring-[#b8623b]/40 animate-pulse'
                : 'bg-gradient-to-b from-[#244837] to-[#1c382b] hover:from-[#1c382b] hover:to-[#152a20] text-white border-[#3a7d5c]/40 shadow-emerald-950/20'
            }`}
            title={isActionPlacementMode ? 'Cancel Pin Placement' : 'Click to Add Action Marker'}
          >
            {isActionPlacementMode ? (
              <>
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tight leading-none mt-0.5 text-orange-200">Cancel</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tight leading-none mt-0.5 text-emerald-200">Action</span>
              </>
            )}
          </button>
        ) : (
          /* FIELD ACTION TRIGGER BUTTON (Appears when map area is clicked) */
          <div className="flex flex-col gap-1.5 items-center">
            <button
              onClick={() => openFloodActionsWithTab('report', selectedPinCoords)}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-b from-[#244837] to-[#1c382b] hover:from-[#1c382b] hover:to-[#152a20] active:scale-95 text-white rounded-2xl shadow-xl border-2 border-white flex flex-col items-center justify-center transition-all cursor-pointer animate-bounce"
              title="Open Flood Actions for Selected Location"
            >
              <span className="text-2xl font-black leading-none select-none">!</span>
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tight leading-none mt-0.5 text-emerald-200">Action</span>
            </button>
            {/* Cancel/Remove Mark Button */}
            <button
              onClick={clearSelectedPin}
              className="px-2.5 py-1 glass-panel-subtle hover:bg-white text-slate-700 hover:text-red-600 rounded-xl shadow-xs border border-[#e2e0d8] text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Remove Mark"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        )}

        {/* LOCATE ME BUTTON */}
        <button
          onClick={flyToUser}
          className="w-12 h-12 sm:w-14 sm:h-14 glass-button text-[#244837] rounded-2xl flex items-center justify-center cursor-pointer group"
          title="Locate Me"
        >
          <LocateFixed className="w-5 h-5 sm:w-6 sm:h-6 text-[#244837] group-hover:scale-110 transition-transform" />
        </button>

        {/* ZOOM CONTROLS */}
        <div className="flex flex-col glass-panel rounded-2xl overflow-hidden border border-[#e2e0d8] shadow-sm">
          <button
            onClick={() => map.current?.zoomIn()}
            className="w-12 h-10 sm:w-14 sm:h-11 flex items-center justify-center text-[#1c2621] hover:bg-[#f2f0e8]/80 font-black text-lg transition-colors cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <div className="w-full h-px bg-[#e2e0d8]/80" />
          <button
            onClick={() => map.current?.zoomOut()}
            className="w-12 h-10 sm:w-14 sm:h-11 flex items-center justify-center text-[#1c2621] hover:bg-[#f2f0e8]/80 font-black text-lg transition-colors cursor-pointer"
            title="Zoom Out"
          >
            −
          </button>
        </div>

        {/* AQI HEATMAP LAYER TOGGLE BUTTON */}
        <button
          onClick={() => setShowAqiLayer((prev) => !prev)}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-sm border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
            showAqiLayer
              ? 'bg-[#244837] text-white border-[#1b382b] ring-2 ring-[#3a7d5c]/30 shadow-[#244837]/20'
              : 'glass-button text-[#1c2621]'
          }`}
          title={showAqiLayer ? 'Hide Air Quality Heatmap' : 'Show Air Quality Heatmap'}
        >
          <div className="relative flex items-center justify-center">
            <Wind className={`w-4 h-4 ${showAqiLayer ? 'text-white' : 'text-[#3a7d5c]'}`} />
            {aqiData !== null && (
              <span
                className={`absolute -top-1 -right-2.5 w-2.5 h-2.5 rounded-full border border-white ${
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
          <span className={`text-[11px] font-black font-mono leading-none mt-1 ${showAqiLayer ? 'text-white' : 'text-[#1c2621]'}`}>
            {aqiData !== null ? aqiData : 'AQI'}
          </span>
          <span className={`text-[8px] font-extrabold uppercase tracking-wider leading-none mt-0.5 ${showAqiLayer ? 'text-emerald-200' : 'text-[#77887e]'}`}>
            AQI
          </span>
        </button>
      </div>

      {/* AQI HEATMAP SEVERITY SCALE CHIP (Anchored independently at bottom-left so side dock never shifts) */}
      {showAqiLayer && (
        <div className="absolute bottom-20 md:bottom-6 left-3 sm:left-5 z-20 pointer-events-auto glass-panel rounded-2xl px-3 py-2 shadow-md flex items-center gap-2 text-[10px] font-bold text-[#1c2621] animate-in fade-in duration-200">
          <span className="text-[#55695d] font-mono text-[9px] uppercase tracking-wider font-extrabold">AQI Scale</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" title="Good (0-50)" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#84cc16]" title="Satisfactory (51-100)" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" title="Moderate (101-200)" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" title="Poor (201-300)" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" title="Very Poor (301-400)" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#9333ea]" title="Severe (401+)" />
          </div>
        </div>
      )}

      {/* INCIDENT INFO CARD (When user clicks flooded hazard pin) */}
      {selectedIncident && !isFloodActionsModalOpen && !isSafetyDrawerOpen && (
        <div className="absolute bottom-20 md:bottom-6 left-3 sm:left-4 right-16 sm:right-20 z-20 max-w-sm pointer-events-auto animate-slide-up">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-red-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider">
                  {selectedIncident.road_name?.toLowerCase().includes('aqi') ? (
                    <span className="flex items-center gap-1.5 text-[#244837]">
                      <Wind className="w-3.5 h-3.5 text-[#3a7d5c]" />
                      <span>ATMOSPHERIC OBSERVATION POINT</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>COMMUNITY REPORTED HAZARD</span>
                    </span>
                  )}
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
                    alt="Incident Evidence"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : selectedIncident.road_name?.toLowerCase().includes('aqi') ? (
                <div className="w-16 h-16 bg-[#f0f4f1] border border-[#d2ddd6] rounded-xl flex flex-col items-center justify-center shrink-0 text-[#244837]">
                  <Wind className="w-6 h-6 mb-0.5 text-[#3a7d5c]" />
                  <span className="text-[9px] font-black uppercase text-[#244837]">AIR DATA</span>
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

      {/* AREA EXPLORATION BRIEF & SAFE ROUTING PANEL */}
      {searchedTarget && !activeNavigationRoute && (
        <AreaBriefPanel
          locationName={searchedTarget.name}
          coords={{ lat: searchedTarget.lat, lng: searchedTarget.lng }}
          areaAqi={searchedTarget.aqi}
          nearbyHazards={searchedTarget.hazards}
          routes={plannedRoutes}
          isLoadingRoutes={isLoadingRoutes}
          selectedRouteType={selectedRouteType}
          onSelectRoute={handleRouteSelect}
          onClearRouting={clearRouteOverlay}
          onGetDirections={handleGetDirections}
          onStartRoute={handleStartRoute}
          onClose={closeSearchedTargetPanel}
        />
      )}

      {/* ACTIVE IN-APP LIVE NAVIGATION DASHBOARD */}
      {activeNavigationRoute && (() => {
        // Compute live distance and dynamic ETA based on device current position
        const dest = activeNavigationRoute.destinationCoords;
        const currentLat = userLoc?.lat || 28.6315;
        const currentLng = userLoc?.lng || 77.2167;
        const dLat = (dest.lat - currentLat) * (Math.PI / 180);
        const dLon = (dest.lng - currentLng) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(currentLat * (Math.PI / 180)) *
            Math.cos(dest.lat * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const liveDistanceKm = parseFloat((6371 * c).toFixed(1));
        // Average speed approx 25 km/h in city traffic
        const liveEtaMin = Math.max(1, Math.round((liveDistanceKm / 25) * 60));

        return (
          <div className="absolute top-16 sm:top-20 left-3 sm:left-4 right-3 sm:right-auto sm:w-[420px] z-40 pointer-events-auto animate-slide-up flex flex-col glass-dock rounded-3xl shadow-2xl border border-[#244837]/30 overflow-hidden">
            {/* Live Navigation Header */}
            <div className="p-4 bg-gradient-to-r from-[#244837] to-[#1c382b] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Navigation className="w-5 h-5 text-emerald-300 fill-emerald-300 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                      Live Guidance Active
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black truncate max-w-[220px]">
                    {activeNavigationRoute.destinationName.split(',')[0]}
                  </h3>
                </div>
              </div>

              <button
                onClick={stopNavigation}
                className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500 text-white border border-red-400/40 text-xs font-bold transition-all cursor-pointer"
                title="End Navigation"
              >
                Exit
              </button>
            </div>

            {/* Dynamic Telemetry Metric Strip */}
            <div className="p-4 bg-white/95 backdrop-blur-xl flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-[#f4f3ef] rounded-2xl border border-[#e2e0d8]">
                  <span className="text-[10px] font-bold text-[#617469] block">Time Left</span>
                  <span className="text-lg font-black text-[#1c2621] font-mono leading-tight">
                    {liveEtaMin} <span className="text-xs font-normal">min</span>
                  </span>
                </div>
                <div className="p-2.5 bg-[#f4f3ef] rounded-2xl border border-[#e2e0d8]">
                  <span className="text-[10px] font-bold text-[#617469] block">Distance</span>
                  <span className="text-lg font-black text-[#1c2621] font-mono leading-tight">
                    {liveDistanceKm} <span className="text-xs font-normal">km</span>
                  </span>
                </div>
                <div className="p-2.5 bg-[#f4f3ef] rounded-2xl border border-[#e2e0d8]">
                  <span className="text-[10px] font-bold text-[#617469] block">Route AQI</span>
                  <span className="text-lg font-black text-[#244837] font-mono leading-tight">
                    {activeNavigationRoute.route.avg_aqi}
                  </span>
                </div>
              </div>

              {/* Real-time Environmental Hazard Alert on Route */}
              <div className="p-3 rounded-2xl bg-[#f8f7f4] border border-[#e2e0d8] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${activeNavigationRoute.hazards.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
                  <span className="font-semibold text-[#1c2621]">
                    {activeNavigationRoute.hazards.length > 0
                      ? `${activeNavigationRoute.hazards.length} hazards monitored ahead`
                      : 'Zero flood hazards detected on this corridor'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#3a7d5c] bg-[#e8efe9] px-2 py-0.5 rounded-md">
                  {activeNavigationRoute.route.flood_risk} Risk
                </span>
              </div>

              {/* Re-center device view button */}
              <button
                onClick={() => {
                  if (userLoc && map.current) {
                    map.current.easeTo({ center: [userLoc.lng, userLoc.lat], zoom: 18, pitch: 55, duration: 1000 });
                  }
                }}
                className="w-full py-2 bg-[#244837] hover:bg-[#1b382b] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Follow My Position</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* FLOOD ACTIONS MODAL (Dual Tab: Report Flood & Save Place) */}
      <FloodActionsModal
        isOpen={isFloodActionsModalOpen}
        onClose={() => {
          setIsFloodActionsModalOpen(false);
          clearSelectedPin();
          setIsActionPlacementMode(false);
        }}
        initialTab={floodActionsTab}
        currentCoords={selectedPinCoords || userLoc || { lat: 28.6291, lng: 77.2198 }}
        onRefreshGPS={flyToUser}
        onSavePlaceSuccess={async () => {
          await refreshSafetyData();
          clearSelectedPin();
          setIsActionPlacementMode(false);
        }}
        onReportSuccess={async () => {
          await refreshIncidents();
          await refreshSafetyData();
          clearSelectedPin();
          setIsActionPlacementMode(false);
        }}
        onSelectOnMap={() => {
          setIsFloodActionsModalOpen(false);
          setIsActionPlacementMode(true);
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