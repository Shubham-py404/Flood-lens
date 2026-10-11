'use client';

import React, { useState } from 'react';
import { 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  Navigation, 
  ThumbsUp, 
  Check, 
  Loader2,
  RefreshCw,
  Camera,
  AlertTriangle
} from 'lucide-react';
import { NearbyIncidentCard } from '@/types/api';

interface InsightsFeedViewProps {
  incidents: NearbyIncidentCard[];
  isLoading: boolean;
  onRefresh: () => void;
  onLocateOnMap: (lat: number, lng: number) => void;
  onOpenReportModal: () => void;
}

export default function InsightsFeedView({
  incidents,
  isLoading,
  onRefresh,
  onLocateOnMap,
  onOpenReportModal,
}: InsightsFeedViewProps) {
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifiedSet, setVerifiedSet] = useState<Set<string>>(new Set());

  const handleVerify = async (id: string, action: 'CONFIRM' | 'RESOLVED') => {
    setVerifyingId(id);
    try {
      const res = await fetch('/api/reports/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cluster_id: id,
          action,
          user_id: 'citizen-user-local',
        }),
      });
      if (res.ok) {
        setVerifiedSet((prev) => new Set([...prev, id]));
      }
    } catch (e) {
      console.error('Failed to verify:', e);
    } finally {
      setVerifyingId(null);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'SEVERE':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'MODERATE':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto px-4 py-6 md:px-8 max-w-4xl mx-auto space-y-6 pb-28 md:pb-10 scrollbar-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Camera className="w-6 h-6 text-teal-600" />
            Nearby Environmental Insights
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Photo-first community evidence feed sorted by real proximity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 shadow-xs transition-all cursor-pointer"
            title="Refresh feed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
          <button
            onClick={onOpenReportModal}
            className="px-4 py-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white rounded-xl text-xs md:text-sm font-semibold shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            Submit New Report
          </button>
        </div>
      </div>

      {/* Feed List */}
      {incidents.length === 0 ? (
        <div className="bg-white/80 border border-slate-200/80 rounded-3xl p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No active hazards reported nearby</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Streets are clear in this observation zone. If you encounter active waterlogging or street hazards, report it to keep the community informed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {incidents.map((incident) => {
            const hasVerified = verifiedSet.has(incident.id);
            return (
              <div
                key={incident.id}
                className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all"
              >
                {/* Image or Map Placeholder */}
                {incident.image_url ? (
                  <div className="w-full h-44 bg-slate-100 relative overflow-hidden group">
                    <img
                      src={incident.image_url}
                      alt={incident.road_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm backdrop-blur-md ${getSeverityBadge(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-slate-900/60 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] text-white flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {incident.time_ago}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-slate-100 to-slate-200 p-4 flex items-center justify-between border-b border-slate-200/60">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getSeverityBadge(incident.severity)}`}>
                      {incident.severity}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {incident.time_ago}
                    </span>
                  </div>
                )}

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{incident.road_name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1 text-teal-600 font-semibold">
                        <MapPin className="w-3.5 h-3.5" />
                        {incident.distance_m ? `${incident.distance_m}m away` : 'Nearby'}
                      </span>
                      {incident.depth_cm && (
                        <span>• Est. Depth: <strong className="text-slate-800">{incident.depth_cm} cm</strong></span>
                      )}
                    </div>
                    {incident.description && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2 bg-slate-50/80 p-2 rounded-xl border border-slate-200/60">
                        {incident.description}
                      </p>
                    )}
                  </div>

                  {/* Actions & Verification */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onLocateOnMap(incident.lat, incident.lng)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5 text-teal-600" />
                      Locate
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleVerify(incident.id, 'CONFIRM')}
                        disabled={verifyingId === incident.id || hasVerified}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                          hasVerified
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200/80'
                        }`}
                      >
                        {verifyingId === incident.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ThumbsUp className="w-3.5 h-3.5" />
                        )}
                        <span>{hasVerified ? 'Confirmed' : 'Confirm'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
