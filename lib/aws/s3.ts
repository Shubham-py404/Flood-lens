import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

export async function createPresignedUploadUrl(
    filename: string,
    contentType: string
): Promise<{ uploadUrl: string; fileKey: string }> {
    const fileKey = `reports/${Date.now()}-${filename.replace(/\s+/g, '_')}`;

    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileKey,
        ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // Valid for 15 minutes
    return { uploadUrl, fileKey };
}

export async function getFileBufferFromS3(fileKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileKey,
    });

    const response = await s3Client.send(command);
    const byteArray = await response.Body?.transformToByteArray();

    if (!byteArray) {
        throw new Error(`Failed to retrieve file from S3: ${fileKey}`);
    }

    return Buffer.from(byteArray);
}