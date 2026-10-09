import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

export interface FloodAnalysisResult {
    is_flooded: boolean;
    severity: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
    estimated_depth_cm: number;
    visual_markers: string[];
    confidence: number;
}

export async function analyzeFloodImage(
    imageBuffer: Buffer,
    mimeType: string
): Promise<FloodAnalysisResult> {
    const base64Image = imageBuffer.toString('base64');

    const systemPrompt = `You are a municipal urban flood assessment AI. Analyze the image and determine whether waterlogging or urban flooding is present. Return ONLY a single raw JSON object matching this TypeScript interface without markdown wrappers or conversational filler:
{
  "is_flooded": boolean,
  "severity": "LOW" | "MODERATE" | "HIGH" | "SEVERE",
  "estimated_depth_cm": number,
  "visual_markers": string[],
  "confidence": number
}`;

    const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mimeType,
                            data: base64Image,
                        },
                    },
                    {
                        type: 'text',
                        text: systemPrompt,
                    },
                ],
            },
        ],
    };

    const command = new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
    });

    const response = await bedrockClient.send(command);
    const responseData = JSON.parse(new TextDecoder().decode(response.body));
    const rawText = responseData.content?.[0]?.text?.trim() || '{}';

    // Strip possible markdown fences if returned
    const sanitizedJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(sanitizedJson) as FloodAnalysisResult;
}