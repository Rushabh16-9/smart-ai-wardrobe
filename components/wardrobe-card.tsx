'use client';

import Image from 'next/image';
import { useState } from 'react';
import { WardrobeItem } from '@/types/wardrobe';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTilt } from '@/hooks/use-tilt';
import { enhanceImage } from '@/lib/enhance-image';

interface WardrobeCardProps {
  item: WardrobeItem;
}

const FORMALITY_COLORS: Record<string, string> = {
  Casual: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Smart Casual': 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  'Business Casual': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Semi-Formal': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Formal: 'bg-primary/10 text-primary border-primary/20',
  'Black Tie': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export function WardrobeCard({ item }: WardrobeCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const supabase = createClient();

  async function handleDelete() {
    if (!confirm('Remove this item from your wardrobe?')) return;
    setDeleting(true);
    const { error } = await supabase.from('wardrobe_items').delete().eq('id', item.id);
    if (error) {
      toast.error('Failed to delete item');
    } else {
      toast.success('Item removed');
      window.location.reload();
    }
    setDeleting(false);
  }

  async function handleEnhance(e: React.MouseEvent) {
    e.stopPropagation();
    if (!item.image_url) return;
    setEnhancing(true);
    try {
      toast.loading('Enhancing photo...', { id: 'enhance' });
      const enhancedBlob = await enhanceImage(item.image_url);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `${user.id}/enhanced_${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('wardrobe-images')
        .upload(fileName, enhancedBlob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('wardrobe-images')
        .getPublicUrl(uploadData.path);

      const { error: dbError } = await supabase
        .from('wardrobe_items')
        .update({ image_url: publicUrl })
        .eq('id', item.id);

      if (dbError) throw dbError;

      toast.success('Photo enhanced! ✨', { id: 'enhance' });
      window.location.reload(); 
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to enhance photo';
      toast.error(msg, { id: 'enhance' });
    } finally {
      setEnhancing(false);
    }
  }

  const tilt = useTilt({ scale: 1.05, maxRotation: 8 });

  return (
    <div
      {...tilt}
      style={{ ...tilt.style, transformStyle: 'preserve-3d' }}
      className="group relative w-full backdrop-blur-md bg-gradient-to-b from-zinc-800/80 to-zinc-900 rounded-2xl overflow-hidden border border-white/5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-white/10"
      onMouseEnter={() => {
        tilt.onMouseEnter();
        setShowActions(true);
      }}
      onMouseLeave={() => {
        tilt.onMouseLeave();
        setShowActions(false);
      }}
    >
      {/* Image */}
      <div className="relative w-full aspect-[3/4] bg-zinc-900/80 border-b border-white/5 overflow-hidden" style={{ transform: 'translateZ(20px)' }}>
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={`${item.color ?? ''} ${item.type ?? 'clothing item'}`}
            fill
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-muted-foreground/20">
            ◈
          </div>
        )}

        {/* Hover overlay with actions */}
        <div
          className={cn(
            'absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center gap-3 transition-all duration-300',
            showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {item.image_url && (
             <button
               id={`enhance-item-${item.id}`}
               onClick={handleEnhance}
               disabled={enhancing || deleting}
               className="px-4 py-2 text-xs font-medium rounded-lg bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 hover:bg-[#d4af37]/30 transition-colors"
             >
               {enhancing ? '✨ Enhancing…' : '✨ Enhance'}
             </button>
          )}
          <button
            id={`delete-item-${item.id}`}
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors"
          >
            {deleting ? 'Removing…' : '✕ Remove'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-2 relative" style={{ transform: 'translateZ(30px)' }}>
        <div className="flex items-start justify-between gap-1">
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              {item.type ?? 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[item.color, item.pattern].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {item.formality && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-medium px-2 py-0.5 border',
              FORMALITY_COLORS[item.formality] ?? 'bg-secondary text-secondary-foreground border-border'
            )}
          >
            {item.formality}
          </Badge>
        )}

        {item.season && item.season.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.season.slice(0, 2).map((s) => (
              <span key={s} className="text-[9px] text-muted-foreground/50 bg-secondary/50 rounded px-1.5 py-0.5">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
