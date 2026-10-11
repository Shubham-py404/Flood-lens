'use client';

import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Wind, 
  Navigation, 
  Camera, 
  Bookmark, 
  Sparkles, 
  Menu, 
  X,
  Bell,
  Layers,
  ChevronRight
} from 'lucide-react';
import MapView from '../map/MapView';
import DailyPulseView from '../views/DailyPulseView';
import AirQualityView from '../views/AirQualityView';
import InsightsFeedView from '../views/InsightsFeedView';
import AskAIView from '../views/AskAIView';
import SavedPlacesDrawer from '../places/SavedPlacesDrawer';
import FloodActionsModal from '../modal/FloodActionsModal';
import { EnvironmentSummary, AirQualityData, NearbyIncidentCard } from '@/types/api';
import { SavedLocation, UserAlert } from '@/types/db';

type Tab = 'home' | 'air' | 'map' | 'insights' | 'places' | 'assistant';

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({ lat: 28.6315, lng: 77.2167 });
  const [mapTarget, setMapTarget] = useState<{ lat: number; lng: number; title?: string } | null>(null);
  const [showAqiHeatmap, setShowAqiHeatmap] = useState(false);

  // Data states initially configured with clean placeholders while telemetry resolves
  const [summary, setSummary] = useState<EnvironmentSummary>({
    location: { lat: 28.6315, lng: 77.2167, name: 'Resolving Location...' },
    air_quality: {
      aqi: 131,
      category: 'Moderate',
      categoryColor: '#eab308',
      pm2_5: 69.2,
      pm10: 143.0,
      nitrogen_dioxide: 28.4,
      ozone: 36.1,
      sulphur_dioxide: 11.2,
      carbon_monoxide: 390,
      source: 'Open-Meteo Air CAMS',
      observed_at: '2026-10-11T12:00:00.000Z',
      is_stale: false,
      advice: 'Air quality is acceptable for sensitive groups.',
      indian_aqi: 131,
      indian_category: 'Moderate',
      indian_category_color: '#eab308',
    },
    weather: {
      temperature_c: 27,
      precipitation_mm: 0,
      rain_24h_mm: 0,
      weather_code: 0,
      weather_desc: 'Clear Sky'
    },
    active_incidents_count: 0,
    severe_incidents_count: 0,
    freshness: 'Connecting telemetry...'
  });
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const [airData, setAirData] = useState<AirQualityData>({
    aqi: 131,
    category: 'Moderate',
    categoryColor: '#eab308',
    pm2_5: 69.2,
    pm10: 143.0,
    nitrogen_dioxide: 28.4,
    ozone: 36.1,
    sulphur_dioxide: 11.2,
    carbon_monoxide: 390,
    source: 'Open-Meteo Air CAMS',
    observed_at: '2026-10-11T12:00:00.000Z',
    is_stale: false,
    advice: 'Air quality is acceptable for sensitive groups.',
    indian_aqi: 131,
    indian_category: 'Moderate',
    indian_category_color: '#eab308',
  });
  const [isAirLoading, setIsAirLoading] = useState(false);

  const [nearbyIncidents, setNearbyIncidents] = useState<NearbyIncidentCard[]>([]);
  const [isIncidentsLoading, setIsIncidentsLoading] = useState(false);

  // Safety Drawer & Reporting Modal
  const [isPlacesDrawerOpen, setIsPlacesDrawerOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [isSafetyLoading, setIsSafetyLoading] = useState(false);

  // Acquire device location on mount with GPS + IP fallback
  const detectLocation = React.useCallback(async () => {
    // 1. First attempt high-accuracy browser GPS
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(4));
          const lng = parseFloat(pos.coords.longitude.toFixed(4));
          setUserCoords({ lat, lng });
          fetchSummary(lat, lng);
          fetchAir(lat, lng);
          fetchNearby(lat, lng);
        },
        async (err) => {
          console.warn('Browser GPS unavailable/blocked, attempting IP geolocation fallback:', err.message);
          // 2. Fallback to server IP location if GPS prompt was dismissed, blocked, or timed out
          try {
            const ipRes = await fetch('/api/geo/ip');
            if (ipRes.ok) {
              const ipData = await ipRes.json();
              if (ipData.lat && ipData.lng) {
                const ipLat = parseFloat(Number(ipData.lat).toFixed(4));
                const ipLng = parseFloat(Number(ipData.lng).toFixed(4));
                setUserCoords({ lat: ipLat, lng: ipLng });
                fetchSummary(ipLat, ipLng);
                fetchAir(ipLat, ipLng);
                fetchNearby(ipLat, ipLng);
                return;
              }
            }
          } catch (ipErr) {
            console.error('IP geocoding fallback error:', ipErr);
          }
          // Final fallback
          fetchSummary(28.6315, 77.2167);
          fetchAir(28.6315, 77.2167);
          fetchNearby(28.6315, 77.2167);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    } else {
      fetchSummary(28.6315, 77.2167);
      fetchAir(28.6315, 77.2167);
      fetchNearby(28.6315, 77.2167);
    }
  }, []);

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  const lat = userCoords?.lat || 28.6315;
  const lng = userCoords?.lng || 77.2167;

  // Fetch summary for given coordinates
  const fetchSummary = React.useCallback(async (latitude: number, longitude: number) => {
    try {
      setIsSummaryLoading(true);
      const res = await fetch(`/api/environment/summary?lat=${latitude}&lng=${longitude}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (e) {
      console.error('Failed to fetch summary:', e);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  // Fetch live Air Quality for given coordinates
  const fetchAir = React.useCallback(async (latitude: number, longitude: number) => {
    try {
      setIsAirLoading(true);
      const res = await fetch(`/api/air-quality?lat=${latitude}&lng=${longitude}`);
      if (res.ok) {
        const data = await res.json();
        setAirData(data);
      }
    } catch (e) {
      console.error('Failed to fetch air quality:', e);
    } finally {
      setIsAirLoading(false);
    }
  }, []);

  // Fetch Nearby insights for given coordinates
  const fetchNearby = React.useCallback(async (latitude: number, longitude: number) => {
    try {
      setIsIncidentsLoading(true);
      const res = await fetch(`/api/insights/nearby?lat=${latitude}&lng=${longitude}`);
      if (res.ok) {
        const data = await res.json();
        setNearbyIncidents(data.items || []);
      }
    } catch (e) {
      console.error('Failed to fetch nearby insights:', e);
    } finally {
      setIsIncidentsLoading(false);
    }
  }, []);

  // Fetch Saved places & alerts
  const fetchSafetyData = React.useCallback(async () => {
    try {
      setIsSafetyLoading(true);
      const [placesRes, alertsRes] = await Promise.all([
        fetch('/api/user/saved-locations'),
        fetch('/api/user/alerts'),
      ]);
      if (placesRes.ok) {
        const p = await placesRes.json();
        setSavedLocations(p.saved_locations || []);
      }
      if (alertsRes.ok) {
        const a = await alertsRes.json();
        setAlerts(a.alerts || []);
      }
    } catch (err) {
      console.error('Safety data fetch error:', err);
    } finally {
      setIsSafetyLoading(false);
    }
  }, []);

  // Automatically fetch live environmental data whenever user coordinates update
  useEffect(() => {
    if (userCoords?.lat && userCoords?.lng) {
      fetchSummary(userCoords.lat, userCoords.lng);
      fetchAir(userCoords.lat, userCoords.lng);
      fetchNearby(userCoords.lat, userCoords.lng);
    }
  }, [userCoords, fetchSummary, fetchAir, fetchNearby]);

  // Initial load for safety data
  useEffect(() => {
    fetchSafetyData();
  }, [fetchSafetyData]);

  const navItems = [
    { id: 'home' as const, label: 'Pulse', icon: Home },
    { id: 'air' as const, label: 'Air', icon: Wind },
    { id: 'map' as const, label: 'Map', icon: Navigation },
    { id: 'insights' as const, label: 'Insights', icon: Camera },
    { id: 'assistant' as const, label: 'Ask AI', icon: Sparkles },
  ];

  return (
    <div className="w-full h-[100dvh] flex flex-col md:flex-row bg-[#fbfbf9] text-[#1c2621] overflow-hidden font-sans">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 h-full bg-[#f6f5f0]/75 backdrop-blur-2xl border-r border-[#e2e0d8]/90 p-5 shrink-0 justify-between z-20 shadow-[2px_0_16px_rgba(28,38,33,0.03)]">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#244837] to-[#3a7d5c] text-white flex items-center justify-center font-bold text-base shadow-sm ring-1 ring-[#1b382b]/20">
              TP
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-[#1c2621] block leading-tight">TerraPulse</span>
              <span className="text-[11px] text-[#4d705c] font-medium tracking-wide">Environmental Sentinel</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white/95 text-[#1b382b] border border-[#d6d3c7] shadow-xs backdrop-blur-md'
                      : 'text-[#5a6b62] hover:text-[#1c2621] hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#244837]' : 'text-[#77887e]'}`} />
                  <span>{item.label === 'Pulse' ? 'Daily Pulse' : item.label}</span>
                </button>
              );
            })}

            <button
              onClick={() => setIsPlacesDrawerOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#5a6b62] hover:text-[#1c2621] hover:bg-[#edebe4]/70 transition-all cursor-pointer"
            >
              <Bookmark className="w-4 h-4 text-[#8a7258]" />
              <span>Saved Places</span>
              {alerts.some(a => !a.is_read) && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#b8623b]" />
              )}
            </button>
          </nav>
        </div>

        {/* Quick Report CTA in Sidebar */}
        <div className="bg-[#eeece4] border border-[#dedbc8] rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div>
            <h4 className="text-xs font-bold text-[#1c2621]">Community Watch</h4>
            <p className="text-[11px] text-[#617469] mt-0.5 leading-snug">Spotted standing water or obstruction?</p>
          </div>
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="w-full py-2 bg-[#244837] hover:bg-[#1b382b] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            Report Hazard
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden relative bg-[#fbfbf9]">
        {/* Background Map View - Kept Mounted so Map state never resets */}
        <div className={`w-full h-full absolute inset-0 ${activeTab === 'map' ? 'z-10' : '-z-10 opacity-0 pointer-events-none'}`}>
          <MapView 
            targetLocation={mapTarget} 
            initialShowAqiLayer={showAqiHeatmap}
            liveAqi={airData?.indian_aqi || airData?.aqi || null}
            initialUserCoords={userCoords}
          />
        </div>

        {/* Views Container */}
        {activeTab === 'home' && (
          <div className="w-full h-full bg-[#fbfbf9]/95 z-10 relative">
            <DailyPulseView
              summary={summary}
              isLoading={isSummaryLoading}
              onNavigateToTab={(t) => {
                if (t === 'map') setShowAqiHeatmap(false);
                setActiveTab(t);
              }}
              onOpenReportModal={() => setIsReportModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'air' && (
          <div className="w-full h-full bg-[#fbfbf9]/95 z-10 relative">
            <AirQualityView
              airData={airData}
              isLoading={isAirLoading}
              userCoords={userCoords}
              onRefresh={() => {
                detectLocation();
              }}
              onViewOnMap={() => {
                setShowAqiHeatmap(true);
                const currentAqi = airData?.indian_aqi || airData?.aqi;
                const currentCat = airData?.indian_category || airData?.category || 'Atmosphere';
                setMapTarget({
                  lat: userCoords?.lat || 28.6315,
                  lng: userCoords?.lng || 77.2167,
                  title: `Live AQI: ${currentAqi} (${currentCat})`,
                });
                setActiveTab('map');
              }}
            />
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="w-full h-full bg-[#fbfbf9]/95 z-10 relative">
            <InsightsFeedView
              incidents={nearbyIncidents}
              isLoading={isIncidentsLoading}
              onRefresh={() => fetchNearby(lat, lng)}
              onLocateOnMap={(targetLat, targetLng, title) => {
                setMapTarget({ lat: targetLat, lng: targetLng, title });
                setActiveTab('map');
              }}
              onOpenReportModal={() => setIsReportModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'assistant' && (
          <div className="w-full h-full bg-[#fbfbf9]/95 z-10 relative">
            <AskAIView userCoords={userCoords} />
          </div>
        )}
      </main>

      {/* Mobile Bottom Bar - Refined Organic Glass Dock */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 h-16 glass-dock rounded-2xl px-2 flex items-center justify-around z-30 shadow-[0_8px_30px_rgba(28,38,33,0.08)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                isActive 
                  ? 'text-[#244837] font-extrabold bg-white/70 shadow-xs' 
                  : 'text-[#77887e] hover:text-[#1c2621]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-[#244837]' : 'text-[#87968e]'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Safety Drawer */}
      <SavedPlacesDrawer
        isOpen={isPlacesDrawerOpen}
        onClose={() => setIsPlacesDrawerOpen(false)}
        savedLocations={savedLocations}
        alerts={alerts}
        isLoading={isSafetyLoading}
        onAddNewPlace={() => {
          setIsPlacesDrawerOpen(false);
          setIsReportModalOpen(true);
        }}
        onDeletePlace={async (id) => {
          await fetch(`/api/user/saved-locations/${id}`, { method: 'DELETE' });
          fetchSafetyData();
        }}
        onMarkAlertRead={async (id) => {
          await fetch(`/api/user/alerts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_read: true }),
          });
          fetchSafetyData();
        }}
        onMarkAllAlertsRead={async () => {
          await fetch('/api/user/alerts', { method: 'PATCH' });
          fetchSafetyData();
        }}
        onLocatePlace={() => {
          setIsPlacesDrawerOpen(false);
          setActiveTab('map');
        }}
        onLocateAlert={() => {
          setIsPlacesDrawerOpen(false);
          setActiveTab('map');
        }}
      />

      {/* Flood Actions Modal */}
      <FloodActionsModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        currentCoords={userCoords}
        onReportSuccess={() => {
          fetchNearby(lat, lng);
          fetchSummary(lat, lng);
        }}
        onSavePlaceSuccess={() => {
          fetchSafetyData();
        }}
      />
    </div>
  );
}
