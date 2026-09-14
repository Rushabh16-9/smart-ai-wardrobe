'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AICategorizationResult } from '@/types/wardrobe';
import { cn } from '@/lib/utils';
import { BulkUploadForm } from './bulk-upload-form';
import {
  Upload,
  Link as LinkIcon,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Tag,
  Palette,
  Sun,
  Briefcase,
  RotateCcw,
  ShieldCheck,
  Scissors,
  ArrowRight,
  Globe,
  Loader2,
  Layers
} from 'lucide-react';

type MainTab = 'photo' | 'link' | 'bulk';
type Step = 'input' | 'processing' | 'review' | 'done';

const STORE_SUGGESTIONS = ['Zara', 'H&M', 'ASOS', 'Uniqlo', 'Nordstrom', 'Nike', 'Adidas'];
const AVAILABLE_SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];

export function AddItemForm() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<MainTab>('photo');
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
      toast.error('Please drop an image file (PNG, JPG, WEBP)');
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
      const imgRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(data.imageUrl)}`);
      if (!imgRes.ok) {
        toast.error('Failed to download image from product URL');
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
    setProgressLabel('Loading image into Vestire Studio…');

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      setProgress(25);
      setProgressLabel('AI removing background layer...');

      const { removeBackground } = await import('@imgly/background-removal');

      const resultBlob = await removeBackground(file, {
        publicPath: 'https://unpkg.com/@imgly/background-removal-data@1.4.3/dist/',
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.round((current / total) * 55) + 20;
            setProgress(Math.min(pct, 78));
          }
        },
      });

      setProgress(80);
      setProgressLabel('Gemini AI analyzing fabric, color & style...');
      setProcessedBlob(resultBlob);

      const processedUrl = URL.createObjectURL(resultBlob);
      setPreviewUrl(processedUrl);

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
        toast.error('AI categorization complete — feel free to tweak tags manually');
        setCategorization({ type: '', color: '', pattern: '', season: [], formality: '' });
      } else {
        setCategorization(catData);
      }

      setProgress(100);
      setProgressLabel('Complete!');
      setStep('review');
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : String(err);
      toast.error(`Processing failed: ${errorMsg}`);
      setErrorStack(stack || String(err));
      setStep('input');
      setPreviewUrl(null);
    }
  }

  // ── Save to Supabase ───────────────────────────────────
  async function handleSave() {
    if (!processedBlob || !categorization) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `${user.id}/${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('wardrobe-images')
        .upload(fileName, processedBlob, { contentType: 'image/png', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('wardrobe-images')
        .getPublicUrl(uploadData.path);

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

      toast.success('Item saved to your AI Wardrobe! ✨');
      setStep('done');
      setTimeout(() => router.push('/wardrobe'), 1000);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  function toggleSeason(seasonName: string) {
    if (!categorization) return;
    const current = categorization.season ?? [];
    const updated = current.includes(seasonName)
      ? current.filter((s) => s !== seasonName)
      : [...current, seasonName];
    setCategorization({ ...categorization, season: updated });
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
  // RENDER: Processing State
  // ─────────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="glass-card rounded-3xl p-8 sm:p-12 border border-white/10 shadow-2xl backdrop-blur-2xl text-center space-y-8 max-w-2xl w-full mx-auto relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent animate-pulse" />

        {/* Animated Scanner Visual */}
        <div className="relative w-44 h-56 mx-auto rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl flex items-center justify-center">
          {previewUrl ? (
            <>
              <Image src={previewUrl} alt="Processing item" fill className="object-contain p-3 opacity-80" />
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent shadow-[0_0_15px_#d4af37] animate-[bounce_2s_infinite]" />
            </>
          ) : (
            <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
          )}
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-foreground font-serif">AI Magic in Progress</h2>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[#d4af37] animate-spin" />
            <span>{progressLabel}</span>
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-2">
          <Progress value={progress} className="h-2 bg-zinc-950 border border-white/10 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-[#8a6e3c] [&>div]:to-[#d4af37]" />
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>Stage {progress < 40 ? '1/3' : progress < 80 ? '2/3' : '3/3'}</span>
            <span className="text-[#d4af37] font-semibold">{progress}%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2 text-xs font-medium">
          <div className={cn("p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all", progress >= 25 ? "bg-primary/10 border-primary/30 text-[#d4af37]" : "bg-zinc-950/40 border-white/5 text-zinc-500")}>
            <Scissors className="w-3.5 h-3.5" />
            <span>Bg Removal</span>
          </div>
          <div className={cn("p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all", progress >= 75 ? "bg-primary/10 border-primary/30 text-[#d4af37]" : "bg-zinc-950/40 border-white/5 text-zinc-500")}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini AI</span>
          </div>
          <div className={cn("p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all", progress >= 100 ? "bg-primary/10 border-primary/30 text-[#d4af37]" : "bg-zinc-950/40 border-white/5 text-zinc-500")}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ready</span>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: Review State
  // ─────────────────────────────────────────────────────────
  if (step === 'review' || step === 'done') {
    return (
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl backdrop-blur-2xl space-y-6 max-w-2xl w-full mx-auto fade-in">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground font-serif">AI Categorization Result</h2>
              <p className="text-xs text-muted-foreground">Review or edit the auto-detected item details</p>
            </div>
          </div>
          <Badge className="bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/30 px-3 py-1 text-[10px] uppercase font-semibold">
            ✦ Background Removed
          </Badge>
        </div>

        {/* Center Top Image Display */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-48 h-60 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:14px_14px] bg-zinc-950 flex items-center justify-center">
            {previewUrl && (
              <Image src={previewUrl} alt="Processed item" fill className="object-contain p-4" />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-white flex items-center gap-1.5 h-8"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Upload Different Image</span>
          </Button>
        </div>

        {/* Category Inputs Grid */}
        {categorization && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Category / Type</span>
                </Label>
                <Input
                  value={categorization.type || ''}
                  onChange={(e) => setCategorization({ ...categorization, type: e.target.value })}
                  placeholder="e.g. Jacket, Sneakers, Shirt"
                  className="bg-zinc-950/80 border-white/10 focus:border-[#d4af37] text-foreground h-10 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Primary Color</span>
                </Label>
                <Input
                  value={categorization.color || ''}
                  onChange={(e) => setCategorization({ ...categorization, color: e.target.value })}
                  placeholder="e.g. Black, Beige, Navy"
                  className="bg-zinc-950/80 border-white/10 focus:border-[#d4af37] text-foreground h-10 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Pattern / Fabric</span>
                </Label>
                <Input
                  value={categorization.pattern || ''}
                  onChange={(e) => setCategorization({ ...categorization, pattern: e.target.value })}
                  placeholder="e.g. Solid, Striped, Leather"
                  className="bg-zinc-950/80 border-white/10 focus:border-[#d4af37] text-foreground h-10 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Formality</span>
                </Label>
                <Input
                  value={categorization.formality || ''}
                  onChange={(e) => setCategorization({ ...categorization, formality: e.target.value })}
                  placeholder="e.g. Casual, Formal, Business"
                  className="bg-zinc-950/80 border-white/10 focus:border-[#d4af37] text-foreground h-10 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Season Chips */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Seasons</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_SEASONS.map((season) => {
                  const isSelected = (categorization.season ?? []).includes(season);
                  return (
                    <button
                      key={season}
                      type="button"
                      onClick={() => toggleSeason(season)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer",
                        isSelected
                          ? "bg-gradient-to-r from-[#d4af37] to-[#b08f26] text-zinc-950 border-[#d4af37] font-bold"
                          : "bg-zinc-950/60 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                      )}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{season}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <Button
          id="save-wardrobe-item"
          onClick={handleSave}
          disabled={saving || step === 'done'}
          className="w-full h-12 bg-gradient-to-r from-[#8a6e3c] via-[#d4af37] to-[#8a6e3c] text-zinc-950 font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 mt-4"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving to Wardrobe…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Save to Digital Wardrobe</span>
            </>
          )}
        </Button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: Input State (Single Central Container)
  // ─────────────────────────────────────────────────────────
  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl backdrop-blur-2xl max-w-2xl w-full mx-auto space-y-6">
      
      {/* 1. HORIZONTAL TABS AT TOP OF CENTRAL CONTAINER */}
      <div className="grid grid-cols-3 gap-2 bg-zinc-950/80 p-1.5 rounded-2xl border border-white/10 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('photo')}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer",
            activeTab === 'photo'
              ? "bg-gradient-to-r from-[#d4af37] to-[#b08f26] text-zinc-950 font-bold shadow-lg shadow-amber-500/10"
              : "text-zinc-400 hover:text-white"
          )}
        >
          <Upload className="w-4 h-4" />
          <span>Photo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('link')}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer",
            activeTab === 'link'
              ? "bg-gradient-to-r from-[#d4af37] to-[#b08f26] text-zinc-950 font-bold shadow-lg shadow-amber-500/10"
              : "text-zinc-400 hover:text-white"
          )}
        >
          <LinkIcon className="w-4 h-4" />
          <span>Link</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bulk')}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer",
            activeTab === 'bulk'
              ? "bg-gradient-to-r from-[#d4af37] to-[#b08f26] text-zinc-950 font-bold shadow-lg shadow-amber-500/10"
              : "text-zinc-400 hover:text-white"
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Bulk</span>
        </button>
      </div>

      {/* 2. TAB CONTENT */}

      {/* TAB A: PHOTO UPLOAD */}
      {activeTab === 'photo' && (
        <div className="space-y-6">
          {/* WIDE RECTANGLE DROPZONE */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl w-full py-12 px-6 text-center cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col items-center justify-center',
              isDragging
                ? 'border-[#d4af37] bg-zinc-900/90 shadow-[0_0_30px_rgba(212,175,55,0.2)]'
                : 'border-zinc-800 hover:border-[#d4af37]/60 bg-zinc-950/40 hover:bg-zinc-900/60'
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

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4af37]/20 via-[#8a6e3c]/10 to-transparent border border-[#d4af37]/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-xl">
              <Upload className="w-7 h-7 text-[#d4af37]" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1 font-serif">
              {isDragging ? 'Drop your clothing photo here!' : 'Drag & drop your image or click to browse'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Supports PNG, JPG, or WEBP formats
            </p>

            <Button
              type="button"
              className="bg-zinc-900 border border-white/10 hover:border-[#d4af37]/40 text-foreground text-xs font-semibold rounded-xl px-6 py-2 h-9 shadow-md"
            >
              Browse Files
            </Button>
          </div>

          {/* HORIZONTAL BADGES UNDERNEATH DROPZONE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[#d4af37] shrink-0">
                <Scissors className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">Auto Background Removal</p>
                <p className="text-[10px] text-muted-foreground">In-browser smart isolation</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[#d4af37] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">Gemini AI Tagging</p>
                <p className="text-[10px] text-muted-foreground">Color, pattern, & style</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[#d4af37] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">100% Private</p>
                <p className="text-[10px] text-muted-foreground">Processed safely</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: PRODUCT LINK */}
      {activeTab === 'link' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950/60 border border-white/5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-url" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Product URL</span>
              </Label>
              <Input
                id="product-url"
                type="url"
                placeholder="https://www.zara.com/us/en/oversized-blazer-p0201..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="bg-zinc-900 border-white/10 focus:border-[#d4af37] text-foreground placeholder:text-muted-foreground/40 h-12 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-semibold">Works with major stores:</p>
              <div className="flex flex-wrap gap-1.5">
                {STORE_SUGGESTIONS.map((store) => (
                  <Badge key={store} variant="outline" className="bg-zinc-900/60 border-white/10 text-zinc-400 text-[10px] px-2.5 py-1">
                    {store}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              id="scrape-url-btn"
              onClick={handleScrapeUrl}
              disabled={!sourceUrl.trim() || scrapeLoading}
              className="w-full h-11 bg-gradient-to-r from-[#8a6e3c] via-[#d4af37] to-[#8a6e3c] text-zinc-950 font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.35)] transition-all flex items-center justify-center gap-2"
            >
              {scrapeLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching Image…</span>
                </>
              ) : (
                <>
                  <span>Fetch & Process Image</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>

          {/* HORIZONTAL BADGES UNDERNEATH LINK TAB */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[#d4af37] shrink-0">
                <Scissors className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">Auto Background Removal</p>
                <p className="text-[10px] text-muted-foreground">In-browser smart isolation</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[#d4af37] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">Gemini AI Tagging</p>
                <p className="text-[10px] text-muted-foreground">Color, pattern, & style</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[#d4af37] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">100% Private</p>
                <p className="text-[10px] text-muted-foreground">Processed safely</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB C: BULK UPLOAD */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <BulkUploadForm />

          {/* HORIZONTAL BADGES UNDERNEATH BULK TAB */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[#d4af37] shrink-0">
                <Scissors className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">Auto Background Removal</p>
                <p className="text-[10px] text-muted-foreground">In-browser smart isolation</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[#d4af37] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">Gemini AI Tagging</p>
                <p className="text-[10px] text-muted-foreground">Color, pattern, & style</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[#d4af37] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">100% Private</p>
                <p className="text-[10px] text-muted-foreground">Processed safely</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Debug Overlay */}
      {errorStack && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl overflow-auto max-h-48">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-destructive font-semibold text-xs">Error Debug Log</h4>
            <Button variant="ghost" size="sm" onClick={() => setErrorStack(null)} className="h-6 text-[10px]">Clear</Button>
          </div>
          <pre className="text-[11px] text-destructive/80 font-mono whitespace-pre-wrap break-all">
            {errorStack}
          </pre>
        </div>
      )}
    </div>
  );
}
