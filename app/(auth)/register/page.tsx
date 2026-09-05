'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Account created! Check your email to confirm.', { duration: 6000 });
      router.push('/login');
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Create Account</h1>
        <p className="text-muted-foreground text-sm">Start building your digital wardrobe</p>
      </div>

      {/* Form */}
      <form onSubmit={handleRegister} className="space-y-5">
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
          <Label htmlFor="new-password" className="text-foreground/80 text-sm font-medium">Password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-colors h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-foreground/80 text-sm font-medium">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
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
              Creating Account…
            </span>
          ) : (
            'Create Account'
          )}
        </Button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
