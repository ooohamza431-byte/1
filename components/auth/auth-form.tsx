'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Loader2, LogIn, Mail, ShieldAlert, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LogoWordmark } from '@/components/studio/logo';
import { cn } from '@/lib/utils/cn';

/** Small inline GitHub mark (the brand icon is not in the base lucide set). */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn('size-4', className)}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.94c.58.1.79-.25.79-.55v-2.1c-3.2.7-3.88-1.36-3.88-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

/**
 * Credentials + OAuth sign-in.
 *
 * `callbackUrl` is honoured so a user who hit a protected page lands back on it
 * after signing in; the middleware puts the original destination in `next`.
 */
export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get('next') ?? params.get('callbackUrl') ?? '/studio';
  const initialError = params.get('error');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(
    initialError ? 'That sign-in attempt failed. Check your details and try again.' : null,
  );
  const [pending, setPending] = React.useState<'credentials' | 'google' | 'github' | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === 'signup' && password.length < 8) {
      setError('Passwords need at least 8 characters.');
      return;
    }

    setPending('credentials');
    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        name: name.trim() || undefined,
        mode,
        redirect: false,
      });

      if (!result || result.error) {
        setError(
          mode === 'signup'
            ? 'Could not create that account. It may already exist, or sign-ups are disabled.'
            : 'Incorrect email or password.',
        );
        setPending(null);
        return;
      }

      /**
       * Hard navigation, deliberately.
       *
       * `signIn(..., { redirect: false })` sets the session cookie on the
       * response to this fetch, so the *next* document request carries it. A
       * client-side `router.push` can instead be served from the router's
       * prefetched RSC payload — the one cached from the signed-out redirect to
       * `/signin?error=unauthenticated` — which drops the user straight back on
       * the sign-in page with a bogus "unauthenticated" error. A full document
       * load is one round trip and always sees the new cookie.
       */
      window.location.assign(nextUrl);
    } catch {
      setError('Sign-in failed. Please try again.');
      setPending(null);
    }
  };

  const oauth = (provider: 'google' | 'github') => {
    setPending(provider);
    void signIn(provider, { callbackUrl: nextUrl });
  };

  return (
    <div className="dot-grid flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <Link href="/" className="inline-flex">
            <LogoWordmark />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === 'signup'
                ? 'Sign up to build with six specialised agents across nine providers.'
                : 'Sign in to continue to your studio.'}
            </p>
          </div>
        </div>

        <div className="panel space-y-4 p-5">
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => oauth('github')} disabled={pending !== null}>
              {pending === 'github' ? <Loader2 className="animate-spin" /> : <GithubMark />}
              Continue with GitHub
            </Button>
            <Button variant="outline" onClick={() => oauth('google')} disabled={pending !== null}>
              {pending === 'google' ? <Loader2 className="animate-spin" /> : <Mail />}
              Continue with Google
            </Button>
          </div>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              or use email
            </span>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' ? (
              <div className="space-y-1.5">
                <Label htmlFor="name" hint="optional">
                  Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email" required>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" required hint={mode === 'signup' ? 'min 8 characters' : undefined}>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>

            {error ? (
              <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending !== null}>
              {pending === 'credentials' ? (
                <Loader2 className="animate-spin" />
              ) : mode === 'signup' ? (
                <UserPlus />
              ) : (
                <LogIn />
              )}
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <Link href="/signin" className="text-brand hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link href="/signup" className="text-brand hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
