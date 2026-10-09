import React from 'react';

export default function RiskLegend() {
  const levels = [
    { label: 'Severe (75-100)', color: 'bg-red-500' },
    { label: 'High (50-74)', color: 'bg-orange-500' },
    { label: 'Moderate (25-49)', color: 'bg-yellow-500' },
    { label: 'Low (0-24)', color: 'bg-green-500' },
  ];

  return (
    <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-gray-200 z-10 w-48">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Live Risk Level</h3>
      <div className="flex flex-col gap-2">
        {levels.map((lvl) => (
          <div key={lvl.label} className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${lvl.color} shadow-sm`} />
            <span className="text-xs font-medium text-gray-600">{lvl.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}