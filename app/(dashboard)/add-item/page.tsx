import { Metadata } from 'next';
import { AddItemForm } from '@/components/add-item-form';
import { BulkUploadForm } from '@/components/bulk-upload-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata: Metadata = {
  title: 'Add Item',
  description: 'Upload a clothing photo or paste a product URL to add it to your AI-powered wardrobe.',
};

export default function AddItemPage() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-primary/70 font-medium mb-1">Expand Your Closet</p>
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground">Add New Item</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Upload an image, paste a product link, or bulk upload multiple items. Gemini AI will auto-categorize them for you.
        </p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid grid-cols-2 mb-8 bg-zinc-950/50 p-1 rounded-xl border border-white/5">
          <TabsTrigger value="single" className="rounded-lg py-2.5 data-[state=active]:bg-[#d4af37] data-[state=active]:text-black data-[state=active]:shadow-md data-active:bg-[#d4af37] data-active:text-black data-active:shadow-md font-medium text-muted-foreground transition-all">
            Single Upload
          </TabsTrigger>
          <TabsTrigger value="bulk" className="rounded-lg py-2.5 data-[state=active]:bg-[#d4af37] data-[state=active]:text-black data-[state=active]:shadow-md data-active:bg-[#d4af37] data-active:text-black data-active:shadow-md font-medium text-muted-foreground transition-all">
            Bulk Upload
          </TabsTrigger>
        </TabsList>
        <TabsContent value="single">
          <AddItemForm />
        </TabsContent>
        <TabsContent value="bulk">
          <BulkUploadForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
