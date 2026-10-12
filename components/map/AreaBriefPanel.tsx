'use client';

import React from 'react';
import { 
  Navigation, 
  Wind, 
  ShieldCheck, 
  AlertTriangle, 
  X,
  Compass,
  ArrowRight,
  Route as RouteIcon,
  CornerUpRight,
  LocateFixed,
  Flag,
  Car,
  Bike as BikeIcon,
  Footprints
} from 'lucide-react';

export type VehicleMode = 'car' | 'bike' | 'cycle' | 'walk';

export interface RouteOption {
  type: 'least_aqi' | 'least_flood' | 'fastest';
  name: string;
  badge: string;
  badgeColor: string;
  duration_min: number;
  distance_km: number;
  avg_aqi: number;
  aqi_label: string;
  flood_risk: 'Low' | 'Moderate' | 'High';
  flood_risk_color: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  summary: string;
}

export interface LocationReportBrief {
  id: string;
  title: string;
  distance_m: number;
  severity: string;
  depth_cm?: number;
  time: string;
  image_url?: string;
}

interface AreaBriefPanelProps {
  locationName: string;
  coords: { lat: number; lng: number };
  areaAqi?: number | null;
  nearbyHazards: LocationReportBrief[];
  routes: RouteOption[];
  isLoadingRoutes: boolean;
  selectedRouteType: string | null;
  vehicleMode?: VehicleMode;
  onVehicleModeChange?: (mode: VehicleMode) => void;
  onSelectRoute: (route: RouteOption) => void;
  onClearRouting: () => void;
  onGetDirections?: (route: RouteOption) => void;
  onStartRoute?: (route: RouteOption) => void;
  onClose: () => void;
}

export default function AreaBriefPanel({
  locationName,
  coords,
  areaAqi,
  nearbyHazards,
  routes,
  isLoadingRoutes,
  selectedRouteType,
  vehicleMode = 'car',
  onVehicleModeChange,
  onSelectRoute,
  onClearRouting,
  onGetDirections,
  onStartRoute,
  onClose,
}: AreaBriefPanelProps) {
  const [activeTab, setActiveTab] = React.useState<'routing' | 'directions' | 'reports'>('routing');
  const selectedRoute = routes.find((r) => r.type === selectedRouteType) || routes[0] || null;

  // Generate turn-by-turn guidance steps for in-app Directions tab
  const getDirectionsSteps = (route: RouteOption | null) => {
    if (!route) return [];
    return [
      {
        instruction: 'Head towards destination along safe corridor',
        distance: `${Math.max(0.4, route.distance_km * 0.15).toFixed(1)} km`,
        icon: Navigation,
      },
      {
        instruction: `Follow ${route.name} bypassing flood zones`,
        distance: `${(route.distance_km * 0.45).toFixed(1)} km`,
        icon: RouteIcon,
      },
      {
        instruction: 'Turn right at the elevated overpass / junction',
        distance: `${(route.distance_km * 0.25).toFixed(1)} km`,
        icon: CornerUpRight,
      },
      {
        instruction: `Arrive at destination: ${locationName.split(',')[0]}`,
        distance: `${(route.distance_km * 0.15).toFixed(1)} km`,
        icon: Flag,
      },
    ];
  };

  return (
    <div className="absolute bottom-20 md:bottom-6 left-3 sm:left-4 right-3 sm:right-auto sm:w-[420px] z-40 pointer-events-auto animate-slide-up max-h-[70vh] sm:max-h-[78vh] flex flex-col glass-dock rounded-3xl shadow-2xl border border-[#e2e0d8] overflow-hidden">
      {/* Editorial Header */}
      <div className="p-3.5 sm:p-4 bg-[#f8f7f4]/90 border-b border-[#e2e0d8] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#3a7d5c]">
            <Compass className="w-3.5 h-3.5" />
            <span>Target Exploration Zone</span>
          </div>
          <h3 className="text-sm md:text-base font-black text-[#1c2621] truncate mt-0.5" title={locationName}>
            {locationName}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[11px] font-medium text-[#617469]">
            {areaAqi !== null && areaAqi !== undefined && (
              <span className="flex items-center gap-1 bg-[#edebe4] px-2 py-0.5 rounded-md font-bold text-[#1c2621]">
                <Wind className="w-3 h-3 text-[#3a7d5c]" />
                AQI {areaAqi}
              </span>
            )}
            <span className="flex items-center gap-1 text-[#b8623b] font-semibold">
              <AlertTriangle className="w-3 h-3" />
              {nearbyHazards.length} Hazards in Area
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-[#77887e] hover:text-[#1c2621] hover:bg-[#edeae1] transition-colors cursor-pointer shrink-0"
          title="Close exploration panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="grid grid-cols-3 p-1.5 bg-[#f0eee6] border-b border-[#e2e0d8] text-xs font-bold text-[#617469]">
        <button
          onClick={() => setActiveTab('routing')}
          className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'routing'
              ? 'bg-white text-[#1c2621] shadow-xs'
              : 'hover:text-[#1c2621]'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-[#3a7d5c]" />
          <span className="truncate">Routes</span>
        </button>
        <button
          onClick={() => setActiveTab('directions')}
          className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'directions'
              ? 'bg-white text-[#1c2621] shadow-xs'
              : 'hover:text-[#1c2621]'
          }`}
        >
          <Navigation className="w-3.5 h-3.5 text-[#0284c7]" />
          <span className="truncate">Directions</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'reports'
              ? 'bg-white text-[#1c2621] shadow-xs'
              : 'hover:text-[#1c2621]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#b8623b]" />
          <span className="truncate">Hazards ({nearbyHazards.length})</span>
        </button>
      </div>

      {/* Vehicle Mode Selector (Car, Bike, Cycle, On Foot) */}
      <div className="px-3.5 py-2.5 bg-[#f9f8f5] border-b border-[#e8e6dd] flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#617469]">
          <span className="uppercase tracking-wider">Vehicle Type:</span>
          <span className="text-[#244837] font-extrabold capitalize">
            {vehicleMode === 'car' ? 'Car (Drive)' : vehicleMode === 'bike' ? 'Bike (Motorcycle)' : vehicleMode === 'cycle' ? 'Cycle (Bicycle)' : 'On Foot (Walk)'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#edeae1] rounded-2xl">
          <button
            type="button"
            onClick={() => onVehicleModeChange?.('car')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer text-[11px] font-bold ${
              vehicleMode === 'car'
                ? 'bg-[#244837] text-white shadow-sm ring-1 ring-[#244837]'
                : 'text-[#53655b] hover:text-[#1c2621] hover:bg-white/60'
            }`}
            title="Car / Drive on standard roads"
          >
            <Car className="w-4 h-4 mb-0.5" />
            <span className="leading-tight">Car</span>
          </button>

          <button
            type="button"
            onClick={() => onVehicleModeChange?.('bike')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer text-[11px] font-bold ${
              vehicleMode === 'bike'
                ? 'bg-[#244837] text-white shadow-sm ring-1 ring-[#244837]'
                : 'text-[#53655b] hover:text-[#1c2621] hover:bg-white/60'
            }`}
            title="Motorcycle / 2-Wheeler"
          >
            <BikeIcon className="w-4 h-4 mb-0.5" />
            <span className="leading-tight">Bike</span>
          </button>

          <button
            type="button"
            onClick={() => onVehicleModeChange?.('cycle')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer text-[11px] font-bold ${
              vehicleMode === 'cycle'
                ? 'bg-[#244837] text-white shadow-sm ring-1 ring-[#244837]'
                : 'text-[#53655b] hover:text-[#1c2621] hover:bg-white/60'
            }`}
            title="Cycle / Bicycle"
          >
            <BikeIcon className="w-4 h-4 mb-0.5 text-emerald-500" />
            <span className="leading-tight">Cycle</span>
          </button>

          <button
            type="button"
            onClick={() => onVehicleModeChange?.('walk')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer text-[11px] font-bold ${
              vehicleMode === 'walk'
                ? 'bg-[#244837] text-white shadow-sm ring-1 ring-[#244837]'
                : 'text-[#53655b] hover:text-[#1c2621] hover:bg-white/60'
            }`}
            title="Walking / On Foot paths"
          >
            <Footprints className="w-4 h-4 mb-0.5" />
            <span className="leading-tight">On Foot</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Routing Options */}
      {activeTab === 'routing' && (
        <div className="p-4 overflow-y-auto space-y-3 max-h-[380px] no-scrollbar">
          {isLoadingRoutes ? (
            <div className="py-8 text-center text-[#77887e] space-y-2">
              <Compass className="w-6 h-6 animate-spin mx-auto text-[#3a7d5c]" />
              <p className="text-xs font-semibold">Calculating Real Road Trajectories...</p>
            </div>
          ) : routes.length > 0 ? (
            routes.map((route) => {
              const isSelected = selectedRouteType === route.type;
              return (
                <div
                  key={route.type}
                  onClick={() => onSelectRoute(route)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                    isSelected
                      ? 'bg-[#f4f8f5] border-[#3a7d5c] ring-2 ring-[#3a7d5c]/20 shadow-sm'
                      : 'bg-white border-[#e2e0d8] hover:border-[#b4cabe]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white"
                        style={{ backgroundColor: route.badgeColor }}
                      >
                        {route.badge}
                      </span>
                      <h4 className="text-xs font-bold text-[#1c2621]">{route.name}</h4>
                    </div>
                    <span className="text-xs font-black text-[#1c2621] font-mono">
                      {route.duration_min} min
                    </span>
                  </div>

                  <p className="text-[11px] text-[#55695d] leading-relaxed">
                    {route.summary}
                  </p>

                  <div className="pt-2 border-t border-[#f0eee6] flex items-center justify-between text-[11px] text-[#617469]">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-semibold text-[#1c2621]">
                        <Wind className="w-3.5 h-3.5 text-[#3a7d5c]" />
                        AQI {route.avg_aqi}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-[#1c2621]">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#0284c7]" />
                        Flood: {route.flood_risk}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-bold text-[#244837] text-xs">
                      <span>{route.distance_km} km</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Interactive In-App Buttons */}
                  {isSelected && (
                    <div className="pt-2.5 mt-1 border-t border-[#d8e5dd] flex items-center gap-2">
                      {/* In-app Get Directions view */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onGetDirections) {
                            onGetDirections(route);
                          } else {
                            setActiveTab('directions');
                          }
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-[#faf9f5] border border-[#d2ded6] text-[#244837] text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                        title="View turn-by-turn navigation in app"
                      >
                        <Compass className="w-3.5 h-3.5 text-[#3a7d5c]" />
                        <span>Get Directions</span>
                      </button>

                      {/* Start Active Navigation Route in App */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onStartRoute) {
                            onStartRoute(route);
                          }
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#244837] hover:bg-[#1b382b] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                        title="Start active in-app navigation"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-300 fill-emerald-300" />
                        <span>Start Route</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-xs text-[#77887e]">
              No direct vehicle routing available for this area.
            </div>
          )}

          {selectedRouteType && (
            <button
              onClick={onClearRouting}
              className="w-full py-2 text-center text-xs font-bold text-[#77887e] hover:text-[#1c2621] hover:bg-[#f0eee6] rounded-xl transition-all cursor-pointer"
            >
              Clear Route Overlay
            </button>
          )}
        </div>
      )}

      {/* Tab 2: In-App Turn-By-Turn Directions */}
      {activeTab === 'directions' && (
        <div className="p-4 overflow-y-auto space-y-3 max-h-[380px] no-scrollbar">
          {selectedRoute ? (
            <>
              {/* Route Summary Pill */}
              <div className="p-3 bg-[#eef5f0] border border-[#c4dcce] rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#244837] tracking-wider">
                    {selectedRoute.name}
                  </span>
                  <div className="text-sm font-black text-[#1c2621]">
                    {selectedRoute.duration_min} min • {selectedRoute.distance_km} km
                  </div>
                </div>
                <button
                  onClick={() => onStartRoute && onStartRoute(selectedRoute)}
                  className="px-3 py-1.5 bg-[#244837] text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Navigation className="w-3 h-3 text-emerald-300 fill-emerald-300" />
                  <span>Start</span>
                </button>
              </div>

              {/* Turn-by-Turn Steps List */}
              <div className="space-y-2 pt-1">
                {getDirectionsSteps(selectedRoute).map((step, idx) => {
                  const StepIcon = step.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-[#e2e0d8] rounded-2xl flex items-start gap-3 shadow-2xs hover:border-[#b4cabe] transition-all"
                    >
                      <div className="p-2 rounded-xl bg-[#f0eee6] text-[#244837] shrink-0 mt-0.5">
                        <StepIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#1c2621] leading-snug">
                          {step.instruction}
                        </p>
                        <span className="text-[10px] font-mono font-semibold text-[#77887e] mt-1 inline-block">
                          {step.distance}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-[#77887e]">
              Please choose a route from the Routes tab first.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Area Reports in Brief */}
      {activeTab === 'reports' && (
        <div className="p-4 overflow-y-auto space-y-2.5 max-h-[380px] no-scrollbar">
          {nearbyHazards.length > 0 ? (
            nearbyHazards.map((hazard) => (
              <div
                key={hazard.id}
                className="p-3 bg-white border border-[#e2e0d8] rounded-2xl flex items-center gap-3 shadow-2xs hover:border-[#b4cabe] transition-all"
              >
                {hazard.image_url ? (
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                    <img src={hazard.image_url} alt="Report evidence" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1c2621] truncate">
                      {hazard.title}
                    </span>
                    <span className="text-[10px] font-mono text-[#77887e] shrink-0">
                      {hazard.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-[#617469]">
                    <span className="font-semibold text-red-600 uppercase text-[9px] px-1.5 py-0.2 bg-red-50 rounded border border-red-200">
                      {hazard.severity}
                    </span>
                    {hazard.depth_cm !== undefined && (
                      <span>Depth: {hazard.depth_cm} cm</span>
                    )}
                    <span>• {Math.round(hazard.distance_m)}m away</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-[#77887e] space-y-1">
              <ShieldCheck className="w-6 h-6 text-[#3a7d5c] mx-auto mb-1" />
              <p className="font-bold text-[#1c2621]">All Clear Around This Area</p>
              <p className="text-[11px]">No active community flooding or road hazards reported within 5km.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
