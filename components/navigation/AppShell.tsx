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

  // Data states with immediate fallback data to prevent loading lockup
  const [summary, setSummary] = useState<EnvironmentSummary>({
    location: { lat: 28.6315, lng: 77.2167, name: 'Current Observation Zone' },
    air_quality: {
      aqi: 154,
      category: 'Unhealthy',
      categoryColor: '#ef4444',
      pm2_5: 64,
      pm10: 148,
      nitrogen_dioxide: 28.4,
      ozone: 36.1,
      sulphur_dioxide: 11.2,
      carbon_monoxide: 390,
      source: 'Open-Meteo Air CAMS',
      observed_at: '2026-10-11T12:00:00.000Z',
      is_stale: false,
      advice: 'General public should reduce prolonged outdoor exertion.'
    },
    weather: {
      temperature_c: 27,
      precipitation_mm: 0,
      rain_24h_mm: 0,
      weather_code: 3,
      weather_desc: 'Partly Cloudy'
    },
    active_incidents_count: 5,
    severe_incidents_count: 3,
    freshness: 'Updated live'
  });
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const [airData, setAirData] = useState<AirQualityData>({
    aqi: 154,
    category: 'Unhealthy',
    categoryColor: '#ef4444',
    pm2_5: 64,
    pm10: 148,
    nitrogen_dioxide: 28.4,
    ozone: 36.1,
    sulphur_dioxide: 11.2,
    carbon_monoxide: 390,
    source: 'Open-Meteo Air CAMS',
    observed_at: '2026-10-11T12:00:00.000Z',
    is_stale: false,
    advice: 'General public should reduce prolonged outdoor exertion.'
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

  // Acquire GPS only once on mount without triggering re-fetch cascades
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(3));
          const lng = parseFloat(pos.coords.longitude.toFixed(3));
          setUserCoords({ lat, lng });
        },
        () => {},
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    }
  }, []);

  const lat = userCoords?.lat || 28.6315;
  const lng = userCoords?.lng || 77.2167;

  // Fetch summary
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

  // Fetch Air
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

  // Fetch Nearby
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

  // Run once on initial load
  useEffect(() => {
    fetchSummary(28.6315, 77.2167);
    fetchAir(28.6315, 77.2167);
    fetchNearby(28.6315, 77.2167);
    fetchSafetyData();
  }, []);

  const navItems = [
    { id: 'home' as const, label: 'Pulse', icon: Home },
    { id: 'air' as const, label: 'Air', icon: Wind },
    { id: 'map' as const, label: 'Map', icon: Navigation },
    { id: 'insights' as const, label: 'Insights', icon: Camera },
    { id: 'assistant' as const, label: 'Ask AI', icon: Sparkles },
  ];

  return (
    <div className="w-full h-[100dvh] flex flex-col md:flex-row bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 h-full bg-white/70 backdrop-blur-2xl border-r border-slate-200/80 p-5 shrink-0 justify-between z-20 shadow-sm">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md">
              T
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900 block">TerraPulse</span>
              <span className="text-[11px] text-teal-600 font-semibold">Environmental Intelligence</span>
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
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 border border-teal-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-teal-600' : 'text-slate-500'}`} />
                  <span>{item.label === 'Pulse' ? 'Daily Pulse' : item.label}</span>
                </button>
              );
            })}

            <button
              onClick={() => setIsPlacesDrawerOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all cursor-pointer"
            >
              <Bookmark className="w-5 h-5 text-purple-600" />
              <span>Saved Places</span>
              {alerts.some(a => !a.is_read) && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          </nav>
        </div>

        {/* Quick Report CTA in Sidebar */}
        <div className="bg-slate-100/80 border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
          <div>
            <h4 className="text-xs font-bold text-slate-900">Encountered Flooding?</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Alert your community with photo proof</p>
          </div>
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="w-full py-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Report Waterlogging
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden relative">
        {/* Background Map View - Kept Mounted so Map state never resets */}
        <div className={`w-full h-full absolute inset-0 ${activeTab === 'map' ? 'z-10' : '-z-10 opacity-0 pointer-events-none'}`}>
          <MapView />
        </div>

        {/* Views Container */}
        {activeTab === 'home' && (
          <div className="w-full h-full bg-slate-50/50 backdrop-blur-md z-10 relative">
            <DailyPulseView
              summary={summary}
              isLoading={isSummaryLoading}
              onNavigateToTab={(t) => setActiveTab(t)}
              onOpenReportModal={() => setIsReportModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'air' && (
          <div className="w-full h-full bg-slate-50/50 backdrop-blur-md z-10 relative">
            <AirQualityView
              airData={airData}
              isLoading={isAirLoading}
              onViewOnMap={() => setActiveTab('map')}
            />
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="w-full h-full bg-slate-50/50 backdrop-blur-md z-10 relative">
            <InsightsFeedView
              incidents={nearbyIncidents}
              isLoading={isIncidentsLoading}
              onRefresh={() => fetchNearby(lat, lng)}
              onLocateOnMap={(lat, lng) => {
                setActiveTab('map');
              }}
              onOpenReportModal={() => setIsReportModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'assistant' && (
          <div className="w-full h-full bg-slate-50/50 backdrop-blur-md z-10 relative">
            <AskAIView userCoords={userCoords} />
          </div>
        )}
      </main>

      {/* Mobile Floating Bottom Bar - Light Glassmorphism */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-2xl border-t border-slate-200/80 px-3 flex items-center justify-around z-30 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-teal-600 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-teal-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-1">{item.label}</span>
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
