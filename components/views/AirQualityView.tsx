'use client';

import React from 'react';
import { 
  Wind, 
  ShieldAlert, 
  Info, 
  Clock, 
  Layers,
  MapPin,
  RefreshCw,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { AirQualityData } from '@/types/api';

interface AirQualityViewProps {
  airData: AirQualityData | null;
  isLoading: boolean;
  userCoords?: { lat: number; lng: number };
  onRefresh?: () => void;
  onViewOnMap: () => void;
}

export default function AirQualityView({
  airData,
  isLoading,
  userCoords,
  onRefresh,
  onViewOnMap,
}: AirQualityViewProps) {
  if (isLoading && !airData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-400">
        <Wind className="w-8 h-8 text-teal-500 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Acquiring Atmospheric Sensors for Your Device...</p>
      </div>
    );
  }

  if (!airData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <p className="text-sm">Atmospheric data unavailable for current coordinates.</p>
        {onRefresh && (
          <button 
            onClick={onRefresh}
            className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold"
          >
            Retry
          </button>
        )}
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

  const formatCoord = (coord?: number) => (coord !== undefined ? coord.toFixed(4) : '--');

  return (
    <div className="w-full h-full overflow-y-auto px-4 py-5 md:px-8 max-w-4xl mx-auto space-y-5 pb-24 md:pb-10 scrollbar-none">
      {/* Dynamic Header & Location Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e0d8] pb-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#1c2621] flex items-center gap-2">
            <Wind className="w-5 h-5 text-[#244837]" />
            Atmospheric Quality Monitor
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#617469] mt-1 font-medium">
            <span className="flex items-center gap-1 font-semibold text-[#1c2621]">
              <MapPin className="w-3.5 h-3.5 text-[#3a7d5c]" />
              {airData.location_name
                ? airData.location_name
                : userCoords
                ? `${formatCoord(userCoords.lat)}° N, ${formatCoord(userCoords.lng)}° E (Device GPS)`
                : 'Observation Zone (28.63° N, 77.22° E)'}
            </span>
            <span className="text-[#a8b3ac]">•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#87968e]" />
              {new Date(airData.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white hover:bg-[#f6f5f0] text-[#1c2621] border border-[#e2e0d8] rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Refresh Live Sensor Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#617469] ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Sensors</span>
            </button>
          )}
          <button
            onClick={onViewOnMap}
            className="px-3 py-1.5 bg-[#244837] hover:bg-[#1b382b] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Map Dispersion</span>
          </button>
        </div>
      </div>

      {/* Main AQI Gauge Card */}
      <div 
        className="glass-panel rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6"
        style={{ 
          borderLeftWidth: '6px',
          borderLeftColor: airData.indian_category_color || airData.categoryColor,
        }}
      >
        <div className="text-center md:text-left space-y-2 w-full md:w-auto">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#55695d]">
            Local Standard Atmospheric Index
          </span>
          <div className="flex items-center justify-center md:justify-start gap-4">
            <span 
              className="text-6xl md:text-7xl font-black tracking-tight drop-shadow-xs"
              style={{ color: airData.indian_category_color || airData.categoryColor }}
            >
              {airData.indian_aqi || airData.aqi}
            </span>
            <div className="text-left">
              <span 
                className="text-xs md:text-sm font-extrabold px-3 py-1 rounded-lg border inline-block shadow-xs"
                style={{ 
                  color: airData.indian_category_color || airData.categoryColor, 
                  backgroundColor: `${airData.indian_category_color || airData.categoryColor}15`,
                  borderColor: `${airData.indian_category_color || airData.categoryColor}35`
                }}
              >
                {airData.indian_category || airData.category}
              </span>
              <p className="text-[11px] text-[#617469] mt-1 font-mono">
                India CPCB NAQI <span className="text-[#a8b3ac]">|</span> {airData.aqi} US-EPA
              </p>
            </div>
          </div>
          <p className="text-xs text-[#3a4d41] max-w-lg mt-2 leading-relaxed font-normal">
            {airData.advice}
          </p>
        </div>

        {/* Dynamic Health Recommendation Badges */}
        <div className="glass-panel-subtle rounded-2xl p-4.5 border border-[#e6e4da] w-full md:w-80 space-y-2.5 shrink-0 shadow-xs">
          <span className="text-[10px] font-extrabold text-[#55695d] uppercase tracking-wider block border-b border-[#eceae1] pb-1.5">
            Clinical Health Guidance
          </span>
          {airData.guidance && airData.guidance.length > 0 ? (
            airData.guidance.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-[#24332a]">
                {item.icon === 'mask' && <ShieldAlert className="w-4 h-4 text-[#b8623b] shrink-0 mt-0.5" />}
                {item.icon === 'window' && <Info className="w-4 h-4 text-[#3a7d5c] shrink-0 mt-0.5" />}
                {item.icon === 'outdoor' && <CheckCircle2 className="w-4 h-4 text-[#244837] shrink-0 mt-0.5" />}
                {item.icon === 'check' && <Sparkles className="w-4 h-4 text-[#3a7d5c] shrink-0 mt-0.5" />}
                <span className="leading-snug font-medium">{item.text}</span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-start gap-2.5 text-xs text-[#24332a]">
                <ShieldAlert className="w-4 h-4 text-[#b8623b] shrink-0 mt-0.5" />
                <span className="font-medium">Sensitive groups: wear masks outdoors</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#24332a]">
                <Info className="w-4 h-4 text-[#3a7d5c] shrink-0 mt-0.5" />
                <span className="font-medium">Keep windows closed during peak traffic</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 6-Pollutants Matrix Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black text-[#1c2621] uppercase tracking-wider">
            Speciation & Particulate Concentrations
          </h2>
          <span className="text-[10px] text-[#77887e] font-mono">Real-time Sensor Readings</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-3.5">
          {pollutants.map((item) => {
            // Dynamic WHO benchmark assessment
            let statusBadge = { text: 'Optimal', bg: '#eef8f2', color: '#16a34a', border: '#bcf0ce' };
            if (item.name === 'PM2.5') {
              if (item.val > 60) statusBadge = { text: 'Severe', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
              else if (item.val > 15) statusBadge = { text: 'Elevated', bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
            } else if (item.name === 'PM10') {
              if (item.val > 100) statusBadge = { text: 'Severe', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
              else if (item.val > 45) statusBadge = { text: 'Elevated', bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
            } else if (item.name === 'NO₂') {
              if (item.val > 50) statusBadge = { text: 'Severe', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
              else if (item.val > 25) statusBadge = { text: 'Elevated', bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
            } else if (item.name === 'O₃') {
              if (item.val > 140) statusBadge = { text: 'Severe', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
              else if (item.val > 100) statusBadge = { text: 'Elevated', bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
            } else if (item.name === 'SO₂') {
              if (item.val > 40) statusBadge = { text: 'Elevated', bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
            } else if (item.name === 'CO') {
              // Open-Meteo reports in ug/m3 (WHO 24h limit is 4 mg/m3 = 4000 ug/m3)
              if (item.val > 4000) statusBadge = { text: 'Elevated', bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
            }

            return (
              <div 
                key={item.name}
                className="glass-card rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#1c2621] font-mono tracking-tight">{item.name}</span>
                    <span 
                      className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shadow-2xs"
                      style={{ 
                        backgroundColor: statusBadge.bg, 
                        color: statusBadge.color, 
                        borderColor: statusBadge.border 
                      }}
                    >
                      {statusBadge.text}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#55695d] mt-1.5 line-clamp-1 font-medium">{item.label}</p>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-[#1c2621] font-mono tracking-tight">{item.val}</span>
                    <span className="text-[11px] text-[#617469] font-mono">{item.unit}</span>
                  </div>
                  <span className="text-[10px] text-[#77887e] block mt-1 font-medium">WHO Limit: {item.limit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scale Reference Guide */}
      <div className="bg-[#1b382b] text-white rounded-xl p-4 border border-[#142a20] shadow-xs space-y-3">
        <div>
          <h3 className="text-[10px] font-bold text-[#b4cabe] uppercase tracking-wider mb-2 font-mono">India National AQI Scale (CPCB)</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-[10px] font-semibold">
            <div className="p-2 rounded-lg bg-[#244837] text-[#9ae6b4] border border-[#2d5843]">0 - 50<br/><span className="font-normal text-[9px]">Good</span></div>
            <div className="p-2 rounded-lg bg-[#334b28] text-[#d9f99d] border border-[#446635]">51 - 100<br/><span className="font-normal text-[9px]">Satisfactory</span></div>
            <div className="p-2 rounded-lg bg-[#3d3a1f] text-[#fefcbf] border border-[#524e29]">101 - 200<br/><span className="font-normal text-[9px]">Moderate</span></div>
            <div className="p-2 rounded-lg bg-[#4a341b] text-[#feebc8] border border-[#634524]">201 - 300<br/><span className="font-normal text-[9px]">Poor</span></div>
            <div className="p-2 rounded-lg bg-[#4d2320] text-[#fed7d7] border border-[#6b312d]">301 - 400<br/><span className="font-normal text-[9px]">Very Poor</span></div>
            <div className="p-2 rounded-lg bg-[#33141b] text-[#fbb6ce] border border-[#4d1f29]">401 - 500<br/><span className="font-normal text-[9px]">Severe</span></div>
          </div>
        </div>
        <div className="pt-2 border-t border-[#2d5843]/40 flex items-center justify-between text-[10px] text-[#a8b3ac]">
          <span>Derived live from Open-Meteo European CAMS atmospheric sensors</span>
          <span>Standards: Indian CPCB & US-EPA</span>
        </div>
      </div>
    </div>
  );
}
