'use client';

import React from 'react';
import { 
  CloudRain, 
  Wind, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Navigation, 
  ShieldCheck, 
  Activity,
  ArrowRight,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { EnvironmentSummary } from '@/types/api';

interface DailyPulseViewProps {
  summary: EnvironmentSummary | null;
  isLoading: boolean;
  onNavigateToTab: (tab: 'map' | 'air' | 'insights' | 'places') => void;
  onOpenReportModal: () => void;
}

export default function DailyPulseView({
  summary,
  isLoading,
  onNavigateToTab,
  onOpenReportModal,
}: DailyPulseViewProps) {
  if (isLoading || !summary) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-400">
        <Activity className="w-8 h-8 text-teal-400 animate-spin mb-3" />
        <p className="text-sm font-medium">Aggregating live environmental pulse...</p>
      </div>
    );
  }

  const { air_quality, weather, active_incidents_count, severe_incidents_count } = summary;

  return (
    <div className="w-full h-full overflow-y-auto px-4 py-6 md:px-8 max-w-4xl mx-auto space-y-6 pb-28 md:pb-10 scrollbar-none">
      {/* Header with Title and Freshness Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Daily Environmental Pulse</h1>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-teal-600" />
            {summary.location.name} • {summary.freshness}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenReportModal}
            className="px-4 py-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white rounded-xl text-xs md:text-sm font-semibold shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            Report Waterlogging
          </button>
        </div>
      </div>

      {/* Hero Grid: Air Quality + Flood Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Air Quality Hero Card */}
        <div 
          onClick={() => onNavigateToTab('air')}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-400/60 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Air Quality</span>
                <h3 className="text-sm font-bold text-slate-800">Current Atmosphere</h3>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span 
              className="text-4xl md:text-5xl font-black tracking-tight"
              style={{ color: air_quality.categoryColor }}
            >
              {air_quality.aqi}
            </span>
            <div className="flex flex-col">
              <span 
                className="text-xs md:text-sm font-bold px-2.5 py-0.5 rounded-full inline-block border w-fit"
                style={{ 
                  color: air_quality.categoryColor, 
                  backgroundColor: `${air_quality.categoryColor}15`,
                  borderColor: `${air_quality.categoryColor}40`
                }}
              >
                {air_quality.category}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">US AQI Standard</span>
            </div>
          </div>

          <p className="text-xs text-slate-700 mt-3 line-clamp-2 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
            {air_quality.advice}
          </p>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>PM2.5: <strong className="text-slate-800">{air_quality.pm2_5} µg/m³</strong></span>
            <span>PM10: <strong className="text-slate-800">{air_quality.pm10} µg/m³</strong></span>
            <span className="text-teal-600 font-semibold group-hover:underline">View details →</span>
          </div>
        </div>

        {/* Flood & Rain Status Card */}
        <div 
          onClick={() => onNavigateToTab('map')}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-400/60 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <CloudRain className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Waterlogging</span>
                <h3 className="text-sm font-bold text-slate-800">Street-Level Floods</h3>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-4xl md:text-5xl font-black text-slate-900">
              {active_incidents_count}
            </span>
            <div className="flex flex-col">
              <span className={`text-xs md:text-sm font-bold px-2.5 py-0.5 rounded-full inline-block border w-fit ${
                severe_incidents_count > 0 
                  ? 'text-red-700 bg-red-50 border-red-200' 
                  : active_incidents_count > 0 
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
              }`}>
                {severe_incidents_count > 0 ? `${severe_incidents_count} Severe Hazards` : active_incidents_count > 0 ? 'Active Reports' : 'Roads Clear'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">Within observation perimeter</span>
            </div>
          </div>

          <div className="mt-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Rainfall (24h):</span>
              <strong className="text-blue-600">{weather.rain_24h_mm} mm</strong>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span>Forecast:</span>
              <span className="text-slate-800 font-medium">{weather.weather_desc}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Live Community Corroborations</span>
            <span className="text-blue-600 font-semibold group-hover:underline">Inspect on Map →</span>
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigateToTab('map')}
          className="bg-white/80 hover:bg-white border border-slate-200/80 p-4 rounded-xl text-left transition-all active:scale-95 shadow-xs hover:shadow-sm group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Navigation className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">Interactive Map</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Explore risk layers</p>
        </button>

        <button
          onClick={() => onNavigateToTab('insights')}
          className="bg-white/80 hover:bg-white border border-slate-200/80 p-4 rounded-xl text-left transition-all active:scale-95 shadow-xs hover:shadow-sm group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Clock className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">Nearby Feed</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Photo evidence stream</p>
        </button>

        <button
          onClick={() => onNavigateToTab('places')}
          className="bg-white/80 hover:bg-white border border-slate-200/80 p-4 rounded-xl text-left transition-all active:scale-95 shadow-xs hover:shadow-sm group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">Saved Places</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Home & Work watchlists</p>
        </button>

        <button
          onClick={() => onNavigateToTab('air')}
          className="bg-white/80 hover:bg-white border border-slate-200/80 p-4 rounded-xl text-left transition-all active:scale-95 shadow-xs hover:shadow-sm group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">Air Analytics</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Pollutants & health tips</p>
        </button>
      </div>

      {/* Grounding & Provenance Footer */}
      <div className="bg-white/70 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5 shadow-xs">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Data Trust & Provenance:</strong> Environmental metrics are sourced from Open-Meteo CAMS Ensemble models and verified citizen photo evidence.
        </p>
      </div>
    </div>
  );

}
