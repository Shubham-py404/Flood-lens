export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
export type ReportStatus = 'PENDING' | 'VERIFIED' | 'RESOLVED' | 'REJECTED';
export type VerificationType = 'CONFIRM' | 'RESOLVED';

export interface RoadSegment {
    id: string;
    road_name: string;
    elevation_m: number;
    historical_flood_count: number;
    historical_risk_score: number;
    drainage_capacity_score: number;
    current_risk_score: number;
    current_risk_level: RiskLevel;
    risk_factors: {
        rainfall_pct?: number;
        elevation_pct?: number;
        historical_pct?: number;
        summary?: string;
    };
    last_calculated_at: string;
}

export interface CitizenReport {
    id: string;
    user_id?: string;
    cluster_id?: string;
    road_segment_id?: string;
    s3_image_key?: string;
    voice_transcript?: string;
    user_reported_depth?: string;
    description?: string;
    ai_analyzed: boolean;
    ai_is_flooded?: boolean;
    ai_severity?: RiskLevel;
    ai_estimated_depth_cm?: number;
    ai_confidence?: number;
    ai_visual_markers?: string[];
    status: ReportStatus;
    created_at: string;
}

export interface SavedLocation {
    id: string;
    user_id: string;
    label: string;
    latitude: number;
    longitude: number;
    nearest_road_segment_id?: string | null;
    nearest_road_name?: string | null;
    nearest_road_risk_level?: RiskLevel | null;
    nearest_road_risk_score?: number | null;
    alert_on_risk_level: RiskLevel;
    is_active: boolean;
    created_at: string;
}

export interface CreateSavedLocationInput {
    label: string;
    latitude: number;
    longitude: number;
    alert_on_risk_level?: RiskLevel;
}

export interface UserAlert {
    id: string;
    user_id: string;
    saved_location_id: string;
    saved_location_label?: string;
    road_segment_id: string;
    road_name?: string;
    previous_risk_level: RiskLevel;
    escalated_risk_level: RiskLevel;
    message: string;
    is_read: boolean;
    created_at: string;
    latitude?: number;
    longitude?: number;
}