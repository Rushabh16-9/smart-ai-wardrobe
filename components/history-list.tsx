'use client';

import { WearHistory } from '@/types/wardrobe';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export function HistoryList({ history }: { history: WearHistory[] }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 text-3xl">
          ◷
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-3">No history yet</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Visit the AI Stylist, get an outfit recommendation, and save it to build your style history.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 stagger-children">
      {history.map((entry) => (
        <Dialog key={entry.id}>
          <DialogTrigger asChild>
            <div style={{ width: '100%' }} className="block backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-5 card-hover cursor-pointer text-left transition-all hover:bg-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-foreground capitalize">{entry.occasion ?? 'Outfit'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(entry.worn_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <span className="text-xs text-primary/70 border border-primary/20 rounded-full px-3 py-1 bg-primary/5">
                  {entry.outfit_items?.length ?? 0} items
                </span>
              </div>
              {entry.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">&ldquo;{entry.notes}&rdquo;</p>
              )}
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-background border-border overflow-y-auto max-h-[85vh]">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-primary text-sm">✦</span>
                <p className="text-xs uppercase tracking-widest text-primary/70 font-medium">Style History</p>
              </div>
              <DialogTitle className="text-2xl font-bold text-foreground">
                {entry.ai_suggestion?.outfit_name ?? entry.occasion ?? 'Outfit Details'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground capitalize mt-1">
                For: {entry.occasion ?? 'Various'} • {new Date(entry.worn_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </p>
            </DialogHeader>

            {entry.ai_suggestion?.items && entry.ai_suggestion.items.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-4">Worn Items</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  {entry.ai_suggestion.items.map((item, i) => (
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
               <div className="mt-4 py-8 text-center text-muted-foreground">
                  <p>No detailed item imagery saved for this entry.</p>
               </div>
            )}

            {entry.ai_suggestion?.styling_tips && entry.ai_suggestion.styling_tips.length > 0 && (
              <>
                <Separator className="bg-border mb-4" />
                <div className="mb-6">
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-3">Styling Tips</h3>
                  <ul className="space-y-2">
                    {entry.ai_suggestion.styling_tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-primary mt-0.5 shrink-0">·</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {entry.ai_suggestion?.buy_suggestion && (
              <>
                <Separator className="bg-border mb-4" />
                <div className="mb-4">
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-3">
                    ✦ Complete the Look
                  </h3>
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">
                        Shop this
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">
                        {entry.ai_suggestion.buy_suggestion.type} — {entry.ai_suggestion.buy_suggestion.color}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.ai_suggestion.buy_suggestion.description}</p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
