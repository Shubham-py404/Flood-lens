import { NextResponse } from 'next/server';
import { createPresignedUploadUrl } from '@/lib/aws/s3';

export async function POST(request: Request) {
    try {
        let body: any;
        try {
            body = await request.json();
        } catch (parseError) {
            return NextResponse.json(
                { error: 'Invalid JSON request payload' },
                { status: 400 }
            );
        }

        const { filename, contentType } = body || {};

        if (!filename || !contentType) {
            return NextResponse.json(
                { error: 'filename and contentType are required' },
                { status: 400 }
            );
        }

        // Validate basic image MIME types
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (!allowedTypes.includes(contentType.toLowerCase())) {
            return NextResponse.json(
                { error: 'Unsupported file type. Only JPEG, PNG, WEBP, and HEIC images are allowed.' },
                { status: 400 }
            );
        }

        const { uploadUrl, fileKey } = await createPresignedUploadUrl(filename, contentType);

        return NextResponse.json({
            uploadUrl,
            fileKey,
        });
    } catch (error: any) {
        console.error('Presigned URL generation error:', error?.message || error);
        return NextResponse.json(
            { error: error?.message || 'Failed to generate upload URL' },
            { status: 500 }
        );
    }
}
