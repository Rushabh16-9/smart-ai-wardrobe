import { Metadata } from 'next';
import { AddItemForm } from '@/components/add-item-form';

export const metadata: Metadata = {
  title: 'Add Item',
  description: 'Upload a clothing photo or paste a product URL to add it to your AI-powered wardrobe.',
};

export default function AddItemPage() {
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-primary/70 font-medium mb-1">Expand Your Closet</p>
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground">Add New Item</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Upload an image or paste a product link. Gemini AI will auto-categorize it for you.
        </p>
      </div>

      <AddItemForm />
    </div>
  );
}
