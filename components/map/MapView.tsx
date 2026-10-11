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
  Navigation,
  Clock,
  CheckCircle,
  XCircle,
  X,
  Droplets,
  Layers,
  MapPin,
  RefreshCw,
  Info,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import SearchBar from './SearchBar';
import SavedPlacesDrawer from '../places/SavedPlacesDrawer';
import FloodActionsModal from '../modal/FloodActionsModal';
import ReportModal from '../reports/ReportModal';
import { SavedLocation, UserAlert, RiskLevel } from '@/types/db';

if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre-gl-worker.mjs');
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const actionPinMarker = useRef<maplibregl.Marker | null>(null);
  const savedPlaceMarkers = useRef<maplibregl.Marker[]>([]);
  const watchIdRef = useRef<number | null>(null);

  // User Location & GPS State
  const [userLoc, setUserLoc] = useState<{ lng: number; lat: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'locating' | 'active' | 'denied' | 'timeout' | 'unavailable' | 'unsupported'>('locating');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [showGpsHelpModal, setShowGpsHelpModal] = useState(false);

  // UI Sheet & Interaction State
  const [sheetState, setSheetState] = useState<'HIDDEN' | 'ACTION_PROMPT' | 'INCIDENT_INFO'>('HIDDEN');
  const [selectedPinCoords, setSelectedPinCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [activeStreetGlowId, setActiveStreetGlowId] = useState<string | null>(null);

  // Proximity Notification State
  const [nearbyAlert, setNearbyAlert] = useState<any | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Modals & Safety Hub State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSafetyDrawerOpen, setIsSafetyDrawerOpen] = useState(false);
  const [isFloodActionsModalOpen, setIsFloodActionsModalOpen] = useState(false);
  const [floodActionsTab, setFloodActionsTab] = useState<'report' | 'save'>('report');
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [isLoadingSafety, setIsLoadingSafety] = useState(false);

  // 1. Fetch Safety Hub Data (Saved Places & Alerts)
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

  // 2. Continuous Tracking Setup with Safe Fallback
  const startContinuousWatch = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLoc({ lng: longitude, lat: latitude });
        setGpsAccuracy(Math.round(accuracy));
        setGpsStatus('active');

        if (map.current) {
          if (!userMarker.current) {
            const dot = document.createElement('div');
            dot.className = 'w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_20px_rgba(59,130,246,0.9)] animate-pulse';
            userMarker.current = new maplibregl.Marker({ element: dot })
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          } else {
            userMarker.current.setLngLat([longitude, latitude]);
          }
        }
      },
      (err) => {
        // Continuous watch errors are silent if already located, or update status
        if (err.code === 1) {
          setGpsStatus('denied');
        } else if (err.code === 3) {
          // Timeout in continuous watch is normal if stationary indoors
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
  }, []);

  // 3. Robust Geolocation Requester (Dual High/Standard Accuracy Fallback)
  const requestLocation = useCallback((isUserGesture = false, flyToCoords = true) => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      if (isUserGesture) alert('Geolocation is not supported by this browser.');
      return;
    }

    setGpsStatus('locating');

    // Helper to query geolocation with specific accuracy
    const queryPosition = (highAccuracy: boolean, timeoutMs: number) => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: 30000,
        });
      });
    };

    // Phase 1: Try High Accuracy (GNSS Satellite)
    queryPosition(true, 8000)
      .then((pos) => {
        handleSuccess(pos);
      })
      .catch((err: GeolocationPositionError) => {
        if (err.code === 1) {
          // Permission Denied
          setGpsStatus('denied');
          if (isUserGesture) setShowGpsHelpModal(true);
        } else {
          // Timeout or Position Unavailable (Common on PCs & indoor mobile without GPS chips)
          // Phase 2: Fallback to Standard Accuracy (Wi-Fi / Cellular Triangulation)
          queryPosition(false, 12000)
            .then((fallbackPos) => {
              handleSuccess(fallbackPos);
            })
            .catch((fallbackErr: GeolocationPositionError) => {
              if (fallbackErr.code === 1) {
                setGpsStatus('denied');
                if (isUserGesture) setShowGpsHelpModal(true);
              } else if (fallbackErr.code === 3) {
                setGpsStatus('timeout');
              } else {
                setGpsStatus('unavailable');
              }
            });
        }
      });

    const handleSuccess = (pos: GeolocationPosition) => {
      const { longitude, latitude, accuracy } = pos.coords;
      setUserLoc({ lng: longitude, lat: latitude });
      setGpsAccuracy(Math.round(accuracy));
      setGpsStatus('active');

      if (map.current) {
        if (flyToCoords) {
          map.current.flyTo({ center: [longitude, latitude], zoom: 17, essential: true });
        }

        if (!userMarker.current) {
          const dot = document.createElement('div');
          dot.className = 'w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_20px_rgba(59,130,246,0.9)] animate-pulse';
          userMarker.current = new maplibregl.Marker({ element: dot })
            .setLngLat([longitude, latitude])
            .addTo(map.current);
        } else {
          userMarker.current.setLngLat([longitude, latitude]);
        }
      }

      startContinuousWatch();
    };
  }, [startContinuousWatch]);

  // 4. Community Verification Handler (Confirmed / Cleared)
  const handleCommunityVerify = async (status: 'YES' | 'NO', roadId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(roadId));
    setNearbyAlert(null);

    if (status === 'NO' && map.current) {
      // Optimistically erase the flooded road segment from map view
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
        console.warn('Error adjusting layer filter:', e);
      }

      try {
        await fetch('/api/reports/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'DISMISS', roadId }),
        });
      } catch (e) {
        console.error('Failed to clear incident:', e);
      }
    } else if (status === 'YES') {
      try {
        await fetch('/api/reports/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'CONFIRM', roadId }),
        });
      } catch (e) {
        console.error('Failed to confirm incident:', e);
      }
    }
  };

  // 5. Initialize MapLibre Canvas (ONCE on mount)
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
      center: [77.2167, 28.6315], // Default: New Delhi
      zoom: 15,
      attributionControl: false,
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Add roads data source
      map.current.addSource('roads', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Roads neon glow layer for active or severe hazards
      map.current.addLayer({
        id: 'roads-glow',
        type: 'line',
        source: 'roads',
        filter: ['in', ['get', 'current_risk_level'], ['literal', ['SEVERE', 'HIGH']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width': 16,
          'line-blur': 10,
          'line-opacity': 0, // Driven dynamically via setPaintProperty
          'line-color': '#ef4444',
        },
      });

      // Core road risk stroke layer
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
            'SEVERE', '#ef4444',
            'HIGH', '#f97316',
            'MODERATE', '#eab308',
            'LOW', '#22c55e',
            '#94a3b8',
          ],
        },
      });

      // Click Interaction on Map & Hazards
      map.current.on('click', (e) => {
        if (!map.current) return;
        const features = map.current.queryRenderedFeatures(e.point, { layers: ['roads-layer'] });

        if (features.length > 0) {
          const street = features[0].properties;
          setActiveStreetGlowId(street.id);
          setSelectedIncident(street);
          setSheetState('INCIDENT_INFO');
          if (actionPinMarker.current) {
            actionPinMarker.current.remove();
            actionPinMarker.current = null;
          }
          setSelectedPinCoords(null);
          return;
        }

        // Clicked outside road: drop interactive bouncing pin
        setActiveStreetGlowId(null);
        setSelectedIncident(null);
        setSelectedPinCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });

        const pinElement = document.createElement('div');
        pinElement.innerHTML = `
          <div class="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center shadow-2xl border-2 border-white transform transition-transform animate-bounce cursor-pointer">
            <span class="text-white font-black text-xl">!</span>
          </div>
        `;
        pinElement.addEventListener('click', (ev) => {
          ev.stopPropagation();
          setSheetState('ACTION_PROMPT');
        });

        if (actionPinMarker.current) actionPinMarker.current.remove();
        actionPinMarker.current = new maplibregl.Marker({ element: pinElement, anchor: 'bottom' })
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .addTo(map.current);

        setSheetState('ACTION_PROMPT');
      });

      // Data fetcher on viewport bounds
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
        } catch (err) {
          console.warn('Error fetching risk area:', err);
        }
      };

      fetchRoads();
      map.current.on('moveend', fetchRoads);

      // Trigger initial location request
      requestLocation(false, true);
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.current?.remove();
      map.current = null;
    };
  }, [requestLocation]);

  // 6. Dynamic Street Glow without Re-mounting the Map
  useEffect(() => {
    if (!map.current || !map.current.getLayer('roads-glow')) return;
    map.current.setPaintProperty('roads-glow', 'line-opacity', [
      'case',
      ['==', ['get', 'id'], activeStreetGlowId || ''],
      0.85,
      0,
    ]);
  }, [activeStreetGlowId]);

  // 7. Render Saved Places Markers
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance) return;

    savedPlaceMarkers.current.forEach((m) => m.remove());
    savedPlaceMarkers.current = [];

    savedLocations.forEach((place) => {
      const el = document.createElement('div');
      const isSevere = place.nearest_road_risk_level === 'SEVERE' || place.nearest_road_risk_level === 'HIGH';

      el.className = `flex items-center gap-1.5 px-2.5 py-1 bg-white/95 backdrop-blur-xs border rounded-full shadow-md text-xs font-bold cursor-pointer hover:scale-105 transition-all select-none whitespace-nowrap ${
        isSevere ? 'border-red-400 text-red-700 hover:border-red-600' : 'border-slate-300 text-slate-800 hover:border-blue-500'
      }`;

      el.innerHTML = `
        <span class="w-2 h-2 rounded-full ${isSevere ? 'bg-red-500 animate-ping' : 'bg-blue-500'}"></span>
        <span>${place.label}</span>
      `;

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        mapInstance.flyTo({ center: [place.longitude, place.latitude], zoom: 17, essential: true });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(mapInstance);

      savedPlaceMarkers.current.push(marker);
    });
  }, [savedLocations]);

  // 8. Proximity Radar Engine
  useEffect(() => {
    if (!map.current || !userLoc) return;

    const checkProximity = () => {
      if (!map.current) return;

      const point = map.current.project([userLoc.lng, userLoc.lat]);
      // ~200m bounding hit-box
      const hitBox = [
        [point.x - 80, point.y - 80],
        [point.x + 80, point.y + 80],
      ] as [maplibregl.PointLike, maplibregl.PointLike];

      const nearbyFeatures = map.current.queryRenderedFeatures(hitBox, { layers: ['roads-layer'] });
      const activeHazard = nearbyFeatures.find(
        (f) =>
          (f.properties.current_risk_level === 'SEVERE' || f.properties.current_risk_level === 'HIGH') &&
          !dismissedAlerts.has(f.properties.id)
      );

      if (activeHazard) setNearbyAlert(activeHazard.properties);
    };

    const timeout = setTimeout(checkProximity, 1500);
    return () => clearTimeout(timeout);
  }, [userLoc, dismissedAlerts]);

  // Helpers to open modals with preset tabs & coordinates
  const openReportModal = (coords?: { lng: number; lat: number }) => {
    setFloodActionsTab('report');
    if (coords) setSelectedPinCoords(coords);
    setIsFloodActionsModalOpen(true);
  };

  const openSavePlaceModal = (coords?: { lng: number; lat: number }) => {
    setFloodActionsTab('save');
    if (coords) setSelectedPinCoords(coords);
    setIsFloodActionsModalOpen(true);
  };

  // Safe JSON parse for road risk factors
  const parseRiskFactors = (raw: any) => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  };

  // Render GPS Status Pill Content
  const renderGpsPillContent = () => {
    switch (gpsStatus) {
      case 'active':
        return (
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>GPS Active {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}</span>
          </span>
        );
      case 'locating':
        return (
          <span className="flex items-center gap-1.5 text-blue-700">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Acquiring GPS Fix...</span>
          </span>
        );
      case 'denied':
        return (
          <span className="flex items-center gap-1.5 text-red-600 font-bold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Location Blocked (Tap for Help)</span>
          </span>
        );
      case 'timeout':
        return (
          <span className="flex items-center gap-1.5 text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>GPS Timed Out (Tap to Retry)</span>
          </span>
        );
      case 'unavailable':
      default:
        return (
          <span className="flex items-center gap-1.5 text-slate-700">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Location Unavailable (Tap to Retry)</span>
          </span>
        );
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* 1. Proximity Radar Alert */}
      {nearbyAlert && (
        <div className="absolute top-20 left-4 right-4 z-40 max-w-md mx-auto bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden animate-in slide-in-from-top duration-300">
          <div className="bg-red-500 p-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 animate-pulse text-white" />
              <span className="font-extrabold text-xs tracking-wider uppercase">Hazard Radar Alert</span>
            </div>
            <button
              onClick={() => {
                setDismissedAlerts((prev) => new Set(prev).add(nearbyAlert.id));
                setNearbyAlert(null);
              }}
              className="text-white/80 hover:text-white p-1 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-slate-800 font-semibold text-sm mb-1">
              Approaching hazard on{' '}
              <span className="font-black text-slate-900">{nearbyAlert.road_name || 'this street'}</span>.
            </p>
            <p className="text-xs text-slate-500 mb-4">Is this area still experiencing flooding?</p>

            <div className="flex gap-2.5">
              <button
                onClick={() => handleCommunityVerify('YES', nearbyAlert.id)}
                className="flex-1 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" /> Still Flooded
              </button>
              <button
                onClick={() => handleCommunityVerify('NO', nearbyAlert.id)}
                className="flex-1 bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4" /> It&apos;s Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Navigation Bar & Search */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex gap-3 pointer-events-none max-w-xl mx-auto">
        <div className="flex-1 pointer-events-auto">
          <SearchBar
            onLocationSelect={(lng, lat) => {
              if (map.current) {
                map.current.flyTo({ center: [lng, lat], zoom: 17, essential: true });
              }
            }}
          />
        </div>
        <button
          onClick={() => setIsSafetyDrawerOpen(true)}
          className="w-12 h-12 bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center pointer-events-auto shrink-0 hover:bg-slate-50 transition-colors relative cursor-pointer"
          title="Saved Places & Alerts"
        >
          <Bookmark className="w-5 h-5 text-slate-700" />
          {savedLocations.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {savedLocations.length}
            </span>
          )}
        </button>
      </div>

      {/* 3. Interactive GPS Diagnostic Pill */}
      <div className="absolute top-18 left-4 right-4 z-20 pointer-events-none flex justify-center">
        <button
          onClick={() => {
            if (gpsStatus === 'denied') {
              setShowGpsHelpModal(true);
            } else {
              requestLocation(true, true);
            }
          }}
          className="pointer-events-auto py-1.5 px-3.5 rounded-full text-xs font-bold border shadow-md bg-white/90 backdrop-blur border-slate-200 hover:bg-white active:scale-95 transition-all cursor-pointer select-none"
          title="Tap to refresh your GPS location"
        >
          {renderGpsPillContent()}
        </button>
      </div>

      {/* 4. Floating Recenter GPS Button (Explicit User Gesture Handler) */}
      <div
        className="absolute bottom-6 right-4 z-20 pointer-events-auto transition-transform duration-300"
        style={{
          transform: sheetState !== 'HIDDEN' ? 'translateY(-290px)' : 'translateY(0)',
        }}
      >
        <button
          onClick={() => requestLocation(true, true)}
          className="w-13 h-13 bg-white text-blue-600 rounded-full shadow-2xl flex items-center justify-center border border-slate-200 hover:bg-blue-50 active:scale-90 transition-all cursor-pointer"
          title="Center on my location"
        >
          <LocateFixed className="w-6 h-6" />
        </button>
      </div>

      {/* 5. Bottom Action & Hazard Detail Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-30 transition-transform duration-300 ease-out transform max-w-lg mx-auto ${
          sheetState === 'HIDDEN' ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
        <div
          className="w-full flex justify-center pt-3 pb-2 cursor-pointer"
          onClick={() => {
            setSheetState('HIDDEN');
            if (actionPinMarker.current) {
              actionPinMarker.current.remove();
              actionPinMarker.current = null;
            }
            setSelectedPinCoords(null);
            setActiveStreetGlowId(null);
          }}
        >
          <div className="w-12 h-1.5 bg-slate-300 rounded-full hover:bg-slate-400 transition-colors"></div>
        </div>

        <div className="px-6 pb-8 pt-2">
          {sheetState === 'ACTION_PROMPT' && selectedPinCoords && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Pinned Location</h3>
                  <p className="text-xs font-mono text-slate-500">
                    {selectedPinCoords.lat.toFixed(5)}, {selectedPinCoords.lng.toFixed(5)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSheetState('HIDDEN');
                    if (actionPinMarker.current) {
                      actionPinMarker.current.remove();
                      actionPinMarker.current = null;
                    }
                    setSelectedPinCoords(null);
                  }}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  setSheetState('HIDDEN');
                  openSavePlaceModal(selectedPinCoords);
                }}
                className="w-full flex items-center p-3.5 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 active:scale-98 transition-all cursor-pointer"
              >
                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl mr-3.5">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-slate-900">Save This Location</p>
                  <p className="text-xs text-slate-500">Receive flood alerts for Home, Work or School</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setSheetState('HIDDEN');
                  setIsReportModalOpen(true);
                }}
                className="w-full flex items-center p-3.5 bg-red-50 border border-red-100 rounded-2xl active:bg-red-100 hover:bg-red-100 transition-colors cursor-pointer"
              >
                <div className="p-2.5 bg-red-100 text-red-600 rounded-xl mr-3.5">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-red-700">Report Hazard</p>
                  <p className="text-xs text-red-500">Tap Camera &bull; Tap Severity &bull; Submit</p>
                </div>
              </button>
            </div>
          )}

          {sheetState === 'INCIDENT_INFO' && selectedIncident && (
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {selectedIncident.road_name || 'Flooded Segment'}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs font-bold mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        selectedIncident.current_risk_level === 'SEVERE'
                          ? 'bg-red-100 text-red-700'
                          : selectedIncident.current_risk_level === 'HIGH'
                          ? 'bg-orange-100 text-orange-700'
                          : selectedIncident.current_risk_level === 'MODERATE'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {selectedIncident.current_risk_level || 'MODERATE'} RISK
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Risk Score
                  </span>
                  <span className="text-xl font-black text-slate-900 font-mono">
                    {selectedIncident.current_risk_score ?? 0}
                    <span className="text-xs text-slate-400">/100</span>
                  </span>
                </div>
              </div>

              {/* Dynamic Risk Factors Summary */}
              {(() => {
                const factors = parseRiskFactors(selectedIncident.risk_factors);
                return (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-medium">
                        <Droplets className="w-3.5 h-3.5 text-blue-500" /> Rainfall Factor:
                      </span>
                      <span className="font-bold text-slate-800">{factors.rainfall_pct || 0}%</span>
                    </div>
                    {factors.summary && (
                      <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                        {factors.summary}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setSheetState('HIDDEN');
                    setIsReportModalOpen(true);
                  }}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-red-500/20"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Submit Street Condition Report</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. GPS Permission Help Dialog (Shown when user hits permission block) */}
      {showGpsHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900 text-center mb-2">Location Access Blocked</h3>
            <p className="text-xs text-slate-600 leading-relaxed text-center mb-4">
              Your browser or device blocked location access. To navigate floods accurately:
            </p>

            <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-5">
              <div className="flex items-start gap-2">
                <span className="font-black text-blue-600">1.</span>
                <span>
                  <strong>Brave / Chrome URL Bar:</strong> Tap the lock or tune icon next to <code>localhost</code> / URL and change <strong>Location</strong> to <strong>Allow</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-black text-blue-600">2.</span>
                <span>
                  <strong>Windows / Device Settings:</strong> Turn ON <strong>Location Services</strong> and enable <em>&quot;Let desktop apps access your location&quot;</em>.
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowGpsHelpModal(false)}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setShowGpsHelpModal(false);
                  requestLocation(true, true);
                }}
                className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Retry Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Flood Actions Modal (Report Hazard & Save Place with Bedrock AI) */}
      <FloodActionsModal
        isOpen={isFloodActionsModalOpen}
        onClose={() => setIsFloodActionsModalOpen(false)}
        initialTab={floodActionsTab}
        currentCoords={selectedPinCoords || userLoc || { lat: 28.6291, lng: 77.2198 }}
        onRefreshGPS={() => requestLocation(true, true)}
        onSavePlaceSuccess={async () => {
          await refreshSafetyData();
        }}
        onReportSuccess={async () => {
          await refreshSafetyData();
        }}
      />

      {/* 8. Citizen Safety Hub Drawer (Saved Places & Live Alerts) */}
      <SavedPlacesDrawer
        isOpen={isSafetyDrawerOpen}
        onClose={() => setIsSafetyDrawerOpen(false)}
        savedLocations={savedLocations}
        alerts={alerts}
        isLoading={isLoadingSafety}
        onAddNewPlace={() => openSavePlaceModal(userLoc || undefined)}
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

      {/* 9. The Fast Mobile Camera & Severity Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setSheetState('HIDDEN');
        }}
        lat={selectedPinCoords?.lat || (actionPinMarker.current ? actionPinMarker.current.getLngLat().lat : (userLoc?.lat || 0))}
        lng={selectedPinCoords?.lng || (actionPinMarker.current ? actionPinMarker.current.getLngLat().lng : (userLoc?.lng || 0))}
        onReportSubmitted={async () => {
          await refreshSafetyData();
        }}
      />
    </div>
  );
}