import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to M1 Mods MultiAgent.',
};

export default function SignInPage() {
  // AuthForm reads ?next= / ?error= from the URL, which requires a Suspense
  // boundary during prerendering.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <Skeleton className="h-80 w-full max-w-sm" />
        </div>
      }
    >
      <AuthForm mode="signin" />
    </Suspense>
  );
}
