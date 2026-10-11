'use client';

import React from 'react';
import { 
  CloudRain, 
  Wind, 
  AlertTriangle, 
  Navigation, 
  ShieldCheck, 
  Activity,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  Compass,
  Droplets
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
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-[#77887e]">
        <Activity className="w-7 h-7 text-[#3a7d5c] animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wide uppercase">Reading Local Telemetry...</p>
      </div>
    );
  }

  const { air_quality, weather, active_incidents_count, severe_incidents_count } = summary;

  return (
    <div className="w-full h-full overflow-y-auto px-4 py-6 md:px-8 max-w-4xl mx-auto space-y-6 pb-28 md:pb-10 scrollbar-none">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e0d8] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3a7d5c] ring-4 ring-[#3a7d5c]/20" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#1c2621]">
              Environmental Field Status
            </h1>
          </div>
          <p className="text-xs text-[#617469] mt-1 flex items-center gap-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-[#3a7d5c]" />
            <span>{summary.location.name}</span>
            <span className="text-[#a8b3ac]">•</span>
            <span>{summary.freshness}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenReportModal}
            className="px-3.5 py-2 bg-[#244837] hover:bg-[#1b382b] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>File Water Report</span>
          </button>
        </div>
      </div>

      {/* Primary Telemetry Duo: Atmospheric Quality & Surface Inundation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
        {/* Air Quality Station Card */}
        <div 
          onClick={() => onNavigateToTab('air')}
          className="glass-card rounded-3xl p-5.5 cursor-pointer group relative flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-xl bg-[#244837]/10 text-[#244837] flex items-center justify-center">
                  <Wind className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-[#55695d] uppercase tracking-wider block">Atmosphere</span>
                  <h3 className="text-xs font-black text-[#1c2621]">Air Purity Gauge</h3>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#a8b3ac] group-hover:text-[#244837] group-hover:translate-x-1 transition-all" />
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span 
                className="text-4xl md:text-5xl font-black tracking-tight"
                style={{ color: air_quality.indian_category_color || air_quality.categoryColor }}
              >
                {air_quality.indian_aqi || air_quality.aqi}
              </span>
              <div className="flex flex-col">
                <span 
                  className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg inline-block border w-fit shadow-2xs"
                  style={{ 
                    color: air_quality.indian_category_color || air_quality.categoryColor, 
                    backgroundColor: `${air_quality.indian_category_color || air_quality.categoryColor}15`,
                    borderColor: `${air_quality.indian_category_color || air_quality.categoryColor}35`
                  }}
                >
                  {air_quality.indian_category || air_quality.category}
                </span>
                <span className="text-[10px] text-[#77887e] mt-1 font-mono">
                  India NAQI ({air_quality.aqi} US-AQI)
                </span>
              </div>
            </div>

            <p className="text-xs text-[#3a4d41] mt-3.5 line-clamp-2 leading-relaxed glass-panel-subtle p-3 rounded-2xl border border-[#eceae1]">
              {air_quality.advice}
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-[#eceae1] flex items-center justify-between text-[11px] text-[#617469]">
            <span>PM2.5: <strong className="text-[#1c2621] font-mono">{air_quality.pm2_5} µg/m³</strong></span>
            <span>PM10: <strong className="text-[#1c2621] font-mono">{air_quality.pm10} µg/m³</strong></span>
            <span className="text-[#244837] font-bold group-hover:underline">Inspect →</span>
          </div>
        </div>

        {/* Surface Inundation & Precipitation Card */}
        <div 
          onClick={() => onNavigateToTab('map')}
          className="glass-card rounded-3xl p-5.5 cursor-pointer group relative flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-xl bg-[#2c5364]/10 text-[#2c5364] flex items-center justify-center">
                  <Droplets className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-[#55695d] uppercase tracking-wider block">Hydro Surface</span>
                  <h3 className="text-xs font-black text-[#1c2621]">Drainage & Flood Alerts</h3>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#a8b3ac] group-hover:text-[#2c5364] group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl md:text-5xl font-black text-[#1c2621]">
                {active_incidents_count}
              </span>
              <div className="flex flex-col">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md inline-block border w-fit ${
                  severe_incidents_count > 0 
                    ? 'text-[#9b2c2c] bg-[#fff5f5] border-[#feb2b2]' 
                    : active_incidents_count > 0 
                      ? 'text-[#975a16] bg-[#fffaf0] border-[#fbd38d]'
                      : 'text-[#22543d] bg-[#f0fff4] border-[#9ae6b4]'
                }`}>
                  {severe_incidents_count > 0 ? `${severe_incidents_count} Severe Hazards` : active_incidents_count > 0 ? 'Active Street Incidents' : 'Normal Surface Flow'}
                </span>
                <span className="text-[10px] text-[#77887e] mt-1 font-mono">10km perimeter</span>
              </div>
            </div>

            <div className="mt-3 bg-[#f8f7f4] p-2.5 rounded-xl border border-[#eceae1] flex items-center justify-between text-xs text-[#405247]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#77887e]">Rainfall (24h):</span>
                <strong className="text-[#2c5364]">{weather.rain_24h_mm} mm</strong>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[#77887e]">Conditions:</span>
                <span className="text-[#1c2621] font-semibold">{weather.weather_desc}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#f0eee6] flex items-center justify-between text-[11px] text-[#617469]">
            <span>Community verified</span>
            <span className="text-[#2c5364] font-bold group-hover:underline">Open Map View →</span>
          </div>
        </div>
      </div>

      {/* Field Operations Menu */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={() => onNavigateToTab('map')}
          className="bg-white hover:bg-[#f6f5f0] border border-[#e2e0d8] p-3.5 rounded-xl text-left transition-all active:scale-95 shadow-xs group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-[#f0f4f1] text-[#244837] flex items-center justify-center mb-2">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-bold text-[#1c2621]">Topographic Map</h4>
          <p className="text-[10px] text-[#77887e] mt-0.5">Hydrologic layers</p>
        </button>

        <button
          onClick={() => onNavigateToTab('insights')}
          className="bg-white hover:bg-[#f6f5f0] border border-[#e2e0d8] p-3.5 rounded-xl text-left transition-all active:scale-95 shadow-xs group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-[#edf3f6] text-[#2c5364] flex items-center justify-center mb-2">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-bold text-[#1c2621]">Citizen Dispatch</h4>
          <p className="text-[10px] text-[#77887e] mt-0.5">Live photo feed</p>
        </button>

        <button
          onClick={() => onNavigateToTab('places')}
          className="bg-white hover:bg-[#f6f5f0] border border-[#e2e0d8] p-3.5 rounded-xl text-left transition-all active:scale-95 shadow-xs group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-[#f6f0eb] text-[#8a7258] flex items-center justify-center mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-bold text-[#1c2621]">Safety Watchlist</h4>
          <p className="text-[10px] text-[#77887e] mt-0.5">Home & Work routes</p>
        </button>

        <button
          onClick={() => onNavigateToTab('air')}
          className="bg-white hover:bg-[#f6f5f0] border border-[#e2e0d8] p-3.5 rounded-xl text-left transition-all active:scale-95 shadow-xs group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-[#fdf5eb] text-[#975a16] flex items-center justify-center mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-bold text-[#1c2621]">Sensor Arrays</h4>
          <p className="text-[10px] text-[#77887e] mt-0.5">6-pollutant analysis</p>
        </button>
      </div>

      {/* Field Provenance Disclaimer */}
      <div className="bg-[#f6f5f0] border border-[#dedbc8] rounded-xl p-3 text-xs text-[#526459] flex items-start gap-2 shadow-xs">
        <ShieldCheck className="w-4 h-4 text-[#3a7d5c] shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong>Sentinel Ground Truth:</strong> Sensor values reflect direct Open-Meteo European CAMS reanalyses merged with local citizen hydrological reports.
        </p>
      </div>
    </div>
  );
}
