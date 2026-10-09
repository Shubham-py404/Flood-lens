import { RiskLevel } from './db';

export interface GeoJsonLineStringGeometry {
    type: 'LineString';
    coordinates: [number, number][]; // [longitude, latitude]
}

export interface GeoJsonPointGeometry {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
}

export interface RoadFeatureProperties {
    id: string;
    road_name: string;
    current_risk_score: number;
    current_risk_level: RiskLevel;
    risk_factors: Record<string, unknown>;
}

export interface RoadFeatureCollection {
    type: 'FeatureCollection';
    features: {
        type: 'Feature';
        geometry: GeoJsonLineStringGeometry;
        properties: RoadFeatureProperties;
    }[];
}