import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

export async function analyzeFloodImage(imageBuffer: Buffer, mimeType: string) {
    const base64Image = imageBuffer.toString('base64');

    // Strict prompt engineering to prevent Claude from adding conversational markdown
    const prompt = `You are an emergency flood analysis AI. Analyze this street image.
Output STRICTLY a raw JSON object with no markdown formatting, no backticks, and no introductory text. 
Use this exact schema:
{
  "is_flooded": boolean,
  "severity": "LOW" | "MODERATE" | "HIGH" | "SEVERE",
  "estimated_depth_cm": number,
  "visual_markers": ["array", "of", "strings"],
  "confidence": number (between 0.0 and 1.0)
}`;

    const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: mimeType,
                            data: base64Image,
                        },
                    },
                    { type: "text", text: prompt }
                ]
            }
        ]
    };

    const command = new InvokeModelCommand({
        // Uses the model ID from your .env file
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
    });

    try {
        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const textOutput = responseBody.content[0].text.trim();

        // Parse and return the strict JSON output
        return JSON.parse(textOutput);
    } catch (error) {
        console.error("Bedrock AI Error:", error);
        throw new Error("Failed to process image via Bedrock AI");
    }
}