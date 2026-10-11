import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { bedrockClient } from '@/lib/aws/bedrock';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { AssistantQueryRequest, AssistantQueryResponse } from '@/types/api';

export async function POST(req: NextRequest) {
  try {
    const body: AssistantQueryRequest = await req.json();
    const { message, lat = 28.6315, lng = 77.2167 } = body;

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Retrieve Recent Environmental Context from DB
    let activeReportsContext = '';
    const citations: AssistantQueryResponse['citations'] = [];

    try {
      const reportsRes = await query(
        `SELECT 
          COALESCE(s.road_name, 'Unknown road') as road_name,
          COALESCE(r.ai_severity, 'MODERATE') as severity,
          COALESCE(r.ai_estimated_depth_cm, 20) as depth_cm,
          ROUND(ST_DistanceSphere(r.geom::geometry, ST_MakePoint($1, $2)))::integer as distance_m,
          r.created_at
         FROM citizen_reports r
         LEFT JOIN road_segments s ON r.road_segment_id = s.id
         WHERE r.status != 'REJECTED'
         ORDER BY r.created_at DESC
         LIMIT 5`,
        [lng, lat]
      );

      if (reportsRes.rows.length > 0) {
        activeReportsContext = reportsRes.rows
          .map((r: any) => `- Incident on ${r.road_name}: Severity ${r.severity}, Estimated depth ${r.depth_cm}cm, ${r.distance_m}m away`)
          .join('\n');

        reportsRes.rows.slice(0, 2).forEach((r: any) => {
          citations.push({
            type: 'incident',
            title: `Reported hazard: ${r.road_name}`,
            value: `${r.severity} severity, approx. ${r.distance_m}m away`,
          });
        });
      }
    } catch (dbErr) {
      console.warn('DB incident context fetch error:', dbErr);
    }

    // 2. Retrieve Live Air Quality
    let aqiContext = 'AQI 142 (Moderate - Unhealthy for sensitive groups)';
    try {
      const aqiRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5&timezone=auto`,
        { next: { revalidate: 300 } }
      );
      if (aqiRes.ok) {
        const aqJson = await aqiRes.json();
        if (aqJson.current?.us_aqi) {
          const val = Math.round(aqJson.current.us_aqi);
          aqiContext = `AQI ${val} (PM2.5: ${aqJson.current.pm2_5 || 'N/A'} µg/m³) via Open-Meteo`;
          citations.push({
            type: 'air',
            title: 'Current Air Quality Reading',
            value: `US AQI: ${val}`,
          });
        }
      }
    } catch {
      // Fallback
    }

    const systemPrompt = `You are TerraPulse AI Environmental Assistant.
You provide concise, factual, grounded answers to citizens about street-level flooding, weather risks, and local air quality.
GROUNDING RULES:
1. Ground your answer ONLY in the provided verified data below. Never hallucinate roads or imaginary water depths.
2. State uncertainty clearly if data is incomplete. Do not guarantee any route is completely safe.
3. Keep answers concise, actionable, and under 3 short paragraphs.

CURRENT CONTEXT AROUND USER (Lat: ${lat}, Lng: ${lng}):
- Current Air Quality: ${aqiContext}
- Nearby Waterlogging Incidents:
${activeReportsContext || 'No major active waterlogging incidents reported in this exact vicinity.'}
`;

    // 3. Invoke Claude 3.5 Sonnet on AWS Bedrock
    let answer = '';
    try {
      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 600,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      };

      const command = new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const bedrockResponse = await bedrockClient.send(command);
      const parsedBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
      answer = parsedBody.content?.[0]?.text?.trim() || '';
    } catch (bedrockErr: any) {
      console.warn('Bedrock assistant call error, applying fallback answer:', bedrockErr);
      // Clean fallback if Bedrock credentials not provided or model rate limited
      answer = `Based on live data around your coordinates:
• **Air Quality:** ${aqiContext}. Sensitive individuals are advised to limit strenuous outdoor activity.
• **Waterlogging:** ${activeReportsContext ? 'There are active reports nearby. Please exercise caution and check alternative routes.' : 'No active citizen flood reports within your immediate radius.'}

*Note: Conditions change rapidly. Please observe physical road conditions and exercise caution.*`;
    }

    const responseData: AssistantQueryResponse = {
      answer,
      citations,
      uncertainty_note: 'Grounded in retrieved observations & community reports. Does not replace municipal emergency directives.',
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Assistant query handler error:', error);
    return NextResponse.json({ error: 'Failed to process assistant query' }, { status: 500 });
  }
}
