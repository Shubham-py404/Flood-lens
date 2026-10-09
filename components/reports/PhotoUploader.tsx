'use client';

import React, { useRef, useState } from 'react';
import { Camera, UploadCloud, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface PhotoUploaderProps {
  onUploadSuccess: (fileKey: string) => void;
  onUploadClear: () => void;
  disabled?: boolean;
}

export default function PhotoUploader({
  onUploadSuccess,
  onUploadClear,
  disabled = false,
}: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file size constraint (15MB)
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('Image size exceeds 15MB limit.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setFileName(file.name);
    setFileSize(formatBytes(file.size));

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    try {
      // 1. Obtain presigned URL from server
      const presignRes = await fetch('/api/reports/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'image/jpeg',
        }),
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to initialize secure upload');
      }

      const { uploadUrl, fileKey } = await presignRes.json();

      // 2. Direct S3 PUT upload
      const s3UploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
        },
        body: file,
      });

      if (!s3UploadRes.ok) {
        throw new Error(`Direct upload failed (HTTP ${s3UploadRes.status})`);
      }

      onUploadSuccess(fileKey);
    } catch (err: any) {
      console.error('Photo upload error:', err);
      setUploadError(err.message || 'Image upload failed. Please try again.');
      handleRemovePhoto();
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFileName(null);
    setFileSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onUploadClear();
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />

      {!previewUrl ? (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click();
            }
          }}
          className={`group relative border border-dashed rounded-xl p-5 text-center transition-all duration-150 cursor-pointer ${
            disabled
              ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
              : 'border-gray-300 bg-gray-50/60 hover:bg-gray-50 hover:border-blue-500'
          }`}
        >
          <div className="mx-auto w-10 h-10 rounded-full bg-white border border-gray-200 shadow-xs flex items-center justify-center text-gray-600 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors mb-2.5">
            <Camera className="w-5 h-5" />
          </div>
          <div className="text-sm font-semibold text-gray-900">
            Take a photo or upload
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            JPG, PNG, WebP up to 15MB
          </p>
        </div>
      ) : (
        <div className="relative rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs">
          <div className="relative aspect-[16/9] w-full bg-gray-900 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded flood evidence"
              className="w-full h-full object-cover"
            />

            {isUploading && (
              <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="text-xs font-medium">Uploading image...</span>
              </div>
            )}

            {!isUploading && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-gray-900/70 hover:bg-gray-900 text-white backdrop-blur-xs transition-colors cursor-pointer"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="px-3.5 py-2.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-xs">
            <div className="truncate max-w-[220px]">
              <span className="font-medium text-gray-800 truncate block">{fileName}</span>
              <span className="text-gray-500 text-[11px]">{fileSize}</span>
            </div>
            {!isUploading && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Uploaded
              </span>
            )}
          </div>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-2 bg-red-50 p-2 rounded-lg border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
}
