'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  MapPin,
  X,
  Camera,
  Upload,
  Send,
  Loader2,
  CheckCircle2,
  Crosshair,
  Home,
  Briefcase,
  GraduationCap,
  Trash2,
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

  // Sync initial tab whenever opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMessage(null);
    }
  }, [isOpen, initialTab]);

  // Tab 1 (Report Flood) State
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [severityRating, setSeverityRating] = useState<number>(3); // 1-5 rating, default 3 (Moderate)
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Tab 2 (Save Place) State
  const [selectedLabelPreset, setSelectedLabelPreset] = useState<'Home' | 'Work' | 'School' | 'Custom'>('Home');
  const [customLabel, setCustomLabel] = useState('');
  const [latInput, setLatInput] = useState(() => currentCoords ? currentCoords.lat.toFixed(6) : '');
  const [lngInput, setLngInput] = useState(() => currentCoords ? currentCoords.lng.toFixed(6) : '');
  const [alertThreshold, setAlertThreshold] = useState<RiskLevel>('HIGH');
  const [isSubmittingPlace, setIsSubmittingPlace] = useState(false);
  const [savePlaceSuccess, setSavePlaceSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const prevCoordsRef = React.useRef(currentCoords);
  useEffect(() => {
    if (
      currentCoords &&
      (!prevCoordsRef.current ||
        prevCoordsRef.current.lat !== currentCoords.lat ||
        prevCoordsRef.current.lng !== currentCoords.lng)
    ) {
      prevCoordsRef.current = currentCoords;
      setLatInput(currentCoords.lat.toFixed(6));
      setLngInput(currentCoords.lng.toFixed(6));
    }
  }, [currentCoords]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const clearPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setPhotoPreview(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
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
      let uploadedImageUrl: string | undefined = undefined;

      // 1. Upload photo if selected (with automatic resilience fallback)
      if (selectedFile) {
        let uploaded = false;
        try {
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
            const putRes = await fetch(uploadUrl, {
              method: 'PUT',
              body: selectedFile,
              headers: { 'Content-Type': selectedFile.type || 'image/jpeg' },
            });
            if (putRes.ok) {
              s3ImageKey = fileKey;
              uploaded = true;
            }
          }
        } catch (s3Err) {
          console.warn('Direct S3 upload could not complete, trying resilient local upload:', s3Err);
        }

        // Resilient Fallback: If cloud upload could not complete, upload via local API endpoint
        if (!uploaded) {
          try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            const localRes = await fetch('/api/reports/upload', {
              method: 'POST',
              body: formData,
            });
            if (localRes.ok) {
              const localData = await localRes.json();
              s3ImageKey = localData.fileKey;
              uploadedImageUrl = localData.imageUrl;
              uploaded = true;
            }
          } catch (localErr) {
            console.warn('Local upload fallback note:', localErr);
          }
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
          image_url: uploadedImageUrl,
          userSeverityRating: severityRating,
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
        setSeverityRating(3);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Report submission failed.';
      setErrorMessage(msg);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Saving place failed.';
      setErrorMessage(msg);
    } finally {
      setIsSubmittingPlace(false);
    }
  };

  if (!isOpen) return null;

  const severityLevels = [
    { value: 1, label: 'Minor', depth: '10cm', color: 'bg-emerald-500' },
    { value: 2, label: 'Ankle', depth: '20cm', color: 'bg-teal-500' },
    { value: 3, label: 'Knee', depth: '35cm', color: 'bg-amber-500' },
    { value: 4, label: 'Waist', depth: '50cm', color: 'bg-orange-500' },
    { value: 5, label: 'Severe', depth: '75cm+', color: 'bg-red-500' },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/45 backdrop-blur-xs transition-opacity duration-300"
      id="flood-actions-modal"
    >
      {/* Backdrop dismiss click area */}
      <div className="flex-1" onClick={onClose} />

      {/* Mobile Bottom Sheet Container - Clear floating bottom dock (mb-20 on mobile, mb-6 on desktop) */}
      <div className="w-full max-w-lg mx-auto bg-white/95 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-[#e2e0d8] flex flex-col max-h-[calc(100dvh-6rem)] sm:max-h-[82vh] mb-20 sm:mb-6 mx-3 sm:mx-auto overflow-hidden transform transition-transform animate-slide-up">
        {/* Sheet Handle Drag Bar */}
        <div
          className="w-full pt-3 pb-1 flex justify-center items-center cursor-grab"
          onClick={onClose}
        >
          <div className="w-10 h-1.5 bg-[#d4d1c5] rounded-full"></div>
        </div>

        {/* Sheet Header */}
        <div className="px-5 pt-2 pb-3.5 flex items-start justify-between border-b border-[#eceae1] bg-[#faf9f5]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eef3f0] border border-[#d3e2d9] text-[#244837] flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-[#244837]" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#1c2621] leading-tight">Field Sentinel Action</h2>
              <p className="text-[11px] text-[#617469] mt-0.5 font-medium">
                Report surface flood hazard or monitor location for alerts
              </p>
            </div>
          </div>
          <button
            aria-label="Close sheet"
            className="p-1.5 text-[#87968e] hover:text-[#1c2621] hover:bg-[#edebe4] rounded-full transition-colors cursor-pointer"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Dual Tab Switcher */}
        <div className="px-5 pt-3 pb-2 bg-[#f6f5f0]/80">
          <div className="grid grid-cols-2 p-1.5 bg-[#e7e5dc]/80 rounded-2xl text-xs font-semibold border border-[#dcd9ce]">
            <button
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all font-bold cursor-pointer ${
                activeTab === 'report'
                  ? 'shadow-xs bg-white text-[#1b382b] border border-[#d8d5c8]'
                  : 'text-[#617469] hover:text-[#1c2621]'
              }`}
              id="tab-btn-report"
              onClick={() => setActiveTab('report')}
              type="button"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#244837]" />
              <span>Report Inundation</span>
            </button>
            <button
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all font-semibold cursor-pointer ${
                activeTab === 'save'
                  ? 'shadow-xs bg-white text-[#1b382b] border border-[#d8d5c8]'
                  : 'text-[#617469] hover:text-[#1c2621]'
              }`}
              id="tab-btn-save"
              onClick={() => setActiveTab('save')}
              type="button"
            >
              <MapPin className="w-3.5 h-3.5 text-[#8a7258]" />
              <span>Watch Place</span>
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
            <div className="space-y-4" id="tab-content-report">
             

              {/* Photo Evidence Section (Add Photo) */}
              <div>
                <span className="block text-[10px] font-extrabold text-[#77887e] uppercase tracking-wider mb-2">
                  Photo Evidence
                </span>
                
                {/* Hidden Camera Input (Opens device camera directly) */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />

                {/* Hidden File Upload Input (Opens device photo gallery/file explorer) */}
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />

                {photoPreview ? (
                  <div className="relative border border-[#244837] rounded-2xl overflow-hidden bg-[#1c2621] group shadow-sm">
                    <img
                      src={photoPreview}
                      alt="Uploaded flood evidence"
                      className="w-full h-44 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-3.5">
                      <span className="text-xs font-bold text-white truncate max-w-[200px]">
                        {selectedFile?.name}
                      </span>
                      <button
                        onClick={clearPhoto}
                        type="button"
                        className="px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Option 1: Capture from Live Camera */}
                    <button
                      className="relative overflow-hidden border border-[#e2e0d8] hover:border-[#244837] active:bg-[#f2f0e8] rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 bg-[#faf9f5]/80 hover:bg-white transition-all cursor-pointer group shadow-2xs"
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-[#eef3f0] border border-[#d3e2d9] group-hover:border-[#3a7d5c] group-hover:scale-105 flex items-center justify-center text-[#244837] transition-all shadow-2xs">
                        <Camera className="w-5 h-5 text-[#244837]" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-[#1c2621]">Capture Photo</span>
                        <span className="text-[10px] text-[#77887e] mt-0.5 font-medium">Use Live Camera</span>
                      </div>
                    </button>

                    {/* Option 2: Upload from Device Storage / Gallery */}
                    <button
                      className="relative overflow-hidden border border-[#e2e0d8] hover:border-[#244837] active:bg-[#f2f0e8] rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 bg-[#faf9f5]/80 hover:bg-white transition-all cursor-pointer group shadow-2xs"
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-white border border-[#e2e0d8] group-hover:border-[#3a7d5c] group-hover:scale-105 flex items-center justify-center text-[#5a6b62] group-hover:text-[#244837] transition-all shadow-2xs">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-[#1c2621]">Upload Image</span>
                        <span className="text-[10px] text-[#77887e] mt-0.5 font-medium">Gallery / Storage</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Touch-Friendly Severity Rating Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-[#77887e] uppercase tracking-wider">
                    Severity Rating
                  </span>
                  <span className="text-[10px] font-extrabold text-[#244837] bg-[#eef3f0] px-2 py-0.5 rounded-full border border-[#d3e2d9]">
                    Level {severityRating}/5
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {severityLevels.map((lvl) => {
                    const isSelected = severityRating === lvl.value;
                    return (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => setSeverityRating(lvl.value)}
                        className={`py-2.5 px-1 rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-2 border-[#244837] bg-[#eef3f0] text-[#1b382b] font-black shadow-xs ring-2 ring-[#244837]/15 scale-[1.02]'
                            : 'border-[#e2e0d8] bg-white/90 hover:border-[#c5d8cd] hover:bg-[#faf9f5] text-[#5a6b62]'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${lvl.color}`} />
                          <span className="text-xs font-black tracking-tight">{lvl.value}</span>
                        </div>
                        <span className="text-[10px] font-bold leading-tight truncate max-w-full">{lvl.label}</span>
                        <span className="text-[9px] text-[#77887e] font-semibold">{lvl.depth}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2 CONTENT: Save Place */}
          {activeTab === 'save' && (
            <div className="space-y-3.5" id="tab-content-save">
              {/* Place Label Chips */}
              <div>
                <span className="block text-[10px] font-extrabold text-[#77887e] uppercase tracking-wider mb-2">
                  PLACE LABEL
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    className={`py-2.5 px-2 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'Home'
                        ? 'border-2 border-[#244837] bg-[#eef3f0] text-[#1b382b] font-black shadow-xs ring-2 ring-[#244837]/15'
                        : 'border-[#e2e0d8] hover:border-[#c5d8cd] bg-white text-[#5a6b62]'
                    }`}
                    type="button"
                    onClick={() => setSelectedLabelPreset('Home')}
                  >
                    <Home className="w-4 h-4 stroke-current" />
                    <span className="text-[11px] font-bold">Home</span>
                  </button>

                  <button
                    className={`py-2.5 px-2 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'Work'
                        ? 'border-2 border-[#244837] bg-[#eef3f0] text-[#1b382b] font-black shadow-xs ring-2 ring-[#244837]/15'
                        : 'border-[#e2e0d8] hover:border-[#c5d8cd] bg-white text-[#5a6b62]'
                    }`}
                    type="button"
                    onClick={() => setSelectedLabelPreset('Work')}
                  >
                    <Briefcase className="w-4 h-4 stroke-current" />
                    <span className="text-[11px] font-bold">Work</span>
                  </button>

                  <button
                    className={`py-2.5 px-2 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'School'
                        ? 'border-2 border-[#244837] bg-[#eef3f0] text-[#1b382b] font-black shadow-xs ring-2 ring-[#244837]/15'
                        : 'border-[#e2e0d8] hover:border-[#c5d8cd] bg-white text-[#5a6b62]'
                    }`}
                    type="button"
                    onClick={() => setSelectedLabelPreset('School')}
                  >
                    <GraduationCap className="w-4 h-4 stroke-current" />
                    <span className="text-[11px] font-bold">School</span>
                  </button>

                  <button
                    className={`py-2.5 px-2 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'Custom'
                        ? 'border-2 border-[#244837] bg-[#eef3f0] text-[#1b382b] font-black shadow-xs ring-2 ring-[#244837]/15'
                        : 'border-[#e2e0d8] hover:border-[#c5d8cd] bg-white text-[#5a6b62]'
                    }`}
                    type="button"
                    onClick={() => setSelectedLabelPreset('Custom')}
                  >
                    <MapPin className="w-4 h-4 stroke-current" />
                    <span className="text-[11px] font-bold">Custom</span>
                  </button>
                </div>

                {selectedLabelPreset === 'Custom' && (
                  <div className="mt-2.5">
                    <input
                      type="text"
                      className="w-full text-xs font-semibold rounded-xl border border-[#d8d5c8] p-2.5 text-[#1c2621] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#244837]/30 focus:border-[#244837]"
                      placeholder="e.g. Grandma's House, Gym, Metro Station..."
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* GPS Coordinates Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-extrabold text-[#77887e] uppercase tracking-wider">
                    COORDINATES (GPS)
                  </span>
                  <button
                    className="text-[11px] text-[#244837] hover:text-[#1b382b] font-bold flex items-center gap-1 cursor-pointer"
                    type="button"
                    onClick={onSelectOnMap}
                  >
                    <Crosshair className="w-3.5 h-3.5 stroke-current" />
                    <span>Select on Map</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-[#77887e] font-bold block mb-1">LATITUDE</span>
                    <input
                      className="w-full text-xs font-mono rounded-xl border border-[#d8d5c8] p-2.5 text-[#1c2621] bg-[#faf9f5]/80 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#244837]/30 focus:border-[#244837]"
                      type="text"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-[#77887e] font-bold block mb-1">LONGITUDE</span>
                    <input
                      className="w-full text-xs font-mono rounded-xl border border-[#d8d5c8] p-2.5 text-[#1c2621] bg-[#faf9f5]/80 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#244837]/30 focus:border-[#244837]"
                      type="text"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Alert Trigger Threshold */}
              <div>
                <span className="block text-[10px] font-extrabold text-[#77887e] uppercase tracking-wider mb-2">
                  ALERT TRIGGER THRESHOLD
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={`border-2 rounded-2xl p-3 cursor-pointer transition-all ${
                      alertThreshold === 'HIGH'
                        ? 'border-amber-500 bg-amber-50/70 shadow-2xs'
                        : 'border-[#e2e0d8] bg-white hover:border-[#d4d1c5]'
                    }`}
                    onClick={() => setAlertThreshold('HIGH')}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span className="text-xs font-black text-[#1c2621]">High &amp; Severe</span>
                    </div>
                    <p className="text-[10px] text-[#77887e] font-medium leading-tight">Risk score &gt; 50/100</p>
                  </div>

                  <div
                    className={`border-2 rounded-2xl p-3 cursor-pointer transition-all ${
                      alertThreshold === 'SEVERE'
                        ? 'border-rose-500 bg-rose-50/70 shadow-2xs'
                        : 'border-[#e2e0d8] bg-white hover:border-[#d4d1c5]'
                    }`}
                    onClick={() => setAlertThreshold('SEVERE')}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <span className="text-xs font-black text-[#1c2621]">Severe Only</span>
                    </div>
                    <p className="text-[10px] text-[#77887e] font-medium leading-tight">Risk score &gt; 75/100</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sheet Sticky Footer Action Buttons */}
        <div className="p-3.5 px-5 pb-4 sm:pb-3.5 border-t border-[#eceae1] bg-[#faf9f5]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <button
            className="py-2.5 px-3 text-xs font-bold text-[#5a6b62] hover:text-[#1c2621] transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>

          {/* Submit for Tab 1 (Report) */}
          {activeTab === 'report' && (
            <button
              className="flex-1 py-3 px-4 bg-[#244837] active:bg-[#1a3427] text-white text-xs font-bold rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          )}

          {/* Submit for Tab 2 (Save Place) */}
          {activeTab === 'save' && (
            <button
              className="flex-1 py-3 px-4 bg-[#244837] active:bg-[#1a3427] text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
      </div>
    </div>
  );
}
