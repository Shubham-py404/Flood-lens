'use client';

import React from 'react';
import { 
  Wind, 
  ShieldAlert, 
  Info, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers
} from 'lucide-react';
import { AirQualityData } from '@/types/api';

interface AirQualityViewProps {
  airData: AirQualityData | null;
  isLoading: boolean;
  onViewOnMap: () => void;
}

export default function AirQualityView({
  airData,
  isLoading,
  onViewOnMap,
}: AirQualityViewProps) {
  if (isLoading || !airData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-400">
        <Wind className="w-8 h-8 text-teal-400 animate-spin mb-3" />
        <p className="text-sm font-medium">Fetching Atmospheric Readings...</p>
      </div>
    );
  }

  const pollutants = [
    { name: 'PM2.5', label: 'Fine Inhalable Particles', val: airData.pm2_5, unit: 'µg/m³', limit: '15 µg/m³ (WHO)' },
    { name: 'PM10', label: 'Coarse Particulate Matter', val: airData.pm10, unit: 'µg/m³', limit: '45 µg/m³ (WHO)' },
    { name: 'NO₂', label: 'Nitrogen Dioxide', val: airData.nitrogen_dioxide, unit: 'µg/m³', limit: '25 µg/m³ (WHO)' },
    { name: 'O₃', label: 'Surface Ozone', val: airData.ozone, unit: 'µg/m³', limit: '100 µg/m³ (WHO)' },
    { name: 'SO₂', label: 'Sulphur Dioxide', val: airData.sulphur_dioxide, unit: 'µg/m³', limit: '40 µg/m³ (WHO)' },
    { name: 'CO', label: 'Carbon Monoxide', val: airData.carbon_monoxide, unit: 'µg/m³', limit: '4 mg/m³ (WHO)' },
  ];

  return (
    <div className="w-full h-full overflow-y-auto px-4 py-6 md:px-8 max-w-4xl mx-auto space-y-6 pb-28 md:pb-10 scrollbar-none">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Wind className="w-6 h-6 text-teal-600" />
            Air Quality Intelligence
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Source: {airData.source} • Observed: {new Date(airData.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={onViewOnMap}
          className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-teal-700 border border-teal-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all w-fit cursor-pointer shadow-xs"
        >
          <Layers className="w-4 h-4" />
          View Heatmap on Map
        </button>
      </div>

      {/* Main AQI Gauge Card */}
      <div 
        className="rounded-3xl p-6 md:p-8 border shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6"
        style={{ 
          background: `radial-gradient(circle at top left, ${airData.categoryColor}10, rgba(255, 255, 255, 0.95))`,
          borderColor: `${airData.categoryColor}30`
        }}
      >
        <div className="text-center md:text-left space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Current Air Quality Index</span>
          <div className="flex items-center justify-center md:justify-start gap-4">
            <span 
              className="text-6xl md:text-7xl font-black tracking-tight"
              style={{ color: airData.categoryColor }}
            >
              {airData.aqi}
            </span>
            <div className="text-left">
              <span 
                className="text-sm md:text-base font-bold px-3 py-1 rounded-full border inline-block"
                style={{ 
                  color: airData.categoryColor, 
                  backgroundColor: `${airData.categoryColor}15`,
                  borderColor: `${airData.categoryColor}40`
                }}
              >
                {airData.category}
              </span>
              <p className="text-xs text-slate-500 mt-1">Based on US AQI Standard</p>
            </div>
          </div>
          <p className="text-xs md:text-sm text-slate-700 max-w-lg mt-3 leading-relaxed">
            {airData.advice}
          </p>
        </div>

        {/* Quick Health Recommendation Badges */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 w-full md:w-64 space-y-2.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-1">
            Health Guidance
          </span>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Sensitive groups: wear masks outdoors</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Info className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Keep windows closed during peak traffic</span>
          </div>
        </div>
      </div>

      {/* 6-Pollutants Matrix Grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Key Pollutant Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {pollutants.map((item) => (
            <div 
              key={item.name}
              className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900">{item.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{item.unit}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.label}</p>
              </div>

              <div className="mt-4">
                <span className="text-2xl font-bold text-teal-700">{item.val}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Ref: {item.limit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scale Reference Guide */}
      <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/40">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">AQI Scale Guide</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-[10px] font-semibold">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">0 - 50<br/><span className="font-normal">Good</span></div>
          <div className="p-2 rounded-xl bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">51 - 100<br/><span className="font-normal">Moderate</span></div>
          <div className="p-2 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30">101 - 150<br/><span className="font-normal">Sensitive</span></div>
          <div className="p-2 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30">151 - 200<br/><span className="font-normal">Unhealthy</span></div>
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">201 - 300<br/><span className="font-normal">Very Unhealthy</span></div>
          <div className="p-2 rounded-xl bg-rose-950 text-rose-300 border border-rose-800">300+<br/><span className="font-normal">Hazardous</span></div>
        </div>
      </div>
    </div>
  );
}
