import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: {
    default: 'VESTIRE — Smart AI Wardrobe',
    template: '%s | VESTIRE',
  },
  description:
    'Your AI-powered personal stylist. Manage your wardrobe, get outfit recommendations, and discover your signature look.',
  keywords: ['wardrobe', 'AI stylist', 'outfit recommendations', 'fashion', 'clothing'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'oklch(0.11 0.005 285)',
              border: '1px solid oklch(0.20 0.005 285)',
              color: 'oklch(0.95 0.005 285)',
            },
          }}
        />
      </body>
    </html>
  );
}
