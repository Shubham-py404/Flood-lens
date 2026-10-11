'use client';

import React, { useState } from 'react';
import { X, Camera, UploadCloud, Loader2, AlertTriangle, CheckCircle, Droplets } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  onReportSubmitted?: () => void;
}

export default function ReportModal({ isOpen, onClose, lat, lng, onReportSubmitted }: ReportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [severity, setSeverity] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setSeverity(0);
    setAiResult(null);
    setLoading(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    // 1. Only block if severity is 0. Photo is now optional.
    if (severity === 0) return;
    setLoading(true);

    try {
      let finalS3Key = null;

      // 2. Only upload to S3 if a file was selected
      if (file) {
        const filename = file.name || `hazard-${Date.now()}.jpg`;
        const contentType = file.type || 'image/jpeg';

        const urlRes = await fetch('/api/reports/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, contentType }),
        });

        if (!urlRes.ok) {
          throw new Error('Failed to obtain presigned upload URL');
        }

        let uploaded = false;
        try {
          const { uploadUrl, key, fileKey } = await urlRes.json();
          finalS3Key = fileKey || key;

          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': contentType },
          });

          if (uploadRes.ok) {
            uploaded = true;
          }
        } catch (s3Err) {
          console.warn('S3 direct put issue, falling back to local upload endpoint:', s3Err);
        }

        if (!uploaded) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            const localRes = await fetch('/api/reports/upload', {
              method: 'POST',
              body: formData,
            });
            if (localRes.ok) {
              const localData = await localRes.json();
              finalS3Key = localData.fileKey;
            }
          } catch (localErr) {
            console.warn('Local upload fallback note:', localErr);
          }
        }
      }

      // 3. Submit to backend (s3Key might be null, backend handles bypassing AI)
      const submitRes = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3Key: finalS3Key,
          s3_image_key: finalS3Key,
          lat,
          lng,
          latitude: lat,
          longitude: lng,
          userSeverityRating: severity,
          depth_estimate: `Severity Level ${severity}/5`,
          description: `Citizen Severity Rating: ${severity}/5`,
        }),
      });

      if (!submitRes.ok) {
        throw new Error('Failed to submit report to server');
      }

      const resData = await submitRes.json();

      // Show success screen (fallback to manual_only if no AI analysis was returned)
      setAiResult(resData.ai_analysis || { manual_only: true });
      onReportSubmitted?.();
    } catch (error) {
      console.error('Upload failed', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 pb-16 sm:pb-0 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[calc(100dvh-4.75rem)] sm:max-h-[92dvh]">
        {/* Header */}
        <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
          <h2 className="font-bold flex items-center text-lg">
            <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" /> Report Hazard
          </h2>
          <button
            onClick={handleClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {!aiResult ? (
            <div className="space-y-6">
              {/* CAMERA CAPTURE (Optional) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-700">
                    1. Visual Evidence <span className="text-slate-400 font-normal">(Optional)</span>
                  </h3>
                  {preview && (
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                      }}
                      className="text-xs text-red-600 hover:underline font-semibold cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 active:bg-slate-100 hover:bg-slate-100 cursor-pointer transition-colors relative overflow-hidden">
                  {preview ? (
                    <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
                        <Camera className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-700 text-sm">Tap to open camera</p>
                      <p className="text-xs text-slate-400 mt-0.5">Rear camera opens automatically</p>
                    </div>
                  )}
                  {/* capture="environment" FORCES the rear camera on mobile */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {/* 1-5 SEVERITY RATING */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-2">
                  2. Severity Level <span className="text-red-500">*</span>
                </h3>
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-2xl border border-slate-200 gap-1.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSeverity(level)}
                      className={`flex flex-col items-center justify-center flex-1 h-14 rounded-xl transition-all cursor-pointer ${
                        severity === level
                          ? level >= 4
                            ? 'bg-red-500 text-white scale-105 shadow-lg'
                            : 'bg-blue-500 text-white scale-105 shadow-lg'
                          : 'text-slate-400 hover:bg-slate-200/80 bg-white border border-slate-100'
                      }`}
                    >
                      <Droplets className="w-5 h-5 mb-0.5" />
                      <span className="text-[11px] font-black">{level}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2 px-2 font-medium">
                  <span>Puddle (1)</span>
                  <span>Moderate (3)</span>
                  <span>Unpassable (5)</span>
                </div>
              </div>

              {/* SUBMIT BUTTON - Only disabled if severity is 0 */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={severity === 0 || loading}
                className="w-full flex items-center justify-center py-4 bg-slate-900 text-white rounded-2xl font-black text-base disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-xl cursor-pointer active:scale-98"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5 mr-2" /> Submit Report
                  </>
                )}
              </button>
            </div>
          ) : (
            // SUCCESS SCREEN
            <div className="space-y-4 text-center py-6">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in-75 duration-300">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-800">Report Sent!</h3>
              <p className="text-slate-500 mb-6 text-sm">
                Your report has been logged and added to the community map.
              </p>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-colors cursor-pointer shadow-lg"
              >
                Return to Map
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
