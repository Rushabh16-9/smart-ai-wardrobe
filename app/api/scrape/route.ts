import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 });
    }

    // Fetch the product page
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status} ${response.statusText}` },
        { status: 502 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract image URL — try multiple sources in priority order
    let imageUrl: string | null = null;

    // 1. og:image (most reliable for e-commerce)
    imageUrl = $('meta[property="og:image"]').attr('content') ?? null;

    // 2. twitter:image
    if (!imageUrl) {
      imageUrl = $('meta[name="twitter:image"]').attr('content') ?? null;
    }

    // 3. product JSON-LD schema
    if (!imageUrl) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() ?? '');
          const img = json.image ?? json['@graph']?.[0]?.image;
          if (img) {
            imageUrl = Array.isArray(img) ? img[0] : img;
          }
        } catch {
          // ignore parse errors
        }
      });
    }

    // 4. Fallback: first large image in the page
    if (!imageUrl) {
      $('img').each((_, el) => {
        const src = $(el).attr('src') ?? $(el).attr('data-src') ?? $(el).attr('data-lazy-src');
        if (src && !imageUrl) {
          // Prefer large images
          const w = parseInt($(el).attr('width') ?? '0');
          const h = parseInt($(el).attr('height') ?? '0');
          if (w > 300 || h > 300) {
            imageUrl = src;
          }
        }
      });
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'No product image found on this page' }, { status: 404 });
    }

    // Resolve relative URLs
    if (imageUrl.startsWith('//')) {
      imageUrl = `${parsedUrl.protocol}${imageUrl}`;
    } else if (imageUrl.startsWith('/')) {
      imageUrl = `${parsedUrl.origin}${imageUrl}`;
    }

    // Also extract title for context
    const title = $('meta[property="og:title"]').attr('content')
      ?? $('title').text().trim()
      ?? null;

    return NextResponse.json({ imageUrl, title });
  } catch (error: unknown) {
    console.error('[/api/scrape] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scraping failed' },
      { status: 500 }
    );
  }
}
