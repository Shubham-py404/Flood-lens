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

  const getRiskBadge = (level?: string | null) => {
    switch (level) {
      case 'SEVERE':
        return { text: 'SEVERE RISK', bg: 'bg-red-100 text-red-700 border-red-200' };
      case 'HIGH':
        return { text: 'HIGH RISK', bg: 'bg-orange-100 text-orange-700 border-orange-200' };
      case 'MODERATE':
        return { text: 'MODERATE', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 'LOW':
        return { text: 'LOW RISK', bg: 'bg-green-100 text-green-700 border-green-200' };
      default:
        return { text: 'NORMAL', bg: 'bg-gray-100 text-gray-600 border-gray-200' };
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this saved place?')) return;
    try {
      setDeletingId(id);
      await onDeletePlace(id);
    } finally {
      setDeletingId(null);
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
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/70 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">My Citizen Safety Hub</h2>
          <p className="text-xs text-gray-500">Monitor your destinations & flood escalations</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-100 bg-gray-50/40 p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('places')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'places'
              ? 'bg-white shadow-sm text-blue-600 border border-gray-200/60'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Saved Places ({savedLocations.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'alerts'
              ? 'bg-white shadow-sm text-blue-600 border border-gray-200/60'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          Alert History
          {unreadAlertsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black">
              {unreadAlertsCount}
            </span>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-xs">Loading safety records...</p>
          </div>
        ) : activeTab === 'places' ? (
          <>
            {/* Action Bar */}
            <button
              type="button"
              onClick={onAddNewPlace}
              className="w-full py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Save New Location
            </button>

            {savedLocations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600 mb-3">
                  <MapPin className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-800">No places saved yet</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  Save your home, office, or school to receive proactive alerts whenever nearby roads flood.
                </p>
                <button
                  type="button"
                  onClick={onAddNewPlace}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Save My First Place
                </button>
              </div>
            ) : (
              savedLocations.map((place) => {
                const IconComponent = getPlaceIcon(place.label);
                const badge = getRiskBadge(place.nearest_road_risk_level);
                const isElevated =
                  place.nearest_road_risk_level === 'HIGH' ||
                  place.nearest_road_risk_level === 'SEVERE';

                return (
                  <div
                    key={place.id}
                    onClick={() => onLocatePlace(place.latitude, place.longitude)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                      isElevated
                        ? 'border-red-300 bg-red-50/40 hover:bg-red-50/70'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg ${
                            isElevated
                              ? 'bg-red-100 text-red-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{place.label}</h4>
                          <span className="text-[11px] text-gray-500 font-mono">
                            {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={deletingId === place.id}
                        onClick={(e) => handleDelete(place.id, e)}
                        title="Delete saved place"
                        className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        {deletingId === place.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Monitored Road Status */}
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                      <div className="truncate max-w-[180px]">
                        <span className="text-[10px] text-gray-400 block uppercase font-bold">
                          Nearest Road
                        </span>
                        <span className="font-semibold text-gray-700 truncate block">
                          {place.nearest_road_name || 'No road segment matched'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}
                        >
                          {badge.text}
                        </span>
                        {place.nearest_road_risk_score !== null &&
                          place.nearest_road_risk_score !== undefined && (
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              Score: {place.nearest_road_risk_score}/100
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        ) : (
          /* Alerts History Tab */
          <>
            {alerts.length > 0 && unreadAlertsCount > 0 && (
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500 font-medium">
                  {unreadAlertsCount} unread proactive alert{unreadAlertsCount > 1 ? 's' : ''}
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
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-800">All saved places safe</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  No flood escalations detected. We will notify you immediately if any saved route reaches High or Severe flood risk.
                </p>
              </div>
            ) : (
              alerts.map((alert) => {
                const isSevere = alert.escalated_risk_level === 'SEVERE';
                return (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      !alert.is_read
                        ? isSevere
                          ? 'border-red-400 bg-red-50/80 shadow-xs'
                          : 'border-orange-400 bg-orange-50/80 shadow-xs'
                        : 'border-gray-200 bg-white opacity-85'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isSevere ? (
                          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                        )}
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            isSevere
                              ? 'bg-red-600 text-white'
                              : 'bg-orange-500 text-white'
                          }`}
                        >
                          {alert.escalated_risk_level} ALERT
                        </span>
                        {!alert.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                        )}
                      </div>

                      <span className="text-[10px] text-gray-500">
                        {new Date(alert.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {new Date(alert.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-gray-900 mt-2">
                      📍 {alert.saved_location_label} — {alert.road_name}
                    </h5>

                    <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                      {alert.message}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-gray-200/60">
                      <button
                        type="button"
                        onClick={() => onLocateAlert(alert)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Locate Road
                      </button>

                      {!alert.is_read ? (
                        <button
                          type="button"
                          onClick={() => onMarkAlertRead(alert.id)}
                          className="text-xs text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                        >
                          Mark as read
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400">Read</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
