'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  MapPin,
  X,
  Camera,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Loader2,
  CheckCircle2,
  Crosshair,
  Home,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { RiskLevel, SavedLocation } from '@/types/db';

interface FloodActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'report' | 'save';
  currentCoords?: { lat: number; lng: number } | null;
  onRefreshGPS?: () => void;
  onSavePlaceSuccess?: (place: SavedLocation) => void;
  onReportSuccess?: () => void;
  onSelectOnMap?: () => void;
}

export default function FloodActionsModal({
  isOpen,
  onClose,
  initialTab = 'report',
  currentCoords,
  onRefreshGPS,
  onSavePlaceSuccess,
  onReportSuccess,
  onSelectOnMap,
}: FloodActionsModalProps) {
  const [activeTab, setActiveTab] = useState<'report' | 'save'>(initialTab);

  // Sync initial tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Tab 1 (Report) State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Tab 2 (Save Place) State
  const [selectedLabelPreset, setSelectedLabelPreset] = useState<'Home' | 'Work' | 'School' | 'Custom'>('Home');
  const [customLabel, setCustomLabel] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [alertThreshold, setAlertThreshold] = useState<RiskLevel>('HIGH');
  const [isSubmittingPlace, setIsSubmittingPlace] = useState(false);
  const [savePlaceSuccess, setSavePlaceSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Update coordinate inputs when coordinates change
  useEffect(() => {
    if (currentCoords) {
      setLatInput(currentCoords.lat.toFixed(6));
      setLngInput(currentCoords.lng.toFixed(6));
    }
  }, [currentCoords]);

  // Voice dictation setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          setNotes((prev) => {
            const trimmed = currentTranscript.trim();
            return trimmed.length > 280 ? trimmed.slice(0, 280) : trimmed;
          });
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Voice dictation is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Submit Flood Report
  const handleReportSubmit = async () => {
    setIsSubmittingReport(true);
    setErrorMessage(null);

    const lat = currentCoords?.lat || (latInput ? parseFloat(latInput) : 28.6291);
    const lng = currentCoords?.lng || (lngInput ? parseFloat(lngInput) : 77.2198);

    try {
      let s3ImageKey: string | undefined = undefined;

      // 1. Upload photo if selected
      if (selectedFile) {
        const urlRes = await fetch('/api/reports/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: selectedFile.name,
            contentType: selectedFile.type || 'image/jpeg',
          }),
        });

        if (urlRes.ok) {
          const { uploadUrl, fileKey } = await urlRes.json();
          await fetch(uploadUrl, {
            method: 'PUT',
            body: selectedFile,
            headers: { 'Content-Type': selectedFile.type || 'image/jpeg' },
          });
          s3ImageKey = fileKey;
        }
      }

      // 2. Submit report to database
      const reportRes = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          s3_image_key: s3ImageKey,
          description: notes.trim() || undefined,
        }),
      });

      if (!reportRes.ok) {
        throw new Error('Failed to record incident report.');
      }

      setReportSuccess(true);
      if (onReportSuccess) onReportSuccess();

      setTimeout(() => {
        setReportSuccess(false);
        setSelectedFile(null);
        setPhotoPreview(null);
        setNotes('');
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Report submission failed.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Submit Save Place
  const handleSavePlaceSubmit = async () => {
    setIsSubmittingPlace(true);
    setErrorMessage(null);

    const label = selectedLabelPreset === 'Custom' ? customLabel.trim() : selectedLabelPreset;
    if (!label) {
      setErrorMessage('Please specify a label for this location.');
      setIsSubmittingPlace(false);
      return;
    }

    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    if (isNaN(lat) || isNaN(lng)) {
      setErrorMessage('Please enter valid numeric latitude and longitude.');
      setIsSubmittingPlace(false);
      return;
    }

    try {
      const res = await fetch('/api/user/saved-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          latitude: lat,
          longitude: lng,
          alert_on_risk_level: alertThreshold,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save place.');
      }

      setSavePlaceSuccess(true);
      if (onSavePlaceSuccess) onSavePlaceSuccess(data.saved_location);

      setTimeout(() => {
        setSavePlaceSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Saving place failed.');
    } finally {
      setIsSubmittingPlace(false);
    }
  };

  if (!isOpen) return null;

  const displayLat = currentCoords ? currentCoords.lat.toFixed(4) : latInput || '28.6291';
  const displayLng = currentCoords ? currentCoords.lng.toFixed(4) : lngInput || '77.2198';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-300"
      id="flood-actions-modal"
    >
      {/* Backdrop dismiss click area */}
      <div className="flex-1" onClick={onClose}></div>

      {/* Native Mobile Bottom Sheet Container */}
      <div className="w-full max-w-lg mx-auto bg-white rounded-t-[28px] shadow-2xl border-t border-slate-200/80 flex flex-col max-h-[85vh] sm:max-h-[88vh] overflow-hidden transform transition-transform animate-slide-up">
        {/* Sheet Handle Drag Bar */}
        <div
          className="w-full pt-3 pb-1 flex justify-center items-center cursor-grab"
          onClick={onClose}
        >
          <div className="w-10 h-1.5 bg-slate-300 rounded-full"></div>
        </div>

        {/* Sheet Header */}
        <div className="px-5 pt-2 pb-3 flex items-start justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">Flood Actions</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Report street flooding or save a place for flood alerts
              </p>
            </div>
          </div>
          <button
            aria-label="Close sheet"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Touch-Friendly Segmented Dual Tab Switcher */}
        <div className="px-5 pt-3 pb-2 bg-slate-50/50">
          <div className="grid grid-cols-2 p-1 bg-slate-200/70 rounded-xl text-xs font-semibold">
            <button
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg transition-all font-bold cursor-pointer ${
                activeTab === 'report'
                  ? 'shadow-sm bg-white text-blue-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="tab-btn-report"
              onClick={() => setActiveTab('report')}
              type="button"
            >
              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Report Flood</span>
            </button>
            <button
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg transition-all font-semibold cursor-pointer ${
                activeTab === 'save'
                  ? 'shadow-sm bg-white text-blue-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="tab-btn-save"
              onClick={() => setActiveTab('save')}
              type="button"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Save Place</span>
            </button>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="mx-5 mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* Scrollable Tab Content Container */}
        <div className="px-5 py-3.5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1 CONTENT: Report Flood */}
          {activeTab === 'report' && (
            <div className="space-y-3.5" id="tab-content-report">
              {/* Compact GPS Status Card */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold text-slate-800 tracking-wider uppercase">
                        GPS Acquired
                      </span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                        ±6m accuracy
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-700 font-medium mt-0.5 leading-none">
                      {displayLat}° N, {displayLng}° E{' '}
                      <span className="font-sans text-slate-400 font-normal">(Indraprastha)</span>
                    </p>
                  </div>
                </div>
                <button
                  className="p-1.5 text-slate-400 hover:text-slate-700 active:rotate-180 transition-transform cursor-pointer"
                  title="Refresh GPS"
                  type="button"
                  onClick={onRefreshGPS}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Evidence & Quick Input: Two side-by-side touch cards */}
              <div>
                <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                  Evidence &amp; Quick Input
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />

                  {/* Add Street Photo */}
                  <button
                    className={`border border-dashed ${
                      selectedFile ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 bg-slate-50/60'
                    } hover:border-blue-500 active:bg-blue-50/50 rounded-xl p-3 text-center flex flex-col items-center justify-center gap-1 transition-all group cursor-pointer`}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200 group-hover:border-blue-400 flex items-center justify-center text-slate-600 group-hover:text-blue-600 transition-colors">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-800 mt-0.5">
                      {selectedFile ? 'Photo Attached' : 'Add Photo'}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {selectedFile ? selectedFile.name.slice(0, 14) + '...' : 'Camera / Gallery'}
                    </span>
                  </button>

                  {/* Voice Dictation */}
                  <button
                    className={`border border-dashed ${
                      isListening ? 'border-red-500 bg-red-50/50' : 'border-slate-300 bg-slate-50/60'
                    } hover:border-blue-500 active:bg-blue-50/50 rounded-xl p-3 text-center flex flex-col items-center justify-center gap-1 transition-all group cursor-pointer`}
                    type="button"
                    onClick={toggleVoice}
                  >
                    <div
                      className={`w-10 h-10 rounded-full shadow-sm border flex items-center justify-center transition-colors ${
                        isListening
                          ? 'bg-red-500 text-white border-red-600 animate-pulse'
                          : 'bg-white border-slate-200 text-slate-600 group-hover:border-blue-400 group-hover:text-blue-600'
                      }`}
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </div>
                    <span className="text-xs font-bold text-slate-800 mt-0.5">
                      {isListening ? 'Listening...' : 'Voice Dictation'}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {isListening ? 'Tap to pause' : 'Tap to record'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Notes & Landmarks (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider"
                    htmlFor="flood-notes"
                  >
                    Notes &amp; Landmarks (Optional)
                  </label>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {notes.length} / 280
                  </span>
                </div>
                <textarea
                  className="w-full text-xs rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 placeholder:text-slate-400 text-slate-800 bg-slate-50/50 resize-none border"
                  id="flood-notes"
                  placeholder="Mention cross streets, nearby landmarks, or stranded vehicles..."
                  rows={2}
                  maxLength={280}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Transmitted directly to local civic responders.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2 CONTENT: Save Place */}
          {activeTab === 'save' && (
            <div className="space-y-3.5" id="tab-content-save">
              {/* Place Label Chips */}
              <div>
                <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Place Label
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'Home'
                        ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setSelectedLabelPreset('Home')}
                  >
                    <Home className="w-4 h-4 stroke-current" />
                    <span className="text-[11px] font-bold">Home</span>
                  </button>

                  <button
                    className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'Work'
                        ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setSelectedLabelPreset('Work')}
                  >
                    <Briefcase className="w-4 h-4 stroke-current" />
                    <span className="text-[11px] font-medium">Work</span>
                  </button>

                  <button
                    className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'School'
                        ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setSelectedLabelPreset('School')}
                  >
                    <GraduationCap className="w-4 h-4 stroke-current" />
                    <span className="text-[11px] font-medium">School</span>
                  </button>

                  <button
                    className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'Custom'
                        ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setSelectedLabelPreset('Custom')}
                  >
                    <MapPin className="w-4 h-4 stroke-current" />
                    <span className="text-[11px] font-medium">Custom</span>
                  </button>
                </div>

                {selectedLabelPreset === 'Custom' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2 text-slate-800 bg-slate-50/60 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g. Grandma's House, Gym, Metro Station..."
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* GPS Coordinates Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Coordinates (GPS)
                  </span>
                  <button
                    className="text-[11px] text-blue-600 font-bold flex items-center gap-1 cursor-pointer"
                    type="button"
                    onClick={onSelectOnMap}
                  >
                    <Crosshair className="w-3 h-3 stroke-current" />
                    <span>Select on Map</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block mb-0.5">LATITUDE</span>
                    <input
                      className="w-full text-xs font-mono rounded-xl border border-slate-200 p-2 text-slate-800 bg-slate-50/60 focus:ring-blue-500 focus:border-blue-500"
                      type="text"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block mb-0.5">LONGITUDE</span>
                    <input
                      className="w-full text-xs font-mono rounded-xl border border-slate-200 p-2 text-slate-800 bg-slate-50/60 focus:ring-blue-500 focus:border-blue-500"
                      type="text"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Alert Trigger Threshold */}
              <div>
                <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Alert Trigger Threshold
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={`border-2 rounded-xl p-2.5 cursor-pointer transition-all ${
                      alertThreshold === 'HIGH'
                        ? 'border-orange-400 bg-orange-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    onClick={() => setAlertThreshold('HIGH')}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      <span className="text-[11px] font-bold text-slate-900">High &amp; Severe</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Risk &gt; 50/100</p>
                  </div>

                  <div
                    className={`border-2 rounded-xl p-2.5 cursor-pointer transition-all ${
                      alertThreshold === 'SEVERE'
                        ? 'border-red-500 bg-red-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    onClick={() => setAlertThreshold('SEVERE')}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span className="text-[11px] font-bold text-slate-900">Severe Only</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Risk &gt; 75/100</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sheet Sticky Footer Action Buttons */}
        <div className="p-3.5 px-5 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between gap-3">
          <button
            className="py-2.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>

          {/* Submit for Tab 1 (Report) */}
          {activeTab === 'report' && (
            <button
              className="flex-1 py-3 px-4 bg-blue-600 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              id="btn-footer-report"
              disabled={isSubmittingReport}
              onClick={handleReportSubmit}
              type="button"
            >
              {isSubmittingReport ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : reportSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Report Submitted!</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 rotate-45 -mt-0.5" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          )}

          {/* Submit for Tab 2 (Save Place) */}
          {activeTab === 'save' && (
            <button
              className="flex-1 py-3 px-4 bg-blue-600 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              id="btn-footer-save"
              disabled={isSubmittingPlace}
              onClick={handleSavePlaceSubmit}
              type="button"
            >
              {isSubmittingPlace ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Place...</span>
                </>
              ) : savePlaceSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Location Saved!</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Confirm &amp; Save Place</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Native Home Indicator Bar */}
        <div className="w-full pb-2 pt-1 flex justify-center bg-slate-50/90">
          <div className="w-32 h-1 bg-slate-300 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
