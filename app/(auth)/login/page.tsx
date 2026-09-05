'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Welcome back!');
      router.push('/wardrobe');
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="glass-card rounded-2xl p-8 border border-border">
      {/* Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-primary text-sm font-bold">V</span>
          </div>
          <span className="text-lg font-bold tracking-[0.2em] text-foreground/80 uppercase">Vestire</span>
        </Link>
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
        <p className="text-muted-foreground text-sm">Sign in to your wardrobe</p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground/80 text-sm font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-colors h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-foreground/80 text-sm font-medium">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-colors h-11"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(201,169,110,0.2)] hover:shadow-[0_0_30px_rgba(201,169,110,0.3)] transition-all duration-300 font-semibold tracking-wide"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Signing In…
            </span>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        New to Vestire?{' '}
        <Link href="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
          Create an account
        </Link>
      </p>
    </div>
  );
}
