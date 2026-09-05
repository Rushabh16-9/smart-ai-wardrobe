'use client';

import Image from 'next/image';
import { useState } from 'react';
import { OutfitSuggestion } from '@/types/wardrobe';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface OutfitCardProps {
  outfit: OutfitSuggestion;
  occasion: string;
}

export function OutfitCard({ outfit, occasion }: OutfitCardProps) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSaveOutfit() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const itemIds = outfit.items.map((i) => i.id).filter(Boolean);

      const { error } = await supabase.from('wear_history').insert({
        user_id: user.id,
        outfit_items: itemIds,
        occasion,
        ai_suggestion: outfit as unknown as Record<string, unknown>,
        notes: outfit.styling_tips?.[0] ?? null,
      });

      if (error) throw error;
      toast.success('Outfit saved to history!');
      setSaved(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save outfit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl border border-border overflow-hidden fade-in">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-primary text-sm">✦</span>
          <p className="text-xs uppercase tracking-widest text-primary/70 font-medium">AI Recommendation</p>
        </div>
        <h2 className="text-2xl font-bold text-foreground">{outfit.outfit_name}</h2>
        <p className="text-sm text-muted-foreground mt-1 capitalize">For: {occasion}</p>
      </div>

      {/* Outfit items grid */}
      <div className="p-6">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-4">Selected Items</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {outfit.items.map((item, i) => (
            <div key={item.id || i} className="glass-card rounded-xl overflow-hidden border border-border">
              <div className="relative aspect-[3/4] bg-secondary/30">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.type ?? 'clothing item'}
                    fill
                    className="object-contain p-2"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground/20">◈</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-foreground">{item.type}</p>
                <p className="text-xs text-muted-foreground">{item.color}</p>
                {item.reason && (
                  <p className="text-[10px] text-muted-foreground/50 mt-1 italic line-clamp-2">{item.reason}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Styling tips */}
        {outfit.styling_tips && outfit.styling_tips.length > 0 && (
          <>
            <Separator className="bg-border mb-4" />
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-3">Styling Tips</h3>
              <ul className="space-y-2">
                {outfit.styling_tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5 shrink-0">·</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Buy suggestion */}
        {outfit.buy_suggestion && (
          <>
            <Separator className="bg-border mb-4" />
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-3">
                ✦ Complete the Look
              </h3>
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">
                    Shop this
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">
                    {outfit.buy_suggestion.type} — {outfit.buy_suggestion.color}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{outfit.buy_suggestion.description}</p>
                <p className="text-xs text-primary/60 mt-2 italic">{outfit.buy_suggestion.reason}</p>
              </div>
            </div>
          </>
        )}

        {/* Save button */}
        <Button
          id="save-outfit-btn"
          onClick={handleSaveOutfit}
          disabled={saving || saved}
          variant={saved ? 'outline' : 'default'}
          className={
            saved
              ? 'w-full border-primary/20 text-primary bg-primary/5'
              : 'w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(201,169,110,0.2)] transition-all'
          }
        >
          {saved ? '✓ Saved to History' : saving ? 'Saving…' : '◷ Save to Wear History'}
        </Button>
      </div>
    </div>
  );
}
