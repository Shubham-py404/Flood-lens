import { NextResponse } from 'next/server';
import { getPresignedUploadUrl } from '@/lib/aws/s3';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mimeType = searchParams.get('mimeType') || 'image/jpeg';

    try {
        const { uploadUrl, key } = await getPresignedUploadUrl(mimeType);
        return NextResponse.json({ uploadUrl, key });
    } catch (error) {
        console.error("Failed to generate presigned URL:", error);
        return NextResponse.json({ error: "Could not connect to S3" }, { status: 500 });
    }
}