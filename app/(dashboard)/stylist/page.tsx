import { Metadata } from 'next';
import { StylistPanel } from '@/components/stylist-panel';

export const metadata: Metadata = {
  title: 'AI Stylist',
  description: 'Get personalized outfit recommendations for any occasion powered by Gemini AI.',
};

export default function StylistPage() {
  return (
    <div className="p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-primary/70 font-medium mb-1">Powered by Gemini</p>
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground">AI Stylist</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Tell me the occasion and I&apos;ll build the perfect outfit from your wardrobe.
        </p>
      </div>

      <StylistPanel />
    </div>
  );
}
