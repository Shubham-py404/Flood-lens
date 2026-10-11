'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  MapPin,
  X,
  Camera,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [severityRating, setSeverityRating] = useState<number>(3); // 1-5 rating, default 3 (Moderate)
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

  const severityLevels = [
    { value: 1, label: 'Minor', depth: '10cm', color: 'bg-emerald-500' },
    { value: 2, label: 'Ankle', depth: '20cm', color: 'bg-teal-500' },
    { value: 3, label: 'Knee', depth: '35cm', color: 'bg-amber-500' },
    { value: 4, label: 'Waist', depth: '50cm', color: 'bg-orange-500' },
    { value: 5, label: 'Severe', depth: '75cm+', color: 'bg-red-500' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-300"
      id="flood-actions-modal"
    >
      {/* Backdrop dismiss click area */}
      <div className="flex-1" onClick={onClose} />

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
              <AlertTriangle className="w-5 h-5 text-blue-600" />
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

        {/* Segmented Dual Tab Switcher */}
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
              <AlertTriangle className="w-3.5 h-3.5 text-blue-600" />
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
            <div className="space-y-4" id="tab-content-report">
             

              {/* Photo Evidence Section (Add Photo) */}
              <div>
                <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                  Photo Evidence
                </span>
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />

                {photoPreview ? (
                  <div className="relative border-2 border-blue-500 rounded-2xl overflow-hidden bg-slate-900 group">
                    <img
                      src={photoPreview}
                      alt="Uploaded flood evidence"
                      className="w-full h-44 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-3">
                      <span className="text-xs font-bold text-white truncate max-w-[200px]">
                        {selectedFile?.name}
                      </span>
                      <button
                        onClick={clearPhoto}
                        type="button"
                        className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full border-2 border-dashed border-slate-300 hover:border-blue-500 active:bg-blue-50/40 rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-1.5 bg-slate-50/60 transition-all cursor-pointer group"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 group-hover:border-blue-400 flex items-center justify-center text-slate-600 group-hover:text-blue-600 transition-colors">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 mt-1">Add Photo</span>
                    <span className="text-[10px] text-slate-400">Camera / Gallery</span>
                  </button>
                )}
              </div>

              {/* Touch-Friendly Severity Rating Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Severity Rating
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    Level {severityRating}/5
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {severityLevels.map((lvl) => {
                    const isSelected = severityRating === lvl.value;
                    return (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => setSeverityRating(lvl.value)}
                        className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-2 border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className={`w-2 h-2 rounded-full ${lvl.color}`} />
                          <span className="text-xs font-extrabold">{lvl.value}</span>
                        </div>
                        <span className="text-[10px] font-bold leading-tight">{lvl.label}</span>
                        <span className="text-[9px] text-slate-400">{lvl.depth}</span>
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
                <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  PLACE LABEL
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'Home'
                        ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700 font-bold'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setSelectedLabelPreset('Home')}
                  >
                    <Home className="w-4 h-4 stroke-current" />
                    <span className="text-[11px] font-medium">Home</span>
                  </button>

                  <button
                    className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedLabelPreset === 'Work'
                        ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700 font-bold'
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
                        ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700 font-bold'
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
                        ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700 font-bold'
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
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-slate-800 bg-slate-50/60 focus:ring-blue-500 focus:border-blue-500"
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
                    COORDINATES (GPS)
                  </span>
                  <button
                    className="text-[11px] text-blue-600 font-bold flex items-center gap-1 cursor-pointer"
                    type="button"
                    onClick={onSelectOnMap}
                  >
                    <Crosshair className="w-3.5 h-3.5 stroke-current" />
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
                  ALERT TRIGGER THRESHOLD
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
                  <Send className="w-3.5 h-3.5" />
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
