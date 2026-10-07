import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { AdminShell } from '@/components/admin/admin-shell';

/**
 * Admin layout.
 *
 * Server-side gate: the session is re-read here (not just trusted from the
 * middleware) and anyone below the `admin` role is redirected. The API routes
 * enforce the same rule with `requirePermission`, so this is defence in depth
 * rather than the only control.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user) redirect('/signin?next=/admin');
  if (role !== 'admin' && role !== 'owner') redirect('/studio?error=forbidden');

  return <AdminShell>{children}</AdminShell>;
}
