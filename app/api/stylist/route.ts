import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGeminiModel } from '@/lib/gemini';
import { OutfitSuggestion, WardrobeItem } from '@/types/wardrobe';

function buildStylistPrompt(occasion: string, wardrobe: WardrobeItem[]): string {
  const itemDescriptions = wardrobe.map((item, i) => {
    const parts = [
      `Item ${i + 1} (id: ${item.id}):`,
      item.type && `Type: ${item.type}`,
      item.color && `Color: ${item.color}`,
      item.pattern && `Pattern: ${item.pattern}`,
      item.formality && `Formality: ${item.formality}`,
      item.season?.length && `Season: ${item.season.join(', ')}`,
    ].filter(Boolean);
    return parts.join(' | ');
  }).join('\n');

  return `You are VESTIRE, a world-class AI personal stylist with expertise in fashion and color theory.

The user's wardrobe items:
${itemDescriptions}

The occasion: "${occasion}"

Create the perfect outfit for this occasion using ONLY items from the wardrobe above. Return ONLY a strict JSON object (no markdown, no code fences) matching this exact shape:

{
  "occasion": "${occasion}",
  "outfit_name": "short creative outfit name (e.g. 'The Power Boardroom')",
  "items": [
    {
      "id": "exact item id from the wardrobe",
      "image_url": "exact image_url from the wardrobe item",
      "type": "item type",
      "color": "item color",
      "reason": "1-sentence explanation of why this piece works"
    }
  ],
  "styling_tips": ["tip1", "tip2", "tip3"],
  "buy_suggestion": {
    "type": "clothing type to buy",
    "color": "recommended color",
    "description": "brief description of the suggested item",
    "reason": "why this would complete the look"
  }
}

Rules:
- Select 2–4 items that work together harmoniously
- Prioritize items with matching formality level for the occasion
- Consider color coordination and contrast
- styling_tips should be actionable and specific
- buy_suggestion should fill a gap in the outfit (e.g. missing shoes, accessory, or layering piece)
- If wardrobe is empty, still return the JSON shape with empty items array and a helpful buy_suggestion`;
}

export async function POST(request: NextRequest) {
  try {
    const { occasion } = await request.json();

    if (!occasion || typeof occasion !== 'string') {
      return NextResponse.json({ error: 'occasion is required' }, { status: 400 });
    }

    // Fetch user's wardrobe from Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: wardrobe, error: dbError } = await supabase
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (dbError) {
      return NextResponse.json({ error: 'Failed to fetch wardrobe' }, { status: 500 });
    }

    const model = getGeminiModel('gemini-3.6-flash');
    const prompt = buildStylistPrompt(occasion, wardrobe ?? []);

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let outfitSuggestion: OutfitSuggestion;
    try {
      outfitSuggestion = JSON.parse(jsonText);
      
      // The LLM was not given the image_urls to save tokens, so we map them back 
      // from the database results based on the ID the LLM selected.
      if (outfitSuggestion.items && Array.isArray(outfitSuggestion.items)) {
        outfitSuggestion.items = outfitSuggestion.items.map(item => {
          const dbItem = wardrobe?.find(w => String(w.id) === String(item.id));
          return {
            ...item,
            image_url: dbItem?.image_url || item.image_url,
          };
        });
      }
    } catch {
      console.error('[/api/stylist] JSON parse error. Raw:', rawText);
      return NextResponse.json(
        { error: 'AI returned invalid JSON', rawText },
        { status: 500 }
      );
    }

    return NextResponse.json(outfitSuggestion);
  } catch (error: unknown) {
    console.error('[/api/stylist] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stylist failed' },
      { status: 500 }
    );
  }
}
