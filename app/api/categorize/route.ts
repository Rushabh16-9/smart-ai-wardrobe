import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { AICategorizationResult } from '@/types/wardrobe';

const CATEGORIZATION_PROMPT = `You are a professional fashion analyst AI. Analyze the clothing item in this image and return ONLY a strict JSON object with no markdown, no explanation, no code fences.

Return exactly this JSON shape:
{
  "type": "string (e.g. T-Shirt, Dress, Jeans, Sneakers, Blazer, Coat, etc.)",
  "color": "string (primary color, be specific e.g. Navy Blue, Ivory White, Burgundy)",
  "pattern": "string (e.g. Solid, Striped, Plaid, Floral, Geometric, Animal Print, etc.)",
  "season": ["array of applicable seasons from: Spring, Summer, Autumn, Winter, All Season"],
  "formality": "string (exactly one of: Casual, Smart Casual, Business Casual, Semi-Formal, Formal, Black Tie)"
}

Be specific and accurate. If the image doesn't show a clothing item, return the same JSON with empty strings.`;

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
    }

    const model = getGeminiModel('gemini-3.6-flash');

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType ?? 'image/png',
        },
      },
      CATEGORIZATION_PROMPT,
    ]);

    const rawText = result.response.text().trim();

    // Strip any accidental markdown code fences
    const jsonText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let categorization: AICategorizationResult;
    try {
      categorization = JSON.parse(jsonText);
    } catch {
      console.error('[/api/categorize] JSON parse error. Raw:', rawText);
      return NextResponse.json(
        { error: 'AI returned invalid JSON', rawText },
        { status: 500 }
      );
    }

    // Ensure season is an array
    if (!Array.isArray(categorization.season)) {
      categorization.season = categorization.season
        ? [categorization.season as unknown as string]
        : [];
    }

    return NextResponse.json(categorization);
  } catch (error: unknown) {
    console.error('[/api/categorize] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Categorization failed' },
      { status: 500 }
    );
  }
}
