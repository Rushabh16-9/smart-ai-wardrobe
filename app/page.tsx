import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/wardrobe');
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/3 blur-3xl" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(oklch(0.78 0.12 75) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.12 75) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto fade-in">
        {/* Logo */}
        <div className="mb-8 inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-primary text-lg font-bold">V</span>
          </div>
          <span className="text-2xl font-bold tracking-[0.2em] text-foreground/80 uppercase">Vestire</span>
        </div>

        {/* Hero headline */}
        <h1 className="text-5xl sm:text-7xl font-bold leading-tight mb-6">
          <span className="block text-foreground/90">Your Smart</span>
          <span className="block gradient-text">AI Wardrobe</span>
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload your clothes, let AI categorize them, and get personalized outfit recommendations for any occasion — all powered by Gemini Vision.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {[
            '✦ AI Auto-Categorization',
            '✦ Background Removal',
            '✦ Outfit Stylist',
            '✦ Web Scraping',
          ].map((feat) => (
            <span
              key={feat}
              className="px-4 py-1.5 rounded-full text-sm font-medium glass border border-primary/20 text-primary/80"
            >
              {feat}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-base px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_rgba(201,169,110,0.3)] hover:shadow-[0_0_50px_rgba(201,169,110,0.4)] transition-all duration-300" render={<Link href="/register" />}>
            Get Started Free
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8 py-6 border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-300" render={<Link href="/login" />}>
            Sign In
          </Button>
        </div>
      </div>

      {/* Bottom tagline */}
      <p className="absolute bottom-8 text-xs text-muted-foreground/50 tracking-widest uppercase">
        Powered by Gemini AI · Built with Next.js
      </p>
    </main>
  );
}
