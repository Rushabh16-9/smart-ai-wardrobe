'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Wardrobe', href: '/wardrobe', icon: '◈' },
  { label: 'Add Item',  href: '/add-item',  icon: '⊕' },
  { label: 'AI Stylist', href: '/stylist',  icon: '✦' },
  { label: 'History',   href: '/history',   icon: '◷' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success('Signed out');
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <Link href="/wardrobe" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
            <span className="text-primary font-bold text-base">V</span>
          </div>
          <div>
            <p className="text-sm font-bold tracking-[0.15em] uppercase text-foreground/90">Vestire</p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">AI Wardrobe</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/wardrobe' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 glowing-particle-btn',
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/25 shadow-[0_0_15px_rgba(201,169,110,0.1)]'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent'
              )}
            >
              <span className={cn('text-base leading-none z-10', isActive ? 'text-primary' : 'opacity-60')}>
                {item.icon}
              </span>
              <span className="z-10">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {/* Divider label */}
        <p className="px-4 text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-3">Account</p>

        <button
          id="sign-out-btn"
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive border border-transparent hover:border-destructive/20 transition-all duration-200"
        >
          <span className="text-base leading-none opacity-60">⏻</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-sidebar border-t border-sidebar-border">
      <div className="flex items-center justify-around px-4 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/wardrobe' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs transition-all duration-200',
                isActive ? 'text-primary' : 'text-muted-foreground/60'
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
