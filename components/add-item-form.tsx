'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AICategorizationResult } from '@/types/wardrobe';
import { cn } from '@/lib/utils';

type Step = 'input' | 'processing' | 'review' | 'done';

export function AddItemForm() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('input');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [errorStack, setErrorStack] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [categorization, setCategorization] = useState<AICategorizationResult | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Drag & Drop ──────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    } else {
      toast.error('Please drop an image file');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  // ── URL Scraping ─────────────────────────────────────────
  async function handleScrapeUrl() {
    if (!sourceUrl.trim()) return;
    setScrapeLoading(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        toast.error(data.error ?? 'Could not extract image from URL');
        return;
      }
      // Fetch the image as blob via our proxy
      const imgRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(data.imageUrl)}`);
      if (!imgRes.ok) {
        toast.error('Failed to download image from URL');
        return;
      }
      const blob = await imgRes.blob();
      const file = new File([blob], 'scraped-image.jpg', { type: blob.type });
      processFile(file);
    } catch {
      toast.error('Network error while scraping URL');
    } finally {
      setScrapeLoading(false);
    }
  }

  // ── Core Processing Pipeline ─────────────────────────────
  async function processFile(file: File) {
    setStep('processing');
    setProgress(10);
    setProgressLabel('Loading image…');

    // Show original preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      // Step 1: Remove background
      setProgress(20);
      setProgressLabel('Removing background (this may take a moment on first run)…');

      const { removeBackground } = await import('@imgly/background-removal');
        
      const resultBlob = await removeBackground(file, {
        publicPath: 'https://unpkg.com/@imgly/background-removal-data@1.4.3/dist/',
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.round((current / total) * 60) + 20;
            setProgress(Math.min(pct, 79));
          }
        },
      });

      setProgress(80);
      setProgressLabel('Background removed! Running AI categorization…');
      setProcessedBlob(resultBlob);

      // Update preview with transparent background
      const processedUrl = URL.createObjectURL(resultBlob);
      setPreviewUrl(processedUrl);

      // Step 2: Categorize with Gemini
      // Convert blob to base64 (Browser compatible)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(resultBlob);
      });
      const mimeType = resultBlob.type || 'image/png';

      const catRes = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const catData = await catRes.json();

      if (!catRes.ok || catData.error) {
        toast.error('AI categorization failed — you can fill details manually');
        setCategorization({ type: '', color: '', pattern: '', season: [], formality: '' });
      } else {
        setCategorization(catData);
      }

      setProgress(100);
      setProgressLabel('Done!');
      setStep('review');
    } catch (err: any) {
      console.error(err);
      toast.error(`Processing failed: ${err.message || String(err)}`);
      setErrorStack(err.stack || String(err));
      setStep('input');
      setPreviewUrl(null);
    }
  }

  // ── Upload to Supabase ───────────────────────────────────
  async function handleSave() {
    if (!processedBlob || !categorization) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload image
      const fileName = `${user.id}/${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('wardrobe-images')
        .upload(fileName, processedBlob, { contentType: 'image/png', upsert: false });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('wardrobe-images')
        .getPublicUrl(uploadData.path);

      // Insert into DB
      const { error: dbError } = await supabase.from('wardrobe_items').insert({
        user_id: user.id,
        image_url: publicUrl,
        type: categorization.type || null,
        color: categorization.color || null,
        pattern: categorization.pattern || null,
        season: categorization.season?.length ? categorization.season : null,
        formality: categorization.formality || null,
        source_url: sourceUrl || null,
      });

      if (dbError) throw dbError;

      toast.success('Item added to your wardrobe! 🎉');
      setStep('done');
      setTimeout(() => router.push('/wardrobe'), 1200);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setStep('input');
    setPreviewUrl(null);
    setProcessedBlob(null);
    setCategorization(null);
    setProgress(0);
    setProgressLabel('');
    setSourceUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  if (step === 'processing') {
    return (
      <div className="glass-card rounded-2xl p-8 border border-border">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
            <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-zinc-300 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Processing your item</h2>
          <p className="text-sm text-muted-foreground">{progressLabel}</p>
        </div>

        {previewUrl && (
          <div className="relative w-48 h-64 mx-auto mb-8 rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-800">
            <Image src={previewUrl} alt="Processing preview" fill className="object-contain p-2 opacity-50" />
            <div className="absolute inset-0 animate-pulse bg-zinc-800/20" />
          </div>
        )}

        <Progress value={progress} className="h-1.5 bg-secondary [&>div]:bg-primary" />
        <p className="text-center text-xs text-muted-foreground mt-3">{progress}%</p>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="glass-card rounded-2xl p-6 border border-border fade-in">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-primary text-xl">✦</span>
          <h2 className="text-xl font-semibold text-foreground">AI Categorization Result</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          {/* Preview */}
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-secondary/40 to-secondary/20 border border-border">
            {previewUrl && (
              <Image src={previewUrl} alt="Processed item" fill className="object-contain p-4" />
            )}
            <div className="absolute top-2 right-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                BG Removed
              </Badge>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            {categorization && (
              <>
                <Field label="Type" value={categorization.type} onChange={(v) => setCategorization(c => c ? {...c, type: v} : c)} />
                <Field label="Color" value={categorization.color} onChange={(v) => setCategorization(c => c ? {...c, color: v} : c)} />
                <Field label="Pattern" value={categorization.pattern} onChange={(v) => setCategorization(c => c ? {...c, pattern: v} : c)} />
                <Field label="Formality" value={categorization.formality} onChange={(v) => setCategorization(c => c ? {...c, formality: v} : c)} />
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Season</Label>
                  <div className="flex flex-wrap gap-2">
                    {(categorization.season ?? []).map((s) => (
                      <Badge key={s} variant="outline" className="text-xs border-primary/20 bg-primary/5 text-primary">
                        {s}
                      </Badge>
                    ))}
                    {(!categorization.season || categorization.season.length === 0) && (
                      <span className="text-xs text-muted-foreground/50">None detected</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            id="save-wardrobe-item"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(201,169,110,0.2)] transition-all"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              '✓ Save to Wardrobe'
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} className="border-border hover:border-destructive/30 hover:text-destructive">
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  // INPUT step
  return (
    <div className="glass-card rounded-2xl p-6 border border-border">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid grid-cols-2 mb-6 bg-secondary/50">
          <TabsTrigger id="tab-upload" value="upload" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            📁 Upload Image
          </TabsTrigger>
          <TabsTrigger id="tab-url" value="url" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            🔗 Product URL
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 rounded-xl p-12 text-center cursor-pointer transition-all duration-300',
              isDragging
                ? 'border-solid border-zinc-400 bg-zinc-900/50 shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                : 'border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/30'
            )}
          >
            <input
              ref={fileInputRef}
              id="file-upload-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="text-5xl mb-4 text-muted-foreground/30">{isDragging ? '✦' : '↑'}</div>
            <p className="text-foreground font-medium mb-1">
              {isDragging ? 'Drop it here!' : 'Drag & drop your image'}
            </p>
            <p className="text-sm text-muted-foreground/60">or click to browse · PNG, JPG, WEBP</p>
          </div>

          {/* Error Debug Overlay */}
        {errorStack && (
          <div className="mt-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl overflow-auto max-h-64">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-destructive font-semibold text-sm">Debug Stack Trace</h3>
              <Button variant="ghost" size="sm" onClick={() => setErrorStack(null)} className="h-6 text-xs">Clear</Button>
            </div>
            <pre className="text-xs text-destructive/80 whitespace-pre-wrap font-mono break-all">
              {errorStack}
            </pre>
          </div>
        )}

        <p className="text-xs text-muted-foreground/50 text-center mt-4">
            ✦ Background will be removed automatically in your browser · No data sent to third parties
          </p>
        </TabsContent>

        {/* URL Tab */}
        <TabsContent value="url">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-url" className="text-sm font-medium text-foreground/80">
                Product URL
              </Label>
              <Input
                id="product-url"
                type="url"
                placeholder="https://www.zara.com/product/..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground/40 h-11"
              />
              <p className="text-xs text-muted-foreground/50">
                Works with Zara, H&M, ASOS, Uniqlo, and most major e-commerce sites
              </p>
            </div>

            <Button
              id="scrape-url-btn"
              onClick={handleScrapeUrl}
              disabled={!sourceUrl.trim() || scrapeLoading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              {scrapeLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Fetching product image…
                </span>
              ) : (
                '→ Fetch & Process Image'
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Small reusable editable field
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-input border-border text-foreground h-9 text-sm"
      />
    </div>
  );
}
