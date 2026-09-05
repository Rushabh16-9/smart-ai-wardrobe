import { createClient } from '@/lib/supabase/server';
import { Metadata } from 'next';
import Link from 'next/link';
import { WardrobeGrid } from '@/components/wardrobe-grid';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/count-up';

export const metadata: Metadata = {
  title: 'My Wardrobe',
  description: 'Browse and manage all your clothing items in your AI-powered digital wardrobe.',
};

export default async function WardrobePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  const totalItems = items?.length ?? 0;

  // Derive category counts
  const categoryCounts: Record<string, number> = {};
  items?.forEach((item) => {
    const type = item.type ?? 'Other';
    categoryCounts[type] = (categoryCounts[type] ?? 0) + 1;
  });

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="p-6 lg:p-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary/70 font-medium mb-1">Digital Wardrobe</p>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground">My Closet</h1>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(201,169,110,0.2)] transition-all"
          render={<Link href="/add-item" />}
        >
          ⊕ Add Item
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-xl p-4 hover:bg-zinc-900/80 transition-colors">
          <CountUp end={totalItems} duration={600} className="text-2xl font-bold text-foreground block" />
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Total Items</p>
        </div>
        {topCategories.map(([type, count]) => (
          <div key={type} className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-xl p-4 hover:bg-zinc-900/80 transition-colors">
            <CountUp end={count} duration={600} className="text-2xl font-bold text-foreground block" />
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{type}</p>
          </div>
        ))}
      </div>

      {/* Wardrobe grid */}
      {totalItems === 0 ? (
        <EmptyState />
      ) : (
        <WardrobeGrid items={items ?? []} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 text-3xl">
        ◈
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-3">Your wardrobe is empty</h2>
      <p className="text-muted-foreground text-sm max-w-sm mb-8">
        Add your first clothing item by uploading an image or pasting a product URL.
      </p>
      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" render={<Link href="/add-item" />}>
        Add Your First Item
      </Button>
    </div>
  );
}

