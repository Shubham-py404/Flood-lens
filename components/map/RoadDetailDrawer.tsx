import { X, Droplets, Mountain, History, AlertTriangle, MapPin } from 'lucide-react';
import { RoadFeatureProperties } from '@/types/geojson';

interface RoadDetailDrawerProps {
  road: RoadFeatureProperties | null;
  onClose: () => void;
  onSaveAsPlace?: (road: RoadFeatureProperties) => void;
}

export default function RoadDetailDrawer({ road, onClose, onSaveAsPlace }: RoadDetailDrawerProps) {
  if (!road) return null;

  // MapLibre parses JSON properties as strings sometimes, so we safely parse it
  const riskFactors = typeof road.risk_factors === 'string' 
    ? JSON.parse(road.risk_factors) 
    : road.risk_factors || {};

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'SEVERE': return 'text-red-600 bg-red-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'MODERATE': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="absolute top-0 left-0 h-full w-80 bg-white shadow-2xl z-20 border-r border-gray-200 transform transition-transform duration-300 flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{road.road_name}</h2>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold mt-2 ${getRiskColor(road.current_risk_level)}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {road.current_risk_level} RISK ({road.current_risk_score}/100)
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Body: Risk Explanations */}
      <div className="p-5 flex-1 overflow-y-auto">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Risk Contributors</h3>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Rainfall & Weather</p>
              <p className="text-xs text-gray-500 mt-0.5">Drives {riskFactors.rainfall_pct || 0}% of the current risk score.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Terrain Elevation</p>
              <p className="text-xs text-gray-500 mt-0.5">Drives {riskFactors.elevation_pct || 0}% of the risk. {riskFactors.summary}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Historical Baselines</p>
              <p className="text-xs text-gray-500 mt-0.5">Accounts for {riskFactors.historical_pct || 0}% based on past flooding events.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      {onSaveAsPlace && (
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={() => onSaveAsPlace(road)}
            className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20"
          >
            <MapPin className="w-3.5 h-3.5" />
            Save Road as Monitored Place
          </button>
        </div>
      )}
    </div>
  );
}