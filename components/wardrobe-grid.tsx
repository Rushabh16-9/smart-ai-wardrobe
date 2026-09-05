'use client';

import { useState } from 'react';
import { WardrobeItem } from '@/types/wardrobe';
import { WardrobeCard } from './wardrobe-card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const FORMALITY_FILTERS = ['All', 'Casual', 'Smart Casual', 'Business Casual', 'Semi-Formal', 'Formal'];

const SWATCHES = [
  { name: 'All', style: { background: 'transparent' }, className: 'border border-border' },
  { name: 'Black', style: { background: 'linear-gradient(135deg, #222 0%, #111 100%)' } },
  { name: 'White', style: { background: 'linear-gradient(135deg, #fff 0%, #eee 100%)' } },
  { name: 'Blue', style: { background: 'linear-gradient(45deg, #1e3a8a 25%, #2563eb 25%, #2563eb 50%, #1e3a8a 50%, #1e3a8a 75%, #2563eb 75%, #2563eb 100%)', backgroundSize: '4px 4px' }, className: 'border border-blue-900/50' }, // Denim texture
  { name: 'Brown', style: { background: 'radial-gradient(circle at center, #78350f 0%, #451a03 100%)' }, className: 'border border-amber-900/50' }, // Leather texture
  { name: 'Red', style: { background: 'repeating-linear-gradient(45deg, #991b1b, #991b1b 2px, #b91c1c 2px, #b91c1c 4px)' } }, // Woven texture
  { name: 'Green', style: { background: 'linear-gradient(135deg, #14532d 0%, #064e3b 100%)' } },
  { name: 'Gray', style: { background: 'linear-gradient(135deg, #52525b 0%, #3f3f46 100%)' } },
];

interface WardrobeGridProps {
  items: WardrobeItem[];
}

export function WardrobeGrid({ items }: WardrobeGridProps) {
  const [search, setSearch] = useState('');
  const [formalityFilter, setFormalityFilter] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');

  const availableColors = new Set(items.map(i => i.color?.toLowerCase()).filter(Boolean));
  const activeSwatches = SWATCHES.filter(s => s.name === 'All' || availableColors.has(s.name.toLowerCase()));

  const filtered = items.filter((item) => {
    const matchesSearch =
      !search ||
      [item.type, item.color, item.pattern, item.brand, item.tags?.join(' ')]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(search.toLowerCase()));

    const matchesFormality =
      formalityFilter === 'All' || item.formality === formalityFilter;

    const matchesColor =
      colorFilter === 'All' || (item.color && item.color.toLowerCase().includes(colorFilter.toLowerCase()));

    return matchesSearch && matchesFormality && matchesColor;
  });

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-sm">⌕</span>
          <Input
            id="wardrobe-search"
            placeholder="Search by type, color, pattern…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-input border-border text-foreground placeholder:text-muted-foreground/40 h-10"
          />
        </div>
      </div>

      {/* Formality filter pills */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-wrap gap-2">
          {FORMALITY_FILTERS.map((f) => (
            <button
              key={f}
              id={`filter-${f.toLowerCase().replace(' ', '-')}`}
              onClick={() => setFormalityFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs border transition-all duration-200',
                formalityFilter === f
                  ? 'bg-[#d4af37] text-black font-medium border-[#d4af37]'
                  : 'text-muted-foreground border-border hover:bg-zinc-800 transition-colors hover:text-foreground bg-transparent'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Textile Swatches Filter */}
        {activeSwatches.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-muted-foreground/60 mr-2">Color Swatches</span>
            {activeSwatches.map((swatch) => (
              <button
                key={swatch.name}
              title={swatch.name}
              onClick={() => setColorFilter(swatch.name)}
              style={swatch.style}
              className={cn(
                'w-8 h-8 rounded-full shadow-inner transition-all duration-300 relative',
                swatch.className || '',
                colorFilter === swatch.name 
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' 
                  : 'hover:scale-105 opacity-80 hover:opacity-100'
              )}
            >
              {swatch.name === 'All' && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground font-bold">ALL</span>}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground/50 self-center">
            {filtered.length} of {items.length} items
          </span>
        </div>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground/50">
          <p className="text-sm">No items match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 stagger-children">
          {filtered.map((item) => (
            <div key={item.id}>
              <WardrobeCard item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

