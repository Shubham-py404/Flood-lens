import { RiskLevel, ReportStatus, VerificationType } from './db';

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
    voice_transcript?: string;
    depth_estimate?: string;
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
