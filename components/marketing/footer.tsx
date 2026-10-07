import Link from 'next/link';
import { Code2, Package } from 'lucide-react';
import { LogoWordmark } from '@/components/studio/logo';
import { APP_NAME } from '@/lib/constants';

/** Marketing footer. Kept as a component so every public page shares one. */
export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <LogoWordmark />
          <p className="max-w-56 text-[11px] leading-relaxed text-muted-foreground">
            A multi-provider AI studio with a six-agent build pipeline and a full administration layer.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Package className="size-3.5" />
            MIT licensed · self-hostable
          </div>
        </div>

        <nav className="space-y-2 text-xs">
          <p className="font-medium">Product</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>
              <Link href="/studio" className="transition-colors hover:text-foreground">
                Studio
              </Link>
            </li>
            <li>
              <Link href="/studio/build" className="transition-colors hover:text-foreground">
                Build pipeline
              </Link>
            </li>
            <li>
              <Link href="/studio/images" className="transition-colors hover:text-foreground">
                Image Studio
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
            </li>
          </ul>
        </nav>

        <nav className="space-y-2 text-xs">
          <p className="font-medium">Account</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>
              <Link href="/signin" className="transition-colors hover:text-foreground">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/signup" className="transition-colors hover:text-foreground">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/studio/keys" className="transition-colors hover:text-foreground">
                API keys
              </Link>
            </li>
            <li>
              <Link href="/studio/settings" className="transition-colors hover:text-foreground">
                Settings
              </Link>
            </li>
          </ul>
        </nav>

        <nav className="space-y-2 text-xs">
          <p className="font-medium">Administration</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>
              <Link href="/admin" className="transition-colors hover:text-foreground">
                Admin panel
              </Link>
            </li>
            <li>
              <Link href="/admin/keys" className="transition-colors hover:text-foreground">
                Server keys
              </Link>
            </li>
            <li>
              <Link href="/admin/analytics" className="transition-colors hover:text-foreground">
                Analytics
              </Link>
            </li>
            <li>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <Code2 className="size-3" /> Source
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-border px-4 py-4">
        <p className="mx-auto max-w-6xl text-[11px] text-muted-foreground">
          © {year} {APP_NAME}. Provider names and model identifiers belong to their respective owners.
        </p>
      </div>
    </footer>
  );
}
