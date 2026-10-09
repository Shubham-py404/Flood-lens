import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

// Used by the frontend to upload the image directly to AWS
export async function getPresignedUploadUrl(mimeType: string): Promise<{ uploadUrl: string, key: string }> {
    const key = `reports/flood-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes to upload
    return { uploadUrl, key };
}

// Used to display the image on the map
export async function getPresignedImageUrl(imageKey: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: imageKey,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// Used by the backend to fetch the image into memory for Bedrock AI analysis
export async function getFileBufferFromS3(imageKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: imageKey,
    });
    const response = await s3Client.send(command);
    const byteArray = await response.Body?.transformToByteArray();
    if (!byteArray) throw new Error("Failed to read image from S3");
    return Buffer.from(byteArray);
}