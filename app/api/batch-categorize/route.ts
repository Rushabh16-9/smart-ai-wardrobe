import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { AICategorizationResult } from '@/types/wardrobe';

const BATCH_CATEGORIZATION_PROMPT = `You are a professional fashion analyst AI. Analyze the following clothing items in the provided images and return ONLY a strict JSON object with no markdown, no explanation, no code fences.

The images are provided in order. You must return a JSON array under the key "results" where each element corresponds to the image in the exact same order.

Return exactly this JSON shape:
{
  "results": [
    {
      "type": "string (e.g. T-Shirt, Dress, Jeans, Sneakers, Blazer, Coat, etc.)",
      "color": "string (primary color, be specific e.g. Navy Blue, Ivory White, Burgundy)",
      "pattern": "string (e.g. Solid, Striped, Plaid, Floral, Geometric, Animal Print, etc.)",
      "season": ["array of applicable seasons from: Spring, Summer, Autumn, Winter, All Season"],
      "formality": "string (exactly one of: Casual, Smart Casual, Business Casual, Semi-Formal, Formal, Black Tie)"
    }
  ]
}

Be specific and accurate. If an image doesn't show a clothing item, return the object with empty strings for that item.`;

export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'An array of items is required' }, { status: 400 });
    }

    if (items.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 items per batch' }, { status: 400 });
    }

    const model = getGeminiModel('gemini-3.6-flash');

    const contents = [
      ...items.map((item) => ({
        inlineData: {
          data: item.imageBase64,
          mimeType: item.mimeType ?? 'image/png',
        },
      })),
      BATCH_CATEGORIZATION_PROMPT,
    ];

    const result = await model.generateContent(contents);
    const rawText = result.response.text().trim();

    // Strip any accidental markdown code fences
    const jsonText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch {
      console.error('[/api/batch-categorize] JSON parse error. Raw:', rawText);
      return NextResponse.json(
        { error: 'AI returned invalid JSON', rawText },
        { status: 500 }
      );
    }

    if (!data.results || !Array.isArray(data.results)) {
       return NextResponse.json(
        { error: 'AI returned invalid JSON shape (missing results array)', data },
        { status: 500 }
      );
    }

    // Ensure season is an array for each item
    data.results.forEach((cat: any) => {
      if (!Array.isArray(cat.season)) {
        cat.season = cat.season ? [cat.season] : [];
      }
    });

    return NextResponse.json({ results: data.results });
  } catch (error: unknown) {
    console.error('[/api/batch-categorize] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Batch categorization failed' },
      { status: 500 }
    );
  }
}
