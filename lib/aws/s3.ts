import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

/**
 * Uploads a raw file buffer to Amazon S3
 * @returns The S3 object key (filename)
 */
// Inside lib/aws/s3.ts
export async function uploadImageToS3(fileBuffer: Buffer, mimeType: string): Promise<string> {
    const fileName = `reports/flood-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME, // Updated to match your .env
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType,
    });

    await s3Client.send(command);
    return fileName;
}

/**
 * Generates a temporary viewing URL for the frontend
 */
export async function getPresignedImageUrl(imageKey: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: imageKey,
    });

    // URL expires in 1 hour for security
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}