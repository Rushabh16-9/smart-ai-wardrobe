'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { AICategorizationResult } from '@/types/wardrobe';
import { cn } from '@/lib/utils';

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
    // reset input so same file can be selected again if needed
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

    // Dynamic import to avoid SSR issues
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
          
          // Convert blob to base64 for the API
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

          // Update preview URL to the new transparent blob for the UI
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
    
    // Check if everything is done
    const remaining = queue.filter(q => q.status !== 'done' && q.status !== 'error');
    if (remaining.length === 0) {
      toast.success('Bulk upload complete! 🎉');
    }
  }

  const doneCount = queue.filter(q => q.status === 'done').length;
  const errorCount = queue.filter(q => q.status === 'error').length;
  const pendingCount = queue.length - doneCount - errorCount;

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl shadow-black/50">
      
      {/* Dropzone */}
      {!isProcessing && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 rounded-xl p-8 text-center cursor-pointer transition-all duration-300 mb-6',
            isDragging
              ? 'border-solid border-[#d4af37] bg-zinc-800/50 shadow-[0_0_20px_rgba(212,175,55,0.15)]'
              : 'border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/30'
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
          <div className="text-4xl mb-3 text-muted-foreground/30">{isDragging ? '✦' : '📸'}</div>
          <p className="text-foreground font-medium mb-1">
            {isDragging ? 'Drop images here!' : 'Drag & drop multiple images'}
          </p>
          <p className="text-sm text-muted-foreground/60">Upload 10, 50, or 100+ items at once</p>
        </div>
      )}

      {/* Queue List */}
      {queue.length > 0 && (
        <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {queue.map(item => (
            <div key={item.id} className="flex items-center gap-4 bg-zinc-950/50 p-3 rounded-xl border border-white/5">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                <Image src={item.previewUrl} alt="preview" fill className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium truncate text-foreground/90">
                    {item.file.name}
                  </p>
                  <span className="text-xs font-mono text-muted-foreground">
                    {item.status === 'idle' && 'Waiting'}
                    {item.status === 'removing_bg' && 'Removing BG...'}
                    {item.status === 'categorizing' && 'Categorizing...'}
                    {item.status === 'uploading' && 'Saving...'}
                    {item.status === 'done' && <span className="text-emerald-400">Done</span>}
                    {item.status === 'error' && <span className="text-destructive">Error</span>}
                  </span>
                </div>
                
                {(item.status === 'removing_bg' || item.status === 'categorizing' || item.status === 'uploading') && (
                  <Progress value={item.progress} className="h-1.5 mt-2 bg-secondary [&>div]:bg-[#d4af37]" />
                )}
                
                {item.status === 'done' && item.result && (
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {item.result.type} · {item.result.color}
                  </p>
                )}
                {item.status === 'error' && (
                  <p className="text-xs text-destructive truncate mt-1">{item.error}</p>
                )}
              </div>
              
              {!isProcessing && item.status !== 'done' && (
                <button 
                  onClick={() => removeQueueItem(item.id)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions & Summary */}
      {queue.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="text-sm">
            <span className="text-foreground font-medium">{queue.length}</span> total items
            {doneCount > 0 && <span className="text-emerald-400 ml-3">{doneCount} done</span>}
            {errorCount > 0 && <span className="text-destructive ml-3">{errorCount} failed</span>}
          </div>
          
          <Button
            onClick={startBulkProcess}
            disabled={isProcessing || pendingCount === 0}
            className="bg-[#d4af37] text-black hover:bg-[#b08f26] shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Processing Batch…
              </span>
            ) : pendingCount > 0 ? (
              `Start Upload (${pendingCount})`
            ) : (
              'All Done'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
