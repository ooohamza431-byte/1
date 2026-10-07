import Link from 'next/link';
import { LogoWordmark } from '@/components/studio/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="inline-flex items-center">
          <LogoWordmark />
        </Link>
        <nav className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/studio" className="hover:text-foreground">
            Studio
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
