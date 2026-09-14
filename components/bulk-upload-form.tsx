'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AICategorizationResult } from '@/types/wardrobe';
import { cn } from '@/lib/utils';
import {
  UploadCloud,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Scissors,
  Layers,
  FileImage
} from 'lucide-react';

export type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: 'idle' | 'removing_bg' | 'categorizing' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: AICategorizationResult;
};

const BATCH_SIZE = 3;

function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function BulkUploadForm() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
    addFilesToQueue(Array.from(e.dataTransfer.files));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFilesToQueue(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function addFilesToQueue(files: File[]) {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length < files.length) {
      toast.error(`Ignored ${files.length - validFiles.length} non-image files`);
    }

    const newItems: QueueItem[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'idle',
      progress: 0
    }));

    setQueue(prev => [...prev, ...newItems]);
  }

  function removeQueueItem(id: string) {
    if (isProcessing) return;
    setQueue(prev => prev.filter(item => item.id !== id));
  }

  function clearQueue() {
    if (isProcessing) return;
    setQueue([]);
  }

  const updateItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  async function startBulkProcess() {
    if (isProcessing) return;
    const pendingItems = queue.filter(q => q.status === 'idle' || q.status === 'error');
    if (pendingItems.length === 0) {
      toast.info('No pending items to process');
      return;
    }

    setIsProcessing(true);
    const chunks = chunkArray(pendingItems, BATCH_SIZE);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not authenticated');
      setIsProcessing(false);
      return;
    }

    const { removeBackground } = await import('@imgly/background-removal');

    for (const chunk of chunks) {
      // 1. Background Removal (Parallel)
      chunk.forEach(item => updateItem(item.id, { status: 'removing_bg', progress: 10 }));

      const bgResults = await Promise.allSettled(chunk.map(async (item) => {
        try {
          const blob = await removeBackground(item.file, {
            publicPath: 'https://unpkg.com/@imgly/background-removal-data@1.4.3/dist/',
            progress: (key: string, current: number, total: number) => {
              if (total > 0) {
                const pct = Math.round((current / total) * 60) + 10;
                updateItem(item.id, { progress: Math.min(pct, 70) });
              }
            },
          });

          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          return { item, blob, base64 };
        } catch (error) {
          console.error(`Failed to remove background for ${item.id}`, error);
          updateItem(item.id, { status: 'error', error: 'Failed to remove background' });
          throw error;
        }
      }));

      const successfulBgs = bgResults
        .filter((r): r is PromiseFulfilledResult<{item: QueueItem, blob: Blob, base64: string}> => r.status === 'fulfilled')
        .map(r => r.value);

      if (successfulBgs.length === 0) continue;

      // 2. Batch Categorization (Single API Call)
      successfulBgs.forEach(s => updateItem(s.item.id, { status: 'categorizing', progress: 75 }));

      let categories: AICategorizationResult[] = [];
      try {
        const catRes = await fetch('/api/batch-categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: successfulBgs.map(s => ({
              id: s.item.id,
              imageBase64: s.base64,
              mimeType: s.blob.type || 'image/png'
            }))
          })
        });

        const catData = await catRes.json();
        if (!catRes.ok || catData.error || !catData.results) {
          throw new Error(catData.error || 'Failed to categorize batch');
        }
        categories = catData.results;
      } catch (error: unknown) {
        console.error('Batch categorization error', error);
        successfulBgs.forEach(s => updateItem(s.item.id, { status: 'error', error: 'Categorization failed' }));
        continue;
      }

      // 3. Upload to Supabase (Parallel)
      successfulBgs.forEach(s => updateItem(s.item.id, { status: 'uploading', progress: 90 }));

      await Promise.allSettled(successfulBgs.map(async (s, index) => {
        try {
          const category = categories[index];
          if (!category) throw new Error('Missing category data');

          const fileName = `${user.id}/bulk_${Date.now()}_${s.item.id}.png`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('wardrobe-images')
            .upload(fileName, s.blob, { contentType: 'image/png' });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('wardrobe-images')
            .getPublicUrl(uploadData.path);

          const { error: dbError } = await supabase.from('wardrobe_items').insert({
            user_id: user.id,
            image_url: publicUrl,
            type: category.type || null,
            color: category.color || null,
            pattern: category.pattern || null,
            season: category.season?.length ? category.season : null,
            formality: category.formality || null,
          });

          if (dbError) throw dbError;

          updateItem(s.item.id, {
            status: 'done',
            progress: 100,
            previewUrl: URL.createObjectURL(s.blob),
            result: category
          });

        } catch (error: unknown) {
          console.error(`Failed to upload ${s.item.id}`, error);
          updateItem(s.item.id, { status: 'error', error: 'Upload failed' });
        }
      }));
    }

    setIsProcessing(false);

    const remaining = queue.filter(q => q.status !== 'done' && q.status !== 'error');
    if (remaining.length === 0) {
      toast.success('Bulk closet upload complete! 🎉');
    }
  }

  const doneCount = queue.filter(q => q.status === 'done').length;
  const errorCount = queue.filter(q => q.status === 'error').length;
  const pendingCount = queue.length - doneCount - errorCount;

  return (
    <div className="space-y-5">
      {/* Wide Rectangle Dropzone */}
      {!isProcessing && (
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
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4af37]/20 via-[#8a6e3c]/10 to-transparent border border-[#d4af37]/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-xl">
            <Layers className="w-7 h-7 text-[#d4af37]" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground mb-1 font-serif">
            {isDragging ? 'Drop multiple images here!' : 'Batch upload multiple clothing items'}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Upload 5, 20, or 50+ photos at once
          </p>
          <Button
            type="button"
            className="bg-zinc-900 border border-white/10 hover:border-[#d4af37]/40 text-foreground text-xs font-semibold rounded-xl px-6 py-2 h-9 shadow-md"
          >
            Select Multiple Files
          </Button>
        </div>
      )}

      {/* Queue List */}
      {queue.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <FileImage className="w-4 h-4 text-[#d4af37]" />
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Queue List</h4>
              <Badge className="bg-zinc-900 text-zinc-300 border-white/10 text-[10px]">
                {queue.length} items
              </Badge>
            </div>
            {!isProcessing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearQueue}
                className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
              >
                Clear All
              </Button>
            )}
          </div>

          <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-zinc-950/80 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all shadow-md"
              >
                <div className="relative w-12 h-14 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shrink-0 flex items-center justify-center">
                  <Image src={item.previewUrl} alt="preview" fill className="object-contain p-1" />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold truncate text-foreground/90 max-w-[200px] sm:max-w-[320px]">
                      {item.file.name}
                    </p>
                    <span className="text-[11px] font-medium">
                      {item.status === 'idle' && <span className="text-zinc-400">Waiting</span>}
                      {item.status === 'removing_bg' && (
                        <span className="text-[#d4af37] flex items-center gap-1">
                          <Scissors className="w-3 h-3 animate-spin" />
                          Removing Bg
                        </span>
                      )}
                      {item.status === 'categorizing' && (
                        <span className="text-[#d4af37] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 animate-pulse" />
                          AI Tagging
                        </span>
                      )}
                      {item.status === 'uploading' && (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Saving
                        </span>
                      )}
                      {item.status === 'done' && (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Done
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="text-destructive flex items-center gap-1 font-semibold">
                          <AlertCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </span>
                  </div>

                  {(item.status === 'removing_bg' || item.status === 'categorizing' || item.status === 'uploading') && (
                    <Progress value={item.progress} className="h-1.5 bg-zinc-900 border border-white/5 [&>div]:bg-gradient-to-r [&>div]:from-[#8a6e3c] [&>div]:to-[#d4af37]" />
                  )}

                  {item.status === 'done' && item.result && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="text-zinc-300 font-semibold">{item.result.type}</span>
                      <span>•</span>
                      <span>{item.result.color}</span>
                    </div>
                  )}

                  {item.status === 'error' && (
                    <p className="text-[11px] text-destructive truncate">{item.error}</p>
                  )}
                </div>

                {!isProcessing && item.status !== 'done' && (
                  <button
                    onClick={() => removeQueueItem(item.id)}
                    className="p-1.5 text-zinc-500 hover:text-destructive transition-colors shrink-0 rounded-lg hover:bg-white/5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-white/10">
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              <span><strong className="text-foreground">{queue.length}</strong> total</span>
              {doneCount > 0 && <span className="text-emerald-400 font-medium">✓ {doneCount} saved</span>}
              {errorCount > 0 && <span className="text-destructive font-medium">✕ {errorCount} failed</span>}
            </div>

            <Button
              onClick={startBulkProcess}
              disabled={isProcessing || pendingCount === 0}
              className="w-full sm:w-auto h-11 px-8 bg-gradient-to-r from-[#8a6e3c] via-[#d4af37] to-[#8a6e3c] text-zinc-950 font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.35)] transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Batch…</span>
                </>
              ) : pendingCount > 0 ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Start Batch Upload ({pendingCount})</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>All Items Processed</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
