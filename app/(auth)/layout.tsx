export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full opacity-30"
          style={{
            background: `radial-gradient(ellipse at 20% 50%, oklch(0.78 0.12 75 / 0.08) 0%, transparent 60%),
                         radial-gradient(ellipse at 80% 50%, oklch(0.65 0.18 290 / 0.06) 0%, transparent 60%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(oklch(0.78 0.12 75) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.12 75) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Auth card */}
      <div className="relative z-10 w-full max-w-md px-6 fade-in">
        {children}
      </div>
    </div>
  );
}
