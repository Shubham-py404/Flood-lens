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