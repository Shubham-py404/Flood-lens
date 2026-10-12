'use client'; // This is required for onClick handlers

import React from 'react';

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-slate-50 p-6 text-center">
      <h1 className="text-3xl font-black text-slate-900 mb-2">You&apos;re Offline</h1>
      <p className="text-slate-500 mb-6">Please check your internet connection to continue using TerraPulse.</p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg cursor-pointer"
      >
        Retry Connection
      </button>
    </div>
  );
}

