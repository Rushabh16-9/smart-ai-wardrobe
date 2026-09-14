import { Metadata } from 'next';
import { AddItemForm } from '@/components/add-item-form';
import { Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Add Item | Vestire AI Wardrobe',
  description: 'Upload a clothing photo or paste a product URL to add it to your AI-powered wardrobe.',
};

export default function AddItemPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-80px)] flex flex-col justify-center max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="text-center space-y-2 mb-8 relative">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-semibold uppercase tracking-widest text-[#d4af37]">
          <Sparkles className="w-3 h-3" />
          <span>Expand Your Closet</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-serif">
          Add New Wardrobe Item
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm max-w-lg mx-auto">
          Upload an image, paste a product link, or bulk upload multiple items. Gemini AI auto-categorizes them for you.
        </p>
      </div>

      {/* Main Single Centered Card */}
      <AddItemForm />
    </div>
  );
}
