'use client';

import React, { useState } from 'react';
import { X, MapPin, Home, Briefcase, GraduationCap, Crosshair, Loader2, CheckCircle2 } from 'lucide-react';
import { RiskLevel, SavedLocation } from '@/types/db';

interface SavePlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (savedPlace: SavedLocation) => void;
  initialCoords?: { lat: number; lng: number } | null;
  initialLabel?: string;
  onStartMapPick?: () => void;
}

const PRESET_LABELS = [
  { label: 'Home', icon: Home },
  { label: 'Work', icon: Briefcase },
  { label: 'School', icon: GraduationCap },
];

export default function SavePlaceModal({
  isOpen,
  onClose,
  onSaveSuccess,
  initialCoords,
  initialLabel,
  onStartMapPick,
}: SavePlaceModalProps) {
  const [label, setLabel] = useState(() => (initialLabel ? 'Custom' : 'Home'));
  const [customLabel, setCustomLabel] = useState(() => initialLabel || '');
  const [lat, setLat] = useState<string>(() => (initialCoords ? initialCoords.lat.toFixed(6) : ''));
  const [lng, setLng] = useState<string>(() => (initialCoords ? initialCoords.lng.toFixed(6) : ''));
  const [alertLevel, setAlertLevel] = useState<RiskLevel>('HIGH');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeLabel = label === 'Custom' ? customLabel : label;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);

    const finalLabel = activeLabel.trim();
    if (!finalLabel) {
      setErrorMsg('Please specify a label for this saved place.');
      return;
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      setErrorMsg('Please enter a valid latitude (-90 to 90).');
      return;
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      setErrorMsg('Please enter a valid longitude (-180 to 180).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/saved-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: finalLabel,
          latitude,
          longitude,
          alert_on_risk_level: alertLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save location.');
      }

      setSuccessInfo(
        data.saved_location?.nearest_road_name
          ? `Saved! Matched nearest road: ${data.saved_location.nearest_road_name}`
          : 'Location saved successfully!'
      );

      setTimeout(() => {
        onSaveSuccess(data.saved_location);
        onClose();
        setSuccessInfo(null);
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Save Place for Flood Alerts</h3>
              <p className="text-xs text-blue-100">Get proactively alerted when nearby roads flood</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successInfo && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successInfo}
            </div>
          )}

          {/* Quick preset selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Place Label
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2.5">
              {PRESET_LABELS.map((item) => {
                const Icon = item.icon;
                const isSelected = label === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setLabel(item.label)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setLabel('Custom')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  label === 'Custom'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MapPin className="w-4 h-4 mb-1" />
                Custom
              </button>
            </div>

            {label === 'Custom' && (
              <input
                type="text"
                placeholder="e.g. Grandma's House, Gym, Warehouse"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                maxLength={100}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-gray-900"
              />
            )}
          </div>

          {/* Location coordinates */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Coordinates (GPS)
              </label>
              {onStartMapPick && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartMapPick();
                  }}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-800 cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  Select on Map
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold">Latitude</span>
                <input
                  type="number"
                  step="any"
                  placeholder="28.6315"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-900 font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold">Longitude</span>
                <input
                  type="number"
                  step="any"
                  placeholder="77.2167"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-900 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Proactive Alert Trigger Level */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Alert Trigger Threshold
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAlertLevel('HIGH')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  alertLevel === 'HIGH'
                    ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20 text-orange-950 font-bold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-orange-600 font-bold">
                  <span>🟠 High & Severe</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Alerts when road risk exceeds 50/100</p>
              </button>

              <button
                type="button"
                onClick={() => setAlertLevel('SEVERE')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  alertLevel === 'SEVERE'
                    ? 'border-red-500 bg-red-50/70 ring-2 ring-red-500/20 text-red-950 font-bold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-red-600 font-bold">
                  <span>🔴 Severe Only</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Alerts only during critical flooding (75+)</p>
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5" />
                  Confirm & Save Place
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
