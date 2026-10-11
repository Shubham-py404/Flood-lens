import { ReportStatus, RiskLevel } from './db';

export interface PresignedUrlRequest {
    filename: string;
    contentType: string;
}

export interface PresignedUrlResponse {
    uploadUrl: string;
    fileKey: string;
}

export interface SubmitReportRequest {
    latitude: number;
    longitude: number;
    s3_image_key?: string;
    description?: string;
    user_id?: string;
}

export interface SubmitReportResponse {
    success: boolean;
    report_id: string;
    road_segment_id: string | null;
    status: ReportStatus;
    message: string;
}

export interface AirQualityData {
  aqi: number;
  category: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  categoryColor: string;
  pm2_5: number;
  pm10: number;
  nitrogen_dioxide: number;
  ozone: number;
  sulphur_dioxide: number;
  carbon_monoxide: number;
  source: string;
  observed_at: string;
  is_stale: boolean;
  advice: string;
  location_name?: string;
  indian_aqi?: number;
  indian_category?: string;
  indian_category_color?: string;
  guidance?: { icon: 'mask' | 'window' | 'outdoor' | 'check'; text: string }[];
}

export interface EnvironmentSummary {
  location: {
    lat: number;
    lng: number;
    name?: string;
  };
  air_quality: AirQualityData;
  weather: {
    temperature_c: number;
    precipitation_mm: number;
    rain_24h_mm: number;
    weather_code: number;
    weather_desc: string;
  };
  active_incidents_count: number;
  severe_incidents_count: number;
  freshness: string;
}

export interface NearbyIncidentCard {
  id: string;
  road_name: string;
  lat: number;
  lng: number;
  distance_m: number;
  severity: RiskLevel;
  depth_cm?: number;
  image_url?: string;
  time_ago: string;
  created_at: string;
  confirm_count: number;
  resolved_count: number;
  status: ReportStatus;
  description?: string;
}

export interface AssistantQueryRequest {
  message: string;
  lat?: number;
  lng?: number;
}

export interface AssistantQueryResponse {
  answer: string;
  citations: Array<{
    type: 'air' | 'incident' | 'weather';
    title: string;
    value: string;
  }>;
  uncertainty_note?: string;
}
