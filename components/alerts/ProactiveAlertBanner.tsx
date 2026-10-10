'use client';

import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Navigation, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { UserAlert } from '@/types/db';

interface ProactiveAlertBannerProps {
  alerts: UserAlert[];
  onDismiss: (alertId: string) => Promise<void>;
  onLocate: (alert: UserAlert) => void;
  onViewAll: () => void;
}

export default function ProactiveAlertBanner({
  alerts,
  onDismiss,
  onLocate,
  onViewAll,
}: ProactiveAlertBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  // Filter to active unread alerts
  const activeAlerts = alerts.filter((a) => !a.is_read);

  if (activeAlerts.length === 0) return null;

  // Ensure index is within range
  const safeIndex = Math.min(currentIndex, activeAlerts.length - 1);
  const currentAlert = activeAlerts[safeIndex];

  if (!currentAlert) return null;

  const isSevere = currentAlert.escalated_risk_level === 'SEVERE';

  const handleDismiss = async () => {
    try {
      setDismissingId(currentAlert.id);
      await onDismiss(currentAlert.id);
      if (safeIndex >= activeAlerts.length - 1 && safeIndex > 0) {
        setCurrentIndex(safeIndex - 1);
      }
    } finally {
      setDismissingId(null);
    }
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeAlerts.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activeAlerts.length) % activeAlerts.length);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4"
    >
      <div
        className={`rounded-2xl p-4 md:p-5 shadow-2xl border backdrop-blur-xl ${
          isSevere
            ? 'bg-red-950/90 text-red-100 border-red-500/50 shadow-red-950/40'
            : 'bg-amber-950/90 text-amber-100 border-amber-500/50 shadow-amber-950/40'
        }`}
      >
        <div className="flex items-start gap-3.5">
          {/* Animated Icon badge */}
          <div
            className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
              isSevere
                ? 'bg-red-600/30 text-red-300 ring-2 ring-red-500/40 animate-pulse'
                : 'bg-amber-600/30 text-amber-300 ring-2 ring-amber-500/40 animate-pulse'
            }`}
          >
            {isSevere ? (
              <ShieldAlert className="w-6 h-6 text-red-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            )}
          </div>

          {/* Alert Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isSevere
                    ? 'bg-red-500 text-white shadow-sm shadow-red-600'
                    : 'bg-amber-500 text-gray-900 font-bold'
                }`}
              >
                {currentAlert.escalated_risk_level} FLOOD ESCALATION
              </span>

              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 text-white/90">
                📍 {currentAlert.saved_location_label || 'Saved Place'}
              </span>

              {activeAlerts.length > 1 && (
                <span className="text-xs text-white/70 ml-auto font-mono">
                  {safeIndex + 1} of {activeAlerts.length}
                </span>
              )}
            </div>

            <h4 className="text-base font-bold text-white tracking-tight leading-snug">
              {currentAlert.road_name || 'Nearby Road Segment'}
            </h4>

            <p className="text-xs md:text-sm text-white/85 mt-1 leading-relaxed line-clamp-2">
              {currentAlert.message}
            </p>

            <div className="text-[11px] text-white/60 mt-1.5 flex items-center gap-2">
              <span>Alerted {new Date(currentAlert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>•</span>
              <span>Prior: {currentAlert.previous_risk_level} Risk</span>
            </div>

            {/* Actions Bar */}
            <div className="mt-3.5 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onLocate(currentAlert)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-md ${
                  isSevere
                    ? 'bg-red-500 hover:bg-red-400 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                View on Map
              </button>

              <button
                type="button"
                disabled={dismissingId === currentAlert.id}
                onClick={handleDismiss}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                {dismissingId === currentAlert.id ? 'Dismissing...' : 'Mark as Read'}
              </button>

              <button
                type="button"
                onClick={onViewAll}
                className="inline-flex items-center gap-1 text-xs text-white/75 hover:text-white underline underline-offset-2 ml-auto cursor-pointer"
              >
                Notification History
              </button>
            </div>
          </div>

          {/* Dismiss quick X and multi-alert controls */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDismiss}
              title="Dismiss alert"
              className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {activeAlerts.length > 1 && (
              <div className="flex items-center gap-0.5 mt-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Previous alert"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Next alert"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
