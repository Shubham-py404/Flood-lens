import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

/**
 * Generates a 15-minute presigned PUT URL for direct client-side S3 upload.
 * Object key format: reports/{timestamp}-{filename}
 */
export async function createPresignedUploadUrl(
    filename: string,
    contentType: string
): Promise<{ uploadUrl: string; fileKey: string }> {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileKey = `reports/${Date.now()}-${cleanFilename}`;

    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileKey,
        ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return { uploadUrl, fileKey };
}

/**
 * Downloads a file from S3 and returns it as a Node.js Buffer
 */
export async function getFileBufferFromS3(fileKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileKey,
    });

    const response = await s3Client.send(command);
    if (!response.Body) {
        throw new Error(`Empty body received from S3 for key: ${fileKey}`);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
}

// Used to display the image on the map
export async function getPresignedImageUrl(imageKey: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: imageKey,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Uploads a raw file buffer to Amazon S3 (fallback / direct helper)
 */
export async function uploadImageToS3(fileBuffer: Buffer, mimeType: string): Promise<string> {
    const fileName = `reports/${Date.now()}-flood-${Math.random().toString(36).substring(7)}.jpg`;

    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType,
    });

    await s3Client.send(command);
    return fileName;
}