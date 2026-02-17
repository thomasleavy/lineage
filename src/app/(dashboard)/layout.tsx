'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { trpc } from '~/trpc/client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const utils = trpc.useUtils();
  const { data: me, isLoading, isFetched } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    if (res.ok) {
      utils.auth.me.setData(undefined, undefined);
    }
    router.push('/login');
    router.refresh();
  };

  if (isFetched && !me) {
    router.replace('/login');
    return null;
  }
  if (isLoading && !me) {
    return null;
  }

  const nav = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/garments', label: 'Items' },
    { href: '/photo-gallery', label: 'Photo gallery' },
    { href: '/search', label: 'Search' },
    { href: '/looks', label: 'Lookbook' },
    { href: '/tablet', label: 'Tablet' },
    { href: '/about', label: 'About' },
    ...(me?.roles?.includes('CREATIVE_DIRECTOR') || me?.roles?.includes('LEGAL_AUDIT') ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/dashboard" className="text-lg font-semibold text-zinc-100">
            LINEAGE
          </Link>
          <nav className="flex gap-4">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm ${pathname === href ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{me?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
              suppressHydrationWarning
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-4">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
