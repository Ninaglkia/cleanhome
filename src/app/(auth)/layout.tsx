export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#1a3a35] to-[#2d5a52] p-6">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#4fc4a3]/10 blur-3xl motion-safe:animate-pulse" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-[#4fc4a3]/8 blur-3xl motion-safe:animate-pulse" />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
