'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    // Use /login so Next.js adds basePath once (avoids /lineage/lineage/login)
    router.replace('/login');
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-zinc-400">Redirecting to sign in…</p>
    </main>
  );
}
