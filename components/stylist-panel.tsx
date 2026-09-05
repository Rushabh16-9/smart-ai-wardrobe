'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OutfitCard } from './outfit-card';
import { OutfitSuggestion } from '@/types/wardrobe';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

const OCCASION_PRESETS = [
  'Job Interview',
  'First Date',
  'Beach Day',
  'Wedding Guest',
  'Casual Friday',
  'Gym Session',
  'Business Meeting',
  'Night Out',
];

export function StylistPanel() {
  const [occasion, setOccasion] = useState('');
  const [weather, setWeather] = useState('');
  const [loading, setLoading] = useState(false);
  const [outfit, setOutfit] = useState<OutfitSuggestion | null>(null);

  async function handleGetOutfit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!occasion.trim()) {
      toast.error('Please enter an occasion');
      return;
    }
    setLoading(true);
    setOutfit(null);
    try {
      const res = await fetch('/api/stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, weather }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? 'Stylist failed to generate an outfit');
        return;
      }
      setOutfit(data);
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column: Input */}
      <div>
        <div className="glass-card rounded-2xl p-6 border border-border">
          <form onSubmit={handleGetOutfit} className="space-y-4">
            <div className="space-y-2">
            <Label htmlFor="occasion-input" className="text-sm font-medium text-foreground/80">
              What&apos;s the occasion?
            </Label>
            <Input
              id="occasion-input"
              placeholder="e.g. Job interview, wedding, beach day…"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all text-foreground placeholder:text-muted-foreground/40 h-11"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="weather-input" className="text-sm font-medium text-foreground/80">
              Weather & Location (Optional)
            </Label>
            <Input
              id="weather-input"
              placeholder="e.g. Sunny and 75°F, Raining in London…"
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all text-foreground placeholder:text-muted-foreground/40 h-11"
            />
          </div>

          {/* Presets */}
          <div>
            <p className="text-xs text-muted-foreground/50 uppercase tracking-wider mb-2">Quick picks</p>
            <div className="flex flex-wrap gap-2">
              {OCCASION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  id={`preset-${preset.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setOccasion(preset)}
                  className="px-3 py-1.5 text-xs rounded-full border border-border text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <Button
            id="get-outfit-btn"
            type="submit"
            disabled={loading || !occasion.trim()}
            className="w-full bg-gradient-to-r from-[#8a6e3c] via-[#cba358] to-[#8a6e3c] text-zinc-950 font-medium border-none shadow-[0_0_10px_rgba(212,175,55,0.1)] hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all duration-300 h-11 glowing-particle-btn"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Styling your outfit…
              </span>
            ) : (
              '✦ Generate Outfit'
            )}
          </Button>
          </form>
        </div>
      </div>

      {/* Right Column: Output & Loading State */}
      <div>
        {/* Loading skeleton */}
        {loading && (
          <div className="glass-card rounded-2xl p-6 border border-border space-y-4 fade-in">
            <div className="h-4 bg-secondary rounded shimmer w-1/3" />
            <div className="h-3 bg-secondary rounded shimmer w-2/3" />
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="aspect-[3/4] bg-secondary rounded-xl shimmer" />
              ))}
            </div>
            <div className="h-3 bg-secondary rounded shimmer w-full" />
            <div className="h-3 bg-secondary rounded shimmer w-4/5" />
          </div>
        )}

        {/* Outfit result */}
        {outfit && !loading && <OutfitCard outfit={outfit} occasion={occasion} />}

        {/* Empty State */}
        {!loading && !outfit && (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-zinc-600 mb-4" />
            <p className="text-zinc-500">Your curated outfit will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

