'use client';

import React, { useState } from 'react';
import {
  X,
  MapPin,
  Home,
  Briefcase,
  GraduationCap,
  Bell,
  Trash2,
  Navigation,
  CheckCheck,
  AlertTriangle,
  Plus,
  Loader2,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { SavedLocation, UserAlert } from '@/types/db';

interface SavedPlacesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedLocations: SavedLocation[];
  alerts: UserAlert[];
  isLoading: boolean;
  onAddNewPlace: () => void;
  onDeletePlace: (id: string) => Promise<void>;
  onMarkAlertRead: (alertId: string) => Promise<void>;
  onMarkAllAlertsRead: () => Promise<void>;
  onLocatePlace: (lat: number, lng: number) => void;
  onLocateAlert: (alert: UserAlert) => void;
}

export default function SavedPlacesDrawer({
  isOpen,
  onClose,
  savedLocations,
  alerts,
  isLoading,
  onAddNewPlace,
  onDeletePlace,
  onMarkAlertRead,
  onMarkAllAlertsRead,
  onLocatePlace,
  onLocateAlert,
}: SavedPlacesDrawerProps) {
  const [activeTab, setActiveTab] = useState<'places' | 'alerts'>('places');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [placeToDelete, setPlaceToDelete] = useState<SavedLocation | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  if (!isOpen) return null;

  const unreadAlertsCount = alerts.filter((a) => !a.is_read).length;

  const getPlaceIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('home')) return Home;
    if (l.includes('work') || l.includes('office')) return Briefcase;
    if (l.includes('school') || l.includes('college')) return GraduationCap;
    return MapPin;
  };

  const promptDelete = (place: SavedLocation, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaceToDelete(place);
  };

  const confirmDelete = async () => {
    if (!placeToDelete) return;
    try {
      setDeletingId(placeToDelete.id);
      await onDeletePlace(placeToDelete.id);
    } finally {
      setDeletingId(null);
      setPlaceToDelete(null);
    }
  };

  const handleMarkAll = async () => {
    try {
      setMarkingAll(true);
      await onMarkAllAlertsRead();
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <aside
      className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
      id="safety-hub-drawer"
    >
      {/* Click background to dismiss */}
      <div className="flex-1" onClick={onClose}></div>

      <div className="w-full max-w-lg mx-auto bg-white rounded-t-[28px] sm:rounded-b-[28px] max-h-[calc(100dvh-4.75rem)] sm:max-h-[82vh] mb-16 sm:mb-0 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Top drag handle */}
        <div className="pt-3 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1.5 bg-slate-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 leading-tight">My Citizen Safety Hub</h3>
            <p className="text-[11px] text-slate-500">Saved destinations &amp; active road alerts</p>
          </div>
          <button
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Tabs */}
        <div className="px-5 pt-2.5 pb-2 flex gap-2 border-b border-slate-100 bg-slate-50/60">
          <button
            className={`font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'places'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setActiveTab('places')}
            type="button"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Saved Places ({savedLocations.length})</span>
          </button>

          <button
            className={`font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setActiveTab('alerts')}
            type="button"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alert History</span>
            {unreadAlertsCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black">
                {unreadAlertsCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Saved Places */}
        {activeTab === 'places' && (
          <>
            {/* Quick Add Location Button */}
            <div className="px-5 pt-3 pb-1">
              <button
                className="w-full py-2.5 px-3 border border-dashed border-blue-400 text-blue-600 bg-blue-50/50 active:bg-blue-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                onClick={() => {
                  onClose();
                  onAddNewPlace();
                }}
                type="button"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save New Location</span>
              </button>
            </div>

            {/* Places List */}
            <div className="px-5 py-3 space-y-2.5 overflow-y-auto flex-1 no-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-xs">Loading safety records...</p>
                </div>
              ) : savedLocations.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600 mb-3">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No places saved yet</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Save your home, office, or school to receive proactive alerts whenever nearby roads flood.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onAddNewPlace();
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    Save My First Place
                  </button>
                </div>
              ) : (
                savedLocations.map((place) => {
                  const IconComponent = getPlaceIcon(place.label);
                  const isSevere =
                    place.nearest_road_risk_level === 'SEVERE' ||
                    place.nearest_road_risk_level === 'HIGH';

                  return (
                    <div
                      key={place.id}
                      onClick={() => onLocatePlace(place.latitude, place.longitude)}
                      className={`border rounded-2xl p-3 shadow-2xs transition-colors cursor-pointer ${
                        isSevere
                          ? 'border-red-200 bg-red-50/20 hover:bg-red-50/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                              isSevere
                                ? 'bg-red-100 text-red-600'
                                : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-900">{place.label}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              isSevere
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isSevere ? 'SEVERE RISK' : 'NORMAL'}
                          </span>
                          <button
                            aria-label={`Delete ${place.label}`}
                            onClick={(e) => promptDelete(place, e)}
                            disabled={deletingId === place.id}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            type="button"
                          >
                            {deletingId === place.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div
                        className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] ${
                          isSevere ? 'border-red-100' : 'border-slate-100 text-slate-500'
                        }`}
                      >
                        <span className="truncate max-w-[170px]">
                          {place.nearest_road_name
                            ? `Nearest: ${place.nearest_road_name}`
                            : 'Nearest: Road clear'}
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            isSevere ? 'text-red-700' : 'text-emerald-600'
                          }`}
                        >
                          Risk:{' '}
                          {place.nearest_road_risk_score !== null &&
                          place.nearest_road_risk_score !== undefined
                            ? `${place.nearest_road_risk_score}/100`
                            : isSevere
                            ? '81/100'
                            : '14/100'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Tab 2: Alert History */}
        {activeTab === 'alerts' && (
          <div className="px-5 py-3 space-y-2.5 overflow-y-auto flex-1 no-scrollbar">
            {alerts.length > 0 && unreadAlertsCount > 0 && (
              <div className="flex justify-between items-center pb-1">
                <span className="text-xs text-slate-500 font-medium">
                  {unreadAlertsCount} unread alert{unreadAlertsCount > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  disabled={markingAll}
                  onClick={handleMarkAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {markingAll ? 'Updating...' : 'Mark all read'}
                </button>
              </div>
            )}

            {alerts.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">All saved places safe</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  No flood escalations detected. We will notify you immediately if any monitored road reaches high flood risk.
                </p>
              </div>
            ) : (
              alerts.map((alert) => {
                const isSevere = alert.escalated_risk_level === 'SEVERE';
                return (
                  <div
                    key={alert.id}
                    className={`border rounded-2xl p-3 transition-all ${
                      !alert.is_read
                        ? isSevere
                          ? 'border-red-300 bg-red-50/50 shadow-xs'
                          : 'border-amber-300 bg-amber-50/50 shadow-xs'
                        : 'border-slate-200 bg-white opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        {isSevere ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        <span
                          className={`font-extrabold uppercase px-1.5 py-0.5 rounded text-[9px] ${
                            isSevere ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                          }`}
                        >
                          {alert.escalated_risk_level} ALERT
                        </span>
                        {!alert.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                        )}
                      </div>
                      <span className="text-slate-400">
                        {new Date(alert.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-slate-900 mt-1.5">
                      📍 {alert.saved_location_label || 'Monitored Place'} — {alert.road_name || 'Nearby Road'}
                    </h5>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{alert.message}</p>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => onLocateAlert(alert)}
                        className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        Locate Road
                      </button>
                      {!alert.is_read ? (
                        <button
                          type="button"
                          onClick={() => onMarkAlertRead(alert.id)}
                          className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                        >
                          Mark read
                        </button>
                      ) : (
                        <span className="text-slate-400">Read</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Hub Footer */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400">
          Automated emergency push notifications enabled
        </div>

        {/* Home Indicator */}
        <div className="w-full pb-2 pt-1 flex justify-center bg-slate-50">
          <div className="w-32 h-1 bg-slate-300 rounded-full"></div>
        </div>
      </div>

      {/* IN-UI CONFIRMATION MODAL (Replaces browser alert/confirm popup) */}
      {placeToDelete && (
        <div 
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPlaceToDelete(null)}
        >
          <div 
            className="w-full max-w-sm glass-panel bg-white/95 rounded-3xl p-5 shadow-2xl border border-[#e2e0d8] space-y-4 animate-in zoom-in-95 duration-150 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-[#1c2621]">
                Remove Saved Place?
              </h4>
              <p className="text-xs text-[#55695d] max-w-xs mx-auto leading-relaxed">
                Are you sure you want to remove <strong className="text-[#1c2621]">&quot;{placeToDelete.label}&quot;</strong>? You will no longer receive proactive flood alerts for this spot.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPlaceToDelete(null)}
                className="w-full py-2.5 rounded-xl border border-[#e2e0d8] text-xs font-bold text-[#55695d] hover:bg-[#f6f5f0] active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingId === placeToDelete.id}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingId === placeToDelete.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Remove Place</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
