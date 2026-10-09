'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import PhotoUploader from './PhotoUploader';
import VoiceReporter from './VoiceReporter';
import type { SubmitReportResponse } from '@/types/api';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted?: (data: SubmitReportResponse) => void;
}

const DEPTH_OPTIONS = [
  { label: 'Ankle', sub: '< 15 cm' },
  { label: 'Knee', sub: '15 – 50 cm' },
  { label: 'Waist', sub: '50 – 100 cm' },
  { label: 'Severe', sub: '> 100 cm' },
];

export default function ReportModal({
  isOpen,
  onClose,
  onReportSubmitted,
}: ReportModalProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [s3ImageKey, setS3ImageKey] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [depthEstimate, setDepthEstimate] = useState<string>('');
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSubmitResult(null);
      return;
    }

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      setGeoError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsLocating(false);
        },
        (err) => {
          console.warn('Geolocation warning:', err);
          setGeoError('GPS unavailable. Using default map coordinate.');
          setCoords({
            lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT || 28.6315),
            lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG || 77.2167),
          });
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setGeoError('Geolocation unsupported by browser.');
      setCoords({
        lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT || 28.6315),
        lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG || 77.2167),
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) {
      setSubmitResult({
        type: 'error',
        message: 'GPS location missing. Cannot submit.',
      });
      return;
    }

    if (!s3ImageKey && !voiceTranscript && !description) {
      setSubmitResult({
        type: 'error',
        message: 'Please provide a photo, voice transcript, or description.',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          s3_image_key: s3ImageKey || undefined,
          voice_transcript: voiceTranscript || undefined,
          depth_estimate: depthEstimate || undefined,
          description: description || undefined,
        }),
      });

      const data: SubmitReportResponse = await res.json();

      if (!res.ok) {
        throw new Error((data as any).error || 'Failed to submit report');
      }

      setSubmitResult({
        type: 'success',
        message: data.road_segment_id
          ? 'Report submitted and linked to road segment.'
          : 'Report registered successfully.',
      });

      if (onReportSubmitted) {
        onReportSubmitted(data);
      }

      setTimeout(() => {
        onClose();
        setS3ImageKey(null);
        setVoiceTranscript('');
        setDepthEstimate('');
        setDescription('');
        setSubmitResult(null);
      }, 1500);
    } catch (err: any) {
      console.error('Submission error:', err);
      setSubmitResult({
        type: 'error',
        message: err.message || 'Unable to submit report right now.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                Report Street Flooding
              </h2>
              <p className="text-xs text-gray-500">
                Submit live observations to update road safety maps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Geolocation Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200/80 text-xs">
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                {isLocating
                  ? 'Locating GPS position...'
                  : coords
                  ? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`
                  : 'Location not found'}
              </span>
            </div>
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
            ) : (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                GPS Verified
              </span>
            )}
          </div>

          {geoError && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{geoError}</span>
            </div>
          )}

          <form id="flood-report-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Photo Evidence */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Street Photo
              </label>
              <PhotoUploader
                onUploadSuccess={(key) => setS3ImageKey(key)}
                onUploadClear={() => setS3ImageKey(null)}
                disabled={isSubmitting}
              />
            </div>

            {/* Section 2: Water Depth Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Water Depth
              </label>
              <div className="grid grid-cols-4 gap-2">
                {DEPTH_OPTIONS.map((opt) => {
                  const isSelected = depthEstimate.startsWith(opt.label);
                  return (
                    <button
                      type="button"
                      key={opt.label}
                      onClick={() => setDepthEstimate(`${opt.label} (${opt.sub})`)}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs ring-1 ring-blue-600'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs font-bold block">{opt.label}</span>
                      <span className="text-[10px] text-gray-500 block mt-0.5">
                        {opt.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Voice Dispatch / Dictation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Voice Dispatch
                </label>
                <span className="text-[11px] text-gray-400">One-tap dictation</span>
              </div>
              <VoiceReporter
                onTranscriptChange={(t) => setVoiceTranscript(t)}
                onDepthExtracted={(depth) => setDepthEstimate(depth)}
                disabled={isSubmitting}
              />
            </div>

            {/* Section 4: Text Details */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Notes & Landmarks (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Mention cross streets, landmarks, or stranded vehicles..."
                className="w-full text-xs rounded-xl border border-gray-200 p-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Submission Status Message */}
            {submitResult && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                  submitResult.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {submitResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{submitResult.message}</span>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="flood-report-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Report</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
