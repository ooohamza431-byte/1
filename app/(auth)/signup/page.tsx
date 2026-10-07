import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Sign up for M1 Mods MultiAgent — build with six specialised agents across nine providers.',
};

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <Skeleton className="h-96 w-full max-w-sm" />
        </div>
      }
    >
      <AuthForm mode="signup" />
    </Suspense>
  );
}
