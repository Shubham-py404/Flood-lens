'use client';

import React, { useState } from 'react';
import { 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  Navigation, 
  ThumbsUp, 
  Loader2,
  RefreshCw,
  Camera,
  AlertTriangle,
  X,
  Eye,
  Check,
  UserCheck
} from 'lucide-react';
import { NearbyIncidentCard } from '@/types/api';

interface InsightsFeedViewProps {
  incidents: NearbyIncidentCard[];
  isLoading: boolean;
  onRefresh: () => void;
  onLocateOnMap: (lat: number, lng: number, title?: string) => void;
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
  const [selectedIncident, setSelectedIncident] = useState<NearbyIncidentCard | null>(null);

  const handleVerify = async (id: string, action: 'CONFIRM' | 'RESOLVED', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
        return 'bg-red-500/20 text-red-600 border-red-500/30';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-600 border-orange-500/30';
      case 'MODERATE':
        return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      default:
        return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30';
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
                onClick={() => setSelectedIncident(incident)}
                className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between hover:shadow-lg hover:border-teal-400 hover:-translate-y-0.5 transition-all cursor-pointer group"
              >
                {/* Image Thumbnail with Fallback */}
                <div className="w-full h-44 bg-slate-100 relative overflow-hidden">
                  {incident.image_url ? (
                    <img
                      src={incident.image_url}
                      alt={incident.road_name}
                      onError={(e) => {
                        // Fallback to sample hazard image if URL fails
                        (e.currentTarget as HTMLImageElement).src = '/sample-hazards/connaught_waterlog.jpg';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center text-slate-400 p-4">
                      <Camera className="w-10 h-10 mb-1 opacity-40 text-teal-600" />
                      <span className="text-[11px] font-semibold text-slate-500">Citizen Waterlogging Report</span>
                    </div>
                  )}

                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-sm backdrop-blur-md ${getSeverityBadge(incident.severity)}`}>
                      {incident.severity}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-slate-700 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1 group-hover:bg-teal-50 group-hover:text-teal-700 transition-colors">
                    <Eye className="w-3 h-3" />
                    <span>View Details</span>
                  </div>

                  <div className="absolute bottom-2 right-2 bg-slate-900/70 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] text-white flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {incident.time_ago}
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 line-clamp-1 group-hover:text-teal-700 transition-colors">
                      {incident.road_name}
                    </h3>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onLocateOnMap(incident.lat, incident.lng, incident.road_name);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs"
                      title="Locate directly on Map"
                    >
                      <Navigation className="w-3.5 h-3.5 text-teal-600" />
                      Locate
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleVerify(incident.id, 'CONFIRM', e)}
                        disabled={verifyingId === incident.id || hasVerified}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-xs ${
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

      {/* DETAIL VIEW MODAL (When clicking any insight card) */}
      {selectedIncident && (
        <div 
          onClick={() => setSelectedIncident(null)}
          className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 pb-20 sm:pb-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[calc(100dvh-6rem)] sm:max-h-[90vh] animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header Image */}
            <div className="w-full h-56 sm:h-64 bg-slate-100 relative shrink-0">
              {selectedIncident.image_url ? (
                <img
                  src={selectedIncident.image_url}
                  alt={selectedIncident.road_name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/sample-hazards/connaught_waterlog.jpg';
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <Camera className="w-12 h-12 mb-2 text-teal-600 opacity-50" />
                  <span className="text-sm font-bold text-slate-600">Community Photo Evidence</span>
                  <span className="text-xs text-slate-400 mt-0.5">Photo recorded via mobile citizen camera</span>
                </div>
              )}

              <button
                onClick={() => setSelectedIncident(null)}
                className="absolute top-4 right-4 w-9 h-9 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all cursor-pointer shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="absolute bottom-3 left-4 flex items-center gap-2">
                <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-md backdrop-blur-md ${getSeverityBadge(selectedIncident.severity)}`}>
                  {selectedIncident.severity} HAZARD
                </span>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 leading-snug">
                  {selectedIncident.road_name}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                  <span className="flex items-center gap-1 text-teal-600 font-bold">
                    <MapPin className="w-3.5 h-3.5" />
                    {selectedIncident.distance_m ? `${selectedIncident.distance_m}m away` : 'Nearby'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Reported {selectedIncident.time_ago}
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Water Depth</span>
                  <span className="text-base font-black text-slate-800 mt-0.5 block">
                    {selectedIncident.depth_cm ? `${selectedIncident.depth_cm} cm` : 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Community Verifications</span>
                  <span className="text-base font-black text-teal-700 mt-0.5 block">
                    {selectedIncident.confirm_count ? `${selectedIncident.confirm_count} Citizens` : 'Pending Verification'}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedIncident.description && (
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1">Citizen Observation Notes:</span>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                    {selectedIncident.description}
                  </p>
                </div>
              )}

              {/* Geographic Coordinates */}
              <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-3">
                <span>GPS: {selectedIncident.lat.toFixed(5)}° N, {selectedIncident.lng.toFixed(5)}° E</span>
                <span className="text-teal-600 font-semibold flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  Active Community Report
                </span>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => {
                  const target = selectedIncident;
                  setSelectedIncident(null);
                  onLocateOnMap(target.lat, target.lng, target.road_name);
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4" />
                <span>Locate on Map</span>
              </button>

              <button
                onClick={(e) => handleVerify(selectedIncident.id, 'CONFIRM', e)}
                disabled={verifiedSet.has(selectedIncident.id) || verifyingId === selectedIncident.id}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  verifiedSet.has(selectedIncident.id)
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs'
                }`}
              >
                {verifyingId === selectedIncident.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ThumbsUp className="w-4 h-4" />
                )}
                <span>{verifiedSet.has(selectedIncident.id) ? 'Confirmed' : 'Confirm Hazard'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
